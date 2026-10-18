import {z} from 'zod';
import raw from './legacy-progression-gear.json';
import {weaponTypeSchema} from '../contracts/weapons.ts';
export const legacyProgressionGear=z.object({version:z.number().int().positive(),items:z.array(z.object({base:z.string().min(1),name:z.string().min(1),series:z.enum(['omega','primal']),weapon:weaponTypeSchema,attack:z.number().int().positive(),skills:z.array(z.object({type:z.enum(['attack','skill','hp','armor','crit','omegaAttack','omegaSkill']),value:z.number().positive()}).strict()).min(1).max(2),iconSource:z.string().optional(),appearanceSource:z.string().optional()}).strict())}).strict().parse(raw).items;
if(new Set(legacyProgressionGear.map(g=>g.base)).size!==legacyProgressionGear.length)throw Error('重复旧谱系成长装备');
