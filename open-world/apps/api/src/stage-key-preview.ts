import {ensureProgression} from '../../../packages/rules/deep-progression.ts';
import {stageKeyGrowth} from './stage-key-growth.ts';
import {gearWeaponAffinity} from '../../../packages/rules/weapon-skills.ts';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import type {StageKeyPreview} from '../../../packages/contracts/stage-keys.ts';
import {statLabels} from '../../../packages/contracts/stats.ts';
import {affixDisplayValue} from '../../../packages/contracts/affix-units.ts';
import {stageKeyRecipeRandom,stageKeyRecipeIds} from './stage-key-recipe-random.ts';
import {aspectDefinitions} from '../../../packages/content/deep-progression.ts';
import {effectAtomById} from '../../../packages/content/effect-atoms.ts';
import {compareResolvedStats} from '../../../packages/rules/stat-comparison.ts';
import {resolveBuild} from '../../../packages/rules/index.ts';
import {gearMaxRank} from '../../../packages/rules/item-power.ts';
import {freezeStageKeys,stageKeyScope,StageKeyError} from './stage-key-pools.ts';
import {grantStageKeyOutputs} from './stage-key-rewards.ts';
export function previewStageKey(s:CharacterState,stage:number,key:string,tier=0):StageKeyPreview{
 const frozen=freezeStageKeys(stage,tier),choice=frozen.pool.choices.find(c=>c.id===key);if(!choice)throw new StageKeyError('找不到这份配方。');
 const scope=stageKeyScope(stage,tier);if(s.world?.stageKeys?.[scope]?.obtained.length)throw new StageKeyError('钥匙已经到手了。');
 const before=structuredClone(s);ensureProgression(before);const after=structuredClone(before),growthBefore=structuredClone(before),gain=grantStageKeyOutputs(after,choice.outputs,frozen.pool.level,frozen.rewards,stageKeyRecipeRandom(s.id,scope,key),stageKeyRecipeIds(s.id,scope,key,gearWeaponAffinity(s.gear.find(g=>g.id===s.equipment.weapon)))),growth=stageKeyGrowth(growthBefore,after,frozen.rewards),alignments:StageKeyPreview['alignments']=[];
 for(const gear of gain.gear){const current=before.gear.find(g=>g.id===before.equipment[gear.slot]),original=current?.rank??0,rank=current?Math.min(original,gearMaxRank(current,5),gearMaxRank(gear,5)):0;if(current)current.rank=rank;const productRank=gear.rank;gear.rank=rank;after.equipment[gear.slot]=gear.id;alignments.push({slot:gear.slot,rank,currentRank:original,productRank});}
 const comparison=compareResolvedStats(resolveBuild(before).stats,resolveBuild(after).stats,['hp']),noChange=!gain.gear.length&&!growth.length&&Object.values(comparison).every(row=>row.delta===0);
 return {revision:s.revision,scope,stage,key,name:choice.name,description:choice.description,outputSlots:[...new Set(gain.gear.map(g=>g.slot))],growth,products:gain.gear.map(g=>({slot:g.slot,name:g.name,mechanism:[g.aspectId?aspectDefinitions.find(a=>a.id===g.aspectId)?.description:undefined,g.inscription?effectAtomById.get(g.inscription.atomId)?.name:undefined].filter(Boolean).join('；')||'属性会随你的进度变强'})),alignments,changes:Object.entries(comparison).map(([id,row])=>({id,label:statLabels[id]??id,before:affixDisplayValue(id,row.current),after:affixDisplayValue(id,row.equipped),change:row.delta===0?'—':(row.delta>0?'▲ ':'▼ ')+affixDisplayValue(id,row.delta),tone:row.delta>0?'positive':row.delta<0?'negative':'neutral'})),note:(noChange?'这次做出来的东西和你现在差不多，材料照常消耗。':'')+'做出来后要自己回港口换上；预览按配方算，地城里掉什么以实际为准。'};
}
