import type {CharacterState} from '../contracts/index.ts';
import type {ComboRule} from '../contracts/weapon-combos.ts';
import type {WeaponType} from '../contracts/weapons.ts';
import {innateCombos,comboAspectRules} from '../content/weapon-combos.ts';
import {ensureProgression} from './deep-progression.ts';

/** Codex rank scales combo ratios by +10% per rank above 1 (same rule as other aspects). */
function scaled(rule:ComboRule,rank:number):ComboRule{
 const k=1+Math.max(0,rank-1)*.1,a=structuredClone(rule.action);
 if('ratio' in a&&a.ratio>0)a.ratio=Math.round(a.ratio*k*1000)/1000;
 return {...rule,action:a};
}
/** Equipped combo aspects with their codex rank (imprint or legendary gear roll). */
export function activeComboAspects(s:CharacterState){
 const p=ensureProgression(s),equipped=new Set(Object.values(s.equipment)),out=new Map<string,number>();
 for(const [gearId,aspectId] of Object.entries(p.imprints))if(equipped.has(gearId)&&comboAspectRules.has(aspectId))out.set(aspectId,Math.max(out.get(aspectId)??0,p.codex[aspectId]??1));
 for(const g of s.gear)if(equipped.has(g.id)&&g.quality==='legendary'&&g.aspectId&&!p.imprints[g.id]&&comboAspectRules.has(g.aspectId))out.set(g.aspectId,Math.max(out.get(g.aspectId)??0,Math.max(1,p.codex[g.aspectId]??0)));
 return out;
}
/** Single owner of the combo list carried in resolved Stats: innate school + matching combo aspects. */
export function resolveWeaponCombos(s:CharacterState,weapon:WeaponType|null|undefined):ComboRule[]{
 if(!weapon)return [];
 const rules=innateCombos.filter(r=>r.weapons.includes(weapon)).map(r=>structuredClone(r));
 for(const [id,rank] of activeComboAspects(s)){const rule=comboAspectRules.get(id)!;if(rule.weapons.includes(weapon))rules.push(scaled(rule,rank));}
 return rules;
}
