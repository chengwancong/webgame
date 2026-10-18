import {z} from 'zod';
const count=z.number().int().nonnegative(),stage=z.number().int().min(1).max(24),id=z.string().min(1).max(120);
export const stageKeyStateSchema=z.record(id,z.object({stage,materials:count,obtained:z.array(id)}).strict());
export type StageKeyState=z.infer<typeof stageKeyStateSchema>;
export const stageKeyProgressSchema=z.object({scope:id,stage,dungeon:id.nullable(),materials:count,required:count.positive(),obtained:z.boolean(),choices:z.array(z.object({id,name:z.string(),description:z.string(),owned:z.boolean(),craftable:z.boolean()}).strict()).min(2).max(3)}).strict();
export type StageKeyProgress=z.infer<typeof stageKeyProgressSchema>;

export const stageKeyPreviewSchema=z.object({revision:count,scope:id,stage,key:id,name:z.string(),description:z.string(),outputSlots:z.array(z.string()),growth:z.array(z.object({label:z.string(),before:z.string(),after:z.string()}).strict()),products:z.array(z.object({slot:z.string(),name:z.string(),mechanism:z.string()}).strict()),alignments:z.array(z.object({slot:z.string(),rank:count,currentRank:count,productRank:count}).strict()),changes:z.array(z.object({id:z.string(),label:z.string(),before:z.string(),after:z.string(),change:z.string(),tone:z.enum(['positive','negative','neutral'])}).strict()),note:z.string()}).strict();
export type StageKeyPreview=z.infer<typeof stageKeyPreviewSchema>;
