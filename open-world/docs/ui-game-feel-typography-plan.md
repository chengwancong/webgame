# 界面“网页感”排查与修改执行文档（颜色 / 字色 / 字号 / 重点）

> 日期：2026-10-05　范围：`open-world/apps/web` 全部窗口与 HUD　状态：字号阶段完成；已按图形化文档 0.5 节 C1–C16 返修，Git 编号提交待整理
> 执行者按第 6 节顺序推进；每完成一步运行第 8 节验收，未通过不得进入下一步。

执行结果、实际口径、截图与提交边界见 [验收报告](reviews/ui-game-feel-20261005/README.md)。本文件的“改前”数据为原排查记录；本次另采集了九窗口的完整改前基线，不将不同角色的统计混作同一次测量。

2026-10-05 冲突裁定：本文件涉及正常状态徽标、技能等级徽标、人物空槽文字、外观展开表、任务列表分数、副本次数与物品槽三角／2px 品质边的旧要求，以 `ui-graphic-expression-plan.md` 的 0.5 节 C1–C16 为准；下方保留原执行清单作为历史上下文，不再把冲突旧样式恢复到生产。

---

## 1. 排查结论（实测数据）

测量环境：`http://127.0.0.1:8612/`，视口 1280×720，第一章星潮海角色。统计各窗口可见文字的字符数。

| 窗口 | ≤13px 文字占比 | 灰色说明文字占比 | 主要字号分布（字号/字重:字符数） |
|---|---|---|---|
| 养成 | 69% | 77% | 13/500:99 13/600:94 14/600:59 13/400:56 |
| 副本 | 58% | 66% | 13/400:266 14/400:110 16/700:59 |
| 外观 | 57% | 63% | 14/600:193 13/400:193 12/500:59 |
| 设置 | 49% | 44% | 13/400:139 14/400:49 |
| 背包 | 46% | 46% | 14/600:65 13/400:49 12/400:34 |
| 技能 | 45% | 73% | 14/400:141 13/400:100 12/500:79 |

CSS 源统计（生产入口）：`--font-size-caption`(13px) 被引用 188 次，`--font-size-micro`(12px) 83 次，`--font-size-body`(14px) 只有 75 次；`--font-size-stat` 仅 1 次；`--color-text-secondary` 174 次。

关键 Token 对比度（越接近 1 越分不开）：

| 组合 | 对比度 | 后果 |
|---|---|---|
| 内嵌底 `PanelInset` vs 面板 `Panel` | 1.08 | 卡片、分区和底板融成一片 |
| 选中底 `PanelSelected` vs 面板 | 1.08 | 选中只能靠细边框辨认 |
| 次按钮 `Secondary` vs 面板 | 1.20 | 按钮像普通色块 |
| 主按钮 `Primary` vs 次按钮 | 1.20 | 主次操作分不出 |
| 禁用底 vs 次按钮底 | 1.09 | 禁用按钮和可点按钮几乎一样 |
| 说明文字 `TextSecondary` on `PanelInset` | 4.29 | 低于 4.5，可读性不达标 |

### 1.1 根因

- R1 字号层级被压扁：正文、说明、标记集中在 12–14px，14 到 28 之间几乎没有中间层，重点数字没有放大。
- R2 灰字过多：说明、状态、条件、提示一律用 `TextSecondary`，灰字占到 44–77%，主信息反而不突出。
- R3 表面层级太平：底板、卡片、选中、按钮几种底色的对比度都在 1.08–1.20 之间，只靠 1px 浅边框区分，看起来就是网页卡片。
- R4 按钮没有“可按”感：主按钮浅金、次按钮浅灰、禁用浅灰，彼此很接近；`Shadow.Control: none`，按钮没有厚度。
- R5 信息用“标签: 值”表格平铺：副本详情 9 行同字号同颜色，没有主次。
- R6 开发口吻文案和常驻提示：如“技能名称、机制或 ID”“正在读取装备报价…”“刷新信息”，以及每张卡片重复“选择后可预览搭配。”，进一步稀释重点。
- R7 品质和状态缺乏视觉编码：普通品质物品槽和底板同色；锁定技能卡与可用卡同样白底；状态只是一行 12px 带点文字。
- R8 死代码：`apps/web/src/v2-layout.css` 未被任何入口导入，内含 130 处硬编码色值，会误导后续修改。

---

## 2. 必守约束（违反即返工）

1. 配色方向固定为用户选定的 4「奶白浅金」（`项目.md`「当前统一方向」、`.design/modern-bright-ui-20261003/04-ivory-gold.png`）。不改成深色、皮革、金属、铜钉、浮雕、水墨等新视觉体系。
2. 颜色、字号、间距、阴影只改 `open-world/packages/ui-tokens/tokens.json`，然后运行 `node tools/build-ui-tokens.mjs` 生成；禁止手改 `apps/web/src/ui/tokens.css`、`tokens.ts`。
3. 公共外观只在 components 层文件里改：`apps/web/src/ui/controls.css`、`ui/item-slots.css`、`ui/hud.css`、`apps/web/src/ui/primitives.ts`。页面 CSS（legacy 层：`bag-panel.css`、`gear-ui.css`、`character-equipment.css`、`progression-panel.css`、`skills-panel.css`、`task-panel.css`、`travel-browser.css`、`appearance-panel.css`、`dungeon-panel.css`、`style.css`、`ui/settings.css`）不能覆盖 `.ui-*` 组件的 color / font-size / font-weight / display，需要新外观就加组件变体。
4. 不新建平行皮肤或同义组件；同类控件复用 `ui/primitives.ts` 的 `buttonHtml`、`tabsHtml`、`statRowHtml`、`statusBadgeHtml`、`stateBlockHtml`、`resourceCostHtml`、`panelHeaderHtml`、`itemSlot`。
5. 以下已确认布局不改结构，只改字号、字色和层级：
   - 人物换装：WoW/D4 式中央人物、两侧六槽、右侧属性。
   - 装备 Tips：竖版单列。
   - 技能页：分组技能册 C 方案，不加立绘。大改布局要先出方案。
   - 任务页：常驻多任务列表加固定详情。
   - HUD：A1 菜单、浅金/奶白渐隐任务条、圆形雷达小地图、头像、金币条。
6. 世界显示（名字、伤害数字、地面掉落名、冷却遮罩）使用 `Color.World.*`，本次不动。
7. 客户端不新增计算；数值、状态、原因全部来自服务端已有字段。
8. 养成界面结构另见 `docs/progression-ui-redesign-plan.md`，本文件只负责它的 Token 和公共组件效果，不重复实现。
9. 机器负载：tsc、vitest、浏览器验收串行执行。

### 2.1 规范文本同步（第 0 步完成）

在 `项目.md`「当前统一方向」表格下方追加以下内容，日期写当天：

```
2026-10-05 补充（游戏感与重点层级）：保持奶白浅金配色。按钮允许 2px 实色底边表现厚度（无模糊、无浮雕），按下时底边收起、整体下沉；凸起卡片允许一层轻投影。文字层级：每个窗口最多一个核心大数值（Display），关键数值用 Value 20px/700，标题 H2 20px；说明文字只用于补充信息，单窗口灰字占比不超过 40%，12–13px 文字占比不超过 35%。
```

`项目.md` 表格里“取消正文与控件描边和阴影”一行改为“取消正文描边和阴影；控件只用 2px 实色底边表现厚度”。

---

## 3. Token 修改（`packages/ui-tokens/tokens.json`）

每个 Color 项都要同时改 `dark` 和 `light`（两者值相同）。改完运行 `node tools/build-ui-tokens.mjs`，再运行 `node tools/build-ui-tokens.mjs --check`。

### 3.1 改值

| Token | 现值 | 新值 | 目的 / 校验 |
|---|---|---|---|
| Color.Primary | #efcf85 | #f0bf4f | 主操作更饱和；PrimaryText 对比 8.05 |
| Color.PrimaryTop | #f6ddaa | #f6d27a | 同步 |
| Color.PrimaryHover | #f4d9a0 | #f5cc6a | 对比 9.01 |
| Color.PrimaryPressed | #e3bc68 | #e2ac3a | 对比 6.69 |
| Color.PrimaryText | #44331b | #3b2a0e | |
| Color.PrimaryBorder | #d9b76b | #c48f2a | |
| Color.PanelInset | #f5f1e7 | #f0e9da | 与面板对比 1.08→1.16 |
| Color.PanelSelected | #fff0cb | #ffe6a6 | 选中可辨；Highlight 在其上 4.59 |
| Color.TextSecondary | #65747c | #56656d | 在 Inset 上 5.00、Panel 上 5.79 |
| Color.Highlight | #9a6e24 | #8a5f17 | 在面板上 5.40，在选中底上 4.59 |
| Color.TextDisabled | #839198 | #7b878d | |

### 3.2 新增

| Token | 值 | 用途 |
|---|---|---|
| Color.PrimaryEdge | #b07d1f | 主按钮 2px 底边 |
| Color.SecondaryEdge | #cbbd9f | 次按钮 2px 底边 |
| Color.Disabled | #ece8df | 禁用按钮底；与面板对比 1.17，且无底边 |
| Color.Emphasis | #5c3d0e | 关键数值与重点短语（面板上 9.46） |
| Color.SectionMark | {Color.PrimaryBorder} | 分区标题前的金色小标 |
| Font.Size.Value | 20px | 关键数值（每行一个） |
| Font.Size.H2 | 18px → 20px | 模块标题（改值） |
| Shadow.Card | `0 1px 0 {Color.Border}, 0 2px 6px #182e3b14` | 凸起卡片 |
| Border.Edge | 2px | 按钮底边厚度。`Shadow.Control` 保持 none，底边在 `ui/controls.css` 用 `box-shadow:0 var(--border-edge) 0 var(--button-edge)` 实现 |

新增 Token 后，在 `tests/ui-tokens.test.ts` 的对比度 pairs 里补充：`['Color.TextSecondary','Color.PanelInset']`、`['Color.Highlight','Color.PanelSelected']`、`['Color.Emphasis','Color.Panel']`。

不要改：Font.Size.Body（14px）、Caption（13px）、Micro（12px）、H1（28px）、ItemName、Stat、Display、所有 World / Combat / Minimap / Rarity / Resource Token。

---

## 4. 公共组件修改

### 4.1 按钮（`ui/controls.css`）
- `.ui-button` 增加变量 `--button-edge`（默认 `var(--color-secondary-edge)`），`box-shadow:0 var(--border-edge) 0 var(--button-edge)`。
- `:active:not(:disabled)`：`transform:translateY(var(--border-edge))`，`box-shadow:none`。
- `.ui-button--primary`：`--button-edge:var(--color-primary-edge)`，`font-weight:var(--font-weight-bold)`。
- 新增 `.ui-button--action`：高度 `var(--size-action)`（42px），字号 `var(--font-size-h3)`。每个窗口唯一的主行动（装备、进入副本、出发远行、保存外观、投入天赋点、升级）使用 primary 加 action。`buttonHtml` 的 size 选项增加 `'action'`，映射到这个类。
- `:disabled`：`background:var(--color-disabled)`，`color:var(--color-text-disabled)`，`box-shadow:none`，`border-style:dashed`。必须一眼区分于可点按钮。
- `.ui-button--secondary` 与 `--tertiary`：只保留底边差异，不改颜色。

### 4.2 页签（`ui/controls.css` 的 `.ui-tabs`）
- 选中：`background:var(--color-panel-selected)`，`color:var(--color-text-primary)`，`font-weight:var(--font-weight-bold)`，再加 3px 底部金条：`box-shadow:inset 0 -3px 0 var(--color-highlight)`。竖排页签改为左侧金条 `inset 3px 0 0`。
- 未选中：`color:var(--color-text-secondary)`，字重 600。
- 计数 `small`：选中时 `color:var(--color-highlight)`。

### 4.3 窗口标题（`panelHeaderHtml` 与 `.ui-panel-head`）
- 标题保持 H1 28/700，颜色 `--color-text-primary`。
- 标题下的分隔线改为 2px：左侧 64px 用 `--color-primary-border`，其余用 `--color-border-subtle`，通过 `background` 双段线性填充实现（纯色分段，不用渐变过渡）。
- 标题右侧的资源（金币、强化石）用 `resourceAmountHtml`，数字 16/700。

### 4.4 分区标题（新增组件）
- 在 `ui/primitives.ts` 新增 `sectionTitleHtml(title, options?:{count?:string;actionsHtml?:string})`，输出 `<h3 class="ui-section-title">`。
- 样式：`font:var(--font-weight-bold) var(--font-size-h3)/var(--font-line-heading)`，`color:var(--color-text-primary)`；前置 8×8 菱形标 `::before`，`background:var(--color-section-mark)`，`transform:rotate(45deg)`。
- 替换各页自写的 `<h3>`、`<h4>`、`.section-label`、`.bag-section h4`、`.task-*-title`、`.settings-group h3` 等分区标题（只替换分区标题，不替换卡片内名称）。

### 4.5 数值行与关键数值
- `.ui-stat strong`：`font-size:var(--font-size-h3)`，`font-weight:var(--font-weight-bold)`，`color:var(--color-emphasis)`。
- `.ui-stat__label`：`font-size:var(--font-size-body)`，`color:var(--color-text-secondary)`，字重 500。
- 新增 `.ui-stat--value`：`strong` 用 `var(--font-size-value)`，用于每个详情区最重要的 1–3 个数值（伤害、冷却、准入等级、时限、奖励）。
- 新增 `statTilesHtml(items:{label:string;value:string;tone?:StatusTone}[])`（`ui/primitives.ts`）：2–4 个并排数值块；块底 `--color-panel-raised`，`box-shadow:var(--shadow-card)`，标签 13/500 灰，数值 Value 20/700 `--color-emphasis`。技能详情现有的“伤害 / 冷却 / 距离”三块改用此组件，作为标准样式。

### 4.6 徽标（`.ui-badge`）
- 改为实底胶囊：`background:color-mix(in srgb,var(--badge-ink) 14%,var(--color-panel-raised))`，`color:var(--badge-ink)`，`font-weight:var(--font-weight-bold)`，`font-size:var(--font-size-micro)`，不要边框。
- 所有“• 已装配”“• 已获得”“• 需角色3级”这类圆点文字，改用 `statusBadgeHtml`（success / neutral / warning）。

### 4.7 卡片与列表项
- 新增 `.ui-card`（components 层）：`background:var(--color-panel-raised)`，`border:var(--border-width) solid var(--color-border)`，`border-radius:var(--radius-slot)`，`box-shadow:var(--shadow-card)`。悬停时 `border-color:var(--color-border-strong)`；选中时 `background:var(--color-panel-selected)`，加 `box-shadow:var(--shadow-selected),var(--shadow-card)`，边框用 `--color-highlight`。
- 列表卡片的名称 16/700 主色；第二行说明 13/400 灰，且最多 1 行（`text-overflow:ellipsis`）；状态改用徽标。
- 不可用（锁定）卡片加 `.is-locked`：`background:var(--color-panel-inset)`，`box-shadow:none`，图标 `filter:grayscale(.7) opacity(.7)`，名称改用 `--color-text-secondary`，并加锁定徽标显示服务端原因。

### 4.8 物品槽品质（`ui/item-slots.css`）
- 保持浅底，不加厚框。品质用 2px 边框加右上角 6px 三角角标表示：`border:2px solid var(--quality-color)`；`::after` 角标 `background:var(--quality-color)`。普通品质只用 1px `--color-border-strong`，不加角标。
- 物品名称在详情和 Tips 中使用品质色（现有 `Color.Rarity.*`）。槽位下方的名称保持主色。

### 4.9 状态块（`stateBlockHtml`）
- 图标 48px，标题 16/700，说明不超过一行。加载态只显示“读取中…”，不显示“正在读取装备报价…”这类技术描述。

### 4.10 灰字使用规则（所有页面）

| 内容 | 字号 / 字重 | 颜色 |
|---|---|---|
| 窗口标题 | 28/700 | 主色 |
| 分区标题 | 16/700 + 菱形标 | 主色 |
| 条目名称（卡片、列表） | 16/700 | 主色（物品用品质色） |
| 关键数值 | 20/700（核心大数值用 Display 32/700，每窗口最多 1 个） | Emphasis |
| 普通数值 | 16/700 | Emphasis |
| 正文、描述 | 14/400 | 主色 |
| 标签、元信息（类型、部位、等级要求） | 13/500 | 灰 |
| 计数、角标 | 12/700 | 继承 |
| 状态 | 徽标 12/700 | 语义色 |
| 不可执行原因 | 13/500 | Warning |
| 资源不足 | 14/700 | Danger |

禁止：用 12–13px 显示条目名称、数值、按钮文字；用灰色显示正文描述；在同一卡片里出现两行以上灰字。

---

## 5. 逐页修改清单

每页都先应用第 3、4 节的全局改动，再做本页项目。“文件”列出主要入口，以实际 grep 为准。

### 5.1 HUD（`presentation.ts`、`ui/hud.css`、`ui/quest-tracker.ts`）
- 不改布局、尺寸和 A1 菜单。
- 任务条：章节行 12/600 Highlight；任务名 16/700 主色；目标描述 14/400 主色；进度数字 14/700 Emphasis；支线卡片同样处理。
- 地区名小条：字号 14/700。
- 血条、能量条数字：13/700，保持 `Color.Vital.Text`。

### 5.2 背包（`components/BagPanel.ts`、`components/GearDetails.ts`、`bag-panel.css`、`gear-ui.css`）
- 左侧分类：选中项按新页签样式显示；计数 12/700。
- 物品槽：应用 4.8 的品质边框。槽下名称 13/600 → 14/600，最多 1 行。
- 详情区：类型行“武器 · 普通”13/500 灰；名称保持 ItemName 22/700，颜色改用品质色；主属性块保持 Stat 30，标签 14/500。
- 底部汇总条（“装备 6/24 · 消耗品 0 种…”）与左侧容量卡重复，删除汇总条，容量卡保留。
- 加载文字统一为“读取中…”。
- 主按钮“前往人物换装 / 装备 / 替换”使用 primary + action；“锁定”“分解”为 secondary。

### 5.3 人物（`components/CharacterPanel.ts`、`components/CharacterPaperdoll.ts`、`character-equipment.css`）
- 布局不变。
- 槽位卡：部位名 13/500 灰；装备名 15/700 品质色；空槽只显示部位名，加一个“空”字（13/500 灰），删除“未装备 · 暂无候选”两行。有候选时右上角显示候选数徽标。
- 右侧属性：顶部三块（生命 / 攻击 / 护甲）保持，数值改用 Value 或 Display，标签 13/500。次级属性用 `.ui-stat`（标签 14 灰，值 16/700 Emphasis）。
- 删除底部提示“悬停查看已装备装备 · 点击部位更换”和“Esc 收起换装 / 关闭人物”，改为对应元素的 `title`。

### 5.4 技能（`skills-panel.ts`、`skills-panel.css`）——只改样式，不改布局
- 搜索占位符改为“搜索技能”。
- 技能卡：名称 16/700；一句描述 14/400 主色；“Lv.1”改为 12/700 徽标；状态改为徽标（已装配 = success，可激活 = info，需角色 N 级 = 锁定样式加 warning 徽标）。
- 锁定技能应用 4.7 的 `.is-locked`。
- 详情三数值改用 `statTilesHtml`。
- 升级区：“升级到 Lv.2”用分区标题；“伤害强度 49 → 55”用 `statRowHtml` 的 previousValue 和 `.ui-stat--delta`；“还缺 8”14/700 Danger。
- 底部装配栏：删除“按装配顺序检查可用技能”说明；“技能装配 2/4”用分区标题加计数。

### 5.5 养成（`progression-panel.ts`、`progression-panel.css`）
- 按 `docs/progression-ui-redesign-plan.md` 执行。本文件只要求：页签、按钮、数值行、徽标、卡片自动继承第 4 节；列表项改为 `.ui-card` 样式；“报价尚未就绪”等文字按 4.9 处理。

### 5.6 外观（`appearance-panel.ts`、`appearance-panel.css`）
- 底部四个等宽按钮改为：“保存外观”primary + action 放最右；“全部自动”“撤销调整”secondary；“刷新信息”只在出错时出现在错误状态块里。
- 每张造型卡上的“选择后可预览搭配。”删除；“• 已获得”删除（默认就是已获得），未获得的造型卡用 `.is-locked` 加获取途径徽标。
- 预览下方的说明“动作与朝向只影响此窗口；外观不改变装备属性。”删除，改为预览区 `title`。
- “本次搭配 · 7 个部位”改为分区标题加计数徽标。

### 5.7 任务（`task-panel.ts`、`task-dom.ts`、`task-panel.css`）——布局不变
- 列表项：任务名 16/700；类型徽标；进度“2/6”14/700 Emphasis。
- 详情：任务名保持现有大标题；“任务说明 / 任务目标 / 任务关联 / 任务奖励 / 任务记录”改为分区标题；目标进度数字 Value 20/700，进度条高度 8px。
- 奖励数值用 `resourceAmountHtml`，数字 Value 20/700。
- 顶部“共 2 项有效任务”和“列表显示 2 项”保留一个（保留列表上方那个）。
- 删除底部提示“选择左侧任务查看详情，领奖成功后收入任务档案。”
- 筛选行：类型下拉、搜索框、状态切换保持功能；状态切换改用 `tabsHtml` 紧凑样式，不用自绘按钮组。

### 5.8 副本（`dungeon-controller.ts`、`dungeon-panel.css`）——改动最大
- 修复 bug：顶部分类页签被裁切（截图中只露出半截“普通关卡”）。检查 `.dungeon-panel` 的 overflow 和页签容器高度，页签必须完整显示。
- 左侧列表卡改为 `.ui-card`：左边 56×56 地区缩略图（复用 `travel-browser.ts` 目的地卡片使用的同一图片解析，不新增素材）；名称 16/700；第二行“实时作战 · 1–1 人”13/500 灰；状态用徽标（可进入 = success；未开放 = 锁定样式加服务端原因）。
- 右侧详情：
  - 顶部横幅：地区图（同一图片解析，高 120px、圆角 slot）叠名称 22/700，下方模式徽标（普通关卡、实时作战）。
  - 关键信息用 `statTilesHtml`：准入等级、战斗时限、本期次数。
  - 其余规则（断线规则、装备技能、本场目标、救援队友）放进 `<details class="ui-details">`，标题为“详细规则”，默认收起；展开后用 `.ui-stat`。“本场目标”默认展开显示，14/400 主色。
  - 奖励：用 `resourceAmountHtml`，数字 Value 20/700；为 0 时显示“首通后可得”，不显示“0”。
  - “进入副本”改为 primary + action，固定在详情底部；不可进入时禁用，并在下方用 13/500 Warning 显示原因。
  - 底部说明“战利品自动存入背包，退出后保留已获得的道具。”改为按钮 `title`。

### 5.9 远行（`travel-browser.ts`、`travel-browser.css`）——视觉基础最好，只微调
- “地区目录”“掉落预览”改为分区标题。
- 掉落预览的三项数值改用 `statTilesHtml`。
- “出发远行”primary + action；禁用时按 4.1 显示禁用样式并给出原因。
- 左侧地区目录底部的地区数量和说明文字删除。

### 5.10 设置（`ui/settings-panel.ts`、`ui/settings.css`）
- 分组标题改用分区标题；开关和滑条行的标签 14/500 主色，说明 13/400 灰且最多 1 行。
- 按键列表的键位用徽标样式（12/700，Raised 底）。
- “退出账号”保持 secondary，放右下。

### 5.11 只做检查的窗口（全局改动后确认没有回退）
- 装备 Tips（`equipment-tip.ts`、`ui/item-tip.ts`）：竖版结构不变，只确认品质色名称和数值 Emphasis 生效。
- 战斗结果（`battle-result-panel.ts`）、剧情对话（`story-renderer.ts`、`story-panel.css`）、确认窗口（`confirmationHtml`）、登录（`ui/auth-panels.ts`）：确认按钮底边、禁用态和标题生效，不出现溢出或裁切。

### 5.12 文案清理（全局 grep 后统一替换）

| 现文案 | 改为 |
|---|---|
| 技能名称、机制或 ID | 搜索技能 |
| 正在读取装备报价… / 正在读取… / 报价尚未就绪 | 读取中… |
| 刷新信息（常驻按钮） | 删除，仅出错时“重新读取” |
| 选择后可预览搭配。（每卡重复） | 删除 |
| 悬停查看… / 点击部位更换 / Esc 收起… 等常驻操作提示 | 改为 `title` |
| “• 已获得”“• 已装配”这类圆点文字 | 状态徽标 |

### 5.13 清理死代码
- 删除 `apps/web/src/v2-layout.css`；先 `grep -rn "v2-layout" apps/web tools tests` 确认无引用。若展示页需要，迁到 showcase 的单独导入，不进生产入口。

---

## 6. 执行顺序与提交粒度

0. 第 2.1 节规范文本同步。
1. Token 修改（第 3 节）→ 生成 → `--check` → 对比度测试。
2. 公共组件（第 4 节）：按钮 → 页签 → 标题 → 分区标题 → 数值 → 徽标 → 卡片 → 物品槽 → 状态块。每完成一项，截图背包和技能两个窗口确认。
3. 页面：副本 → 外观 → 任务 → 技能 → 人物 → 背包 → 设置 → 远行 → HUD → 只检查窗口。
4. 文案清理和死代码。
5. 更新 `docs/ui-design-system.md` 字体表（H2 20、Value 20、按钮底边、灰字规则）和 `docs/ui-system-progress.md` 记录。

每个编号单独提交；提交说明写清本步改了哪些 Token / 组件 / 页面。

---

## 7. 不在本次范围

- 不改玩法、数值、服务端接口、契约（养成结构改动见另一份文档）。
- 不新增美术资源（副本缩略图复用已有地区图）。
- 不改 HUD 布局、小地图、A1 菜单、装备 Tips 布局、人物换装布局、技能页布局、任务页布局。
- 不加主题切换。

---

## 8. 验收

### 8.1 命令（依次执行，不并行）
```bash
node tools/build-ui-tokens.mjs --check
node tools/audit-ui-system.mjs --strict
npx tsc --noEmit -p .
npx vitest run tests/ui-tokens.test.ts tests/bag-ui.test.ts tests/progression-ui-system.test.ts tests/travel-browser.test.ts tests/story-gates-ui.test.ts
npm run service:status
```
相关验收脚本按需串行运行：`tools/accept-character-layout.mjs`、`tools/accept-equipment-tip.mjs`、`tools/accept-gear-ui.mjs`、`tools/accept-appearance-ui.mjs`、`tools/accept-deep-progression.mjs`。脚本断言旧文案或旧颜色时，更新断言并说明原因，不得删除检查。

### 8.2 文字层级量化（每个窗口都要测）
打开窗口后，在浏览器控制台运行：

```js
(()=>{const root=document.querySelector('#modal .panel');const sizes={};let g=0,total=0,big=0;const grey=[getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim(),getComputedStyle(document.documentElement).getPropertyValue('--color-text-disabled').trim()];const toRgb=h=>{const n=parseInt(h.slice(1),16);return `rgb(${n>>16&255}, ${n>>8&255}, ${n&255})`};const greyRgb=grey.map(toRgb);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let t;while(t=w.nextNode()){const s=t.textContent.trim();if(!s)continue;const el=t.parentElement;if(!el.getBoundingClientRect().width)continue;const cs=getComputedStyle(el);const fs=parseFloat(cs.fontSize);sizes[fs]=(sizes[fs]||0)+s.length;total+=s.length;if(greyRgb.includes(cs.color))g+=s.length;if(fs>=20&&!el.closest('.ui-panel-head'))big++;}const small=Object.entries(sizes).filter(([k])=>+k<=13).reduce((a,[,v])=>a+v,0);return {small:Math.round(small/total*100)+'%',grey:Math.round(g/total*100)+'%',emphasisNodes:big,sizes};})()
```

通过标准：
- `small`（≤13px 占比）≤ 35%
- `grey`（灰字占比）≤ 40%
- `emphasisNodes`（标题外 ≥20px 的文字节点）≥ 1
- 测量窗口：背包、人物、技能、养成、外观、任务、副本、远行、设置

### 8.3 视觉检查（真实浏览器，`http://127.0.0.1:8612/`）
- 视口 1280×720、1024×768、375×812 各截图一次，无溢出、无裁切、无文字被截断。
- 每个窗口能在 1 秒内指出：主行动按钮、最重要的数值、当前选中项。
- 主按钮、次按钮、禁用按钮三者截图并排对比，肉眼可区分。
- 按 `项目.md「状态切换与布局稳定」`：连续切换条目、页签、悬停、按下、键盘焦点，确认选中和按下不改变布局尺寸、不跳动；按钮按下下沉 2px 后复位。
- 新角色和老角色各登录一次，进入营地，无版本拦截和资源缺失。
- 结束后把浏览器视口恢复为 desktop。

### 8.4 交付说明需要包含
- 每个窗口改前和改后的 8.2 量化结果表。
- 1280×720 下改前和改后的截图路径。
- 未完成项和原因。
