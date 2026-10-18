import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const evidence=process.env.AW_VERIFY_EVIDENCE??join(root,'../docs/reviews/open-world/deep-progression-20261001');
await mkdir(evidence,{recursive:true});
const report={ok:false,started:new Date().toISOString(),checks:[]};let db;
async function run(args,env={}){const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',windowsHide:true});const code=await new Promise(r=>child.once('exit',r));report.checks.push({command:args.join(' '),exitCode:code});if(code!==0)throw Error('Verification failed: '+args.join(' '));}
try{
 await run(['node_modules/typescript/bin/tsc','--noEmit']);
 await run(['node_modules/tsx/dist/cli.mjs','tools/validate-content.ts']);
 db=await startDatabase({temporary:true});
 const selected=process.argv.slice(2);
 await run(['node_modules/vitest/vitest.mjs','run',...selected],{AW_DATABASE_URL:db.dsn});
 report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{if(db)report.cleanup=await db.stop();await writeFile(join(evidence,'engineering-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
