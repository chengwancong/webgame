# 后端交接：杖剑借鉴 Z1–Z4（出战方案 / 部位强化 / 宠物上阵 / 航区探索度）

> 2026-10-23 Claude（总策划）写给 Codex/GPT。设计见 `../modules/M17-zhangjian-z1-z4.md`。**设计已定，照做**；有默认裁决的直接按默认做，并记进决策日志，不回来问。
> **契约、内容表、规则层 Claude 已写好并有单测**，你只做服务端：存档、迁移、接口、副本里的接入、结算发放、数值验证、部署。不重写规则函数；确需改规则，在决策日志写一行并补单测。
> 前端由 Claude 同时做，只消费本文 §2 的接口；接口 404 时前端隐藏入口，所以你可以按批次逐个上线。
> 本批排在 B4（ow-92 / 0.11.51）之后；B4 没收尾就先收尾 B4，再开本批。

## 0. 执行方式（强制）

1. **一次连续做完 Z0 → Z1 → Z2 → Z3 → Z4 → Z5 → Z6**，批次之间不停、不等确认、不回来问。允许的结束状态只有两种：
   - **全部完成**：§6 完成定义全部勾上；
   - **硬阻塞**：已做完所有不受影响的部分，只剩 §5 列出的硬阻塞。
2. 进度文件：同目录 `backend-z-progress.md`（你创建并持续更新）。每完成一项勾一项，写提交号和一句验证结论。中断后从第一个未勾项接着做。
3. 决策日志：同目录 `backend-z-decisions.md`，每条一行：问题｜处理｜依据条目。
4. 协作中心：`游戏协作.md` 超过 40,000 字符先归档；任务队列加 `HUB-Z | P1 | 进行中 | Codex | 杖剑 Z1–Z4 服务端`，每批完成更新一次，只用 `更新游戏协作.ps1`。
5. 本机只跑 tsc、单测、PG 测试（数据库测试一次一个，`node tools/vitest-tempdb.mjs`）；**重任务一次只跑一个**；不跑无头浏览器和浏览器自动化（本机常驻 MU）。真机体感交给云测试服 + Grok。
6. 云测试服口令只在 `G:\webgame\aw-deploy\staging-credentials.txt`。**不要把口令写入报告、截图、公开链接或日志；不要用控制台改角色、钱包、等级、任务或奖励，也不要清空数据库。**
7. 不碰 `apps/web`（前端是 Claude 的）；不提交图片和原始数据明细。

**禁止**：只写文档不写代码；把未接通的功能写成「已生效」；跳过测试；为过测试改断言或降标准；手填数值绕过 §Z5 的推导；在规则层之外复制一份规则逻辑。

## 1. 已就绪的东西（直接用）

| 文件 | 内容 |
|---|---|
| `packages/contracts/zhangjian.ts` | 存档 schema（`loadoutsStateSchema`、`petsStateSchema`、`exploreStateSchema`）、视图 schema、请求 schema（`loadoutRequestSchema`、`petsRequestSchema`、`slotUpgradeRequestSchema`）、回执 `loadoutApplyResultSchema` |
| `packages/contracts/index.ts` | `CharacterState` 已加可选 `loadouts`、`slotRanks`、`pets` |
| `packages/contracts/hub.ts` | `chartNodeViewSchema` 已加可选 `elements`、`cache`、`door`；`chartRegionViewSchema` 已加可选 `explore` |
| `packages/contracts/monsters.ts` | `monsterCombatSchema.weakness` 可选 |
| `packages/simulation/index.ts` | 弱点倍率已接（玩家方伤害、护甲前乘） |
| `packages/content/{hub-elements,pets,hub-explore}.json` + `zhangjian.ts` | 航区元素表、18 个宠物家族与数值、探索度点数 / 钥匙 / 锁门 |
| `packages/rules/zhangjian-build.ts` | 部位强化（`withSlotRank`、`resonanceTier`、`migrateSlotRanks`、`catchUpAffixNodes`）、宠物构筑来源；**已接进 `resolveBuild`** |
| `packages/rules/zhangjian.ts` | 方案（`ensureLoadouts`、`saveLoadout`、`renameLoadout`、`applyLoadout`、`loadoutView`）、部位视图（`slotUpgradeQuote`、`slotsView`）、宠物（`grantPet`、`grantPetXp`、`setPetLineup`、`setPetFlow`、`petsView`、`gatePet`、`explorePet`）、探索（`regionExplore`、`nodeExploreFields`、`gateKey`、`dockExploreBonus`、`cacheId`、`pickCacheCell`）、弱点（`applyRegionWeakness`） |
| `tests/zhangjian-rules.test.ts` | 21 条规则单测，全部通过；旧存档（无 slotRanks / pets）的 `resolveBuild` 结果与改动前逐字节相同 |

注意：`tests/build-variety-r1.test.ts` 的 4 条金标哈希在本批之前就已失败（基线同样失败，与本批无关）。你如果顺手修，单独提交，写明原因。

## 2. 接口（前端照此对接）

所有写接口沿用现有 `write(who,v,{...},async(c,s)=>{...})` 模式（`command_id` 幂等、revision、日志）。错误码照现有 `fail(code,msg,status)`。

| 接口 | 请求 | 返回 | 说明 |
|---|---|---|---|
| `GET /api/loadout` | — | `LoadoutView` | `loadoutView(s,resolveBuild(s).stats,switchBlock)`；读之前 `ensureLoadouts`（只在内存里，不落库也行） |
| `POST /api/loadout` | `loadoutRequestSchema` | `{revision, loadout:LoadoutView, result?:{applied,skipped}}` | `save`→`saveLoadout`；`rename`→`renameLoadout`；`apply`→`applyLoadout`，并对装回的每件装备跑 `catchUpAffixNodes(s,g,reinforceAffixNode)` |
| `GET /api/slots` | — | `SlotsView` | `slotsView(s,rank=>gearUpgradeCost({rank,ilvl:穿戴件 ilvl},upgradeCost))`（`legacy` 回调按现有强化价目算，见 Z2） |
| `POST /api/slot/upgrade` | `slotUpgradeRequestSchema` | `{revision, slots:SlotsView, reached:number[]}` | 见 Z2 |
| `GET /api/pets` | — | `PetsView` | `petsView(s)` |
| `POST /api/pets` | `petsRequestSchema` | `{revision, pets:PetsView}` | `lineup`→`setPetLineup`；`flow`→`setPetFlow`；规则函数抛错转 `fail('PET',msg,400)` |
| 航图视图（已有） | — | 节点加 `elements`/`cache`/`door`，航区加 `explore` | `nodeExploreFields(h,node.id)` 展开进节点视图；`regionExplore(h,region)` 放航区视图 |

`switchBlock`：角色有进行中的副本 / 野外实例时为 `'副本中不能切换方案'`，此时 `apply` 返回 409 `LOADOUT_LOCKED`。`save`、`rename` 不受限。

## 3. 批次

### Z0 准备
- [ ] 读 M17 全文和本交接；`npx tsc --noEmit -p .`、`npx vitest run tests/zhangjian-rules.test.ts` 先跑一遍确认绿。
- [ ] 建进度文件、决策日志、协作任务行。

### Z1 出战方案 + 元素弱点
- [ ] `GET/POST /api/loadout`（§2）。`apply` 成功后 `s.build++`（`applyLoadout` 内部已做的不要重复加）。
- [ ] 副本 / 野外进行中判定复用现有判定（进图时写的实例记录）；有实例 → `switchBlock`。
- [ ] `hub-dungeon-runtime.ts`：所有生成怪物的出口（剧情段 `frozenStorySpawns`、怪潮、狩猎稀有精英、`hub-shard-elite` 复制、拟态宝箱精英）在交给 `World` 之前调用 `applyRegionWeakness(spawns,state.nodeId)`。只要统一在一个出口调用一次即可，**不要**在冻结快照里存弱点（快照存原样，取出时再挂）。
- [ ] 测试：PG 测试 1 条——存方案、改技能、切回、技能恢复；副本中切换得 409。单测 1 条——风栖节点生成的怪全部带 `weakness.type==='lightning'`。

### Z2 部位强化 + 共鸣
- [ ] **迁移**：读角色状态时 `migrateSlotRanks(s)`（返回 true 就落库）。开发期允许直接迁移，不保留旧算法开关。
- [ ] `POST /api/slot/upgrade`：
  1. `slotUpgradeQuote(s,slot,legacy)`，有 `block` → `fail('SLOT',block)`；锻造未开放沿用 `storyFeatureUnlocked(s,'forge')` 的拦截文案。
  2. 扣金币、材料；`s.slotRanks[slot]++`；`s.build++`。
  3. 对该部位穿戴件跑 `catchUpAffixNodes(s,g,reinforceAffixNode)`，返回 `reached`。
- [ ] 旧路由 `/api/gear/:action` 的 `upgrade`：若装备当前穿着，转调上面的部位强化；没穿着 → `fail('SLOT','先穿上再强化：强化等级记在部位上')`。`/api/gear/:id/preview` 的 `upgraded` 预览改成「该部位 +1」的构筑。
- [ ] `equip`：穿上后对新件跑 `catchUpAffixNodes`（只升不降：从低品质换到高品质时补节点；换回低品质不会丢节点进度）。
- [ ] 批量分解保护（`packages/rules/salvage-batch.ts` 的 `g.rank>0`）改为「`g.affixNode` 有值」——有节点的件才算强化过；单件分解不变。改了这条要更新对应单测。
- [ ] 测试：PG 测试——部位 +3 后换一件同部位新装备，新装备主属性按 +3 生效且补到 1 个词缀节点；共鸣：6 部位全 +3 后 `GET /api/slots` 的 `resonance.tier===1`。

### Z3 宠物上阵
- [ ] **发放**：`settleHubNode` 首通分支里，`node.kind==='gate'` 时 `const id=gatePet(node.region); if(id) grantPet(s,id)`，并 `rewards.push('获得宠物：'+名字)`。探索度达到 100% 时（Z4 每次加分后检查一次）`grantPet(s,explorePet(region))`，同样写进奖励文案。
- [ ] **回填**：已经首通过风栖关口 / 雾铃关口的老角色，在读状态时补发（看 `h.chart.cleared['wind-gate']` 等）；补发只做一次（`grantPet` 本身幂等）。
- [ ] **经验**：`settleHubNode` 发角色经验的同一处，`grantPetXp(s,实发经验)`；升级列表写进结算回执的 `rewards`（「岚羽升到 10 级，成年了」这类，形态变化才写）。
- [ ] `GET/POST /api/pets`（§2）。改阵容 / 流派后 `s.build++`（规则函数已做的不重复）。
- [ ] 副本里：宠物技能是构筑里的一条 `interval` 效果规则（id 以 `pet-` 开头），`World` 已能跑，**不需要新实体**；你只需确认副本与野外的构筑都走 `resolveBuild`。
- [ ] 测试：PG 测试——首通风栖关口得到 `wind-free` 并自动上阵；跑一场副本后宠物经验增加；`resolveBuild(s).stats.rules` 含 `pet-wind-free`。

### Z4 航区探索度
- [ ] HubState 存 `explore`（`exploreStateSchema`）；`normalizeHubState` 补缺省 `{caches:[],doors:[],keys:[]}`。
- [ ] **钥匙**：`settleHubNode` 首通时 `const key=gateKey(node.id); if(key&&!keys.includes(key)) keys.push(key)`，文案「获得关口钥匙：铃钥」。老角色读状态时按已首通的关口回填。
- [ ] **下发格式（前端已按此实现）**：`hubPublicState` 返回的 `explore.props`（契约 `packages/contracts/hub-dungeons.ts` 的 `hubDungeonPublicSchema.explore`）：`{id,kind:'cache'|'door',x,y,state,key?,keyName?}`。秘藏 id `hub-cache-<节点 id>`，锁门 id `hub-door-<门 id>`；玩家交互发 `{kind:'interact',target:id}`，在 `dungeon-service.ts` 的 interact 分支按前缀分流（与 `hub-gather-`、`hub-pylon-` 同处），交互距离 2 格。
- [ ] **秘藏**：每个非关口节点副本生成时放一个 `hub-cache` 场景物件：
  - 候选格：可走格里，离主路线（剧情路线点 / 节点出入口连线）4–8 格的点；`pickCacheCell(nodeId,候选)` 取一个，保证同节点每次同位置。
  - 状态：已在 `explore.caches` 里 → `opened`；否则 `hidden`，玩家进入 5 格内（`hubExplore.cache.revealRadius`）给前端 `glint`。
  - 交互（复用宝箱 / 采集点的交互通道）：首次打开发 `hubExplore.cache.loot`（1 次 t1 掉落；按 `patternChance` 额外掉一张图纸），记 `cacheId(nodeId)`。之后再开只播空箱。
  - **全自动模式不绕路去开**（不改自动寻路目标）；半自动 / 手动玩家自己走过去。
- [ ] **锁门**：`hubExplore.regions[region].doors` 里的门放在对应节点副本：
  - 位置：主路线旁一个死胡同口；门后放一个小房间：2–3 只同航区普通怪 + 一个宝箱（`hubExplore.door.loot`）。
  - 没钥匙：门 `locked`，交互提示「需要 X（来自 Y 关口）」。有钥匙：交互开门（`opening` → `open`），记门 id。门已开过：进副本直接 `open`，房间宝箱不再出。
- [ ] 每次 `caches` / `doors` / `cleared` 变化后，重新 `regionExplore(h,region)`；达到 100% 发 `explorePet`（Z3）。
- [ ] **码头**：`hub-outside-service.ts` 的码头 `collect` / `quick` 收益乘 `1+dockExploreBonus(regionExplore(h,出航航区).percent)`。
- [ ] 航图视图带上 `nodeExploreFields` 与 `regionExplore`（§2）。
- [ ] 测试：PG 测试——开秘藏一次加分、二次不加；没钥匙门交互被拒；首通雾铃关口后风栖的门能开；风栖全满 100% 时得到 `wind-light`，码头收益 ×1.5。

### Z5 数值（一次推导 + 一次验证，不做探索性扫参）
- [ ] 在云测试服（照 B4 的方式）用 B4 推导脚本加三项输入，各推导一次、验证一次，结果写 `reviews/zhangjian-numbers-<日期>/summary.md`（只提交结论；原始明细留本地）：
  1. **弱点 ×1.25**：带弱点元素的构筑在对应航区的击杀时间应比不带的快 15–25%；不带弱点的构筑击杀时间仍在 B4 目标区间内（**弱点只能是加速，不能变成门槛**）。
  2. **共鸣 2%/档**：5 档满共鸣对总输出的提升 ≤ 12%。
  3. **宠物**：上阵宠物（零氪档，满级）对总输出占比 8–12%；重氪档 ≤ 12%（用户既定上限）；零:轻:重 ≈ 60:100:130。
- [ ] 不达标只改 `packages/content/{hub-elements,pets}.json` 和 `RESONANCE_PER_TIER`，改后重跑 `tests/zhangjian-rules.test.ts`（断言与数值相关的，按新值改并在决策日志写一行）。

### Z6 版本、部署、交测
- [ ] 版本：rules → `ow-93`，client → `0.11.52`，protocol → 54（本批改了契约）。
- [ ] 全量：`npx tsc --noEmit -p .`，相关单测，PG 测试逐个跑。
- [ ] 部署：等 Claude 在协作中心写「Z 前端已提交」后一起部署（`export PATH="/c/Windows/System32:$PATH"; node tools/deploy-staging.mjs`，只打包已提交 HEAD）。前端没好就先部署服务端（前端对 404 隐藏，对多出的字段忽略），不等。
- [ ] `curl https://43-165-179-11.sslip.io/api/health` 核对版本。
- [ ] `backend-z-progress.md` 末尾写一段给 Grok 的复测说明：版本号、四项新功能各一句、要重点体感的三处（风栖用雷电方案对比物理方案、首通风栖关口后的宠物、风栖秘藏和雾锁门）。

## 4. 默认裁决

| 编号 | 情况 | 处理 |
|---|---|---|
| D-Z1 | `applyLoadout` 里的装备已被分解 / 移到仓库 | 跳过该部位，文案进 `skipped`；不报错 |
| D-Z2 | 方案里的天赋点数超过当前可用点 | 天赋那项跳过（规则已处理），其余照切 |
| D-Z3 | 迁移时某部位背包和仓库都没装备 | 该部位等级 0 |
| D-Z4 | 节点地图找不到 4–8 格的候选格 | 放宽到 3–10 格；仍没有 → 该节点不放秘藏，`regionExplore` 的总分照算（决策日志记节点 id，Claude 后续调图） |
| D-Z5 | 节点地图找不到死胡同放锁门 | 放在主路线旁任一可走格，门后房间用传送（进门即传到同图的空旷区域） |
| D-Z6 | 宠物经验：角色已满级 | 宠物照常吃本场结算经验 |
| D-Z7 | 码头出航航区不是风栖 / 雾铃 | 加成 0（其余航区本批没有探索度） |
| D-Z8 | 秘藏图纸掉落池为空 | 只发 t1 掉落 |
| D-Z9 | Grok 正在测试时部署 | 照常部署，复测说明写清部署时刻 |
| D-Z10 | 规则函数与本文描述不一致 | 以规则函数 + 单测为准，决策日志记一行 |

## 5. 硬阻塞（只有这些可以停）

- 云测试服无法登录或部署脚本报错且 2 次重试无效；
- 数据库迁移会删除或改写已有角色的非本批字段；
- 规则层单测在你没改动的情况下失败（说明有人改了规则，需要 Claude 裁决）。

其余一律按默认裁决或「最接近 M17 精神」处理，并记决策日志。

## 6. 完成定义

- [ ] Z0–Z6 全部勾上，进度文件有提交号；
- [ ] 四个接口 + 航图字段上线，PG 测试覆盖 §3 列出的场景；
- [ ] 老角色迁移 / 回填（部位等级、关口宠物、钥匙）有测试；
- [ ] 数值结论文件已提交，三项都在目标区间；
- [ ] 云测试服版本 `ow-93 / 0.11.52`，Grok 复测说明已写；
- [ ] 协作中心 `HUB-Z` 改「待验收」。
