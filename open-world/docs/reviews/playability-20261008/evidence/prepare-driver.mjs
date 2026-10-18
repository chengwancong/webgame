import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const base=resolve('docs/reviews/playability-20261008');
let source=await readFile('tests/world-natural-calendar.database.test.ts','utf8');
source=source.replaceAll("from '../","from '../../../");
source="import {spawnSync} from 'node:child_process';\nimport {pgCommand} from '../../../tools/runtime.mjs';\n"+source;
source=source.replace("const results:any[]=[];", "const results:any[]=[];const checkpoints=new Set<number>();");
source=source.replace("const initial=structuredClone(s);", "await writeFile('docs/reviews/playability-20261008/evidence/driver-account.json',JSON.stringify({schema,username:JSON.parse(String(login.payload)).account?.username??JSON.parse(String(login.payload)).username,login:login.json(),character:s.id},null,2));const initial=structuredClone(s);");
// Capture complete database checkpoints, preserving account, reward, receipts and ledger.
source=source.replace("consideredGear=new Set(s.gear.map(g=>g.id));gearEvaluationLevel=s.level;", "consideredGear=new Set(s.gear.map(g=>g.id));gearEvaluationLevel=s.level;");
source=source.replace("  async function fight(","  async function fight(");
source=source.replace("if(s.rewards.length||s.level!==oldLevel)await grow();stalled=", "if(s.rewards.length||s.level!==oldLevel)await grow();for(const target of [8,30,50])if(s.level>=target&&!checkpoints.has(target)){checkpoints.add(target);const file='docs/reviews/playability-20261008/evidence/checkpoint-'+target;await writeFile(file+'.json',JSON.stringify({schema,character:s.id,level:s.level,minutes:(clock-began)/60000,state:s},null,2));const dump=spawnSync(pgCommand('pg_dump'),['--dbname',dsn!,'--format=custom','--file',file+'.dump'],{windowsHide:true,encoding:'utf8'});if(dump.status!==0)throw Error(dump.stderr);console.log('CHECKPOINT '+target);}stalled=");
source=source.replace("await owner.query('DROP SCHEMA '+schema+' CASCADE');", "await writeFile('docs/reviews/playability-20261008/evidence/driver-schema.json',JSON.stringify({schema},null,2));");
source=source.replace("'docs/reviews/open-world-m2-m4/W10'", "'docs/reviews/playability-20261008/evidence'");
source=source.replace("'docs/reviews/open-world-m2-m4/W10/natural-calendar'", "'docs/reviews/playability-20261008/evidence/natural-calendar'");
// Only one earned-only route; no numerical grid or controlled loadout.
source=source.replace("['no-quests','attempt-all-tasks']", "['no-quests']");
await writeFile(base+'/natural-sample.test.ts',source);
