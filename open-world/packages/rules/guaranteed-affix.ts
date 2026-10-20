import type {Gear} from '../contracts/index.ts';
import {gearAffixConfig,generateGearAffixes,maxAffixTierForItemLevel,type AffixRandom} from './affix-generator.ts';
/** Shared crafting/declared reward guarantee; preserves the existing low-level fallback and RNG order. */
export function guaranteedAffixPool(stat:string,level:number,config=gearAffixConfig){
 const candidates=config.pool.filter(row=>row.stat===stat),allowed=candidates.filter(row=>row.tier<=maxAffixTierForItemLevel(level)),minimum=[...candidates].sort((a,b)=>a.tier-b.tier)[0];
 if(!minimum)throw Error('Missing guaranteed affix '+stat);
 return {scaled:allowed.length>0,pool:allowed.length?allowed:[{...minimum,maxValue:minimum.minValue}]};
}
export function generateGuaranteedAffix(g:Pick<Gear,'slot'|'ilvl'>,stat:string,rng?:AffixRandom,config=gearAffixConfig){
 const {pool,scaled}=guaranteedAffixPool(stat,g.ilvl!,config);
 const forced={...config,pool,quality:{...config.quality,magic:{count:[1,1] as [number,number],tiers:config.quality.rare.tiers}}};
 return generateGearAffixes({quality:'magic',slot:g.slot,...(scaled?{ilvl:g.ilvl}:{})},3,rng,forced)[0];
}
