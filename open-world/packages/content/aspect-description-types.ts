import type {z} from 'zod';
import type {newAspectSchema} from './aspects.ts';
/** 仅类型依赖，避免描述生成器导入正在写入的 JSON。 */
export type NewAspect=z.infer<typeof newAspectSchema>;
