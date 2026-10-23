import {z} from 'zod';
import {worldTierChoiceSchema} from './open-world.ts';
import {damageTypeSchema} from './skill-mechanics.ts';
import {regionExploreViewSchema} from './zhangjian.ts';

export const chartRegionIdSchema=z.enum(['wind','mist','forge','frost','rift','dragon','deep']);
export const nodeKindSchema=z.enum(['story','nest','hunt','tide','treasure','gate']);
export const nodeStatusSchema=z.enum(['hidden','locked','open','cleared']);
export const chartNodeViewSchema=z.object({
 id:z.string(),region:chartRegionIdSchema,kind:nodeKindSchema,name:z.string(),line:z.string(),dungeonId:z.string(),status:nodeStatusSchema,
 lockReason:z.string().optional(),recommendedLevel:z.number().int().positive(),estimatedMinutes:z.tuple([z.number(),z.number()]),
 firstClearReward:z.array(z.string()),firstClearDone:z.boolean(),firstClearBonusAvailable:z.boolean(),
 collectible:z.object({kind:z.enum(['lifeCrystal','starCore']),owned:z.boolean()}).optional(),
 shardSlots:z.number().int().min(0).max(3),challenges:z.array(z.enum(['high','nightmare'])),publicDropNote:z.string(),
 best:z.object({seconds:z.number().int()}).optional(),recommended:z.boolean(),links:z.array(z.string()),pos:z.object({col:z.number().int(),row:z.number().int()}),
 /** M17 Z1/Z4：元素克制与探索物；服务端接入前缺省。 */
 elements:z.object({threat:damageTypeSchema,weakness:damageTypeSchema}).strict().optional(),cache:z.object({found:z.boolean()}).strict().optional(),door:z.object({id:z.string(),key:z.enum(['wind','mist','forge','frost','rift','dragon','deep']),keyName:z.string(),keyOwned:z.boolean(),opened:z.boolean()}).strict().optional(),
}).strict();
export const chartRegionViewSchema=z.object({id:chartRegionIdSchema,name:z.string(),levelRange:z.tuple([z.number().int(),z.number().int()]),status:z.enum(['locked','open','cleared']),lockReason:z.string().optional(),gateQuest:z.array(z.object({text:z.string(),done:z.boolean()})).optional(),nodes:z.array(chartNodeViewSchema),explore:regionExploreViewSchema.optional()}).strict();
export const shardStackSchema=z.object({id:z.string(),name:z.string(),effect:z.string(),count:z.number().int().nonnegative()}).strict();
export const chartViewSchema=z.object({regions:z.array(chartRegionViewSchema),lastRegion:chartRegionIdSchema,seaTier:z.object({current:z.number().int().positive(),choices:z.array(worldTierChoiceSchema)}).strict(),shards:z.object({slotsUnlocked:z.number().int().min(0).max(3),owned:z.array(shardStackSchema)}).strict(),bagFull:z.boolean()}).strict();
export const hubReturnItemSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('unlock'),id:z.string(),title:z.string(),text:z.string()}).strict(),
 z.object({kind:z.literal('dialogue'),dialogueId:z.string()}).strict(),
 z.object({kind:z.literal('away'),days:z.number().int(),lines:z.array(z.string())}).strict(),
]);
export const todayViewSchema=z.object({resetAt:z.string(),firstClear:z.object({used:z.number().int(),limit:z.number().int()}).strict(),commissions:z.object({open:z.boolean(),active:z.number().int(),slots:z.number().int(),doneToday:z.number().int(),banked:z.number().int()}).strict(),dock:z.object({open:z.boolean(),fleets:z.array(z.object({fleet:z.number().int(),region:chartRegionIdSchema.nullable(),accruedHours:z.number(),cap:z.literal(12)}).strict()),maxFleets:z.number().int(),quickAvailable:z.boolean(),pendingCollect:z.boolean()}).strict(),high:z.object({left:z.number().int(),limit:z.number().int()}).nullable(),returnQueue:z.array(hubReturnItemSchema)}).strict();
export const hubBuildingIdSchema=z.enum(['forge','shipyard','post']);
export const hubCommissionsViewSchema=z.object({slots:z.array(z.object({id:z.string(),title:z.string(),region:chartRegionIdSchema,target:z.object({text:z.string(),progress:z.number(),goal:z.number()}).strict(),reward:z.object({xp:z.number(),gold:z.number(),rep:z.number()}).strict(),status:z.enum(['active','ready'])}).strict()),doneToday:z.number().int(),limitToday:z.literal(8),banked:z.number().int()}).strict();
export const hubPortViewSchema=z.object({buildings:z.array(z.object({id:hubBuildingIdSchema,name:z.string(),npc:z.string(),rep:z.number(),tiers:z.array(z.object({tier:z.number().int(),threshold:z.number(),rewards:z.array(z.string()),claimed:z.boolean(),claimable:z.boolean()}).strict())}).strict()),collectibles:z.object({lifeCrystal:z.object({owned:z.number().int(),total:z.literal(12)}).strict(),starCore:z.object({owned:z.number().int(),total:z.literal(6)}).strict()}).strict(),systems:z.array(z.object({id:z.string(),name:z.string(),open:z.boolean(),lockReason:z.string().optional()}).strict())}).strict();
export const hubSeaTierRequestSchema=z.object({tier:z.number().int().min(1).max(100),command_id:z.uuid()}).strict();
export const hubReturnAckRequestSchema=z.object({kind:z.enum(['unlock','dialogue','away']),id:z.string(),command_id:z.uuid()}).strict();
export const hubCommissionRequestSchema=z.object({op:z.enum(['claim','abandon']),id:z.string(),command_id:z.uuid()}).strict();
export const hubPortClaimRequestSchema=z.object({building:hubBuildingIdSchema,tier:z.number().int().min(1).max(4),command_id:z.uuid()}).strict();
export const hubDockRequestSchema=z.object({op:z.enum(['send','collect','quick']),fleet:z.number().int().positive().optional(),region:chartRegionIdSchema.optional(),command_id:z.uuid()}).strict();
export const hubModePreferenceRequestSchema=z.object({mode:z.enum(['manual','semi','auto']),command_id:z.uuid()}).strict();
export const hubDungeonObjectiveSchema=z.object({kind:z.enum(['defeat-boss','reach-portal','defend-beacon','open-chests','story-fact']),text:z.string(),progress:z.object({done:z.number(),total:z.number()}).optional(),timeLeft:z.number().optional()}).strict();
export const hubDungeonSegmentSchema=z.object({index:z.number().int(),total:z.number().int()}).strict();
export const hubSettlementSchema=z.object({nodeId:z.string(),firstClear:z.boolean(),firstClearRewards:z.array(z.string()),dailyBonus:z.object({applied:z.boolean(),used:z.number().int(),limit:z.number().int()}).strict(),collectibles:z.array(z.object({kind:z.enum(['lifeCrystal','starCore']),owned:z.number().int(),total:z.number().int()}).strict()),rep:z.array(z.object({building:hubBuildingIdSchema,delta:z.number()}).strict()),unlock:z.object({id:z.string(),title:z.string(),text:z.string()}).strict().optional(),retry:z.object({allowed:z.boolean(),reason:z.string().optional()}).strict(),next:z.object({nodeId:z.string(),name:z.string()}).strict().optional()}).strict();
export type ChartRegionId=z.infer<typeof chartRegionIdSchema>;
export type NodeKind=z.infer<typeof nodeKindSchema>;
export type ChartNodeView=z.infer<typeof chartNodeViewSchema>;
export type ChartRegionView=z.infer<typeof chartRegionViewSchema>;
export type ChartView=z.infer<typeof chartViewSchema>;
export type HubReturnItem=z.infer<typeof hubReturnItemSchema>;
export type TodayView=z.infer<typeof todayViewSchema>;
export type HubPortView=z.infer<typeof hubPortViewSchema>;
export type HubCommissionsView=z.infer<typeof hubCommissionsViewSchema>;
export type HubSettlement=z.infer<typeof hubSettlementSchema>;
export type HubBuildingId=z.infer<typeof hubBuildingIdSchema>;
