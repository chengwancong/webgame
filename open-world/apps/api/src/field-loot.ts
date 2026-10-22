import {z} from 'zod';
import {randomUUID,randomInt} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {CharacterState,GearQuality,Reward,Receipt} from '../../../packages/contracts/index.ts';
import source from './field-loot.json';
import {freezeHexLoot,attachHexAffixes} from './hex-loot.ts';
import {awardCraftingLoot,freezeCraftingLoot} from './crafting-loot.ts';
import {craftBuffValue} from '../../../packages/rules/crafting-consumables.ts';
import {gearBases,instantiateGearTemplate,applyXp} from '../../../packages/rules/index.ts';
import {applyItemPower} from '../../../packages/rules/item-power.ts';
import {freezeItemRules,issueCombatGear} from '../../../packages/rules/item-issuance.ts';
import {starseaKillReward,pickRegionalGearTemplate,equipmentDropRules,worldGearTemplates,dropProfileFor} from './economy.ts';
const table=z.object({id:z.string().min(1),gear:z.tuple([z.number().int().positive(),z.number().int().positive()]),quality:z.record(z.string().refine(v=>['common','magic','rare','legendary'].includes(v)),z.number().nonnegative()),goldMultiplier:z.number().nonnegative(),xpMultiplier:z.number().nonnegative(),materialMultiplier:z.number().nonnegative()}).strict().refine(v=>v.gear[0]<=v.gear[1]&&Object.values(v.quality).reduce((n,w)=>n+w,0)>0);
export const fieldLootContentSchema=z.object({tables:z.array(table),guaranteedRanks:z.record(z.string(),z.string().min(1))}).strict();
const content=fieldLootContentSchema.parse(source);
export const fieldLootTables=content.tables;
export function freezeFieldGuarantees(){return structuredClone({tables:fieldLootTables,ranks:content.guaranteedRanks});}
export function guaranteedFieldQualities(rank:string,frozen:ReturnType<typeof freezeFieldGuarantees>){
 const id=frozen.ranks[rank];if(!id)return;const loot=frozen.tables.find(t=>t.id===id);if(!loot)throw Error('Unknown guaranteed field table '+id);
 const count=loot.gear[0]+randomInt(loot.gear[1]-loot.gear[0]+1),weights=Object.entries(loot.quality),sum=weights.reduce((n,[,w])=>n+w,0);return Array.from({length:count},()=>{let roll=randomInt(1000000)/1000000*sum;for(const [key,weight]of weights){roll-=weight;if(roll<0)return key as GearQuality;}return weights.at(-1)![0] as GearQuality;});
}
export function freezeFieldLoot(id:string,currency?:{gold:number;xp:number;material:number},countScale=1){if(!Number.isFinite(countScale)||countScale<0||countScale>1)throw Error('Invalid frozen field loot count scale');const loot=fieldLootTables.find(t=>t.id===id);if(!loot)throw Error('Unknown private field loot '+id);return structuredClone({loot,currency,...(countScale===1?{}:{countScale}),hexLoot:freezeHexLoot(),itemRules:freezeItemRules(),templates:worldGearTemplates(gearBases),collection:equipmentDropRules,crafting:freezeCraftingLoot()});}
export type FrozenFieldLoot=ReturnType<typeof freezeFieldLoot>;
export async function awardFieldLoot(c:PoolClient,s:CharacterState,sourceId:string,region:string,level:number,position:{x:number;y:number},frozen:FrozenFieldLoot,craftSource:{kind:'chest'|'rare'|'event';first?:boolean;worldTier?:number;hexTarget?:string;dungeon?:string}={kind:'chest'}):Promise<{rewards:Reward[];delta:Receipt['delta']}>{
 const {loot}=frozen,weights=Object.entries(loot.quality),sum=weights.reduce((n,[,w])=>n+w,0),rawCount=loot.gear[0]+randomInt(loot.gear[1]-loot.gear[0]+1),scaledCount=rawCount*(frozen.countScale??1),fraction=scaledCount-Math.floor(scaledCount),count=Math.floor(scaledCount)+(fraction>0&&randomInt(1000000)/1000000<fraction?1:0),rewards:Reward[]=[];
 for(let n=0;n<count;n++){
  let roll=randomInt(1000000)/1000000*sum,quality=weights.at(-1)![0] as GearQuality;for(const [key,weight]of weights){roll-=weight;if(roll<0){quality=key as GearQuality;break;}}
  const template=pickRegionalGearTemplate(frozen.templates,region,frozen.collection),gear=instantiateGearTemplate(template,randomUUID(),quality,[]);gear.origin={kind:'random'};applyItemPower(gear,level);issueCombatGear(gear,level,dropProfileFor(region).maxAffixTier,s.level,false,frozen.itemRules);attachHexAffixes(s,[gear],{region,kind:craftSource.kind==='chest'?(craftSource.dungeon?'dungeonChest':'normal'):craftSource.kind,target:craftSource.dungeon??craftSource.hexTarget,first:craftSource.kind==='event'&&!s.starsea?.fieldFacts?.complete_event.includes(craftSource.hexTarget??'')},frozen.hexLoot);
  const reward:Reward={id:randomUUID(),source_id:sourceId+':'+n,region,position:{...position},gear};await c.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,false)',[reward.id,s.id,reward.source_id,reward]);rewards.push(reward);
 }

 const base=frozen.currency??starseaKillReward(level,'normal',s.level,region),delta:Receipt['delta']={gold:Math.round(base.gold*loot.goldMultiplier*(1+craftBuffValue(s,'gold'))),xp:Math.round(base.xp*loot.xpMultiplier),material:Math.round(base.material*loot.materialMultiplier)};
 const crafting=awardCraftingLoot(s,{region,kind:craftSource.kind==='event'?'elite':craftSource.kind,first:craftSource.first,worldTier:craftSource.worldTier},frozen.crafting);delta.materials=crafting.materials;if(crafting.recipes.length)delta.recipes=crafting.recipes;
 s.gold+=delta.gold;s.material+=delta.material;applyXp(s,delta.xp);return {rewards,delta};
}
