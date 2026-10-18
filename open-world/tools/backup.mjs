import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {pgCommand} from './runtime.mjs';
const tables=['ow_schema','ow_accounts','ow_sessions','ow_characters','ow_controls','ow_permits','ow_kills','ow_rewards','ow_receipts','ow_ledger','ow_challenge_runs','ow_raid_lobbies'];
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';return JSON.stringify(value);}
async function summary(connection){
 const result={tables:{}};
 for(const table of tables){const rows=(await connection.query('SELECT to_jsonb(t) AS data FROM '+table+' t')).rows.map(row=>canonical(row.data)).sort();result.tables[table]={count:rows.length,sha256:createHash('sha256').update(rows.join('\n')).digest('hex')};}
 const characters=await connection.query("SELECT count(*)::integer characters,coalesce(sum((state->>'gold')::bigint),0)::text gold FROM ow_characters");return {...characters.rows[0],...result};
}
export async function backupCheck(database){
 if(!database.work)throw Error('Backup verification requires an isolated QA database.');
 const owner=JSON.parse(await readFile(join(database.work,'owner.json'),'utf8'));if(owner.tool!=='open-world-runtime'||owner.temporary!==true)throw Error('Backup verification refuses a persistent player database.');
 const file=join(database.work,'restore-proof.dump'),pool=new pg.Pool({connectionString:database.dsn}),restoreName='ow_restore_'+randomUUID().replaceAll('-','');let created=false;
 try{
  const source=await pool.connect();let before;
  try{
   await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');before=await summary(source);
   const snapshot=(await source.query('SELECT pg_export_snapshot() snapshot')).rows[0].snapshot;
   const dump=spawnSync(pgCommand('pg_dump'),['--format=custom','--snapshot',snapshot,'--file',file,database.dsn],{encoding:'utf8',windowsHide:true});if(dump.status!==0)throw Error(dump.stderr||dump.error?.message||'pg_dump failed');
   await source.query('COMMIT');
  }catch(error){await source.query('ROLLBACK');throw error;}finally{source.release();}
  await pool.query('CREATE DATABASE '+restoreName);created=true;const url=new URL(database.dsn);url.pathname='/'+restoreName;
  const restore=spawnSync(pgCommand('pg_restore'),['--exit-on-error','--dbname',url.href,file],{encoding:'utf8',windowsHide:true});if(restore.status!==0)throw Error(restore.stderr||restore.error?.message||'pg_restore failed');
  const restored=new pg.Pool({connectionString:url.href});try{const after=await summary(restored);if(canonical(before)!==canonical(after))throw Error('Backup count or full-row SHA-256 mismatch');return {ok:true,before,after,basis:'One exported PostgreSQL snapshot; canonical full-row hashes include complete character state, challenge and raid state, receipts, ledger and pending/claimed rewards.'};}finally{await restored.end();}
 }finally{if(created)await pool.query('DROP DATABASE '+restoreName);await pool.end();}
}
