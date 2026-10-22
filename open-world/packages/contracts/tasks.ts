import {z} from 'zod';
const key=z.string().min(1).max(100),count=z.number().int().nonnegative();
export const taskTypeSchema=z.object({id:key,name:z.string(),order:count,enabled:z.boolean(),historical_only:z.boolean().optional(),tone:z.enum(['gold','violet','teal','neutral']),icon:z.enum(['banner','portal','feather','diamond'])}).strict();
export const taskRewardSchema=z.object({gold:count,material:count,xp:count}).strict();
export const taskEntrySchema=z.object({
 id:key,taskId:key,typeId:key,typeName:z.string(),title:z.string(),state:z.enum(['available','active','ready','archived']),bountyInstance:z.uuid().optional(),tracked:z.boolean().optional(),abandonable:z.boolean().optional(),series:key.optional(),thread:key.optional(),choice:z.enum(['a','b']).optional(),
 goal:z.string().nullable(),current:count.nullable(),total:count.positive().nullable(),summary:z.string().nullable(),story:z.string().nullable(),
 area:z.string().nullable(),place:z.string().nullable(),regionId:key.nullable(),tags:z.array(z.string()),reward:taskRewardSchema.nullable(),
 goalAt:z.iso.datetime().nullable(),claimedAt:z.iso.datetime().nullable(),chain:z.array(z.object({taskId:key,title:z.string()}).strict()).nullable(),
 note:z.string(),source:z.enum(['current','confirmed','legacy-receipt','legacy-unrecorded'])
}).strict();
export const taskViewSchema=z.object({characterId:z.uuid(),revision:count,ruleset_version:key,types:z.array(taskTypeSchema),current:z.array(taskEntrySchema),archive:z.array(taskEntrySchema)}).strict();
export type TaskType=z.infer<typeof taskTypeSchema>;
export type TaskEntry=z.infer<typeof taskEntrySchema>;
export type TaskView=z.infer<typeof taskViewSchema>;
export type TaskJournal={completed:Record<string,string|null>;archive:TaskEntry[]};
