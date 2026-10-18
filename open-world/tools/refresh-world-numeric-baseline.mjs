// 数值来源已迁到 tools/spine；本文件保留历史探针，正式派生请使用 pnpm spine:check 与主干CLI。
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withHeavyJob} from './heavy-job-lock.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),directory=resolve(root,'docs/reviews/open-world-m2-m4/W3');
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];},session=value('--session')??'numeric-01a11514',python=value('--python');
if(!python)throw Error('Pass --python with the verified Python executable, not the WindowsApps python3 alias');
const report={startedAt:new Date().toISOString(),session,passed:false,jobs:[],formalConfigurationWritten:false};
await withHeavyJob({session,job:'W3 standard360 + AOE60 + sources72 + numeric proposals',onWait:owner=>process.stdout.write('Waiting for shared heavy queue: '+owner.trim()+'\n')},async owner=>{
 report.lockOwner=owner;await mkdir(directory,{recursive:true});const archive=resolve(directory,'baseline-before-'+Date.now());await mkdir(archive);
 report.state='running';await writeFile(resolve(directory,'latest-baseline-refresh.json'),JSON.stringify(report,null,2)+'\n');
 for(const [source,target]of [['.design/standard-player-20261005/model.json','model.json'],['.design/numeric-flow-20261006/flow.json','flow.json'],['docs/reviews/open-world-m2-m4/W3/key-source-basis.json','key-source-basis.json']])await copyFile(resolve(root,source),resolve(archive,target));report.archive=archive;
 const commands=[
  ['standard-schedule',process.execPath,['--import','tsx','tools/standard-player-model.ts']],
  ['standard-world',process.execPath,['--import','tsx','tools/measure-build-variety-standard.ts','docs/reviews/open-world-m2-m4/W3/latest-standard']],
  ['stage-primary-hits',process.execPath,['--import','tsx','tools/measure-stage-aoe-hits.ts']],
  ['source-frequency',process.execPath,['--import','tsx','tools/measure-stage-key-sources.ts']],
  ['numeric-flow',python,['-X','utf8','tools/numeric-flow-sim.py','--markdown']],
  ['monster-proposal',process.execPath,['--import','tsx','tools/apply-monster-curve.ts']],
  ['tier-and-key-proposals',process.execPath,['--import','tsx','tools/propose-world-numeric-refresh.ts']],
 ];
 for(const [name,executable,arguments_]of commands){
  const startedAt=new Date().toISOString(),logPath=resolve(root,'.runtime','world-w3-refresh-'+name+'.log'),log=await import('node:fs').then(fs=>fs.openSync(logPath,'w'));
  let code;try{const child=spawn(executable,arguments_,{cwd:root,stdio:['ignore',log,log],windowsHide:true});code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}finally{(await import('node:fs')).closeSync(log);}
  report.jobs.push({name,startedAt,endedAt:new Date().toISOString(),code,log:logPath});process.stdout.write(JSON.stringify({job:name,code,log:logPath})+'\n');if(code!==0)throw Error('Numeric refresh failed at '+name+'; preserve log and earlier reports');
 }
 const modelPath=resolve(root,'.design/standard-player-20261005/model.json'),flowPath=resolve(root,'.design/numeric-flow-20261006/flow.json'),modelBytes=await readFile(modelPath),flow=JSON.parse(await readFile(flowPath,'utf8')),hash=createHash('sha256').update(modelBytes).digest('hex');
 if(flow.modelSha256!==hash)throw Error('Refreshed numeric flow does not match measured model');report.modelSha256=hash;report.versions=flow.versions;const proposal=JSON.parse(await readFile(resolve(directory,'numeric-refresh/proposal.json'),'utf8'));report.proposalAdoption={tier4Valid:proposal.tier4.valid,keyPools:proposal.keyPools.changes.length};report.passed=true;
}).catch(error=>{report.error=String(error);process.exitCode=1;});
report.state=report.passed?'completed':'failed';report.endedAt=new Date().toISOString();await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'latest-baseline-refresh.json'),JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({passed:report.passed,versions:report.versions,proposalAdoption:report.proposalAdoption,error:report.error})+'\n');
