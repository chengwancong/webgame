// Temporary, isolated GUI acceptance host. Never reads or writes the normal game DB.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createServer} from 'vite';
import {startDatabase,freePort,stopChild,waitFor,registerApi,root} from './runtime.mjs';

const sessionName=process.env.AW_GUI_SESSION??'hex-acceptance-20261020';
if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(sessionName))throw Error('Invalid isolated GUI session name');
const out=resolve(root,'.runtime',sessionName);await mkdir(out,{recursive:true});
const statusPath=resolve(out,'host.json'),controlPath=resolve(out,'control.json');
const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString();
let db,api,web,pool,closing=false;
const status={phase:'starting',ownerPid:process.pid,expiresAt,accounts:[]};
async function record(){await writeFile(statusPath,JSON.stringify(status,null,2));}
async function stop(){if(closing)return;closing=true;status.phase='stopping';await record();await web?.close();await stopChild(api);await pool?.end();if(db)status.cleanup=await db.stop();status.phase='stopped';await record();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop().then(()=>process.exit()));
await record();await writeFile(controlPath,JSON.stringify({stop:false}));
try{
 db=await startDatabase({temporary:true,reap:false});pool=new Pool({connectionString:db.dsn,max:2});
 const apiPort=await freePort(),webPort=await freePort(),apiUrl=`http://127.0.0.1:${apiPort}`,url=`http://127.0.0.2:${webPort}`;
 const log=await open(resolve(out,'api.log'),'a');
 api=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,NODE_ENV:'development',AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_TEST_LOGIN:'1',AW_DEV_CHECKPOINTS:'1',AW_FIELD_QA:'0',AW_ORIGINS:url+','+apiUrl},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});
 await log.close();await registerApi(db,api);await waitFor(apiUrl+'/api/health',api);
 web=await createServer({configFile:resolve(root,'apps/web/vite.config.ts'),cacheDir:resolve(db.work,'vite-cache'),server:{host:'127.0.0.2',port:webPort,strictPort:true,proxy:{'/api':{target:apiUrl,ws:true}}}});await web.listen();
 for(const [username,level]of [['qa_hex_sample',30],['qa_hex_low',1],['qa_reward_preview',60]]){
  let cookie='',revision=0,lease;
  async function request(path,body){const response=await fetch(apiUrl+'/api/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const set=response.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const data=await response.json();if(!response.ok)throw Error(path+': '+JSON.stringify(data));return data;}
  async function command(path,extra){const result=await request(path,{command_id:randomUUID(),revision,lease_id:lease,...extra});revision=result.revision;return result;}
  await request('session/login',{username});const character=await request('character',{name:username==='qa_reward_preview'?'奖励预览验收':level===30?'海克斯样板验收':'海克斯等级限制'});revision=character.revision;
  lease=(await request('control',{client_id:randomUUID()})).lease_id;
  await command('dev/checkpoint',{checkpoint:'landing',weapon:'sword'});
  // Explicit controlled fixture, not natural progression or a production account.
  await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{level}',$1::jsonb) WHERE id=$2",[JSON.stringify(level),character.id]);
  if(username==='qa_reward_preview'){
   const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[character.id])).rows[0].state;
   state.starsea.features=[...new Set([...state.starsea.features,'trial','high','nightmare','raid'])];
   state.progress.regions=[...new Set([...state.progress.regions,'town','meadow','forest'])];
   state.gold=100000;state.material=10000;
   state.gear.find(g=>g.id===state.equipment.weapon).attack=100000;
   state.gear.find(g=>g.id===state.equipment.armor).armor=100000;
   await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,character.id]);
   const catalogue=await request('dungeons/catalog'),nightmare=catalogue.entries.find(e=>e.definition.id==='nightmare');
   if(!nightmare?.eligible)throw Error('Reward QA nightmare unavailable: '+JSON.stringify(nightmare));
   status.rewardPreviewEvidence=[];
   for(const tier of [1,10,100,1])status.rewardPreviewEvidence.push(await request('dungeons/reward-preview?dungeon_id=nightmare&tier='+tier));
  }
  const gear=[];for(const quality of ['common','magic','rare','legendary']){const r=await command('dev/hex-grant',{base:'hex-chain-lightning',quality});gear.push({id:r.delta.gear[0].id,quality});}
  status.accounts.push({username,level,gear,fixture:username==='qa_reward_preview'?'controlled level/features/resources/strong gear for reward UI and settlement QA; not natural progression':'controlled QA grant; landing checkpoint; not natural progression'});
 }
 status.phase='ready';status.url=url;status.apiUrl=apiUrl;status.apiPid=api.pid;status.databaseWork=db.work;status.versions=(await (await fetch(apiUrl+'/api/health')).json()).versions;await record();
 console.log('HEX_ACCEPTANCE_READY '+JSON.stringify({url,accounts:status.accounts.map(a=>({username:a.username,level:a.level})),expiresAt,controlPath}));
 while(!closing&&Date.now()<Date.parse(expiresAt)){
  const control=JSON.parse(await readFile(controlPath,'utf8'));if(control.stop)break;
  if(api.exitCode!==null)throw Error('Isolated API exited');
  await new Promise(r=>setTimeout(r,1000));
 }
}catch(error){status.error=String(error);await record();process.exitCode=1;throw error;}
finally{await stop();}
