/** 隔离库与随机端口的真实API重载验证，不操作正式服务。 */
import assert from 'node:assert/strict';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {startDatabase,freePort,stopChild,registerApi,root} from './runtime.mjs';
import {poolFor} from '../apps/api/src/database.ts';
import {versions} from '../packages/contracts/index.ts';
import {regionById} from '../packages/content/index.ts';
const out=resolve(root,process.argv[2]??'.qa/crafting-20261014/reload');await mkdir(out,{recursive:true});
const db=await startDatabase({temporary:true,reap:false});assert(![8612,8790].includes(db.port));let port;do{port=await freePort();}while([8611,8612,8790].includes(port));
const pool=poolFor(db.dsn),url='http://127.0.0.1:'+port;let api,cookie;
async function request(path,body){const response=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return {body:result,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function start(label){
 const log=await open(join(out,label+'.log'),'w');api=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,NODE_ENV:'test',AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_TEST_LOGIN:'1',AW_STATIC_ROOT:join(out,'no-static-files')},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();await registerApi(db,api);
 for(let n=0;n<60;n++){assert(api.exitCode===null,'隔离API启动失败，查看本地日志');try{await request('health');return;}catch{await new Promise(r=>setTimeout(r,500));}}
 throw Error('隔离API未在30秒内就绪');
}
try{
 await start('before');const login=await request('session/login',{username:'craft_reload_'+randomUUID().replaceAll('-','').slice(0,14)});cookie=login.cookie;const created=(await request('character',{name:'制作重载验收'})).body,id=created.id;
 const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;delete stored.story;delete stored.starsea;stored.gold=500;stored.material=123;stored.progression.materials={ore:20,herb:9,leather:3};stored.progression.professions={craft:'alchemy',craftLevel:31,craftXp:5,gatherLevel:4,gatherXp:3,gatherCharges:2};delete stored.progression.crafting;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[stored,id]);
 const lease=(await request('control',{client_id:randomUUID()})).body.lease_id,forge=regionById('ss-map-port').landmarks.find(l=>l.kind==='forge'),body={command_id:randomUUID(),revision:stored.revision,lease_id:lease,region:'ss-map-port',position:{x:forge.x,y:forge.y},action:{op:'refine',from:'wind_ore',times:1}},receipt=(await request('crafting/action',body)).body;
 assert.deepEqual((await request('crafting/action',body)).body,receipt);
 const before=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state,ledger=(await pool.query('SELECT * FROM ow_ledger WHERE character=$1 ORDER BY command',[id])).rows,history=(await pool.query('SELECT receipt FROM ow_receipts WHERE character=$1',[id])).rows;
 before.progression.materials.ore=7;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[before,id]);await pool.query('DELETE FROM ow_schema WHERE version=17');await stopChild(api);api=undefined;await start('after');
 const health=(await request('health')).body,content=(await request('content')).body,after=(await request('character')).body;assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(content.crafting.materials.length,34);assert.equal(after.gold,before.gold);assert.equal(after.material,before.material);assert.deepEqual(after.gear,before.gear);assert.equal(after.revision,before.revision);assert.equal(after.progression.materials.wind_ore,17);assert.equal(after.progression.materials.wind_herb,9);assert.equal(after.progression.materials.wind_part,3);assert(!Object.hasOwn(after.progression.materials,'ore'));assert.equal(after.progression.crafting.professions.alchemy.level,31);
 assert.deepEqual((await pool.query('SELECT * FROM ow_ledger WHERE character=$1 ORDER BY command',[id])).rows,ledger);assert.deepEqual((await pool.query('SELECT receipt FROM ow_receipts WHERE character=$1',[id])).rows,history);assert.deepEqual((await request('receipt/'+body.command_id)).body,receipt);
 const result={passed:true,environment:'自有隔离PostgreSQL、随机端口、真实API进程两次启动',apiPort:port,dbPort:db.port,versions,healthContentConsistent:true,sessionRestored:true,walletPreserved:true,gearPreserved:true,oldMaterialsMigrated:true,receiptAndLedgerPreserved:true,receiptCount:history.length,ledgerCount:ledger.length,gearDigest:createHash('sha256').update(JSON.stringify(after.gear)).digest('hex'),officialServiceTouched:false};await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await stopChild(api);await pool.end();await writeFile(join(out,'cleanup.json'),JSON.stringify(await db.stop(),null,2)+'\n');}
