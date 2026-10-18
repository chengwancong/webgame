import {World} from '../packages/simulation/index.ts';
import {autoPartyRescue,stepPartyRescue,type RescueChannel} from '../packages/simulation/party-rescue.ts';
import {dungeonBuild,dungeonSpawns,type EncounterAffix} from '../packages/rules/dungeon-build.ts';
import {regionById,settings} from '../packages/content/index.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {resolveMeasuredBuild} from './measured-build.ts';
import {combatNumerics,armorRuleSchema,type ArmorRule} from '../packages/rules/combat-numerics.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
import type {DungeonDefinition} from '../packages/contracts/dungeons.ts';
/** Frozen-build numerical fixture using the same scaling/rescue/World as the API. */
export function measureDungeon(definition:DungeonDefinition,states:CharacterState[],tier:number,seed:number,comparisonArmor?:{version:2|3;armor:ArmorRule}){
 const numericRule=comparisonArmor?{...combatNumerics,...comparisonArmor}:combatNumerics;
 armorRuleSchema.parse(numericRule.armor);
 if(definition.story)throw Error('Story interaction must be measured through the actual API');
 if(states.length<definition.policy.party.min||states.length>definition.policy.party.max)throw Error('Measured party violates definition');
 let rng=seed>>>0;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;},pool=[...challengeContent.affixes],affixes:(EncounterAffix&{id:string})[]=[];
 for(let i=0;i<definition.policy.tierRules.affixCount;i++)affixes.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
 const builds=states.map(s=>{const b=resolveMeasuredBuild(s);return dungeonBuild(b.stats,b.resolvedSkills,affixes);}),maxTicks=Math.ceil(definition.policy.timeLimitSeconds*settings.tickRate),castCounts=states.map(()=>0),damageTaken=states.map(()=>0);let tick=0,stages=0,previous:World|undefined;
 for(const [stage,id] of definition.stages.entries()){
  const region=regionById(id),spawns=dungeonSpawns(region.spawns,definition.policy,tier,stage,affixes).map((e,index)=>({...e,id:(stage.toString(16).padStart(8,'0')+'-0000-4000-a000-'+index.toString(16).padStart(12,'0'))})),w=new World(region,builds[0].stats,builds[0].skills,spawns,[],seed+stage);w.tick=tick;w.supportRange=definition.policy.allyRange;for(const e of w.enemies)e.cooldown+=tick;
  // Diagnostic comparisons only; production always freezes its configured profile at creation.
  (w as any).rules.combatNumerics=structuredClone(numericRule);
  for(const [index,b] of builds.entries()){const actor='member-'+index;w.addPlayer(actor,b.stats,b.skills);const old=previous?.players.get(actor),p=w.players.get(actor)!;if(old)w.forPlayer(actor,()=>{w.hero={...structuredClone(old.hero),position:{...w.hero.position},action:old.hero.hp>0?'idle':'death'};w.cooldowns={...old.cooldowns};w.heroSlowUntil=old.heroSlowUntil;});w.forPlayer(actor,()=>{w.setMode('auto');w.radius=Math.max(region.width,region.height);});}
  w.focusPlayer('member-0');let rescue:RescueChannel[]=[];
  const goals=()=>region.boss?w.enemies.some(e=>e.boss&&e.reward)&&w.enemies.filter(e=>e.boss&&e.reward).every(e=>!e.alive):w.enemies.filter(e=>e.reward&&!e.alive&&!e.boss).length>=definition.policy.normalGoals.killCount&&w.enemies.filter(e=>e.reward&&!e.alive&&e.elite).length>=definition.policy.normalGoals.eliteCount;
  while(!goals()&&w.livingPlayers().length&&w.tick<maxTicks){if(definition.mode==='simulation')autoPartyRescue(w,rescue,definition.policy.rescue);w.step();rescue=stepPartyRescue(w,rescue,definition.policy.rescue,settings.tickRate);for(const e of w.events)for(let index=0;index<states.length;index++){if(e.type==='cast_started'&&e.sourceId==='member-'+index)castCounts[index]++;if(e.type==='hit_resolved'&&e.id==='member-'+index)damageTaken[index]+=e.amount??0;}}
  tick=w.tick;previous=w;if(!goals())break;stages++;
 }
 const success=stages===definition.stages.length;
 if(castCounts.every(n=>n===0))throw Error('Measured dungeon never executed skills');
 return {definition:definition.id,tier,seed,combatNumerics:numericRule,success,seconds:tick/settings.tickRate,stages,totalStages:definition.stages.length,reason:success?'success':previous?.livingPlayers().length?'time-limit':'all-downed',timeLimitSeconds:definition.policy.timeLimitSeconds,actors:builds.map((b,index)=>({skills:b.skills.map(s=>s.id),stats:b.stats,casts:castCounts[index],damageTaken:damageTaken[index],hp:previous?.players.get('member-'+index)?.hero.hp??0})),affixes:affixes.map(a=>a.id)};
}
