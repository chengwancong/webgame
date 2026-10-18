import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const out=resolve(root,'../docs/reviews/open-world/task-panel-20261001');await mkdir(out,{recursive:true});
const report={ok:false},database=await startDatabase({temporary:true});
try{
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/tasks.database.test.ts','tests/database.test.ts','tests/objective.test.ts','--no-file-parallelism'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});
 const code=await new Promise(resolve=>child.once('exit',resolve));if(code!==0)throw Error('Task database verification failed: '+code);report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{report.cleanup=await database.stop();await writeFile(resolve(out,'data-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
