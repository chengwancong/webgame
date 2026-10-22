import type {CharacterState,Gear,GearQuality} from '../contracts/index.ts';
import type {HexActive,HexEquipPreview} from '../contracts/hex-runes.ts';
import {hexRuneById} from '../content/hex-runes.ts';
import {hexPolicy} from '../content/hex-policy.ts';
// Retained only for historical fixtures/recognition. Current HTTP routes do not
// call these; standalone objects are excluded from the current public snapshot.
export {HexGearError,hexDefinition,makeHexGear,equipHex,unequipHex,hexSlotAccess} from './legacy-hex.ts';
export const hexEquipmentOrder=['weapon','armor','helmet','boots','accessory','ring'] as const;
const qualityRank:Record<GearQuality,number>={common:0,magic:1,rare:2,legendary:3};
const lethalSave=new Set(['hex-last-stand','hex-borrowed-life','hex-panic-room','hex-fury-undying']);
function candidates(s:Pick<CharacterState,'gear'|'equipment'>){
 return hexEquipmentOrder.flatMap((slot,index)=>{
  const gear=s.gear.find(g=>g.id===s.equipment[slot]);if(!gear?.hex)return [];
  const rune=hexRuneById.get(gear.hex.rune),tier=rune?.tiers[gear.hex.tier];
  if(!rune||!tier||qualityRank[gear.hex.tier]>qualityRank[gear.quality]||gear.origin?.kind!=='random')return [];
  return [{gear,rune,tier,index}];
 });
}
/** One server owner for selection; clients consume this projection verbatim. */
export function resolveHexActive(s:Pick<CharacterState,'gear'|'equipment'|'level'>):HexActive[]{
 const sorted=candidates(s).sort((a,b)=>qualityRank[b.gear.hex!.tier]-qualityRank[a.gear.hex!.tier]||a.index-b.index),groups=new Set<string>(),out:HexActive[]=[];
 let saved=false;
 for(const {gear,rune,tier} of sorted){
  if(s.level<tier.requiredLevel){out.push({gear:gear.id,rune:rune.id,tier:gear.hex!.tier,active:false,reason:'level'});continue;}
  const duplicate=groups.has(rune.exclusiveGroup),lethal=lethalSave.has(rune.id)||rune.id==='hex-adversity-song'&&gear.hex!.tier==='legendary',group=!duplicate&&lethal&&saved;
  if(!duplicate&&!group){groups.add(rune.exclusiveGroup);if(lethal)saved=true;}
  out.push({gear:gear.id,rune:rune.id,tier:gear.hex!.tier,active:!duplicate&&!group,...(duplicate?{reason:'duplicate' as const}:group?{reason:'group' as const}:{})});
 }
 const styles=new Map<string,number>();
 for(const row of out.filter(r=>r.active)){const style=hexRuneById.get(row.rune)!.playstyle;if(style)styles.set(style,(styles.get(style)??0)+1);}
 return candidates(s).map(({gear,rune})=>{
  const row=out.find(a=>a.gear===gear.id)!;
  return row.active&&hexPolicy&&rune.playstyle&&(styles.get(rune.playstyle)??0)>=hexPolicy.resonanceMin?{...row,resonance:hexPolicy.resonanceMultiplier}:row;
 });
}
export function collectHexRules(s:CharacterState){
 const active=resolveHexActive(s).filter(x=>x.active);
 return active.flatMap(row=>{
  const rune=hexRuneById.get(row.rune)!;
  return rune.tiers[row.tier]!.rules.map(rule=>{
   const resolved={...structuredClone(rule),source:row.gear,hexMechanism:rune.id};
   if(row.resonance)for(const path of rule.scale){
    const keys=path.split('.');let parent:any=resolved;for(const key of keys.slice(0,-1))parent=parent[key];
    parent[keys.at(-1)!]*=row.resonance;
   }
   return resolved;
  });
 });
}
export function isHexAffixedGear(gear:Gear){return !!gear.hex&&hexRuneById.has(gear.hex.rune);}
export function hexEquipPreview(s:CharacterState,gear:Gear):HexEquipPreview{
 const current=resolveHexActive(s),equipped=resolveHexActive({...s,equipment:{...s.equipment,[gear.slot]:gear.id}});
 const ids=[...new Set([...current,...equipped].map(r=>r.gear))];
 return {current,equipped,changes:ids.map(id=>{
  const before=current.find(r=>r.gear===id),after=equipped.find(r=>r.gear===id),row=after??before!;
  return {gear:id,rune:row.rune,tier:row.tier,change:!before?.active&&after?.active?'activate':before?.active&&!after?.active?'deactivate':'unchanged',...(after?.reason?{reason:after.reason}:{})};
 })};
}
