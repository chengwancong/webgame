import type {CharacterState} from '../contracts/index.ts';
import type {BuildSourceParts} from '../contracts/build-sources.ts';
import {newAspectById} from '../content/aspects.ts';
import {gearWeaponType} from './weapon-skills.ts';
import {overrideEffectRules} from './atom-parts.ts';
export function activeNewAspects(s:CharacterState){const worn=new Set(Object.values(s.equipment)),main=gearWeaponType(s.gear.find(g=>g.id===s.equipment.weapon)),chosen=new Map<string,number>();for(const g of s.gear){if(!worn.has(g.id))continue;const id=s.progression?.imprints[g.id]??(g.quality==='legendary'?g.aspectId:undefined),a=id?newAspectById.get(id):undefined;if(!a||!a.slots.includes(g.slot)||a.weapons.length&&(!main||!a.weapons.includes(main)))continue;chosen.set(a.id,Math.max(chosen.get(a.id)??0,s.progression?.codex[a.id]??1));}return [...chosen].map(([id,rank])=>({definition:newAspectById.get(id)!,rank}));}
const precise=(v:number)=>Math.round(v*1e6)/1e6;
/** Discrete counts/permissions stay fixed; declared numeric rule paths and
 * bonus magnitudes follow the existing +10% per codex rank convention. */
export function scaleAspectParts(parts:BuildSourceParts,rank:number):BuildSourceParts{const out=structuredClone(parts),k=1+.1*(rank-1);out.rules=out.rules.map(r=>({...overrideEffectRules([r],r.scale.length?[{target:r.id,mul:Object.fromEntries(r.scale.map(path=>[path,k]))}]:[])[0],tier:k}));for(const stat of out.stats)stat.value=precise(stat.value*k);for(const zone of out.zones)zone.value=precise(zone.kind==='mult'?1+(zone.value-1)*k:zone.value*k);for(const c of out.conditional)c.value=precise(c.stat==='lifestealMultiplier'?1+(c.value-1)*k:c.value*k);for(const c of out.conversions)c.ratio=precise(c.ratio*k);for(const patch of out.patches)for(const op of patch.ops)if(typeof op.value==='number'&&['damage','radius','range','cooldown','cost'].includes(op.path)&&op.op==='mul')op.value=precise(op.path==='damage'&&op.value<1?op.value:1+(op.value-1)*k);return out;}
export function collectAspectSources(s:CharacterState){return activeNewAspects(s).map(({definition:a,rank})=>({source:a.id,name:a.name,parts:scaleAspectParts(a.parts,rank)}));}
