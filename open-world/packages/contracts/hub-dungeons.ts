import {z} from 'zod';

/** New templates coexist with the historical difficulty `DungeonDefinition.kind`. */
export const hubDungeonTemplateSchema=z.object({
  kind:z.enum(['story','nest','hunt','tide','treasure','gate','abyss','weekly','raid']),
  node:z.string().min(1),
  objective:z.enum(['defeat-boss','reach-portal','defend-beacon','open-chests','story-fact']),
}).strict();
export type HubDungeonTemplate=z.infer<typeof hubDungeonTemplateSchema>;
export const hubObjectiveSchema=z.object({kind:hubDungeonTemplateSchema.shape.objective,text:z.string(),progress:z.object({done:z.number().int().nonnegative(),total:z.number().int().nonnegative()}).strict().optional(),timeLeft:z.number().nonnegative().optional()}).strict();
export const hubDungeonPublicSchema=z.object({
  objective:hubObjectiveSchema,
  /** Server-owned treasure pursuit; omitted after the original chest is recovered. */
  chase:z.object({chestId:z.string(),enemyId:z.string(),phase:z.enum(['waking','running','staggered','cornered']),position:z.object({x:z.number().finite(),y:z.number().finite()}).strict(),intercept:z.object({x:z.number().finite(),y:z.number().finite()}).strict().optional(),remainingSeconds:z.number().nonnegative(),interceptions:z.number().int().nonnegative()}).strict().optional(),
  segment:z.object({index:z.number().int().positive(),total:z.number().int().positive()}).strict(),
  wave:z.object({index:z.number().int().nonnegative(),total:z.number().int().positive(),nextIn:z.number().nonnegative().optional()}).strict().optional(),
  beacon:z.object({hp:z.number().nonnegative(),max:z.number().positive()}).strict().optional(),
  chests:z.object({opened:z.number().int().nonnegative(),total:z.number().int().positive()}).strict().optional(),
  /** 狩猎场地机制（FP4）：rockfall 落石 / flood 涨潮 / pylon 引雷桩；pylon 时附桩子位置与是否已碎 */
  hunt:z.object({mechanic:z.enum(['rockfall','flood','pylon']),pylons:z.array(z.object({id:z.string(),x:z.number(),y:z.number(),broken:z.boolean()}).strict()).optional()}).strict().optional(),
  /** 读条：寻宝开箱或狩猎击碎引雷桩（id 以 hub-pylon- 开头）；剩余与总秒数（服务端 2 秒读条，离开 2 格或倒下即取消） */
  opening:z.object({id:z.string(),left:z.number().nonnegative(),total:z.number().positive()}).strict().optional(),
  /** M17 Z4 探索物件：秘藏 id=hub-cache-<节点>、锁门 id=hub-door-<门 id>，交互目标就是 id（2 格内）。
   * 秘藏 hidden=没走近（半埋，不可交互）、glint=5 格内（可开）、opened；锁门 locked / open，key 为所需钥匙的航区。 */
  explore:z.object({props:z.array(z.object({id:z.string().regex(/^hub-(cache|door)-/),kind:z.enum(['cache','door']),x:z.number(),y:z.number(),state:z.enum(['hidden','glint','opened','locked','open']),key:z.string().optional(),keyName:z.string().optional()}).strict())}).strict().optional(),
}).strict();
export type HubDungeonPublic=z.infer<typeof hubDungeonPublicSchema>;
