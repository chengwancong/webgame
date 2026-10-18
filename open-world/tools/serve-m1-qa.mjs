import {startDatabase,freePort,child,stopChild,waitFor,registerApi,root} from './runtime.mjs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
// M1 GUI check: QA build (graybox entry) + temporary database; never touches the local service data.
const dist=resolve(root,'.qa/m1-qa-dist');
const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',dist,'--emptyOutDir'],{cwd:root,encoding:'utf8',windowsHide:true});
if(built.status!==0){console.error(built.stderr);process.exit(1);}
const db=await startDatabase({temporary:true}),port=await freePort();let api,closed=false;
async function close(){if(closed)return;closed=true;await stopChild(api);console.log('M1 QA cleanup:',JSON.stringify(await db.stop()));control.close(()=>process.exit());}
const control=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');void close();}else{res.writeHead(404);res.end();}});await new Promise(r=>control.listen(0,'127.0.0.1',r));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void close());
try{api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:'http://localhost:'+port,AW_STATIC_ROOT:dist,AW_TEST_LOGIN:'1',AW_FIELD_QA:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor('http://127.0.0.1:'+port+'/api/health',api);console.log(JSON.stringify({url:'http://localhost:'+port+'/',stop:'http://127.0.0.1:'+control.address().port+'/stop',dsn:db.dsn}));}catch(e){console.error(e);await close();}
