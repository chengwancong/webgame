import {z} from 'zod';

/** New templates coexist with the historical difficulty `DungeonDefinition.kind`. */
export const hubDungeonTemplateSchema=z.object({
  kind:z.enum(['story','nest','hunt','tide','treasure','gate','abyss','weekly','raid']),
  node:z.string().min(1),
  objective:z.enum(['defeat-boss','reach-portal','defend-beacon','open-chests','story-fact']),
  augmentRounds:z.number().int().min(1).max(3),
}).strict();
export type HubDungeonTemplate=z.infer<typeof hubDungeonTemplateSchema>;
export const hubObjectiveSchema=z.object({kind:hubDungeonTemplateSchema.shape.objective,text:z.string(),progress:z.object({done:z.number().int().nonnegative(),total:z.number().int().nonnegative()}).strict().optional(),timeLeft:z.number().nonnegative().optional()}).strict();
export const hubDungeonPublicSchema=z.object({
  objective:hubObjectiveSchema,
  segment:z.object({index:z.number().int().positive(),total:z.number().int().positive()}).strict(),
  wave:z.object({index:z.number().int().nonnegative(),total:z.number().int().positive(),nextIn:z.number().nonnegative().optional()}).strict().optional(),
  beacon:z.object({hp:z.number().nonnegative(),max:z.number().positive()}).strict().optional(),
  chests:z.object({opened:z.number().int().nonnegative(),total:z.number().int().positive()}).strict().optional(),
  /** 狩猎场地机制（FP4）：rockfall 落石 / flood 涨潮 / pylon 引雷桩；pylon 时附桩子位置与是否已碎 */
  hunt:z.object({mechanic:z.enum(['rockfall','flood','pylon']),pylons:z.array(z.object({id:z.string(),x:z.number(),y:z.number(),broken:z.boolean()}).strict()).optional()}).strict().optional(),
  /** 读条：寻宝开箱或狩猎击碎引雷桩（id 以 hub-pylon- 开头）；剩余与总秒数（服务端 2 秒读条，离开 2 格或倒下即取消） */
  opening:z.object({id:z.string(),left:z.number().nonnegative(),total:z.number().positive()}).strict().optional(),
}).strict();
export type HubDungeonPublic=z.infer<typeof hubDungeonPublicSchema>;
