// 杖剑借鉴 Z1–Z4 契约（docs/hub-portal-rework-20261021/modules/M17-zhangjian-z1-z4.md）。
// 规则层与前端已按此实现；服务端（handoff/backend-z1-z4.md）按此存档、出视图、收请求。
import {z} from 'zod';
import {damageTypeSchema} from './skill-mechanics.ts';
/** 与 hub.ts 的 chartRegionIdSchema 同值；hub.ts 引用本文件，这里不能反向引用。 */
const chartRegionIdSchema=z.enum(['wind','mist','forge','frost','rift','dragon','deep']);

/** 部位强化的 6 个普通部位（core 旧核心不参加，沿用装备自身等级）。 */
export const rankSlots=['weapon','armor','helmet','boots','accessory','ring'] as const;
export const rankSlotSchema=z.enum(rankSlots);
export type RankSlot=typeof rankSlots[number];

export const petIslands=['wind','mist','forge','frost','star','dragon'] as const;
export const petIslandSchema=z.enum(petIslands);
export const petTierSchema=z.enum(['free','light','heavy']);
/** 9 个流派（与 art/starsea/pets/v3/skins.json 的 flow 同名），流派决定宠物元素。 */
export const petFlows=['blade','ember','glacier','storm','arcanum','shade','venom','ricochet','frostneedle'] as const;
export const petFlowSchema=z.enum(petFlows);
export type PetFlow=typeof petFlows[number];
export const petFamilyIdSchema=z.string().regex(/^(wind|mist|forge|frost|star|dragon)-(free|light|heavy)$/);

const name=z.string().trim().min(1).max(6);
export const petLineupSchema=z.object({active:petFamilyIdSchema.nullable(),support:z.array(petFamilyIdSchema).max(2)}).strict();
export const loadoutSchema=z.object({
 name,
 equipment:z.partialRecord(rankSlotSchema,z.uuid()),
 weaponGrid:z.array(z.string().nullable()).length(9).optional(),
 skills:z.array(z.string()).max(4),
 talents:z.record(z.string(),z.number().int().min(0).max(5)),
 pets:petLineupSchema.extend({flows:z.record(petFamilyIdSchema,petFlowSchema)}).strict(),
}).strict();
export type Loadout=z.infer<typeof loadoutSchema>;
export const loadoutsStateSchema=z.object({active:z.number().int().min(0).max(2),slots:z.array(loadoutSchema.nullable()).length(3)}).strict();
export type LoadoutsState=z.infer<typeof loadoutsStateSchema>;

export const petOwnedSchema=z.object({level:z.number().int().min(1).max(30),xp:z.number().int().nonnegative(),flow:petFlowSchema}).strict();
export const petsStateSchema=z.object({owned:z.record(petFamilyIdSchema,petOwnedSchema),lineup:petLineupSchema}).strict();
export type PetsState=z.infer<typeof petsStateSchema>;
export type SlotRanks=Partial<Record<RankSlot,number>>;

/** HubState.explore：秘藏、锁门按 id 记录，钥匙按航区。 */
export const exploreStateSchema=z.object({caches:z.array(z.string()),doors:z.array(z.string()),keys:z.array(chartRegionIdSchema)}).strict();
export type ExploreState=z.infer<typeof exploreStateSchema>;

// ---- 视图 ----
export const nodeElementsSchema=z.object({threat:damageTypeSchema,weakness:damageTypeSchema}).strict();
export const nodeCacheViewSchema=z.object({found:z.boolean()}).strict();
export const nodeDoorViewSchema=z.object({id:z.string(),key:chartRegionIdSchema,keyName:z.string(),keyOwned:z.boolean(),opened:z.boolean()}).strict();
export const regionExploreViewSchema=z.object({score:z.number().int(),total:z.number().int(),percent:z.number().int().min(0).max(100),
 parts:z.object({nodes:z.tuple([z.number().int(),z.number().int()]),caches:z.tuple([z.number().int(),z.number().int()]),doors:z.tuple([z.number().int(),z.number().int()])}).strict(),
 milestones:z.array(z.object({percent:z.union([z.literal(50),z.literal(100)]),reached:z.boolean(),reward:z.string()}).strict()),
 lockedByKey:z.number().int().nonnegative(),dockBonus:z.number()}).strict();
export type RegionExploreView=z.infer<typeof regionExploreViewSchema>;

export const loadoutSummarySchema=z.object({index:z.number().int().min(0).max(2),name:z.string(),empty:z.boolean(),elements:z.array(damageTypeSchema),skills:z.array(z.string()),pet:z.string().nullable()}).strict();
export const loadoutViewSchema=z.object({active:z.number().int().min(0).max(2),dirty:z.boolean(),current:z.object({elements:z.array(damageTypeSchema),resist:z.record(z.string(),z.number())}).strict(),slots:z.array(loadoutSummarySchema).length(3),canSwitch:z.boolean(),switchBlock:z.string().optional()}).strict();
export type LoadoutView=z.infer<typeof loadoutViewSchema>;

export const petActiveEffectViewSchema=z.object({kind:z.enum(['single','area','shield','chain']),intervalSeconds:z.number().positive(),dealsDamage:z.boolean(),damageElement:damageTypeSchema.nullable(),damageRatios:z.array(z.number().nonnegative()),targetLimit:z.number().int().positive().nullable(),shieldPercent:z.number().positive().optional(),durationSeconds:z.number().positive().optional()}).strict().superRefine((v,c)=>{if(v.kind==='shield'?(v.dealsDamage||v.damageElement!==null||v.damageRatios.length!==0||v.shieldPercent===undefined||v.durationSeconds===undefined):(!v.dealsDamage||v.damageElement===null||v.damageRatios.length===0||v.shieldPercent!==undefined))c.addIssue({code:'custom',message:'Pet effect view contradicts its behavior'});});
export const petViewSchema=z.object({family:petFamilyIdSchema,name:z.string(),island:petIslandSchema,tier:petTierSchema,level:z.number().int(),xp:z.number().int(),xpNext:z.number().int(),form:z.enum(['young','adult','awakened']),flow:petFlowSchema,element:damageTypeSchema,runtime:z.string(),skillName:z.string().optional(),flavor:z.string().optional(),combatRole:z.string().optional(),flowDescription:z.string().optional(),suitableFor:z.string().optional(),tradeoff:z.string().optional(),activeEffect:petActiveEffectViewSchema.optional(),activeLine:z.string(),passiveLine:z.string()}).strict();
export const petCatalogEntrySchema=z.object({family:petFamilyIdSchema,name:z.string(),island:petIslandSchema,tier:petTierSchema,status:z.enum(['owned','locked','unavailable']),source:z.string()}).strict();
export const petsViewSchema=z.object({owned:z.array(petViewSchema),lineup:petLineupSchema,catalog:z.array(petCatalogEntrySchema)}).strict();
export type PetView=z.infer<typeof petViewSchema>;
export type PetsView=z.infer<typeof petsViewSchema>;

export const slotRankViewSchema=z.object({slot:rankSlotSchema,rank:z.number().int(),gearId:z.string().nullable(),gearCap:z.number().int(),effective:z.number().int(),cost:z.object({gold:z.number().int(),material:z.number().int()}).strict().nullable(),block:z.string().optional()}).strict();
export const slotsViewSchema=z.object({slots:z.array(slotRankViewSchema).length(6),resonance:z.object({tier:z.number().int().min(0).max(5),lowest:z.number().int(),next:z.object({rank:z.number().int(),missing:z.number().int()}).strict().nullable(),bonusPercent:z.number()}).strict()}).strict();
export type SlotsView=z.infer<typeof slotsViewSchema>;

// ---- 请求 ----
export const loadoutRequestSchema=z.object({op:z.enum(['save','apply','rename']),index:z.number().int().min(0).max(2),name:name.optional(),command_id:z.uuid()}).strict();
export const petsRequestSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('lineup'),active:petFamilyIdSchema.nullable(),support:z.array(petFamilyIdSchema).max(2),command_id:z.uuid()}).strict(),
 z.object({op:z.literal('flow'),family:petFamilyIdSchema,flow:petFlowSchema,command_id:z.uuid()}).strict(),
]);
export const slotUpgradeRequestSchema=z.object({slot:rankSlotSchema,command_id:z.uuid()}).strict();
/** 切换方案的回执附加：哪些项没能装回。 */
export const loadoutApplyResultSchema=z.object({applied:z.number().int().min(0).max(2),skipped:z.array(z.string())}).strict();
