import {randomInt} from 'node:crypto';
import type {Gear} from '../contracts/index.ts';
import {generateGearAffixes,gearAffixConfig,type AffixRandom} from './affix-generator.ts';
export type ReforgeGear=Gear&{rerollSlot?:number};
const rng:AffixRandom={int:randomInt,float:Math.random};
/** Server-owned item transformation. The command transaction owns price,
 * revision, receipt deduplication and committing this returned copy. */
export function rerollSingleAffix(input:ReforgeGear,slot:number,random:AffixRandom=rng):ReforgeGear{
 if(!Number.isInteger(slot)||slot<0||slot>=input.affixes.length)throw Error('Invalid reforge slot');if(input.rerollSlot!==undefined&&input.rerollSlot!==slot)throw Error('Only the permanently selected reforge slot can change');
 const otherStats=new Set(input.affixes.filter((_,i)=>i!==slot).map(a=>a.stat)),rule=gearAffixConfig.quality[input.quality],config={...gearAffixConfig,pool:gearAffixConfig.pool.filter(a=>!otherStats.has(a.stat)),quality:{...gearAffixConfig.quality,[input.quality]:{...rule,count:[1,1] as [number,number],tiers:rule.tiers.length?rule.tiers:[1 as const]}}};
 const rolled=generateGearAffixes(input,3,random,config);if(rolled.length!==1)throw Error('No eligible reforge affix');const out=structuredClone(input);out.rerollSlot=slot;out.affixes[slot]={...rolled[0],id:input.affixes[slot].id};return out;
}
