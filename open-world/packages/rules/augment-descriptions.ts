import type {augments} from '../content/augments.ts';
import {effectAtoms} from '../content/effect-atoms.ts';
import type {EffectRule} from '../contracts/effects.ts';
import {resolveAtomParts} from './atom-parts.ts';
import {scaledDescription} from './set-bonus-descriptions.ts';
/** Display the actually granted single-atom tier using the frozen definitions.
 * Special resonance/override cards retain their dedicated catalogue text. */
export function augmentDescription(definition:typeof augments[number],atoms:EffectRule[]=effectAtoms){
 const p=definition.parts,onlyAtoms=p.atoms.length>0&&p.atoms.every(a=>!a.set)&&[p.stats,p.zones,p.rules,p.patches,p.overrides,p.conditional,p.conversions,p.slotPatches].every(list=>list.length===0)&&!p.flags&&!p.statusOverrides&&!p.statusMultipliers&&!p.statMultipliers&&!p.statOverrides&&!p.loadoutLimit&&!p.fullSet;
 if(!onlyAtoms)return definition.description;
 const resolved=resolveAtomParts(p.atoms.map(a=>({...a,source:definition.id})),[],atoms);
 return resolved.map(r=>{const base=atoms.find(a=>a.id===r.id)!;return '获得'+r.name+'（'+r.tier+'档）：'+scaledDescription(base,r);}).join('；');
}
