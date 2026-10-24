# 22 · 界面改造方案：方向 A「明亮卡牌」（Claude，2026-10-24）

## 裁决

2026-10-24，用户在对照页（`21-ui-game-feel-compare.html`）里选了方向 A：保留奶油浅金色系，但改成"游戏式"的表达。

一句话口径：**色板不换，换表达。**
- 从"平、薄、字"改成"厚、亮、图"。
- 每个界面都要有主角：物品、数字或评价。
- 打赢、拿到东西这类时刻要有仪式感。

被替换的旧规则是 10-03 组件层的"平面浅色品质底、单一选中描边、无纹理"（`ui/item-slots.css` 头注）。色板、字体、16:9 舞台、信息结构都不变。

## 为什么现在不像游戏（盘点结论）

| 现象 | 根因 | 位置 |
|---|---|---|
| 按钮像网页 | 扁平填色、细边、无厚度和按压感 | `ui/controls.css`、`primitives.ts buttonHtml`（全项目 288 处调用） |
| 掉落只是一行字 | 物品格是浅色平底、灰描边，品质只体现在小标签颜色 | `ui/item-slots.css`、`ui/bag-board.css` |
| 结算没有高潮 | 标题就是普通面板标题；评价章 S/A/B 已有图（`hub-fun/grade-*.png`），但只在局部用 | `battle-result-controller.ts`、`hub/hub-result-block.*` |
| 数字不突出 | 资源用 `statRow` 文字行；金币图标已有（`native-coin.ts`），但没做成胶囊 | `primitives.ts statRowHtml / statTilesHtml` |
| 面板都长一样 | 统一白卡＋细边，层级只靠字号 | panel 系列 Token、`panel-head.css` |
| 已有美术没接 | E7 组件装饰件已交付但一处未接：`hub-ui/ui-ornaments.{png,json}` 含品质格框 4 档、传说流光 6 帧、标题花饰、分隔线、角花、提示尖角、提示条底；评价章 `hub-fun/grade-s/a/b.png` 只在局部用 | `art-he-progress.md` E7「由 Claude 决定」 |

结论：主要是组件层的问题，不是每个界面各自的问题。先改组件层，200 多处调用会一起变；再逐屏补"主角"和"仪式"。很多需要的素材已经在库里，新美术只需补 5 项（见下文"美术"）。

## 与现行项目规则的关系

AGENTS.md 中 10-03 的条目写的是"细边框和轻阴影……取消皮革底、铜钉与浮雕"。方向 A 是用户 10-24 的新选择，对这条做两处收窄：
- 按钮和卡片允许有底边厚度；
- 物品格允许用品质色描边。

仍然遵守的部分：
- 不用皮革、铜钉、金属浮雕；
- 底板仍是奶白；
- 正文仍是深色。

U0 落地时同步改 AGENTS.md 和 `项目.md「当前统一方向」`，写明以本文为准。

以下已经定过的规则不动：
- **新样式值必须写进 `packages/ui-tokens/tokens.json`**，由 `tools/build-ui-tokens.mjs` 生成，不手改 `tokens.css`；同类控件复用公共件，不另建平行皮肤。
- **地面掉落**保持"透明图标＋名称、无底框、无品质边框"，稀有和传说只有短暂光柱。方向 A 只作用于面板里的物品格。
- **技能栏**保持"安静"：不闪、不染色、冷却只有细金环。U5 只改格子边框厚度，不加任何动效。
- **右下 A1 菜单**、**小地图 B**、**装备 Tips 竖版单列**的布局不动，只跟随按钮和面板换新样式（Tips 可以加品质色头部）。

## 六条视觉规则（替换"平面无纹理"）

1. **有厚度**：主要/次要按钮、物品卡、页签带一条同色系深色底边（`0 4px 0`），按下时下沉 3px、底边收到 1px。面板保持浅色，但标题区加一条浅金顶带。
2. **品质看边框**：物品格和卡用 3px 品质色描边，内部放一圈品质色径向光。稀有及以上在顶部加品质小标；传说加慢速流光（4 秒一圈）。品质色沿用现有 `--color-rarity-*`，另加亮色描边 `--rim-*` 和光晕 `--glow-*`。
3. **图在字前**：物品、技能、资源、系统入口一律带图标；没有正式图时用占位剪影，不留纯文字。纯文字列表只保留在设置、战报、规则说明里。
4. **大时刻要有仪式**：结算、开箱、升级、解锁统一用"缎带标题＋星级/评价章＋逐个翻出的奖励"这一套。日常面板不用缎带，避免满屏都是庆祝。
5. **数字是主角**：资源用胶囊（图标＋加粗大号数字＋品质色边）；获得数字从 0 滚到终值（不超过 600ms）；属性对比用绿色 ▲、红色 ▼。
6. **动效要短**：弹出 0.9→1.04→1（220ms）；奖励逐张翻入（间隔 80ms，总长不超过 800ms）；按钮按压 80ms。`prefers-reduced-motion` 时全部取消，只保留淡入。

同时守住：
- 一屏只有一个主按钮。
- 文字对比度不低于 4.5:1（浅金底上的字用 `--color-primary-text`）。
- 不新增字体：标题用现有 WorldSans / Noto Sans SC 的最粗字重，加 2px 描边加投影。
- 不引入新的第三方素材；新素材按惯例逐次征得同意。

## 组件层（U0，先做，200 多处调用自动受益）

改 CSS 和基础件，不改调用方的签名。新的颜色、厚度、光晕、动效时长先加进 `tokens.json`（如 `depth.button`、`rim.rare`、`glow.legendary`、`motion.reveal`），再生成引用。

| 组件 | 现状 | 改成 | 文件 |
|---|---|---|---|
| 按钮 primary / secondary / danger | 扁平 | 渐变顶光、2px 浅色内沿、4px 深色底边、按压下沉；尺寸 `--size-action` 不变 | `ui/controls.css` |
| 面板 | 白卡细边 | 奶油底、浅金顶带（页面级 6px，区块级 3px）、圆角 16 不变、轻投影 | `tokens.json`、`ui/panel-head.css` |
| 面板标题 | 普通标题 | 页面级标题左侧加徽记位，右侧关闭钮换成圆形厚按钮 | `panelHeaderHtml` |
| 品质徽章 | 灰底小字 | 品质色实底白字胶囊，带 1.5px 白边 | `statusBadgeHtml` 加 rarity 色调 |
| 物品格 / 卡 | 平底灰边 | 规则 2：外框接 E7 `slot-frame-*` 九宫格，传说叠加 `slot-shine-0…5` | `ui/item-slots.css`、`ui/bag-board.css` |
| 面板装饰 | 无 | 页面级标题两侧接 `panel-crest`，区块之间用 `panel-divider`；`panel-corner` 只给结算、开箱这类大时刻用 | `ui/panel-head.css` |
| 提示框 / 提示条 | CSS | 接 `tip-arrow`、`toast-bg` | `ui/item-tip.ts`、`ui/toast-queue.ts` |
| 资源数值 | 文字行 | **新增** `resourcePillHtml(kind, value, delta?)` | `primitives.ts` |
| 缎带标题 | 无 | **新增** `ribbonTitleHtml(text, {stars?, grade?})`，接 `hub-fun/grade-*.png` | `primitives.ts` + 新 `ui/ceremony.css` |
| 奖励展示 | 各写各的 | **新增** `rewardRevealHtml(items)`：卡片翻入、NEW / HEX 角标、品质光 | 同上 |
| 页签 | 细线下划线 | 胶囊页签，选中项浅金实底带底边 | `ui/controls.css` |
| 确认框 / 空状态 / 提示条 | 网页式 | 跟随按钮和面板的新样式；空状态配插画位 | 跟随 |

注意：GPT 正在执行潮印撤销，R3 会改 `ui/primitives.ts`、`dungeon-controller.ts`、`main.ts`。所以 U0 先改 `tokens.json` 和纯 CSS 文件（`controls.css`、`item-slots.css`、`bag-board.css`、`panel-head.css`、新 `ceremony.css`）；`primitives.ts` 新增函数等 GPT 的 R3 提交落地后再加，避免冲突。

U0 验收（照 `项目.md「状态切换与布局稳定」`）：
- 实际连续切换按钮、页签、物品格的悬停、按下、选中、禁用四态，按下下沉不改变布局占位；
- 核对计算样式与旧媒体查询叠加后的最终结果；
- 组件展示页 `ui-system-showcase` 同步更新，作为对照基准。

## 逐屏批次

每批完成后跑一次 tsc 和单测，然后把真机检查交给云测试服和 Grok。

| 批 | 范围 | 主角 / 仪式 | 验收 |
|---|---|---|---|
| U1 结算与掉落（代表界面） | `battle-result-controller.ts`、`hub/hub-result-block.*`、`kill-spoils.ts`、`battle-defeat-panel.css` | 缎带"通关"＋评价章、资源胶囊滚动、`rewardRevealHtml` 掉落卡；失败页用灰蓝缎带"撤退"，不加星 | 和对照页方向 A 一致；掉落不再是文字行 |
| U2 背包、装备、物品提示 | `ui/bag-board.css`、`bag-panel.css`、`gear-ui.css`、`character-equipment.css`、`ui/item-tip.ts`、`hex-runes.css` | 品质边框格、物品提示框加品质色头部和 HEX 紫色行、对比 ▲▼ | 远看能分出品质；提示框第一眼看到名字、品质、对比 |
| U3 主城枢纽 | `hub/today-panel`、`commission-panel`、`port-panel`、`chart-panel`、`pet-panel`、`return-queue`、`slot-upgrade-panel` | 每个面板顶部一张主角卡（今日目标、委托奖励、建筑插画），列表行改成带图标的卡行 | 每屏一个主按钮；没有纯文字列表 |
| U4 养成 | `skills-panel.css`、`progression-panel.css`、`crafting-panel.css` | 技能卡大图标加等级角标；升级和解锁用小号仪式（无缎带，用光圈加数字滚动） | 升级有反馈；技能图标为主 |
| U5 HUD 与系统 | `ui/hud.css`、`loadout-bar.css`、`ui/toast-queue.ts`、`dialogue-bar.css`、`settings.css`、`title-screen.css`、`auth.css` | 技能栏厚边框格、提示条换成带图标的小缎带、标题界面按钮厚化 | 战斗中不遮挡；HUD 可读性不下降 |
| U6 战棋侧栏 | `tactical/tactical.css`（只改侧栏、按钮、开局面板、结算） | 结算复用 U1 | 棋盘本身等像素对照结论，不在此批 |

顺序：U0 → U1 →（给用户看一眼）→ U2 → U3 → U4 → U5 → U6。U1 做完先截图给用户确认手感，之后不再逐批停下来。

## 美术（交 GPT，和前端并行）

已有的直接接：E7 装饰件（A26）、评价章（A3）、金币图标、A12 星晶/星核、A20 强化石。按钮厚度用 CSS 实现，不出图。

新增 A34–A38 先用 CSS 占位（对照页的做法），素材到了只换资源登记，不改逻辑。交接见 `../handoff/art-hg-game-feel.md`：

| 编号 | 内容 | 用在 |
|---|---|---|
| A34 | 缎带标题底 ×3：胜利金、撤退灰蓝、解锁浅金（九宫格） | U1 结算、U4 解锁 |
| A35 | 星级星（亮 / 暗）+ 点亮闪光 6 帧 | U1 结算 |
| A36 | 经验图标、"NEW"角标、"HEX"角标 | 资源胶囊、奖励卡 |
| A37 | 结算背景：放射光底 + 星屑 / 彩带粒子图集 | U1 结算 |
| A38 | 空状态插画 ×6：背包空、委托空、无掉落、无宠物、离线、加载中 | `stateBlockHtml` |

另外两项调整：
- **A18（三选一卡框）作废**：潮印已撤销。
- `ui/btn-*.png`、`panel-frame.png` 是旧版，不接。

## 不做

- 不换色板，不转暗色，不转像素，不转 3D。
- 不改信息结构和交互流程，只改表现；需要改结构时单独提。
- 不加局内随机或抽卡式的演出（呼应"不需要肉鸽元素"）。

## 执行分工

- 组件层和逐屏前端：Claude 定样式规格，Sonnet 子代理写代码，Claude 审阅。
- 美术：GPT 按 `art-hg-game-feel.md` 出图。
- 真机检查：云测试服加 Grok。
