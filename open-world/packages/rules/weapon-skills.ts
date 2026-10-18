import {legacyProgressionGear} from '../content/legacy-progression-gear.ts';
import {skillSlotCount} from './skill-slots.ts';
import type {CharacterState,Gear} from '../contracts/index.ts';
import {weaponNames,permitsWeapon,type WeaponType} from '../contracts/weapons.ts';
import {equipmentItems} from '../content/equipment-catalog.ts';
import {skillWeapons} from '../content/skill-weapons.ts';
const types=new Map<string,WeaponType>(equipmentItems.filter(i=>i.part==='weapon').map(i=>[i.runtimeBase??i.id,i.family]));
for(const [base,type]of [['blade','sword'],['omega-blade','sword'],['primal-blade','sword'],['bow','bow'],['omega-bow','bow']] as const)types.set(base,type);
for(const definition of legacyProgressionGear)types.set(definition.base,definition.weapon);
export function gearWeaponType(gear:Pick<Gear,'base'|'slot'>|undefined):WeaponType|null{return gear?.slot==='weapon'?types.get(gear.base)??null:null;}
export function mainHandWeapon(s:Pick<CharacterState,'gear'|'equipment'>){return gearWeaponType(s.gear.find(g=>g.id===s.equipment.weapon));}
export function skillWeaponAllowed(s:Pick<CharacterState,'gear'|'equipment'>,id:string){return id in skillWeapons&&permitsWeapon(skillWeapons[id],mainHandWeapon(s));}
export function skillWeaponRequirement(id:string){const required=skillWeapons[id];return required?.length?'需主手：'+required.map(w=>weaponNames[w]).join('／'):'任意主手';}
const key=(weapon:WeaponType|null)=>weapon??'none';
export function rememberWeaponSkills(s:CharacterState){s.weaponLoadouts??={};s.weaponLoadouts[key(mainHandWeapon(s))]=[...s.skills];}
export function changeMainHand(s:CharacterState,gearId:string|undefined){
 const prior=[...s.skills];rememberWeaponSkills(s);if(gearId)s.equipment.weapon=gearId;else delete s.equipment.weapon;
 const saved=s.weaponLoadouts![key(mainHandWeapon(s))];s.skills=[...new Set(saved??prior)].filter(id=>(s.skillRanks[id]??0)>0&&skillWeaponAllowed(s,id)).slice(0,skillSlotCount(s));rememberWeaponSkills(s);
}
/** Additive db-12 migration: equipped bar and bar memory only; no growth or items change. */
export function migrateWeaponSkills(s:CharacterState){const before=JSON.stringify(s.skills);s.skills=s.skills.filter(id=>skillWeaponAllowed(s,id));rememberWeaponSkills(s);if(JSON.stringify(s.skills)!==before){s.revision++;s.build++;return true;}return false;}
/** 2026-10-07 武器倾向：魔杖只亲和法术；法杖逐件分为战杖（武技）与法杖（法术），由装备 ID 稳定决定；其余主手亲和武技。 */
import type {WeaponAffinity} from '../contracts/weapons.ts';
export type {WeaponAffinity} from '../contracts/weapons.ts';
export const weaponAffinityNames={martial:'武技',spell:'法术'} as const;
export function gearWeaponAffinity(gear:Pick<Gear,'id'|'base'|'slot'>|undefined):WeaponAffinity|null{
 const type=gearWeaponType(gear);if(!type||!gear)return null;
 if(type==='wand')return 'spell';
 if(type==='staff')return parseInt(gear.id.replace(/[^0-9a-f]/gi,'').slice(-1)||'0',16)%2?'spell':'martial';
 return 'martial';
}
/** 主手显示名：法杖按倾向分为「战杖／法杖」，其余沿用武器类型名。 */
export function gearWeaponLabel(gear:Pick<Gear,'id'|'base'|'slot'>|undefined){const type=gearWeaponType(gear);if(!type)return null;return type==='staff'?(gearWeaponAffinity(gear)==='spell'?'法杖':'战杖'):weaponNames[type];}
export function mainHandAffinity(s:Pick<CharacterState,'gear'|'equipment'>){return gearWeaponAffinity(s.gear.find(g=>g.id===s.equipment.weapon));}
