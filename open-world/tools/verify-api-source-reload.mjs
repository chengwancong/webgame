// Read-only DB evidence plus a reversible comment edit to verify the real supervisor.
import assert from 'node:assert/strict';
import {readFile,appendFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
import {root} from './runtime.mjs';
const evidence=process.argv[2]?resolve(root,process.argv[2]):join(root,'../docs/reviews/open-world/version-recovery-20261001');
await mkdir(evidence,{recursive:true});
const file=join(root,'apps/api/src/main.ts'),marker='\n// aw-source-reload-probe-'+randomUUID()+'\n';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function status(){
 const config=JSON.parse(await readFile(join(root,'.runtime/service/state.json'),'utf8'));
 return (await fetch(`http://127.0.0.1:${config.port}/status`,{headers:{authorization:`Bearer ${config.token}`},signal:AbortSignal.timeout(2000)})).json();
}
async function readyAfter(pid){
 for(let n=0;n<100;n++){
  try{const s=await status();if(s.phase==='running'&&s.components.api!==pid&&s.components.api){const health=await (await fetch('http://127.0.0.1:8612/api/health')).json();assert.equal(health.ok,true);return {pid:s.components.api,restarts:s.restarts,versions:health.versions};}}catch{}
  await delay(250);
 }
 throw Error('API source reload timed out');
}
const report={date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),startedAt:new Date().toISOString(),passed:false};let appended=false;
try{
 const initial=await status();assert.equal(initial.phase,'running');const before=await persistenceSnapshot();
 await appendFile(file,marker);appended=true;const reloaded=await readyAfter(initial.components.api);
 verifyPersistence(before,await persistenceSnapshot());
 // Remove only our unique comment, retaining any concurrent code changes.
 const current=await readFile(file,'utf8');assert(current.includes(marker));await writeFile(file,current.replace(marker,''));appended=false;
 const restored=await readyAfter(reloaded.pid);verifyPersistence(before,await persistenceSnapshot());
 Object.assign(report,{passed:true,initialApi:initial.components.api,reloaded,restored,database:persistenceSummary(before),persistentDataPreserved:true});
 console.log(JSON.stringify({passed:true,reloaded,restored,persistentDataPreserved:true}));
}catch(e){report.error=e.stack;process.exitCode=1;console.error(e.message);}
finally{
 if(appended){const current=await readFile(file,'utf8');await writeFile(file,current.replace(marker,''));}
 await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2)+'\n');
}
