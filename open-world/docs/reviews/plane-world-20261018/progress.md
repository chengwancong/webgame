# 箱庭位面落地进度（Claude）

设计：`docs/plane-world-design.md`（F1–F9 / B1–B7），巢穴玩法：`docs/nest-dungeon-design.md` §4–§8。
美术：GPT 按 `docs/plane-art-handoff-20261018.md` 并行制作。落地层只按它 §3 的资源 ID 取用；A1 发布占位登记表之前，先用本岛现有资源顶上。
约束：AGENTS.md；同一时间只跑一个重任务；不跑无头浏览器，可视验收用应用内浏览器；不碰 8612 / 8790 写入口。
默认值 P1–P4（营地减 40%、事件全部改成位面、样张先用 A、秘室不能重复刷）等用户确认，确认前按默认值执行。

## 批次

| 批 | 内容 | 状态 |
|---|---|---|
| L0 | 基线：已有未提交改动整体提交（`6089966`）；tsc 0 错、validate-content 通过、config check 一致；全量 vitest（临时库）见记录 | 完成 |
| L1 | F1 / F8：`planeGates` 表（地城入口不迁移，见设计 F1 落地调整）、入口状态、三种发现方式、进入校验、角色 `planes` 进度 | 完成 |
| L2 | F2 / F4：段图、三种连接、物件、出口传送门、`returnTo`、checkpoint 恢复 | 待开始 |
| L3 | F3：surge / defend / waves / horde / lair / vault 模块化，巢穴回响 | 待开始 |
| L4 | F5 / F7：世界事实回写、野外反馈、营地替换、事件 → 裂隙迁移、任务引用 | 待开始 |
| L5 | F6 + 客户端表现：入口六态、发现、小地图、确认卡、HUD、远景剪影、传送门演出 | 待开始 |
| L6 | 内容铺量：96 个门的选点，按 B6.4 生成场地，命名，残片，世界反馈 | 待开始 |
| L7 | 数值：一次推导 + 一次验证（`pnpm spine:check`） | 待开始 |
| L8 | 全量自测；全自动跑完 6 岛 × 5 类；应用内浏览器可视验收；接入 GPT 美术正式图 | 待开始 |

## 记录
- 2026-10-18：设计层定稿；美术交接已写；工作区有约 1259 项此前未提交的改动（progression-goal、numeric-spine 等），L0 需要先处理。
- 2026-10-18 L0：基线提交 `6089966`（4339 个文件，已排除依赖/产物/原始评审数据）。`node tools/vitest-tempdb.mjs` 全量：文件 240 通过 / 33 失败（共 273），用例 1808 通过 / 25 失败 / 57 跳过。这些失败在基线就已存在，不是本工作引入的。已看到的失败：earned-all-quests、world-loot-cadence、world-natural-calendar、energy-wording、equipment-runtime（含 database）、starsea-events、story-gates-ui、tasks、vfx-v2、world-dressing、world-island-quest-config、world-phase-config×2、world-production。其余失败文件被输出截断，没看到名字。之后各批以「不新增失败」为准。
- 2026-10-18 L1：契约 `worldSchemas.planeGates` / `planeGateViewSchema` / `planeProgressSchema`（`world.planes`）；规则 `packages/rules/plane-gates.ts`；靠近发现接在 `/api/field/camps`（只认可信移动，返回 `discovered`）；交互发现 `POST /api/plane/interact`（只用服务端 3 秒内的观察位置）；构建期几何校验；`世界.xlsx` 新增「位面门」页签，风栖 3 个巢穴种子入口；选点工具 `tools/plane-gate-sites.ts`。测试：`tests/plane-gates.test.ts` 7、`tests/world-tables.test.ts` 新增 1、`tests/plane-gates.database.test.ts` 2（真实 PG），全部通过。全量回归 1828 通过 / 26 失败：其中 6 个文件级失败是并行 DB 测试争用副本运行锁（`Another dungeon runtime already owns this database`），串行重跑 8 个文件 43 项全过；其余失败落在 L1 没碰的模块（音频、spine 金样、文案词表、装备等），和基线一致。
- 下一步 L2：位面实例 = 单人、多 stage 的副本定义。已清段时走进 stage 的 `portal` 点自动切下一段（不弹面板）；最终首领死后先开出口（`plane_exit_open`），走进出口才结算；回到 gate 的 returnX/returnY，并调用 `recordPlaneClear`。入口在 `DungeonService.checkEnd` / `nextStage` / `finish`。
