import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {root,processIdentity} from './runtime.mjs';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
import {windowsProcessInfo} from './windows-process-info.mjs';
const folder=process.argv[2]?join(root,process.argv[2]):join(root,'../docs/reviews/open-world/service-survival-20261002');await mkdir(folder,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function control(path='/status',method='GET'){const s=JSON.parse(await readFile(join(root,'.runtime/service/state.json'),'utf8'));assert.equal(s.root,root);return (await fetch(`http://127.0.0.1:${s.port}${path}`,{method,headers:{authorization:`Bearer ${s.token}`},signal:AbortSignal.timeout(2000)})).json();}
async function recovered(pid){const started=Date.now();for(let n=0;n<180;n++){try{const s=await control();if(s.phase==='running'&&s.pid!==pid){const h=await(await fetch('http://127.0.0.1:8612/api/health')).json();assert.equal(h.ok,true);return {pid:s.pid,components:s.components,versions:h.versions,recoveredMs:Date.now()-started};}}catch{}await delay(250);}throw Error('Supervisor did not recover');}
const result={passed:false};
try{
 const initial=await control();assert.equal(initial.phase,'running');const before=await persistenceSnapshot();
 const ancestors=windowsProcessInfo(initial.pid,'ancestors');
 assert(ancestors.some(a=>['svchost.exe','taskeng.exe','taskhostw.exe'].includes(a.name)),'Service was not launched by Windows scheduler');
 // Enabled marker stays present: even a clean zero-code exit must recover.
 await control('/stop','POST');const clean=await recovered(initial.pid),afterClean=await persistenceSnapshot(),cleanData=verifyPersistence(before,afterClean);
 const identity=processIdentity(clean.pid);assert(identity&&identity===processIdentity(clean.pid),'Service process identity changed before termination');assert.equal((await control()).pid,clean.pid);process.kill(clean.pid,'SIGTERM');const forced=await recovered(clean.pid),afterForced=await persistenceSnapshot(),forcedData=verifyPersistence(afterClean,afterForced);
 Object.assign(result,{passed:true,ancestors,cleanExitRecovery:clean,forcedExitRecovery:forced,before:persistenceSummary(before),after:persistenceSummary(afterForced),cleanData,forcedData,persistentDataPreserved:true});console.log(JSON.stringify({passed:true,cleanRecoveryMs:clean.recoveredMs,forcedRecoveryMs:forced.recoveredMs,persistentDataPreserved:true,cleanData,forcedData}));
}catch(e){result.error=e.stack;process.exitCode=1;console.error(e.message);}finally{await writeFile(join(folder,'result.json'),JSON.stringify(result,null,2));}
