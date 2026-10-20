/** Targeted, read-only reproduction of the chapter 3–5 playtest feedback. */
import '../../packages/content/open-world/index.ts';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {regionById} from '../../packages/content/index.ts';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {craftRecipes} from '../../packages/content/crafting.ts';
import {starseaKillReward} from '../../apps/api/src/economy.ts';
import {standardState,resolvePlayer} from './player.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {stamp} from './io.ts';
const out='.qa/numeric-feedback-20261019',rows=[];
for(const chapter of [3,4,5]){
 const region=regionById('ss-map-boss-'+chapter),boss=region.spawns.find(s=>s.boss)!;
 const target=pacingTargets.milestones.find(t=>t.id===region.id)!;
 const recipes=craftRecipes.filter(r=>r.island===['ss-map-forge','ss-map-frost','ss-map-rift'][chapter-3]&&r.category==='gear'&&r.options.slots?.includes('weapon'));
 const gold=starseaKillReward(target.level,'normal',target.level).gold;
 for(const family of ['sword','staff','reported-spells'] as const)for(const seed of [41,42,43]){
  const state=standardState(target.level,family==='sword'?'sword':'staff');
  if(family==='reported-spells'){const rank=state.skillRanks.frost;state.skills=['nova','lance','fireball'];state.skillRanks=Object.fromEntries(state.skills.map(id=>[id,rank]));state.progression!.skillAwakenings={};}
  const player=resolvePlayer(`feedback-${chapter}-${family}`,state);
  const sample=sampleCombatBuild({requestedSkills:state.skills,skillRanks:state.skillRanks,build:player.build,region,spawns:region.spawns,seed,maxTicks:180*30,mode:'auto',stopWhen:'clear',approachTargets:true});
  assert.deepEqual(sample.executed,sample.requested);assert(Object.values(sample.casts).some(n=>n>0),'No casts: '+player.id);
  rows.push({chapter,family,seed,level:target.level,boss:boss.name,hp:boss.hp,targetSeconds:target.bossKillSeconds,skills:sample.executed,skillRanks:sample.skillRanks,casts:sample.casts,failures:sample.failures,damage:sample.damage,damageBySkill:sample.damageBySkill,clearSeconds:sample.clearSeconds,deathSeconds:sample.deathSeconds,elapsed:sample.elapsed,remaining:sample.remaining,hero:sample.hero,failed:sample.failed,normalGold:gold,recipes:recipes.map(r=>({id:r.id,gold:r.baseCost.gold,normalKills:Math.ceil(r.baseCost.gold/gold)}))});
  console.log(JSON.stringify({chapter,family,seed,level:target.level,hp:boss.hp,target:target.bossKillSeconds,clear:sample.clearSeconds,death:sample.deathSeconds,failed:sample.failed}));
 }
}
await mkdir(out,{recursive:true});await writeFile(out+'/audit.json',JSON.stringify({...stamp(),scope:'Controlled standard builds, not the player save. Three seeds, real executor, no stat grants beyond the standard model. No content writes.',rows},null,2)+'\n');
