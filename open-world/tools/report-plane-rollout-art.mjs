import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {rolloutItems,statePrompt} from '../assets/open-world/plane-kits/rollout-spec.mjs';
import {propItems} from '../assets/open-world/plane-kits/props-contract-spec.mjs';
const root=resolve(import.meta.dirname,'..'),manifest=JSON.parse(await readFile(resolve(root,'packages/asset-manifest/open-world-planes.v1.json'),'utf8'));
const batches={};for(const batch of ['R1','R2','R3','R4','R6']){const items=rolloutItems.filter(p=>p.batch===batch),done=items.filter(p=>manifest.assets.find(a=>a.id===p.id)?.rolloutBatch===batch);batches[batch]={plannedIds:items.length,importedIds:done.length,stateImages:done.reduce((n,p)=>n+p.states.length,0),newRasterSources:batch==='R2'?0:done.reduce((n,p)=>n+p.states.length,0),reusedRasterSources:batch==='R2'?done.length:0};}
const planned=new Set(rolloutItems.map(p=>p.id)),prior=new Set(propItems.map(p=>p.id));
const unresolved=rolloutItems.filter(p=>manifest.assets.find(a=>a.id===p.id)?.rolloutBatch!==p.batch).map(p=>p.id);
const legacy=manifest.assets.filter(a=>!planned.has(a.id)&&!prior.has(a.id)&&a.baseId!=='ow-art-plane-entry-portal-base'&&a.kind!=='spine-fx');
let browser=[];try{browser=JSON.parse(await readFile(resolve(root,'docs/reviews/plane-art-20261018/rollout-browser.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const views=[...new Map(browser.map(v=>[v.batch+'/'+v.kit+'/'+v.island,v])).values()];
const summary={batches,priorPropIds:19,portalMaterialReferences:manifest.assets.filter(a=>a.baseId==='ow-art-plane-entry-portal-base').length,unresolved,legacyOptionalIds:legacy.length,browser:{uniqueBatchViews:views.length,errors:views.flatMap(v=>v.errors),urls:views.map(v=>({batch:v.batch,url:v.url}))}};
await writeFile(resolve(root,'docs/reviews/plane-art-20261018/rollout-summary.json'),JSON.stringify(summary,null,2)+'\n');
await writeFile(resolve(root,'assets/open-world/plane-kits/rollout-queue.json'),JSON.stringify({schemaVersion:1,items:rolloutItems.map(p=>({id:p.id,batch:p.batch,states:p.states,sources:p.sources,prompts:Object.fromEntries(p.states.map(s=>[s,statePrompt(p,s)]))}))},null,2)+'\n');
const lines=['# 位面美术缺口（R1–R6铺量）','','本轮必做R1–R5与R6非阻塞项分开统计。当前场景中的灰盒替换数量以rollout-summary.json与正式清单为准。','',`本轮规划148个ID，未完成 ${unresolved.length} 个：`,...unresolved.map(id=>'- `'+id+'`'),'',`R6其余可选/未用资源 ${legacy.length} 个，以下保留历史图或占位，未冒称通过第三版视觉审核。主要原因：vault旧远景含天空需重出；rift缺少新原图；旧未用墙/交互件尚未统一第三版体量与多态；其余秘门/首领门/界石及其材质引用尚待出图。这些不进入当前163项随机场地的取图图谱。`,'','| ID | 历史登记状态 | 本轮处理 |','|---|---|---|',...legacy.map(a=>`| ${a.id} | ${a.status} | 保留；R6后续视觉审核/重画 |`),'','历史特效选片6用途仍未完成，属于旧总包A5，不计入本轮R1–R6新增图数量。',''];
await writeFile(resolve(root,'docs/reviews/plane-art-20261018/art-gaps.md'),lines.join('\n'));
console.log(JSON.stringify({batches,unresolved:unresolved.length,legacyOptionalIds:legacy.length,browserErrors:summary.browser.errors.length}));
