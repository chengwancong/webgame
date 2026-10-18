import {Pool} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
const out='docs/reviews/playability-20261008/evidence';
const pidFile=(await readFile('.runtime/dev/data/postmaster.pid','utf8')).trim().split(/\r?\n/),port=Number(pidFile[3]);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid existing dev PG port');
const pool=new Pool({connectionString:'postgresql://aw_world@127.0.0.1:'+port+'/postgres',max:1});let result;
try{await pool.query('BEGIN TRANSACTION READ ONLY');const counts=(await pool.query('SELECT (SELECT count(*) FROM ow_accounts) AS accounts,(SELECT count(*) FROM ow_characters) AS characters,(SELECT count(*) FROM ow_receipts) AS receipts,(SELECT count(*) FROM ow_ledger) AS ledger')).rows[0];
 const characters=(await pool.query("SELECT id,state->>'name' AS name,state->>'level' AS level,state->>'xp' AS xp FROM ow_characters WHERE state->>'name'=$1",['新角色冒烟'])).rows;
 const timeline=[];for(const c of characters){const entries=(await pool.query("SELECT created,delta FROM ow_ledger WHERE character=$1 AND created>=$2 AND created<$3 ORDER BY created",[c.id,'2026-10-08T03:00:00Z','2026-10-08T05:05:00Z'])).rows;timeline.push({name:c.name,level:c.level,xp:c.xp,entries});}
 await pool.query('COMMIT');result={at:new Date().toISOString(),method:'READ ONLY transaction; no migration, login, control or gameplay commands.',scope:'Check the auto-restored formal preview character observed before switching to isolation; 11:00-13:05 Asia/Shanghai ledger interval.',counts,timeline};
}finally{await pool.end();}
await writeFile(out+'/formal-readonly-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
