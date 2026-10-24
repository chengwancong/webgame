import {z} from 'zod';

const id=z.string().min(1).max(120), n=z.number().finite().nonnegative();
export const TacticalCellSchema=z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative()}).strict();
export const TacticalKindSchema=z.enum(['hero','melee','ranged','charger','shaman','guard','assassin','summoner','artillery','swarm','boss']);
export const TacticalAffixSchema=z.enum(['swift','shielded','frost_nova','fire_trail','summon_minions','teleport']);
export const TacticalStatusSchema=z.object({id,sourceId:id,remaining:z.number().int().nonnegative(),amount:n,expiresOnRound:z.number().int().optional(),rootActionId:id.optional()}).strict();
export const TacticalUnitSchema=z.object({
 id,side:z.enum(['hero','enemy']),kind:TacticalKindSchema,cell:TacticalCellSchema,hp:n,maxHp:n.positive(),shield:n,
 statuses:z.array(TacticalStatusSchema),cooldowns:z.record(z.string(),z.number().int().nonnegative()),eliteAffixes:z.array(TacticalAffixSchema),
 facing:z.object({x:z.number().int().min(-1).max(1),y:z.number().int().min(-1).max(1)}).strict(),
 activeFromRound:z.number().int().positive(),summonedBy:id.optional(),phase:z.number().int().positive().optional(),
 prepared:z.object({kind:z.enum(['charge','artillery','boss']),cells:z.array(TacticalCellSchema),origin:TacticalCellSchema.optional(),direction:z.object({x:z.number().int(),y:z.number().int()}).strict().optional(),executeRound:z.number().int().positive()}).strict().optional(),
 flags:z.array(z.string()),
}).strict();
export const TacticalIntentSchema=z.object({
 id,sourceId:id,type:z.enum(['grid','chase','lock','buff','summon','charge-windup','move-only']),sequence:z.number().int().nonnegative(),
 cells:z.array(TacticalCellSchema),targetId:id.optional(),destination:TacticalCellSchema.optional(),line:z.array(TacticalCellSchema),
 damage:n,tier:z.enum(['normal','heavy','lethal']).optional(),range:n,move:n,
 effect:z.enum(['attack','heal','shield','curse','summon','charge','artillery-mark','boss-mark','boss-blast','stun','frost','teleport','protect']).optional(),
 executeRound:z.number().int().positive(),hidden:z.boolean().optional(),fizzled:z.boolean().optional(),reason:z.string().optional(),
}).strict();
export const TacticalActionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('move'),to:TacticalCellSchema}).strict(),
 z.object({type:z.literal('skill'),skillId:id,target:TacticalCellSchema.optional()}).strict(),
 z.object({type:z.literal('basic'),target:TacticalCellSchema}).strict(),
 z.object({type:z.literal('end')}).strict(),
 z.object({type:z.literal('set-control-mode'),mode:z.enum(['manual','auto'])}).strict(),
]);
export const TacticalEventSchema=z.object({
 battleId:id,round:z.number().int().positive(),ownerTurnId:id,actionId:id,resolutionId:id,sourceId:id,cause:id,
 type:id,rootActionId:id.optional(),targetId:id.optional(),amount:n.optional(),cell:TacticalCellSchema.optional(),cells:z.array(TacticalCellSchema).optional(),intentId:id.optional(),detail:z.string().optional(),
}).strict();
export const TacticalOrchestrationSchema=z.object({priority:z.array(id).max(8).default([]),target:z.enum(['nearest','lowest-hp','support-first']).default('nearest'),position:z.enum(['stay-close','keep-distance','behind-cover']).default('stay-close'),guard:z.enum(['on','off']).default('on')}).strict();
export const TacticalZoneSchema=z.object({id,kind:z.enum(['poison','fire','frost']),sourceId:id,cells:z.array(TacticalCellSchema),damage:n,remaining:z.number().int().nonnegative(),activeFromRound:z.number().int().positive(),rootActionId:id}).strict();
export const TacticalProjectionSchema=z.object({
 battleId:id,boardId:id,heroId:z.enum(['sword','hidden']),seed:z.number().int(),round:z.number().int().positive(),ownerTurnId:id,phase:z.enum(['hero','ended']),
 difficulty:z.enum(['normal','elite','boss']),board:z.object({width:z.number().int().positive(),height:z.number().int().positive(),blocked:z.array(TacticalCellSchema)}).strict(),
 units:z.array(TacticalUnitSchema),intents:z.array(TacticalIntentSchema),zones:z.array(TacticalZoneSchema),
 budget:z.object({moveUsed:z.boolean(),mainActionUsed:z.boolean(),ended:z.boolean()}).strict(),
 reachable:z.array(z.object({cell:TacticalCellSchema,cost:n,path:z.array(TacticalCellSchema)}).strict()),
 skills:z.array(z.object({id,available:z.boolean(),cooldown:z.number().int().nonnegative(),reason:z.string().optional()}).strict()),
 controlMode:z.enum(['manual','auto']),outcome:z.enum(['win','loss']).nullable(),orchestration:TacticalOrchestrationSchema,
 revision:z.number().int().nonnegative().optional(),events:z.array(TacticalEventSchema).optional(),
 control:z.object({encounterId:id,serverNowMs:n,mode:z.enum(['manual','auto']),phase:z.enum(['boundary','awaiting','resolving','enemy','ended']),pendingManual:z.boolean(),deadlineAtMs:n.nullable(),remainingMs:n.nullable(),warning:z.boolean(),timeoutDue:z.boolean()}).strict().optional(),
}).strict();
export type TacticalCell=z.infer<typeof TacticalCellSchema>;
export type TacticalUnit=z.infer<typeof TacticalUnitSchema>;
export type TacticalIntent=z.infer<typeof TacticalIntentSchema>;
export type TacticalAction=z.infer<typeof TacticalActionSchema>;
export type TacticalEvent=z.infer<typeof TacticalEventSchema>;
export type TacticalProjection=z.infer<typeof TacticalProjectionSchema>;
export type TacticalOrchestration=z.infer<typeof TacticalOrchestrationSchema>;
export type TacticalZone=z.infer<typeof TacticalZoneSchema>;
export type TacticalKind=z.infer<typeof TacticalKindSchema>;
