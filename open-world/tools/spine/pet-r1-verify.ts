/** Fixed controlled pet-active comparison. No DB, account, tuning or production writes. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {versions,type Spawn,type Stats} from '../../packages/contracts/index.ts';
import type {EffectRule} from '../../packages/contracts/effects.ts';
import type {Region} from '../../packages/content/index.ts';
import {petContent,petFamilyById} from '../../packages/content/zhangjian.ts';
import {petActiveRule} from '../../packages/rules/zhangjian-build.ts';
import {World} from '../../packages/simulation/index.ts';

const families=['wind-free','wind-light','wind-heavy'] as const;
const levels=[1,10,20,30] as const;
const seeds=[11,23,47,71,101] as const;
const targetCounts=[1,3] as const;
const tickRate=30,windowSeconds=24,windowTicks=tickRate*windowSeconds;
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const output=resolve(root,'.runtime/content-g01');
const targetHp=1_000_000;
const positions=[{x:13,y:10},{x:14.5,y:10},{x:13,y:11.5}];
const arena:Region={id:'pet-r1-controlled',name:'Pet active fixture',subtitle:'',theme:'meadow',width:32,height:32,safe:{x:10,y:10},portal:{x:28,y:28},obstacles:[],spawns:[],landmarks:[],boss:false,auto:false,rest:false};
const limitations=[
 'Controlled pet-active measurement only: fixed 100 attack / 1000 HP, no skills, equipment, pet passives, support pets, crit, HEX, weaknesses, resistances or monster armor metadata.',
 'Durable stationary non-attacking ranged targets have no monster metadata. They are held by a real non-damaging stun; no World executor is mocked or replaced.',
 'One-target and compact three-target fixtures are neither boss TTK nor waves. They do not measure effective shield absorption, healing, normal combat success, passive balance, movement losses or natural progression.',
 'A one-tick encounter-start step is excluded, then exactly 720 real World steps are measured: startTick < tick <= endTick. This includes the 24-second boundary activation.',
 'Nominal coefficient/rate equality precedes rounding and target availability. Actual damage, lost area coverage and single-target chain loss are reported separately; no balance target is certified.',
 'Five fixed seeds are repeated on a deterministic fixture with no crit/random procs; identical results do not establish robustness against live encounter randomness.',
 'Legacy means the same current family/tier/level and executor with activeProfile removed. It is an isolated old-area-rule comparison, not replay of every historical ruleset.',
];

function ratioChecks(family:typeof families[number],level:number){
 const f=petFamilyById.get(family);assert(f,'Missing pet family '+family);
 const {activeProfile:_profile,...legacyFamily}=f;
 const legacy=petActiveRule(legacyFamily,level,'blade'),current=petActiveRule(f,level,'blade');
 assert.equal(legacy.action.type,'nova');
 if(legacy.action.type!=='nova')throw Error('Legacy rule must be nova');
 const base=legacy.action.ratio;
 if(family==='wind-free'){
  assert.equal(current.action.type,'nova');
  if(current.action.type!=='nova')throw Error('Single rule must be nova');
  const oldRate=base*tickRate/legacy.every!,newRate=current.action.ratio*tickRate/current.every!;
  assert(Math.abs(newRate-oldRate)<1e-10,'Single nominal frequency budget changed');
  return {family,level,kind:'single',baseRatio:base,ratios:[current.action.ratio],oldRatioPerSecond:oldRate,newRatioPerSecond:newRate,nominalBudgetEqual:true};
 }
 if(family==='wind-heavy'){
  assert.equal(current.action.type,'nova');
  if(current.action.type!=='nova')throw Error('Chain first action must be nova');
  const arc=current.after?.find(a=>a.type==='arc');assert(arc?.type==='arc','Missing chain continuation');
  const ratios=[current.action.ratio,...Array.from({length:arc.count},(_,i)=>arc.ratio*arc.decay**i)];
  const total=ratios.reduce((a,b)=>a+b,0);
  assert.equal(ratios.length,3);assert(Math.abs(total-base)<1e-10,'Chain nominal sum changed');
  return {family,level,kind:'chain',baseRatio:base,ratios,totalRatio:total,nominalBudgetEqual:true};
 }
 assert.equal(current.action.type,'shield');
 if(current.action.type!=='shield')throw Error('Protection rule must be shield');
 assert.equal(current.action.ref,'maxHp');
 return {family,level,kind:'shield',baseRatio:base,ratios:[],shieldRatio:current.action.ratio,expectedPeakShield:Math.round(1000*current.action.ratio),nominalBudgetEqual:null};
}

function sample(rule:EffectRule,seed:number,targetCount:1|3){
 const spawns:Spawn[]=positions.slice(0,targetCount).map((p,i)=>({id:'target-'+i,name:'Stationary target '+i,kind:'ranged',...p,hp:targetHp,attack:0,boss:false,elite:false,art:'raider'}));
 const stats:Stats={hp:1000,attack:100,armor:0,speed:0,mana:0,regen:0,effects:[],critChance:0,lifesteal:0,penetration:0,rules:[structuredClone(rule)]};
 const world=new World(structuredClone(arena),stats,[],structuredClone(spawns),[],seed);
 world.setMode('manual');world.autoSkills=false;world.targetId=spawns[0].id;
 for(const e of world.enemies){
  assert(world.applyStatus(e.id,{kind:'stun',duration:windowTicks+10,strength:0,scope:'hit',cleanse:false,breakOnDamage:false,removeWithSource:false},'pet-r1-fixture','fixture-stun'),'Target stun rejected');
 }
 // Start the real encounter clock, without adding a pet activation or rewinding ticks.
 world.step();assert.equal(world.conditionClock.start,world.tick);assert.equal(world.effectStats[rule.id]?.count??0,0);
 const startTick=world.tick,damageByTarget=Object.fromEntries(spawns.map(e=>[e.id,0]));
 const hits:{tick:number;target:string;amount:number;ruleId?:string}[]=[],activations:number[]=[];
 const shieldApplications:{tick:number;amount:number;remaining:number}[]=[];
 let peakShield=world.hero.shield;
 for(let frame=0;frame<windowTicks;frame++){
  world.step();peakShield=Math.max(peakShield,world.hero.shield);
  assert.equal(world.hero.hp,1000,'Fixture target dealt damage');
  assert.equal(world.hero.position.x,arena.safe.x);assert.equal(world.hero.position.y,arena.safe.y);
  for(const [i,e]of world.enemies.entries()){
   assert(e.alive,'Fixture durability exhausted');
   assert.equal(e.position.x,spawns[i].x,'Target moved');assert.equal(e.position.y,spawns[i].y,'Target moved');
  }
  for(const event of world.events){
   if(event.type==='effect_triggered'&&event.ruleId===rule.id)activations.push(event.tick);
   if(event.type==='hit_resolved'){
    assert(event.id in damageByTarget,'Unexpected damage target');assert.equal(event.ruleId,rule.id,'Non-pet damage contaminated fixture');
    const amount=event.amount??0;damageByTarget[event.id]+=amount;hits.push({tick:event.tick,target:event.id,amount,ruleId:event.ruleId});
   }
   if(event.type==='shielded'&&event.ruleId===rule.id&&event.shieldPhase==='applied')shieldApplications.push({tick:event.tick,amount:event.amount??0,remaining:event.shieldRemaining??world.hero.shield});
  }
 }
 const expectedActivations=Math.floor(windowTicks/rule.every!);assert.equal(activations.length,expectedActivations,'Unexpected interval count');
 for(const e of world.enemies)assert.equal(targetHp-e.hp,damageByTarget[e.id],'Event damage does not match HP loss');
 if(rule.action.type==='shield'){
  assert.equal(hits.length,0,'Shield pet dealt damage');assert.equal(peakShield,Math.round(stats.hp*rule.action.ratio));
 }else{
  const limit=rule.after?.some(a=>a.type==='arc')?targetCount:rule.action.type==='nova'&&rule.action.maxTargets===1?1:targetCount;
  assert.equal(hits.length,expectedActivations*limit,'Wrong number of pet hits');
  for(const tick of activations){const pulse=hits.filter(h=>h.tick===tick);assert.equal(new Set(pulse.map(h=>h.target)).size,pulse.length,'Pet rebounded to a used target');}
  if(rule.action.type==='nova'&&rule.action.maxTargets===1&&!rule.after?.some(a=>a.type==='arc'))assert(hits.every(h=>h.target===spawns[0].id),'Single pet missed its locked target');
 }
 return {startTick,endTick:world.tick,observedTicks:world.tick-startTick,activationTicks:activations,activations:activations.length,damageByTarget,totalDamage:Object.values(damageByTarget).reduce((a,b)=>a+b,0),peakShield,hits,shieldApplications};
}

/** One fixed matrix, with no tuning loop or parameter overrides. Call explicitly to run. */
export async function verifyPetR1(){
 const generatedAt=new Date().toISOString(),nominal= families.flatMap(f=>levels.map(l=>ratioChecks(f,l)));
 const inputs={families,levels,seeds,targetCounts,flow:'blade',tickRate,windowSeconds,windowTicks,encounterStartWarmupTicks:1,stats:{attack:100,hp:1000,armor:0,speed:0,mana:0,regen:0,critChance:0},skills:[],targetHp,targetPositions:positions,targetKind:'ranged',targetMonsterMetadata:null,targetControl:'non-damaging stun, no break on damage',lockedTarget:'target-0',activeEvery:petContent.activeEvery,petPassivesIncluded:false};
 const sourceFiles=['packages/content/pets.json','packages/content/zhangjian.ts','packages/contracts/index.ts','packages/contracts/effects.ts','packages/rules/zhangjian-build.ts','packages/simulation/index.ts','tools/spine/pet-r1-verify.ts'];
 const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,createHash('sha256').update(await readFile(resolve(root,p))).digest('hex')])));
 const rows:{family:typeof families[number];level:typeof levels[number];seed:typeof seeds[number];targetCount:typeof targetCounts[number];oldRule:EffectRule;newRule:EffectRule;legacy:ReturnType<typeof sample>;current:ReturnType<typeof sample>;totalDamageDelta:number;totalDamageRatio:number|null}[]=[];
 for(const family of families)for(const level of levels)for(const seed of seeds)for(const targetCount of targetCounts){
  const f=petFamilyById.get(family)!;const {activeProfile:_profile,...legacyFamily}=f;
  const oldRule=petActiveRule(legacyFamily,level,'blade'),newRule=petActiveRule(f,level,'blade');
  const legacy=sample(oldRule,seed,targetCount),current=sample(newRule,seed,targetCount);
  rows.push({family,level,seed,targetCount,oldRule,newRule,legacy,current,totalDamageDelta:current.totalDamage-legacy.totalDamage,totalDamageRatio:legacy.totalDamage?current.totalDamage/legacy.totalDamage:null});
 }
 const range=(values:number[])=>({min:Math.min(...values),max:Math.max(...values),median:[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]});
 const comparisons=families.flatMap(family=>levels.flatMap(level=>targetCounts.map(targetCount=>{
  const paired=rows.filter(r=>r.family===family&&r.level===level&&r.targetCount===targetCount);
  return {family,level,targetCount,sampleCount:paired.length,legacyDamage:range(paired.map(r=>r.legacy.totalDamage)),currentDamage:range(paired.map(r=>r.current.totalDamage)),damageDelta:range(paired.map(r=>r.totalDamageDelta)),currentPeakShield:range(paired.map(r=>r.current.peakShield)),legacyActivations:range(paired.map(r=>r.legacy.activations)),currentActivations:range(paired.map(r=>r.current.activations))};
 })));
 const raw={generatedAt,versions,sourceHashes,inputs,limitations,nominal,pairedSamples:rows.length,worldRuns:rows.length*2,rows};
 const summary={generatedAt,versions,sourceHashes,inputs,limitations,scope:'pet active controlled mechanics only',balanceAcceptance:'not assessed',mechanicAssertionsPassed:true,nominal,pairedSamples:rows.length,worldRuns:rows.length*2,comparisons,rawFile:'.runtime/content-g01/pet-r1-measurement.json'};
 await mkdir(output,{recursive:true});
 await writeFile(resolve(output,'pet-r1-measurement.json'),JSON.stringify(raw,null,2)+'\n');
 await writeFile(resolve(output,'pet-r1-measurement-summary.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({pairedSamples:rows.length,worldRuns:rows.length*2,mechanicAssertionsPassed:true,balanceAcceptance:'not assessed',output}));
 return summary;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyPetR1();
