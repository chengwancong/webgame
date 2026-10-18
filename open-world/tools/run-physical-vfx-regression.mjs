// One full regression against a new disposable PostgreSQL; no HTTP service or browser.
import {startDatabase,root} from './runtime.mjs';
import {spawn} from 'node:child_process';
import {open,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const out=resolve(root,'docs/reviews/physical-vfx-20261011/metrics','regression-'+runId);await mkdir(out,{recursive:true});
const report={started:new Date().toISOString(),productionAccess:false};let db;
try{
 db=await startDatabase({temporary:true});report.database={temporary:true,port:db.port};
 const log=await open(resolve(out,'p6-regression.log'),'w');
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--no-file-parallelism','--maxWorkers=2','--reporter=default','--reporter=json','--outputFile='+resolve(out,'p6-regression.json')],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn,AW_REVIEW_ROOT:resolve(out,'regression-evidence'),AW_CALENDAR_OUT:resolve(out,'regression-evidence/calendar')},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();
 console.log('Full regression started against temporary PostgreSQL on '+db.port);
 report.exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
}catch(error){report.error=String(error);report.exitCode=1;}finally{if(db)report.cleanup=await db.stop();report.finished=new Date().toISOString();await writeFile(resolve(out,'p6-regression-run.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
process.exitCode=report.exitCode??1;
