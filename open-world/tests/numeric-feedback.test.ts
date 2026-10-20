import {expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {newCombatReview,observeCombatReview,resolveCombatReview} from '../packages/simulation/combat-review.ts';
import {combatReviewSchema} from '../packages/contracts/combat-review.ts';
import {compareVerdict,compareResolvedStats} from '../packages/rules/stat-comparison.ts';
import {previewCraft,applyCraft,ensureCrafting} from '../packages/rules/crafting.ts';
import {craftRecipes} from '../packages/content/crafting.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {gapDiagnosis} from '../packages/rules/gap-diagnosis.ts';
import {makeGearByBase} from '../packages/rules/index.ts';
import type {CharacterState,Stats} from '../packages/contracts/index.ts';
const stats:Stats={hp:100,attack:107,armor:0,speed:6,mana:100,regen:0,effects:[]};
const state=():CharacterState=>({id:crypto.randomUUID(),name:'反馈回归',revision:0,build:1,level:28,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:['ss-map-frost','ss-map-rift'],bosses:[],safe:'town',tasks:[]}});
it('retained hits plus omitted damage reconcile with the complete, deduplicated executor total',()=>{
 const region=regionById('meadow'),w=new World(region,stats,[],region.spawns.slice(0,1)),record=newCombatReview('server');
 for(let tick=1;tick<=12;tick++){w.tick=tick;const events=[{type:'hit_resolved' as const,id:w.playerId,sourceId:w.enemies[0].id,skill:'basic-melee',amount:tick,damageType:'physical' as const,position:w.hero.position,tick}];observeCombatReview(record,w,events);observeCombatReview(record,w,events);}
 const review=combatReviewSchema.parse(resolveCombatReview(record,w.playerId));
 expect(review.totalTaken).toBe(78);expect(review.fatal?.damage).toBe(12);expect(review.omittedTaken).toBe(28);expect(review.recent).toHaveLength(4);expect(review.source).toBe('server');
 expect(review.omittedTaken!+8+9+10+11+review.fatal!.damage).toBe(review.totalTaken);
});
it('the verdict consumes the same cold/lightning damage pools shown in comparison rows',()=>{
 const next:Stats={...stats,attack:102,zones:[{id:'cold',label:'冰霜',kind:'add',tags:['cold'],value:.1},{id:'lightning',label:'闪电',kind:'add',tags:['lightning'],value:.1}]};
 expect(compareResolvedStats(stats,next).coldDamage.delta).toBe(.1);
 expect(compareVerdict(stats,next)).toBe('output');
 expect(compareVerdict(stats,{...stats,attack:102})).toBe('weaker');
 expect(compareVerdict(next,stats)).toBe('weaker');
});
it('locked T5 preview gives an actual guaranteed affix range without creating gear or consuming resources',()=>{
 const s=state();ensureProgression(s);const before=structuredClone(s),preview=previewCraft(s,{op:'craft',recipe:'rift-weapon',tendency:'martial'},{atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:23});
 expect(preview.output.guaranteedAffix).toMatch(/物理伤害 \+\d+(\.\d+)?%/);expect(s).toEqual(before);expect(preview.enabled).toBe(false);
});
it('guaranteed affix preview contains the actual min and max rolls at T1 and T5',()=>{
 for(const id of ['wind-weapon','rift-weapon'])for(const high of [false,true]){
  const s=state(),p=ensureProgression(s),r=craftRecipes.find(r=>r.id===id)!;s.progress.regions.push(r.island!);s.gold=1e9;p.materials=Object.fromEntries(Object.keys(r.baseCost.materials).map(id=>[id,9999]));const c=ensureCrafting(s);c.professions.smithing.level=50;if(r.facilityRequired)c.facilities[r.facilityRequired.id]=r.facilityRequired.level;
  const action={op:'craft' as const,recipe:id,tendency:'martial'},place={atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:60},preview=previewCraft(s,action,place);
  const gain=applyCraft(s,action,place,{int:(min,max)=>high?max-1:min,float:()=>high?.999999:0}),affix=gain.gear![0].affixes.find(a=>a.stat==='physicalDamage')!;
  expect(preview.output.guaranteedAffix).toContain(String(Math.round(affix.value*100))+'%');
 }
});
it('failure advice exposes a locked craft instead of presenting it as an available replacement',()=>{
 const s=state();ensureProgression(s);const weapon=makeGearByBase('blade',crypto.randomUUID());weapon.ilvl=17;s.gear=[weapon];s.equipment.weapon=weapon.id;
 const advice=gapDiagnosis(s,{outputShort:true,maxCraftLevel:23});expect(advice).toContain('需先通过对应地城');expect(advice).toContain('可先换掉落或强化');expect(advice!.length).toBeLessThanOrEqual(60);
 const before=structuredClone(s);expect(gapDiagnosis(s,{outputShort:true,maxCraftLevel:60})).toContain('还差 64958 金');expect(s).toEqual(before);
});
