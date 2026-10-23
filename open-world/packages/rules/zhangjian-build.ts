// M17 Z2 部位强化 + 共鸣、Z3 宠物构筑来源。只依赖底层模块，供 build-parts 调用（不能引 rules/index）。
import type {CharacterState,Gear} from '../contracts/index.ts';
import {rankSlots,type RankSlot,type PetFlow} from '../contracts/zhangjian.ts';
import {effectRuleSchema,type EffectRule} from '../contracts/effects.ts';
import {petContent,petFamilyById,type PetFamily} from '../content/zhangjian.ts';
import {gearMaxRank} from './item-power.ts';

// ---------- Z2 部位强化 ----------
export const RESONANCE_STEPS=[3,6,9,12,15] as const;
/** 每档 +2% 攻击 / 护甲 / 最大生命（M17 Z2，B 批次推导后可改）。 */
export const RESONANCE_PER_TIER=0.02;
export const isRankSlot=(slot:string):slot is RankSlot=>(rankSlots as readonly string[]).includes(slot);
export function wornInSlot(s:Pick<CharacterState,'gear'|'equipment'>,slot:RankSlot){const id=s.equipment[slot];return id?s.gear.find(g=>g.id===id):undefined;}
export function slotRank(s:Pick<CharacterState,'slotRanks'>,slot:RankSlot){return Math.max(0,Math.floor(s.slotRanks?.[slot]??0));}
/** 旧存档（没有 slotRanks）沿用装备自身等级；迁移后按部位等级与本件品质上限取小。 */
export function slotEffectiveRank(s:Pick<CharacterState,'slotRanks'>,g:Gear){if(!s.slotRanks||!isRankSlot(g.slot))return g.rank;return Math.min(slotRank(s,g.slot),gearMaxRank(g,5));}
/** 构筑用的装备副本：主属性强化按部位生效等级算；装备本身不改。 */
export function withSlotRank(s:Pick<CharacterState,'slotRanks'>,g:Gear):Gear{const rank=slotEffectiveRank(s,g);return rank===g.rank?g:{...g,rank};}
export function resonanceTier(s:Pick<CharacterState,'slotRanks'>){if(!s.slotRanks)return {tier:0,lowest:0};const lowest=Math.min(...rankSlots.map(slot=>slotRank(s,slot)));return {tier:RESONANCE_STEPS.filter(n=>lowest>=n).length,lowest};}
export function resonanceStats(tier:number){if(tier<=0)return [];const value=tier*RESONANCE_PER_TIER;return (['attackPercent','armorPercent','hpPercent'] as const).map(stat=>({source:'resonance:'+tier,phase:'main' as const,stat,value}));}
/** 开发期一次性迁移：每个部位取背包与仓库里该部位装备的最高等级。 */
export function migrateSlotRanks(s:CharacterState){if(s.slotRanks)return false;const all=[...s.gear,...(s.warehouse??[])];s.slotRanks=Object.fromEntries(rankSlots.map(slot=>[slot,Math.max(0,...all.filter(g=>g.slot===slot).map(g=>g.rank))]));s.build++;return true;}
/** 穿上或强化部位后补齐词缀节点：gear.rank 记「已吃到的节点进度」，只升不降。
 * node 由服务端传 reinforceAffixNode（它用 node:crypto，不能进前端包）。返回补到的节点等级。 */
export function catchUpAffixNodes(s:Pick<CharacterState,'slotRanks'>,g:Gear,node:(g:Gear)=>void){const target=slotEffectiveRank(s,g),reached:number[]=[];while(g.rank<target){g.rank++;const before=g.affixNode;node(g);if(g.affixNode!==before)reached.push(g.rank);}return reached;}

// ---------- Z3 宠物 ----------
export function petForm(level:number){return level>=petContent.forms.awakened?'awakened' as const:level>=petContent.forms.adult?'adult' as const:'young' as const;}
export function petXpNext(level:number){return Math.round(120*1.18**(level-1));}
export function petElement(flow:PetFlow){return petContent.flows[flow];}
export function petActiveRatio(f:PetFamily,level:number){return petContent.tiers[f.tier].activeRatio*(1+petContent.levelRatioBonus*(level-1));}
export function petPassives(f:PetFamily,level:number,share=1){const t=petContent.tiers[f.tier],bonus=petContent.passivePerTenLevels*Math.floor(level/10);return [t.passive,...(t.extra?[t.extra]:[])].map((p,i)=>({stat:p.stat,value:(p.value+(i===0?bonus:0))*share}));}
/** 上阵宠物的技能：每 activeEvery 帧打离角色最近、且在 activeRange 内的敌人，范围 activeRadius，元素随流派。 */
export function petActiveRule(f:PetFamily,level:number,flow:PetFlow):EffectRule{
 const ratio=Math.round(petActiveRatio(f,level)*1000)/1000,damageType=petElement(flow);
 return effectRuleSchema.parse({id:'pet-'+f.id,name:f.name,description:f.name+'：每 '+petContent.activeEvery/30+' 秒造成攻击力 '+Math.round(ratio*100)+'% 的范围伤害',source:'pet:'+f.id,tier:1,trigger:'interval',every:petContent.activeEvery,chance:1,icd:0,when:[{kind:'distance',op:'lte',value:petContent.activeRange}],filter:{},action:{type:'nova',ratio,radius:petContent.activeRadius,damageType,ref:'attack',at:'target'},scale:[],vfxKey:'pet/'+damageType});
}
export function petBuildParts(s:Pick<CharacterState,'pets'>){
 const p=s.pets;if(!p)return {stats:[],rules:[]};
 const stats:{source:string;phase:'main';stat:string;value:number}[]=[],rules:EffectRule[]=[];
 const add=(id:string,share:number)=>{const f=petFamilyById.get(id),own=p.owned[id];if(!f||!own)return;for(const x of petPassives(f,own.level,share))stats.push({source:'pet:'+id,phase:'main',...x});};
 if(p.lineup.active){add(p.lineup.active,1);const f=petFamilyById.get(p.lineup.active),own=p.owned[p.lineup.active];if(f&&own)rules.push(petActiveRule(f,own.level,own.flow));}
 for(const id of p.lineup.support)if(id!==p.lineup.active)add(id,petContent.supportShare);
 return {stats,rules};
}
