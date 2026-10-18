import {spawn} from 'node:child_process';
import {mkdir,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,startDatabase,stopChild} from './runtime.mjs';
const out=resolve(root,'docs/reviews/field-event-performance-20261011');
await mkdir(out,{recursive:true});let database,child;
const tests=['tests/authoritative-motion.test.ts','tests/field-activity-input.test.ts','tests/field-activity-view.test.ts','tests/field-activity-state.test.ts','tests/field-event-runtime.test.ts','tests/field-activities.database.test.ts'];
const report={ok:false,tests,realPostgreSQL:true};
try{
 database=await startDatabase({temporary:true});const log=await open(resolve(out,'tests.log'),'w');
 try{child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...tests,'--no-file-parallelism','--maxWorkers=1'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn,AW_REVIEW_ROOT:out},stdio:['ignore',log.fd,log.fd],windowsHide:true});report.exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});report.ok=report.exitCode===0;}
 finally{await log.close();}
}catch(error){report.error=String(error);}
finally{await stopChild(child);if(database)report.cleanup=await database.stop();await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;}
