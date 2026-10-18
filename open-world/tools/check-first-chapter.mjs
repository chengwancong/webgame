import {root,startDatabase,child,stopChild} from './runtime.mjs';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
let db,run;const report={ok:false};
try{
 db=await startDatabase({temporary:true});
 run=child(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/first-chapter-combat.test.ts','tests/progression-combat.test.ts','tests/simulation.test.ts','tests/combat-permit.test.ts','tests/combat-collision.test.ts','tests/progression-challenges.test.ts','tests/database.test.ts'],{AW_DATABASE_URL:db.dsn});
 report.exitCode=await new Promise(resolve=>run.once('exit',resolve));report.ok=report.exitCode===0;
 if(!report.ok)process.exitCode=1;
}finally{await stopChild(run);if(db)report.cleanup=await db.stop();await writeFile(join(root,'../docs/reviews/open-world/starter-difficulty-20261001/tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
