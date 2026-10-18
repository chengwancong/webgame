import {spawn} from 'node:child_process';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';
import {root} from './runtime.mjs';import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const label=process.argv[2]??'dungeon-lifecycle',out=resolve(root,'../docs/reviews/open-world/'+label+'-release');await mkdir(out,{recursive:true});
const report={ok:false,started:new Date().toISOString(),checks:[]},before=await persistenceSnapshot();let stopped=false;
async function run(command,args){const process=spawn(command,args,{cwd:root,stdio:'inherit',windowsHide:true});const code=await new Promise((r,j)=>{process.once('exit',r);process.once('error',j);});if(code!==0)throw Error('Release command failed: '+args.join(' '));report.checks.push(args.join(' '));}
try{
 await run(process.execPath,['tools/fingerprint-ui-source.mjs',label+'-before']);await run(process.execPath,['tools/local-service.mjs','stop']);stopped=true;
 await run(process.execPath,['tools/build-ui-tokens.mjs']);await run('python3',['-X','utf8','tools/build_ui_v2.py']);
 for(const file of ['build-travel-assets','wardrobe-build','build-mini-hero','build-skill-fx','build-vfx-v2','build-apk-accepted-ui','build-telegraph-reuse'])await run(process.execPath,['tools/'+file+'.mjs']);
 await run(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts']);
 await run(process.execPath,['tools/fingerprint-ui-source.mjs',label+'-after']);
 const a=JSON.parse(await readFile(resolve(root,'../.design/global-ui-system/release-source-'+label+'-before.json'),'utf8')),b=JSON.parse(await readFile(resolve(root,'../.design/global-ui-system/release-source-'+label+'-after.json'),'utf8'));if(a.sha256!==b.sha256)throw Error('Source changed during release build; validate and rebuild');report.source=b;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{if(stopped){try{await run(process.execPath,['tools/local-service.mjs','start']);const after=await persistenceSnapshot();report.persistence={before:persistenceSummary(before),after:persistenceSummary(after),verification:verifyPersistence(before,after)};report.ok=!report.error;}catch(error){report.error=String(error.stack??error);process.exitCode=1;}}await writeFile(resolve(out,'build-and-persistence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
