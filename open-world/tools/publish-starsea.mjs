import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const folder=join(root,'assets/starsea/integration/evidence');await mkdir(folder,{recursive:true});
const report={ok:false,startedAt:new Date().toISOString(),build:false,restored:false};
async function run(args,timeout=180000){const log=await open(join(folder,'publish.log'),'a');const p=spawn(process.execPath,args,{cwd:root,stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;p.kill('SIGTERM');},timeout);const code=await new Promise(r=>p.once('exit',r));clearTimeout(timer);if(code!==0||timedOut)throw Error('Command '+args.join(' ')+' failed '+(timedOut?'deadline':code));}
let before;
try{
 before=await persistenceSnapshot();report.before=persistenceSummary(before);await writeFile(join(folder,'pre-publish-snapshot.json'),JSON.stringify(before));
 await run(['tools/local-service.mjs','stop'],60000);
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 for(const command of pkg.scripts.build.split(' && ')){const parts=command.split(' ');if(parts[0]==='node')await run(parts.slice(1));else if(parts[0]==='vite')await run(['node_modules/vite/bin/vite.js',...parts.slice(1)]);else if(parts[0]==='python3'){const log=await open(join(folder,'publish.log'),'a');const p=spawn('python3',parts.slice(1),{cwd:root,stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();let timeout=false;const timer=setTimeout(()=>{timeout=true;p.kill('SIGTERM');},180000);const code=await new Promise(r=>p.once('exit',r));clearTimeout(timer);if(code!==0||timeout)throw Error(command+' failed');}else throw Error('Unknown build command '+parts[0]);}
 report.build=true;report.source=await sourceVersion();
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{
 try{await run(['tools/local-service.mjs','start'],60000);report.restored=true;const health=await(await fetch('http://127.0.0.1:8612/api/health',{signal:AbortSignal.timeout(5000)})).json(),content=await(await fetch('http://127.0.0.1:8612/api/content',{signal:AbortSignal.timeout(5000)})).json();report.health=health;report.contentVersions=content.versions;const after=await persistenceSnapshot();report.after=persistenceSummary(after);if(before)report.persistence=verifyPersistence(before,after);report.ok=report.build&&!report.error;}
 catch(e){report.restoreError=e.stack;process.exitCode=1;}
 report.completedAt=new Date().toISOString();await writeFile(join(folder,'publish.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,build:report.build,restored:report.restored,versions:report.health?.versions,error:report.error,restoreError:report.restoreError}));
}
