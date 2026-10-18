import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pacingProfiles,pacingBuild,profileSubstitutions} from './profiles.ts';
import {sampleCombatBuild,type BuildBenchmarkInput} from '../build-variety-benchmark.ts';
import {freezeAugmentBasis,rebuildFrozenAugmentBuild} from '../../packages/rules/frozen-augment-build.ts';
import {augments} from '../../packages/content/augments.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {versions} from '../../packages/contracts/index.ts';
import type {Region} from '../../packages/content/index.ts';
import {pacingWeights,pacingSettings} from '../../packages/content/pacing-targets.ts';
import {resolveBuild} from '../../packages/rules/index.ts';

const arena:Region={id:'pacing-controlled',name:'节奏受控测量',subtitle:'',theme:'meadow',width:48,height:48,safe:{x:20,y:20},portal:{x:2,y:2},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true};
const spawn=(id:string,rank:'normal'|'elite'|'boss',x:number,y:number,hp:number,attack:number)=>resolveMonsterSpawn({id,template:'raider',level:50,rank,x,y},undefined,{hp,attack,armor:1});
export const pacingEncounters:Record<string,Pick<BuildBenchmarkInput,'spawns'|'maxTicks'|'stopWhen'|'pressure'|'route'>>={
 single:{spawns:[spawn('boss','boss',23,20,100,0.1)],maxTicks:5400,stopWhen:'clear'},
 clear:{spawns:Array.from({length:12},(_,i)=>spawn('pack-'+i,'normal',22+i%4*.8,19+Math.floor(i/4)*.8,30,0.3)),maxTicks:5400,stopWhen:'clear'},
 survival:{spawns:Array.from({length:3},(_,i)=>spawn('pressure-'+i,'elite',21.5,19+i,2e8,6)),maxTicks:1800,stopWhen:'death',pressure:{startTick:240,interval:30,multiplier:2}},
 elite:{spawns:[spawn('elite','elite',23,20,40,0.3)],maxTicks:5400,stopWhen:'clear'},
 safety:{spawns:Array.from({length:4},(_,i)=>spawn('route-'+i,'elite',22+i%2*2,19+Math.floor(i/2)*2,2e8,0.1)),maxTicks:1800,stopWhen:'window',route:{everyTicks:240,points:[{x:18,y:18},{x:23,y:18},{x:23,y:23},{x:18,y:23}]}},
};
export const median=(xs:number[])=>{const v=[...xs].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
export async function measurePacingBuilds(options:{output:string;ablation?:boolean;weights?:Record<string,number>;seeds?:number[];buildIds?:string[]}){
 const rows:any[]=[],started=performance.now(),seeds=options.seeds??[41,42,43];
 for(const profile of pacingProfiles.filter(p=>!options.buildIds||options.buildIds.includes(p.id))){
  const assembled=pacingBuild(profile),core=augments.find(a=>a.id===profile.preferredAugment);assert(core,'Unknown core augmentation');
  const basis=freezeAugmentBasis(assembled.state,assembled.build),active=rebuildFrozenAugmentBuild(basis,[core.id],augments);
  for(const variant of options.ablation?['full','ablated']:['full']){
   // Ablation removes core aspect, only 4-piece effects, and the chosen augment;
   // identical item instances and 2-piece numerical benefits remain in place.
   const source=structuredClone(assembled.state);
   let build:BuildBenchmarkInput['build']=active;
   if(variant==='ablated'){
    const resolved=resolveBuild(source,{withoutAspects:[profile.aspect],withoutFourSets:[profile.four]});
    // Keep the augmentation's declared slot limit in both paired arms. Removing
    // a solo augmentation must not quietly grant three additional skills.
    build={stats:resolved.stats,skills:resolved.resolvedSkills.slice(0,active.skills.length)};
   }
   for(const seed of seeds)for(const [scene,encounter] of Object.entries(pacingEncounters)){
    const sample=sampleCombatBuild({requestedSkills:build.skills.map(s=>s.id),skillRanks:source.skillRanks,build,region:arena,seed,mode:'auto',...encounter});
    assert.deepEqual(sample.executed,sample.requested,'Executed build changed');
    const score=['single','clear','elite'].includes(scene)?sample.clearSeconds===null?null:1/sample.clearSeconds:scene==='survival'?sample.deathSeconds??sample.elapsed:sample.deathSeconds===null?1/(sample.incomingHits+1):null;
    rows.push({bd:profile.id,name:profile.name,scene,variant,acquisition:assembled.acquisition,profile,gear:assembled.state.gear,sets:assembled.sets,augments:variant==='full'?[core.id]:[],score,...sample});
   }
  }
  console.log('Measured '+profile.name);
 }
 const {medians,matrix}=summarizePacingRows(rows,options.weights??pacingWeights);
 const report={versions,seeds,samples:rows.length,actualRuntimeSeconds:(performance.now()-started)/1000,weights:options.weights??pacingWeights,scenarios:pacingEncounters,profileSubstitutions,medians,matrix,rows,limits:['受控合法装备、技能和潮印，与自然获取日程分别报告。','同等级50、装备50、技能5级，种子41/42/43逐个串行。三种子中位数/min/max不代表真人分布或置信区间。','安全按实际受击次数1/(次数+1)，生存采用共同逐秒翻倍压力；不代表真人操作。','清场失败按null保留，禁止用伤害外推或删除失败样本。']};
 await mkdir(options.output,{recursive:true});await writeFile(options.output+'/bd-measurements.json',JSON.stringify(report,null,2)+'\n');
 return report;
}

/** 每种子先用同种子的八套中位数归一，再对每个构筑取三种子中位数。 */
export function summarizePacingRows(rows:any[],weights:Record<string,number>){
 const scenes=Object.keys(pacingEncounters),seeds=[...new Set<number>(rows.map(r=>r.seed))],medians=Object.fromEntries(seeds.map(seed=>[seed,Object.fromEntries(scenes.map(scene=>[scene,median(rows.filter(r=>r.seed===seed&&r.scene===scene&&r.variant==='full'&&r.score!==null).map(r=>r.score))]))]));
 const matrix=pacingProfiles.map(profile=>{
  const full=rows.filter(r=>r.bd===profile.id&&r.variant==='full'),samples=Object.fromEntries(scenes.map(scene=>[scene,full.filter(r=>r.scene===scene).map(r=>({seed:r.seed,score:r.score,ratio:r.score===null?null:r.score/medians[r.seed][scene]}))])),ratios=Object.fromEntries(scenes.map(scene=>[scene,samples[scene].some(r=>r.ratio===null)?null:median(samples[scene].map(r=>r.ratio!))])),ranges=Object.fromEntries(scenes.map(scene=>{const rs=samples[scene].map(r=>r.ratio).filter((r):r is number=>r!==null);return [scene,{median:ratios[scene],min:rs.length?Math.min(...rs):null,max:rs.length?Math.max(...rs):null,samples:samples[scene]}];})),budgets=seeds.map(seed=>Object.entries(weights).reduce((sum,[scene,w])=>sum+(samples[scene].find(r=>r.seed===seed)?.ratio??0)*w,0)),budget=Object.entries(weights).reduce((sum,[scene,w])=>sum+(ratios[scene]??0)*w,0);
  const ruleIds=full[0]?.build.stats.rules?.filter((r:any)=>r.source===profile.aspect).map((r:any)=>r.id)??[],mechanisms=Object.fromEntries(ruleIds.map((id:string)=>[id,Object.fromEntries(scenes.map(scene=>{const counts=full.filter(r=>r.scene===scene).map(r=>({seed:r.seed,count:r.rules[id]?.count??0,damage:r.rules[id]?.damage??0,activations:r.rules[id]?.activations??0,uptime:(r.rules[id]?.activeFrames??0)/Math.max(1,r.elapsed*30),uses:r.rules[id]?.uses??0,seconds:r.elapsed}));return [scene,{activations:median(counts.map(r=>r.activations)),uptime:median(counts.map(r=>r.uptime)),uses:median(counts.map(r=>r.uses)),seconds:median(counts.map(r=>r.seconds)),total:counts.reduce((s,r)=>s+r.count,0),median:median(counts.map(r=>r.count)),min:Math.min(...counts.map(r=>r.count)),max:Math.max(...counts.map(r=>r.count)),samples:counts}];}))]));
  return {durations:Object.fromEntries(scenes.map(scene=>[scene,median(full.filter(r=>r.scene===scene).map(r=>r.elapsed))])),shieldChain:Object.fromEntries(scenes.map(scene=>[scene,Object.fromEntries(['shield_gain','shield_break','shield_expire'].map(key=>[key,full.filter(r=>r.scene===scene).map(r=>({seed:r.seed,count:r.rules[key]?.count??0}))]))])),bd:profile.id,name:profile.name,ratios,ranges,budget,budgetRange:{median:median(budgets),weightedSceneMedian:budget,min:Math.min(...budgets),max:Math.max(...budgets),seedBudgets:budgets},mechanisms,failures:full.filter(r=>r.failed||r.score===null).map(r=>({scene:r.scene,seed:r.seed,failed:r.failed??'死亡'}))};
 });return {medians,matrix};
}
