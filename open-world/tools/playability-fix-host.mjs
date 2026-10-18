import {spawn,spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {Pool} from 'pg';
import {root,freePort,pgCommand,stopChild,waitFor} from './runtime.mjs';
const out=root+'/docs/reviews/playability-fix-20261008',work=root+'/.qa/playability-fix-'+Date.now(),data=work+'/data';
await mkdir(data,{recursive:true});await mkdir(out+'/evidence',{recursive:true});
function command(name,args){const r=spawnSync(pgCommand(name),args,{encoding:'utf8',windowsHide:true,...(name==='pg_ctl'?{stdio:'ignore'}:{})});if(r.status!==0)throw Error(r.stderr||r.error?.message||name+' failed');}
const port=await freePort(),apiPort=await freePort(),webPort=await freePort();
command('initdb',['-D',data,'-U','aw_world','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--locale=C']);
command('pg_ctl',['-D',data,'-l',work+'/postgres.log','-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);
const dsn=`postgresql://aw_world@127.0.0.1:${port}/postgres`,owner=new Pool({connectionString:dsn}),services={};let server,web,closing=false;
async function stop(){if(closing)return;closing=true;await stopChild(web);await stopChild(server);await owner.end();command('pg_ctl',['-D',data,'-m','fast','-w','stop']);}
process.on('SIGINT',()=>stop().then(()=>process.exit()));process.on('SIGTERM',()=>stop().then(()=>process.exit()));
try{
 for(const [phase,file,schema] of [['fresh',null,'public'],['new','final-new.dump','public'],['late','final-late.dump','qa_calendar_cf329c27c2a34ef599b2ded6fc6d6056'],['endfresh','final-endfresh.dump','qa_calendar_cf329c27c2a34ef599b2ded6fc6d6056'],['middle','checkpoint-30.dump','qa_calendar_cf329c27c2a34ef599b2ded6fc6d6056']]){
  const database='fix_'+phase;await owner.query('CREATE DATABASE '+database);const url=dsn.replace('/postgres','/'+database);
  if(file)command('pg_restore',['--dbname',url,'--clean','--if-exists','--exit-on-error','--no-owner','--no-acl',root+'/docs/reviews/playability-20261008/evidence/'+file]);
  await owner.query('ALTER DATABASE '+database+' SET search_path TO '+schema+',public');services[phase]={dsn:url,schema,file};
 }
 const info={ownerPid:process.pid,work,dsn,apiPort,webPort,url:`http://127.0.0.2:${webPort}`,services};await writeFile(out+'/isolated-session.json',JSON.stringify(info,null,2));
 let key='';
 while(true){
  let control={phase:'fresh',reload:0};try{control=JSON.parse(await readFile(out+'/host-control.json','utf8'));}catch{}
  if(control.stop)break;const next=JSON.stringify(control);
  if(next!==key){await stopChild(server);const log=await open(out+'/evidence/api-'+control.phase+'.log','a');server=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:services[control.phase].dsn,AW_API_PORT:String(apiPort),AW_TEST_LOGIN:'1',AW_FIELD_QA:'0',AW_ORIGINS:info.url},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();await waitFor('http://127.0.0.1:'+apiPort+'/api/health',server);key=next;console.log('API_READY',control.phase);}
  if(!web){const log=await open(out+'/evidence/vite.log','a');web=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts','--host','127.0.0.2'],{cwd:root,env:{...process.env,AW_API_PORT:String(apiPort),AW_WEB_PORT:String(webPort)},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();await waitFor(info.url,web);console.log('GUI_READY',info.url);}
  await new Promise(r=>setTimeout(r,1000));
 }
}finally{await stop();}
