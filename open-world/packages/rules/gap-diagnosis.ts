import type {CharacterState} from '../contracts/index.ts';
import {craftRecipes,craftSignatureRecipe} from '../content/crafting.ts';
import {damageTypeLabels} from '../content/combat-hints.ts';
import {craftRecipeKnown,craftIslandOpen,previewCraft} from './crafting.ts';
import {storyFeatureUnlocked,storyFeatureReason} from './story-campaign.ts';
import {stageForItemLevel,gearStages} from './item-power.ts';
import {ensureProgression} from './deep-progression.ts';
// 缺口诊断（docs/progression-goal-plan.md §3、G4）：卡关时一行话说清差什么、去哪补。
// 只读角色状态和配置，不改任何东西；挑不出明确缺口就返回 null，不硬凑。
const elemental=new Set(['fire','cold','lightning','arcane','shadow','poison']);
export function gapDiagnosis(s:CharacterState,input:{damageType?:string|null;outputShort?:boolean;maxCraftLevel?:number}):string|null{
 // Preview helpers may initialize legacy progression. Advice must never mutate the saved character.
 s=structuredClone(s);const progression=ensureProgression(s);
 const type=Object.entries(damageTypeLabels).find(([id,label])=>id===input.damageType||label===input.damageType)?.[0];
 if(!input.outputShort&&type&&elemental.has(type)){
  const r=craftRecipes.find(r=>r.output.kind==='consumable'&&r.output.stat===type+'Resist');
  if(r){
   const label=damageTypeLabels[type as keyof typeof damageTypeLabels];
   if(r.output.id&&(progression.consumables[r.output.id]??0)>0)return `${label}抗不足 → ${r.name}（背包已有）`;
   if(!craftIslandOpen(s,r.island)||!craftRecipeKnown(s,r))return `${label}抗不足 → 换抗性装备`;
   const quote=previewCraft(s,{op:'craft',recipe:r.id},{atForge:true,storyUnlocked:storyFeatureUnlocked(s,'forge'),reason:storyFeatureReason(s,'forge'),maxCraftLevel:input.maxCraftLevel});
   return `${label}抗不足 → ${r.name}（${quote.enabled?'工坊可制作':quote.reason}）`;
  }
 }
 const weapon=s.gear.find(g=>g.id===s.equipment.weapon),have=stageForItemLevel(weapon?.ilvl??1).tier,now=stageForItemLevel(s.level);
 if(have<now.tier){
  const r=craftRecipes.find(r=>craftSignatureRecipe(r)&&r.options.slots?.includes('weapon')&&r.output.level===now.level&&craftIslandOpen(s,r.island));
  if(!r)return `武器还在 T${have}，${now.level} 级起的掉落已经是 T${now.tier}`;
  if(input.maxCraftLevel===undefined)return `武器 T${have}→T${now.tier}：可换本阶掉落，或到工坊核对${r.name}条件`;
  const storyUnlocked=storyFeatureUnlocked(s,'forge'),quote=previewCraft(s,{op:'craft',recipe:r.id},{atForge:true,storyUnlocked,reason:storyFeatureReason(s,'forge'),maxCraftLevel:input.maxCraftLevel});
  const goldShort=Math.max(0,quote.cost.gold-s.gold),reason=quote.enabled?'工坊可制作':(r.output.level??1)>input.maxCraftLevel?'需先通过对应地城':goldShort?`还差 ${goldShort} 金`:quote.reason;
  return `武器 T${have}→T${now.tier}：${r.name}（${reason}）${quote.enabled?'':'；可先换掉落或强化'}`;
 }
 if(input.outputShort){const next=gearStages.find(g=>g.level>s.level);if(next&&next.level-s.level<=2)return `再升 ${next.level-s.level} 级，装备换 T${next.tier}`;}
 return null;
}
