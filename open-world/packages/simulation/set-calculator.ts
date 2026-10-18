import {describeUnifiedBonuses} from '../rules/set-bonus-descriptions.ts';
import {statRegistry} from '../contracts/stats.ts';
import {tagAffixStats} from '../contracts/affix-units.ts';
import {addZone} from '../rules/damage-zones.ts';
import {skillTagNames} from '../content/skill-tags.ts';
import type {Stats,Gear,GearSet,SetBonus,EquippedSetInfo} from '../contracts/index.ts';
import {gearSets,legacyGearSets} from '../content/gear-sets.ts';
import {gearSetIdentity} from '../content/set-effects.ts';
import {collectionEquipment} from '../content/equipment-runtime.ts';

// 应用词缀加成到属性
export function applyStatBonuses(stats:Stats,bonuses:{stat:string;value:number}[],definitions:typeof statRegistry=statRegistry):Stats{
 const result={...stats};
 for(const bonus of bonuses){const def=definitions.find(d=>d.id===bonus.stat);if(!def)throw Error('Unknown stat '+bonus.stat);
  if(def.pool==='type'&&def.tag)result.zones=addZone([...(result.zones??[]).map(z=>({...z}))],{id:'affix-'+def.tag,label:(skillTagNames as Record<string,string>)[def.tag]+'伤害',kind:'add',value:bonus.value,tags:[def.tag]});
  else {const numeric=result as unknown as Record<string,number>;numeric[def.id]=(numeric[def.id]??def.default)+bonus.value;if(def.cap!==null)numeric[def.id]=Math.min(def.cap,numeric[def.id]);}
 }return result;
}
export function applyAffixBonuses(stats:Stats,gear:Gear):Stats{return applyStatBonuses(stats,gear.affixes??[]);}

// 计算已装备套装信息
export function getEquippedSets(worn:Gear[],legacy=false):EquippedSetInfo[]{
 const definitions=legacy?legacyGearSets:gearSets,groups=new Map<string,Gear[]>();
 for(const g of worn){const id=legacy?g.setId:gearSetIdentity(g);if(!id||!definitions.some(s=>s.id===id))continue;const group=groups.get(id)??[];if(!group.some(old=>old.base===g.base))group.push(g);groups.set(id,group);}
 return [...groups].map(([setId,items])=>{const set=definitions.find(s=>s.id===setId)!,unified=!legacy&&setId.startsWith('set-'),artStage=Math.min(...items.map(g=>collectionEquipment(g.base)?.tier??1));return {setId,setName:set.name,count:items.length,total:unified?6:set.pieces.length,activeBonuses:set.bonuses.filter(b=>items.length>=b.pieces).map(b=>b.pieces),...(unified?{artStage,bonusDescriptions:describeUnifiedBonuses(setId,artStage)}:{})};});
}

// 应用套装加成到属性
export function applySetBonuses(stats:Stats,worn:Gear[]):Stats{
 const equippedSets=getEquippedSets(worn,true);
 let result={...stats};
 
 for(const setInfo of equippedSets){
  const set=legacyGearSets.find(s=>s.id===setInfo.setId);
  if(!set)continue;
  
  for(const pieceCount of setInfo.activeBonuses){
   const bonus=set.bonuses.find(b=>b.pieces===pieceCount);
   if(!bonus)continue;
   for(const zone of bonus.zones??[])result.zones=addZone([...(result.zones??[]).map(z=>({...z}))],zone);
   if(!bonus.stats)continue;
   
   // Old set HP values below one are percentages; preserve their ordering.
   const {hp,...flat}=bonus.stats;
   result=applyStatBonuses(result,Object.entries(flat).flatMap(([stat,value])=>typeof value==='number'?[{stat,value}]:[]));
   if(hp)result.hp=hp<1?Math.round(result.hp*(1+hp)):result.hp+hp;
  }
 }
 
 return result;
}
