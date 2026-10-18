import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {root} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';
const batch=process.argv[2];if(!/^W(?:[0-9]|10|11)$/.test(batch??''))throw Error('Expected W0–W11');
const folder=join(root,'docs/reviews/open-world-m2-m4',batch);await mkdir(folder,{recursive:true});
const report={batch,startedAt:new Date().toISOString(),passed:false,build:false,restored:false};
async function run(executable,args){
 const log=await open(join(folder,'build.log'),'a');
 try{const child=spawn(executable,args,{cwd:root,stdio:['ignore',log.fd,log.fd],windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});if(code!==0)throw Error('Build step failed '+args.join(' ')+' exit '+code);
 }finally{await log.close();}
}
try{
 await run(process.execPath,['tools/world-publication-save-audit.mjs',batch,'before']);
 await run(process.execPath,['tools/local-service.mjs','stop']);
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 for(const command of pkg.scripts.build.split(' && ')){
  const [tool,...args]=command.split(' ');
  if(tool==='node')await run(process.execPath,args);
  else if(tool==='tsx')await run(process.execPath,['node_modules/tsx/dist/cli.mjs',...args]);
  else if(tool==='vite')await run(process.execPath,['node_modules/vite/bin/vite.js',...args]);
  else if(tool==='python3')await run(process.env.AW_PYTHON??'python3',args);
  else throw Error('Unsupported declared build executable '+tool);
 }
 report.build=true;report.source=await sourceVersion();
}catch(error){report.error=String(error);}
finally{
 try{
  await run(process.execPath,['tools/local-service.mjs','start']);report.restored=true;
  for(let n=0;n<120;n++){
   try{const health=await(await fetch('http://127.0.0.1:8612/api/health',{signal:AbortSignal.timeout(2000)})).json();if(health.ok){report.health=health;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!report.health)throw Error('Restored service did not become healthy');
  report.contentVersions=(await(await fetch('http://127.0.0.1:8612/api/content',{signal:AbortSignal.timeout(5000)})).json()).versions;
  await run(process.execPath,['tools/world-publication-save-audit.mjs',batch,'after']);
  report.passed=report.build&&!report.error&&JSON.stringify(report.health.versions)===JSON.stringify(report.contentVersions);
 }catch(error){report.restoreError=String(error);}
 report.endedAt=new Date().toISOString();await writeFile(join(folder,'publication.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}
