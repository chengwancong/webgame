import {weaponNames} from '../contracts/weapons.ts';
import {skillWeaponRequirement as nativeRequirement} from './weapon-skills.ts';
import {skillSlotCount} from './skill-slots.ts';
import type {CharacterState} from '../contracts/index.ts';
import {activeNewAspects} from './aspect-sources.ts';
import {skillWeaponAllowed as nativeAllowed,mainHandWeapon,gearWeaponType,changeMainHand as nativeChange,rememberWeaponSkills} from './weapon-skills.ts';
export * from './weapon-skills.ts';
export function skillWeaponAllowed(s:Pick<CharacterState,'gear'|'equipment'>&Partial<CharacterState>,id:string){if(nativeAllowed(s,id))return true;const weapon=mainHandWeapon(s);return activeNewAspects(s as CharacterState).some(({definition:a})=>a.parts.patches.some(p=>p.skills?.includes(id)&&p.ops.some(o=>o.path==='weapons'&&o.op==='set'&&Array.isArray(o.value)&&o.value.includes(weapon))));}
export function changeMainHand(s:CharacterState,gearId:string|undefined){const weapon=gearWeaponType(s.gear.find(g=>g.id===gearId)),desired=[...(s.weaponLoadouts?.[weapon??'none']??s.skills)];nativeChange(s,gearId);s.skills=[...new Set(desired)].filter(id=>(s.skillRanks[id]??0)>0&&skillWeaponAllowed(s,id)).slice(0,skillSlotCount(s));rememberWeaponSkills(s);}

export function skillWeaponRequirement(id:string,state?:CharacterState){const patch=state?activeNewAspects(state).flatMap(a=>a.definition.parts.patches).filter(p=>p.skills?.includes(id)).flatMap(p=>p.ops).findLast(o=>o.path==='weapons'&&o.op==='set'):undefined;return patch&&Array.isArray(patch.value)?'需主手：'+patch.value.map(w=>weaponNames[w as keyof typeof weaponNames]).join('／'):nativeRequirement(id);}
