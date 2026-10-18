import {z} from 'zod';
import source from '../content/combat-numerics.json';
const ratio=z.object({model:z.literal('ratio'),baseDenominator:z.number().positive(),damageDenominatorFactor:z.number().nonnegative(),maxReduction:z.number().min(0).max(1),minimumDamage:z.number().positive()}).strict();
const flat=z.object({model:z.literal('flat'),minimumDamage:z.number().positive()}).strict();
const hitRatio=z.object({model:z.literal('hit-ratio'),ratingScale:z.number().positive(),damageFactor:z.number().positive(),maxReduction:z.number().min(0).lt(1),minimumDamage:z.number().positive(),rounding:z.literal('nearest-with-cap-floor')}).strict();
export const armorRuleSchema=z.discriminatedUnion('model',[hitRatio,ratio,flat]);
export const combatNumerics=z.object({version:z.literal(3),armor:hitRatio,legacyArmor:flat,reinforcement:z.object({maxRank:z.number().int().positive(),primaryRatioPerRank:z.number().nonnegative(),rounding:z.literal('ceil')}).strict()}).strict().parse(source);
export type ArmorRule=z.infer<typeof armorRuleSchema>;
export function armorMitigation(amount:number,armor:number,rule:ArmorRule=combatNumerics.armor){
 if(!Number.isFinite(amount)||!Number.isFinite(armor)||amount<0||armor<0)throw Error('Invalid armor calculation input');
 if(amount===0)return {damage:0,reduction:0};
 if(rule.model==='flat'){const damage=Math.max(rule.minimumDamage,amount-armor);return {damage,reduction:Math.max(0,1-damage/amount)};}
 // Recorded v2 instances keep their original curve and integer rounding.
 if(rule.model==='ratio'){
  const reduction=Math.min(rule.maxReduction,armor/(armor+rule.baseDenominator+amount*rule.damageDenominatorFactor));
  return {damage:Math.max(rule.minimumDamage,Math.round(amount*(1-reduction))),reduction};
 }
 if(rule.model==='hit-ratio'){
  // Divide by damage first: the dimensionless ratio also avoids overflow at large ratings.
  const relativeRating=armor/amount*rule.ratingScale;
  const reduction=Math.min(rule.maxReduction,1-rule.damageFactor/(relativeRating+rule.damageFactor));
  // Keep normal rounding; only the cap floor rounds up so integer damage cannot exceed the reduction bound.
  return {damage:Math.max(rule.minimumDamage,Math.ceil(amount*(1-rule.maxReduction)),Math.round(amount*(1-reduction))),reduction};
 }
 throw Error('Unknown armor model');
}
export function primaryReinforcement(base:number,minimumPerRank:number,rank:number,maxRank=combatNumerics.reinforcement.maxRank){
 const r=combatNumerics.reinforcement;if(!Number.isInteger(rank)||rank<0||rank>maxRank)throw Error('Invalid reinforcement rank');
 return rank*Math.max(minimumPerRank,Math.ceil(base*r.primaryRatioPerRank));
}
