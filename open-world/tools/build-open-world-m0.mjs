import {spawn} from 'node:child_process';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {root} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const args=process.argv.slice(2),outputFlag=args.indexOf('--evidence-dir');
const folder=resolve(root,outputFlag<0?'.design/open-world-m0':args[outputFlag+1]),qa=resolve(root,'.runtime/open-world-m0-qa');
if(!qa.startsWith(root+sep))throw Error('QA build target is outside the workspace');
await mkdir(folder,{recursive:true});const log=await open(resolve(folder,'build.log'),'w');
const report={passed:false,started:new Date().toISOString(),sourceBefore:await sourceVersion(),qaBuild:qa,steps:[]};let before,stopped=false;
async function run(label,command,args){console.log(JSON.stringify({step:label}));const child=spawn(command,args,{cwd:root,stdio:['ignore',log.fd,log.fd],windowsHide:true});const code=await new Promise((done,reject)=>{child.once('exit',done);child.once('error',reject);});report.steps.push({label,code});if(code!==0)throw Error(label+' exited '+code);}
try{
 before=await persistenceSnapshot();report.persistenceBefore=persistenceSummary(before);
 await run('stop managed service',process.execPath,['tools/local-service.mjs','stop']);stopped=true;
 await run('production build',process.platform==='win32'?'cmd.exe':'pnpm',process.platform==='win32'?['/d','/s','/c','pnpm build']:['build']);
 await run('QA production build',process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',qa]);
 report.built=true;
}catch(error){report.error=error.stack;}finally{
 if(stopped)try{await run('restore managed service',process.execPath,['tools/local-service.mjs','start']);for(let i=0;i<120;i++){try{const response=await fetch('http://127.0.0.1:8612/api/health',{signal:AbortSignal.timeout(1000)});if(response.ok){report.health=await response.json();break;}}catch{}await new Promise(done=>setTimeout(done,500));}if(!report.health?.ok)throw Error('Restored service did not become healthy');if(before){const after=await persistenceSnapshot();report.persistenceAfter=persistenceSummary(after);report.persistence=verifyPersistence(before,after);}}catch(error){report.restoreError=error.stack;}
 await log.close();report.sourceAfter=await sourceVersion();report.completed=new Date().toISOString();report.passed=!!report.built&&!report.error&&!report.restoreError&&!!report.persistence;await writeFile(resolve(folder,'build.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(!report.passed)process.exitCode=1;
