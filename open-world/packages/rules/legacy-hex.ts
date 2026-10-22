import {gearSchema,type CharacterState,type Gear,type GearQuality} from '../contracts/index.ts';
// Historical B02/D11 fixtures and non-destructive old-save recognition only.
// No current HTTP route issues or equips these removed standalone objects.
import {z} from 'zod';
const hexSlots=['hex1','hex2'] as const;
type HexSlot=typeof hexSlots[number];
const hexSlotSchema=z.enum(hexSlots);
export const isLegacyHexSlot=(slot:string):slot is HexSlot=>slot==='hex1'||slot==='hex2';
const isHexSlot=isLegacyHexSlot;
import {hexRuneById} from '../content/hex-runes.ts';
import {tasks} from '../content/task-tables.ts';

export class HexGearError extends Error{constructor(public code:'GEAR'|'INPUT'|'HEX_SLOT_LOCKED',message:string){super(message);}}
export function hexSlotAccess(s:CharacterState){
 return Object.fromEntries(hexSlots.map(slot=>{
  const task=tasks.find(t=>(t as any).reward_hex_slot===slot);
  // The historical town-only campaign has no starsea quests. Keep its sample
  // saves readable/equippable; the current starsea campaign uses task gates.
  return [slot,{unlocked:!s.starsea||!task||s.starsea.done.includes(task.id),...(task?{task:task.id}:{})}];
 })) as Record<HexSlot,{unlocked:boolean;task?:string}>;
}
export function hexDefinition(g:Gear){
 const rune=hexRuneById.get(g.base);
 if(!rune||!isHexSlot(g.slot))throw new HexGearError('GEAR','这不是海克斯装备。');
 if(g.rank!==0||g.attack!==0||g.armor!==0||g.effect!=='none'||g.affixes.length||g.inscription||g.aspectId||g.mainStat||g.setId)throw new HexGearError('GEAR','海克斯装备不支持普通装备属性与强化。');
 if(!rune.tiers[g.quality])throw new HexGearError('GEAR','该海克斯品质尚未开放。');
 return rune;
}
/** Controlled issuance for the sample. Natural loot remains disabled until its weights are approved. */
export function makeHexGear(base:string,quality:GearQuality,id:string):Gear{
 const rune=hexRuneById.get(base);if(!rune)throw new HexGearError('GEAR','海克斯定义不存在。');
 const tier=rune.tiers[quality];if(!tier)throw new HexGearError('GEAR','该海克斯品质尚未开放。');
 return gearSchema.parse({id,base,slot:'hex1',name:rune.name,quality,requiredLevel:tier.requiredLevel,rank:0,locked:false,attack:0,armor:0,effect:'none',affixes:[]});
}
function selectedSlot(slot:string):HexSlot{
 const parsed=hexSlotSchema.safeParse(slot);if(!parsed.success)throw new HexGearError('INPUT','海克斯槽位无效。');return parsed.data;
}
/** Application layer must hold the character lock and perform lease/revision/idempotency checks. */
export function equipHex(s:CharacterState,gearId:string,slot:string){
 const target=selectedSlot(slot),g=s.gear.find(g=>g.id===gearId);if(!g)throw new HexGearError('GEAR','装备不在行囊中。');
 if(!hexSlotAccess(s)[target].unlocked)throw new HexGearError('HEX_SLOT_LOCKED','请先完成对应的海克斯引导任务。');
 const rune=hexDefinition(g);
 if(s.level<rune.tiers[g.quality]!.requiredLevel)throw new HexGearError('GEAR','角色等级不足。');
 for(const other of hexSlots){const existing=s.gear.find(g=>g.id===s.equipment[other]);
  if(other!==target&&existing&&existing.id!==g.id&&hexDefinition(existing).exclusiveGroup===rune.exclusiveGroup)throw new HexGearError('GEAR','同类海克斯不能同时装备。');
 }
 for(const other of hexSlots)if(s.equipment[other]===g.id)delete s.equipment[other];
 s.equipment[target]=g.id;
}
export function unequipHex(s:CharacterState,slot:string){delete s.equipment[selectedSlot(slot)];}
export function collectHexRules(s:CharacterState){
 const groups=new Set<string>();
 const firstRelease=new Set(['hex-void-rift','hex-aftershock','hex-detonation-sigil','hex-mark-relay','hex-footfall-heal','hex-control-to-shield','hex-cast-hit-relay','hex-bee-volley']);
 const equipped=hexSlots.map(slot=>s.gear.find(g=>g.id===s.equipment[slot])).filter((g):g is Gear=>!!g).map(hexDefinition);
 const resonance=equipped.length===2&&equipped.every(r=>firstRelease.has(r.id))&&equipped[0].playstyle&&equipped[0].playstyle===equipped[1].playstyle;
 return hexSlots.flatMap(slot=>{
  const id=s.equipment[slot];if(!id)return [];
  const gear=s.gear.find(g=>g.id===id);if(!gear)throw new HexGearError('GEAR','已装备海克斯缺失。');
  const rune=hexDefinition(gear);
  if(groups.has(rune.exclusiveGroup))throw new HexGearError('GEAR','同类海克斯重复装备。');groups.add(rune.exclusiveGroup);
  return rune.tiers[gear.quality]!.rules.map(rule=>{
   const resolved={...structuredClone(rule),source:gear.id};
   if(resonance)for(const path of rule.scale){
    const keys=path.split('.');let parent:any=resolved;
    for(const key of keys.slice(0,-1))parent=parent[key];
    parent[keys.at(-1)!]*=1.1;
   }
   return resolved;
  });
 });
}
