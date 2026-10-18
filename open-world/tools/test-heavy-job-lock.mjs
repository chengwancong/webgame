import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {acquireHeavyJob,withHeavyJob} from './heavy-job-lock.mjs';
const directory=await mkdtemp(fileURLToPath(new URL('../.runtime/heavy-lock-test-',import.meta.url))),lockPath=join(directory,'test.lock');
try{
 const first=await acquireHeavyJob({session:'test-first',job:'exclusive',lockPath});assert.equal(JSON.parse(await readFile(lockPath,'utf8')).session,'test-first');
 let notified;const queued=acquireHeavyJob({session:'test-second',job:'queued',lockPath,pollMs:100,onWait:owner=>{notified=owner;}});
 await new Promise(resolve=>setTimeout(resolve,20));assert.match(notified,/test-first/);assert.equal(JSON.parse(await readFile(lockPath,'utf8')).token,first.owner.token);await first.release();const second=await queued;assert.equal(JSON.parse(await readFile(lockPath,'utf8')).session,'test-second');
 await writeFile(lockPath,JSON.stringify({token:'other-fixture-owner'}));await assert.rejects(()=>second.release(),/ownership changed/);assert.equal(JSON.parse(await readFile(lockPath,'utf8')).token,'other-fixture-owner');
 await writeFile(lockPath,JSON.stringify(second.owner));await second.release();
 await assert.rejects(()=>withHeavyJob({session:'test-error',job:'finally',lockPath},async()=>{throw Error('expected work failure');}),/expected work failure/);await assert.rejects(()=>readFile(lockPath,'utf8'),error=>error.code==='ENOENT');
 console.log(JSON.stringify({passed:true,checks:['exclusive creation','second owner queues','foreign ownership retained','finally releases on work failure']}));
}finally{await rmdir(directory);}
