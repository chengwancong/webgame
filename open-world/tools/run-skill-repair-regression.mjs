import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {startDatabase,root} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';
const report={ok:false,started:new Date().toISOString(),sourceBefore:await sourceVersion(),database:'independent temporary PostgreSQL',fileParallelism:false};
let database;
try{
 database=await startDatabase({temporary:true});
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--fileParallelism=false','--testTimeout=30000','--hookTimeout=60000','--reporter=default','--reporter=json','--outputFile=docs/skill-repair-20261003/vitest.json'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});
 report.exitCode=await new Promise(resolve=>child.once('exit',resolve));report.ok=report.exitCode===0;
}catch(error){report.error=String(error);}
finally{if(database)report.cleanup=await database.stop();report.sourceAfter=await sourceVersion();report.sourceStable=report.sourceBefore.sha256===report.sourceAfter.sha256;await writeFile('docs/skill-repair-20261003/regression.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.ok)process.exitCode=1;}
