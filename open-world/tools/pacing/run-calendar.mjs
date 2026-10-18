import {spawn} from 'node:child_process';
import {mkdir,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startDatabase,root} from '../runtime.mjs';
export async function runPacingCalendar(output,seed=41){
 const out=resolve(output);await mkdir(out,{recursive:true});
 const db=await startDatabase({temporary:true,reap:false});
 try{
  const log=await open(resolve(out,'calendar.log'),'w');
  const p=spawn(process.execPath,[resolve(root,'node_modules/vitest/vitest.mjs'),'run','tests/world-natural-calendar.database.test.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn,AW_CALENDAR_SEED:String(seed),AW_CALENDAR_STRATEGY:'no-quests',AW_CALENDAR_OUT:out},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();
  const code=await new Promise((res,rej)=>{p.once('error',rej);p.once('exit',res);});
  if(code!==0)throw Error('Natural calendar failed; see '+resolve(out,'calendar.log'));
 }finally{await writeFile(resolve(out,'cleanup.json'),JSON.stringify(await db.stop(),null,2));}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await runPacingCalendar(process.argv[2]??'docs/reviews/pacing-tool-20261010/P0');
