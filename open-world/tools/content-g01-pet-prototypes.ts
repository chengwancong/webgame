/** Isolated design prototypes, never imported by production build resolution. */
import {effectRuleSchema,type EffectRule} from '../packages/contracts/effects.ts';
import {petActiveRule} from '../packages/rules/zhangjian-build.ts';
import {petFamilyById} from '../packages/content/zhangjian.ts';
import type {PetFlow} from '../packages/contracts/zhangjian.ts';
export function petDesignPrototype(family:'wind-free'|'wind-light'|'wind-heavy',level=1,flow:PetFlow='blade'):EffectRule{
 const {activeProfile,...legacyFamily}=petFamilyById.get(family)!;
 const rule=structuredClone(petActiveRule(legacyFamily,level,flow));
 if(rule.action.type!=='nova')throw Error('Prototype basis changed');
 const damageType=rule.action.damageType;
 if(family==='wind-free'){rule.every=60;rule.action={...rule.action,ratio:rule.action.ratio/2,radius:0,maxTargets:1};rule.description='每2秒攻击最近的一个目标';}
 if(family==='wind-light'){rule.every=120;rule.action={type:'shield',ratio:.04,ref:'maxHp',duration:90};rule.description='每4秒获得持续3秒的护盾，代替宠物攻击';}
 if(family==='wind-heavy'){const first=rule.action.ratio/(1+.7+.49);rule.every=120;rule.action={type:'nova',ratio:first,radius:0,maxTargets:1,damageType,ref:'attack',at:'target'};rule.after=[{type:'arc',ratio:first*.7,count:2,range:4,damageType,decay:.7}];rule.description='每4秒连锁攻击最多3个不同目标';}
 return effectRuleSchema.parse(rule);
}
