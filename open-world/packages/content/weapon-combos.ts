import {z} from 'zod';
import {comboRuleSchema,comboActionSchema,type ComboRule} from '../contracts/weapon-combos.ts';
import {effectRuleSchema,executableRule,type EffectRule} from '../contracts/effects.ts';
import type {WeaponType} from '../contracts/weapons.ts';
import source from './weapon-combo-rules.json';
export const weaponSchools:Record<WeaponType,{name:string;summary:string}>={
 sword:{name:'剑势流',summary:'连击释放剑气，暴击放血，残影追斩'},
 hammer:{name:'震地流',summary:'击杀引发余震，破甲后重击'},
 axe:{name:'震地流',summary:'击杀引发余震，破甲后重击'},
 bow:{name:'裂矢流',summary:'连续命中分裂箭矢，迟缓与中毒是弱点'},
 staff:{name:'元素流',summary:'火焰点燃，寒冰击中燃烧或迟缓目标引发碎冰'},
 wand:{name:'控场流',summary:'命中感电，控制中的敌人更脆弱'},
 hidden:{name:'回旋流',summary:'击杀迸出回旋刃，淬毒与流血叠加'},
};

export const comboEffectRules=[...source.innate,...source.aspects.map(a=>a.rule)].map(r=>effectRuleSchema.parse(r));
function legacy(r:EffectRule):ComboRule{const {when,filter,vfxKey,tier,rule,...base}=executableRule(r);const shape=comboActionSchema.options.find(s=>s.shape.type.value===r.action.type)!.shape;const action=Object.fromEntries(Object.entries(r.action).filter(([key])=>key in shape));const status=when.find(c=>c.kind==='target_status');return comboRuleSchema.parse({...base,action,...(status?.kind==='target_status'?{targetStatus:status.statuses}:{})});}
export const innateCombos=source.innate.map(r=>legacy(effectRuleSchema.parse(r)));
export type ComboAspectSource={key:string;name:string;slot:'weapon'|'armor'|'accessory'|'core';requiredLevel:number;rule:z.input<typeof comboRuleSchema>};
export const comboAspectSources:ComboAspectSource[]=source.aspects.map(a=>({...a,slot:a.slot as ComboAspectSource['slot'],rule:legacy(effectRuleSchema.parse(a.rule))}));
export const comboAspectRules=new Map(comboAspectSources.map(a=>['aspect-combo-'+a.key,comboRuleSchema.parse(a.rule)]));
