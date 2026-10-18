import {startDatabase,child,stopChild,root} from './runtime.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const files=process.argv.slice(2).length?process.argv.slice(2):['tests/field-camps.database.test.ts'];
let db,test;const out=resolve(root,'../docs/reviews/open-world/field-camps-20261006');await mkdir(out,{recursive:true});
const report={ok:false,realPostgreSQL:true,files,cleanup:null};
try{db=await startDatabase({temporary:true});test=child(process.execPath,['node_modules/vitest/vitest.mjs','run',...files,'--reporter=default','--reporter=json','--outputFile='+resolve(out,'database-tests.json')],{AW_DATABASE_URL:db.dsn});const code=await new Promise(r=>test.once('exit',r));report.ok=code===0;if(code)process.exitCode=1;}
finally{await stopChild(test);if(db)report.cleanup=await db.stop();await writeFile(resolve(out,'database-result.json'),JSON.stringify(report,null,2));}
