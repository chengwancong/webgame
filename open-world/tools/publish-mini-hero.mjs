// Rebuild with the existing scheduled-task service stopped, then restore it even on failure.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './runtime.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const evidence=join(root,'../docs/reviews/open-world/mini-hero-integration-20261002');await mkdir(evidence,{recursive:true});
const report={passed:false,started:new Date().toISOString()};
const before=await persistenceSnapshot();let stopped=false,failure;
async function run(command,args){
 const task=spawn(command,args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 task.stdout.on('data',bytes=>output+=bytes);task.stderr.on('data',bytes=>output+=bytes);
 const code=await new Promise((resolve,reject)=>{task.once('error',reject);task.once('exit',resolve);});
 return {code,output};
}
try{
 const stop=await run(process.execPath,['tools/local-service.mjs','stop']);assertSuccess(stop,'Stop');stopped=true;
 console.log('Scheduled-task service stopped; building the release.');
 const build=process.platform==='win32'?await run('cmd.exe',['/d','/s','/c','pnpm build']):await run('pnpm',['build']);
 await writeFile(join(evidence,'release-build.log'),build.output);report.buildExitCode=build.code;assertSuccess(build,'Build');
}catch(error){failure=error;report.error=String(error);}
finally{
 if(stopped){const start=await run(process.execPath,['tools/local-service.mjs','start']);report.serviceRestored=start.code===0;await writeFile(join(evidence,'release-service.log'),start.output);if(start.code!==0){report.restoreError=start.output;failure??=Error('Service did not restore');}}
}
try{
 if(failure)throw failure;
 const health=await(await fetch('http://127.0.0.1:8612/api/health')).json(),content=await(await fetch('http://127.0.0.1:8612/api/content')).json();
 if(JSON.stringify(health.versions)!==JSON.stringify(content.versions))throw Error('Actual health/content versions differ');
 report.versions=health.versions;
 const after=await persistenceSnapshot();report.persistence={before:persistenceSummary(before),after:persistenceSummary(after),...verifyPersistence(before,after)};
 report.passed=true;console.log(JSON.stringify({passed:true,versions:report.versions,serviceRestored:report.serviceRestored,persistentDataPreserved:true}));
}catch(error){report.error=String(error);console.error(error);process.exitCode=1;}
finally{report.finished=new Date().toISOString();await writeFile(join(evidence,'release-service.json'),JSON.stringify(report,null,2));}
function assertSuccess(result,name){if(result.code!==0)throw Error(name+' failed: '+result.output.slice(-5000));}
