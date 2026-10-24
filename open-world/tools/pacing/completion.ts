import {craftRecipes} from '../../packages/content/crafting.ts';
import type {CharacterState} from '../../packages/contracts/index.ts';
import type {PacingTargetTables} from '../../packages/contracts/pacing.ts';
import {paragonDefinitions,aspectDefinitions,progressionConfig} from '../../packages/content/deep-progression.ts';
import {setEffects} from '../../packages/content/set-effects.ts';
import {skillUpgradeCost} from '../../packages/rules/index.ts';
import {talentPoints} from '../../packages/rules/deep-progression.ts';
/** Completion is a read-only observation, not an elapsed-time acceptance gate. */
export function pacingCompletion(state:CharacterState,observations?:any){
 const p=state.progression!,known=Object.keys(state.skillRanks).filter(id=>state.skillRanks[id]>0),worn=state.gear.filter(g=>Object.values(state.equipment).includes(g.id)),points=talentPoints(structuredClone(state));
 const metrics={quality:{count:worn.filter(g=>g.quality==='rare'||g.quality==='legendary').length,total:6},skills:{count:known.filter(id=>state.skillRanks[id]===5).length,total:known.length},talents:{count:Object.values(p.talents).reduce((n,v)=>n+v,0),total:points},awakening:{count:p.awakening,total:10},'skill-awakening':{count:Object.keys(p.skillAwakenings).length,total:known.length},sets:{count:observations?.acquiredSetIds?.length??null,total:setEffects.length},aspects:{count:Object.keys(p.codex).length,total:aspectDefinitions.filter(a=>a.dropEnabled).length},crafting:{count:p.recipes.length,total:craftRecipes.length},reputation:{count:p.reputationClaims.length,total:progressionConfig.factions.length*4},paragon:{count:p.paragon.length,total:paragonDefinitions.length}};
 return Object.entries(metrics).map(([id,v])=>({id,...v,fraction:v.count===null||!v.total?null:v.count/v.total,scope:id==='sets'?'only distinct set identities from this real reward history':'current earned character state; unlocked skill/available point denominator'}));
}
/** Hold costs fixed and derive the resource-output requirement. Unknown source
 * rates stay unknown: do not secretly reduce drops or inflate early-game costs. */
export function pacingCompletionRequirements(targets:PacingTargetTables,deep:any,resourceRates?:any){
 return targets.completion.map(t=>{const units=Math.ceil(t.total*t.target),factor=t.id==='awakening'?units*(units+1)/2:units,cost=t.costKey?deep.costs[t.costKey]:undefined;return {id:t.id,name:t.name,targetFraction:t.target,units,requiredUnitsPerVirtualMinute:units/t.minutes,currentConfiguredUnitRate:t.rate,requiredGoldPerVirtualMinute:t.id==='skills'?[1,2,3,4].reduce((n,rank)=>n+skillUpgradeCost(rank).gold,0)*units/t.minutes:cost?cost.gold*factor/t.minutes:null,requiredMaterialPerVirtualMinute:cost?cost.material*factor/t.minutes:null,currentCostPath:cost?'packages/content/deep-progression.json / costs.'+t.costKey:null,observedResourceRates:resourceRates??null,automaticWrite:false,reason:t.id==='paragon'?'Paragon XP/cost is derived separately; 48 nodes remain unchanged.':cost?'Resource-output requirement derived from target completion with current costs. Material-specific income/gates still require observation; shared early-game costs remain unchanged.':'Collection/source rate is a target, not a measured drop probability. Preserve the existing random structure; unavailable income is not zero.'};});
}
