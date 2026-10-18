import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,stat,rm,lstat,readdir} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {windowsProcessInfo} from './windows-process-info.mjs';
export const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const defaultPgBin=process.platform==='win32'?join(root,'.runtime/dependencies/pgsql/bin'):join(homedir(),'.local/share/abyss-walker-server/pgsql/18.6/bin');
export const pgCommand=name=>join(process.env.AW_PG_BIN??defaultPgBin,name+(process.platform==='win32'?'.exe':''));
export function processIdentity(pid){
 if(process.platform==='win32'){const p=windowsProcessInfo(pid);return p.found?p.created+' '+p.commandLine:'';}
 return spawnSync('ps',['-p',String(pid),'-o','lstart=','-o','command='],{encoding:'utf8',timeout:10000}).stdout?.trim()??'';
}
export function processIdentityMatches(pid,record){
 if(!record?.identity)return false;
 if(process.platform!=='win32')return processIdentity(pid)===record.identity;
 const p=windowsProcessInfo(pid);if(!p.found)return false;
 if(record.identity===p.created+' '+p.commandLine||record.identity===p.createdExact+' '+p.commandLine)return true;
 // Migrate the bounded StartTime+image-path identity written by the in-flight repair.
 // Both recorded creation time and image path must match; never match PID or path alone.
 return record.identity===p.createdExact+' '+p.path||record.identity===p.created+' '+p.path;
}

export async function freePort(){return new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
export function child(command,args,env={},options={}){return spawn(command,args,{cwd:root,env:{...process.env,...env},stdio:'inherit',detached:false,windowsHide:true,...options});}
export async function stopChild(p){if(!p||p.exitCode!==null||p.signalCode!==null)return;const ended=new Promise(resolve=>p.once('exit',resolve));if(p.connected)p.send('stop');else p.kill('SIGTERM');const timer=setTimeout(()=>p.kill('SIGKILL'),10000);await ended;clearTimeout(timer);}
export async function size(path){if(!existsSync(path))return 0;const s=await lstat(path);if(s.isSymbolicLink())return s.size;if(s.isFile())return s.size;let total=0;for(const name of await readdir(path))total+=await size(join(path,name));return total;}
const pgStatus=data=>spawnSync(pgCommand('pg_ctl'),['-D',data,'status'],{encoding:'utf8',windowsHide:true,timeout:10000}).status;
function processName(pid){
 if(process.platform==='win32'){const p=windowsProcessInfo(pid);return p.found?p.name:'';}
 const result=spawnSync('ps',['-p',String(pid),'-o','comm='],{encoding:'utf8',timeout:10000});
 if(result.error||result.status!==0&&result.status!==1)throw Error('Process query failed');return result.stdout.trim();
}
// A crashed QA run can leave postmaster.pid behind with no server: pg_ctl stop then fails forever.
// Only a temporary .qa database counts, and only when pg_ctl reports "no server running" (3) and the
// recorded PID is gone or not postgres. Any doubt (live postgres, query failure) keeps it retained.
export function leftoverQaPostmaster(data,{qaBase=join(root,'.qa'),status=pgStatus,name=processName}={}){
 try{
  const inside=relative(resolve(qaBase),resolve(data));
  if(!inside||inside.startsWith('..')||isAbsolute(inside)||resolve(data)===resolve(root,'.runtime/dev/data'))return false;
  if(status(data)!==3)return false;
  const pid=Number(readFileSync(join(data,'postmaster.pid'),'utf8').split('\n')[0]);
  if(!Number.isInteger(pid)||pid<=0)return false;
  return !/^postgres(\.exe)?$/i.test(name(pid).split(/[\\/]/).pop());
 }catch{return false;}
}
export async function reapStale({only}={}){
 const base=join(root,'.qa');if(!existsSync(base))return [];
 if((await lstat(base)).isSymbolicLink())throw Error('Refusing symlink QA cleanup');
 const entries=[];for(const name of await readdir(base)){const work=join(base,name);if(only&&resolve(work)!==resolve(only))continue;if((await lstat(work)).isSymbolicLink())continue;let owner;try{owner=JSON.parse(await readFile(join(work,'owner.json'),'utf8'));}catch{continue;}if(owner.tool!=='open-world-runtime'||!owner.temporary)continue;
 try{process.kill(owner.owner,0);continue;}catch(error){if(error.code!=='ESRCH')continue;}
 if(resolve(owner.data)!==resolve(work,'data')){entries.push({work,retained:true,reason:'Database directory not proven inside owned QA run'});continue;}
 if(owner.api){
  const alive=()=>{try{process.kill(owner.api.pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;if(e.code==='EPERM')return true;throw e;}};
  if(alive()){
   let matched=false;try{matched=processIdentityMatches(owner.api.pid,owner.api);}catch(e){entries.push({work,retained:true,reason:'API identity query failed: '+e.message});continue;}
   if(!matched){entries.push({work,retained:true,reason:'Live API identity mismatch; process and directory retained'});continue;}
   try{process.kill(owner.api.pid,'SIGTERM');}catch(e){entries.push({work,retained:true,reason:'API stop failed: '+e.message});continue;}
   for(let n=0;n<100&&alive();n++)await new Promise(r=>setTimeout(r,100));
   if(alive()){entries.push({work,retained:true,reason:'API exit not confirmed; directory retained'});continue;}
  }
 }
 if(existsSync(join(owner.data,'postmaster.pid'))){const stopped=spawnSync(pgCommand('pg_ctl'),['-D',owner.data,'-m','fast','-w','stop'],{encoding:'utf8',windowsHide:true});if(stopped.status!==0&&existsSync(join(owner.data,'postmaster.pid'))&&!leftoverQaPostmaster(owner.data,{qaBase:base}))throw Error('Stale DB retained; stop could not be verified.');}
 const before=await size(work);await rm(work,{recursive:true});entries.push({bytes_before:before,bytes_after:await size(work)});
 }return entries;
}
export async function registerApi(database,api,key='api'){if(!database.work)return;const path=join(database.work,'owner.json'),owner=JSON.parse(await readFile(path,'utf8'));owner[key]={pid:api.pid,identity:processIdentity(api.pid),identityScheme:process.platform==='win32'?'windows-created-commandline-v1':'posix-created-commandline-v1'};await writeFile(path,JSON.stringify(owner));}
export async function startDatabase({temporary=false,reap=true}={}){
 if(reap)await reapStale();
 if(process.env.AW_DATABASE_URL&&!temporary)return {dsn:process.env.AW_DATABASE_URL,stop:async()=>({external:true,bytes_before:0,bytes_after:0})};
 if(!existsSync(pgCommand('initdb')))throw Error('PostgreSQL18 binaries missing: set AW_PG_BIN or AW_DATABASE_URL.');
 const base=join(root,temporary?'.qa':'.runtime');await mkdir(base,{recursive:true});const work=temporary?await mkdtemp(join(base,'run-')):join(base,'dev');await mkdir(work,{recursive:true});
 const data=join(work,'data');let database;
 try{
 // No old database, user storage or symlink is ever adopted.
 if((await lstat(work)).isSymbolicLink())throw Error('Refusing symlink runtime');
 if(existsSync(data)&&(await lstat(data)).isSymbolicLink())throw Error('Refusing symlink database');
 if(existsSync(join(data,'postmaster.pid')))throw Error('Database is already running or has a stale pid file. Stop its owning development process before starting again: '+data);
 if(!existsSync(join(data,'PG_VERSION'))){const init=spawnSync(pgCommand('initdb'),['-D',data,'-U','aw_world','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--locale=C'],{encoding:'utf8',windowsHide:true});if(init.status!==0)throw Error(init.stderr||init.error?.message);}
 const port=await freePort();let error='';
 // pg_ctl is required on Windows: Node's SIGTERM would force-kill postgres.
 if(process.platform==='win32'){
  await writeFile(join(work,'owner.json'),JSON.stringify({tool:'open-world-runtime',owner:process.pid,temporary,data}));
  const started=spawnSync(pgCommand('pg_ctl'),['-D',data,'-l',join(work,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','-t','30','start'],{stdio:'ignore',windowsHide:true});
  if(started.status!==0)throw Error('PostgreSQL startup failed; inspect '+join(work,'postgres.log'));
 }else{
  database=spawn(pgCommand('postgres'),['-D',data,'-h','127.0.0.1','-p',String(port)],{stdio:['ignore','ignore','pipe']});database.stderr.on('data',d=>{error=(error+d).slice(-2000);});
 }
 const databasePid=database?.pid??Number((await readFile(join(data,'postmaster.pid'),'utf8')).split('\n')[0]);
 await writeFile(join(work,'owner.json'),JSON.stringify({tool:'open-world-runtime',owner:process.pid,database:databasePid,temporary,data}));
 for(let n=0;n<100;n++){if(database&&database.exitCode!==null)throw Error('PostgreSQL failed: '+error);const probe=spawnSync(pgCommand('pg_isready'),['-h','127.0.0.1','-p',String(port)],{stdio:'ignore',windowsHide:true});if(probe.status===0)break;if(n===99)throw Error('Database startup timeout');await new Promise(r=>setTimeout(r,100));}
 let stopped=false;return {dsn:`postgresql://aw_world@127.0.0.1:${port}/postgres`,data,work,port,process:database,stop:async()=>{
 if(stopped)return {already_stopped:true};
 if(process.platform==='win32'&&existsSync(join(data,'postmaster.pid'))){const result=spawnSync(pgCommand('pg_ctl'),['-D',data,'-m','fast','-w','-t','30','stop'],{encoding:'utf8',windowsHide:true});if(result.status!==0)throw Error(result.stderr||result.stdout);}
 else await stopChild(database);
 if(existsSync(join(data,'postmaster.pid')))throw Error('Database stop not verified; retained '+work);stopped=true;
 const before=await size(work);if(temporary){await rm(work,{recursive:true});}const after=await size(work);return {temporary,stopped:true,bytes_before:before,bytes_after:after,bytes_removed:before-after,retained:temporary?undefined:data};
 }};
 }catch(error){
 if(process.platform==='win32'&&existsSync(join(data,'postmaster.pid')))spawnSync(pgCommand('pg_ctl'),['-D',data,'-m','fast','-w','-t','30','stop'],{windowsHide:true});else await stopChild(database);
 if(temporary&&!existsSync(join(data,'postmaster.pid'))){const before=await size(work);await rm(work,{recursive:true});error.cleanup={temporary:true,stopped:true,bytes_before:before,bytes_after:0,bytes_removed:before};}
 throw error;
 }
}
export async function waitFor(url,child){for(let n=0;n<100;n++){if(child?.exitCode!==null&&child?.exitCode!==undefined)throw Error('Service exited before ready');try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+url);}
