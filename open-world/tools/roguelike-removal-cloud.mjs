// Archive/transport only. All numerical execution is the existing spine command in an
// isolated cloud worker. Completed phases are retrieved without running their command again.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {removalArchiveAllowed,removalCloudPhase,removalCloudPlan,removalCloudRoot,removalCloudOutput,removalCloudStatusCommand,validateRemovalManifest} from './roguelike-removal-cloud.ts';

const phase=removalCloudPhase(process.argv.slice(2)),project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(project,'..');
const out='G:/webgame/aw-deploy/roguelike-removal-20261024',artifacts=join(out,'transport',phase);
const ssh=process.platform==='win32'?'C:/Program Files/Git/usr/bin/ssh.exe':'ssh',scp=process.platform==='win32'?'C:/Program Files/Git/usr/bin/scp.exe':'scp';
const capture=(command,args,options={})=>execFileSync(command,args,{cwd:repo,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe'],...options}).trim();
const run=(command,args)=>execFileSync(command,args,{cwd:repo,windowsHide:true,stdio:['ignore','inherit','inherit']});
const sha=value=>createHash('sha256').update(value).digest('hex');
const head=capture('git',['rev-parse','HEAD']);assert(/^[0-9a-f]{40}$/.test(head),'Invalid committed HEAD');
const readStatus=current=>JSON.parse(capture(ssh,['abyss-staging',removalCloudStatusCommand(current)]));
mkdirSync(out,{recursive:true});
const download=manifest=>{
 for(const file of manifest.files){
  const path=join(out,file.name);run(scp,[`abyss-staging:${removalCloudRoot}/source/open-world/${removalCloudOutput}/${file.name}`,path]);
  const raw=readFileSync(path);assert.equal(raw.length,file.bytes,'Output size differs');assert.equal(sha(raw),file.sha256,'Output transfer checksum differs');
  assert.equal(JSON.parse(raw.toString('utf8')).commit,manifest.commit,'Output source differs');
 }
};
const verifyLocal=manifest=>{
 if(manifest.phase==='derive'){
  const plan=JSON.parse(readFileSync(join(out,'removal-plan.json'),'utf8')),summary=JSON.parse(readFileSync(join(out,'derive-summary.json'),'utf8'));
  assert.equal(plan.kind,'roguelike-removal-v1');assert.equal(summary.planHash,sha(JSON.stringify(plan)),'Plan semantic hash differs');assert.equal(summary.commit,plan.commit);
 }else{
  const summary=JSON.parse(readFileSync(join(out,'verify-summary.json'),'utf8'));
  assert(['removal-plan.json','corrected-removal-plan.json'].includes(summary.planSource),'Unknown verified plan source');
  const plan=JSON.parse(readFileSync(join(out,summary.planSource),'utf8'));
  const original=JSON.parse(readFileSync(join(out,'removal-plan.json'),'utf8'));
  assert.equal(summary.originalPlanHash,sha(JSON.stringify(original)),'Original sampling plan differs');
  if(summary.planSource==='corrected-removal-plan.json'){
   const repair=JSON.parse(readFileSync(join(out,'plan-repair.json'),'utf8'));
   assert.equal(repair.originalPlanHash,summary.originalPlanHash);assert.equal(repair.correctedPlanHash,sha(JSON.stringify(plan)));assert.equal(repair.additionalMeasurements,0);
  }
  assert.equal(summary.planHash,sha(JSON.stringify(plan)),'Verified plan differs');assert.equal(summary.appliedHash,plan.afterHash,'Applied dungeon hash differs');assert.equal(summary.completed,true);
 }
};
function retrieve(manifest,reused){
 if(phase==='verify'&&!existsSync(join(out,'removal-plan.json'))){const original=validateRemovalManifest(readStatus('derive'),'derive');download(original);verifyLocal(original);}
 download(manifest);verifyLocal(manifest);
 writeFileSync(join(out,phase+'-transport-summary.json'),JSON.stringify({...manifest,reused,requestedHead:head},null,2)+'\n');
 console.log(JSON.stringify({phase,source:manifest.commit,requestedHead:head,reused,files:manifest.files.map(f=>f.name),output:out,raw:'retained in the isolated cloud output directory'}));
}
const status=readStatus(phase);
if(status.status==='complete'){
 retrieve(validateRemovalManifest(status,phase),true);
}else{
 assert.equal(status.status,'new',`${phase} already started; inspect the cloud phase log/summary without rerunning it`);
 if(phase==='verify')assert.equal(readStatus('derive').status,'complete','Derive must finish before verification');
 mkdirSync(artifacts,{recursive:true});
 const archive=join(artifacts,head+'.tgz'),script=join(artifacts,head+'.sh'),index=join(artifacts,randomUUID()+'.index');
 const env={...process.env,GIT_INDEX_FILE:index},git=(args,input)=>capture('git',args,{env,input});
 let kept;
 try{
  git(['read-tree',head]);
  const all=git(['ls-tree','-r','--name-only','-z',head]).split('\0').filter(Boolean);kept=all.filter(removalArchiveAllowed);
  assert(kept.includes('open-world/tools/spine/roguelike-removal.ts'),'Committed removal implementation missing');
  assert(kept.includes('open-world/deploy/Dockerfile'),'Worker Dockerfile missing');
  const excluded=all.filter(file=>!removalArchiveAllowed(file));if(excluded.length)git(['update-index','--force-remove','-z','--stdin'],excluded.join('\0')+'\0');
  const tree=git(['write-tree']);git(['archive','--format=tar.gz','--output='+archive,tree]);
 }finally{rmSync(index,{force:true});rmSync(index+'.lock',{force:true});}
 const archiveSha256=sha(readFileSync(archive)),plan=removalCloudPlan({phase,head,sha256:archiveSha256});writeFileSync(script,plan.remoteScript);
 run(ssh,['abyss-staging',plan.prepare]);run(scp,[archive,`abyss-staging:${plan.archive}`]);run(scp,[script,`abyss-staging:${plan.script}`]);
 console.log(JSON.stringify({phase,source:head,sourceFiles:kept.length,archiveSha256,execution:'cloud-pnpm-spine-check',cpu:1,memoryMiB:1536}));
 const manifest=validateRemovalManifest(JSON.parse(capture(ssh,['abyss-staging',`sh '${plan.script}'`])),phase,head);
 retrieve(manifest,false);
}
