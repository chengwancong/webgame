import {resolve,sep} from 'node:path';
import {startDatabase,child,stopChild,waitFor,registerApi,root} from './runtime.mjs';
const database=await startDatabase({temporary:true});let api,closing;
async function close(){return closing??=(async()=>{await stopChild(api);const work=resolve(database.work),base=resolve(root,'.qa')+sep;if(!work.startsWith(base))throw Error('Temporary database escaped QA workspace');console.log('Temporary database cleanup:',await database.stop());})();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void close());
try{
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_API_PORT:'8616',AW_ORIGINS:'http://localhost:8616',AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});
 await registerApi(database,api);await waitFor('http://127.0.0.1:8616/api/health',api);
 console.log('Isolated built release login QA: http://localhost:8616/');
 await new Promise(r=>api.once('exit',r));
}finally{await close();}
