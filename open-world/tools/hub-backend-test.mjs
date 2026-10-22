/** One temporary PostgreSQL cluster, one Vitest worker, no browser. */
import {spawnSync} from 'node:child_process';
import {resolve,relative,isAbsolute} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
const files=process.argv.slice(2);
if(!files.length||files.some(f=>!/^tests\/[\w.-]+\.test\.ts$/.test(f)))throw Error('Pass explicit tests/<name>.test.ts paths');
const db=await startDatabase({temporary:true,reap:false});
const rel=relative(resolve(root,'.qa'),resolve(db.work));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Temporary database escaped workspace');
try{const p=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',...files,'--maxWorkers=1'],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn},stdio:'inherit',windowsHide:true});process.exitCode=p.status??1;}
finally{await db.stop();}
