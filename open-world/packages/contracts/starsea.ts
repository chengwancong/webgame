import {z} from 'zod';
import {monsterCombatSchema} from './monsters.ts';
// 星潮海主线状态：服务端唯一写入，快照只读下发。见 docs/hybrid-implementation.md §4。
const key=z.string().min(1).max(120),int=z.number().int().nonnegative(),point=z.object({x:z.number().finite(),y:z.number().finite()});
const waveSpawnSchema=z.object({id:key,kind:z.enum(['melee','ranged','charger','shaman','guard','assassin','summoner','artillery']),name:z.string(),x:z.number().finite(),y:z.number().finite(),hp:int,attack:int,elite:z.boolean(),boss:z.boolean(),art:key,monster:monsterCombatSchema.optional()});
export const starseaWaveSchema=z.object({defense:z.object({hp:z.number().positive(),radius:z.number().positive(),holdTicks:int}).strict().optional(),task:key,step:int,region:key,spawns:z.array(waveSpawnSchema),killed:z.array(key),/** 服务端记录的开战时刻（毫秒），用于守护完成的时间抽查。 */startedAt:z.number().int().optional(),/** 按开战时构筑离线估出的最快清场毫秒数（抽查下限）。 */minClearMs:z.number().int().nonnegative().optional()}).strict();
export const starseaLegacyStateSchema=z.object({
 version:z.literal(1),
 /** 1–6 是主线章节；7 表示主线完成。 */
 chapter:z.number().int().min(1).max(7),
 task:int,step:int,attempt:int,
 wave:starseaWaveSchema.nullable(),openingComplete:z.boolean().optional(),
 /** 已完成接取对话的任务（任务表 accept_mode=talk）。旧存档没有此字段时按 openingComplete 推断。 */
 accepted:z.array(key).optional(),completion:z.object({id:key,title:z.string(),speaker:z.string(),text:z.string(),/** 完成对白逐句（说话人已解析为显示名）。 */lines:z.array(z.object({speaker:z.string(),text:z.string()})).optional()}).optional(),
 choices:z.record(key,z.enum(['a','b'])),
 done:z.array(key),npcs:z.array(key),features:z.array(key),islands:z.array(key),bosses:z.array(key),
 hardmode:z.boolean(),crystals:z.array(key),
 /** 星潮夜：每座岛自上次星潮夜以来的野怪击杀数、进行中的入侵波次、累计次数。 */
 tide:z.record(key,int).optional(),night:starseaWaveSchema.nullable().optional(),nights:int.optional()
}).strict();
export const questRunSchema=z.object({step:int,attempt:int,acceptedAt:z.number().int().nonnegative(),choice:z.enum(['a','b']).optional()}).strict();
export const starseaV2StateSchema=z.object({version:z.literal(2),quests:z.record(key,questRunSchema),done:z.array(key),tracked:key.nullable(),trackedManually:z.boolean().optional(),wave:starseaWaveSchema.nullable(),attempts:z.record(key,int).default({}),gateAttempts:z.record(key,int).default({}),location:z.object({map:key,x:z.number(),y:z.number()}).optional(),gates:z.array(key),seen:z.array(key),rumors:z.array(key),bounties:z.array(z.object({slot:key,zone:key,task:key,instance:key,progress:int,cooldownUntil:z.number().int().optional(),acceptedAt:z.number().int().optional(),xp:int.default(0)}).strict()),npcs:z.array(key),features:z.array(key),islands:z.array(key),bosses:z.array(key),hardmode:z.boolean(),crystals:z.array(key),tide:z.record(key,int).optional(),night:starseaWaveSchema.nullable().optional(),nights:int.optional(),completion:starseaLegacyStateSchema.shape.completion,legacy:z.object({chapter:int,task:int,step:int,attempt:int.optional()}).optional(),waypoints:z.array(key).default([]),discovered:z.array(key).default([]),clearedCamps:z.array(key).default([]),/** 开场「坠星觉醒」：只有开场上线后新建的角色才有；缺省视为已完成。 */prologue:z.object({weapon:z.enum(['sword','staff','hidden']).optional(),done:z.boolean()}).strict().optional(),fieldFacts:z.object({open_chest:z.array(key),complete_event:z.array(key),kill_rare:z.array(key),clear_dungeon:z.array(key)}).strict().optional()}).strict();
// Historical receipt snapshots remain readable; current character loads migrate to v2.
export const starseaStateSchema=z.union([starseaV2StateSchema,starseaLegacyStateSchema]).transform(v=>v as unknown as z.infer<typeof starseaV2StateSchema>);
export type StarseaState=z.infer<typeof starseaV2StateSchema>;
export type LegacyStarseaState=z.infer<typeof starseaLegacyStateSchema>;
export type StarseaWave=z.infer<typeof starseaWaveSchema>;
export const starseaPointSchema=point.extend({id:key,label:z.string(),prop:key.optional(),state:z.string().optional(),npc:key.optional(),done:z.boolean().default(false)});
export const starseaStepViewSchema=z.object({op:z.enum(['talk','interact','wave','choose','boss']),map:key,mapName:z.string(),label:z.string(),points:z.array(starseaPointSchema),count:int,need:int,defense:z.boolean().default(false),/** 任务栏一句话（任务.xlsx 步骤「任务栏提示」填充后的文字）；守护与首领步骤由客户端按实时状态显示。 */hint:z.string().optional(),/** 当前步骤在步骤表的序号（1 起）；接取前为 0。客户端按它匹配触发表。 */seq:int.optional()});
export const starseaViewSchema=z.object({
 quests:z.array(z.object({id:key,title:z.string(),type:z.string(),series:z.string().optional(),thread:z.string().optional(),step:starseaStepViewSchema,tracked:z.boolean(),abandonable:z.boolean(),goal:z.string(),accept:z.array(z.object({speaker:z.string(),text:z.string()})).default([])})).default([]),
 available:z.array(starseaPointSchema.extend({task:key,map:key,type:z.string(),title:z.string(),accept_mode:z.string()})).default([]),markers:z.array(starseaPointSchema.extend({map:key,kind:z.enum(['clue','rumor','gate','waypoint']),task:key.optional()})).default([]),tracked:key.nullable().default(null),recommend:z.object({label:z.string(),map:key,point:point.optional(),kind:z.string(),action:z.enum(['dungeons','world-tier']).optional()}).nullable().default(null),conditions:z.array(key).default([]),npcPositions:z.array(z.object({npc:key,map:key,x:z.number(),y:z.number()})).default([]),
 chapter:z.object({n:int,title:z.string(),island:z.string(),map:key}).nullable(),
 task:z.object({id:key,index:int,title:z.string(),goal:z.string(),speaker:z.string(),speakerName:z.string(),accept:z.array(z.object({speaker:z.string(),text:z.string()})),player:z.array(z.object({speaker:z.string(),text:z.string()})),complete:z.array(z.object({speaker:z.string(),text:z.string()}))}).nullable(),
 step:starseaStepViewSchema.nullable(),
 /** 当前任务已完成的交互点，用于把道具画成完成态。 */
 props:z.array(starseaPointSchema),
 port:z.array(z.object({npc:key,name:z.string(),idle:z.array(z.string()),x:z.number(),y:z.number()})),
 islands:z.array(z.object({map:key,name:z.string(),chapter:int,open:z.boolean().default(true),requiredLevel:int.default(1),levels:z.string(),boss:key,bossName:z.string(),bossOpen:z.boolean(),bossCleared:z.boolean(),hardmodeBossCleared:z.boolean().default(false),loot:z.string().optional(),relics:z.string().optional()})),
 /** 已开放岛屿上的生命星晶与星核（裂星潮后）。 */
 relics:z.array(starseaPointSchema.extend({map:key,kind:z.enum(['life','core'])})).default([]),
 features:z.array(key),hardmode:z.boolean(),tideProgress:z.object({completed:int,total:int,remaining:z.array(z.string())}).optional(),complete:z.boolean(),opening:z.boolean().default(false),completion:z.object({id:key,title:z.string(),speaker:z.string(),text:z.string(),/** 完成对白逐句（说话人已解析为显示名）。 */lines:z.array(z.object({speaker:z.string(),text:z.string()})).optional()}).optional(),routeFork:starseaPointSchema.optional(),routes:z.array(z.object({id:z.enum(['a','b']),name:z.string(),enemies:z.array(z.string()),risk:z.string()})).optional()
});
export type StarseaView=z.infer<typeof starseaViewSchema>;
export type StarseaPoint=z.infer<typeof starseaPointSchema>;
export const starseaQuestOpSchema=z.enum(['accept','discover','gate','abandon','track','arrive','waypoint','start','interact','talk','relic','defense-finish']);
