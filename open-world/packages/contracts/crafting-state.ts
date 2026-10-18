import {z} from 'zod';
const count=z.number().int().nonnegative();
export const craftGoalPinSchema=z.object({recipe:z.string().min(1).max(100),slot:z.string().max(100).optional(),tendency:z.string().max(100).optional(),element:z.string().max(100).optional()}).strict();
export type CraftGoalPin=z.infer<typeof craftGoalPinSchema>;
export const craftGoalViewSchema=z.object({recipe:z.string(),name:z.string(),island:z.string().nullable(),slot:z.string().optional(),tendency:z.string().optional(),element:z.string().optional(),materials:z.array(z.object({id:z.string(),name:z.string(),have:count,need:count,sources:z.array(z.string())}).strict()),gold:z.object({have:count,need:count}).strict(),ready:z.boolean()}).strict();
export type CraftGoalView=z.infer<typeof craftGoalViewSchema>;
export const craftingStateSchema=z.object({
 version:z.literal(1).default(1),
 professions:z.record(z.string(),z.object({level:count.min(1).max(100),xp:count}).strict()).default({}),
 patterns:z.array(z.string()).default([]),claims:z.array(z.string()).default([]),
 facilities:z.record(z.string(),count.min(1).max(6)).default({}),
 masterwork:z.record(z.string(),count.max(5)).default({}),
 patternAspects:z.record(z.string(),z.string()).default({}),
 masterworkBases:z.record(z.string(),z.object({attack:z.number().nonnegative(),armor:z.number().nonnegative(),main:z.number().nonnegative().optional()}).strict()).default({}),
 pin:craftGoalPinSchema.optional(),
 once:z.array(z.string()).default([]),
 legacyProfessions:z.record(z.string(),z.union([z.string(),count])).optional(),
}).strict();
export type CraftingState=z.infer<typeof craftingStateSchema>;
export const gatheringFieldSchema=z.object({gathered:z.array(z.string()).default([]),region:z.string().optional(),entry:z.string().optional()}).strict();
export type GatheringField=z.infer<typeof gatheringFieldSchema>;
