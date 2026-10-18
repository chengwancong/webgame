import {z} from 'zod';import raw from './gear-affixes.json';
export const reinforcementSchema=z.object({nodes:z.array(z.number().int().positive()).length(5),affixCaps:z.object({common:z.number().int().positive(),magic:z.number().int().positive(),rare:z.number().int().positive(),legendary:z.number().int().positive()}).strict(),rankCaps:z.object({common:z.number().int().min(3).max(15),magic:z.number().int().min(3).max(15),rare:z.number().int().min(3).max(15),legendary:z.literal(15)}).strict()}).strict();
export const reinforcementRules=reinforcementSchema.parse(raw.reinforcement);
