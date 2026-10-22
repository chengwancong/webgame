/** HUB-S coordinator. Default/status/resume are read-only. The destructive path
 * requires three explicit flags, an unused receipt path, owned resident storage,
 * and verified managed-API ownership of every other database connection.
 * This tool never performs GUI acceptance or declares HUB-S complete. */
import {Pool} from 'pg';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,lstat,realpath,mkdir,open,rename,access} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,pgCommand,startDatabase,processIdentityMatches} from './runtime.mjs';
import {windowsProcessInfo} from './windows-process-info.mjs';
import {assertOwnedDatabase,databaseIdentity,maintenancePlan,backupDatabase,clearCharacters} from './hub-database-maintenance.mjs';

export const switchFreezeKeys=['camps','patrols','exploration','waypoints','bounties','events','fieldEntry','fieldGather','fieldSprint'];
const paths={data:resolve(root,'.runtime/dev/data'),pid:resolve(root,'.runtime/dev/data/postmaster.pid'),owner:resolve(root,'.runtime/dev/owner.json'),serviceConfig:resolve(root,'.runtime/service/config.json'),serviceState:resolve(root,'.runtime/service/state.json'),enabled:resolve(root,'.runtime/service/enabled'),freeze:resolve(root,'packages/content/hub-runtime.json'),versions:resolve(root,'packages/contracts/index.ts'),output:resolve(root,'.runtime/hub-b0-b4-20261021'),receipt:resolve(root,'.runtime/hub-b0-b4-20261021/switch-state.json'),lock:resolve(root,'.runtime/hub-b0-b4-20261021/switch-apply.lock')};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const normal=value=>process.platform==='win32'?value.replaceAll('\\','/').toLowerCase():value;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const exists=async file=>{try{await access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const redact=text=>text.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[database URL redacted]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]');
const safeError=error=>redact(String(error instanceof Error?error.message:error)).slice(0,1800);
function need(ok,message){if(!ok)throw Error(message);}

/** Resolve all targets beneath the canonical checkout and reject redirected
 * parents/targets. New files are allowed only in a verified existing directory. */
async function ownedPath(file,{missing=false}={}){
 const absolute=resolve(file),rel=relative(root,absolute);need(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'Target escaped the workspace');
 const canonicalRoot=await realpath(root),parent=await realpath(dirname(absolute));need(normal(parent)===normal(resolve(canonicalRoot,dirname(rel))),'Target parent is redirected outside its expected workspace directory');
 try{const stat=await lstat(absolute);need(!stat.isSymbolicLink(),'Refusing a symlink/junction target');const actual=await realpath(absolute);need(normal(actual)===normal(resolve(canonicalRoot,rel)),'Target resolved outside the expected workspace path');}
 catch(e){if(!missing||e.code!=='ENOENT')throw e;}
 return absolute;
}
async function readOwned(file){await ownedPath(file);return readFile(file,'utf8');}
async function atomicWrite(file,text,expectedHash){
 await ownedPath(file,{missing:true});if(expectedHash!==undefined)need(hash(await readFile(file))===expectedHash,'Source changed concurrently; refusing to overwrite it');
 const temporary=join(dirname(file),'.'+randomUUID()+'.tmp');await ownedPath(temporary,{missing:true});const handle=await open(temporary,'wx',0o600);
 try{await handle.writeFile(text);await handle.sync();}finally{await handle.close();}
 // Recheck immediately before replacement. On failure the unique local temp is
 // retained for inspection; no other file is removed as cleanup.
 if(expectedHash!==undefined)need(hash(await readFile(file))===expectedHash,'Source changed while preparing atomic replacement');
 await rename(temporary,file);
}
export function parseSwitchVersions(text){
 const declaration=/export\s+const\s+versions\s*=\s*\{([^}]+)\}\s*as\s+const/.exec(text);need(declaration,'Version declaration is missing');
 const fields=declaration[1],number=key=>Number(new RegExp('(?:^|,)\\s*'+key+'\\s*:\\s*(\\d+)').exec(fields)?.[1]),string=key=>new RegExp('(?:^|,)\\s*'+key+"\\s*:\\s*['\"]([^'\"]+)['\"]").exec(fields)?.[1];
 return {client:string('client'),protocol:number('protocol'),rules:string('rules'),assets:string('assets'),db:number('db')};
}
function parseFreeze(text){const value=JSON.parse(text),flags=value.fieldFreeze;need(flags&&Object.keys(flags).length===9&&switchFreezeKeys.every(key=>typeof flags[key]==='boolean'),'Expected exactly nine boolean freeze flags');return {value,flags};}
export function sourceWithDb19(text){
 const versions=parseSwitchVersions(text);need(versions.protocol===50&&versions.rules==='ow-91','Expected protocol 50 / rules ow-91');need(versions.db===18||versions.db===19,'Unexpected source database version');if(versions.db===19)return text;
 const result=text.replace(/(export\s+const\s+versions\s*=\s*\{)([^}]+)(\}\s*as\s+const)/,(_,prefix,body,suffix)=>prefix+body.replace(/(\bdb\s*:\s*)18\b/,(_match,key)=>key+'19')+suffix);
 const changed=parseSwitchVersions(result);need(changed.db===19&&JSON.stringify({...changed,db:18})===JSON.stringify(versions),'Version edit would change fields other than db');return result;
}
async function residentEndpoint(){
 const lines=(await readOwned(paths.pid)).trim().split(/\r?\n/),pid=Number(lines[0]),port=Number(lines[3]);need(Number.isInteger(pid)&&pid>0&&Number.isInteger(port)&&port>0&&port<65536,'Invalid owned postmaster.pid');
 await ownedPath(paths.data);need(normal(await realpath(lines[1]))===normal(await realpath(paths.data)),'postmaster.pid points at another data directory');
 return {pid,port,dsn:`postgresql://aw_world@127.0.0.1:${port}/postgres`};
}
async function withResident(dsn,fn){const pool=new Pool({connectionString:dsn,max:1,connectionTimeoutMillis:5000,query_timeout:10000});try{const owned=await assertOwnedDatabase(pool);need(owned.kind==='resident','HUB-S requires the resident database, never a QA database');return await fn(pool,owned);}finally{await pool.end();}}
async function activeWork(c){return (await c.query(`SELECT
 (SELECT count(*)::int FROM public.ow_controls WHERE expires>now()) leases,
 (SELECT count(*)::int FROM public.ow_dungeons WHERE status IN ('preparing','loading','running')) dungeons,
 (SELECT count(*)::int FROM public.ow_field_activities WHERE status='running') activities,
 (SELECT coalesce(max(version),0)::int FROM public.ow_schema) db`)).rows[0];}
function requireIdle(work){need(work.leases===0,'Active character leases remain; no switch performed');need(work.dungeons===0,'Active dungeon instances remain; no switch performed');need(work.activities===0,'Active field activities remain; no switch performed');}
export function parseTcpRows(text){return text.split(/\r?\n/).flatMap(line=>{const m=/^\s*TCP\s+(\S+):(\d+)\s+(\S+):(\d+)\s+ESTABLISHED\s+(\d+)\s*$/i.exec(line);return m?[{local:m[1],localPort:Number(m[2]),remote:m[3],remotePort:Number(m[4]),pid:Number(m[5])}]:[];});}
const loopback=address=>['127.0.0.1','::1','[::1]','::ffff:127.0.0.1','[::ffff:127.0.0.1]'].includes(address);
function tcpRows(){const result=spawnSync(join(process.env.SystemRoot??'C:/Windows','System32/netstat.exe'),['-ano','-p','tcp'],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:4*1024*1024});need(!result.error&&result.status===0,'Cannot prove PostgreSQL TCP connection owners');return parseTcpRows(result.stdout);}
async function managedApiIdentity(postmasterPid){
 need(process.platform==='win32','This coordinator requires the verified Windows process/TCP ownership path');
 const config=JSON.parse(await readOwned(paths.serviceConfig)),state=JSON.parse(await readOwned(paths.serviceState)),owner=JSON.parse(await readOwned(paths.owner));
 need(normal(resolve(config.root))===normal(root)&&normal(resolve(state.root))===normal(root),'Managed service belongs to another checkout');need(!config.env?.AW_DATABASE_URL,'Managed service has an external database override; resolve it before HUB-S');
 need(owner.tool==='open-world-runtime'&&owner.temporary===false&&normal(await realpath(owner.data))===normal(await realpath(paths.data)),'Resident owner metadata is invalid');
 need(owner.database===postmasterPid&&owner.owner===state.pid&&Number.isInteger(owner.api?.pid),'Resident database and API owner records disagree');
 const runner=windowsProcessInfo(state.pid),api=windowsProcessInfo(owner.api.pid),postgres=windowsProcessInfo(postmasterPid);
 need(runner.found&&api.found&&postgres.found&&api.parent===state.pid&&postgres.name.toLowerCase()==='postgres.exe','Managed process parentage cannot be verified');
 need(normal(runner.commandLine).includes(normal(join(root,'tools/windows-service-runner.mjs')))&&normal(runner.path)===normal(config.node),'Supervisor is not this checkout managed runner');
 need(normal(postgres.path)===normal(pgCommand('postgres')),'Resident PostgreSQL executable does not match the configured runtime');
 need(processIdentityMatches(owner.api.pid,owner.api),'API creation time/identity differs from registered ownership');
 need(/(?:^|[\s"'])apps[\\/]api[\\/]src[\\/]main\.ts(?:[\s"']|$)/.test(api.commandLine)||normal(api.commandLine).includes(normal(join(root,'apps/api/src/main.ts'))),'Registered API command is not the game API entrypoint');
 need(Number.isInteger(state.port)&&state.port>0&&state.port<65536&&typeof state.token==='string','Invalid managed control endpoint');
 const response=await fetch(`http://127.0.0.1:${state.port}/status`,{headers:{authorization:`Bearer ${state.token}`},signal:AbortSignal.timeout(4000)});need(response.ok,'Managed service control did not authenticate');const status=await response.json();
 need(status.pid===state.pid&&status.phase==='running'&&status.components?.api===owner.api.pid,'Managed service is not stably running with the registered API');
 // Never return command lines, the control token, environment or a database URL.
 return {runnerPid:state.pid,apiPid:owner.api.pid,apiCreated:api.created,postgresPid:postmasterPid};
}
export async function switchPreflight(){
 need(!process.env.AW_DATABASE_URL,'Unset AW_DATABASE_URL; HUB-S discovers only the owned resident database');
 const source=parseSwitchVersions(await readOwned(paths.versions)),freeze=parseFreeze(await readOwned(paths.freeze)).flags;
 need(source.protocol===50&&source.rules==='ow-91'&&source.db===18,'Pre-switch source must be protocol 50 / rules ow-91 / db 18');
 const endpoint=await residentEndpoint(),managed=await managedApiIdentity(endpoint.pid);
 return withResident(endpoint.dsn,async c=>{const identity=await databaseIdentity(c),work=await activeWork(c);requireIdle(work);need(work.db===18,'Resident database is not at the expected pre-switch db 18');
  const peers=(await c.query('SELECT pid,host(client_addr) address,client_port,state,backend_type FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows,tcp=tcpRows();
  const proven=peers.map(peer=>{need(peer.backend_type==='client backend'&&loopback(peer.address)&&Number.isInteger(peer.client_port)&&peer.client_port>0,'A database peer is not a provable local API connection');
   const matches=tcp.filter(row=>row.localPort===peer.client_port&&row.remotePort===endpoint.port&&loopback(row.local)&&loopback(row.remote));need(matches.length===1&&matches[0].pid===managed.apiPid,'A PostgreSQL connection belongs to an unknown/non-API process');need(peer.state==='idle','An API database session is executing work; retry after it is idle');return {backendPid:peer.pid,clientPort:peer.client_port,apiPid:managed.apiPid};});
  return {identity,source,freeze,active:work,managed,apiConnections:proven,residentPort:endpoint.port};
 });
}
async function service(action,logFile){
 await ownedPath(join(root,'tools/local-service.mjs'));await ownedPath(logFile,{missing:true});
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(root,'tools/local-service.mjs'),action],{cwd:root,env:{...process.env},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',timer;const append=data=>{output=(output+data.toString()).slice(-200000);};child.stdout.on('data',append);child.stderr.on('data',append);child.on('error',error=>{clearTimeout(timer);reject(error);});timer=setTimeout(()=>{child.kill();reject(Error('Managed service '+action+' timed out; verify its state before any recovery'));},90000);child.on('exit',code=>{clearTimeout(timer);resolve({code,output});});});
 await atomicWrite(logFile,redact(result.output)+'\n');need(result.code===0,'Managed service '+action+' failed; see local sanitized log');
}
async function waitDatabaseStopped(){for(let i=0;i<60;i++){if(!await exists(paths.pid))return;await pause(500);}throw Error('Resident postmaster.pid remains after managed service stop; do not start a second owner');}
async function stopOwnedMaintenance(database){
 need(database?.hubOwnedProcess,'Maintenance process identity was not captured; retain it for manual review');
 const current=windowsProcessInfo(database.hubOwnedProcess.pid);
 if(await exists(paths.pid)){const endpoint=await residentEndpoint();need(endpoint.pid===database.hubOwnedProcess.pid&&endpoint.port===database.port&&current.found&&current.created===database.hubOwnedProcess.created,'Maintenance process was replaced; refusing to stop an unknown owner');}
 else need(!current.found,'Maintenance PID remains alive without its ownership file; refusing a blind stop');
 return database.stop();
}
async function publicVersionsAndFreeze(){
 const healthResponse=await fetch('http://127.0.0.1:8612/api/health',{signal:AbortSignal.timeout(4000)});need(healthResponse.ok,'Health endpoint is unavailable');const health=await healthResponse.json();
 const contentResponse=await fetch('http://127.0.0.1:8612/api/content',{signal:AbortSignal.timeout(4000)});need(contentResponse.ok,'Content endpoint is unavailable');const content=await contentResponse.json();
 return {health:health.versions,content:content.versions,freeze:content.fieldFreeze};
}
async function verifyPublic(expected,flags){let last='not observed';for(let n=0;n<30;n++){try{const value=await publicVersionsAndFreeze();need(['client','protocol','rules','assets','db'].every(key=>value.health?.[key]===value.content?.[key]),'Health/content versions differ');need(Object.entries(expected).every(([key,valueExpected])=>value.health?.[key]===valueExpected),'Published versions do not match source');need(switchFreezeKeys.every(key=>value.freeze?.[key]===flags[key]),'Published freeze switches do not match');return value;}catch(e){last=safeError(e);await pause(1000);}}throw Error('Managed service verification failed: '+last);}
async function verifyRestartedResident(expectedIdentity,expectedDb){
 const endpoint=await residentEndpoint(),managed=await managedApiIdentity(endpoint.pid);
 return withResident(endpoint.dsn,async c=>{
  const identity=await databaseIdentity(c);need(identity===expectedIdentity,'Restarted managed service is attached to a different resident database');
  const db=Number((await c.query('SELECT coalesce(max(version),0)::int version FROM public.ow_schema')).rows[0].version);need(db===expectedDb,'Restarted resident SQL schema does not match the required database version');
  return {identity,db,residentPort:endpoint.port,managed};
 });
}
async function updateDbSource(){const text=await readOwned(paths.versions),next=sourceWithDb19(text);if(text!==next)await atomicWrite(paths.versions,next,hash(text));return parseSwitchVersions(next);}
async function inspectClearOutcome(dsn,backup){
 try{return await withResident(dsn,async c=>{need(await databaseIdentity(c)===backup.identity,'Maintenance database identity changed');const plan=await maintenancePlan(c),version=Number((await c.query('SELECT coalesce(max(version),0) version FROM public.ow_schema')).rows[0].version);
  if(version===19&&plan.counts.ow_characters===0&&plan.digests.ow_accounts===backup.digests.ow_accounts)return 'cleared';
  if(version===18&&JSON.stringify(plan.counts)===JSON.stringify(backup.counts)&&JSON.stringify(plan.digests)===JSON.stringify(backup.digests))return 'not-cleared';return 'uncertain';
 });}catch{return 'uncertain';}
}
export async function applySwitch({coordinationConfirmed=false,confirmClear=false}={}){
 need(coordinationConfirmed&&confirmClear,'Apply requires both --coordination-confirmed and --confirm-clear-all-characters');need(!await exists(paths.receipt),'A switch receipt already exists. Use --status or --resume; never repeat a recorded switch automatically');
 const preflight=await switchPreflight();await ownedPath(paths.output);await mkdir(paths.output,{recursive:true});
 await ownedPath(paths.lock,{missing:true});const lock=await open(paths.lock,'wx',0o600);try{await lock.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString(),purpose:'HUB-S explicit apply; retain for review, never auto-delete'}));await lock.sync();}finally{await lock.close();}
 need(!await exists(paths.receipt),'Another switch already wrote a receipt; do not repeat apply');
 const id=randomUUID(),originalFreeze=await readOwned(paths.freeze),originalFlags=parseFreeze(originalFreeze).flags,allFrozen=Object.fromEntries(switchFreezeKeys.map(key=>[key,true]));
 const originalCopy=join(paths.output,'switch-'+id+'-original-freeze.json');await atomicWrite(originalCopy,originalFreeze);
 const state={schema:1,id,startedAt:new Date().toISOString(),phase:'preflight-confirmed',coordinationConfirmed:true,clearConfirmed:false,preflight,originalFreeze:{file:originalCopy,sha256:hash(originalFreeze)},history:[]};
 async function phase(name,details={}){state.phase=name;Object.assign(state,details);state.history.push({at:new Date().toISOString(),phase:name});await atomicWrite(paths.receipt,JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify({phase:name,clearConfirmed:state.clearConfirmed}));}
 let maintenance,backup,freezeWrittenHash,stopRequested=false,clearAttempted=false;
 try{
  await phase('preflight-confirmed');await phase('service-stop-requested');stopRequested=true;await service('stop',join(paths.output,'switch-'+id+'-stop.log'));await waitDatabaseStopped();need(!await exists(paths.enabled),'Managed service autostart is still enabled');await phase('service-stopped');
  // AW_DATABASE_URL was rejected above, and the existing PG_VERSION is required:
  // startDatabase is never permitted to initialize an accidental empty cluster.
  await ownedPath(join(paths.data,'PG_VERSION'));maintenance=await startDatabase({temporary:false,reap:false});need(normal(await realpath(maintenance.data))===normal(await realpath(paths.data)),'Maintenance opened a different database directory');
  const maintenanceEndpoint=await residentEndpoint(),maintenanceProcess=windowsProcessInfo(maintenanceEndpoint.pid);need(maintenanceEndpoint.port===maintenance.port&&maintenanceProcess.found,'Maintenance process ownership could not be captured');maintenance.hubOwnedProcess={pid:maintenanceEndpoint.pid,created:maintenanceProcess.created};
  await withResident(maintenance.dsn,async c=>{need(await databaseIdentity(c)===preflight.identity,'Cluster/database identity changed during service restart');requireIdle(await activeWork(c));const n=Number((await c.query('SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()')).rows[0].n);need(n===0,'Unexpected database peer remains during maintenance');});await phase('maintenance-open');
  backup=await backupDatabase(maintenance.dsn);await phase('backup-ready',{backup:{file:backup.file,manifest:backup.file+'.json',sha256:backup.sha256,identity:backup.identity,accounts:backup.counts.ow_accounts}});
  const current=await readOwned(paths.freeze);need(hash(current)===hash(originalFreeze),'Freeze source changed since preflight');const next=JSON.stringify({...parseFreeze(current).value,fieldFreeze:allFrozen},null,2)+'\n';await atomicWrite(paths.freeze,next,hash(current));freezeWrittenHash=hash(next);await phase('freeze-enabled',{freezeWrittenHash});
  await phase('clear-requested');clearAttempted=true;const result=await clearCharacters(maintenance.dsn,backup.file+'.json',{confirm:true,freeze:allFrozen,onBackupVerified:proof=>phase('clear-requested',{restoreProof:proof})});state.clearConfirmed=true;await phase('characters-cleared',{clearConfirmed:true,clearResult:result,restoreProof:result.restoreProof});
  const source=await updateDbSource();await phase('source-db19',{source});await stopOwnedMaintenance(maintenance);maintenance=undefined;await phase('maintenance-stopped');
  await service('start',join(paths.output,'switch-'+id+'-start.log'));await phase('managed-service-started');const databaseVerified=await verifyRestartedResident(preflight.identity,19),verified=await verifyPublic(source,allFrozen);await phase('awaiting-gui',{databaseVerified,verified,nextAction:'Root must perform real login, prologue, port, stargate and wind-story-1 GUI acceptance. Do not declare HUB-S complete from this receipt alone.'});return state;
 }catch(error){
  let outcome=state.clearConfirmed?'cleared':'not-cleared';if(clearAttempted&&!state.clearConfirmed)outcome=maintenance&&backup?await inspectClearOutcome(maintenance.dsn,backup):'uncertain';
  state.error=safeError(error);state.clearOutcome=outcome;state.clearConfirmed=outcome==='cleared';const recoveryErrors=[];
  if(outcome==='not-cleared'){
   try{if(freezeWrittenHash)await atomicWrite(paths.freeze,originalFreeze,freezeWrittenHash);}catch(e){recoveryErrors.push('Freeze restoration: '+safeError(e));}
   try{if(maintenance){await stopOwnedMaintenance(maintenance);maintenance=undefined;}}catch(e){recoveryErrors.push('Maintenance stop: '+safeError(e));}
   if(stopRequested&&!maintenance){try{await service('start',join(paths.output,'switch-'+id+'-recover-start.log'));state.recoveredDatabase=await verifyRestartedResident(preflight.identity,18);await verifyPublic(preflight.source,originalFlags);}catch(e){recoveryErrors.push('Managed service restoration: '+safeError(e));}}
   await phase(recoveryErrors.length?'recovery-required-before-clear':'failed-before-clear-restored',{recoveryErrors,nextAction:'Review the failure and preserved receipt. Any new attempt requires a separate explicit review; this tool will not erase or reuse the receipt.'});
  }else{
   // A confirmed or ambiguous COMMIT must NEVER restore old data or disable the
   // freeze switches. Only stop our own maintenance runtime if still held.
   try{if(maintenance){await stopOwnedMaintenance(maintenance);maintenance=undefined;}}catch(e){recoveryErrors.push('Maintenance stop: '+safeError(e));}
   const nextAction=outcome==='cleared'?'COMMIT is confirmed: preserve this backup, restore proof and all nine freezes. Verify the resident identity, SQL db19 and original account digest. If source still says db18, change ONLY versions.db to19. After verifying the maintenance process is stopped, use node tools/local-service.mjs start; check health/content against source and all nine flags, then perform root GUI acceptance. Never rerun apply/clear or restore the old database.':'COMMIT outcome is UNPROVEN: do not change source db, restart gameplay, disable freezes, restore a database or rerun apply. Inspect the same resident identity and SQL ow_schema first. Only if db18 AND all source digests still match this backup may the original freeze file be restored and the db18 managed service restarted. If db19 and accounts are preserved, follow the confirmed-clear recovery path. Any other state requires manual investigation with the backup retained.';
   await phase(outcome==='cleared'?'recovery-required-after-clear':'recovery-required-clear-uncertain',{recoveryErrors,nextAction});
  }
  throw Error(state.error+'; recovery phase='+state.phase);
 }
}
export async function switchStatus(){
 const receipt=await exists(paths.receipt)?JSON.parse(await readOwned(paths.receipt)):null;const source=parseSwitchVersions(await readOwned(paths.versions)),freeze=parseFreeze(await readOwned(paths.freeze)).flags;
 const interrupted=receipt?.clearConfirmed||receipt?.phase==='clear-requested'?'Inspect the owned resident database and determine whether COMMIT recorded db19. Preserve all freezes and backups until the outcome is proven. Do not rerun clear. Restore the managed service only with the matching source db version, then perform GUI acceptance.':'The receipt records a pre-clear interruption. Verify the owned database is still db18 before restoring the saved original freeze source, stop only the owned maintenance runtime, and restore the managed service. Review the receipt/lock manually; do not rerun apply.';
 return {readOnly:true,source,freeze,postmasterPresent:await exists(paths.pid),applyLockPresent:await exists(paths.lock),receipt:receipt?{id:receipt.id,phase:receipt.phase,clearConfirmed:receipt.clearConfirmed,clearOutcome:receipt.clearOutcome,backup:receipt.backup,restoreProof:receipt.restoreProof,databaseVerified:receipt.databaseVerified,recoveredDatabase:receipt.recoveredDatabase,error:receipt.error,recoveryErrors:receipt.recoveryErrors,nextAction:receipt.nextAction??interrupted}:null};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=new Set(process.argv.slice(2)),known=new Set(['--apply','--coordination-confirmed','--confirm-clear-all-characters','--status','--resume']);need([...args].every(arg=>known.has(arg)),'Unknown HUB switch argument');
 need(!(args.has('--apply')&&(args.has('--status')||args.has('--resume'))),'--status/--resume are strictly read-only and cannot be combined with --apply');
 try{const result=args.has('--apply')?await applySwitch({coordinationConfirmed:args.has('--coordination-confirmed'),confirmClear:args.has('--confirm-clear-all-characters')}):args.has('--status')||args.has('--resume')?await switchStatus():{readOnly:true,preflight:await switchPreflight()};console.log(JSON.stringify(result,null,2));}
 catch(error){console.error(safeError(error));process.exitCode=1;}
}
