import {z} from 'zod';

export const dungeonRewardPreviewQuerySchema=z.object({dungeon_id:z.string().min(1).max(128),tier:z.coerce.number().int().positive()}).strict();
export const dungeonRewardPreviewSchema=z.object({dungeon_id:z.string(),tier:z.number().int().positive(),scope:z.literal('completion_bonus'),reward:z.object({gold:z.number().int().nonnegative(),xp:z.number().int().nonnegative(),material:z.number().int().nonnegative()}).strict()}).strict();
export type DungeonRewardPreview=z.infer<typeof dungeonRewardPreviewSchema>;
