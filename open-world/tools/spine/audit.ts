import {readFile,writeFile} from 'node:fs/promises';
import {benchPlayer,type ResolvedPlayer} from './bench.ts';
import {standardState,resolvePlayer} from './player.ts';
import {measured} from './measure.ts';
import {contentItems,inject,scaledPrimary,type ContentItem} from './content.ts';
import {buildVarietyProfiles,assembleBuildVariety} from '../build-variety-builds.ts';
import {statRegistry} from '../../packages/contracts/stats.ts';
import {gearAffixConfig,maxAffixTierForItemLevel} from '../../packages/rules/affix-generator.ts';
import {stageForItemLevel} from '../../packages/rules/item-power.ts';
import {newAspects} from '../../packages/content/aspects.ts';
import {setEffects} from '../../packages/content/set-effects.ts';
import {talentDefinitions} from '../../packages/content/deep-progression.ts';
import {pacingWeights} from '../../packages/content/pacing-targets.ts';
import {foldZones} from '../../packages/rules/damage-zones.ts';
import {skillTags} from '../../packages/content/skill-tags.ts';
import {skillCatalog} from '../../packages/content/index.ts';
import {skillWeaponAllowed} from '../../packages/rules/skill-weapon-access.ts';
import {mapBench,median,spineScenes,type BenchMetrics,type SpineAnchor} from './math.ts';
import {save,readJson,evidence,stamp,review,data,decision} from './io.ts';
import type {CharacterState} from '../../packages/contracts/index.ts';
/** 纯功能技能没有输出时，两个实测零轴的相对贡献为零；不虚构正伤害。 */
export function contribution(full:BenchMetrics,base:BenchMetrics,anchor:SpineAnchor){
 const safe=(m:BenchMetrics)=>({...m,D1:m.D1||1,DN:m.DN||1,B3:m.B3||1}),f=mapBench(safe(full),anchor),b=mapBench(safe(base),anchor);
 const axes=Object.fromEntries(spineScenes.map(s=>[s,Math.log(f[s]/b[s])]));return {axes,P:spineScenes.reduce((n,s)=>n+pacingWeights[s]*axes[s],0)};
}
async function measurePair(output:string,id:string,full:ResolvedPlayer,base:ResolvedPlayer,hp:number,seeds=[41]){
 const a=await measured(output,id+'-full',full,hp,seeds),b=await measured(output,id+'-without',base,hp,seeds);return {a,b};
}
export async function measureWeights(output=review+'/S2'){
 const core=await readJson(review+'/S2/core-summary.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor,rows=[];
 const used=new Set<string>([...gearAffixConfig.pool.map(x=>x.stat),...gearAffixConfig.mainStats.map(x=>x.stat),...talentDefinitions.flatMap(t=>t.modifiers.map(m=>m.stat)),...setEffects.flatMap(s=>[...s.two.stats,...s.four.stats].map(m=>m.stat)),...newAspects.flatMap(a=>a.parts.stats.map(m=>m.stat))]);
 for(const level of [20,35,50]){
  const state=standardState(level),base=resolvePlayer('weights-'+level,state),hp=base.build.stats.hp,b=await measured(output,'weights-'+level+'-base',base,hp,[41,42,43]);
  for(const def of statRegistry.filter(s=>used.has(s.id))){
   const pool=gearAffixConfig.pool.filter(a=>a.stat===def.id&&a.tier===maxAffixTierForItemLevel(level)),fallback=gearAffixConfig.pool.filter(a=>a.stat===def.id),values=(pool.length?pool:fallback).map(a=>(a.minValue+a.maxValue)/2*(def.stageScaled?stageForItemLevel(level).scale:1));
   const delta=values.length?median(values):def.unit==='ratio'?.05:def.unit==='seconds'?.5:1;
   const changed=structuredClone(state);changed.gear[0].affixes.push({id:'spine-stat-'+def.id,name:def.name,stat:def.id,value:delta,tier:1,description:'属性配对测量'});
   const player=resolvePlayer('weights-'+level+'-'+def.id,changed),a=await measured(output,player.id,player,hp,[41,42,43]),effect=contribution(a.metrics,b.metrics,anchor);
   rows.push({level,stat:def.id,delta,deltaSource:values.length?'同物品等级档中位词缀':'该属性没有词缀行，采用设计步长',weights:Object.fromEntries(Object.entries(effect.axes).map(([s,n])=>[s,n/delta])),powerWeight:effect.P/delta,before:b.metrics,after:a.metrics,source:await evidence(output+'/arms/'+player.id+'.json')});
  }
 }
 await save(output+'/stat-weights.json',{...stamp(),rows});await save(data+'/stat-weights.json',{...stamp(),rows:rows.map(({source,before,after,...r})=>r)});return rows;
}
export async function measureSources(output=review+'/S2'){
 const core=await readJson(review+'/S2/core-summary.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor,rows=[];
 const hosts=[...[20,35,50].map(level=>({id:'standard-'+level,state:standardState(level),augments:[] as string[]})),...buildVarietyProfiles.map(p=>({id:p.id,state:assembleBuildVariety(p).state,augments:[p.preferredAugment]}))];
 for(const host of hosts){
  const state=host.state,hp=core.standards.find((r:any)=>r.level===state.level)?.hp??core.standards.find((r:any)=>r.level===50).hp;
  const full=resolvePlayer(host.id,state,host.augments),a=await measured(output,'source-'+host.id+'-full',full,hp,[41,42,43]);
  const arms:{id:string;state:CharacterState;augments:string[]}[]=[];
  const add=(id:string,change:(s:CharacterState)=>void,augs=host.augments)=>{const s=structuredClone(state);change(s);arms.push({id,state:s,augments:augs});};
  add('aspects',s=>{for(const g of s.gear)delete g.aspectId;});
  // setEffects是解析器实际读取的目录；在每个配对的resolve期间精确消融，之后立即恢复。
  add('augments',()=>{},[]);
  for(const tree of ['damage','defense','support','special'])add('talent-'+tree,s=>{if(s.progression)for(const t of talentDefinitions.filter(t=>t.branch===tree))delete s.progression.talents[t.id];});
  add('paragon',s=>{if(s.progression){s.progression.paragon=[];s.progression.glyphSlots={};}});
  add('inscriptions',s=>{for(const g of s.gear)delete g.inscription;});
  for(const skill of state.skills)add('rank-'+skill,s=>{s.skillRanks[skill]=1;});
  for(const arm of arms){const preserve=arm.id==='aspects'&&!arm.state.skills.every(s=>skillWeaponAllowed(arm.state,s)),selection=preserve?{withoutAspects:state.gear.flatMap(g=>g.aspectId?[g.aspectId]:[])}:{},p=resolvePlayer(host.id+'-'+arm.id,preserve?structuredClone(state):arm.state,arm.augments,selection),b=await measured(output,'source-'+p.id,p,hp,[41,42,43]);rows.push({host:host.id,level:state.level,source:arm.id,preservedWeaponAccess:preserve,...contribution(a.metrics,b.metrics,anchor),before:a.metrics,without:b.metrics,raw:await evidence(output+'/arms/source-'+p.id+'.json')});}
  for(const part of ['two','four'] as const){const saved=setEffects.map(s=>s[part]);setEffects.forEach(s=>{s[part]={stats:[],atoms:[],rules:[],zones:[],conditional:[]};});let p;try{p=resolvePlayer(host.id+'-set-'+part,structuredClone(state),host.augments);}finally{setEffects.forEach((s,i)=>{s[part]=saved[i];});}const b=await measured(output,'source-'+p.id,p,hp,[41,42,43]);rows.push({host:host.id,level:state.level,source:'set-'+part,...contribution(a.metrics,b.metrics,anchor),before:a.metrics,without:b.metrics,raw:await evidence(output+'/arms/source-'+p.id+'.json')});}
  const p=resolvePlayer(host.id+'-affinity',structuredClone(state),host.augments),bld=structuredClone(p.build),oldZones=bld.stats.zones??[],zones=oldZones.filter(z=>z.id!=='weapon-affinity');
  for(const s of bld.skills){const tags=skillTags({...s,category:skillCatalog.find(x=>x.id===s.id)!.category}),ratio=foldZones(zones,tags).damageMult/foldZones(oldZones,tags).damageMult;s.damage=Math.round(s.damage*ratio);for(const status of s.mechanics?.statuses??[])if(status.total!==undefined)status.total=Math.round(status.total*ratio);}
  bld.stats.zones=zones;Object.assign(bld.stats,foldZones(zones));
  const b=await measured(output,'source-'+host.id+'-affinity',{...p,build:bld},hp,[41,42,43]);rows.push({host:host.id,level:state.level,source:'affinity',...contribution(a.metrics,b.metrics,anchor),before:a.metrics,without:b.metrics,raw:await evidence(output+'/arms/source-'+host.id+'-affinity.json')});
  await save(output+'/sources.json',{...stamp(),rows});
 }
 await save(data+'/sources.json',{...stamp(),rows:rows.map(({before,without,raw,...r})=>r)});return rows;
}
export async function measureContent(output=review+'/S2',derive=true){
 const core=await readJson(review+'/S2/core-summary.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor,hp=core.standards.find((r:any)=>r.level===50).hp,rows=[],items=await contentItems();let skillElasticityCount=0;
 for(const item of items){
  const pair=item.make(),{a,b}=await measurePair(output,'content-'+item.id,pair.full,pair.base,hp),effect=contribution(a.metrics,b.metrics,anchor);
  const observed=item.primary==='P'?effect.P:a.metrics[item.primary],functional=item.primary==='P'?Math.abs(effect.P)<Math.log(1.01):observed===0;
  let elasticity:number|null=null,perturbed:number|null=null;
  const skillSamples=rows.filter(r=>r.category==='技能'&&r.elasticity!==null),sampledLinear=skillSamples.length>=10&&skillSamples.slice(0,10).every(r=>Math.abs(r.elasticity!-1)<.1);
  if(derive&&item.path&&!functional&&(item.category!=='技能'||skillElasticityCount<10||!sampledLinear)){
   const next=item.make(1.2),arm=await measured(output,'content-'+item.id+'-perturb',next.full,hp,[41]);const observedNext:number=item.primary==='P'?contribution(arm.metrics,b.metrics,anchor).P:arm.metrics[item.primary],factor=scaledPrimary(getItem(item),item.path,1.2)/getItem(item);perturbed=observedNext;elasticity=observedNext*observed>0?Math.log(Math.abs(observedNext/observed))/Math.log(factor):null;if(item.category==='技能')skillElasticityCount++;
  }
  rows.push({id:item.id,category:item.category,group:item.group,band:item.band,primary:item.primary,host:item.host,observed,functional,elasticity,perturbed,value:item.path?getItem(item):null,file:item.file,path:item.sourcePath,step:item.step,offset:item.offset,effect,metrics:a.metrics,without:b.metrics,raw:await evidence(output+'/arms/content-'+item.id+'-full.json')});
  await save(output+'/content-measurements.json',{...stamp(),rows});console.log('内容 '+rows.length+'/'+items.length+' '+item.id+' ΔP='+effect.P.toFixed(4));
 }
 const samples=rows.filter(r=>r.category==='技能'&&r.elasticity!==null),linear=samples.length===10&&samples.every(r=>Math.abs(r.elasticity!-1)<.1);
 if(linear)for(const r of rows.filter(r=>r.category==='技能'&&!r.functional))r.elasticity=1;
 else if(derive)await decision('10技能实测弹性不能支持全体e=1','采样未通过线性条件时，对其余可调整技能各补一次配对扰动，使用逐项实测e；不估计未测弹性','S2/content-measurements.json');
 if(derive)await save(data+'/content-audit.json',{...stamp(),skillElasticity:{samples:samples.map(r=>({id:r.id,e:r.elasticity})),linear},rows:rows.map(({metrics,without,raw,...r})=>r)});
 await writeAudit(rows,output);return rows;
}
function getItem(item:ContentItem){return item.path!.reduce((v:any,k)=>v[k],item.object);}
export async function writeAudit(rows:any[],output:string){
 const merged=new Map<string,any[]>();for(const r of rows){const key=r.category+'/'+r.group;merged.set(key,[...(merged.get(key)??[]),r]);}
 for(const [key,group]of [...merged])if(group.length<3){const target=[...merged].filter(([k,g])=>k.split('/')[0]===key.split('/')[0]&&k!==key&&g.length>=3&&g.every(r=>r.primary===group[0].primary)).sort(([a],[b])=>a.localeCompare(b))[0];if(target){for(const r of group)r.group=target[0].slice(r.category.length+1);target[1].push(...group);merged.delete(key);await decision('预算小组成员不足3：'+key,'并入同类别、相同主指标的最近字典序可用组 '+target[0]+'；不把P与DPS混组','S2/audit.md');}}
 const audit=rows.map(r=>{const known=typeof r.observed==='number'&&Number.isFinite(r.observed),group=rows.filter(g=>g.category===r.category&&g.group===r.group&&!g.functional&&typeof g.observed==='number'&&Number.isFinite(g.observed)),center=group.length?median(group.map(g=>g.observed)):0,error=known&&center?r.observed/center-1:null;return {...r,center,error,inBand:r.functional&&known||known&&r.observed>0&&center>0&&error!==null&&Math.abs(error)<=r.band};}).sort((a,b)=>Math.abs(b.error??Infinity)-Math.abs(a.error??Infinity));
 await save(output+'/audit-summary.json',{...stamp(),counts:{all:audit.length,functional:audit.filter(r=>r.functional).length,outside:audit.filter(r=>!r.inBand).length,numericOutside:audit.filter(r=>!r.inBand&&typeof r.observed==='number'&&Number.isFinite(r.observed)).length,unknown:audit.filter(r=>typeof r.observed!=='number'||!Number.isFinite(r.observed)).length},rows:audit.map(({metrics,without,raw,effect,perturbed,offset,...r})=>r)});
 await writeFile(output+'/audit.md','# 内容预算审计\n\n基于正式World宿主配对，P用用户权重并保留正负号；负收益不以绝对值冒充正预算。功能型仅指本测量口径绝对影响不足1%，缺失不当作零。逐种子证据路径和sha256见content-measurements.json（本地）。\n\n| 类别 | 内容 | 组 | 实测 | 中位数 | 偏差 | 功能型 | 弹性 |\n|---|---|---|---:|---:|---:|---|---:|\n'+audit.map(r=>`| ${r.category} | ${r.id} | ${r.group} | ${r.observed===null?'缺有效观测':r.observed.toPrecision(5)} | ${r.center.toPrecision(5)} | ${r.error===null?'未知':(r.error*100).toFixed(2)+'%'} | ${r.functional?'是':'否'} | ${r.elasticity===null?'未测':r.elasticity.toFixed(4)} |`).join('\n')+'\n');return audit;
}
