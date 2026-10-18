import {spawn} from 'node:child_process';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {access} from 'node:fs/promises';
import {root,startDatabase,stopChild} from './runtime.mjs';
const [batch,label,...tests]=process.argv.slice(2);if(!/^W(?:[0-9]|10|11)$/.test(batch??'')||!label||!tests.length||tests.some(t=>!/^tests\/[\w.-]+\.test\.ts$/.test(t)))throw Error('Expected batch, evidence label and explicit test files');
for(const test of tests)await access(join(root,test));
const folder=join(root,'docs/reviews/open-world-m2-m4',batch);await mkdir(folder,{recursive:true});let database,child;
const report={batch,label,tests,startedAt:new Date().toISOString(),realPostgres:true,passed:false};
try{database=await startDatabase({temporary:true});const log=await open(join(folder,label+'.log'),'w');try{child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...tests,'--no-file-parallelism','--maxWorkers=1'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:['ignore',log.fd,log.fd],windowsHide:true});report.exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});report.passed=report.exitCode===0;}finally{await log.close();}}
catch(error){report.error=String(error);}finally{await stopChild(child);if(database)report.cleanup=await database.stop();report.endedAt=new Date().toISOString();await writeFile(join(folder,label+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;}
