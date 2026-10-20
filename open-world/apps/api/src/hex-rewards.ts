import {randomInt,randomUUID} from 'node:crypto';
import type {CharacterState,Receipt} from '../../../packages/contracts/index.ts';
import {hexPlaystyles} from '../../../packages/contracts/hex-runes.ts';
import {hexRunes,hexRuneById,type HexRune} from '../../../packages/content/hex-runes.ts';
import {tasks} from '../../../packages/content/task-tables.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {makeHexGear,HexGearError} from '../../../packages/rules/hex-runes.ts';

/** Drop/choice prerequisites are based on owned learned skills, not merely the
 * currently equipped bar. No client-supplied claim can enable a prerequisite. */
export function hexPrerequisiteMet(s:CharacterState,rune:HexRune){
 if(!rune.prereq)return true;
 const kinds=new Set(skillCatalog.filter(skill=>(s.skillRanks[skill.id]??0)>0).flatMap(skill=>skill.mechanics?.statuses.map(status=>status.kind)??[]));
 for(const slot of ['hex1','hex2'] as const){
  const g=s.gear.find(g=>g.id===s.equipment[slot]),equipped=g?hexRuneById.get(g.base)?.tiers[g.quality]:undefined;
  for(const r of equipped?.rules??[])if(r.action.type==='status')kinds.add(r.action.status);else if(r.action.type==='field')for(const kind of r.action.statuses??[])kinds.add(kind);
 }
 if(rune.prereq==='dot-source')return ['burn','poison','bleed'].some(k=>kinds.has(k as never));
 if(rune.prereq==='control-source')return ['stun','freeze','fear','root'].some(k=>kinds.has(k as never));
 // Other prerequisites are not used by the first-release catalogue. Do not
 // silently expose a future mechanism before its own eligibility is wired.
 return false;
}
/** Frozen, visible choices are stored once in the same character transaction as
 * quest completion; retrying a command or reloading never rerolls them. */
export function grantHexQuestRewards(s:CharacterState,delta:Receipt['delta']){
 for(const row of tasks){
  if(!row.reward_hex_choice&&!row.reward_hex_shards)continue;
  if(!s.starsea?.done.includes(row.id)||s.hex?.awardedTasks.includes(row.id))continue;
  const candidates:{id:string;base:string;quality:'common'|'magic';playstyle:typeof hexPlaystyles[number]}[]=[];
  if(row.reward_hex_choice){
   const {quality,count}=row.reward_hex_choice;
   const groups=hexPlaystyles.map(style=>hexRunes.filter(r=>r.playstyle===style&&r.tiers[quality]&&hexPrerequisiteMet(s,r))).filter(group=>group.length);
   if(groups.length<count)throw new HexGearError('GEAR','海克斯选奖缺少可用打法，请稍后重试。');
   while(candidates.length<count){const group=groups.splice(randomInt(groups.length),1)[0],rune=group[randomInt(group.length)];candidates.push({id:randomUUID(),base:rune.id,quality,playstyle:rune.playstyle!});}
  }
  s.hex??={shards:0,awardedTasks:[],offers:[]};
  if(candidates.length)s.hex.offers.push({id:row.id,task:row.id,candidates});
  if(row.reward_hex_shards){s.hex.shards+=row.reward_hex_shards;delta.materials??={};delta.materials['hex-echo-shard']=(delta.materials['hex-echo-shard']??0)+row.reward_hex_shards;}
  s.hex.awardedTasks.push(row.id);
 }
}
export function chooseHexReward(s:CharacterState,offerId:string,candidateId:string){
 const offer=s.hex?.offers.find(o=>o.id===offerId);
 if(!offer||offer.selected)throw new HexGearError('GEAR','海克斯奖励不存在或已经选取。');
 const candidate=offer.candidates.find(c=>c.id===candidateId);
 if(!candidate)throw new HexGearError('INPUT','请选择本次奖励中的海克斯。');
 const gear=makeHexGear(candidate.base,candidate.quality,candidate.id);
 s.gear.push(gear);offer.selected=candidate.id;return gear;
}
