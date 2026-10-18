import {spawn} from 'node:child_process';
import {open,mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';
const args=process.argv.slice(2),outputFlag=args.indexOf('--evidence-dir'),outputDir=outputFlag<0?'.design/open-world-m0':args.splice(outputFlag,2)[1];
const out=resolve(root,outputDir);await mkdir(out,{recursive:true});
const report={passed:false,started:new Date().toISOString(),source:await sourceVersion(),files:args,strategy:'Vitest files sequentially, maxWorkers=1, isolated real PostgreSQL for database suites; existing unit-test adapters retained'};
let database;
try{
 database=await startDatabase({temporary:true});const log=await open(resolve(out,'tests.log'),'w');
 const test=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...args,'--maxWorkers','1'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();
 report.exitCode=await new Promise((done,reject)=>{test.once('exit',done);test.once('error',reject);});report.passed=report.exitCode===0;
 report.sourceAfter=await sourceVersion();report.sourceStable=report.source.sha256===report.sourceAfter.sha256;report.passed&&=report.sourceStable;
}catch(error){report.error=error.stack;}finally{if(database)report.cleanup=await database.stop();report.completed=new Date().toISOString();await writeFile(resolve(out,'tests.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));const output=await readFile(resolve(out,'tests.log'),'utf8').catch(()=>report.error??'');console.log(output.slice(-14000));if(!report.passed)process.exitCode=1;
