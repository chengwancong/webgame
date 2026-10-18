import {z} from 'zod';
export const dungeonChestSchema=z.object({id:z.string().min(1),name:z.string().min(1),x:z.number().finite(),y:z.number().finite(),resource:z.string().min(1),openResource:z.string().min(1)}).strict();
export type DungeonChest=z.infer<typeof dungeonChestSchema>;
