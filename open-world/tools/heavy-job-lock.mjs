import {open,readFile,unlink,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const heavyLockPath=fileURLToPath(new URL('../.runtime/heavy-job.lock',import.meta.url));
/** Exclusive creation is the queue boundary. An existing lock is never removed
 * by a waiting session, even if its owner appears absent. */
export async function acquireHeavyJob({session,job,lockPath=heavyLockPath,onWait=()=>{},pollMs=1000}){
 if(!session||!job||!Number.isFinite(pollMs)||pollMs<100)throw Error('Heavy job requires session, job and a positive queue interval');
 await mkdir(dirname(lockPath),{recursive:true});const token=randomUUID();let lastOwner;
 for(;;){
  let handle;
  try{handle=await open(lockPath,'wx');const owner={session,job,startedAt:new Date().toISOString(),pid:process.pid,token};await handle.writeFile(JSON.stringify(owner,null,2)+'\n');await handle.close();return {owner,path:lockPath,release:async()=>{const current=JSON.parse(await readFile(lockPath,'utf8'));if(current.token!==token)throw Error('Heavy job lock ownership changed; refusing to remove another session lock');await unlink(lockPath);}};}
  catch(error){if(handle){await handle.close().catch(()=>{});throw error;}if(error.code!=='EEXIST')throw error;}
  let owner;try{owner=await readFile(lockPath,'utf8');}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(owner!==lastOwner){lastOwner=owner;onWait(owner);}
  await new Promise(resolve=>setTimeout(resolve,pollMs));
 }
}
export async function withHeavyJob(options,work){const lock=await acquireHeavyJob(options);try{return await work(lock.owner);}finally{await lock.release();}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),split=args.indexOf('--'),get=name=>{const n=args.indexOf(name);return n<0?undefined:args[n+1];};
 if(split<0||!args[split+1])throw Error('Use --session NAME --job DESCRIPTION -- executable arguments');
 const session=get('--session'),job=get('--job'),command=args.slice(split+1);
 const code=await withHeavyJob({session,job,onWait:owner=>process.stdout.write('Waiting for heavy-job.lock: '+owner.trim()+'\n')},()=>new Promise((resolve,reject)=>{const child=spawn(command[0],command.slice(1),{stdio:'inherit',windowsHide:true});child.once('error',reject);child.once('exit',(code,signal)=>resolve(code??(signal?1:0)));}));
 process.exitCode=code;
}
