import {z} from 'zod';
export const weaponTypes=['sword','hammer','axe','bow','staff','hidden','wand'] as const;
export const weaponTypeSchema=z.enum(weaponTypes);
export type WeaponType=z.infer<typeof weaponTypeSchema>;
export const weaponAffinitySchema=z.enum(['martial','spell']);
export type WeaponAffinity=z.infer<typeof weaponAffinitySchema>;
export const weaponNames:Record<WeaponType,string>={sword:'剑',hammer:'锤',axe:'斧',bow:'弓',staff:'法杖',hidden:'暗器',wand:'魔杖'};
export function permitsWeapon(required:readonly WeaponType[]|undefined,weapon:WeaponType|null){return !required?.length||weapon!==null&&required.includes(weapon);}
