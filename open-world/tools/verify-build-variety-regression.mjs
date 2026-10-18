import {spawn} from 'node:child_process';
import {mkdir,writeFile,open} from 'node:fs/promises';
import {startDatabase,root} from './runtime.mjs';
const batch=process.argv[2]??'final',out=`docs/reviews/build-variety-${batch}-20261006`;
await mkdir(out,{recursive:true});const db=await startDatabase({temporary:true});
const report={ok:false,batch,checks:[],started:new Date().toISOString()};
try{
 for(const [name,args] of [['regression',['node_modules/vitest/vitest.mjs','run','--maxWorkers=1','--no-file-parallelism']],['types',['node_modules/typescript/bin/tsc','--noEmit']],['content',['node_modules/tsx/dist/cli.mjs','tools/validate-content.ts']]]){
  const log=await open(`${out}/${name}.log`,'w');const p=spawn(process.execPath,args,{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();const code=await new Promise(r=>p.once('exit',r));report.checks.push({name,code,log:`${name}.log`});console.log(`${batch}: ${name} exit ${code}`);if(code!==0)throw Error(`${name} failed; retain and repair all failures`);
 }report.ok=true;
}catch(e){report.error=String(e);process.exitCode=1;}finally{report.cleanup=await db.stop();report.finished=new Date().toISOString();await writeFile(`${out}/regression.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
