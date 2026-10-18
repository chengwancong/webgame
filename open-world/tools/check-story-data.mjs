import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const out=resolve(root,'../docs/reviews/open-world/story-campaign-20261003');await mkdir(out,{recursive:true});const database=await startDatabase({temporary:true}),report={ok:false};
const all=process.argv.includes('--all');
try{const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...(all?[]:['tests/story.database.test.ts']),'--no-file-parallelism','--testTimeout=30000'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});const code=await new Promise(r=>child.once('exit',r));if(code!==0)throw Error('Story database checks failed: '+code);report.ok=true;}
catch(error){report.error=String(error);process.exitCode=1;}
finally{if(!resolve(database.work).startsWith(resolve(root,'.qa')+sep))throw Error('QA cleanup escaped workspace');report.cleanup=await database.stop();await writeFile(resolve(out,all?'all-tests-result.json':'database-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
