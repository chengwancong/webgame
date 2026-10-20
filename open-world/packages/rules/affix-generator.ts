import {reinforcementSchema} from '../content/reinforcement.ts';
import {statDefinition} from '../contracts/stats.ts';
import {gearSlotSchema,isHexSlot} from '../contracts/gear-slots.ts';
import {statIdSchema} from '../contracts/stats.ts';
import {randomInt} from 'node:crypto';
import {z} from 'zod';
import type {GearQuality,GearAffix,Slot} from '../contracts/index.ts';
import {affixStatSchema,validAffixValue,affixDisplayValue,ratioAffixStats,tagAffixStats} from '../contracts/affix-units.ts';
import source from '../content/gear-affixes.json';
import {scaleItemAffixes,stageForItemLevel} from './item-power.ts';
const tier=z.union([z.literal(1),z.literal(2),z.literal(3)]),entry=z.object({stat:affixStatSchema,minValue:z.number().nonnegative(),maxValue:z.number().nonnegative(),precision:z.number().int().min(0).max(6).optional(),tier}).strict().refine(v=>v.minValue<=v.maxValue&&validAffixValue(v.stat,v.maxValue)&&(statDefinition(v.stat)?.unit!=='flat'||Number.isSafeInteger(v.minValue)&&Number.isSafeInteger(v.maxValue)),'Invalid affix range or unit');
const quality=z.object({count:z.tuple([z.number().int().nonnegative(),z.number().int().nonnegative()]),tiers:z.array(tier)}).strict().refine(v=>v.count[0]<=v.count[1]);
export const gearAffixConfigSchema=z.object({reinforcement:reinforcementSchema,version:z.number().int().positive(),quality:z.object({common:quality,magic:quality,rare:quality,legendary:quality}).strict(),names:z.record(affixStatSchema,z.string()),pool:z.array(entry),mainStats:z.array(z.object({slot:gearSlotSchema,stat:statIdSchema,weight:z.number().positive(),t1:z.number().nonnegative(),t8:z.number().nonnegative()}).strict()).default([])}).strict();
export const gearAffixConfig=gearAffixConfigSchema.parse(source);
export const affixDefinitions=gearAffixConfig.pool;
export type AffixRandom={int:(min:number,max:number)=>number;float:()=>number};
const defaultRandom:AffixRandom={int:randomInt,float:Math.random};
/** 沿用物品等级门槛：T2（10级）开放二档，T4（23级）开放三档。 */
export function maxAffixTierForItemLevel(ilvl:number){const stage=stageForItemLevel(ilvl);return stage.tier>=4?3:stage.tier>=2?2:1;}
/** 新掉落、锻造和洗练的共同入口；无物品等级的旧装备保持旧生成规则。 */
export function generateGearAffixes(gear:{quality:GearQuality;ilvl?:number;slot?:Slot;attack?:number;armor?:number;mainStat?:{stat:string}},maxTier=3,random:AffixRandom=defaultRandom,config=gearAffixConfig):GearAffix[]{
 const tier=gear.ilvl===undefined?maxTier:Math.min(maxTier,maxAffixTierForItemLevel(gear.ilvl));
 const affixes=generateAffixes(gear.quality,tier,random,config,{slot:gear.slot,exclude:gear.mainStat?.stat??((gear.attack??0)>0?'attack':(gear.armor??0)>0?'armor':undefined)});
 return gear.ilvl===undefined?affixes:scaleItemAffixes(affixes,gear.ilvl);
}
export function generateAffixes(quality:GearQuality,maxTier=3,random:AffixRandom=defaultRandom,config=gearAffixConfig,context:{slot?:Slot;exclude?:string}={}):GearAffix[]{
 if(context.slot&&isHexSlot(context.slot))return [];
 const rule=config.quality[quality],count=rule.count[0]===rule.count[1]?rule.count[0]:random.int(rule.count[0],rule.count[1]+1),pool=config.pool.filter(a=>rule.tiers.includes(a.tier)&&a.tier<=maxTier&&a.stat!==context.exclude&&(!context.slot||statDefinition(a.stat)!.slots.some(slot=>slot===context.slot))),result:GearAffix[]=[],used=new Set<string>();
 for(let i=0;i<count;i++){const available=pool.filter(a=>!used.has(a.stat));if(!available.length)break;const template=available[random.int(0,available.length)];used.add(template.stat);
  const fraction=statDefinition(template.stat)?.unit!=='flat',precision=template.precision??(fraction?2:0),scale=10**precision,value=fraction?Math.round((template.minValue+(template.maxValue-template.minValue)*random.float())*scale)/scale:random.int(template.minValue,template.maxValue+1);
  if(!validAffixValue(template.stat,value))throw Error('Generated affix has invalid units');
  result.push({id:'affix_'+template.stat+'_'+i,name:config.names[template.stat],stat:template.stat,value,tier:template.tier,description:config.names[template.stat]+(statDefinition(template.stat)?.display==='multiplier'?' ':tagAffixStats[template.stat]?' [+]':' +')+affixDisplayValue(template.stat,value)});
 }return result;
}
