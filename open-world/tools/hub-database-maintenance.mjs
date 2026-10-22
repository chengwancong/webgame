/** HUB-S maintenance. No reset is implicit; even an isolated reset requires a
 * verified full backup and no other database sessions. Credentials never print. */
import {Pool} from 'pg';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,pgCommand} from './runtime.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const q=name=>'"'+name.replaceAll('"','""')+'"';
export function pgEnvironment(dsn){
 const u=new URL(dsn);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('Only the local development database may be maintained');
 return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1))||'postgres'};
}
export function runPg(name,args,dsn){const r=spawnSync(pgCommand(name),args,{env:pgEnvironment(dsn),encoding:'utf8',windowsHide:true,timeout:120000});if(r.error||r.status!==0)throw Error(name+' failed: '+(r.error?.message??r.stderr));return r.stdout;}
export async function databaseIdentity(c){
 const r=(await c.query("SELECT current_database() db, current_setting('data_directory') directory, (SELECT system_identifier::text FROM pg_control_system()) cluster, (SELECT oid::text FROM pg_database WHERE datname=current_database()) oid")).rows[0];
 return digest(JSON.stringify(r));
}
export async function assertOwnedDatabase(c){
 const r=(await c.query("SELECT current_database() db,current_setting('data_directory') directory")).rows[0];
 if(r.db!=='postgres')throw Error('Maintenance target must be the workspace runtime database postgres');
 const actual=await realpath(resolve(r.directory)),normal=p=>process.platform==='win32'?p.toLowerCase():p;
 const resident=await realpath(resolve(root,'.runtime/dev/data')).catch(()=>null);
 if(resident&&normal(actual)===normal(resident))return {kind:'resident',directory:actual};
 const qa=await realpath(resolve(root,'.qa')).catch(()=>null),rel=qa?relative(normal(qa),normal(actual)):'';
 if(!qa||!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Database directory is outside this workspace runtime');
 const owner=JSON.parse(await readFile(resolve(actual,'../owner.json'),'utf8'));
 if(owner.tool!=='open-world-runtime'||owner.temporary!==true||normal(await realpath(resolve(owner.data)))!==normal(actual))throw Error('Temporary database ownership cannot be verified');
 return {kind:'temporary',directory:actual};
}
export async function maintenancePlan(c){
 const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
 if(!tables.includes('ow_accounts')||!tables.includes('ow_characters')||tables.some(n=>!n.startsWith('ow_')))throw Error('Unexpected database/schema; refusing maintenance');
 const counts={},digests={};for(const table of tables){const r=(await c.query("SELECT count(*) n,md5(coalesce(string_agg(h,'' ORDER BY h),'')) digest FROM (SELECT md5(row_to_json(t)::text) h FROM public."+q(table)+' t) rows')).rows[0];counts[table]=Number(r.n);digests[table]=r.digest;}
 return {identity:await databaseIdentity(c),tables,clear:tables.filter(n=>n!=='ow_accounts'&&n!=='ow_schema'),counts,digests};
}
async function backupPath(file){
 const base=resolve(root,'.runtime/backups'),full=resolve(file),rel=relative(base,full);
 if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('Backup must stay inside .runtime/backups');
 const baseReal=await realpath(base),parentReal=await realpath(resolve(full,'..'));
 if(parentReal!==baseReal)throw Error('Backup must be directly inside the real backups directory');
 return full;
}
export async function backupDatabase(dsn,{dryRun=false}={}){
 const pool=new Pool({connectionString:dsn,max:1});pgEnvironment(dsn);
 try{const target=await assertOwnedDatabase(pool),plan=await maintenancePlan(pool);if(dryRun){await lstat(pgCommand('pg_dump'));await lstat(pgCommand('pg_restore'));return {dryRun:true,target:target.kind,identity:plan.identity,tables:plan.tables.length,characters:plan.counts.ow_characters,accounts:plan.counts.ow_accounts};}
  await mkdir(resolve(root,'.runtime/backups'),{recursive:true});const file=await backupPath(join(root,'.runtime/backups','hub-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()+'.dump'));
  runPg('pg_dump',['--format=custom','--file',file],dsn);runPg('pg_restore',['--list',file],dsn);
  const manifest={schema:1,createdAt:new Date().toISOString(),file,sha256:digest(await readFile(file)),...plan};
  await writeFile(file+'.json',JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
 }finally{await pool.end();}
}
/** Verify THIS archive, not a different dry-run archive. The generated database
 * name is exclusively ours; a failed drop is surfaced, never force-terminated. */
export async function verifyBackupRestore(dsn,manifestFile){
 await backupPath(manifestFile);if((await lstat(manifestFile)).isSymbolicLink())throw Error('Refusing symlink backup manifest');const m=JSON.parse(await readFile(manifestFile,'utf8')),file=await backupPath(m.file);
 if(m.schema!==1||(await lstat(file)).isSymbolicLink()||digest(await readFile(file))!==m.sha256)throw Error('Backup verification failed');
 const owner=new Pool({connectionString:dsn,max:1}),name='hub_restore_'+randomUUID().replaceAll('-','');let created=false,restored;
 try{await assertOwnedDatabase(owner);if(await databaseIdentity(owner)!==m.identity)throw Error('Backup belongs to another database');
  await owner.query('CREATE DATABASE '+q(name));created=true;
  const u=new URL(dsn);u.pathname='/'+name;runPg('pg_restore',['--exit-on-error','--dbname',name,file],u.href);
  restored=new Pool({connectionString:u.href,max:1});const plan=await maintenancePlan(restored);await restored.end();restored=undefined;
  if(JSON.stringify(plan.counts)!==JSON.stringify(m.counts)||JSON.stringify(plan.digests)!==JSON.stringify(m.digests))throw Error('Full restore differs from recorded backup contents');
  if(digest(await readFile(file))!==m.sha256)throw Error('Archive changed during restore verification');
  const proof={schema:1,verifiedAt:new Date().toISOString(),file,sha256:m.sha256,identity:m.identity,fullRestore:true,counts:plan.counts,digests:plan.digests};
  const proofFile=file+'.restore-'+randomUUID()+'.json';await writeFile(proofFile,JSON.stringify(proof,null,2),{flag:'wx'});return {file:proofFile,sha256:digest(await readFile(proofFile)),archiveSha256:m.sha256};
 }finally{try{if(restored)await restored.end();if(created)await owner.query('DROP DATABASE '+q(name));}finally{await owner.end();}}
}
export async function clearCharacters(dsn,manifestFile,{confirm=false,freeze,onBackupVerified}={}){
 if(!confirm)throw Error('Explicit --confirm-clear-all-characters is required');
 const keys=['camps','patrols','exploration','waypoints','bounties','events','fieldEntry','fieldGather','fieldSprint'];
 if(!freeze||keys.some(k=>freeze[k]!==true)||Object.keys(freeze).some(k=>!keys.includes(k)))throw Error('All nine implemented freeze switches must be enabled before reset');
 await backupPath(manifestFile);if((await lstat(manifestFile)).isSymbolicLink())throw Error('Refusing symlink backup manifest');
 const m=JSON.parse(await readFile(manifestFile,'utf8')),file=await backupPath(m.file);
 if((await lstat(file)).isSymbolicLink()||m.schema!==1||digest(await readFile(file))!==m.sha256)throw Error('Backup verification failed');
 runPg('pg_restore',['--list',file],dsn);
 const proof=await verifyBackupRestore(dsn,manifestFile);
 // Persist the exact archive's proof before opening the destructive transaction.
 // If COMMIT succeeds but its response is lost, the coordinator still has the
 // already-verified backup reference and must never clear again just to get it.
 if(onBackupVerified)await onBackupVerified(proof);
 const pool=new Pool({connectionString:dsn,max:1});pgEnvironment(dsn);const c=await pool.connect();
 try{await assertOwnedDatabase(c);await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query('SELECT pg_advisory_xact_lock(8611049)');
  const initial=await maintenancePlan(c);
  // Seal the audit-to-reset interval. A racing writer must wait, and we rehash
  // under these locks; lock contention aborts without changing any data.
  await c.query('LOCK TABLE '+initial.tables.map(n=>'public.'+q(n)).join(', ')+' IN ACCESS EXCLUSIVE MODE');
  const plan=await maintenancePlan(c);if(plan.identity!==m.identity)throw Error('Backup belongs to another database');
  const peers=Number((await c.query('SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows[0].n);
  if(peers)throw Error('Other database sessions are still connected; no reset performed');
  const active=Number((await c.query('SELECT count(*) n FROM ow_controls WHERE expires>now()')).rows[0].n);
  if(active)throw Error('A character control lease is still active; no reset performed');
  const runs=Number((await c.query("SELECT count(*) n FROM ow_dungeons WHERE status IN ('preparing','loading','running')")).rows[0].n);
  if(runs)throw Error('Dungeon instances remain active; no reset performed');
  const activities=Number((await c.query("SELECT count(*) n FROM ow_field_activities WHERE status='running'")).rows[0].n);
  if(activities)throw Error('Field activities remain active; no reset performed');
  if(JSON.stringify(plan.tables)!==JSON.stringify(m.tables)||JSON.stringify(plan.counts)!==JSON.stringify(m.counts)||JSON.stringify(plan.digests)!==JSON.stringify(m.digests))throw Error('Database changed since backup; take a fresh backup');
  const accounts=(await c.query('SELECT id,username,password FROM ow_accounts ORDER BY id')).rows;
  // No CASCADE: a dependency outside the enumerated game tables must abort.
  await c.query('TRUNCATE '+plan.clear.map(n=>'public.'+q(n)).join(', ')+' RESTART IDENTITY');
  if(JSON.stringify(accounts)!==JSON.stringify((await c.query('SELECT id,username,password FROM ow_accounts ORDER BY id')).rows))throw Error('Account preservation check failed');
  await c.query('INSERT INTO ow_schema(version) VALUES(19) ON CONFLICT DO NOTHING');await c.query('COMMIT');
  return {cleared:true,accounts:accounts.length,characters:0,db:19,backup:file,sha256:m.sha256,restoreProof:proof};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Set AW_DATABASE_URL explicitly; no implicit resident database');
 const [op,...args]=process.argv.slice(2),get=k=>args.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
 if(op==='backup')console.log(JSON.stringify(await backupDatabase(dsn,{dryRun:args.includes('--dry-run')})));
 else if(op==='reset')console.log(JSON.stringify(await clearCharacters(dsn,get('manifest'),{confirm:args.includes('--confirm-clear-all-characters'),freeze:JSON.parse(process.env.AW_FIELD_FREEZE??'{}')})));
 else throw Error('Use backup [--dry-run] or reset --manifest=... --confirm-clear-all-characters');
}
