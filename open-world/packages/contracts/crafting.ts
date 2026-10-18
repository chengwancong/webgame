import {z} from 'zod';
import {stageKeyProgressSchema} from './stage-keys.ts';
import {gearSchema} from './index.ts';
import {craftGoalPinSchema} from './crafting-state.ts';
export {craftGoalPinSchema,craftGoalViewSchema,type CraftGoalPin,type CraftGoalView} from './crafting-state.ts';

const id=z.string().min(1).max(100), count=z.number().int().nonnegative();
const position=z.object({x:z.number().finite(),y:z.number().finite()}).strict();
export const craftProfessionSchema=z.enum(['smithing','jewelcraft','alchemy','enchanting']);
export const craftCostSchema=z.object({gold:count,materials:z.record(id,count)}).strict();
export const craftMaterialDefSchema=z.object({id,name:z.string(),tier:z.enum(['T0','T1','T2','T3']),island:id.nullable(),kind:z.enum(['common','ore','plant','part','boss','endgame','legacy']),icon:id,sources:z.array(z.string()),stack:z.literal(9999)}).strict();
export type CraftMaterialDef=z.infer<typeof craftMaterialDefSchema>;
export const craftActionSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('craft'),recipe:id,count:count.min(1).max(20).optional(),slot:id.optional(),tendency:id.optional(),element:id.optional()}).strict(),
 z.object({op:z.literal('refine'),from:id,times:count.min(1).max(100)}).strict(),
 z.object({op:z.literal('exchange'),to:id,times:count.min(1).max(100)}).strict(),
 z.object({op:z.literal('facility.upgrade'),facility:id}).strict(),
 z.object({op:z.literal('masterwork.apply'),gear:id}).strict(),
 z.object({op:z.literal('masterwork.reroll'),gear:id,lockAffix:count}).strict(),
 z.object({op:z.literal('codex.claim'),target:id}).strict(),
]);
export type CraftAction=z.infer<typeof craftActionSchema>;
export const craftRecipeViewSchema=z.object({id,name:z.string(),profession:craftProfessionSchema,category:z.enum(['gear','accessory','tonic','resist','food','essence','pattern','refine','repair']),island:id.nullable(),known:z.boolean(),unlockHint:z.string(),levelRequired:count.min(1).max(100),facilityRequired:z.object({id,level:count.min(1).max(6)}).strict().nullable(),options:z.object({slots:z.array(id).optional(),tendencies:z.array(id).optional(),elements:z.array(id).optional()}).strict(),baseCost:craftCostSchema}).strict();
export const craftProfessionViewSchema=z.object({id:z.enum(['smithing','jewelcraft','alchemy','enchanting','gathering']),name:z.string(),level:count.min(1).max(100),xp:count,xpNext:count,fineChance:z.number().min(0).max(.3)}).strict();
export const craftingViewSchema=z.object({
 revision:count,ruleset_version:id,atForge:z.boolean(),forgeReason:z.string(),
 materials:z.array(z.object({id,quantity:count,uses:z.array(z.object({recipe:id,name:z.string()}).strict())}).strict()),
 professions:z.array(craftProfessionViewSchema),recipes:z.array(craftRecipeViewSchema),
 patterns:z.array(z.object({id,name:z.string(),slot:id,quality:z.enum(['legendary','set']),island:id.nullable(),learned:z.boolean(),sourceHint:z.string()}).strict()),
 codex:z.array(z.object({id,name:z.string(),required:count,current:count,bonus:z.string(),claimed:z.boolean()}).strict()),
 facilities:z.array(z.object({id:z.enum(['forge','jewel','alchemy','enchant']),name:z.string(),level:count.min(1).max(6),maxLevel:z.literal(6),appearanceTier:z.union([z.literal(1),z.literal(2),z.literal(3)]),effects:z.array(z.string()),next:z.object({level:count.min(2).max(6),cost:craftCostSchema,effects:z.array(z.string())}).strict().nullable()}).strict()),
 refine:z.array(z.object({from:id,to:id,inputCount:count.positive(),outputCount:count.positive()}).strict()),
 masterwork:z.object({unlocked:z.boolean(),reason:z.string(),maxLevel:z.literal(5)}).strict(),stageKey:stageKeyProgressSchema.nullable(),
}).strict();
export type CraftingView=z.infer<typeof craftingViewSchema>;
export const craftPreviewSchema=z.object({revision:count,action:craftActionSchema,enabled:z.boolean(),reason:z.string(),cost:craftCostSchema,output:z.object({kind:z.enum(['gear','consumable','material','pattern','facility','masterwork']),name:z.string(),icon:z.string(),count,quality:z.string().optional(),level:count.optional(),guaranteedAffix:z.string().optional(),affixPool:z.array(z.object({label:z.string(),weight:z.number().nonnegative()}).strict()).optional(),fineChance:z.number().min(0).max(.3).optional(),statChanges:z.array(z.object({label:z.string(),before:z.string(),after:z.string()}).strict()).optional()}).strict(),bagFull:z.boolean()}).strict();
export type CraftPreview=z.infer<typeof craftPreviewSchema>;
export const craftPreviewRequestSchema=z.object({revision:count,action:craftActionSchema,region:id,position}).strict();
// 与现有 command 保持一致；独立定义避免 index 的运行时循环依赖。
const commandFields={command_id:z.uuid(),revision:count,lease_id:z.uuid()};
export const craftActionRequestSchema=craftPreviewRequestSchema.extend(commandFields).strict();
export const craftPinRequestSchema=z.object({...commandFields,pin:craftGoalPinSchema.nullable()}).strict();
export const fieldGatherRequestSchema=z.object({...commandFields,region:id,node:id,position,mode:z.enum(['manual','route'])}).strict();
const professionProgress=z.object({level:count.min(1).max(100),xp:count}).strict();
export const craftDeltaSchema=z.object({materials:z.record(id,z.number().int()),gold:z.number().int(),gear:z.array(z.lazy(()=>gearSchema)).optional(),consumables:z.record(id,z.number().int()).optional(),patterns:z.array(id).optional(),recipes:z.array(id).optional(),professions:z.record(id,professionProgress).optional(),facility:z.object({id,level:count.min(1).max(6)}).strict().optional(),fine:z.boolean().optional()}).strict();
export type CraftDelta=z.infer<typeof craftDeltaSchema>;
/** 采集节点与专业经验随delta返回；公开快照另给当前区域gathered列表。 */
export const gatherDeltaSchema=z.object({materials:z.record(id,z.number().int()),node:z.object({id,gathered:z.literal(true)}).strict(),professions:z.object({gathering:professionProgress}).strict()}).strict();
export type GatherDelta=z.infer<typeof gatherDeltaSchema>;
export const craftFoodStatsSchema=z.object({pickupRadius:z.number().nonnegative(),goldBonus:z.number().nonnegative(),materialDropBonus:z.number().nonnegative()}).strict();
export type CraftFoodStats=z.infer<typeof craftFoodStatsSchema>;
export const craftConsumableIdSchema=z.enum(['tonic_attack','tonic_hp','resist_fire','resist_cold','resist_lightning','resist_arcane','resist_shadow','resist_poison','resist_all','food_pickup','food_gold','food_material']);
export type CraftConsumableId=z.infer<typeof craftConsumableIdSchema>;
export const craftErrorCodeSchema=z.enum(['FORGE_PLACE','STORY_LOCKED','CRAFT_UNKNOWN','CRAFT_LOCKED','CRAFT_MATERIAL','CRAFT_GOLD','BAG_FULL','CRAFT_STAGE','REVISION','GATHER_FAR','GATHER_DONE','GATHER_PLACE']);
