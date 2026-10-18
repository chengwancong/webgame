import {readFile,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {root,pgCommand,processIdentityMatches} from './runtime.mjs';

function alive(pid){try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}}
// Only remove a dead server's generated PID file in this project's owned cluster.
// PostgreSQL performs its own WAL recovery; data and socket files are not deleted.
export async function recoverDevelopmentPid(){
 if(process.env.AW_DATABASE_URL)return;
 const work=join(root,'.runtime','dev'),data=join(work,'data'),pidfile=join(data,'postmaster.pid');
 let info;try{info=await lstat(pidfile);}catch(e){if(e.code==='ENOENT')return;throw e;}
 for(const path of [join(root,'.runtime'),work,data,pidfile])if((await lstat(path)).isSymbolicLink())throw Error('Refusing symlink database recovery');
 if(!info.isFile())throw Error('Unexpected database PID file');
 const owner=JSON.parse(await readFile(join(work,'owner.json'),'utf8'));
 const lines=(await readFile(pidfile,'utf8')).split('\n'),pid=Number(lines[0]);
 const samePath=(a,b)=>process.platform==='win32'?a?.replaceAll('\\','/').toLowerCase()===b?.replaceAll('\\','/').toLowerCase():a===b;
 if(owner.tool!=='open-world-runtime'||owner.temporary!==false||!samePath(owner.data,data)||!samePath(lines[1]?.trim(),data)||!Number.isInteger(pid)||pid<=1)throw Error('Database ownership cannot be verified; retained PID file');
 if(Number.isInteger(owner.owner)&&alive(owner.owner))throw Error('Development runtime is still running; retained PID file');
 if(process.platform==='win32')for(const component of ['api','web','preview']){
  const previous=owner[component];
  if(previous&&alive(previous.pid)){
   if(!previous.identity||!processIdentityMatches(previous.pid,previous))throw Error('Live '+component+' identity cannot be verified; data and process retained');
   process.kill(previous.pid,'SIGTERM');
   for(let n=0;n<100&&alive(previous.pid);n++)await new Promise(r=>setTimeout(r,100));
   if(alive(previous.pid))throw Error('Orphaned '+component+' could not be stopped');
  }
 }
 if(alive(pid)){
  if(process.platform!=='win32'||owner.database!==pid)throw Error('Development database is already running; stop its existing owner first');
  const stopped=spawnSync(pgCommand('pg_ctl'),['-D',data,'-m','fast','-w','-t','30','stop'],{encoding:'utf8',windowsHide:true});
  if(stopped.status!==0)throw Error('Orphaned owned database could not be stopped: '+stopped.stderr);
  console.log('Stopped orphaned development database; retained all data.');return;
 }
 await unlink(pidfile);
 console.log('Removed dead development database PID file; retained all data.');
}
