/** GROW-01: one controlled measurement, algebraic single-knob feasibility, no sweep. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {skillCatalog} from '../../packages/content/index.ts';
import {skillCoefficients} from '../../packages/content/spine-controls.ts';
import {versions} from '../../packages/contracts/index.ts';
import {standardState,resolvePlayer} from './player.ts';
import {SCHEDULE} from '../standard-player-model.ts';
import {benchSample,benchSeeds} from './bench.ts';

export const grow01Steps=[
 {recovery:2,level:8,before:['throwing_knife','fan_of_knives','shadow_step','ward'],after:['throwing_knife','fan_of_knives','explosive_kunai','shadow_step']},
 {recovery:3,level:13,before:['throwing_knife','fan_of_knives','shadow_step','explosive_kunai'],after:['death_lotus','fan_of_knives','shadow_step','explosive_kunai']},
 {recovery:4,level:15,before:['fan_of_knives','explosive_kunai','death_lotus','shadow_step'],after:['night_veil','explosive_kunai','death_lotus','shadow_step']},
];
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
export function measureGrow01(level:number,skills:string[],id:string){
 const state=standardState(level,'hidden');state.skills=[...skills];
 state.skillRanks=Object.fromEntries(skills.map(id=>[id,SCHEDULE.skillRank(level)]));
 state.progression!.skillAwakenings={};
 const player=resolvePlayer(id,state);
 const runs=benchSeeds.map(seed=>{
  const r=benchSample(player,'dense',seed,player.build.stats.hp);
  assert.deepEqual(r.requested,r.executed);
  assert(r.value!==null&&r.value>0&&r.totalDamage>0&&!r.failed,'Invalid measurement '+id);
  return r;
 });
 const value=median(runs.map(r=>r.value!)),mid=runs.find(r=>r.value===value)!;
 const d=mid.damageBySkill.explosive_kunai;
 const share=d?d.direct+d.periodic+d.derived:0;
 return {value,kunaiDps:share/mid.totalDamage*value,skills:player.build.skills.map(s=>({id:s.id,cost:s.cost,damage:s.damage})),runs};
}
const steps=grow01Steps,measure=measureGrow01;
export async function deriveGrow01(output:string){
 const knife=skillCatalog.find(s=>s.id==='throwing_knife')!;
 const original={knifeCost:knife.cost,kunai:skillCoefficients.explosive_kunai};
 assert.equal(original.knifeCost,3,'Expected untouched pre-change source');
 assert.equal(original.kunai,2.74,'Expected untouched pre-change source');
 try{
  const level50Skills=['fan_of_knives','death_lotus','night_veil','explosive_kunai'];
  const baseline50=measure(50,level50Skills,'grow01-before-l50');
  knife.cost=1;skillCoefficients.explosive_kunai=1.31;
  const rows=steps.map(s=>{
   const before=measure(s.level,s.before,`grow01-r${s.recovery}-before`);
   const after=measure(s.level,s.after,`grow01-r${s.recovery}-after`);
   const gain=after.value/before.value-1;
   console.log(JSON.stringify({recovery:s.recovery,gain,floor:.2}));
   return {...s,before,after,gain,passed:gain>=.2};
  });
  const initial50=measure(50,level50Skills,'grow01-initial-l50');
  // A*c+B >= 0 for each exact +20% target. Coefficient is c, not a scan.
  let lower=0,upper=Infinity;
  const constraints=rows.map(r=>{
   const a=(r.after.kunaiDps-1.2*r.before.kunaiDps)/1.31;
   const b=r.after.value-r.after.kunaiDps-1.2*(r.before.value-r.before.kunaiDps);
   if(a>0)lower=Math.max(lower,-b/a);
   else if(a<0)upper=Math.min(upper,-b/a);
   else if(b<0)upper=-1;
   return {recovery:r.recovery,a,b};
  });
  const highA=initial50.kunaiDps/1.31,highB=initial50.value-initial50.kunaiDps;
  if(highA>0)upper=Math.min(upper,(baseline50.value-highB)/highA);
  const feasible=upper>0&&upper>=lower;
  // Round up to 2 decimals only when a single common solution exists.
  const candidate=feasible?Math.min(Math.floor(upper*100)/100,Math.max(Math.ceil(lower*100)/100,Math.min(1.31,Math.floor(upper*100)/100))):null;
  const selected=candidate!==null&&candidate>0&&candidate>=lower?candidate:null;
  let verification:null|{coefficient:number;rows:unknown[];level50:ReturnType<typeof measure>;passed:boolean}=null;
  if(selected!==null){
   skillCoefficients.explosive_kunai=selected;
   const checks=steps.map(s=>{const before=measure(s.level,s.before,`grow01-verify-r${s.recovery}-before`),after=measure(s.level,s.after,`grow01-verify-r${s.recovery}-after`);return {recovery:s.recovery,before,after,gain:after.value/before.value-1,passed:after.value/before.value-1>=.2};});
   const level50=measure(50,level50Skills,'grow01-verify-l50');
   verification={coefficient:selected,rows:checks,level50,passed:checks.every(r=>r.passed)&&level50.value<=baseline50.value};
  }
  const result={at:new Date().toISOString(),versions,scope:'Controlled standard builds and in-memory candidate; no source/apply/save writes. Dense 30s seeds 41/42/43. Not GUI/natural progression.',original,initial:{knifeCost:1,kunai:1.31},baseline50,rows,initial50,constraints,interval:{lower,upper:Number.isFinite(upper)?upper:null,feasible},selected,verification};
  await writeFile(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({output,interval:result.interval,selected,verified:verification?.passed??'not executed: no common single-knob solution',level50Ratio:initial50.value/baseline50.value}));
  return result;
 }finally{knife.cost=original.knifeCost;skillCoefficients.explosive_kunai=original.kunai;}
}
