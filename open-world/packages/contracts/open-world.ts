import {z} from 'zod';
import {monsterRankSchema,monsterRoleSchema} from './monsters.ts';
import {stageKeyStateSchema} from './stage-keys.ts';
const id=z.string().min(1).max(120),coordinate=z.number().finite(),positive=z.number().positive();
const point=z.object({x:coordinate,y:coordinate}).strict();
const rect=point.extend({w:positive,h:positive});
const phase={when:id.optional(),until:id.optional()};
const row={_row:z.number().int().positive(),id,region:id,...phase};
const placed={...row,zone:id,x:coordinate,y:coordinate};
const pack=z.object({template:id,rank:monsterRankSchema,count:z.number().int().min(1).max(60)}).strict();
const campBudget=z.object({count:z.number().int().min(1).max(60),health:positive,attackScale:positive.optional(),roles:z.partialRecord(monsterRoleSchema,z.number().nonnegative()),healthWeights:z.partialRecord(monsterRoleSchema,positive).optional()}).strict().superRefine((v,ctx)=>{if(Object.values(v.roles).reduce((n,w)=>n+(w??0),0)<=0)ctx.addIssue({code:'custom',message:'群体角色配比之和必须大于0'});if(v.health<v.count)ctx.addIssue({code:'custom',message:'群体生命预算不能低于怪物人数'});});
export const worldSchemas={
 islands:z.object({...row,island:id,artIsland:id,chapter:z.number().int().min(1).max(6),name:id,width:z.literal(512),height:z.literal(512),seed:z.number().int(),landing:point,landRadius:z.tuple([positive,positive]),rockCount:z.number().int().nonnegative(),decorationsPerZone:z.number().int().nonnegative(),backdrop:id,plazaResource:id.optional(),plazaRadius:positive.optional(),groundPatches:z.array(z.object({resource:id,alpha:z.number().gt(0).max(1),tint:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),share:positive}).strict()).optional(),scatterStep:z.number().int().min(0).optional()}).strict(),
 roads:z.object({...row,points:z.array(point).min(2),widthCells:positive,theme:id.optional(),resource:id.optional()}).strict(),
 gates:z.object({_row:z.number().int().positive(),id,map:id,zone:id,landmark:id,prop:id,openedProp:id.optional(),openWhen:id.optional(),guards:z.array(pack).min(1),opened_message:z.string().min(1),...phase}).strict().transform(r=>({...r,region:r.map})),
 zones:z.object({...row,name:id,rect,levelBand:z.tuple([z.number().int().positive(),z.number().int().positive()]),theme:id,ground:id,music:id.optional(),ambient:id.optional(),banner:id.optional()}).strict(),
 camps:z.object({...placed,radius:positive,pack:z.array(pack).min(1),respawnSeconds:z.number().int().min(90),budget:campBudget.optional()}).strict(),
 patrols:z.object({...row,zone:id,path:z.array(point).min(2),template:id,rank:monsterRankSchema,speed:positive,respawnSeconds:z.number().int().min(90),radius:positive}).strict(),
 rares:z.object({...row,zone:id,name:id,spots:z.array(point).min(3),template:id,cooldownMinutes:z.literal(20),affixes:z.tuple([z.number().int().min(2).max(3),z.number().int().min(2).max(3)]),resource:id,loot:id}).strict(),
 waypoints:z.object({...placed,name:id,resource:id,kind:z.enum(['landing','outpost','boss','field']),unlockWhen:id.optional()}).strict(),
 dungeonEntrances:z.object({...placed,dungeon:id,resource:id,stage:z.number().int().min(1).max(24)}).strict(),
 /** 箱庭位面入口（plane-world-design F1）。墙地城仍走 dungeonEntrances，这里只放 nest / rift / lair / vault / link。
  * discover：proximity 走近自动发现；interact 在入口旁交互；fact 由 fact 列的世界事实条件点亮。requires 是可进入条件（没满足显示 locked）。 */
 planeGates:z.object({...placed,name:id,plane:id,kind:z.enum(['nest','rift','lair','vault','link']),style:z.enum(['cave','crypt','maze','vault','rift']),discover:z.enum(['proximity','interact','fact']),discoverRadius:positive.max(24),interactRadius:positive.max(6),returnX:coordinate,returnY:coordinate,resource:id,clearedResource:id.optional(),fact:id.optional(),requires:id.optional(),repeatable:z.boolean(),cooldownSeconds:z.number().int().min(0).max(86400)}).strict().superRefine((v,ctx)=>{
  if(v.discover==='fact'&&!v.fact)ctx.addIssue({code:'custom',message:'世界事实发现的入口缺少 fact：'+v.id});
  if(v.discover!=='fact'&&v.fact)ctx.addIssue({code:'custom',message:'只有 discover=fact 的入口才填 fact：'+v.id});
  if(v.interactRadius>v.discoverRadius)ctx.addIssue({code:'custom',message:'交互半径大于发现半径：'+v.id});
  if(Math.hypot(v.returnX-v.x,v.returnY-v.y)>(v.kind==='link'?400:12))ctx.addIssue({code:'custom',message:'出口回落点离入口太远：'+v.id});
 }),
 events:z.object({...placed,name:id,kind:z.enum(['defend','waves','horde']),definition:id,resource:id,markerResource:id.optional(),activeResource:id.optional(),cooldownResource:id.optional(),startEffect:id.optional(),successEffect:id.optional(),failureEffect:id.optional(),radius:positive,cooldownSeconds:z.number().int().min(600).max(900),durationSeconds:positive,waveIntervalSeconds:positive,waves:z.array(z.array(pack).min(1)).min(1),objectiveHp:positive.optional(),loot:id}).strict().superRefine((v,ctx)=>{if(v.kind==='defend'&&!v.objectiveHp)ctx.addIssue({code:'custom',message:'守护事件须声明目标生命'});if(v.kind==='horde'){const specs=v.waves.flat(),normal=specs.filter(p=>p.rank==='normal').reduce((n,p)=>n+p.count,0),elite=specs.filter(p=>p.rank==='elite').reduce((n,p)=>n+p.count,0);if(v.waves.length!==3||normal<30||normal>60||elite!==1||specs.some(p=>!['normal','elite'].includes(p.rank))||2*v.waveIntervalSeconds>30)ctx.addIssue({code:'custom',message:'怪潮须30秒内三波、30–60杂兵和1精英'});}}),
 chests:z.object({...placed,loot:id,resource:id,openResource:id}).strict(),
 landmarks:z.object({...placed,key:id.optional(),name:id,kind:id,resource:id}).strict(),
 outposts:z.object({...placed,name:id,resource:id,waypoint:id.optional()}).strict(),
 objects:z.object({...placed,name:id,kind:id,resource:id,landmark:id.optional(),material:id.optional()}).strict(),
 merchants:z.object({...placed,npc:id,name:id,resource:id,service:id}).strict(),
};
export type WorldTables={source:string}&{[K in keyof typeof worldSchemas]:z.infer<(typeof worldSchemas)[K]>[]};
export type WorldCamp=WorldTables['camps'][number];
export type WorldZone=WorldTables['zones'][number];
/** Per-character gate state, server-resolved (F1). hidden 未发现、locked 条件未满足、cooldown 冷却中、open 可进入、cleared 已首通且不可重复。 */
export const planeGateStateSchema=z.enum(['hidden','locked','cooldown','open','cleared']);
export const planeGateViewSchema=z.object({id,state:planeGateStateSchema,clears:z.number().int().nonnegative(),cooldownUntil:z.number().int().nonnegative().optional()}).strict();
export type PlaneGateView=z.infer<typeof planeGateViewSchema>;
/** Per-character public phase projection. The browser displays this view and
 * never evaluates task conditions or receives private reward configuration. */
export const worldPhaseViewSchema=z.object({
 zones:z.array(worldSchemas.zones.omit({when:true,until:true,_row:true})).default([]),
 camps:z.array(id),waypoints:z.array(id),gates:z.array(id),landmarks:z.array(id),events:z.array(id).default([]),chests:z.array(id).default([]),rares:z.array(id).default([]),patrols:z.array(id).default([]),dungeonEntrances:z.array(id).default([]),
 planeGates:z.array(planeGateViewSchema).default([]),
 outposts:z.array(worldSchemas.outposts.omit({when:true,until:true,_row:true})),
 objects:z.array(worldSchemas.objects.omit({when:true,until:true,_row:true})),
 merchants:z.array(worldSchemas.merchants.omit({when:true,until:true,_row:true})),
}).strict();
export type WorldPhaseView=z.infer<typeof worldPhaseViewSchema>;
/** F8：只由服务端写；旧存档默认为空。 */
export const planeProgressSchema=z.record(id,z.object({found:z.boolean().default(false),foundAt:z.number().int().nonnegative().optional(),clears:z.number().int().nonnegative().default(0),firstClearAt:z.number().int().nonnegative().optional(),cooldownUntil:z.number().int().nonnegative().optional(),secrets:z.array(id).default([])}).strict()).default({});
export type PlaneProgress=z.infer<typeof planeProgressSchema>;
/** Exact-size bitmap per island; default absence preserves old saves. */
export const explorationStateSchema=z.record(id,z.string().max(11000)).default({});
export const worldProgressSchema=z.object({stageKeys:stageKeyStateSchema.optional(),activeKeyTier:z.number().int().min(0).max(100).optional(),activeKeyStage:z.number().int().min(1).max(24).optional(),hardmodeBosses:z.array(id).optional(),waypoints:z.array(id).default([]),exploration:explorationStateSchema,planes:planeProgressSchema,worldTier:z.number().int().min(1).max(100).default(1),unlockedWorldTier:z.number().int().min(1).max(100).default(1)}).strict();
export type WorldProgress=z.infer<typeof worldProgressSchema>;
/** Stars and the one-line blurb are server-resolved from the existing multipliers; the page only draws them. */
export const worldTierChoiceSchema=z.object({tier:z.number().int().min(1).max(100),name:id,unlocked:z.boolean(),danger:z.number().int().min(1).max(5),rewardStars:z.number().int().min(1).max(5),summary:z.string().min(1),level:z.number().int().positive().nullable(),unlockText:z.string(),unlockSummary:z.string().optional(),monster:z.object({hp:positive,attack:positive}),reward:z.object({xp:positive,gold:positive,material:positive,gear:positive})}).strict();
export type WorldTierChoice=z.infer<typeof worldTierChoiceSchema>;
const multiplier=z.number().min(1).finite();
/** Player-chosen world tier (grind-feel §3, numeric-flow §8): a declared difficulty modifier,
 * never hidden level scaling. Rewards grow slower than threat. */
export const worldTiersSchema=z.object({source:z.string().min(1),switchAt:z.array(z.enum(['port','outpost'])).min(1),outpostReach:positive,growth:z.object({afterTier:z.number().int().positive(),maxTier:z.number().int().min(5).max(100),name:id,hp:multiplier,attack:multiplier,reward:multiplier}).strict().optional(),tiers:z.array(z.object({tier:z.number().int().min(1).max(100),name:id,
 unlock:z.discriminatedUnion('kind',[z.object({kind:z.literal('default')}).strict(),z.object({kind:z.literal('boss'),value:id,text:z.string().min(1)}).strict(),z.object({kind:z.literal('hardmode'),text:z.string().min(1)}).strict(),z.object({kind:z.literal('hardmode_bosses'),level:z.number().int().positive(),bosses:z.array(id).min(1),text:z.string().min(1)}).strict()]),
 /** 一句话说明：玩家语言，说这档海是什么感觉，不写倍率。 */
 summary:z.string().min(1),
 monster:z.object({hp:multiplier,attack:multiplier}).strict(),reward:z.object({xp:multiplier,gold:multiplier,material:multiplier,gear:multiplier}).strict(),
 eliteAffixes:z.tuple([z.number().int().min(0).max(6),z.number().int().min(0).max(6)])}).strict()).min(1)}).strict().superRefine((v,ctx)=>{
 v.tiers.forEach((t,i)=>{if(t.tier!==i+1)ctx.addIssue({code:'custom',message:'世界层级须从 1 连续编号：'+t.tier});if(t.eliteAffixes[0]>t.eliteAffixes[1])ctx.addIssue({code:'custom',message:'精英词缀数量倒置：层级 '+t.tier});
  if(i>0){const p=v.tiers[i-1];for(const k of ['hp','attack'] as const)if(t.monster[k]<p.monster[k])ctx.addIssue({code:'custom',message:`层级 ${t.tier} 怪物${k}低于上一层`});
   // Economy budget: the reward step may not outgrow the threat step (hp × attack).
   const threat=t.monster.hp*t.monster.attack/(p.monster.hp*p.monster.attack);for(const k of ['xp','gold','material','gear'] as const)if(t.reward[k]/p.reward[k]>threat)ctx.addIssue({code:'custom',message:`层级 ${t.tier} 奖励${k}增幅超过威胁增幅`});}
 });if(v.tiers[0].unlock.kind!=='default')ctx.addIssue({code:'custom',message:'第一层须默认开启'});if(v.growth&&(v.growth.afterTier!==v.tiers.length||v.growth.reward>v.growth.hp*v.growth.attack))ctx.addIssue({code:'custom',message:'后续层级须从最后声明层延伸，奖励增幅不超过威胁'});});
export type WorldTiers=z.infer<typeof worldTiersSchema>;export type WorldTier=WorldTiers['tiers'][number];
