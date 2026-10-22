import {z} from 'zod';
import {randomInt} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {CharacterState,Reward,Gear,GearQuality} from '../../../packages/contracts/index.ts';
import {hexPlaystyles} from '../../../packages/contracts/hex-runes.ts';
import {hexRuneById} from '../../../packages/content/hex-runes.ts';
import {economyRegionOf} from '../../../packages/content/index.ts';
import {hexPrerequisiteMet} from './hex-rewards.ts';
import raw from './hex-loot.json';
const probability=z.number().min(0).max(1);
export const hexLootSchema=z.object({
 version:z.union([z.literal(1),z.literal(2)]),island:z.string(),unlockTask:z.string(),catalogue:z.array(z.string()).length(8),
 levelAhead:z.number().int().nonnegative(),magicLevel:z.number().int().positive(),
 sources:z.object({
  elite:probability,event:probability,firstEventMultiplier:z.number().positive(),dungeonChest:probability,
  dungeonBoss:probability,dungeonMagic:probability,rare:probability,rareMagic:probability
 }).strict(),
 biasWeight:z.number().min(1),biases:z.record(z.string(),z.array(z.enum(hexPlaystyles)).min(1)),
 dungeons:z.array(z.string()).min(1),rares:z.array(z.string()).min(1),
 expectedEligible:z.object({elite:z.number().positive(),event:z.number().positive(),dungeonChest:z.number().positive(),dungeonBoss:z.number().positive(),rare:z.number().positive()}).strict().optional(),
 baselineExpected:z.object({elite:probability,event:probability,dungeonChest:probability,dungeonBoss:probability,rare:probability}).strict().optional(),
 eligibleTemplateShare:probability.optional()
}).strict();
export const hexLootContentSchema=z.object({policy:hexLootSchema.nullable()}).strict();
export type FrozenHexLoot=z.infer<typeof hexLootSchema>;
const content=hexLootContentSchema.parse(raw);
export function freezeHexLoot():FrozenHexLoot|undefined{return content.policy?structuredClone(content.policy):undefined;}
export type HexLootSource={kind:'normal'|'elite'|'event'|'dungeonChest'|'dungeonBoss'|'rare';region:string;target?:string;first?:boolean};
export type HexAffixSource=Omit<HexLootSource,'kind'>&{kind:HexLootSource['kind']|'mistBoss'};
const tierOrder:GearQuality[]=['common','magic','rare','legendary'];
const affixSlots=new Set(['weapon','armor','helmet','boots','accessory','ring']);
export function eligibleHexGear(g:Gear){return !g.hex&&g.origin?.kind==='random'&&affixSlots.has(g.slot)&&g.quality!=='common';}
function chooseAffix(s:CharacterState,g:Gear,tier:GearQuality,source:HexAffixSource,policy:FrozenHexLoot,random:()=>number,downgrade=true){
 const firstRank=Math.min(tierOrder.indexOf(tier),tierOrder.indexOf(g.quality));
 for(let rank=firstRank;rank>=(downgrade?0:firstRank);rank--){
  const quality=tierOrder[rank],pool=policy.catalogue.map(id=>hexRuneById.get(id)).filter(r=>r?.tiers[quality]&&r.tiers[quality]!.requiredLevel<=(g.ilvl??g.requiredLevel??1)+policy.levelAhead&&hexPrerequisiteMet(s,r));
  if(!pool.length)continue;
  const biases=policy.biases[source.target??'']??[],weights=pool.map(r=>({r:r!,weight:r!.playstyle&&biases.includes(r!.playstyle)?policy.biasWeight:1})),sum=weights.reduce((n,x)=>n+x.weight,0);
  let pick=random()*sum;
  for(const {r,weight} of weights){pick-=weight;if(pick<0)return {rune:r.id,tier:quality};}
  return {rune:weights.at(-1)!.r.id,tier:quality};
 }
}
/** Mutates only freshly generated ordinary gear, before it is persisted. No
 * extra gear is created, and an already attached HEX is never rerolled. */
export function attachHexAffixes(s:CharacterState,gear:Gear[],source:HexAffixSource,policy:FrozenHexLoot|undefined,random=()=>randomInt(1000000)/1000000){
 if(!policy||policy.version!==2||!s.starsea||!(s.starsea.quests[policy.unlockTask]||s.starsea.done.includes(policy.unlockTask))||source.kind==='normal')return [];
 const area=source.region==='ss-map-boss-2'?policy.island:economyRegionOf(source.region);
 if(area!==policy.island)return [];
 if(['dungeonBoss','dungeonChest'].includes(source.kind)&&!policy.dungeons.includes(source.target??''))return [];
 if(source.kind==='rare'&&!policy.rares.includes(source.target??''))return [];
 const eligible=gear.filter(eligibleHexGear),attached:Gear[]=[];
 const finishQ03=()=>{
  s.hex??={awardedTasks:[]};s.hex.pity??={};s.hex.pity.q03=true;s.hex.pity.q03Pending=false;
  if(s.starsea!.quests[policy.unlockTask]&&!s.starsea!.done.includes(policy.unlockTask))s.hex.pity.q01=true;
 };
 if(source.kind==='mistBoss'){
  if(!source.first||s.hex?.pity?.q03||s.starsea.done.includes('HEX-Q03'))return [];
  s.hex??={awardedTasks:[]};s.hex.pity??={};s.hex.pity.q03Pending=true;
  for(const highest of [...eligible].sort((a,b)=>tierOrder.indexOf(b.quality)-tierOrder.indexOf(a.quality))){
   const hex=chooseAffix(s,highest,'magic',source,policy,random,false);if(!hex||hex.tier!=='magic')continue;
   highest.hex=hex;finishQ03();return [highest];
  }
  return [];
 }
 const probability=source.kind==='event'?Math.min(1,policy.sources.event*(source.first?policy.sources.firstEventMultiplier:1)):policy.sources[source.kind];
 for(const item of eligible){
  if(s.hex?.pity?.q03Pending&&!s.hex.pity.q03){
   const delayed=chooseAffix(s,item,'magic',source,policy,random,false);
   if(delayed?.tier==='magic'){item.hex=delayed;finishQ03();attached.push(item);continue;}
  }
  const pity=Boolean(s.starsea.quests[policy.unlockTask]&&!s.starsea.done.includes(policy.unlockTask)&&!s.hex?.pity?.q01);
  if(!pity&&(probability<=0||probability<1&&random()>=probability))continue;
  const magic=source.kind==='dungeonBoss'?policy.sources.dungeonMagic:source.kind==='rare'?policy.sources.rareMagic:0;
  const tier=!pity&&s.level>=policy.magicLevel&&magic>0&&random()<magic?'magic':'common';
  const hex=chooseAffix(s,item,tier,source,policy,random);if(!hex)continue;
  item.hex=hex;attached.push(item);
  if(pity){s.hex??={awardedTasks:[]};s.hex.pity??={};s.hex.pity.q01=true;}
 }
 return attached;
}
/** Historical v1 standalone selection retained for old audit fixtures only.
 * Current drop paths exclusively call attachHexAffixes. */
export function rollHexLoot(s:CharacterState,source:HexLootSource,policy:FrozenHexLoot|undefined,random=()=>randomInt(1000000)/1000000):{base:string;quality:'common'|'magic'}|undefined{
 if(!policy||!s.starsea||!(s.starsea.quests[policy.unlockTask]||s.starsea.done.includes(policy.unlockTask))||economyRegionOf(source.region)!==policy.island||source.kind==='normal')return;
 if(['dungeonBoss','dungeonChest'].includes(source.kind)&&!policy.dungeons.includes(source.target??''))return;
 if(source.kind==='rare'&&!policy.rares.includes(source.target??''))return;
 const p=source.kind==='event'?Math.min(1,policy.sources.event*(source.first?policy.sources.firstEventMultiplier:1)):policy.sources[source.kind];
 if(p<=0||p<1&&random()>=p)return;
 const magicChance=source.kind==='dungeonBoss'?policy.sources.dungeonMagic:source.kind==='rare'?policy.sources.rareMagic:0;
 const quality=s.level>=policy.magicLevel&&magicChance>0&&random()<magicChance?'magic':'common';
 const pool=policy.catalogue.map(id=>hexRuneById.get(id)).filter(r=>!!r&&r.tiers[quality].requiredLevel<=s.level+policy.levelAhead&&hexPrerequisiteMet(s,r));
 if(!pool.length)return;
 const bias=policy.biases[source.target??'']??[],weighted=pool.map(r=>({r:r!,weight:r!.playstyle&&bias.includes(r!.playstyle)?policy.biasWeight:1})),sum=weighted.reduce((n,x)=>n+x.weight,0);
 let choice=random()*sum;for(const {r,weight} of weighted){choice-=weight;if(choice<0)return {base:r.id,quality};}
 return {base:weighted.at(-1)!.r.id,quality};
}
/** Removed v1 standalone award entry. No current drop path calls this function. */
export async function awardHexLoot(c:PoolClient,s:CharacterState,sourceId:string,source:HexLootSource,position:{x:number;y:number},policy:FrozenHexLoot|undefined,direct=false){
 // D13 explicitly stops standalone rune issuance. Ordinary-gear attachment is
 // installed separately; historical frozen v1 sources must not create objects.
 return undefined;
}
