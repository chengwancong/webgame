import assert from 'node:assert/strict';
import {standard,SCHEDULE} from '../standard-player-model.ts';
import {resolveBuild,gearBases,instantiateGearTemplate} from '../../packages/rules/index.ts';
import {collectionEquipment} from '../../packages/content/equipment-runtime.ts';
import {applyItemPower} from '../../packages/rules/item-power.ts';
import {assignMainStat} from '../../packages/rules/main-stats.ts';
import {gearAffixConfig} from '../../packages/rules/affix-generator.ts';
import {aspectDefinitions} from '../../packages/content/deep-progression.ts';
import {skillCatalog} from '../../packages/content/index.ts';
import {skillTags} from '../../packages/content/skill-tags.ts';
import {effectAtomById} from '../../packages/content/effect-atoms.ts';
import type {CharacterState,Stats} from '../../packages/contracts/index.ts';
import type {ResolvedPlayer} from './bench.ts';
import {pacingBuild,pacingProfiles} from '../pacing/profiles.ts';
export const standardLevels=[1,5,10,15,20,25,30,35,40,45,50,55,60];
export function resolvePlayer(id:string,state:CharacterState,selection:Parameters<typeof resolveBuild>[1]={}):ResolvedPlayer{
 const b=resolveBuild(state,selection),base={stats:b.stats,skills:b.resolvedSkills};
 assert.deepEqual(base.skills.map(s=>s.id),state.skills,'请求技能与实际技能必须相同');
 const build=base;
 return {id,level:state.level,skillRanks:structuredClone(state.skillRanks),build};
}
export function standardState(level:number,family:'sword'|'staff'|'hidden'='sword'){
 const state=standard(level);
 if(family!=='sword'){
  state.skills=family==='staff'?['frost','ember','ward']:['throwing_knife','fan_of_knives','ward'];
  state.skillRanks=Object.fromEntries(state.skills.map(id=>[id,SCHEDULE.skillRank(level)]));
  if(family==='staff'&&state.progression?.talents['damage-martial']){state.progression.talents['damage-spell']=state.progression.talents['damage-martial'];delete state.progression.talents['damage-martial'];}
  const tags=new Set<string>(state.skills.flatMap(id=>skillTags(skillCatalog.find(s=>s.id===id)!))),setN=SCHEDULE.setPieces(level);
  for(let i=0;i<6;i++){const old=state.gear[i],art=collectionEquipment(old.base),convert=old.slot==='weapon'||i<setN;if(convert){const template=gearBases.find(g=>g.slot===old.slot&&collectionEquipment(g.base)?.family===family&&collectionEquipment(g.base)?.tier===(art?.tier??1)&&collectionEquipment(g.base)?.series==='standard');assert(template,'缺少同档武器族装备模板');const next=applyItemPower(instantiateGearTemplate(template,old.id,old.quality),old.ilvl??Math.max(1,level-SCHEDULE.gearLag));next.affixes=structuredClone(old.affixes);next.rank=old.rank;next.locked=old.locked;const mains=gearAffixConfig.mainStats.filter(m=>m.slot===next.slot),common=[...mains].sort((a,b)=>b.weight-a.weight)[0],offset=common?mains.slice(0,mains.indexOf(common)).reduce((n,r)=>n+r.weight,0):0;assignMainStat(next,next.ilvl!,{int:(min,max)=>Math.min(max-1,Math.max(min,offset)),float:()=>.5});state.gear[i]=next;}
   const gear=state.gear[i];if(gear.quality==='legendary'){const fits=aspectDefinitions.filter(a=>!a.legacy&&a.dropEnabled&&a.slots.includes(gear.slot)&&a.requiredLevel<=level&&(!a.weapons.length||a.weapons.includes(family))),relevant=fits.filter(a=>a.parts?.patches.some(p=>p.skills?.some(s=>state.skills.includes(s))||p.tags?.some(t=>tags.has(t)))||a.parts?.atoms.some(a=>effectAtomById.get(a.id)?.filter.tags?.some(t=>tags.has(t))));const chosen=i%2===0&&relevant.length?relevant[i%relevant.length]:fits[i%fits.length];if(chosen){gear.aspectId=chosen.id;state.progression!.codex[chosen.id]=SCHEDULE.codexRank(level);}else delete gear.aspectId;}
  }
  state.progression!.skillAwakenings=Object.fromEntries(state.skills.filter(s=>state.skillRanks[s]>=5&&SCHEDULE.skillAwaken(level)).map(s=>[s,'power']));
 }
 return state;
}
export function referencePlayer(id:string){const p=pacingProfiles.find(p=>p.id===id);assert(p,'未知参考构筑');const assembled=pacingBuild(p);return {state:assembled.state,profile:p,player:resolvePlayer(id,assembled.state)};}
