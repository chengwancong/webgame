import {z} from 'zod';
import raw from './inscriptions.json';
import {inscriptionAtomSchema} from '../contracts/inscriptions.ts';
const chance=z.number().min(0).max(1),amount=z.number().int().nonnegative(),pool=z.array(inscriptionAtomSchema).min(1).refine(p=>new Set(p).size===p.length,'Duplicate inscription in slot pool');
export const inscriptionContentSchema=z.object({version:z.literal(1),tier:z.literal(.5),chance:z.object({common:chance,magic:chance,rare:chance,legendary:chance}).strict(),extractChance:chance,slots:z.object({weapon:pool,armor:pool,helmet:pool,boots:pool,accessory:pool,ring:pool}).strict(),enhanceNodes:z.array(z.number().int().positive()).refine(a=>a.length===5&&a.every((n,i)=>n===[3,6,9,12,15][i]),'Invalid enhancement nodes'),reroll:z.object({maxSelectedAffixes:z.literal(1),level:z.number().int().min(1).max(100),gold:amount,material:amount}).strict(),imprint:z.object({gold:amount,material:amount,fragments:z.literal(1)}).strict()}).strict();
export const inscriptionConfig=inscriptionContentSchema.parse(raw);
