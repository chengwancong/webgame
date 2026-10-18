// Serial real-PostgreSQL checks; optional file arguments replace the default suite.
import {spawn} from 'node:child_process';
import {startDatabase,root} from './runtime.mjs';
const database=await startDatabase({temporary:true});
try{
 const files=process.argv.slice(2);if(!files.length)files.push('tests/starsea-respawn.database.test.ts');
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','--maxWorkers=1',...files],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});
 const code=await new Promise(resolve=>child.once('exit',resolve));if(code!==0)process.exitCode=Number(code)||1;
}finally{await database.stop();}
