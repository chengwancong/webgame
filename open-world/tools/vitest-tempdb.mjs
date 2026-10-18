// 用自有临时 PostgreSQL 跑 vitest（不碰常驻库 8612）。用法：node tools/vitest-tempdb.mjs [vitest 参数…]
import {spawn} from 'node:child_process';
import {startDatabase,root} from './runtime.mjs';
const database=await startDatabase({temporary:true,reap:false});
let code=1;
try{
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...process.argv.slice(2)],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn},stdio:'inherit',windowsHide:true});
 code=await new Promise(r=>child.once('exit',c=>r(c??1)));
}finally{await database.stop();}
process.exit(code);
