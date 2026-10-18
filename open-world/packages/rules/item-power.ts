import {reinforcementRules} from '../content/reinforcement.ts';
import type {Gear,GearQuality,GearAffix} from '../contracts/index.ts';
import {statRegistry} from '../contracts/stats.ts';
import {affixDisplayValue} from '../contracts/affix-units.ts';
import {collectionEquipment,equipmentStage} from '../content/equipment-runtime.ts';
// 星潮海装备强度（docs/balance-30h-design.md §3.1–3.2、§3.6）。
// 物品等级 = 掉落怪物等级；阶段由物品等级决定，只放大声明的成长属性。
export const gearStages=[
 {tier:1,level:1,scale:1,gold:200},{tier:2,level:10,scale:1.7,gold:240},{tier:3,level:17,scale:2.8,gold:270},{tier:4,level:23,scale:4.4,gold:340},
 {tier:5,level:28,scale:6.8,gold:490},{tier:6,level:33,scale:10.5,gold:700},{tier:7,level:38,scale:16,gold:1300},{tier:8,level:45,scale:24,gold:1900}
] as const;
export const qualityScale:Record<GearQuality,number>={common:1,magic:1.1,rare:1.2,legendary:1.3};
export const qualityMaxRank:Record<GearQuality,number>=reinforcementRules.rankCaps;
export const reinforcementCap=Math.max(...Object.values(qualityMaxRank));
export function stageForItemLevel(ilvl:number){let stage:(typeof gearStages)[number]=gearStages[0];for(const s of gearStages)if(ilvl>=s.level)stage=s;return stage;}
/** 同一阶段内每高 1 级物品等级，主属性 +3%，让同阶段的新掉落仍有小幅提升。 */
export function itemPowerScale(ilvl:number){const stage=stageForItemLevel(ilvl);return stage.scale*(1+.03*(ilvl-stage.level));}
/** 星潮海装备（带物品等级）按品质封顶；旧装备沿用全局上限。 */
export function gearMaxRank(g:Pick<Gear,'quality'|'ilvl'>,legacyMax:number){return g.ilvl===undefined?Math.max(legacyMax,qualityMaxRank[g.quality??'common']):qualityMaxRank[g.quality??'common'];}
export function gearUpgradeCost(g:Pick<Gear,'rank'|'ilvl'>,legacy:(rank:number)=>{gold:number;material:number}){
 if(g.ilvl===undefined)return legacy(g.rank);
 const stage=stageForItemLevel(g.ilvl);return {gold:Math.round(stage.gold*(1+.35*g.rank)),material:(1+Math.floor(g.rank/2))*Math.ceil(stage.tier/2)};
}
// R0 显式名单；R1 迁入属性登记表 stageScaled。资源与移速不随阶段放大。
export const stageScaledAffixStats=new Set(statRegistry.filter(s=>s.stageScaled).map(s=>s.id));
/** 只用于生成新词缀；读档和解析构筑不调用，避免重写已掉落实例。 */
export function scaleItemAffixes(affixes:GearAffix[],ilvl:number):GearAffix[]{
 const scale=stageForItemLevel(ilvl).scale;
 return affixes.map(a=>{if(!stageScaledAffixStats.has(a.stat))return {...a};const value=Math.max(1,Math.round(a.value*scale));return {...a,value,description:a.name+' +'+affixDisplayValue(a.stat,value)};});
}
/** 把模板（T1–T3 美术阶段的主属性）换算到物品等级的强度。仅用于新实例。 */
export function applyItemPower(g:Gear,ilvl:number):Gear{
 const level=Math.max(1,Math.round(ilvl)),stage=stageForItemLevel(level),item=collectionEquipment(g.base),templateScale=item?equipmentStage(item.tier).primaryScale:1;
 const factor=itemPowerScale(level)/templateScale*qualityScale[g.quality??'common'];
 g.attack=g.attack>0?Math.max(1,Math.round(g.attack*factor)):0;g.armor=g.armor>0?Math.max(1,Math.round(g.armor*factor)):0;
 g.affixes=scaleItemAffixes(g.affixes??[],level);
 g.ilvl=level;g.stage=stage.tier;g.requiredLevel=stage.level;return g;
}
