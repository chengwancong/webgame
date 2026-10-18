import {spawn} from 'node:child_process';
import {open,writeFile,mkdir} from 'node:fs/promises';
const chapter=Number(process.argv[2]);if(!Number.isInteger(chapter)||chapter<1||chapter>6)throw Error('Chapter1–6 required');
const island=['wind','mist','forge','frost','rift','dragon'][chapter-1],out='docs/reviews/open-world-m2-m4/W'+(chapter+3);await mkdir(out,{recursive:true});
const steps=[
 ['types',process.execPath,['node_modules/typescript/bin/tsc','--noEmit']],
 ['config',process.env.AW_PYTHON,['-X','utf8','tools/config-export.py','--check']],
 ['content',process.execPath,['node_modules/tsx/dist/cli.mjs','tools/validate-content.ts']],
 ['resources',process.execPath,['node_modules/tsx/dist/cli.mjs','tools/check-world-resource-wiring.ts','--out='+out+'/resources.json']],
 ['resource-usage',process.execPath,['tools/world-island-resource-usage.mjs',String(chapter)]],
 ['story-budget',process.execPath,['node_modules/tsx/dist/cli.mjs','tools/island-story-level-check.ts',String(chapter)]],
 ['content-ids',process.execPath,['tools/world-content-id-scan.mjs']],
 ...(process.argv.includes('--skip-walls')?[]:[1,2,3].map(n=>['wall-'+n,process.execPath,['node_modules/tsx/dist/cli.mjs','tools/wall-probe.ts','--dungeon','field-'+island+'-'+n,'--stage',String((chapter-1)*3+n),'--samples','20','--seconds','240','--out',out+'/wall-'+n+'.json']]))
];
const report={chapter,passed:false,steps:[]};for(const [name,command,args]of steps){if(!command)throw Error('AW_PYTHON must identify the real Python runtime');const log=await open(out+'/'+name+'.log','w');let code;try{const child=spawn(command,args,{stdio:['ignore',log.fd,log.fd],windowsHide:true});code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});}finally{await log.close();}report.steps.push({name,code});console.log(name+': '+code);if(code!==0)break;}report.passed=report.steps.length===steps.length&&report.steps.every(s=>s.code===0);await writeFile(out+'/checks.json',JSON.stringify(report,null,2)+'\n');if(!report.passed)process.exitCode=1;
