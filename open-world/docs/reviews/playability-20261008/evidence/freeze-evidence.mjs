import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root,pgCommand} from '../../../../tools/runtime.mjs';
import {sourceVersion} from '../../../../tools/source-version.mjs';
const out=resolve(root,'docs/reviews/playability-20261008/evidence'),session=JSON.parse(await readFile(out+'/session.json','utf8'));
const work=resolve(session.work),allowed=resolve(root,'.qa')+sep;if(!work.startsWith(allowed))throw Error('Owned temporary PG is outside workspace QA root');
const owner=JSON.parse(await readFile(work+'/owner.json','utf8'));if(owner.owner!==session.pid||owner.tool!=='open-world-runtime'||!owner.temporary)throw Error('QA ownership mismatch');
const source=await sourceVersion({diagnostics:true});await writeFile(out+'/source-end.json',JSON.stringify(source,null,2));
const audit=spawnSync(process.execPath,[out+'/audit-branches.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});if(audit.status!==0)throw Error(audit.stderr);console.log(audit.stdout.trim());
const services=[{phase:'new',dsn:session.dsn,schema:'public'},...JSON.parse(await readFile(out+'/sample-services.json','utf8')).filter(s=>s.phase==='late'),...JSON.parse(await readFile(out+'/sample-services-endfresh.json','utf8'))],backups=[];
for(const s of services){const uri=new URL(s.dsn),base=new URL(session.dsn);if(uri.hostname!==base.hostname||uri.port!==base.port||!(s.dsn===session.dsn||uri.pathname.startsWith('/playability_')))throw Error('Refusing a non-owned database');const path=out+'/final-'+s.phase+'.dump';
 const r=spawnSync(pgCommand('pg_dump'),['--dbname',s.dsn,'--format=custom',...(s.phase==='new'?['--schema=public']:[]),'--file',path],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr);
 const bytes=await readFile(path);backups.push({phase:s.phase,file:'final-'+s.phase+'.dump',schema:s.schema,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});console.log('BACKUP',s.phase,bytes.length);
}
await writeFile(out+'/final-backups.json',JSON.stringify({at:new Date().toISOString(),ownedWork:work,ownerPid:session.pid,backups},null,2));
await writeFile(out+'/stop-samples','Owned evidence captured; stop this acceptance sample APIs.');await writeFile(out+'/stop-endfresh','Owned evidence captured; stop this acceptance sample API.');
console.log('SAMPLE_STOP_REQUESTED; root PG host is retained until child hosts confirm exit.');
