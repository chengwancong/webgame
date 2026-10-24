# 战棋第 1 批交接：战斗核心（回合机 + 意图 + 敌人 AI + 托管 + 沙盒）

> 2026-10-24 Claude（主策划）写给 Codex/GPT。
> - **设计依据**：`../planning-bd-v1/16-claude-enemy-ai-combat-intensity.md`（下称 16 号）。规则口径另见 08 §6–7、09 §2–5、13 号技能候选表。
> - **设计已定，照做**。有默认裁决的直接按默认做，记进决策日志，不回来问。
> - **本批目标**：做出一个**可以打的战棋灰盒**，证明"每回合有真实取舍"。这是后续规模化重构（养成回收、价值分配、解锁节奏，即第 2–4 批）的前提。
> - **本批不接正式副本、不发奖、不读写角色存档**，只做纯规则、内容字段、沙盒接口和托管基线测量。用户已同意第 2 批起不考虑旧存档。本批战棋相关的契约可以随意改，不需要兼容。
> - **前端由 Claude 并行做**：把 `apps/web/tactical-board.html` 接到 §2 的沙盒接口。你不碰 `apps/web`。

---

## 0. 执行方式（强制）

1. **一次连续做完 T0 → T9**，批次之间不停、不等确认、不回来问。允许的结束状态只有两种：
   - **全部完成**：§6 完成定义全部勾上；
   - **硬阻塞**：已做完所有不受影响的部分，只剩 §5 列出的硬阻塞。
2. **进度文件**：同目录 `tactical-b1-progress.md`（已建好模板，你持续更新）。每完成一项勾一项，写提交号和一句验证结论。中断后从第一个未勾项接着做。
3. **决策日志**：同目录 `tactical-b1-decisions.md`（你创建），每条一行：问题｜处理｜依据条目。
4. **协作中心**：`G:\webgame\abyss-walker-migration\协作中心\游戏协作.md`。
   - 超过 40,000 字符先归档到 `协作历史\`；
   - 任务队列加一行 `TAC-B1 | P1 | 进行中 | Codex | 战棋第1批 战斗核心`，每完成一批更新一次；
   - 只用 `更新游戏协作.ps1` 更新。
5. **本机只跑 tsc、单测、PG 测试**：
   - 数据库测试一次一个，用 `node tools/vitest-tempdb.mjs`；
   - **重任务一次只跑一个**；
   - 不跑无头浏览器和浏览器自动化（本机常驻 MU）；
   - 真机体感交给云测试服 + Grok。
6. **云测试服**：口令只在 `G:\webgame\aw-deploy\staging-credentials.txt`。不要把口令写进报告、截图、公开链接或日志；不要清库，也不要改正式角色数据。
7. **提交**：不碰 `apps/web`；不提交图片、原始测量明细或构建产物（留档只提交结论，单文件 ≤200KB 且 ≤2000 行）。

**禁止**：
- 只写文档不写代码；
- 把沙盒写成"正式战斗已接通"；
- 跳过测试，或为过测试改断言、降标准；
- 敌人 AI 或托管读取隐藏信息或未来随机；
- 在规则层之外复制一份规则逻辑（API 只调用规则函数）；
- 反复扫参（灰盒数值只允许 T8 调整一次，见 §3）。

---

## 1. 已就绪的东西（直接用）

| 文件 | 内容 |
|---|---|
| `packages/simulation/tactical/board.ts` | 方格八邻接寻路、斜走不穿角、`TacticalActionBudget`（`moveUsed` / `mainActionUsed`）、`commitTacticalMove` |
| `packages/simulation/tactical/control.ts` | 手动 60 秒窗口、最后 10 秒提示、超时转托管、显式接管的纯规则（08 §7.3） |
| `packages/simulation/tactical/support.ts` | 宠物辅助按根动作去重、每回合配额 |
| `tests/tactical-{foundation,control,ui}.test.ts` | 现有原型测试，必须保持通过 |
| `../planning-bd-v1/13-tactical-skill-migration.json` | `candidateSkills`：cut、staff_strike、throwing_knife、whirl、ward、mend、fan_of_knives、chain、staff_sweep、venom_needle 的形状、射程、冷却候选 |
| `packages/content/monsters.json` | 103 个模板，`kind` 共 8 种：melee、ranged、charger、shaman、guard、assassin、summoner、artillery；`role` 含 swarm |
| `packages/content/elite-affixes.json` | 6 条：迅捷、护盾、冰冻新星、火焰足迹、召唤小怪、传送 |
| `apps/web/tactical-board.html` | Claude 的前端 fixture 页，本批由 Claude 接入沙盒接口 |

---

## 2. 沙盒接口（前端照此对接）

**仅开发环境与云测试服开放**（环境开关 `TACTICAL_SANDBOX=1`），正式环境返回 404。

- 不读写 `CharacterState`，不发奖；
- 遭遇状态放内存或独立临时表，进程重启丢失可以接受；
- 写接口沿用现有 `command_id` 幂等 + `revision` 模式。

| 接口 | 请求 | 返回 | 说明 |
|---|---|---|---|
| `GET /api/tactical/sandbox/catalog` | — | 可选棋盘、测试英雄（剑 / 暗器）、编排开关选项 | 读 T6 内容 |
| `POST /api/tactical/sandbox` | `{boardId, heroId, seed?, orchestration?}` | `TacticalProjection` | 创建遭遇；`seed` 缺省时由服务端生成并回传 |
| `GET /api/tactical/sandbox/:id` | — | `TacticalProjection` | 公开投影（§T1） |
| `POST /api/tactical/sandbox/:id/act` | `{command_id, revision, action}` | `{revision, events, projection}` | `action` 为 move / skill / basic / end / set-control-mode；托管模式下服务端自动走完主角回合 |
| `GET /api/tactical/sandbox/:id/preview` | `?move=x,y&skill=id&target=x,y` | 预计结果：击杀、伤害、执行敌方意图后的预计剩余生命 | **不改状态、不推进随机** |

---

## 3. 批次

### T0 准备
- [ ] 读 16 号全文、08 §6–7、09 §2–5、本交接。
- [ ] 跑 `npx tsc --noEmit -p .` 和 `npx vitest run tests/tactical-*.test.ts`，确认基线是绿的。基线失败的项目记进决策日志后继续，不要去修与本批无关的失败。
- [ ] 建决策日志，在协作中心加任务行。

### T1 契约 `packages/contracts/tactical.ts`
- [ ] zod schema：
  - `TacticalUnit`：id、side、kind、cell、hp/maxHp、shield、statuses、cooldowns、elite 词缀；
  - `TacticalIntent`：`type: grid | chase | lock | buff | summon | charge-windup | move-only`，以及受击格/目标/直线、预计伤害或档位、执行序号、`fizzled?`；
  - `TacticalAction`；
  - `TacticalEvent`：带 `battleId / round / ownerTurnId / actionId / resolutionId / sourceId / cause`（09 §2）；
  - `TacticalProjection`：棋盘、单位、本轮全部意图、主角可达格、主角额度、技能可用性、控制模式、胜负。
- [ ] 投影只含公开信息。刺客首回合的意图为 `type:'move-only'` 并带 `hidden:true`，前端显示"?"。

### T2 回合机 `packages/simulation/tactical/encounter.ts`
- [ ] 轮次严格按 16 号 E-1：
  ```
  ① 敌方公布意图 → ② 主角行动（移动一次 + 主行动一次，顺序自选，复用 board.ts 的额度）
  → ③ 敌方按执行序号执行意图 → ④ 回合末结算（DOT、区域、到期） → 下一轮
  ```
- [ ] 胜负：敌方全灭 = 胜；主角生命归零 = 败。
- [ ] 确定性随机：用种子派生，只用于玩家暴击（敌人不暴击，E-3）。同种子、同动作序列，结果逐字节相同。
- [ ] 开战先手：默认玩家先行动（敌方先公布意图）。`ambush:'player'` 时敌方首轮只移动、不公布攻击；`ambush:'enemy'` 时敌方先执行一次移动再进入 ①。
- [ ] 视线：Bresenham 直线，穿过阻挡格即断；单位不挡视线，但锁定型攻击命中直线上的第一个单位（16 号 §3）。

### T3 技能战棋语义 `packages/simulation/tactical/skills.ts`
- [ ] 两名测试英雄、各 4 个技能，数值读 T6 的 `tactical-graybox.json`，**不读正式技能系数**：

| 英雄 | 技能 | 形状 / 规则 |
|---|---|---|
| 剑 | cut | 普攻，相邻单体 |
| 剑 | whirl | 自身周围 8 格，每目标伤害，冷却 2 |
| 剑 | ward | 自身护盾，持续到主角下次回合开始（09 §3.1），冷却 3 |
| 剑 | vortex_blade | 把 2 格内的敌人拉到相邻空格（由近到远，没有空格的不拉），再造成小额伤害，冷却 3 |
| 暗器 | throwing_knife | 普攻，直线 4 格，命中第一个单位，需要视线 |
| 暗器 | fan_of_knives | 正前方 3 条射线（正向 + 两斜向），各 3 格，每条命中第一个，冷却 2 |
| 暗器 | venom_needle | 直线 4 格穿透，命中者中毒（在目标回合末各结算 1 次，共 2 次），冷却 2 |
| 暗器 | toxic_bomb | 射程 4 的 3×3 毒区，持续 2 轮，单位在回合末处于区内时受伤，冷却 3 |

- [ ] 冷却按主角个人回合计数（09 §3.1）。
- [ ] **控制使意图落空**（16 号 E-2）：
  - 被拉/推出攻击范围的追击型敌人，若执行时够不着，就只移动；
  - 断视线的锁定型标记 `fizzled`；
  - 本批的控制来源只有 vortex_blade 的拉拽。

### T4 意图与敌人 AI `packages/simulation/tactical/enemy-ai.ts`
- [ ] 8 类原型规则**逐条照 16 号 §5.2 实现**，原型对应 `monsters.json` 的 kind，swarm 走"小怪"规则。逐条匹配，第一条成立就执行；平分按稳定 ID 打破。
- [ ] **意图公布后不变**（E-2），执行时只按落空规则处理。
- [ ] **普通遭遇防必死降级**（16 号 §5.1）：同一轮意图伤害合计 ≥ 主角当前生命 + 护盾时，从执行序号最后的敌人开始降级为 `move-only`。精英和首领遭遇不降级。降级要写进事件 `cause:'lethal-guard'`。
- [ ] 精英词缀 6 条按 16 号 §5.3 实现。
- [ ] 风栖首领 1 个，规则如下：
  - 两阶段，生命 50% 切换；
  - 大招预告两回合：第 1 回合标格 + "致命"档，第 2 回合执行；
  - 大招后力竭 1 回合（受伤 +50%）；
  - 第二阶段每回合在大招之外召 1 只小怪，场上最多 2 只。
- [ ] 单测：每类原型至少 2 条，覆盖规则命中和落空；降级 1 条；首领阶段 + 预告 + 力竭 1 条。

### T5 托管 `packages/simulation/tactical/autopilot.ts`
- [ ] 枚举"移动（含不动）× 主行动（含普攻、不出手）× 两种先后顺序"的合法组合。对每个组合，用 T2 的同一套规则模拟到本轮敌方意图执行完（**只用已公布的意图**），打分：
  ```
  分数 = 击杀数 × W1 − 预计受伤 × W2 + 技能优先级加分 + 开关加权
  ```
- [ ] 编排（15 号 §3.1）：
  - `priority`：技能 ID 数组；
  - 最多 3 个开关，选项固定：
    - `target`：nearest / lowest-hp / support-first；
    - `position`：stay-close / keep-distance / behind-cover；
    - `guard`：低于 50% 生命先用防护（on/off）。
- [ ] 托管与手动走同一个 `act` 规则函数，不加任何属性。没有合法技能时普攻；普攻也不行就结束行动，不能死循环。
- [ ] 单测：同一局面同一编排必出同一选择；`support-first` 时优先打祭司。

### T6 内容
- [ ] `packages/content/tactical-archetypes.json`：按 kind 记录移动力、意图类型、射程、威胁点、血量档，取值见 16 号 §4 和 §6.3。
- [ ] `packages/content/tactical-graybox.json`：§4 的灰盒数值。
- [ ] `packages/content/tactical-boards.json`：风栖 5 张棋盘：
  - 普通 ×3：分别以刀兵、铳手、小怪群为主；
  - 精英 ×1：带 1 个精英词缀；
  - 首领 ×1。

  每张棋盘约 8×8 到 10×10，含阻挡格、主角出生格和敌人出生格。威胁点须在预算内：普通 6–9、精英 10–14。每个普通棋盘至少有一组可被一次群伤（whirl / fan_of_knives）覆盖的初始站位（16 号 §6.6）。
- [ ] 内容校验：所有出生格可达；威胁点在预算内；kind 都有原型。接入现有 `pnpm` 内容校验命令。

### T7 沙盒接口
- [ ] 按 §2 实现。API 层只做参数校验、幂等、存取，规则全部调用 `simulation/tactical`。
- [ ] 手动超时接 `control.ts`：60 秒到期转托管，本场持续托管直到显式接管（08 §7.3）。
- [ ] 测试：HTTP 层 1 组，覆盖创建 → 移动 → 技能 → 结束 → 敌方执行 → 胜负；重放同一 `command_id` 返回同一结果；`revision` 过期被拒；预览不改状态。

### T8 托管基线测量（一次推导、一次验证）
- [ ] `tools/tactical-baseline.mjs`（CLI，不开浏览器）：每张棋盘 × 两名英雄 × 默认编排 × 10 个固定种子，记录：
  - 胜率；
  - 遭遇回合数 ER；
  - 损血率 HL；
  - 落空意图数、降级次数；
  - 平均每回合合法组合数，作为"选择空间"的粗指标。
- [ ] 与 16 号 §6.3 的起始目标对照：普通 ER 2–3、HL 10–25%；精英 ER 4–6、HL 25–45%；首领 ER 8–12。
- [ ] **只允许调整一次**：偏离时按 16 号 §6.1–6.2 的口径（敌人血量按击杀行动数分档、伤害按威胁回合）推导一次新灰盒值，再跑一次验证，如实报告残差。不第三次调参。
- [ ] 结论写 `docs/reviews/tactical-b1-20261024/summary.md`，只提交汇总，原始明细留本地。

### T9 收尾
- [ ] 主 tsc、全部 tactical 单测、新增 HTTP 测试通过。
- [ ] 版本：本批新增 API 和契约，按 AGENTS.md 的版本规则更新 protocol / ruleset。
- [ ] 云测试服部署，开启 `TACTICAL_SANDBOX=1`；health/content 版本与客户端一致。
- [ ] 在进度文件写给 Grok 的测试说明，交由用户转交：
  - 沙盒入口在哪；
  - 要测 5 张棋盘的什么：意图是否看得懂、每回合是否有两个以上合理选择、托管是否能赢普通战。
- [ ] 协作中心任务行改为完成。

---

## 4. 默认裁决（直接按此做）

| # | 问题 | 默认 |
|---|---|---|
| D1 | 行动顺序 | 16 号 E-1 意图制阵营交替 |
| D2 | 主角移动力 | 4 格 |
| D3 | 敌人移动力 | 刀兵 3、铳手 2、冲锋兽 2 + 冲锋直线到底、祭司 2、盾卫 2、炮手 1、刺客 4（可跳过单位）、召唤师 2、小怪 3 |
| D4 | 灰盒基准 | 主角生命 100；**标准单体一击 = 10**；小怪 5、轻 10、中 20、重 30、精英为所属档 ×2、首领 130 |
| D5 | 主角技能灰盒值 | cut 10；throwing_knife 10（远程普攻与近战同为标准一击，代价是需要视线）；whirl 每目标 6；ward 护盾 25；vortex_blade 5；fan_of_knives 每条 6；venom_needle 7 + 毒 3×2；toxic_bomb 每回合 4；主角暴击率 10%、暴击 ×1.5 |
| D6 | 敌人灰盒伤害 | 刀兵 8；铳手 7；冲锋兽 18；炮手 12（3×3，预告 1 回合）；祭司治疗 10 / 加盾 8；盾卫 6 + 相邻友方正面减伤 50%；刺客 10（背后 ×1.5）；召唤师诅咒：下次受伤 +25%；小怪 4；首领普攻 10、大招 45 |
| D7 | 连战 | 本批每张棋盘独立满血开局；"跨遭遇保留 + 胜后回 30%"留到正式接入批 |
| D8 | 正面 / 背后 | 以攻击者相对目标的方向判断：盾卫"正面"为它与主角之间的 3 个方向；刺客"背后"为主角上次移动方向的反侧 |
| D9 | 借机攻击 | 主角从盾卫的相邻格移动到非相邻格时，盾卫立即攻击一次（6）；每回合每个盾卫最多一次 |
| D10 | 冲锋撞墙 | 冲锋兽撞墙或棋盘边缘时自身眩晕 1 回合（下轮意图为 `move-only` 且不移动）；撞到单位则对其造成伤害并停在其前一格 |
| D11 | 召唤物 | 下一轮才行动（09 §4）；没有空格就不召唤 |
| D12 | 沙盒存储 | 内存，并设 1 小时过期；进程重启丢失可以接受 |
| D13 | 规则未覆盖的边角 | 选更有利于玩家且更容易读懂的处理，记进决策日志 |

---

## 5. 硬阻塞（只有这些可以停下）

1. 用户书面推翻 16 号 E-1 或 E-2（行动顺序 / 意图三型）。此时停在 T2，其余可做部分照做。
2. 云测试服不可用或部署失败两次。T9 部署项标阻塞，其余全部完成。
3. 基线 tsc 失败且阻止编译新文件。先记录；能隔离就隔离继续，不能隔离才算阻塞。

其余一律按 §4 或"更有利于玩家、更容易读懂"自行裁决，记进日志，不回来问。

---

## 6. 完成定义

- [ ] T0–T9 全部勾上，每项有提交号和验证结论。
- [ ] 5 张风栖棋盘都能通过沙盒接口从开局打到胜或负，手动和托管都可以。
- [ ] 同种子、同动作序列结果一致（单测证明）。
- [ ] 8 类原型 + 6 条精英词缀 + 首领规则都有单测。
- [ ] 托管基线报告：两轮数据（调整前 / 调整后）与残差。
- [ ] 云测试服沙盒可用，Grok 测试说明已写。
- [ ] 没有改动 `apps/web`、正式副本执行、奖励和角色存档。
