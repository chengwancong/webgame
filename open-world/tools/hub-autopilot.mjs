import {spawnSync} from 'node:child_process';
import {resolve,relative,isAbsolute} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const args=process.argv.slice(2);
if(args.some(x=>!['all','sword','staff','hidden','--preflight','--pre-switch'].includes(x)&&!/^--seed=[1-9][0-9]*$/.test(x)&&!/^--plan-hash=[a-f0-9]{64}$/.test(x)))throw Error('Usage: node tools/hub-autopilot.mjs [all|sword|staff|hidden] [--preflight]');
const db=await startDatabase({temporary:true,reap:false});
const rel=relative(resolve(root,'.qa'),resolve(db.work));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Temporary database escaped workspace');
try{const p=spawnSync(process.execPath,['--import','tsx','tools/hub-autopilot.ts',...args],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn},stdio:'inherit',windowsHide:true});process.exitCode=p.status??1;}finally{await db.stop();}
