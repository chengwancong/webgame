import type {CharacterState,Receipt,Gear} from '../../../packages/contracts/index.ts';
import {hexRuneById,type HexRune} from '../../../packages/content/hex-runes.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {hexEquipmentOrder,HexGearError} from '../../../packages/rules/hex-runes.ts';

/** Drop/choice prerequisites are based on owned learned skills, not merely the
 * currently equipped bar. No client-supplied claim can enable a prerequisite. */
export function hexPrerequisiteMet(s:CharacterState,rune:HexRune){
 if(!rune.prereq)return true;
 const kinds=new Set(skillCatalog.filter(skill=>(s.skillRanks[skill.id]??0)>0).flatMap(skill=>skill.mechanics?.statuses.map(status=>status.kind)??[]));
 for(const slot of hexEquipmentOrder){
  const g=s.gear.find(g=>g.id===s.equipment[slot]),equipped=g?.hex?hexRuneById.get(g.hex.rune)?.tiers[g.hex.tier]:undefined;
  for(const r of equipped?.rules??[])if(r.action.type==='status')kinds.add(r.action.status);else if(r.action.type==='field')for(const kind of r.action.statuses??[])kinds.add(kind);
 }
 if(rune.prereq==='dot-source')return ['burn','poison','bleed'].some(k=>kinds.has(k as never));
 if(rune.prereq==='control-source')return ['stun','freeze','fear','root'].some(k=>kinds.has(k as never));
 // Other prerequisites are not used by the first-release catalogue. Do not
 // silently expose a future mechanism before its own eligibility is wired.
 return false;
}
/** Removed D12 operations, retained as explicit rejection for archived fixtures.
 * There are no current HTTP routes for either operation. */
export function grantHexQuestRewards(_s:CharacterState,_delta:Receipt['delta']):void{throw new HexGearError('INPUT','D13：海克斯不再使用选奖或碎片奖励。');}
export function chooseHexReward(_s:CharacterState,_offer:string,_candidate:string):Gear{throw new HexGearError('INPUT','D13：海克斯只随普通装备掉落。');}
