import {z} from 'zod';
import {craftingStateSchema} from './crafting-state.ts';
const count=z.number().int().nonnegative(), key=z.string().min(1).max(100);
export const progressionStateSchema=z.object({
 crafting:craftingStateSchema.default(()=>craftingStateSchema.parse({})),
 version:z.literal(1).default(1),materials:z.record(key,count).default({}),weaponGrid:z.array(z.string().nullable()).length(9).default(Array(9).fill(null)),weapons:z.record(key,z.object({level:count.min(1).max(150),uncap:count.max(5)}).strict()).default({}),
 codex:z.record(key,count.min(1).max(5)).default({}),imprints:z.record(key,key).default({}),talents:z.record(key,count.max(5)).default({}),/** 2026-10-07 已废弃（天赋四树不再有专精）；仅为读取旧存档保留，ensureProgression 会删除。 */specializations:z.array(z.string()).max(2).optional(),paragon:z.array(key).default([]),paragonLevel:count.default(0),paragonXp:count.default(0),glyphs:z.record(key,count.min(1).max(21)).default({}),glyphSlots:z.record(key,key).default({}),
 summons:z.record(key,z.object({level:count.min(1).max(200),uncap:count.max(5)}).strict()).default({}),summonSlots:z.object({main:key.optional(),friend:key.optional()}).strict().default({}),characterUncap:count.max(5).default(0),awakening:count.max(10).default(0),awakeningChoices:z.record(key,key).default({}),skillAwakenings:z.record(key,key).default({}),
 reputation:z.record(key,count).default({}),reputationClaims:z.array(key).default([]),recipes:z.array(key).default([]),discoveries:z.array(key).default([]),collectionClaims:z.array(key).default([]),consumables:z.record(key,count).default({}),buffs:z.record(key,count).default({})
}).strict();
export type ProgressionState=z.infer<typeof progressionStateSchema>;
export const progressionActionSchema=z.object({op:z.enum(['grid.assign','grid.clear','weapon.level','weapon.uncap','aspect.extract','aspect.imprint','inscription.imprint','talent.learn','talent.reset','paragon.learn','glyph.unlock','glyph.level','glyph.slot','summon.unlock','summon.level','summon.uncap','summon.slot','character.uncap','awakening.level','awakening.choose','skill.awaken','reputation.donate','reputation.claim','consumable.use','collection.claim']),target:key.optional(),value:key.optional(),slot:count.max(9).optional()}).strict();
export type ProgressionAction=z.infer<typeof progressionActionSchema>;
export const progressionCostSchema=z.object({gold:count,material:count,items:z.record(key,count)}).strict();
export type ProgressionCost=z.infer<typeof progressionCostSchema>;
export const progressionOperationSchema=z.object({id:key,label:z.string(),action:progressionActionSchema,cost:progressionCostSchema,enabled:z.boolean(),reason:z.string()}).strict();
/** Optional presentation metadata is assembled by the server; old read models still validate. */
export const progressionItemSchema=z.object({
 id:key,name:z.string(),description:z.string(),status:z.string(),operations:z.array(progressionOperationSchema),
 state:z.enum(['learned','available','locked']).optional(),rank:count.optional(),max:count.optional(),tier:count.optional(),tierUnlocked:z.boolean().optional(),exclusive:z.boolean().optional(),requires:z.array(key).optional(),
 effects:z.array(z.object({stat:key,label:z.string(),value:z.number()}).strict()).optional(),
 x:count.optional(),y:count.optional(),board:count.optional(),socket:z.boolean().optional(),
 slottedGlyph:z.object({id:key,name:z.string(),rank:count}).strict().optional(),radius:count.optional(),
 currentValue:count.optional(),nextValue:count.nullable().optional(),progressRatio:z.number().min(0).max(1).optional(),
 rewardTiers:z.array(z.object({rank:count,name:z.string(),required:count,state:z.enum(['learned','available','locked']),rewards:z.array(z.object({name:z.string(),value:z.string()}).strict())}).strict()).optional(),
 stages:z.array(z.object({id:key,label:z.string(),state:z.enum(['learned','available','locked'])}).strict()).optional()
}).strict();
export const progressionViewSchema=z.object({revision:count,ruleset_version:key,state:progressionStateSchema,currencies:z.array(z.object({id:key,name:z.string(),amount:count,source:z.string()})),summary:z.array(z.object({name:z.string(),value:z.string()})),sections:z.array(z.object({id:key,name:z.string(),description:z.string(),points:z.object({available:count,total:count}).strict().optional(),items:z.array(progressionItemSchema)}))}).strict();
export type ProgressionView=z.infer<typeof progressionViewSchema>;
export const progressionPreviewSchema=z.object({revision:count,ruleset_version:key,action:progressionActionSchema,cost:progressionCostSchema,enabled:z.boolean(),reason:z.string(),summary:z.string(),before:z.object({attack:z.number(),hp:z.number(),armor:z.number()}),after:z.object({attack:z.number(),hp:z.number(),armor:z.number()})}).strict();
export type ProgressionPreview=z.infer<typeof progressionPreviewSchema>;




export const talentBatchPreviewSchema=progressionPreviewSchema.omit({action:true}).extend({target:key,count,}).strict();
export type TalentBatchPreview=z.infer<typeof talentBatchPreviewSchema>;
