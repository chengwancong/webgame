import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const out=resolve(root,process.env.AW_EQUIPMENT_QA_OUT??'../docs/reviews/open-world/equipment-runtime-20261004');await mkdir(out,{recursive:true});
const report={ok:false,scope:'isolated real PostgreSQL; equipment and requested regression suites',requested:process.argv.slice(2),startedAt:new Date().toISOString()};
let database;
try{
 database=await startDatabase({temporary:true});
 if(dirname(resolve(database.work))!==resolve(root,'.qa')||!basename(database.work).startsWith('run-'))throw Error('Unexpected temporary database cleanup target');
 const args=['node_modules/vitest/vitest.mjs','run','--no-file-parallelism','--testTimeout=15000',...process.argv.slice(2)];
 const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});
 const code=await new Promise(resolve=>child.once('exit',resolve));report.exitCode=code;report.ok=code===0;
}catch(error){report.error=String(error);}
finally{if(database){if(dirname(resolve(database.work))!==resolve(root,'.qa')||!basename(database.work).startsWith('run-'))throw Error('Unsafe database cleanup target');report.cleanup=await database.stop();}report.completedAt=new Date().toISOString();await writeFile(resolve(out,'tests.json'),JSON.stringify(report,null,2)+'\n');}
if(!report.ok)process.exitCode=1;
