import {setEffect} from '../content/set-effects.ts';
import {collectionEquipment} from '../content/equipment-runtime.ts';
import {gearSetIdentity} from '../content/set-effects.ts';
import {getEquippedSets} from '../simulation/set-calculator.ts';
import type {Gear,Stats} from '../contracts/index.ts';
import {overrideEffectRules,type AtomReference} from './atom-parts.ts';
import type {EffectRule} from '../contracts/effects.ts';
const precise=(v:number)=>Math.round(v*1e6)/1e6;
export function unifiedSetParts(worn:Gear[],withoutFour:readonly string[]=[]){
 const stats:{source:string;phase:'set';stat:string;value:number}[]=[],atoms:AtomReference[]=[],rules:EffectRule[]=[],conditional:NonNullable<Stats['conditional']>=[],zones:{source:string;zone:NonNullable<Stats['zones']>[number]}[]=[];
 let dotCrit=false;
 for(const info of getEquippedSets(worn)){
  const definition=setEffect(info.setId);if(!definition)continue;
  const art=Math.min(...worn.filter(g=>gearSetIdentity(g)===info.setId).map(g=>collectionEquipment(g.base)?.tier??1)),scale=definition.artStageScale[art-1];
  for(const [count,part] of [[2,definition.two],[4,definition.four]] as const){if(info.count<count||count===4&&withoutFour.includes(definition.id))continue;const source=definition.id+':'+count;
   stats.push(...part.stats.map(p=>({source,phase:'set' as const,...p,value:precise(p.value*scale)})));
   atoms.push(...part.atoms.map(a=>({...a,tier:a.tier*scale,source:definition.id})));
   rules.push(...part.rules.flatMap(r=>overrideEffectRules([{...structuredClone(r),source:definition.id}],r.scale.length?[{target:r.id,mul:Object.fromEntries(r.scale.map(path=>[path,scale]))}]:[])));
   conditional.push(...part.conditional.map(c=>({...c,id:source+':'+c.id,value:precise(c.pool==='stat'?1+(c.value-1)*scale:c.value*scale)})));
   zones.push(...part.zones.map(zone=>({source,zone:{...zone,value:precise(zone.kind==='mult'?1+(zone.value-1)*scale:zone.value*scale)}})));
   dotCrit ||=part.flags?.dotCrit??false;
  }
 }
 return {stats,atoms,rules,conditional,zones,dotCrit};
}
