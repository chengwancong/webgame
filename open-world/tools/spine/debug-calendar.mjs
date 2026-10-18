/** 用原自然日程逐字断言，仅在临时副本启用既有logger选项；数据库与副本均在finally清理。 */
import {readFile,writeFile,mkdir,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {startDatabase,root} from '../runtime.mjs';
const output=resolve(root,process.argv[2]??'docs/reviews/numeric-spine-20261013/S6/repaired-timeline/natural/seed-41'),seed=process.argv[3]??'41',fixture=resolve(root,'tests/numeric-spine-debug-natural-calendar.database.test.ts');
const source=await readFile(resolve(root,'tests/world-natural-calendar.database.test.ts'),'utf8'),needle='createApp(pool,{testLogin:true})';if(!source.includes(needle))throw Error('原自然日程夹具入口变化');await writeFile(fixture,source.replace(needle,'createApp(pool,{testLogin:true,logger:true})'),{flag:'wx'});await mkdir(output,{recursive:true});let db;
try{db=await startDatabase({temporary:true,reap:false});const log=await open(resolve(output,'calendar.log'),'w');const child=spawn(process.execPath,[resolve(root,'node_modules/vitest/vitest.mjs'),'run','tests/numeric-spine-debug-natural-calendar.database.test.ts','--maxWorkers=1','--no-file-parallelism'],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn,AW_CALENDAR_SEED:seed,AW_CALENDAR_STRATEGY:'no-quests',AW_CALENDAR_OUT:output},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();process.exitCode=Number(await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);}));}
finally{if(db)await writeFile(resolve(output,'cleanup.json'),JSON.stringify(await db.stop(),null,2));await unlink(fixture);}
