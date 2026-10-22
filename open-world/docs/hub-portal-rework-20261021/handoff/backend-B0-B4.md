# 后端交接：改版样板 B0–B4（风栖 + 雾铃）

> 2026-10-21 Claude（总策划）写给 Codex/GPT。设计依据是本目录的 `03-outline.md` 和 `modules/M01–M16`（M16 §3.4 批次表为上位）。本文是阶段三「功能细则」里后端部分的交接，**设计已定，照做**；文中写了「默认裁决」的地方直接按默认做，并记进决策日志，不回来问。
> 前端（B5）由 Claude 同时进行，只消费本文 §2 的接口。接口字段名以本文为准；实现中确需改名，在进度文件里写一行，并保持旧名可读一个批次。

## 0. 执行方式（强制）

1. **一次连续做完 B0 → B1 → B2 → B3 → B4（含 §7 的切换点 S）**，批次之间不停、不等确认、不回来问。允许的结束状态只有两种：
   - **全部完成**：§9 完成定义全部勾上；
   - **硬阻塞**：已经做完所有不受阻塞影响的部分，只剩 §8 列出的硬阻塞项。
2. 手上在途的改动（HEX-B05～B08、COPY、P55 等未提交文件）先按原任务提交或明确移交，**不要丢、不要混进 HUB 提交**。HUB 批次优先级为 P0，排在 HEX 之前；HEX 已经做到一半的验收不重做，HUB 完成后再回去。
3. 进度文件：`open-world/docs/hub-portal-rework-20261021/handoff/backend-progress.md`（你创建并持续更新）。每完成一项勾一项，写提交号和一句验证结论。中断后从进度文件第一个未勾项接着做，不重做已勾项。
4. 决策日志：同目录 `backend-decisions.md`。凡是用了本文默认裁决、或遇到本文没写到的小歧义而自行按「最接近本文精神」处理的，各写一行：问题｜处理｜依据条目。
5. 协作中心：`游戏协作.md` 任务队列里 HUB-B0～B4 每批完成改一次状态（待验收），只用更新工具；文档超过 40,000 字符先归档。
6. 重任务一次只跑一个；不跑无头浏览器；MU 运行时不做自动化；真实登录用 GUI 浏览器做几分钟冒烟。

**禁止**：只写文档不写代码；砍节点数量或改用占位节点；把未实现的开关写成「已生效」；跳过测试；为过验收降低标准；在客户端（`apps/web`）改代码；手填奖励数字（必须由 B4 脚本导出）。

## 1. 范围

| 项 | 范围 |
|---|---|
| 航区 | 风栖（L1–8）、雾铃（L8–15）各 10 个节点，共 20 个；其余 4 个航区和深潮只建数据骨架（航区条目 + `status: locked`），节点不建 |
| 流程 | 开场 → 拾星港 → 星门教学 → 风栖 10 节点 → 雾铃 10 节点 → 雾铃关口首领首通 |
| 局外 | 港口建设三座建筑（声望、阶级领取、天赋点）、生命星晶收藏、码头派遣（1 支船队）、快速收益、委托板、「今日」面板、操作模式按角色记忆、外观 `nodeFirstClear` |
| 不在范围 | 深潮（M12）、周常首领、团本改挂、残页第二/三批、星核（裂星潮后）、宠物图鉴、B6/B7 |

## 2. 接口契约（前端照此对接）

新建 `packages/contracts/hub.ts`（你是此文件的唯一修改人），按下面写 zod schema 并导出类型。所有视图只读、服务端权威，客户端不计算。缺字段 = 前端隐藏该元素。

```ts
// 航区与节点
export const chartRegionIdSchema=z.enum(['wind','mist','forge','frost','rift','dragon','deep']);
export const nodeKindSchema=z.enum(['story','nest','hunt','tide','treasure','gate']);
export const nodeStatusSchema=z.enum(['hidden','locked','open','cleared']); // hidden=按开放表尚未出现（前端画灰色问号）
export const chartNodeViewSchema=z.object({
  id:z.string(),                 // 例 wind-story-1、mist-nest-2、wind-gate
  region:chartRegionIdSchema,
  kind:nodeKindSchema,
  name:z.string(),               // 「落点求生」「风车地窖」
  line:z.string(),               // 一行说明：剧情节点=接取对白第一句；其他=类型说明
  dungeonId:z.string(),
  status:nodeStatusSchema,
  lockReason:z.string().optional(),   // 服务端生成，如「先通关 风栖 · 剧情 1」
  recommendedLevel:z.number().int().positive(),
  estimatedMinutes:z.tuple([z.number(),z.number()]),
  firstClearReward:z.array(z.string()),  // 已格式化的一行行文字，如「招牌技找回：剑 1」
  firstClearDone:z.boolean(),
  firstClearBonusAvailable:z.boolean(),  // 今日首通 ×2 角标
  collectible:z.object({kind:z.enum(['lifeCrystal','starCore']),owned:z.boolean()}).optional(), // ◇ 标记
  shardSlots:z.number().int().min(0).max(3),     // 该节点此刻可插的残页槽数（剧情/关口恒为 0）
  challenges:z.array(z.enum(['high','nightmare'])), // 当前可选的挑战档
  publicDropNote:z.string(),     // 「武器、鞋子；海克斯偏向 贴身绞杀」，不含概率
  best:z.object({seconds:z.number().int()}).optional(),
  recommended:z.boolean(),       // 推荐节点外圈发光（同一时刻全图最多 1 个）
  links:z.array(z.string()),     // 相邻节点 id（画连线用，双向各写一次）
  pos:z.object({col:z.number().int(),row:z.number().int()}), // 模板网格坐标，见 §3.1
}).strict();
export const chartRegionViewSchema=z.object({
  id:chartRegionIdSchema, name:z.string(), levelRange:z.tuple([z.number().int(),z.number().int()]),
  status:z.enum(['locked','open','cleared']), lockReason:z.string().optional(),
  gateQuest:z.array(z.object({text:z.string(),done:z.boolean()})).optional(), // 关口任务
  nodes:z.array(chartNodeViewSchema),   // locked 航区为空数组
}).strict();
export const shardStackSchema=z.object({id:z.string(),name:z.string(),effect:z.string(),count:z.number().int().nonnegative()}).strict();
export const chartViewSchema=z.object({
  regions:z.array(chartRegionViewSchema),
  lastRegion:chartRegionIdSchema,
  seaTier:z.object({current:z.number().int().positive(),choices:z.array(worldTierChoiceSchema)}).strict(), // 复用现有 worldTierChoiceSchema
  shards:z.object({slotsUnlocked:z.number().int().min(0).max(3),owned:z.array(shardStackSchema)}).strict(),
  bagFull:z.boolean(),           // 满包 → 出发按钮置灰「先回港整理」
}).strict();
```

| 接口 | 说明 |
|---|---|
| `GET /api/hub/chart` | 返回 `chartView` |
| 副本命令 `op:'create'` 增加字段 | `node_id`（必填，走星门时）、`shards: string[]`（≤ 槽数）、`challenge?: 'high'\|'nightmare'`；`tier` 取当前海域难度。服务端校验节点 `open/cleared`、残页持有与适用类型、满包；不通过返回带中文 `message` 的拒绝，不扣任何东西 |
| `POST /api/hub/sea-tier` | `{tier, command_id}`，把海域难度切换从港口/前哨移到这里（规则不变，只换入口） |

```ts
// 「今日」面板 + 回港队列
export const todayViewSchema=z.object({
  resetAt:z.string(),                                  // 下次 05:00（UTC+8）的 ISO
  firstClear:z.object({used:z.number().int(),limit:z.number().int()}).strict(),
  commissions:z.object({open:z.boolean(),active:z.number().int(),slots:z.number().int(),doneToday:z.number().int(),banked:z.number().int()}).strict(), // banked=可完成次数（含累积，≤24）
  dock:z.object({open:z.boolean(),fleets:z.array(z.object({fleet:z.number().int(),region:chartRegionIdSchema.nullable(),accruedHours:z.number(),cap:z.literal(12)}).strict()),maxFleets:z.number().int(),quickAvailable:z.boolean(),pendingCollect:z.boolean()}).strict(),
  high:z.object({left:z.number().int(),limit:z.number().int()}).nullable(),
  returnQueue:z.array(z.discriminatedUnion('kind',[
    z.object({kind:z.literal('unlock'),id:z.string(),title:z.string(),text:z.string()}).strict(),  // 每次回港最多 1 条
    z.object({kind:z.literal('dialogue'),dialogueId:z.string()}).strict(),                          // t06 汇报类港口对话
    z.object({kind:z.literal('away'),days:z.number().int(),lines:z.array(z.string())}).strict(),    // 离开 ≥3 天
  ])),
}).strict();
```

| 接口 | 说明 |
|---|---|
| `GET /api/hub/today` | 返回 `todayView` |
| `POST /api/hub/return-ack` | `{kind, id, command_id}`：前端播完一项后确认，服务端出队（防重） |
| `GET /api/hub/commissions` | `{slots:[{id,title,region,target:{text,progress,goal},reward:{xp,gold,rep},status:'active'\|'ready'}], doneToday, limitToday:8, banked}` |
| `POST /api/hub/commissions` | `{op:'claim'\|'abandon', id, command_id}`；板上空格由服务端自动补满（不做手动接取，减一步操作——默认裁决 D7） |
| `GET /api/hub/port` | `{buildings:[{id:'forge'\|'shipyard'\|'post',name,npc,rep,tiers:[{tier,threshold,rewards:string[],claimed,claimable}]}], collectibles:{lifeCrystal:{owned,total:12},starCore:{owned,total:6}}, systems:[{id,name,open,lockReason?}]}` |
| `POST /api/hub/port/claim` | `{building, tier, command_id}`，沿用 `reputationClaims` 防重，+1 天赋点 + 本阶奖励 |
| `POST /api/hub/dock` | `{op:'send'\|'collect'\|'quick', fleet?, region?, command_id}` |
| `POST /api/control/mode-preference` 或并入现有控制命令 | 记住操作模式（M05 C2），默认 semi；下次进副本自动沿用 |

```ts
// 副本公开状态增加（随现有副本视图下发）
objective:{kind:'defeat-boss'|'reach-portal'|'defend-beacon'|'open-chests'|'story-fact', text:string, progress?:{done:number,total:number}, timeLeft?:number},
segment:{index:number,total:number},
wave?:{index:number,total:number,nextIn?:number},   // 怪潮
beacon?:{hp:number,max:number},                      // 怪潮
chests?:{opened:number,total:number},                // 寻宝
// self.augments 增加
autoPickAt?:string,   // 全自动模式下出卡时写入，= 出卡时间 + 8 秒；到时服务端自动选
fitsBuild?:string[],  // offered 里「贴合构筑」的 id（卡面小标）
```

```ts
// 结算回执增加 hub 块（battle-result 现有结构不动）
hub:{
  nodeId:string,
  firstClear:boolean,                          // 本次是首通
  firstClearRewards:string[],                  // 已格式化
  dailyBonus:{applied:boolean,used:number,limit:number},
  collectibles:{kind:'lifeCrystal'|'starCore',owned:number,total:number}[], // 本场新得的
  rep:{building:'forge'|'shipyard'|'post',delta:number}[],
  unlock?:{id:string,title:string,text:string},  // 本场触发的新开放（回港时进 returnQueue）
  retry:{allowed:boolean,reason?:string},        // 「再来一次」
  next?:{nodeId:string,name:string},             // 「去下一个节点」= 当前推荐节点
}
```

## 3. 内容数据

### 3.1 节点表（新唯一源 `config/excel/航图.xlsx` → `pnpm config:export` → `packages/content/hub-chart.json`）

每航区同一张模板（M02 §3.2），`pos` 为 `{col,row}`：

| 槽位 | pos | links | 前置（点亮条件） |
|---|---|---|---|
| story-1 | 0,1 | story-2, story-3, nest-1 | 风栖：开场完成；雾铃：风栖 gate 首通 |
| story-2 | 1,1 | story-1, nest-2 | story-1 |
| story-3 | 1,2 | story-1, nest-3 | story-1 |
| nest-1 | 1,0 | story-1, nest-2, hunt | story-1 |
| nest-2 | 2,1 | story-2, nest-1, nest-3, tide | 任一相邻已通关 |
| nest-3 | 2,2 | story-3, nest-2, treasure | 任一相邻已通关 |
| hunt | 3,0 | nest-1, gate | 相邻已通关 **且** 狩猎已开放 |
| tide | 3,1 | nest-2, gate | 相邻已通关 **且** 怪潮已开放 |
| treasure | 3,2 | nest-3, gate | 相邻已通关 **且** 寻宝已开放 |
| gate | 4,1 | hunt, tide, treasure | 本航区 3 个剧情节点 + 关口任务全部完成（不看连线） |

**风栖 / 雾铃节点**（名称、副本、场地）：

| 节点 id | 名称 | 副本 / 场地 | 首通奖励（M06/M10，实际数值由 B4 导出） |
|---|---|---|---|
| wind-story-1 | 落点求生 | 新 `story-wind-1`：ss-c01-t01 | 剑 / 暗器招牌技找回 1 |
| wind-story-2 | 抢救船台 | 新 `story-wind-2`：ss-c01-t03 | — |
| wind-story-3 | 两条进港路 | 新 `story-wind-3`：ss-c01-t04（choice-battle 岔口） | 法杖招牌技找回 1 |
| wind-nest-1/2/3 | 风车地窖 / 沉船货舱 / 船坞遗址 | `field-wind-1/2/3` 原样 | 原 `ow-wind-dungeon` 奖励并入 |
| wind-hunt | 风车旧井 | `plane-wind-nest-cave` 场地 + 稀有精英 + 场地机制「落石」 | 生命星晶 1；风栖配方 1 |
| wind-tide | 风车地宫 | `plane-wind-nest-crypt` 场地 + 4 波 + 信标 | — |
| wind-treasure | 风车迷宫 | `plane-wind-nest-maze` 场地 + 5 宝箱 + 180 秒 | 生命星晶 1 |
| wind-gate | 击退登港先锋 | `ss-map-boss-1` | 三系招牌技找回 2；开雾铃；外观 400106；t06 港口对话入队 |
| mist-story-1 | 封印货箱 | 新 `story-mist-1`：ss-c02-t01 + t02 | — |
| mist-story-2 | 找回信使 | 新 `story-mist-2`：ss-c02-t03 | 剑招牌技找回 3 |
| mist-story-3 | 追踪军需队 | 新 `story-mist-3`：ss-c02-t04（choice-battle） | 法杖 / 暗器招牌技找回 3 |
| mist-nest-1/2/3 | 雾铃树穴 / 废弃邮站 / 军需暗库 | `field-mist-1/2/3` 原样 | 原 `ow-mist-dungeon` 奖励并入 |
| mist-hunt | 树穴深处 | `ss-dg-mist-1-3` 场地 + 稀有精英 + 场地机制「涨潮淹没」 | 生命星晶 1；雾铃配方 1 |
| mist-tide | 邮站前庭 | `ss-dg-mist-2-1` 场地 + 4 波 + 信标 | — |
| mist-treasure | 暗库货架 | `ss-dg-mist-3-2` 场地 + 5 宝箱 + 180 秒 | 生命星晶 1 |
| mist-gate | 截击军需官 | `ss-map-boss-2` | 三系招牌技找回 4；开赤炉（数据骨架）；外观 400104；HEX-Q03 magic 保底；t06 对话入队 |

### 3.2 开放表（样板范围）

| 开放项 | 触发 | 回港演出文字（title｜text） |
|---|---|---|
| 星门 | 开场完成 | 星门｜港口中央的石环亮了。从这里去任何航区。 |
| 段间三选一 | 开场完成（第一次进副本即有） | — （不单独演出） |
| 工坊强化 | wind-story-1 首通 | 工坊开张｜铜铃的炉子生好火了，带装备来强化。 |
| 残页（1 槽） | 风栖累计通关 2 个不同节点 | 航图残页｜把残页插进航图，能改这一趟掉什么。 |
| 首领重战 | wind-gate 首通 | — （gate 节点变为「首领重战」，名称前加「重战 · 」） |
| 狩猎、怪潮 | wind-gate 首通 | 新的节点｜航图上多了「狩猎」和「怪潮」。 |
| 采集与码头派遣 | 进入雾铃（mist-story-1 首通） | 码头船队｜米洛能派船去打通的航区采集，回来就领。 |
| 海克斯 | HEX-Q01 接取（D13 原规则） | 沿用 D13 文案 |
| 寻宝 | mist-gate 首通 | 寻宝｜限时开箱的节点出现了，宝箱里有图样和残页。 |
| 委托板 | mist-gate 首通（大纲 §4 赤炉阶段的起点） | 委托板｜青芒在邮局挂起了委托，每天能做 8 条。 |

每次回港最多出队 1 条 `unlock`，其余按触发顺序排到之后的回港（M01 §2）。

### 3.3 任务改写（只改 `config/excel/任务.xlsx`、`对白.xlsx`，导出 + 校验）

- ss-c01 / ss-c02 按 M10 §3.1 表改挂：t01–t04 的完成条件改为「对应剧情节点通关事实」，原步骤照搬为节点各段的事实目标，`reach_waypoint` 改「进入下一段」；t05 = gate 节点；t06 = 港口对话（gate 首通后入 `returnQueue`）。任务 id、对白键不改，**对白一字不改**。
- 衔接任务：`ss-c02-n*` 登岛类标 `frozen`；码头的求救信号、青芒的邮包、军需营外的哨兵三条并入同章相邻剧情节点作为剧情事件段（对白保留）。
- `ow-wind-*` / `ow-mist-*`：exploration 全部 `frozen`；dungeon 并入巢穴首通后 `frozen`；regional 每航区留 4 条（挑对白 ≥3 句的；挑不出 4 条就按编号最小补足，记决策日志），目标改写为节点事实，其余 `frozen` 并把目标并入委托池。
- 引导：`ss-c01-n01` 改为**星门教学**，三步，追踪文字与对白如下（Claude 定稿）：

| 步 | 追踪（一行） | 对白 |
|---|---|---|
| 1 | 去港口中央的星门 | 米洛：港口中间那座石环就是星门。走近一点，按 E。 |
| 2 | 打开航图 | 米洛：左边是航区，右边是能去的地方。先去风栖，海滩那块。 |
| 3 | 出发：风栖 · 落点求生 | 米洛：打完会从同一扇门回来。去吧。 |

- 新增引导**第一次回港**（wind-story-1 首通后第一次回港触发一次）：

| 步 | 追踪（一行） | 对白 |
|---|---|---|
| 1 | 去工坊找铜铃 | 铜铃：刚回来？有用得上的装备就拿来，我帮你强化。 |
| 2 | 回到星门，挑下一个节点 | 米洛：整理好了就回星门。下一站你自己挑。 |

- 关口任务（M10 §3.5）：风栖「通关两个巢穴｜在工坊强化一次」、雾铃「穿上一件带「◆」的装备｜点一个天赋｜派一次采集船队」；奖励每条一份本航区材料包 + 少量金币（B4 导出）。
- HEX-Q01～Q03 改挂按 M10 §3.4。

## 4. 批次清单

### B0 冻结开关与基线（不翻开关、不清档）
- [ ] `field-freeze.ts` 新增 `fieldEntry`（岛屿落点、入口走廊、野外位面门）、`fieldGather`（野外采集点）、`fieldSprint`（疾跑与耐力），**真正实现**：开关打开时服务端拒绝对应命令（返回冻结错误，不抛异常），快照里给前端一个可读的冻结状态。默认全部 `false`。
- [ ] 9 个开关一起打开时，旧野外入口全部不可达；新角色走老流程会被挡在哪里，列成清单写进进度文件（S 点之前必须由 B1–B3 补齐）。
- [ ] 改版基线：`pnpm spine:check` 当前的不通过项冻结为基线文件，以后只对新增超出负责（M14）。
- [ ] 整库备份脚本 dry-run（备份到 `.runtime/backups/`，不进 Git），清角色数据的脚本写好并在**临时库**上跑通。正式清档在 §7 S 点做。

### B1 星门与航图
- [ ] `航图.xlsx` + 导出 + `hub-chart.json` + content 校验（§3.1 全部 20 节点 + 4 个 locked 航区骨架 + 深潮骨架）。
- [ ] 星门地标：`ss-map-port` 中央新增 `stargate` 交互点（E 打开航图），回港落点 = 星门前广场；所有 `returnRegion` 改为 `ss-map-port` 星门广场（M03 §3.3）。死亡 / 失败也回这里。
- [ ] `GET /api/hub/chart`：解锁、首通、本日首通、推荐节点（规则：未首通的 open 节点里，剧情优先，其次巢穴，按编号；全图最多 1 个）、锁原因文字（服务端生成：「先通关 风栖 · 剧情 1」「完成关口任务：通关两个巢穴」「狩猎尚未开放」）。
- [ ] 节点首通记录、每日首通计数（每节点每天一次、每天 10 个、05:00 UTC+8 重置、只在成功时消耗）；新表 + db 迁移。
- [ ] `create` 命令带 `node_id / shards / challenge` 的校验与冻结（出发时冻结规则版本、难度、残页效果）。
- [ ] 海域难度入口移到 `POST /api/hub/sea-tier`，`world-tiers` 的 `switchAt` 改为星门；解锁时点不动。
- [ ] 首通奖励发放：招牌技找回事件改挂（M10 §3.2）、生命星晶、配方、外观 `nodeFirstClear`（M13 §3.2，只改 `unlock` 类型）。
- [ ] 回港队列 `returnQueue` + `POST /api/hub/return-ack`；开放表 §3.2。

### B2 副本模板
- [ ] 统一模板字段 `kind / node / objective / augmentRounds`（M03 §3.3），未知 kind / objective 报错。
- [ ] 剧情节点 6 个：场地 = 现有岛屿地图上该任务原区域裁出的矩形段（默认裁决 D1），段间用位面的段落传送（`plane` 规则）；段内事实目标；choice-battle 岔口（选一条锁另一条，重打可选另一条）。
- [ ] 怪潮：波次序列（默认 4 波、波间 8 秒、末波带精英）+ 信标耐久，耐久归零或全灭失败；复用星潮夜选点与冲锋。
- [ ] 狩猎：稀有精英 + 场地机制 2 种（风栖「落石」、雾铃「涨潮淹没」；第 3 种「引雷桩」放 B6）。掉落偏向部位 ×3。
- [ ] 寻宝：5 个宝箱、站旁读条 2 秒、180 秒计时，到时按已开数结算，全开额外一箱；超时不算失败。
- [ ] 三选一：去掉 `story-* / field-* / plane-*` 的 `augments-disabled`；按段触发（M04 §3.2 表）；全自动 8 秒自动选（贴合构筑标签 → 档位高 → 编号小，不重抽），写 `autoPickAt`、`fitsBuild`；结果进结算「本场构筑」。
- [ ] 全自动出口推广到所有类型：目标完成 → 自动拾取 → 走进出口传送门（M05 C3）。
- [ ] 副本公开状态下发 `objective / segment / wave / beacon / chests`（§2）。
- [ ] 掉落映射 M07 §3.2（每类副本用哪几张表）；`ss-map-port` 不掉落；阶段钥匙材料只从巢穴掉。
- [ ] 采集点改到实例内（M08 §4）：命令带实例、段号、点 id；巢穴每段 1–2 个、寻宝 3–4 个、剧情 / 怪潮每场 1–2 个。
- [ ] 残页第一批 3 种（定向部位、海克斯打法偏向、精英加倍）：物品、掉落、出发时消耗（失败不退）、效果执行；只能插巢穴 / 狩猎 / 怪潮 / 寻宝。
- [ ] 结算回执 `hub` 块（§2）、「再来一次」校验（节点仍可挑战、不满包、残页够则自动扣同组合）。

### B3 局外
- [ ] 港口建设三座建筑声望（M09 §3.1）：工坊 = 制作 / 分解 / 强化 / 捐献；船台 = 节点通关；邮局 = 委托 / 支线。门槛 0 / 100 / 400 / 1000 / 2500，每座 4 阶，领取 +1 天赋点（沿用 `reputationClaims` 与天赋点公式，60 上限不变）。船台第 2 阶局内重抽 +1。6 岛阵营声望冻结。
- [ ] `GET /api/hub/port`、`POST /api/hub/port/claim`。
- [ ] 码头派遣：1 支船队（船台第 1 / 3 阶 +1）、累积 12 小时、每天 1 次免费快速收益 = 2 小时、只产本航区 T1 采集材料 + 少量金币；派遣目标 = 已通关关口的航区或至少通关 1 个巢穴的当前航区；进港时服务端结算。`POST /api/hub/dock`。
- [ ] 委托板：每航区委托池（原悬赏目标改「在本航区任意节点击杀」）；板上 4 格（邮局第 2 阶 5 格）自动补满；每天 8 条、累积 3 天（≤24）；取消 600 秒冷却；经验 × 0.5、金币 P55。灰盒 18 条 `frozen`。
- [ ] `GET /api/hub/today`（§2）。
- [ ] 操作模式按角色记忆（默认 semi）。
- [ ] 旧野外悬赏板入口在 `bounties` 冻结后不可达；委托板不受影响。

### B4 数值（一次推导、一次验证）
- [ ] `tools/hub-reward-derive.mjs`（M14 §3.6 HUB-B14）：输入航区中位等级、M14 §3.3.1 系数、N7 倍率与上限 → 输出 20 个节点的金币 / 经验 / 材料 / 残页 / 声望 + 关口任务材料包 + 派遣速率表，写进工作簿 → JSON，不手填。
- [ ] 推导样板相关项：N1（风栖、雾铃 6 类副本带增益的 TTK / TTD 回到 starsea-balance-ttk-plan 档位目标 ± 20%）、N2、N3（雾铃 ◆ 每小时次数 ± 10%）、N4（关口到达等级 7 / 14，找回时点偏差 ≤ 10%）、N5、N6、N7、N8、N10。
- [ ] 断言写进测试：每类副本 `节点奖励 ÷ 预计分钟` ≤ 同航区基准；日常额外 ≤ 40%；7 日模拟残页盈余 5–15%；找回时点漂移 ≤ 10%。
- [ ] 验证不过：按 M14 §3.5 的默认裁决调一次再测，然后如实报告残差，**不扫参**。报告写 `docs/reviews/hub-b4-numbers-20261021/结果.md`（只放结论，原始明细留本地）。

## 5. 默认裁决

| # | 问题 | 默认 |
|---|---|---|
| D1 | 剧情节点场地 | 现有岛屿地图按原任务区域裁矩形段，加段边界阻挡；不做新美术。裁段要新执行能力就实现它 |
| D2 | 雾铃没有现成 plane 场地给狩猎 / 怪潮 / 寻宝 | 复用 §3.1 指定的 `ss-dg-mist-*` 单段，换刷怪配置 |
| D3 | 某节点按 §3.1 的副本跑不通（缺定义） | 先补定义；补不了就用同航区同类型最接近的场地，记决策日志，不删节点 |
| D4 | 首通奖励里的数字 | 全部由 B4 脚本导出；B4 之前用 0 并在进度文件标「待 B4」，**不手填估值** |
| D5 | 锁原因文字 | 「先通关 {航区} · {节点类型} {序号}」「完成关口任务：{第一条未完成}」「{类型}尚未开放」 |
| D6 | 推荐节点并列 | 剧情 > 巢穴 > 其他，同类按序号 |
| D7 | 委托接取 | 不做手动接取，空格自动补满；只有「交付」「放弃」 |
| D8 | 每日重置时区 | 05:00 UTC+8，服务端时间 |
| D9 | 旧接口（travel、岛屿页、旧悬赏） | 保留代码，开关打开后返回冻结错误；不删 |
| D10 | 版本 | protocol 50、rules ow-91、db 19；client 由 Claude 升 |
| D11 | 回港落点坐标 | 星门正南 2 格，朝北 |
| D12 | 与 HEX 在途改动冲突的文件（dungeon-service、field-loot 等） | 先提交 HEX 在途改动，再在其上做 HUB；冲突按两边语义合并，不回退对方 |

## 6. 验收（每批）

1. 类型检查、内容校验、`pnpm config:check`、相关定向测试通过；B4 附 `pnpm spine:check` 残差（只对新增超出负责）。
2. `/api/health`、`/api/content` 四个版本与客户端一致；后台已同步重载；真实登录进港口无版本拦截。
3. 接口按 §2 返回，缺字段算缺陷；拒绝路径返回中文 `message` 且不扣资源。
4. 自动驾驶（autopilot）脚本：新角色从开场打到当批范围内最后一个关口首领；断言 `skipped-by-freeze` = 0、所有首通各发一次、每日首通计数正确、回港队列每次 ≤1 条 unlock。
5. 留档只提交结论；原始明细、截图、数据库导出只留本地。

## 7. 切换点 S（B3 验收通过之后、B4 之前）

1. 确认没有其他会话在用常驻库（看协作中心与运行实例）。
2. 整库备份（`.runtime/backups/`，不进 Git），记录备份文件名与哈希到进度文件。
3. 打开 9 个冻结开关；清全部角色进度（声望、任务、星潮海、野外状态、外观收集、装备、钱包；账号名保留）；升 db 19。用户已同意开发期清档（2026-10-06），这不是绕过登录问题。
4. 重启服务，核对 `/api/health`、`/api/content`；GUI 浏览器真实登录一次：新角色 → 开场 → 港口 → 星门 → 风栖剧情 1 出发。
5. 在协作中心「双方留言」写一行：`HUB-S 已切换，前端可接真实接口`。

## 8. 硬阻塞（只有这些可以停下来）

- 会丢数据或破坏备份的操作；
- 需要推翻本文或 M01–M16 已定设计才能继续；
- 认证、版本校验、反作弊判罚相关的改动；
- 缺少任何管线都做不出来的美术（星门地标美术缺失**不算**：先用现有六角石环摆件或灰盒，记决策日志）。

遇到硬阻塞：先把其他不受影响的项全部做完，再在进度文件和协作中心写清阻塞项、已试过什么、需要谁做什么。

## 9. 完成定义

- [ ] B0–B4 全部勾完，S 点完成并记录备份。
- [ ] 新角色真实登录：开场 → 星门教学 → 风栖 10 节点 → 雾铃 10 节点 → 雾铃关口首领首通，全程无 `skipped-by-freeze`、无野外入口。
- [ ] §2 全部接口可用，前端（Claude）能不改字段名接上。
- [ ] B4 报告已提交，残差如实写明。
- [ ] 进度文件、决策日志、协作中心状态一致；所有提交不含素材和原始数据。
