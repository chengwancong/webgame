// Local orchestration only: archive committed source, SSH, and retrieve the small summary.
// Simulation imports and all 100 encounters execute exclusively in the isolated cloud container.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tacticalBaselineArchivePaths,tacticalBaselineRound,tacticalBaselineCloudPlan} from './tactical-baseline-cloud.ts';

const round=tacticalBaselineRound(process.argv.slice(2)),project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(project,'..');
const ssh=process.platform==='win32'?'C:/Program Files/Git/usr/bin/ssh.exe':'ssh';
const scp=process.platform==='win32'?'C:/Program Files/Git/usr/bin/scp.exe':'scp';
const capture=(command,args)=>execFileSync(command,args,{cwd:repo,encoding:'utf8',windowsHide:true,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const run=(command,args)=>execFileSync(command,args,{cwd:repo,windowsHide:true,stdio:['ignore','inherit','inherit']});
const head=capture('git',['rev-parse','HEAD']);
if(!/^[0-9a-f]{40}$/.test(head))throw Error('Invalid committed HEAD.');
const out=resolve(project,'.qa/tactical-b1/baseline'),artifacts=resolve(project,'.qa/tactical-b1/cloud',round),summaryPath=resolve(out,`${round}-summary.json`);
if(existsSync(summaryPath))throw Error('Local summary already exists; this round must not run again.');
mkdirSync(out,{recursive:true});mkdirSync(artifacts,{recursive:true});
const archive=resolve(artifacts,`${head}.tgz`),script=resolve(artifacts,`${head}.sh`);
run('git',['archive','--format=tar.gz','--output='+archive,head,...tacticalBaselineArchivePaths]);
const sha256=createHash('sha256').update(readFileSync(archive)).digest('hex');
const plan=tacticalBaselineCloudPlan({round,head,sha256});
writeFileSync(script,plan.remoteScript,{encoding:'utf8'});
run(ssh,['abyss-staging',plan.prepare]);
run(scp,[archive,`abyss-staging:${plan.archive}`]);
run(scp,[script,`abyss-staging:${plan.script}`]);
console.log(JSON.stringify({round,source:head,archiveSha256:sha256,execution:'isolated-cloud-container',cpu:1,memoryMiB:1024}));
// No process timeout or retry: an interrupted connection does not authorize a second run.
const result=capture(ssh,['abyss-staging',`sh '${plan.script}'`]);
const expectedHash=result.split(/\s+/)[0];
if(!/^[0-9a-f]{64}$/.test(expectedHash))throw Error('Cloud did not return a valid summary checksum; inspect the fixed run directory without restarting it.');
run(scp,[`abyss-staging:${plan.summary}`,summaryPath]);
const bytes=readFileSync(summaryPath);
if(createHash('sha256').update(bytes).digest('hex')!==expectedHash)throw Error('Downloaded summary checksum mismatch; do not restart the measurement.');
const summary=JSON.parse(bytes.toString('utf8'));
if(summary.round!==round||summary.source!==head||summary.n!==100||!Array.isArray(summary.groups)||summary.groups.length!==10)throw Error('Unexpected cloud summary identity or sample count; do not restart the measurement.');
console.log(JSON.stringify({round,source:head,n:summary.n,groups:summary.groups.length,summaryPath,raw:'retained in the isolated cloud run directory'}));
