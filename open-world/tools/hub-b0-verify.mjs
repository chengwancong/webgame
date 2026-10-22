import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {startDatabase,root} from './runtime.mjs';
import {backupDatabase,clearCharacters,runPg,maintenancePlan} from './hub-database-maintenance.mjs';

const db=await startDatabase({temporary:true,reap:false});
const qa=resolve(root,'.qa'),rel=relative(qa,resolve(db.work));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Temporary database escaped workspace');
const output=resolve(root,'.runtime/hub-b0-b4-20261021');await mkdir(output,{recursive:true});
let pool;try{
 const run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','tests/hub-field-freeze.test.ts','tests/hub-b0.database.test.ts','--maxWorkers=1'],{cwd:root,env:{...process.env,AW_DATABASE_URL:db.dsn},stdio:'inherit',windowsHide:true});if(run.status!==0)throw Error('B0 tests failed');
 pool=new Pool({connectionString:db.dsn,max:1});await pool.query("UPDATE ow_controls SET expires=now()-interval '1 second'");await pool.end();pool=undefined;
 const dry=await backupDatabase(db.dsn,{dryRun:true});const backup=await backupDatabase(db.dsn);
 // Restore the FULL archive into another database of our isolated cluster.
 const restored='hub_restore_'+randomUUID().replaceAll('-','');pool=new Pool({connectionString:db.dsn,max:1});await pool.query('CREATE DATABASE '+restored);await pool.end();pool=undefined;
 const url=new URL(db.dsn);url.pathname='/'+restored;runPg('pg_restore',['--exit-on-error','--dbname',restored,backup.file],url.href);
 pool=new Pool({connectionString:url.href,max:1});const restoredPlan=await maintenancePlan(pool);await pool.end();pool=undefined;
 if(JSON.stringify(restoredPlan.counts)!==JSON.stringify(backup.counts)||JSON.stringify(restoredPlan.digests)!==JSON.stringify(backup.digests))throw Error('Full restore differs from backup source');
 const flags=Object.fromEntries(['camps','patrols','exploration','waypoints','bounties','events','fieldEntry','fieldGather','fieldSprint'].map(k=>[k,true]));
 // Refusal with an active peer must leave the database unchanged.
 pool=new Pool({connectionString:db.dsn,max:1});await pool.query('SELECT 1');let refused=false;
 try{await clearCharacters(db.dsn,backup.file+'.json',{confirm:true,freeze:flags});}catch(e){refused=String(e).includes('Other database sessions');}
 if(!refused)throw Error('Reset did not refuse a concurrent connection');await pool.end();pool=undefined;
 let beforeClearProof;
 const reset=await clearCharacters(db.dsn,backup.file+'.json',{confirm:true,freeze:flags,onBackupVerified:async proof=>{
  const recorded=JSON.parse(await readFile(proof.file,'utf8'));
  if(recorded.file!==backup.file||recorded.sha256!==backup.sha256||recorded.identity!==backup.identity||recorded.fullRestore!==true)throw Error('Pre-clear proof does not verify the same archive');
  const audit=new Pool({connectionString:db.dsn,max:1});try{const plan=await maintenancePlan(audit);if(JSON.stringify(plan.digests)!==JSON.stringify(backup.digests))throw Error('Proof callback ran after data was changed');}finally{await audit.end();}
  beforeClearProof=proof;
 }});
 if(!beforeClearProof||JSON.stringify(beforeClearProof)!==JSON.stringify(reset.restoreProof))throw Error('Exact restore proof was not exposed before the destructive transaction');
 pool=new Pool({connectionString:db.dsn,max:1});const after=await maintenancePlan(pool);if(after.counts.ow_accounts!==backup.counts.ow_accounts||after.counts.ow_characters!==0)throw Error('Reset/account preservation failed');
 if(!(await pool.query('SELECT 1 FROM ow_schema WHERE version=19')).rowCount)throw Error('Reset did not record db19');await pool.end();pool=undefined;
 await writeFile(resolve(output,'b0-verification.json'),JSON.stringify({dry,backup:{file:backup.file,sha256:backup.sha256},restoreVerified:true,proofRecordedBeforeClear:true,concurrentResetRejected:refused,reset,counts:after.counts},null,2));
 console.log(JSON.stringify({passed:true,restoreVerified:true,accountsPreserved:reset.accounts,characters:0,backup:backup.file,sha256:backup.sha256}));
}finally{if(pool)await pool.end();await db.stop();}
