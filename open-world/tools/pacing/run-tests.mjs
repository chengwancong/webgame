import {spawn} from 'node:child_process';
import {open,writeFile,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startDatabase,root} from '../runtime.mjs';
const args=process.argv.slice(2),out=resolve(args[0]??'.qa/pacing/tests'),all=args.includes('--all'),calendar=args.find(a=>a.startsWith('--calendar='))?.slice(11),files=args.slice(1).filter(a=>!a.startsWith('--'));
await mkdir(out,{recursive:true});const db=await startDatabase({temporary:true,reap:false});
if(db.port===8612)throw Error('拒绝使用8612');
async function run(file,selected,strategy){
 const log=await open(resolve(out,file),'w'),child=spawn(process.execPath,[resolve(root,'node_modules/vitest/vitest.mjs'),'run','--maxWorkers=1','--no-file-parallelism',...selected],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn,AW_CALENDAR_STRATEGY:strategy,AW_EARNED_CALENDAR_IN:calendar?resolve(root,calendar):process.env.AW_EARNED_CALENDAR_IN,AW_CALENDAR_OUT:resolve(out,'natural'),AW_REVIEW_ROOT:resolve(out,'world-reviews')},stdio:['ignore',log.fd,log.fd],windowsHide:true});await log.close();return Number(await new Promise((res,rej)=>{child.once('error',rej);child.once('exit',res);}));
}
try{
 await writeFile(resolve(out,'environment.json'),JSON.stringify({temporary:true,port:db.port,work:db.work,maxWorkers:1,fileParallelism:false,calendar:calendar??null,strategies:all?['no-quests','attempt-all-tasks']:['no-quests']},null,2)+'\n');
 const full=await run('tests.log',all?[]:files.length?files:['tests/pacing-lab.database.test.ts','tests/pacing-targets.test.ts','tests/pacing-ablation.test.ts','tests/pacing-refine.test.ts'],'no-quests');
 // 沿用一期P5：两种自然策略分进程，保留各自原600秒时限。
 const tasks=all?await run('task-calendar.log',['tests/world-natural-calendar.database.test.ts'],'attempt-all-tasks'):0;
 if(all){const log=await open(resolve(out,'tests.log'),'a');await log.write('\n第二个独立自然策略（原600秒时限）\n'+await readFile(resolve(out,'task-calendar.log'),'utf8'));await log.close();}
 await writeFile(resolve(out,'test-result.json'),JSON.stringify({passed:full===0&&tasks===0,fullExitCode:full,taskCalendarExitCode:tasks,all,maxWorkers:1},null,2)+'\n');process.exitCode=full||tasks;
}finally{await writeFile(resolve(out,'cleanup.json'),JSON.stringify(await db.stop(),null,2)+'\n');}
