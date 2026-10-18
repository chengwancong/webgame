# 裂星远航 · 完整 RPG 流程落地方案（交给实施方）

日期：2026-10-04。编写依据：实际阅读当前代码、内容配置、`docs/starsea/` 全套设计与 `AGENTS.md`。
本文是**实施说明**，不是完成记录。实施方（GPT/Codex）必须同时遵守上级 `AGENTS.md`；本文与 `AGENTS.md` 冲突时以 `AGENTS.md` 为准，并在提交说明中指出冲突。

---

## 0. 为什么现在“连不成线”——诊断事实

| # | 现象 | 证据（文件） | 玩家感受 |
|---|---|---|---|
| D1 | **星潮海整套内容未接入**：6章36任务、13地图、7 NPC、21怪物、6首领、30技能表现、24组物件，129项资源已验收，但游戏里一项都没用 | `docs/starsea/handoff.md`、`acceptance.md`；资源在 `apps/web/public/art/starsea/` | 做好的场景/模型/怪物/动效看不到 |
| D2 | 同一片区域有 **4 个平行入口**：野外探索、剧情副本 `story-*`、普通副本 `normal-*`、试炼 `trial-*`（另有 high/raid/nightmare） | `packages/content/dungeons.json` definitions；`apps/web/src/travel-browser.ts` `destinationCatalog` | 不知道该走哪个，主线和野外互不相干 |
| D3 | **两套解锁门槛并存**：野外靠 `progress.regions`（击败上一区首领），剧情靠 `story.events['<chapter>:return']` | `travel-browser.ts:20 destinationReady`；`packages/rules/story-campaign.ts storyChapterAvailable` | 解锁顺序混乱 |
| D4 | 剧情只发生在副本实例里；野外地图上只有“击败6名敌人”“击败守门人”两个任务 | `packages/content/tasks.ts` | 野外像空壳 |
| D5 | 苍风/迷雾/赤岩三张野外地图布局几乎一样（地标同为 归途路碑/旧石桥/首领结界/据点） | `packages/content/maps/meadow|forest|rift.json` | 场景重复 |
| D6 | 旧第4–6章 11 种怪物是“借用动画占位”（冰霜狼用 beast 图集等） | `packages/asset-manifest/chapters.json` status=`borrowed-animation-placeholder` | 怪物不对版 |
| D7 | 旧剧情引擎是**写死的 6 阶段**（tracks/ambush/route/guards/rescue/beacon），物件坐标由代码推算 | `packages/simulation/story-encounter.ts`、`contracts/story.ts StoryState.version=1` | 无法承载新剧情 |

**结论**：不要再做新内容。工作是把星潮海接成唯一主线，把已有系统（强化、副本、试炼、高难、团队、梦魇、技能书）挂到这条线上，形成一条从开局到结局的路径。

---

## 1. 目标体验（玩家视角的一条线）

```
新角色 → 风栖岛坠落（开场，教移动/攻击）
      → 拾星港（主城 Hub：NPC、工坊、航台）
      → 航图选岛 → 岛上剧情任务（调查/守护/二选一/首领）→ 回港报告
      → 回港时解锁功能（强化→试炼→采集制造→武器盘/高难→召唤石→法典/团队→梦魇）
      → 六岛依次开放 → 第6章维洛 → 关闭界桥尾声
      → 后期循环：已通关岛屿自由探索刷装、副本/试炼/高难/团队/梦魇
```

每章固定节奏（36任务都是这个模式的变体）：
1. 港口/前一任务 NPC 接取 → 2. 岛上现场调查 → 3. 机制战（守护/多点交互/救援） → 4. 路线二选一 → 5. 首领（准备区+明确进入） → 6. 回港报告、对白、解锁、下一岛开放。

---

## 2. 已替你做好的关键决策（如用户另有意见再改）

| 决策 | 选定方案 | 理由 |
|---|---|---|
| K1 主线 | 星潮海「裂星远航」成为**新角色的正式主线**；旧「最后一条归途」冻结，不再给新角色 | 设计与资源都已确认并验收；旧线素材重复、怪物占位 |
| K2 旧角色 | 已有角色保留全部已开放功能（`legacyAccess` 语义不变），可在港口**选择开始**星潮海第1章；旧剧情事件、回执、档案原样保留，不改写 | AGENTS.md：不补造历史、不清空成长 |
| K3 主城 | 新角色的安全地图从 `town` 换成 `ss-map-port`（拾星港）；旧角色仍可用 `town`，开始星潮海后切换到港口 | 一个主城一条线 |
| K4 岛上剧情载体 | 继续用**服务端副本运行器**（与旧剧情相同的权威模型），但阶段改为**数据驱动** | AGENTS.md 要求剧情目标消费服务端运行结果 |
| K5 野外 | 某岛本章报告完成后，该岛开放为**自由探索野外**（同一张地图，无剧情物件，标准刷怪/清场规则） | 解决 D2/D4：同一张图先剧情、后刷图 |
| K6 旧6区域 | 旧野外与 normal/trial/high/raid/nightmare 副本先**保留**，作为后期内容；其准入改为“星潮海对应章节报告完成 **或** 旧条件” | 不浪费已有平衡和副本系统，不破坏旧存档 |
| K7 怪物数值 | 新怪物**新建独立模板ID**，数值从 `rule` 指向的旧模板复制（raider/archer/caster/beast/guard/summoner/assassin），首领从 `base` 复制；不改旧模板 | AGENTS.md 怪物模型；SS-G07 |
| K8 经验预算 | 沿用旧六章经验预算重新分配（见 §6.5），之后跑可达性计算 | campaign.md 要求重新证明可达性 |

---

## 3. 总体架构改动一览

```
packages/content/
  starsea/                      ← 新目录（全部新增）
    campaign.ts                 36任务、6章、路线、功能解锁、NPC表（由 requirements.json 生成/校验）
    maps.ts                     13张星潮海地图 → Region 适配器
    monsters.ts                 21怪物+6首领 → 模板注册（写入 monsters.json 新模板）
    task-kinds.ts               12种任务类型的执行参数（半径、时长、数量）
packages/contracts/story.ts     StoryState v2（campaign 命名空间）+ 新视图 schema
packages/rules/
  starsea-campaign.ts           前置/可接/完成/功能解锁/航图开放的纯规则
packages/simulation/
  starsea-encounter.ts          数据驱动的任务执行器（替代写死6阶段的方式，旧文件保留给旧线）
apps/api/src/
  starsea-service.ts            港口对话/报告、选择路线、航图出航（新增）
  dungeon-service.ts            增加 starsea 实例分支（按任务段启动实例）
  app.ts                        注册新路由；/api/content 输出新内容版本
apps/web/src/
  starsea-runtime-assets.ts     把 starsea 图集/原生角色注册进 Phaser
  starsea-story-renderer.ts     NPC、物件（多状态）、交互提示
  starsea-chart.ts + .css       航图界面（替代/扩展 travel-browser 对新角色的入口）
  starsea-dialogue.ts + .css    对话、二选一、译读记录、尾声
  task-model.ts / task-panel.ts 接入 36 任务
```

依赖方向保持：`web → contracts/content/rules/simulation`，`api → 同上`，`simulation` 不碰 DOM/HTTP/DB。

---

## 4. 分批实施（每批都必须可玩、可验收后再进下一批）

### B0 统一样板（预计最先、最小）
目的：证明“新地图 + 新怪物 + 新首领 + 新 NPC + 新物件”能在真实游戏里跑通，**不写剧情逻辑**。

1. **地图适配器** `packages/content/starsea/maps.ts`
   - 读取 `apps/web/public/art/starsea/scenes/maps/ss-map-*.json`（建议复制一份到 `packages/content/starsea/maps/`，客户端与服务端读同一份；`public` 下保留用于美术预览，构建脚本校验两份哈希一致）。
   - 映射到现有 `Region` 类型（`packages/content/index.ts`）：
     - `id` = 地图 id（`ss-map-wind` 等），`name`、`theme=theme.key`、`width/height` 直接用。
     - `safe`：取 `safe[]` 中 `id==='landing'`（港口取 `landing`）的中心点作 `Region.safe`；`boss-preparation` 另存 `bossPortal`。
     - `portal`：landing 中心；`bossPortal`：`landmarks.gate`。
     - `obstacles`：直接用；**另外**把 `boundary`（浮岛边缘，`stepCells/thicknessCells`）生成为边界外圈障碍，保证走不出岛。
     - `spawns`：每个 `spawns[]` 的 `artId→art`、`ruleReference→kind`、`level/rank` → 用 `monsters.json` 新模板解析（见第3步）。`aggroPolicy:'field-only'` 的刷怪点**只在自由探索模式生成**，剧情实例不生成。
     - `landmarks`：`{name:id, x, y, kind:id}`；加一个 `presentationKey`=地图 id。
     - `boss` 地图（`ss-map-boss-1..6`）`boss:true`，只放首领刷怪点。
   - 在 `regions` 数组末尾追加 13 张图（不改旧图顺序/ID）。
   - `tools/validate-content.ts` 增加：所有 landmark 可由 landing 寻路到达（用 `packages/simulation/navigation.ts`），道路宽度≥3格，safe 区内无刷怪点。不可达时**报出坐标**，不要私自挪点（maps.md 明确要求）。

2. **怪物模板** `packages/content/monsters.json`
   - 为 21 个 `ss-mon-*`/`ss-elite-*` 新增模板，`baseStats/ai/skills` 从 `rule` 对应旧模板**复制**（raider/archer/caster/beast/guard/summoner/assassin）；精英走 `ranks.elite` 修正，不手改倍率。
   - 6 个首领从 `base` 对应旧首领模板复制（meadow-boss/forest-boss/rift-boss/frost_queen/abyss_lord/dragon_king），`bossKey` 用新首领 id。首领阶段（4 阶段资源）**本批先只用单阶段**，阶段规则放 B2+。
   - 怪物技能：沿用旧模板 skills（机制已存在）；`ss-fx-*` 表现 id 与旧机制的映射写在 `packages/content/starsea/monsters.ts` 的 `fxBinding` 表里（如 `ss-fx-b01-charge → meadow-boss 冲锋`）。**没有执行器的表现不要绑定**。

3. **客户端资源注册** `apps/web/src/starsea-runtime-assets.ts`
   - 怪物（`runtime.kind==='atlas'`）：用 `runtime.image/atlas` 直接 `this.load.atlas(id, image, atlas)`；按 `runtime.actions.{idle,move,attack,hurt,death}.frames/fps/loop` 建 Phaser 动画；`anchor/scale/displayHeight/nativeFacing` 进入现有 actor 描述（参考 `packages/asset-manifest/actors.ts` 的字段，新增一个 `starsea` 来源分支，**不要**改旧条目）。
   - NPC 与首领（`runtime.kind==='native'`）：照搬 `story-renderer.ts` 的现成模式——`Phaser.Textures.CanvasTexture` + 画师对象；画师用 `StarseaActorPreview`（`apps/web/src/starsea-actor-preview.ts`，已支持 action/phase/profile 切换）。首领在战斗中按服务端事件切 `idle/move/attack/skill/hurt/death` 与 `phase-enter/active/end`。
   - 性能：同屏原生角色≤8；不在视野内停止重绘；同 profile 共享解析结果。
   - 物件（`props/manifest.json`）：按 `states[state].file/anchor/displayHeight` 渲染，状态切换由服务端视图驱动。

4. **场景地表**：`scene.ts` 现有按 `presentationKey`/`theme` 选背景的逻辑，新增 starsea 分支：`groundResource` 平铺地表、`backdropResource` 天空、`decorations[]` 按 `depthMode:'footpoint'` 排序、`occlusion:'foreground'` 的装饰在角色靠近时淡化（不改碰撞）、`boundary` 浮岛边缘图。

5. **验收 B0**：开一个开发专用入口（仅 `AW_TEST_LOGIN=1` 可用）把测试角色放进 `ss-map-wind`：能走、碰撞正确、走不出岛、风原巡猎兽/暮界刀兵能打能死并正常结算掉落；`ss-map-boss-1` 能打卡珀；港口能看见澄在待机。截图+控制台无资源错误。`pnpm content / test:core / tsc / build` 全过。

### B1 新剧情引擎 + 拾星港 + 第一章完整可玩（最关键的一批）

1. **状态 v2** `packages/contracts/story.ts`
   ```ts
   // 旧 v1 不动，新增：
   storyStateV2 = {
     version: 2,
     legacyAccess: boolean,              // 原语义
     events: Record<string,string>,      // 旧事件键原样保留（meadow:return 等）
     choices: Record<string,string>,
     campaigns: {
       'starsea-invasion'?: {
         startedAt: string,
         events: Record<string,string>,  // 'ss-c01-t01:complete' → ISO 时间
         choices: Record<string,string>, // 'ss-c01' → 'shore'
         progress: Record<string,{count:number; done:string[]}>, // 进行中任务：已完成的物件/节点/波次 ID
         openedIslands: string[],        // 'ss-map-wind' ...
       }
     }
   }
   ```
   - 读取时 v1 自动升级为 v2（`campaigns:{}`），**只加字段不改旧字段**；数据库 JSON 迁移不需要改表，但 `db` 版本号 +1，并在迁移脚本中写入升级后的结构（保留备份）。
   - 新角色：`campaigns['starsea-invasion']` 在建角时创建；`legacyAccess=false`。

2. **内容** `packages/content/starsea/campaign.ts`
   - 从 `docs/starsea/requirements.json` 的 `chapters[].tasks[]` 读取：`id,title,kind,goal,speaker,accept,player,complete,landmark,required,requires,completionEvent,resources`；`chapters[].choice` 读路线。**ID 一字不改**。
   - 增加执行参数（文档里缺的由本表补齐，单位：导航格/秒）：
     | kind | 执行规则 |
     |---|---|
     | `battle` | 实例在 `landmark` 附近生成 `required` 名指定怪物（取任务 `resources` 中的 `ss-mon-*`），全部击杀即完成；t01 另需先交互 `ss-prop-key` |
     | `dialogue` | 港口或岛上 NPC 对话确认一次；服务端只校验前置 |
     | `investigate` | 1 个物件，玩家存活、距离≤2.8、交互 → 完成 |
     | `multi-investigate` | `required` 个物件（landmark 为 `clue-1..n` 或在 `clue` 周围按地图 landmarks 取），任意顺序，各一次 |
     | `multi-interact` | `required` 个装置（`valve-1..`/`device-1..`），**按顺序**；每个装置先清除其守卫波次才可交互 |
     | `defend` | 交互启动 → 半径 4、持续时长（c01:15s，c03:20s，其余按 `task-kinds.ts` 配置）在范围内且无敌人压入才累计 → 时间满且该波敌人全清才完成（复用旧 beacon 判定代码） |
     | `multi-defend` | 3 个节点**串行**，每个 12 秒 + 清波；每节点独立进度，断线恢复到当前节点（SS-G04） |
     | `rescue` | 清除 `required` 名守卫 → 近距离交互绑扣（`ss-prop-binding`→`released`）→ 同伴跟随（复用旧 rescue 跟随） |
     | `choice-battle` | 在 route-a/route-b 之间二选一（服务端写一次 `choices[chapter]`，重复请求返回原选择）→ 在所选 landmark 生成该路线 `enemies`，清 `required` 名完成 |
     | `boss` | 走到 `gate` → 准备区 → 明确进入（复用现有首领准备/进入流程）→ 击杀首领完成 |
     | `report` | 回港与 `speaker` NPC 对话；与奖励、档案、功能解锁同一事务 |
     | `post-boss-report` | 首领死亡后首领场 `terminal` 物件出现；交互主控（服务端确认）→ 播尾声 → 回港确认（SS-G05） |

3. **任务分段 → 副本实例**（核心规则，务必照做）
   - 每个任务有 `map`：港口（`ss-map-port`）或岛/首领场。
   - **港口任务**（dialogue/report，以及 map=port 的任务）不开实例，走 `POST /api/starsea/talk`。
   - **岛上任务**：玩家在航图选择本章岛屿出航 → 服务端创建一个 starsea 实例，**从当前未完成任务开始，连续执行同一岛上的所有后续任务**，直到下一个任务 map=port 为止；`boss` 任务切到 `ss-map-boss-N` 作为实例第二阶段（同旧 `stages:[area, area-boss]`）。
   - 例：第1章 = 实例A（t01，风栖岛）→ 港口 t02 → 实例B（t03→t04→t05，风栖岛→首领场）→ 港口 t06。
   - `dungeons.json` 为每章新增定义 `ss-story-c01..c06`：`profiles:["realtime"]`，`area` 为岛地图，`stages:[岛, 首领场]`，`story:"ss-c0N"`，`campaign:"starsea-invasion"`，`level` 用章节准入基线，`policy.monsterLevel` 用章节等级。**仍走现有准入/时限/保留/断线恢复默认值**（AGENTS.md：副本规则唯一源是 dungeons.json）。

4. **执行器** `packages/simulation/starsea-encounter.ts`
   - 输入：冻结的章节定义 + 当前任务索引 + 进行中进度；每 tick 推进；输出视图（沿用 `storyEncounterSchema` 的结构，扩展 `objects[].kind` 增加 `prop|device|node|terminal`、`state` 改为字符串取自物件 `states`）。
   - 物件坐标**全部来自地图 landmarks**，不再按桥推算（替代 `storyPositions`）。
   - 波次生成：只生成一次（记录 `spawned`），远程怪生成点需与目标点视线畅通（复用旧逻辑）。
   - 完成任务时产生事件 `starsea-invasion:<taskId>:complete`，由 `dungeon-service` 在**同一事务**写 events、经验、回执、流水（复用旧 `recordStoryEvent` 的事务路径，键加 campaign 前缀）。
   - 手动移动/改点取消待完成交互（原规则）。

5. **API** `apps/api/src/starsea-service.ts` + `app.ts`
   - `GET /api/starsea` → 当前章/任务、可接/阻塞原因、对白（accept/player/complete/未完成提示）、已开放岛、路线选择、功能解锁状态、港口 NPC 列表。
   - `POST /api/starsea/start`（旧角色开始新主线；新角色建角即开始）。
   - `POST /api/starsea/talk {npc, task}` → 港口对话/报告；校验前置、发放奖励（幂等 command_id）。
   - `POST /api/starsea/choice {chapter, route}` → 仅在 `choice-battle` 任务当前时可写，写一次。
   - 出航：复用副本入口 `POST /api/dungeon/...`，`dungeon-service.ts` 第57行准入处增加 starsea 分支（检查当前任务在该岛且已接取）。
   - 所有写入：command_id + revision；归属来自认证；契约在 `packages/contracts` 用 zod 校验响应。

6. **客户端**
   - **拾星港 Hub**：新角色登录后进入 `ss-map-port`；NPC 站在 `hall/forge/pier`（澄在登记厅、铜铃在工坊、米洛在航台）；E 交互打开对话。HUD 遵守“安全地图展开全部非战斗功能、隐藏战斗操作”（`docs/hud-layout.md`）。
   - **对话界面** `starsea-dialogue.ts`：NPC 头像+名字、逐句（可跳过演出，不能绕过判定）、玩家回应行、二选一卡片（显示路线名、描述、敌人头像）、报告完成后的奖励与功能解锁提示。样式只用 `ui-tokens`。
   - **航图** `starsea-chart.ts`：在航台(pier) 交互打开；六岛节点（`ss-prop-world-chart.svg` 作底图），未开放置灰并写原因，已开放显示“剧情出航（当前任务）/自由探索（本章报告后）”两个按钮——**这是唯一的出航入口**，新角色不再显示旧 travel-browser 的 4 种入口。
   - **任务追踪条**：显示当前任务 goal 与服务端计数（如 `清除守卫 2/3`），点击定位到 landmark（小地图雷达上标点）。
   - **任务页**：`packages/content/tasks.ts` 增加 36 个主线任务定义（`typeId:'main'`），完成后进入档案并保存选择与文案快照；旧任务定义不删。

7. **验收 B1**（真实数据库 + 真实浏览器，新账号）：
   坠落风栖岛 → 拾航钥+击退2只 → 回港登记 → 出航守船台 → 选岸线/仓库其一 → 准备区进入卡珀并击败 → 回港签契约 → 获得「装备强化」并能强化 → 航图上雾铃岛点亮。
   另测：中途断线重连（阶段、波次怪 ID、守护进度恢复）；重复 talk/choice 不重复发奖、选择不变；服务重启后恢复；老账号登录后旧进度与功能不变、可点“开始裂星远航”。

### B2 第2、3章（邮路/译读、工坊设备）
- 新增执行：`multi-investigate`（三处邮站，任意顺序）、`rescue`（青芒）、`multi-interact`（冷却阀按顺序，坏→好状态图 `ss-prop-valve-broken`→`ss-prop-valve`）、c03 `defend` 4 敌 20s。
- 首领阶段：为卡珀/格铎/掘星者接 4 阶段（`phase-enter/active/end` 资源已就绪）：在 `monsters.json` 首领模板增加 `phases:[{hpBelow:0.7,...},{hpBelow:0.4,...}]`，阶段切换由模拟核心触发事件，客户端只播放；技能表现 `ss-fx-b0N-*` 按 `fxBinding` 绑定旧执行器。没有执行器的技能先不上。
- 译读记录界面（家书）：报告时展示“记录”卡片（`ss-prop-letter`/`ss-prop-log`），内容取自 chapters/c02.md 对白。
- 解锁：c02 报告→采集与制造；c03 报告→武器盘、高难挑战。

### B3 第4、5章（观测、证据、撤离）
- c04：`multi-investigate` 冻舰记录、`multi-interact` 观测装置、`investigate` 星盘（`star-chart-fragmented`→`aligned`）。
- c05：`battle` 登陆、`multi-investigate` 证词、`multi-interact` 三座供能器、撤离平民（`ss-prop-refugee`，可作为物件状态表现，不新增护送系统）。
- 揭密顺序严格按 `campaign.md` / `chapters/c04.md`、`c05.md`：c05 报告才揭示玩家身份与维洛命令。
- 解锁：c04→召唤石；c05→威能法典、团队副本。

### B4 第6章与尾声
- `dialogue` 誓约庭、`multi-defend` 三节点串行、维洛首领（`ss-boss-vilo` 剧情与战斗共用同一主体）、`post-boss-report`：首领死亡后 `terminal` 出现 → 交互关闭界桥 → 尾声对白（记录全部六章路线选择）→ 回港确认复航。
- 解锁：梦魇挑战；港口新增“故乡坐标”占位入口（只显示，后续线）。

### B5 把旧系统挂回主线（解决 D2/D3）
1. **自由探索**：章报告后，对应岛在航图出现“自由探索”。用现有野外规则（清场不原地重刷、满包停止自动等），地图使用 `field-only` 刷怪点；奖励走 `regional-rewards.json` 新增 6 岛条目，数值参考对应旧区域（风栖≈苍风、雾铃≈迷雾、赤炉≈赤岩、霜镜≈冰封、沉星≈暗影、龙眠≈龙骨）。
2. **副本/试炼/高难/团队/梦魇**：在 `dungeons.json` 为每岛增加 `normal-ss-*`、`trial-ss-*`（复用岛图与首领场），准入=对应章报告完成；旧 `normal-*/trial-*/high-*/raid-*/nightmare` 保留给旧角色，新角色在航图“挑战”页看到的是星潮海版本。high/raid/nightmare 不必复制，改为准入条件“`storyFeatureUnlocked` 由 starsea 事件 **或** 旧事件满足”。
3. **功能解锁表**：`storyFeatures` 每项增加 `starseaEvent`（`ss-c01-t06:complete`→trial，`ss-c01-t05:complete` 或 t06→forge，按 campaign.md「章节与准入」），`storyFeatureUnlocked` 改为：`legacyAccess || 旧事件 || starsea 事件`。所有入口（强化报价、强化命令、成长预览/提交、挑战入口）都已调用这个函数，改一处即可，但要逐一回归。
4. **技能推进**：每章报告给出“本章推荐技能”（只推荐有执行器的技能），技能书仍由首领首通发放（`skillBookRewards` 增加新首领 id → 原技能映射：卡珀→ember，格铎→chain）。

### B6 打磨与完整回归
- 教学：在 c01 的 t01/t03/t04/t05 分别用地面提示教移动攻击、守点、躲危险圈、准备区（不连续弹窗，`docs/00-project/open-world-development-outline.md` §1.8）。
- 经验可达性：`pnpm balance` 增加星潮海路径，证明不刷怪、不靠随机装备可依次达到各章准入等级（1/2/4/5/7/9）。
- 全流程实机：新账号从坠落到尾声一次打通（允许正常练级，不改测试角色属性），录关键截图存 `docs/reviews/open-world/starsea-campaign-<日期>/`。

---

## 5. 任务完成判定的统一规则（所有类型都要满足）

1. 前置不满足 → 服务端拒绝并返回 NPC 的“未完成提示”文案。
2. 交互：玩家存活、距离≤2.8、目标处于可交互状态、当前任务正确；客户端只发意图。
3. 击杀：只计本任务配置来源的实例怪（波次 ID 前缀 = 任务 ID），**不能**用累计击杀或其他任务的怪。
4. 完成事件、经验、回执、流水、档案快照**同一事务**；同一事件只发一次奖励；重开实例可得正常战斗奖励但不重复发剧情奖励。
5. 断线/重启：恢复阶段、怪物 ID、守护进度、选择；战斗不因面板/后台/断线暂停。
6. 长对白可跳过，但不能跳过判定。

---

## 6. 数据与数值

> **数值以 [`../balance-30h-design.md`](../balance-30h-design.md) 为准**（30 小时等级/经验/装备品质/词缀/掉落/强化/解锁时间线）。本节旧经验预算只用于说明现状；章节准入等级改为 1/10/17/23/28/33。

### 6.1 章节 ↔ 地图 ↔ 首领 ↔ 准入
| 章 | 岛图 | 首领场 | 首领（模板来源） | 准入 | 解锁 |
|---|---|---|---|---|---|
| ss-c01 | ss-map-wind | ss-map-boss-1 | 卡珀（meadow-boss） | 1 | 强化；报告后首领试炼 |
| ss-c02 | ss-map-mist | ss-map-boss-2 | 格铎（forest-boss） | 2 | 采集与制造 |
| ss-c03 | ss-map-forge | ss-map-boss-3 | 掘星者（rift-boss） | 4 | 武器盘、高难 |
| ss-c04 | ss-map-frost | ss-map-boss-4 | 霜镜卫（frost_queen） | 5 | 召唤石 |
| ss-c05 | ss-map-rift | ss-map-boss-5 | 乌洛（abyss_lord） | 7 | 威能法典、团队 |
| ss-c06 | ss-map-dragon | ss-map-boss-6 | 维洛（dragon_king） | 9 | 梦魇 |

### 6.2 NPC 站位（港口）
澄→hall(10,19)；铜铃→forge(19,20)；米洛→pier(25,10)；青芒/弥迦/雪弥/烬羽按 `npcs[].chapter` 在加入章节报告后出现在港口（同旧 campNpcs 逻辑），位置在 hall/forge 之间道路两侧，需通过寻路可达校验。

### 6.3 新怪物模板来源
刀兵/拾荒者→raider；铳手→archer；织隙者/炉渣小灵/侍仪→caster；巡猎兽(风/霜)→beast；苔壳/搬运机/冻舰守卫/龙骨巡卫→guard；唤灵者/唤潮者→summoner；潜猎者→assassin；精英按表中 rule + elite 修正。

### 6.4 怪物等级
剧情实例 `policy.monsterLevel` = 章节准入（1/2/4/5/7/9）；首领同级、首领档位修正。不要按玩家等级缩放。

### 6.5 剧情经验预算（沿用旧章节总额再分配）
| 章 | t01–t05 合计（旧 phase 合计） | t06 报告（旧 closeXp） |
|---|---|---|
| c01 | 190 | 80 |
| c02 | 225 | 100 |
| c03 | 270 | 130 |
| c04 | 305 | 150 |
| c05 | 345 | 180 |
| c06 | 425 | 220 |
t01–t05 按权重 15/15/20/20/30% 分配，取整，余数加到 t05。完成后必须跑可达性验证，不达标再调权重，不调怪物。

---

## 7. 实施方必须遵守的约束（摘自 AGENTS.md，违反即返工）

- 持久状态只由服务端改；客户端不能自己勾任务、加计数、发奖。
- 怪物模板唯一源 `monsters.json`；不按外观绑技能；不按玩家等级缩放。
- 副本规则唯一源 `dungeons.json`；已开战实例只由服务端推进，不暂停。
- UI 颜色/字号/间距只来自 `packages/ui-tokens/tokens.json`；奶白浅金风格；任务页常驻多任务列表；小地图按已选方案B。
- 旧存档：不清空、不补造历史、不把旧任务 ID 改名覆盖。
- 每批改完：确认 Windows 常驻服务已自动重载（`node tools/local-service.mjs status`），核对 `/api/health` 的 protocol/rules/assets 与网页一致，用真实浏览器登录进入主城验证；版本号（client/protocol/rules/assets/db）按改动递增。
- 不关闭版本校验、不伪造健康、不删数据库。

## 8. 每批提交前的检查命令

```sh
pnpm content
pnpm test:core
pnpm exec tsc --noEmit
pnpm test:db          # 新增：starsea 事务/幂等/恢复用例
pnpm check            # 完整端到端（临时数据库）
```
新增测试至少覆盖：v1→v2 状态升级；36 任务前置链；每种任务类型完成/拒绝/幂等；选择写一次；分段实例（c01 A/B 段）；断线恢复；功能解锁三种来源；老角色不受影响。

## 9. 已知坑

1. `ss-c01-t01` 在岛上、`t02` 在港口：必须实现 §4-B1-3 的“分段实例”，不要把整章塞进一个实例。
2. `multi-investigate` 的 landmark 写的是 `clue-2`/`clue`，地图里实际 landmark 名要以 `ss-map-*.json` 为准；对不上时报坐标问题给用户，不要猜。
3. 原生角色（NPC/首领）走 CanvasTexture 绘制，成本高；只为视野内角色重绘。
4. 地图 JSON 在 `public` 和 `dist` 各有一份，服务端不能读 `dist`；以 `packages/content/starsea/maps/` 为唯一源，构建复制到 public。
5. Windows 构建前先 `pnpm service:stop`，否则 Vite 监视器锁文件（README）。
6. 先修现有隐患再动大改：`apps/api/src/database.ts` 的 `Pool` 缺 `on('error')`，PostgreSQL 断开会让 API 崩溃；`open-world/` 目前未纳入 git，**动工前先提交基线**。
