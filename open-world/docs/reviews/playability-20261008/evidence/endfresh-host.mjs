import {Pool} from 'pg';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,writeFile,open} from 'node:fs/promises';
import {root,freePort,pgCommand,stopChild,waitFor} from '../../../../tools/runtime.mjs';
const out=root+'/docs/reviews/playability-20261008/evidence';
const session=JSON.parse(await readFile(out+'/session.json','utf8')),owner=new Pool({connectionString:session.dsn}),servers=[],results=[];
let stopping=false;
async function stop(){if(stopping)return;stopping=true;for(const server of servers)await stopChild(server);await owner.end();}
process.on('SIGTERM',()=>stop().then(()=>process.exit()));process.on('SIGINT',()=>stop().then(()=>process.exit()));
try{for(const [phase,level]of [['endfresh',50]]){
 const cp=JSON.parse(await readFile(out+'/checkpoint-'+level+'.json','utf8')),database='playability_'+phase;
 await owner.query('CREATE DATABASE '+database);
 const dsn=session.dsn.replace('/postgres','/'+database);
 const restored=spawnSync(pgCommand('pg_restore'),['--dbname',dsn,'--exit-on-error','--no-owner',out+'/checkpoint-'+level+'.dump'],{encoding:'utf8',windowsHide:true});if(restored.status!==0)throw Error(restored.stderr);
 await owner.query('ALTER DATABASE '+database+' SET search_path TO '+cp.schema+',public');
 const pool=new Pool({connectionString:dsn});const accounts=(await pool.query('SELECT a.username,c.id,c.state->>\'level\' AS level FROM ow_accounts a JOIN ow_characters c ON a.id=c.account')).rows;const counts=(await pool.query('SELECT (SELECT count(*) FROM ow_kills) AS kills,(SELECT count(*) FROM ow_receipts) AS receipts,(SELECT count(*) FROM ow_ledger) AS ledger')).rows[0];await pool.end();
 const port=await freePort(),log=await open(out+'/api-'+phase+'.log','w');
 const server=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:dsn,AW_API_PORT:String(port),AW_TEST_LOGIN:'1',AW_FIELD_QA:'0',AW_ORIGINS:'http://127.0.0.1:'+port},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();servers.push(server);await waitFor('http://127.0.0.1:'+port+'/api/health',server);
 results.push({phase,dsn,port,url:'http://127.0.0.1:'+port,accounts,counts,checkpointLevel:cp.level,checkpointVirtualMinutes:cp.minutes,schema:cp.schema});await writeFile(out+'/sample-services-endfresh.json',JSON.stringify(results,null,2));console.log('READY',phase,port,accounts);
 }while(true){await new Promise(r=>setTimeout(r,1000));try{await readFile(out+'/stop-endfresh');break;}catch{}}
}finally{await stop();}
