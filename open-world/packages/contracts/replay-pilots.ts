import {z} from 'zod';
export const fieldReplayGoalSchema=z.object({visit:z.number().int().positive(),map:z.string(),waypoint:z.string(),label:z.string(),x:z.number().finite(),y:z.number().finite(),done:z.boolean()}).strict();
export const fieldReplayResponseSchema=z.object({goal:fieldReplayGoalSchema.nullable()}).strict();
export type FieldReplayGoal=z.infer<typeof fieldReplayGoalSchema>;
