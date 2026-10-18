import type {CharacterState} from '../contracts/index.ts';
import {craftRecipes,craftSignatureRecipe} from '../content/crafting.ts';
import {damageTypeLabels} from '../content/combat-hints.ts';
import {craftRecipeKnown,craftIslandOpen} from './crafting.ts';
import {stageForItemLevel,gearStages} from './item-power.ts';
// 缺口诊断（docs/progression-goal-plan.md §3、G4）：卡关时一行话说清差什么、去哪补。
// 只读角色状态和配置，不改任何东西；挑不出明确缺口就返回 null，不硬凑。
const elemental=new Set(['fire','cold','lightning','arcane','shadow','poison']);
export function gapDiagnosis(s:CharacterState,input:{damageType?:string|null;outputShort?:boolean}):string|null{
 const type=Object.entries(damageTypeLabels).find(([id,label])=>id===input.damageType||label===input.damageType)?.[0];
 if(!input.outputShort&&type&&elemental.has(type)){
  const r=craftRecipes.find(r=>r.output.kind==='consumable'&&r.output.stat===type+'Resist');
  if(r)return `${damageTypeLabels[type as keyof typeof damageTypeLabels]}抗不足 → ${r.name}（${craftRecipeKnown(s,r)&&craftIslandOpen(s,r.island)?'工坊·炼金':r.unlockHint}）`;
 }
 const weapon=s.gear.find(g=>g.id===s.equipment.weapon),have=stageForItemLevel(weapon?.ilvl??1).tier,now=stageForItemLevel(s.level);
 if(have<now.tier){
  const r=craftRecipes.find(r=>craftSignatureRecipe(r)&&r.options.slots?.includes('weapon')&&r.output.level===now.level&&craftIslandOpen(s,r.island));
  return r?`武器还在 T${have}，${r.name}可以换 T${now.tier}（工坊·锻造）`:`武器还在 T${have}，${now.level} 级起的掉落已经是 T${now.tier}`;
 }
 if(input.outputShort){const next=gearStages.find(g=>g.level>s.level);if(next&&next.level-s.level<=2)return `再升 ${next.level-s.level} 级，装备换 T${next.tier}`;}
 return null;
}
