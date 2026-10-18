import {open,readFile,unlink,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const [session,job,...args]=process.argv.slice(2),lock='.runtime/heavy-job.lock';
if(!session||!job||!args.length)throw Error('Expected session, job and child arguments');
await mkdir('.runtime',{recursive:true});const record={session,job,startedAt:new Date().toISOString(),pid:process.pid,token:randomUUID()};let file;
try{file=await open(lock,'wx');}catch(error){if(error.code!=='EEXIST')throw error;console.log('HEAVY_JOB_BUSY '+await readFile(lock,'utf8'));process.exit(75);}
try{await file.writeFile(JSON.stringify(record,null,2));await file.close();const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});}
finally{const current=JSON.parse(await readFile(lock,'utf8'));if(current.token!==record.token)throw Error('Heavy-job lock ownership changed; retained');await unlink(lock);}
