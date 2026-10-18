import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
// Separate database and localhost cookie domain; never takes over a real player lease.
const db=await startDatabase({temporary:true}),port=await freePort();let api,closed=false;
async function close(){if(closed)return;closed=true;await stopChild(api);console.log('VFX live cleanup:',JSON.stringify(await db.stop()));control.close(()=>process.exit());}
const control=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');void close();}else{res.writeHead(404);res.end();}});await new Promise(r=>control.listen(0,'127.0.0.1',r));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void close());
try{api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:'http://localhost:'+port,AW_STATIC_ROOT:resolve('apps/web/dist'),AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor('http://127.0.0.1:'+port+'/api/health',api);console.log(JSON.stringify({url:'http://localhost:'+port+'/',stop:'http://127.0.0.1:'+control.address().port+'/stop',work:db.work}));}catch(e){console.error(e);await close();}
