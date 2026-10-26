# 界面方向 A「明亮卡牌」U0 补完 + U4–U6 交接（Claude → GPT，2026-10-24）

设计依据：`../planning-bd-v1/22-ui-direction-a-plan.md`（六条视觉规则、逐屏批次表、不做清单）。本文只写**已落地的现状、可复用件、每批具体要求和验收**。

已完成并提交：U0 组件层 + U1 结算 `0332065a`、U2 背包 `d80d7503`、U3 主城枢纽 `0ea3eaf4`。用户已逐批确认手感。

## 一、已落地、必须复用的公共件（不另建平行皮肤）

| 件 | 位置 | 用法 |
|---|---|---|
| Token | `packages/ui-tokens/tokens.json` → `node tools/build-ui-tokens.mjs`（`--check` 校验）→ `apps/web/src/ui/tokens.css/.ts` | 新颜色/厚度/时长一律先加 Token；CSS 里不写十六进制字面量 |
| 层叠顺序 | `@layer tokens, legacy, components` | 旧 CSS 在 legacy；改不动时先查计算样式，别靠 `!important` |
| 厚按钮 / 胶囊页签 | `ui/controls.css` | `buttonHtml(..., {variant:'primary'|'secondary'|'tertiary'|'danger', size:'compact'})`；**每屏只一个 primary**，其余用 secondary/tertiary |
| 品质格 | `ui/item-slots.css` | `.quality-*` 上提供 `--qr`（描边）`--qrs`（深色，可做文字底）`--qg`（光晕）；E7 框 `/art/hub-ui/ui-ornaments.png` 用 `::after` 叠框，传说 `::before` 流光 |
| 仪式 | `ui/ceremony.css` | 缎带标题、放射光、星形粒子、逐张翻入（`--motion-reveal`、`--motion-reveal-stagger`）；**只给大时刻用** |
| 主角卡 / 图标卡行 | `hub/hub-entry.css` 的 `.hub-hero-card*`、`.hub-card-row*` | 结构见 `hub/today-panel.ts`、`hub/slot-upgrade-panel.ts`；U4 面板顶部主角卡、列表行直接用这两套类 |
| 资源胶囊 | `ui/currency.ts` `resourceAmountHtml(kind, value, {pill:true, compact:true})` | 数字是主角时用 pill |
| 宠物头像 | `hub/pet-portrait.ts` | `petPortraitHtml(runtime)` 输出占位，插入 DOM 后调 `hydratePetPortraits(root)`；需要宠物图的地方复用 |
| 静态验收页 | `apps/web/ui-direction-a-qa.html`、`hub-review.html`、`bag-board-qa.html` | 新批次在这类页面加样例与切换按钮（见第四节） |

## 二、默认裁决（直接采用，不回来问）

- 信息结构和交互流程不改，只改表现；确实需要改结构的，记进进度文件「待 Claude」，本批跳过该处继续。
- 缺正式图标/插画时用现有图标库 `ui/icons.ts` 或剪影占位，并登记到 `../art-backlog.md`；不下载新素材。
- 美术 A34–A38（`art-hg-game-feel.md`）到了就只换资源登记/URL，不改逻辑；没到就保持 CSS 占位，不等。
- 高度：所有面板在 1280×720 舞台内不超高；超了先压内边距/改横排，再考虑内部滚动区（`min-height:0;overflow-y:auto`），不缩字号到正文以下。
- 不碰：地面掉落（无框）、技能栏"安静"原则（不闪、不染色、冷却只有细金环）、右下 A1 菜单与小地图布局、装备 Tips 竖版单列、战棋棋盘本体。
- 动效：遵守 `prefers-reduced-motion` 和 `[data-motion-reduced=true]`，两处都要取消。
- 规则没覆盖的边角：选更简单、对玩家更直观的处理，写进进度文件（问题｜处理｜依据）。

## 三、批次

### U0 补完：`ui/primitives.ts` 三个基础件（潮印 R3 已落地，现在可以加）

- `resourcePillHtml(kind, value, delta?)`：内部复用 `resourceAmountHtml(..., {pill:true})`，`delta` 正数绿 ▲、负数红 ▼。
- `ribbonTitleHtml(text, {stars?, grade?, tone?:'victory'|'retreat'|'unlock'})`：输出与 `ceremony.css` 现有缎带一致的结构；`grade` 用 `hub-fun/grade-s/a/b.png`。
- `rewardRevealHtml(items)`：物品格（沿用 `.quality-*` 品质格）+ NEW / HEX 角标 + 逐张翻入。
- 只新增，不改现有调用方签名；U1 结算里已手写的同类结构**可以**改为调用这些函数，但视觉必须与现状一致（以 `ui-direction-a-qa.html` 为基准）。
- 单测：三个函数的输出结构、reduced-motion 类名、空数组/0 值。

### U4 养成：`skills-panel.ts/.css`、`progression-panel.ts/.css`（含 `progression-layouts.ts`、`progression-challenges.ts`）、`crafting-panel.css`（+ `crafting-controller.ts` 渲染部分）

- 技能卡：大图标为主（图标占卡面主体），右下等级角标（胶囊，品质色边），名字在图下；已学/未学/可升级三态用描边和角标区分，不用整卡变灰以外的新花样。
- 养成各页顶部一张主角卡（当前总进度/关键数字），条目行改 `.hub-card-row` 带图标。
- 升级/解锁反馈用**小号仪式**：光圈（复用 `ceremony.css` 放射光缩小版）+ 数字从旧值滚到新值（≤600ms），**不用缎带**。
- 工坊（crafting）：配方行改图标卡行，材料用资源胶囊，产物用品质格。
- 验收：技能图标第一眼可见；升级有反馈；每屏一个主按钮；没有纯文字列表。

### U5 HUD 与系统：`ui/hud.css`、`loadout-bar.css`、`ui/toast-queue.ts`、`ui/dialogue-bar.css`、`ui/settings.css`、`ui/title-screen.css`、`ui/auth.css`

- 技能栏：只加厚格子边框（底边厚度），**不加任何动效、不染色**。
- 提示条：换成带图标的小缎带（不是结算那种大缎带），进出用淡入淡出。
- 标题界面、登录/建角：按钮厚化、面板跟随新面板样式。
- 设置页：可以保留文字列表（方案允许），只跟随控件样式。
- 验收：战斗中不遮挡（对照 `hud-avoidance.ts` 的避让区域）；HUD 文字可读性不下降，对比度 ≥ 4.5:1。

### U6 战棋侧栏：`tactical/tactical.css`（+ 对应渲染文件中只涉及侧栏、按钮、开局面板、结算的部分）

- 侧栏、按钮、开局面板跟随新组件样式；结算复用 U1 的缎带/资源胶囊/掉落翻入（用 U0 补完的三个函数）。
- 棋盘、格子、单位**不改**（等像素对照结论）。

## 四、验证（不跑无头浏览器、不做浏览器自动化）

- 每批：`node tools/build-ui-tokens.mjs --check`，`npx tsc --noEmit -p .`（在 open-world 下），相关单测 `npx vitest run <文件> --maxWorkers=1 --no-file-parallelism`。重任务一次只跑一个。
- 涉及改动的面板要在对应静态验收页（`hub-review.html` / `ui-direction-a-qa.html` / 新建 `u4-u6-qa.html`）里加样例和切换按钮，便于 Claude 之后用浏览器面板审阅。样例数据用真实存在的 ID（之前踩过：不存在的材料/区域 ID、宠物 runtime 写成 `wind-free-adult` 而正确是 `ss-pet-wind-free-adult`）；验收页不能 import `packages/rules/index.ts`（含 `node:crypto`，浏览器里会挂）。
- 已知坑：游戏弹窗 `#modal` 需要 `.open` 类才显示；`#tooltip` 默认 `display:none`；`@layer` 下旧选择器可能压过新样式——用单测断言关键类名/结构，视觉留给 Claude 审。
- 已知与本任务无关的旧失败（不用修，也别为此删断言）：inventory-ui-system「gear actions wait for authoritative quotes…」、playability-phase 4 条任务追踪；`content-pet-r1.database.test.ts` 需要数据库，本机走 `node tools/vitest-tempdb.mjs`。
- 全部完成后发布到云测试服，并写一份给 Grok 的真机清单（每批 3–6 条看什么）。

## 五、约束

- 只提交本任务涉及的文件，按明确路径 `git add`，不要 `git add -A`；工作区里其他会话的未提交改动不碰。
- 不提交图片、原始明细、截图、构建产物。
- 云测试服口令只在 `G:\webgame\aw-deploy\staging-credentials.txt`，不得写进报告、日志、提交或链接；不清库，不改正式角色数据。
- 结束状态只有两种：全部完成并发布；或只剩明确硬阻塞（写清卡在哪一步、需要谁做什么）。
