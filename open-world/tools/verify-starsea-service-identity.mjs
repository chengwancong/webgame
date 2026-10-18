import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {windowsProcessInfo} from './windows-process-info.mjs';
import {root,processIdentity,processIdentityMatches,reapStale,stopChild} from './runtime.mjs';
const folder=join(root,'assets/starsea/integration/evidence');await mkdir(folder,{recursive:true});
const result={passed:false,checks:[]};let child;const runs=[];
async function run(record,label){const work=resolve(root,'.qa','starsea-identity-'+randomUUID());assert.equal(dirname(work),resolve(root,'.qa'));await mkdir(join(work,'data'),{recursive:true});await writeFile(join(work,'data/retained'),'probe');await writeFile(join(work,'owner.json'),JSON.stringify({tool:'open-world-runtime',temporary:true,owner:2147483647,data:join(work,'data'),api:record}));runs.push(work);const status=await reapStale({only:work});return {work,status,label};}
try{
 child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{cwd:root,stdio:'ignore',windowsHide:true});await new Promise(r=>setTimeout(r,100));
 const p=windowsProcessInfo(child.pid);assert(p.found);const legacy=p.created+' '+p.commandLine,current=processIdentity(child.pid);assert.equal(current,legacy);
 assert(processIdentityMatches(child.pid,{identity:legacy}));assert(processIdentityMatches(child.pid,{identity:p.createdExact+' '+p.path}));assert(!processIdentityMatches(child.pid,{identity:p.path}));assert(!processIdentityMatches(child.pid,{identity:'2000-01-01T00:00:00.0000000Z '+p.commandLine}));result.checks.push('legacy-commandline/new-scheme/in-flight-created-path-match; path-only and reused-PID time rejected');
 const mismatch=await run({pid:child.pid,identity:'wrong identity'},'live-unknown');assert(mismatch.status[0].retained);await access(join(mismatch.work,'data/retained'));assert(windowsProcessInfo(child.pid).found);result.checks.push('live mismatched API and run directory retained');
 const protectedRun=await run({pid:4,identity:'unreadable protected identity'},'unreadable');assert(protectedRun.status[0].retained);await access(join(protectedRun.work,'data/retained'));result.checks.push('unreadable live identity retains owned run without stopping its database');result.unreadable=protectedRun.status;
 const start=Date.now();assert.throws(()=>windowsProcessInfo(child.pid,'one',{timeoutMs:1}),/unavailable/);assert(Date.now()-start<2000);result.checks.push('native helper deadline produces explicit failure');
 const matching=await run({pid:child.pid,identity:legacy},'legacy-cleanup');assert(!matching.status[0].retained);await assert.rejects(access(matching.work));result.checks.push('real legacy API child terminated and exit confirmed before owned temporary run removal');
 assert.equal(windowsProcessInfo(2147483647).found,false);result.checks.push('nonexistent PID reports not-found');result.passed=true;
}catch(e){result.error=e.stack;process.exitCode=1;console.error(e);}finally{await stopChild(child);for(const work of runs){assert.equal(dirname(work),resolve(root,'.qa'));await rm(work,{recursive:true,force:true});}await writeFile(join(folder,'service-identity.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
