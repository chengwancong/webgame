import {startDatabase,child,stopChild} from './runtime.mjs';
const db=await startDatabase({temporary:true});let proc;
try{proc=child(process.execPath,['node_modules/vitest/vitest.mjs','run',...(process.argv.slice(2).length?process.argv.slice(2):['tests/weapon-story-flow.test.ts','tests/weapon-story.database.test.ts'])],{AW_DATABASE_URL:db.dsn});const code=await new Promise(r=>proc.once('exit',r));if(code)process.exitCode=code;}finally{await stopChild(proc);console.log(JSON.stringify({cleanup:await db.stop()}));}
