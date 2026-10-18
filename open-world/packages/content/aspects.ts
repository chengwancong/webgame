import {z} from 'zod';
import raw from './aspects.json';
import {gearSlotSchema} from '../contracts/gear-slots.ts';
import {weaponTypeSchema} from '../contracts/weapons.ts';
import {buildSourcePartsSchema} from '../contracts/build-sources.ts';
export const newAspectSchema=z.object({id:z.string().min(1),name:z.string(),description:z.string(),slots:z.array(gearSlotSchema).min(1),requiredLevel:z.number().int().positive(),weapons:z.array(weaponTypeSchema),parts:buildSourcePartsSchema,version:z.literal(1),legacy:z.literal(false),dropEnabled:z.literal(true)}).strict();
export const newAspects=z.array(newAspectSchema).min(1).parse(raw);
if(new Set(newAspects.map(a=>a.id)).size!==newAspects.length)throw Error('Duplicate build aspect');
export const newAspectById=new Map(newAspects.map(a=>[a.id,a]));
