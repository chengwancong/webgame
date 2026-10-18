import {startDatabase,freePort,stopChild,registerApi,waitFor,root} from '../../../../tools/runtime.mjs';
import {acquireHeavyJob} from '../../../../tools/heavy-job-lock.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {writeFile,readFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(root,'docs/reviews/playability-20261008/evidence');
const lock=await acquireHeavyJob({session:'playability-20261008',job:'visible playability acceptance; one active heavy job',onWait:s=>console.log('QUEUE',s)});
let db,server;let closing=false;
async function cleanup(){if(closing)return;closing=true;await stopChild(server);if(db)await writeFile(out+'/cleanup.json',JSON.stringify(await db.stop(),null,2));await lock.release();}
process.on('SIGINT',()=>cleanup().then(()=>process.exit()));process.on('SIGTERM',()=>cleanup().then(()=>process.exit()));
try {
 db=await startDatabase({temporary:true});
 const port=await freePort(),log=await open(out+'/api.log','w');
 server=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_TEST_LOGIN:'1',AW_FIELD_QA:'0',AW_ORIGINS:'http://127.0.0.1:'+port},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();await registerApi(db,server);await waitFor('http://127.0.0.1:'+port+'/api/health',server);
 await writeFile(out+'/session.json',JSON.stringify({pid:process.pid,dsn:db.dsn,work:db.work,port,url:'http://127.0.0.1:'+port,apiPid:server.pid,started:new Date().toISOString(),lock:lock.owner},null,2));console.log('READY http://127.0.0.1:'+port);
 while(true){await new Promise(r=>setTimeout(r,1000));try{await readFile(out+'/stop-host');break;}catch{}}
}finally{await cleanup();}
