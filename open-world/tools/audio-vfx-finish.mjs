import {spawn} from 'node:child_process';import {readFile,writeFile,open,copyFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const initial=JSON.parse(await readFile('docs/skill-audio-vfx-regression.json','utf8')),files=[...new Set([...initial.results.filter(r=>r.code!==0).map(r=>r.file),'tests/combat-audio.test.ts'])],repairs=[];
async function run(name,args){const log=await open('.runtime/audio-vfx-finish-'+name+'.log','w');try{const child=spawn(process.execPath,args,{stdio:['ignore',log.fd,log.fd],windowsHide:true});return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}finally{await log.close();}}
// Only failed and subsequently affected files are repeated, never the full suite.
const preserved=JSON.parse(await readFile('.runtime/audio-vfx-existing-evidence.json','utf8'));
for(const file of files){const code=await run(file.replaceAll(/[\\/]/g,'_'),['node_modules/vitest/vitest.mjs','run',file,'--maxWorkers=1','--testTimeout=30000']);repairs.push({file,code});if(file.replaceAll('\\','/').endsWith('/world-island-quest-config.test.ts')){const row=preserved.find(r=>r.file.endsWith('/config-deliberate-breaks.json'));if(row)row.generatedSha=hash(await readFile(row.file));}console.log(JSON.stringify({repair:file,code}));}
const compile=await run('compile',['node_modules/typescript/bin/tsc','--noEmit']);console.log(JSON.stringify({compile}));
const build=compile===0?await run('gallery-build',['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',resolve('.runtime/audio-vfx-gallery-build')]):null;console.log(JSON.stringify({build}));
for(const {file,backup,generatedSha}of preserved)if(hash(await readFile(file))===generatedSha)await copyFile(backup,file);
const results=initial.results.map(row=>{const repair=repairs.find(r=>r.file.replaceAll('\\','/')===row.file.replaceAll('\\','/'));return repair?{...row,repairCode:repair.code}:row;}),passed=results.every(r=>(r.repairCode??r.code)===0)&&compile===0&&build===0;
await writeFile('docs/skill-audio-vfx-regression.json',JSON.stringify({...initial,results,repairs,compile,build,passed,scope:'Z full suite once, then only failed/affected single-file checks; no headless browser; QA build isolated in .runtime; existing evidence retained'},null,2)+'\n');if(!passed)process.exitCode=1;
