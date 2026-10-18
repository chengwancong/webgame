import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {openSync,closeSync,writeSync,existsSync} from 'node:fs';
import {mkdir,readFile,writeFile,unlink,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {root,startDatabase,child,stopChild,registerApi} from './runtime.mjs';
import {recoverDevelopmentPid} from './dev-recovery.mjs';
import {apiSourceSignature,ApiSourceGuard,validateApiSource} from './api-source-guard.mjs';
import {rotateServiceLog} from './service-log-rotation.mjs';

const folder=join(root,'.runtime/service'),lock=join(folder,'runner.lock'),stateFile=join(folder,'state.json');
await mkdir(folder,{recursive:true});
const alive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
try{const handle=await (await import('node:fs/promises')).open(lock,'wx');await handle.writeFile(String(process.pid));await handle.close();}
catch(e){
 if(e.code!=='EEXIST')throw e;
 const pid=Number(await readFile(lock,'utf8'));if(!Number.isInteger(pid)||alive(pid))process.exit(0);
 await unlink(lock);const handle=await (await import('node:fs/promises')).open(lock,'wx');await handle.writeFile(String(process.pid));await handle.close();
}
const config=JSON.parse(await readFile(join(folder,'config.json'),'utf8'));
Object.assign(process.env,config.env);
const stdout=openSync(join(folder,'stdout.log'),'a'),stderr=openSync(join(folder,'stderr.log'),'a');
const log=text=>writeSync(stdout,new Date().toISOString()+' '+text+'\n');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const status={pid:process.pid,phase:'starting',restarts:0,started:new Date().toISOString(),components:{}};
const token=randomUUID();let stopping=false,restartRequested=false,api,web,preview,database,shutdownError;
const previewScript=join(root,'../experiments/apk-motion-preview/server.mjs');
const control=createServer(async(req,res)=>{
 if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type','application/json');
 if(req.method==='POST'&&req.url==='/stop'){stopping=true;status.phase='stopping';}
 else if(req.method==='POST'&&req.url==='/restart'){restartRequested=true;status.phase='restarting';}
 else if(req.method!=='GET'||req.url!=='/status'){res.writeHead(404);res.end();return;}
 res.end(JSON.stringify(status));
});
await new Promise((resolve,reject)=>{control.once('error',reject);control.listen(0,'127.0.0.1',resolve);});
await writeFile(stateFile+'.tmp',JSON.stringify({root,pid:process.pid,port:control.address().port,token}));await rename(stateFile+'.tmp',stateFile);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
const exited=p=>!p||p.exitCode!==null||p.signalCode!==null;
async function healthy(){
 const results=await Promise.all(['http://127.0.0.1:8612/','http://127.0.0.1:8612/api/health'].map(async url=>{try{return (await fetch(url,{signal:AbortSignal.timeout(2000)})).ok;}catch{return false;}}));
 return results.every(Boolean);
}
async function ready(){
 for(let n=0;n<100;n++){
  if(stopping||restartRequested)throw Error('Startup interrupted');
  if(exited(api)||exited(web))throw Error('Component exited during startup');
  if(await healthy())return;
  await delay(200);
 }
 throw Error('HTTP readiness timeout');
}
async function cleanup(){
 await stopChild(preview);await stopChild(web);await stopChild(api);preview=web=api=undefined;
 if(database){log('Database shutdown: '+JSON.stringify(await database.stop()));database=undefined;}
 status.components={};
}
async function startPreview(){
 if(process.env.AW_APK_PREVIEW==='0'||!existsSync(previewScript)||!existsSync(join(root,'../../source-assets/zjcs-apk/index.html')))return;
 try{
  for(const port of [8624,8625])await new Promise((resolve,reject)=>{const s=createNetServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
  preview=child(process.execPath,[previewScript],{},{stdio:['ignore',stdout,stderr]});await registerApi(database,preview,'preview');status.components.preview=preview.pid;
 }catch(e){status.previewError=e.message;log('Optional preview: '+e.message);}
}
const rotation=setInterval(()=>{
 for(const name of ['stdout.log','stderr.log'])try{
  rotateServiceLog(join(folder,name));
 }catch(e){log('Log rotation: '+e.message);}
},60000);
try{
 while(!stopping){
  restartRequested=false;status.phase='starting';
  try{
   await recoverDevelopmentPid();
   // Refuse foreign listeners before creating or modifying a database.
   for(const port of [8611,8612])await new Promise((resolve,reject)=>{const s=createNetServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});
   database=await startDatabase();
   const sourceGuard=new ApiSourceGuard(await apiSourceSignature(root));
   api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_TEST_LOGIN:process.env.AW_TEST_LOGIN??'1'},{stdio:['ignore',stdout,stderr,'ipc']});
   await registerApi(database,api);
   web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{},{stdio:['ignore',stdout,stderr]});
   await registerApi(database,web,'web');
   status.components={api:api.pid,web:web.pid};await ready();await startPreview();status.phase='running';status.lastError=null;log('Game ready: http://127.0.0.1:8612/');
   let failures=0,rejectedSource;
   while(!stopping&&!restartRequested&&!exited(api)&&!exited(web)){
    await delay(1000);if(stopping||restartRequested)break;
    failures=await healthy()?0:failures+1;if(failures>=3)throw Error('HTTP health checks failed');
    const candidate=await apiSourceSignature(root);
    if(sourceGuard.changed(candidate)&&candidate!==rejectedSource){
     const validation=await validateApiSource(root);
     if(candidate!==await apiSourceSignature(root)){log('API source changed during validation; waiting for a stable batch.');continue;}
     if(!validation.ok){rejectedSource=candidate;status.pendingSourceError=validation.diagnostics;log('Invalid pending API source; retaining current healthy service. '+validation.diagnostics);continue;}
     delete status.pendingSourceError;restartRequested=true;status.phase='restarting';log('Validated API dependencies changed; reloading API and frontend together.');
    }
   }
   if(!stopping&&!restartRequested)throw Error('API or web process exited');
  }catch(e){status.lastError=e.message;log('Restart reason: '+e.message);}
  await cleanup();
  if(!stopping){status.restarts++;status.phase='restarting';if(!restartRequested)for(let n=0;n<100&&!stopping;n++)await delay(100);}
 }
}catch(e){shutdownError=e;writeSync(stderr,String(e.stack)+'\n');}
finally{
 try{await cleanup();}catch(e){shutdownError=e;writeSync(stderr,String(e.stack)+'\n');}
 clearInterval(rotation);await new Promise(r=>control.close(r));
 await unlink(stateFile).catch(()=>{});await unlink(lock).catch(()=>{});closeSync(stdout);closeSync(stderr);
}
if(shutdownError)process.exitCode=1;
