import {spawn} from 'node:child_process';
import {mkdir,open,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,startDatabase,stopChild} from './runtime.mjs';
const batch=process.argv[2];if(!/^W(?:[0-9]|10|11)$/.test(batch??''))throw Error('Expected W0–W11');
const out=join(root,'docs/reviews/open-world-m2-m4',batch);await mkdir(out,{recursive:true});
let database,child;const result={batch,startedAt:new Date().toISOString(),passed:false};
try{database=await startDatabase({temporary:true});const log=await open(join(out,'regression.log'),'w');try{child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--no-file-parallelism','--maxWorkers=1'],{cwd:root,env:{...process.env,AW_PYTHON:process.env.AW_PYTHON??'C:/Users/ccc/AppData/Local/Programs/Python/Python311/python.exe',AW_DATABASE_URL:database.dsn},stdio:['ignore',log.fd,log.fd],windowsHide:true});result.exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});result.passed=result.exitCode===0;}finally{await log.close();}}
catch(error){result.error=String(error);}finally{await stopChild(child);if(database)result.cleanup=await database.stop();result.endedAt=new Date().toISOString();await writeFile(join(out,'regression.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;}
