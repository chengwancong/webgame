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
| L2 | F2 / F4：段图、三种连接、物件、出口传送门、`returnTo`、checkpoint 恢复 | 完成（服务端流程；传送门演出与自动寻门归 L5） |
| L3 | F3：surge / defend / waves / horde / lair / vault 模块化，巢穴回响 | 待开始 |
| L4 | F5 / F7：世界事实回写、野外反馈、营地替换、事件 → 裂隙迁移、任务引用 | 待开始 |
| L5 | F6 + 客户端表现：入口六态、发现、小地图、确认卡、HUD、远景剪影、传送门演出 | 待开始 |
| L6 | 内容铺量：96 个门的选点，按 B6.4 生成场地，命名，残片，世界反馈 | 待开始 |
| L7 | 数值：一次推导 + 一次验证（`pnpm spine:check`） | 待开始 |
| L8 | 全量自测；全自动跑完 6 岛 × 5 类；应用内浏览器可视验收；接入 GPT 美术正式图 | 待开始 |

## 记录
- 2026-10-18 装饰物重画已完成：19/19（cave 7 / crypt 7 / maze 5），包含 14 件摆件、3 件挂墙灯、2 件方柱。全部使用内置 image_gen，最终原图、逐件提示词和裁切记录在 `assets/open-world/plane-kits/source/props-contract/`；最终提示词集见 `assets/open-world/plane-kits/props-contract-spec.mjs`。石棺与迷宫圆石首版不合格的背景光雾已重新出图去除；挂灯按灯体中心配准。新原图与实机 PNG 仅留本地，已确认 gitignore 生效，没有提交。
- 本轮正式登记：`packages/asset-manifest/open-world-planes.v1.json` 同 ID 写入 `runtime.file`；19 项的 canvas、anchor、displayWidth 从灰盒 contract 复制，包含灯 `[0.5,0.46875]` 与 crypt 柱 `[0.5,0.8076923076923077]` 的完整精度。小件实际可见高 27–40px，大件 55–71px；全部单格摆件可见宽不超过 60px，四边 ≥2px 透明边。岩台件无底座。
- 本轮接入仅在 `packages/asset-manifest/open-world-assets.ts` 按同 ID 与精确契约读取新文件：19 件替换，18 个其他灰盒件不动。场景布局 JSON、场地生成 TS、渲染器 TS、灰盒构建脚本的前后 SHA256 一致；碰撞、挡路、岩台和淡出规则不改。
- 本轮实机复核：按用户指定的三个 `plane-wind-nest-<kit>-1&calm=1` 页面查看并截图，均无 console error。截图在本目录 `cave-props-final.png`、`crypt-props-final.png`、`maze-props-final.png`（1280×725，含 1280×720 游戏画布）；完整 19 件按实际显示尺寸汇总在 `props-final-contact.png`。截图为出生点视野，未把视野外的件伪称为全部同屏；全部文件和尺寸另经专项检查。
- 本轮校验：`node tools/verify-plane-prop-art.mjs` 19/19 通过（尺寸、完整 contract、透明边、状态帧、文件哈希）；`npx tsx tools/verify-plane-prop-runtime.ts` 通过（19 替换、18 保留）；`npx vitest run tests/plane-scenes.test.ts` 5/5 通过；应用/资源类型检查 `npx tsc --noEmit --pretty false -p .qa/plane-props-tsconfig.json` 通过。全仓 `npx tsc --noEmit --pretty false` 在未修改的 `tests/plane-gates.database.test.ts:28` 报 TS2339（worldView）和 TS7006（g）；未修改玩法或测试来绕过。
- 原包检查 `node tools/verify-plane-kit-art.mjs --allow-pending`：契约通过、0 错误；原 278 项总包仍有 210 条范围外占位/接缝缺口，不等同于本轮 19 件的交付缺口。本轮只替换指定装饰物。
- 本轮复现：在 open-world 执行 `node tools/build-plane-prop-art.mjs` → `node tools/verify-plane-prop-art.mjs` → `npx tsx tools/verify-plane-prop-runtime.ts`。总美术构建 `tools/build-plane-kit-art.mjs` 已接入专用导入步骤，避免重建退回 528×528 或通用底对齐。需要本机保留的 PNG 原图；本轮无待完成项。
- 2026-10-18：设计层定稿；美术交接已写；工作区有约 1259 项此前未提交的改动（progression-goal、numeric-spine 等），L0 需要先处理。
- 2026-10-18 L0：基线提交 `6089966`（4339 个文件，已排除依赖/产物/原始评审数据）。`node tools/vitest-tempdb.mjs` 全量：文件 240 通过 / 33 失败（共 273），用例 1808 通过 / 25 失败 / 57 跳过。这些失败在基线就已存在，不是本工作引入的。已看到的失败：earned-all-quests、world-loot-cadence、world-natural-calendar、energy-wording、equipment-runtime（含 database）、starsea-events、story-gates-ui、tasks、vfx-v2、world-dressing、world-island-quest-config、world-phase-config×2、world-production。其余失败文件被输出截断，没看到名字。之后各批以「不新增失败」为准。
- 2026-10-18 L1：契约 `worldSchemas.planeGates` / `planeGateViewSchema` / `planeProgressSchema`（`world.planes`）；规则 `packages/rules/plane-gates.ts`；靠近发现接在 `/api/field/camps`（只认可信移动，返回 `discovered`）；交互发现 `POST /api/plane/interact`（只用服务端 3 秒内的观察位置）；构建期几何校验；`世界.xlsx` 新增「位面门」页签，风栖 3 个巢穴种子入口；选点工具 `tools/plane-gate-sites.ts`。测试：`tests/plane-gates.test.ts` 7、`tests/world-tables.test.ts` 新增 1、`tests/plane-gates.database.test.ts` 2（真实 PG），全部通过。全量回归 1828 通过 / 26 失败：其中 6 个文件级失败是并行 DB 测试争用副本运行锁（`Another dungeon runtime already owns this database`），串行重跑 8 个文件 43 项全过；其余失败落在 L1 没碰的模块（音频、spine 金样、文案词表、装备等），和基线一致。
- 下一步 L2：位面实例 = 单人、多 stage 的副本定义。已清段时走进 stage 的 `portal` 点自动切下一段（不弹面板）；最终首领死后先开出口（`plane_exit_open`），走进出口才结算；回到 gate 的 returnX/returnY，并调用 `recordPlaneClear`。入口在 `DungeonService.checkEnd` / `nextStage` / `finish`。
- 2026-10-19 L2 位面实例流程（服务端 + 最小客户端接线）：
  - 内容：`dungeons.json` 新 profile `plane`（`passageRadius 1.5 / exitRadius 1.2`），挂到风栖 cave / crypt / maze 三个位面；`dungeon-content` 校验位面必须是单人 realtime。契约 `policy.plane`、命令 `gate` / `permit_id`、视图 `plane{gate,portal,passageOpen,exitOpen,returnTo}`、角色 `dungeon.returnTo`；战斗事件新增 `plane_passage_open` / `plane_exit_open`（专用类型，不借用 effect_triggered）。
  - 进入：位面只能从野外门开，服务端读 permit 里 3 秒内的可信观察位置（`PLANE_OBSERVER_MS`，与 `/api/plane/interact` 共用），再走 `assertPlaneGateEnterable`；目录直开、门和位面不匹配、观察位置过期或过远都拒绝，不扣任何东西。开局把门 ID 和回落点冻结进 `SavedRun.plane`。
  - 段间：清段后不弹面板，`next` 命令对位面返回 `PLANE_PASSAGE`；英雄走进本段 `portal` 半径内自动切下一段。终段首领死后先开出口（`exitOpen` 存档），走进出口才 `finish`；结算回执里调用 `recordPlaneClear`，`lastRegion` / `starsea.location` 落到门的 returnX/returnY，`dungeon.returnTo` 给客户端落点。
  - 防误触：传送门刚开时站在门上不算进入，需先离开门再走进（`plane.armed`），避免捡东西时被瞬间带走。
  - 段图：`plane-layouts` 的 portal 从出生点旁挪到段落深处（cave 末厅、crypt 第 5 室、maze 深处格、boss 首领厅内且距首领 ≥3）；12 个种子实测出生点→门路径 cave 128–158、crypt 84–100、maze 214–451、boss 层 31–43。
  - 客户端：门交互把 gate/permit 带进 create；位面检查点隐藏「准备 / 进入下一层」，场景目标指向通道/出口；结算后回到门旁落点。
  - 测试：新增 `tests/plane-instance.test.ts` 2 项、`tests/plane-instance.database.test.ts` 1 项（真实 PG：门禁拒绝 4 种、走进通道、出口开启不结算、清段检查点与出口开启后两次服务重启不重生不回血、走出口只结算一次、回门旁、门 clears=1）。`authored-dungeon-entry.database` 改为跳过位面（它们只能从门进，由上面的测试覆盖）。串行回归 plane-gates(.database)、dungeon-instance.database、field-dungeon-facts.database、authored-dungeon-entry.database、plane-layouts、plane-scenes、dungeon-content 全过；同批跑时出现两次已知的副本运行锁争用，单独重跑通过。全仓 tsc 0 错。
  - 常驻后端：本轮检查时 8790 没有在跑，无需确认热重载；未调用任何写接口，未碰 8612。
  - 留给 L5：自动模式不会自己走进传送门（`go` 会把 auto 切成 semi）；传送门美术与开启演出；副本目录里仍列出位面（直开会被 `PLANE_GATE` 拒绝），应在目录隐藏或改成「从野外入口进入」提示。
- 2026-10-18 晚：开始铺量的前置工作（Claude 做）：
  - 场景改成按岛取图：`PlaneMap.island`；`planeResource(kit,part,island)` 让 5 个底图件和 2 个特色件按岛取 ID。
  - 灰盒登记扩到 163 项：岛屿条目带 `aliasOf`，没画时回退套件件并叠本岛 material。
  - 两个特色件加入挡路件池；渲染器把 material 烘进纹理；复核页加了 `&island=`。
  - maze 柱子保持 80 高（`pillarHeight`），已接入的柱图不受墙高改动影响。
  - 测试：plane-scenes 6、plane-layouts 4 通过；check-world-resource-wiring 通过。在应用内浏览器看过 frost 地宫和 forge 洞穴，无报错。
  - GPT 铺量交接见 `docs/plane-art-handoff-20261018.md` §9（R1–R6）。
