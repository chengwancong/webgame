import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateStarsea,starseaRoot} from './validate-starsea-assets.mjs';
const allowMissing=process.argv.includes('--allow-missing');
if(process.argv.includes('--props')){const r=spawnSync(process.execPath,['assets/starsea/props/build.mjs'],{cwd:starseaRoot,stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status??1);}
const {summary,groups,requirement}=await validateStarsea({allowMissing});
if(summary.errors.length||(!allowMissing&&summary.missingGroups.length))throw Error('Starsea validation failed: '+summary.errors.join('\n'));
const publicRoot=join(starseaRoot,'apps/web/public/art/starsea');await mkdir(publicRoot,{recursive:true});
const assets=groups.flatMap(({group,manifest})=>manifest.assets.map(a=>({id:a.id,name:a.name,type:a.type,group,chapters:a.chapters,source:{mode:a.source.mode,path:a.source.path,sha256:a.source.sha256,nativeVersion:a.source.nativeVersion},runtime:a.runtime,actions:a.actions,states:a.states,dependencies:a.dependencies,status:a.status,phaseComponents:a.phaseComponents,notes:Array.isArray(a.notes)?a.notes:a.notes?[typeof a.notes==='string'?a.notes:JSON.stringify(a.notes)]:[]})));
const ledger=JSON.parse(await readFile(join(starseaRoot,'docs/starsea/resource-ledger.json'),'utf8'));
const rootRows=new Map(ledger.assets.map(a=>[a.id,a]));
const matchingReview=ledger.designVersion===requirement.version&&ledger.assets.length===assets.length&&assets.every(a=>rootRows.has(a.id));
const accepted=matchingReview&&assets.every(a=>rootRows.get(a.id).accepted===true);
for(const asset of assets){const r=rootRows.get(asset.id);asset.rootReview={status:matchingReview?r.status:'root-pending',accepted:matchingReview&&r.accepted===true,checks:matchingReview?r.checks:{},issues:matchingReview?r.issues:[]};}
for(const group of groups)await copyFile(join(starseaRoot,group.path),join(publicRoot,group.group,'manifest.json'));
const manifest={schemaVersion:1,campaignId:requirement.campaignId,designVersion:requirement.version,version:'starsea-20261003-package-v1',status:(accepted?'resource-accepted':'resource-delivery')+'; story-not-connected',acceptance:accepted?'resource-accepted':'root-pending',rootReview:{file:'docs/starsea/resource-ledger.json',designVersion:ledger.designVersion,matchingReview,accepted},counts:summary.groups,total:assets.length,groups:groups.map(g=>({id:g.group,file:'/art/starsea/'+g.group+'/manifest.json',sha256:g.sha256,version:g.manifest.version})),assets,limitations:['QA page is a read-only resource review and writes no campaign, wallet or player state.','Current formal campaign and rule/protocol/db versions retain their behavior.','Producer self-review and root independent acceptance are separate.']};
await mkdir(join(starseaRoot,'packages/asset-manifest'),{recursive:true});await writeFile(join(starseaRoot,'packages/asset-manifest/starsea.v1.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(publicRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({package:manifest.version,assets:assets.length,...summary}));
