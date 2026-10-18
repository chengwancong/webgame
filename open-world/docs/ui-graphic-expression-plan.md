# 界面“用文字代替 UI”排查与整改执行文档

> 日期：2026-10-05　范围：`open-world/apps/web` 全部窗口与副本 HUD　状态：0.5 节 C1–C16 已执行且本机验收通过；本文其他扩展项按报告列明
> 前置文档：`docs/ui-game-feel-typography-plan.md`（字号/颜色/层级）、`docs/progression-ui-redesign-plan.md`（养成结构）。三份文档的公共 Token 与组件步骤先做，页面步骤按窗口合并执行，避免同一页面改两遍。三份文档有冲突时，以本文第 0.5 节为准。
> 每完成一步运行第 8 节验收，未通过不得进入下一步。

本次按用户追加的 0.5 节裁定返修；提交／补丁说明使用“按图形化文档 0.5 节 Cxx 调整”。本轮结果见 [验收报告](reviews/ui-game-feel-20261005/README.md)。新增 `section.points` 已由服务端提供且为可选；当前没有新增 `item.gate` 或挑战 `entries.rewards` 字段，它们依本文的缺失字段回退规则呈现。

---

## 0. 判定标准：什么叫“用文字代替 UI”

以下 6 类一律视为问题：

| 编号 | 模式 | 典型现状 | 应改为 |
|---|---|---|---|
| A | 进度/等级写成分数文字 | `1/1`、`0/5`、`强化 3/15`、`2/4 件`、`今日 1/3 次` | 点阵（≤10）或分段进度条（>10），分数只放在 aria-label、title、详情区 |
| B | 状态写成文字徽标 | `• 已装配`、`• 未选择`、`• 已获得`、`条件已满足`、`点击穿戴` | 图标角标、节点底色/描边、置灰；只有异常状态（锁定原因、失败）保留文字 |
| C | 结构写成文字标签 | `第 1 层`、`第 2/3 阶段`、`连接：xx`、`本次搭配 · 7 个部位` | 连线、轨道、编号圆点、缩略图条 |
| D | 数值组合写成句子 | `金币 120 · 经验 40 · 强化石 3`、`坦克 1 · 治疗 1 · 输出 3`、`[+]30%` | 图标 + 数字的资源条、职责图标 + 数字、乘区色块 |
| E | 用文字字符冒充图标 | `✓` `＋` `›` `◇` `★` `◆` `↑↓←→` | 统一图标库 SVG |
| F | 常驻说明句/空结果句 | `等级与声望奖励提供天赋点。主副专精不同。`、`本次无需消耗资源。`、`角色属性不变`、`选择后可预览搭配。` | 删除；必要说明放进 ⓘ 帮助图标的 title；空结果整块不渲染 |

保留为文字的内容见第 6 节。总原则：**列表与格子里只放“图标 + 数字 + 状态图形”，完整文字放到详情区、Tips 和 aria-label。**

---

## 0.5 与前两份文档的冲突裁定（以本节为准）

前两份文档里有些条目本文要求改掉。执行到对应位置时按下表处理，不要两种都做。

| # | 原文位置 | 原要求 | 裁定 |
|---|---|---|---|
| C1 | 字号文档 4.10 表“状态”行、4.6 末条、4.7“状态改用徽标”、5.12 表末行 | 所有状态一律改用 `statusBadgeHtml` | 正常状态（已装配、已获得、已装备、可激活、可进入）改用角标或节点外观，不显示徽标；只有异常状态（失败、待确认、不可执行原因、类型不匹配）用徽标或 Warning 文字。4.10 表“状态”行改为“正常状态：角标/节点外观；异常状态：徽标 12/700 语义色” |
| C2 | 字号文档 5.4 技能卡 | `Lv.1` 改为 12/700 徽标；状态徽标（已装配/可激活/需 N 级） | 按本文 4.3：等级用点阵，状态用图标角标，卡片内不放状态徽标 |
| C3 | 字号文档 5.3 人物槽位卡 | 空槽显示部位名加一个“空”字；候选数用徽标 | 部位名保留（13/500 灰），**不加“空”字**，空槽用虚线框加部位剪影；候选数用右上 `count` 角标 |
| C4 | 字号文档 5.6 外观 | 未获得造型卡加获取途径徽标；“本次搭配”改为分区标题加计数徽标 | 未获得用锁定节点外观加 `lock` 角标，获取途径进 title 和详情；“本次搭配”按本文 4.7 改为 7 格缩略图条 |
| C5 | 字号文档 5.7 任务列表 | 进度“2/6”14/700 Emphasis | 列表行改迷你进度条，数字进 aria-label；**详情区**的目标进度数字仍按字号文档用 Value 20/700 |
| C6 | 字号文档 5.8 副本列表卡 | 第二行文字“实时作战 · 1–4 人”；可进入=success 徽标 | 第二行改模式图标 + `people` 图标 + 数字；可进入不显示任何标记，未开放用 `lock` 角标 |
| C7 | 字号文档 5.8 副本详情“本期次数” | 数值块显示数字 | 仍用 `statTilesHtml` 数值块，块内用剩余次数点阵代替“1/3”文字 |
| C8 | 字号文档 5.8 奖励 | 为 0 时显示“首通后可得” | `rewardStripHtml` 隐藏数量为 0 的单项；**全部为 0** 时显示“首通后可得” |
| C9 | 字号文档 4.7 `.ui-card.is-locked` 与本文 3.5 `.ui-node[data-state]` | 两套锁定样式 | 只保留一套状态语义：`.ui-card` 用于列表行/卡片，`.ui-node` 用于图形节点和图标格；两者都用 `data-state="locked|available|learned|maxed"` 驱动同一组 CSS 变量。`.is-locked` 改为 `data-state="locked"` 的别名或直接删除；锁定原因不再用徽标，进 title 和详情 |
| C10 | 字号文档 4.8 物品槽品质 | 2px 品质边框加**右上角**三角角标 | 右上角已分配给 `check/lock` 角标，会重叠；且 `项目.md` 已确认的 A「清爽品质底色」用底色表达品质、要求“轻边框”。裁定：**删除三角角标，不改为 2px**；品质按 A 方案用 `Color.Item` 底色加 1px 品质色边框，选中仍只加单圈细杏金边 |
| C11 | 养成文档 3.3 节点 | 节点文字“短名 + rank/max” | 按本文 4.1：节点只放属性图标加点阵，名称只放在列头、title、aria-label 与详情 |
| C12 | 养成文档 3.3 节点配色 | learned=成功色（绿）边框、available=警示色底 | 统一为本文 3.5：learned=浅金选中底加深金边，available=金色外圈，locked=置灰加锁。养成树不再用绿/橙两套语义色 |
| C13 | 养成文档 2.2 | 属性全不变时显示“角色属性不变” | 整块不渲染 |
| C14 | 养成文档 2.3 | 天赋点从 `view.summary` 读字符串，缺失时在 summary 加 `{name:'天赋点',value:'1/1'}` | 新增结构化字段 `points`（本文第 5 节）作为唯一数据源；summary 中的天赋点项只保留给“总加成”浮层展示，前端不再解析它 |
| C15 | 养成文档 2.1 | 禁用原因用 `ui-caption` | 按字号文档 4.10：Warning 13/500 |
| C16 | 养成文档 3.3 三系页签 | 标注“主”“副”文字 | 用 `tabsHtml` 的 `markHtml` 圆形角标表达，页签名不拼接“ · 主” |

不冲突、照原文执行的：字号文档的 Token、按钮、页签、标题、分区标题、数值行、文案清理、死代码删除；养成文档的操作按钮、竖排导航、总加成浮层、契约可选字段与回退规则。

---

## 1. 排查结论（按窗口）

位置写到文件与函数；行号以实际 grep 为准。

### 1.1 养成 · 天赋树（用户截图页面，最高优先级）
`apps/web/src/progression-panel.ts` 的 `talentTreeHtml`、`renderProgression`；`packages/rules/deep-progression.ts` 天赋 section（约第 200–207 行）

| ID | 现状 | 类型 |
|---|---|---|
| P-01 | 节点只有文字“力量 I / 1/1”，没有图标；罗马数字与行号重复 | A、C |
| P-02 | 每行左侧写“第 1 层”…“第 6 层”，层与层之间没有连线，看不出“前置层投入点数”的解锁关系 | C |
| P-03 | 锁定层只是整行变淡，没有锁图标、没有“还差几点解锁” | B |
| P-04 | 专精条“战士专精 · 主专精/未选择”是文字徽标；三系页签写“战士天赋 · 主” | B |
| P-05 | 页头“天赋点 1/1”是文字；下方常驻句“等级与声望奖励提供天赋点。主副专精不同。” | A、F |
| P-06 | 详情区在无消耗、无属性变化时仍显示“条件已满足 / 本次消耗 本次无需消耗资源 / 投入后 角色属性不变” | F |
| P-07 | 服务端天赋描述是拼接的开发文本：`第1层 · 前置层0点 · attack +5%`（直接显示英文属性键） | F（文案缺陷） |
| P-08 | 关键天赋“斩杀 · 关键天赋 0/1”与普通节点同样式 | C |

### 1.2 养成 · 其他模块
`progression-layouts.ts`、`progression-panel.ts`、`progression-challenges.ts`

| ID | 位置 | 现状 | 类型 |
|---|---|---|---|
| P-10 | `paragonBoardHtml` | 节点文字“空雕文插槽”/状态文字；跨盘写“连接：xx” | B、C |
| P-11 | `glyphCardsHtml` | “等级 x/y”、“半径 3 格 · 巅峰盘 1”整行文字 | A、D |
| P-12 | `stageTracksHtml` | 名称后跟 `x/y`，阶段轨道每格都写全文标签 | A、C |
| P-13 | `reputationCardsHtml` | “状态 · 档位 2/5”；奖励档位是一串徽标加“需 N 声望 · 奖励名 数值”句子 | A、B、D |
| P-14 | 通用列表 `progression-entry` | 第二行 `status` 文字（多为 `x/y` 或状态词） | A、B |
| P-15 | 详情 `progression-quote` | “条件已满足/暂不可操作”徽标与按钮可用状态重复 | B |
| P-16 | `renderChallenges` 卡片 | “需要 Lv.20 · 3 阶段 · 今日 1/3 次”；奖励 `e.reward` 是整句文字 | A、D |
| P-17 | 团队大厅 | “2/5 人”、“坦克 1 · 治疗 1 · 输出 3”、成员“名字 · 坦克 · 队长”、“已准备/未准备”徽标 | A、B、D |
| P-18 | 赛季奖励 | “需要 N 进度”、“金币 x · 强化石 y” | A、D |
| P-19 | 最近结果 | “完成 2/3 阶段”、“金币 x · 经验 y · 强化石 z” | A、D |
| P-20 | 噩梦层数 | 数字输入框加“最高 N 层 · 个人最佳 M”说明 | F |

### 1.3 技能
`skills-panel.ts`

| ID | 现状 | 类型 |
|---|---|---|
| S-01 | 卡片状态徽标“技能等级 1/5”“已装配”“可激活”“需角色3级”“需XX ×2” | A、B |
| S-02 | 标题旁 `Lv.1`，详情“Lv.1 / 5 · 已满级” | A |
| S-03 | 等级激活：“角色等级 3 / 5 · 还需提升2级” | A |
| S-04 | 技能书激活：“还缺 N 本”徽标加“来源：xxx”句子 | B、F |
| S-05 | 升级变化 `49 → 55` 是纯文字箭头 | E |
| S-06 | 装配栏空位用全角“＋”加“空技能位”文字；说明句“按装配顺序检查可用技能” | E、F |
| S-07 | 搜索结果句“跨分类结果 N 个” | F |

### 1.4 人物 / 背包 / 装备
`components/CharacterPaperdoll.ts`、`CharacterPanel.ts`、`BagPanel.ts`、`GearCard.ts`、`gear-metadata.ts`、`GearDetails.ts`、`equipment-tip.ts`

| ID | 现状 | 类型 |
|---|---|---|
| G-01 | 部位槽用文字字符 `✓` / `+`；徽标“已装备 · +3”“点击穿戴”“暂无候选” | B、E |
| G-02 | “当前穿戴 3 / 6 部位”；底部“点击部位更换装备” | A、F |
| G-03 | 属性行（生命、攻击、暴击率…）没有属性图标 | — |
| G-04 | 伤害乘区写成 `[+]30%`、`[×]1.2`、“加算池合计 [+]45%，每个 [×] 独立相乘” | D、F |
| G-05 | 增益写成“攻击合剂 · 剩余 N 次击杀” | D |
| G-06 | 背包格子 `★` / `◆` 品质字符、`✓` 已装备字符、“锁定”文字徽标、“3 词缀”文字 | B、E |
| G-07 | 装备容量“18 / 24”与说明句“消耗品与材料按种类、数量计数” | A、F |
| G-08 | “待领取 3”是按钮文字 | D |
| G-09 | 装备卡与 Tips 头部“普通 · 强化 3/15” | A |
| G-10 | 套装“2/4 件”；套装档位行“2 件 … 已激活/未激活”徽标；套装变化“1/4 → 2/4” | A、B |
| G-11 | **装备 Tips 规范（`项目.md` 第 186–189 行）要求左侧属性图标（主属性 24px、词缀 16px、套装 20px、特效 28px），代码里没有实现** | 规范未落地 |
| G-12 | 合剂状态“生效中 · 剩余 N 次真实击杀” | D |

### 1.5 副本（目录、准备、局内 HUD）
`dungeon-controller.ts`

| ID | 现状 | 类型 |
|---|---|---|
| D-01 | 目录卡第二行“实时作战 · 1–4 人”，第三行“可以进入”/原因句 | B、D |
| D-02 | 详情 9 行“标签: 值”（与字号文档 5.8 一起改） | D |
| D-03 | “本期次数 1/3 · 开战扣次” | A |
| D-04 | 救援规则“3 格内 · 5 秒 · 恢复 30% 生命”整句 | D |
| D-05 | 职责下拉框“坦克 · 1”；层级是数字输入框 | D |
| D-06 | 准备界面“普通 · 实时作战 · 2/4 人”；成员“名字 坦克”加状态徽标 | A、B、D |
| D-07 | 局内 HUD 时钟“第 1/3 阶段 · 4:12” | A、C |
| D-08 | 局内目标“击败敌人 3/10 · 精英 0/2”整行文字 | A、D |
| D-09 | 队友血量 `120/300` 文字；名字后缀“ · 掉线”“ · 倒地”；“救援 2.3 秒” | A、B |
| D-10 | 常驻说明“副本持续运行 · 选择队友可治疗或施加护盾” | F |

### 1.6 任务（布局已确认，只做轻改）
`task-panel.ts`

| ID | 现状 | 类型 |
|---|---|---|
| Q-01 | 列表行目标后的 `<em>2/6</em>` | A |
| Q-02 | 任务链箭头用文字 `›`；缺图占位用 `◇`；行尾选中标记用 `›` | E |
| Q-03 | 链节点小字“已入档 · 当前查看” | B |
| Q-04 | 类型选择器底部“滚动或搜索，查找更多任务类型”、头部“N 个类型” | F |

### 1.7 外观
`appearance-panel.ts`

| ID | 现状 | 类型 |
|---|---|---|
| A-01 | 造型卡徽标“已获得/未收集/类型不匹配”加提示句 | B、F |
| A-02 | 顶部徽标“当前动作 · 剑” | D |
| A-03 | 预览控制 6 个纯文字按钮加“切换朝向”“播放/暂停预览”文字按钮 | E |
| A-04 | “本次搭配 · 7 个部位”按钮展开后是 7 行“部位: 名称 · 自动”文字表 | C、D |

### 1.8 远行 / 结算 / 设置 / HUD

| ID | 位置 | 现状 | 类型 |
|---|---|---|---|
| T-01 | `travel-browser.ts` | 分页“1 / 3”文字；“共 N 个地区/探索区域” | A、F |
| T-02 | 同上 | 详情分隔用文字 `◇`；“首领：名字”纯文字 | E |
| T-03 | 同上 | 锁定卡片整句要求文字 `destination-requirement` | B |
| R-01 | `battle-result-panel.ts` | 汇总句“装备 3 件 · 材料 2 种 · 技能书 0 种” | D |
| X-01 | `ui/settings-panel.ts` | 活动半径是数字输入框加“可设置 3–20 格。” | F |
| X-02 | 同上 | 方向键用文字箭头 `↑↓←→` | E |
| H-01 | HUD 任务条 | 布局已确认；只检查进度数字是否随第 3.3 节换成迷你进度条（可选，不改尺寸） | A |

---

## 2. 约束（违反即返工）

1. 继承 `docs/ui-game-feel-typography-plan.md` 第 2 节全部约束（奶白浅金、只改 tokens.json、组件层/页面层分工、已确认布局不改结构、机器负载串行）。
2. **不新增位图美术**。所有新图标用代码绘制的 SVG，风格对齐现有 `task-symbols.ts`：32×32 viewBox，`currentColor` 描边 1.8–2.2，圆角端点，主体加一层 `opacity:.18` 的同色填充（双色调）。不用 emoji，不用 Unicode 字符冒充图标。
3. 已有正式位图优先：装备、道具、技能、地区插画继续用 `ui-assets.ts` 的 `art()` / `skillArt()` / `smallArt()` 与 `travel.json`。
4. 文字不能消失，只能换位置：被图形替代的文字必须进入 `aria-label`、`title` 或详情区，读屏与悬停都能拿到完整信息。
5. 客户端不新增规则计算。点阵/进度条的数值、上限、状态全部来自服务端已有字段；第 5 节列出的新字段一律可选，缺失时退回当前显示，不报错。
6. 按 `项目.md「状态切换与布局稳定」`：图标、点阵、角标在所有状态下占位相同；状态变化只改颜色、填充、透明度，不改尺寸。
7. 动效（可投入节点的呼吸光圈等）在 `prefers-reduced-motion` 或设置“减少镜头与动画效果”开启时改为静态。

---

## 3. 新增 / 扩展公共组件

全部放在 components 层：TS 在 `apps/web/src/ui/`，样式在 `apps/web/src/ui/controls.css`（或新建 `ui/graphics.css` 并在 `ui-entry.css` 以 components 层导入）。若字号文档已新增同名组件（如 `statTilesHtml`、`sectionTitleHtml`），直接复用，不要重复创建。

### 3.1 统一图标库 `ui/icons.ts`
- 导出 `iconHtml(name:IconName,options?:{size?:16|20|24|32;tone?:StatusTone|'inherit';className?:string;label?:string})`。有 `label` 时输出 `role="img" aria-label`，否则 `aria-hidden="true"`。
- 把 `task-symbols.ts` 的 drawings、`travel-browser.ts` 的 `travelIcon` 路径、`ui/currency.ts` 的强化石/经验路径迁入同一注册表；旧函数保留为对 `iconHtml` 的薄包装，调用方逐步迁移，不要求一次改完。
- 需要的图标（名称即 key）：
  - 通用：`lock` `check` `plus` `minus` `chevron-right` `chevron-left` `diamond` `star` `clock` `hourglass` `alert` `info` `chest` `people` `seat` `refresh` `rotate` `play` `pause` `skull`（首领） `swords`（实时作战） `auto`（自动模拟） `book` `compass` `link`
  - 职责：`role-tank`（盾） `role-healer`（十字叶） `role-damage`（剑）
  - 专精：`spec-warrior`（双刃） `spec-mage`（法杖星） `spec-ranger`（弓）
  - 属性（`statIcon(key)` 按 key 取图，未知 key 回退 `diamond`）：`attack` `hp` `armor` `mana` `regen` `speed` `critChance` `critMultiplier` `cdr`（同 `skillCooldown`） `dodge` `lifesteal` `penetration` `executeBonus` `executeThreshold` `skillDamage` `skillCost` `skillRadius` `projectiles` `effectChain`；标签伤害 `physical` `fire` `cold` `lightning` `arcane` `shadow` `poison` `melee` `ranged` `spell` `area` `projectile` `dot`（`xxxDamage` 去掉后缀取图）
- 属性图标颜色：基础属性用 `--color-highlight`，元素伤害用对应语义色（火 danger、冰 info、雷 warning、毒 success；暗影/奥术用 `--color-text-secondary`）。如需新色，在 tokens.json 新增 `Color.Stat.*`，不要写死。
- 在 `/ui-system.html`（`ui-system-showcase.ts`）加一块图标总览，按 16/24/32 三档展示，供验收。

### 3.2 点阵 `pipsHtml`
```ts
pipsHtml(options:{value:number;max:number;label:string;tone?:'gold'|'success'|'info'|'neutral';size?:'sm'|'md';shape?:'dot'|'diamond'|'bar'})
```
- `max ≤ 10`：画 `max` 个点，前 `value` 个填充；`max > 10`：自动改用 3.3 的分段条，每 5 格一条刻度。
- 根元素 `role="meter" aria-valuenow aria-valuemax aria-label="${label} ${value}/${max}"`。
- 尺寸：sm 点 6px、间距 3px；md 点 8px、间距 4px。填充 `--color-highlight`，空点 `--color-border-strong` 描边、无填充。
- 用于：天赋等级、技能等级（5）、套装件数、穿戴部位数（6）、副本阶段、团队人数、挑战次数、声望档位、雕文等级。

### 3.3 进度条 `meterHtml`（替代并扩展 `statusBar`）
```ts
meterHtml(options:{value:number;max:number;label:string;tone?:'gold'|'hp'|'mp'|'success'|'warning';valueText?:'inside'|'end'|'none';ticks?:number[];markers?:{at:number;icon:IconName;state:'learned'|'available'|'locked';label:string}[]})
```
- `statusBar` 改为内部调用 `meterHtml`，HUD 血条外观不变。
- `valueText:'end'` 时右侧显示数字（14/700 Emphasis），`'none'` 时数字只进 aria-label。
- `markers` 用于声望奖励档位、赛季奖励里程碑：按 `at/max` 定位（只是显示位置换算，不是规则计算），在条上方放 20px 图标（宝箱），已领取加 check 角标、可领取加金色光圈。

### 3.4 格子角标 `itemSlot` 扩展
给 `itemSlot` 增加可选 `marks?:{corner:'tl'|'tr'|'bl'|'br';kind:'check'|'lock'|'level'|'count'|'rank'|'order'|'dot';value?:string|number;tone?:StatusTone;label:string}[]`。
- 角标绝对定位、不占布局；直径 18px（数字角标 min-width 18px、圆角胶囊）；`label` 拼进按钮的 aria-label。
- 统一含义：右上 `check` = 已装备/已装配/已投入满；右上 `lock` = 锁定（有等级要求时用 `level` 显示“3”加锁形底）；左下 `rank` = 强化 +N；右下 `count` = 数量；左上 `order` = 装配顺序号。
- 背包的“锁定”（玩家手动上锁）用 `lock` 角标放左上，与条件锁定区分。

### 3.5 节点状态外观 `.ui-node`
- 通用节点（天赋、巅峰、雕文、阶段、技能卡图标）用 `data-state`：
  - `locked`：底 `--color-panel-inset`，图标 `filter:grayscale(1) opacity(.55)`，描边 `--color-border`，右上 `lock` 角标。
  - `available`：底 `--color-panel-raised`，2px 金色外圈 `box-shadow:0 0 0 2px var(--color-primary-border)`，可选 2s 呼吸（遵守第 2 条第 7 款）。
  - `learned`：底 `--color-panel-selected`，描边 `--color-highlight`，图标原色。
  - `maxed`（rank===max）：在 learned 基础上加右上 `check` 角标。
- 选中只加 `--shadow-selected`，不改尺寸。

### 3.6 变化箭头 `deltaHtml`
`deltaHtml(before:string|number,after:string|number,tone:'positive'|'negative'|'neutral')` → `前值（灰） + chevron-right 图标 + 后值（Emphasis/语义色）`。替换所有文字 `→`。若 `statRowHtml` 的 `previousValue` 已能输出同样效果，则让它内部用 `deltaHtml`。

### 3.7 资源条 `rewardStripHtml`
`rewardStripHtml(items:{kind:CurrencyKind|'item';id?:string;amount:number|string;label:string}[],options?:{size?:'sm'|'md'})`：横排 `resourceAmountHtml` 紧凑版；`kind:'item'` 用 `smallArt` 小图加右下数量角标。替换所有“金币 x · 经验 y · 强化石 z”句子。数量为 0 的项不显示。

### 3.8 空槽 `emptySlotHtml`
`emptySlotHtml(options:{label:string;action?:string;id?:string;size?:number})`：虚线描边方槽，中间 `plus` 图标 20px，`--color-text-disabled`；悬停描边变 `--color-primary-border`。替换“＋/空技能位/未装备/暂无候选”。

### 3.9 计时 `timerHtml` 与倒计时环
- `timerHtml(seconds:number,{warnAt?:number})`：`clock` 图标 + `m:ss`，`seconds ≤ warnAt` 时变 warning 色。
- `ringHtml(ratio:number,label:string)`：24px 圆环进度（SVG `stroke-dasharray`），用于救援读条、合剂剩余次数。

### 3.10 分页点 `pageDotsHtml`
`pageDotsHtml(page:number,pages:number,action:string)`：≤7 页画可点圆点，>7 页退回“左右箭头 + 当前页数字”。aria-label “第 N 页，共 M 页”。

### 3.11 帮助图标 `helpHtml`
`helpHtml(text:string)`：16px `info` 图标按钮，`title` 与 `aria-label` 为说明文字，可键盘聚焦。所有常驻说明句（F 类）改用它。

### 3.12 已有组件补参数
- `statRowHtml` 增加 `iconHtml?:string`，在标签左侧放 16/20px 属性图标；`statTilesHtml` 同样支持图标。
- `tabsHtml` 的 item 增加 `iconHtml?:string` 和 `markHtml?:string`（右上小角标，用于“主/副”专精、可操作红点）。
- `statusBadgeHtml` 保留，只用于异常/需要文字的状态（失败、待确认、锁定原因）。

---

## 4. 逐页整改

### 4.1 养成 · 天赋树（P-01～P-08）
文件：`progression-panel.ts`（`talentTreeHtml`、`sectionResources`、`renderProgression`）、`progression-panel.css`、`ui/controls.css`、`packages/rules/deep-progression.ts`、`packages/contracts/deep-progression.ts`

目标结构（自上而下）：
```
[⚔战士 主] [✦法师] [➶游侠]            ◆◆◇ 天赋点 2   ⓘ   [总加成]
┌ 专精徽章（大图标 + 名称 + 主/副角标）────────────────┐
│        力量    耐力    精通    专注    迅捷   ← 列头：属性图标 + 名称，只出现一次
│ ①  ─  [⚔]    [♥]    [◎]    [✧]    [»]    ← 节点：图标 + 点阵，无文字
│ │       ●      ○      ○      ○      ○
│ ②🔒 ─ [⚔]    [♥]    …                   ← 锁定层：锁 + “已投 1/需 2”点阵
│ ⋮
│ ⑥  ─          [ ★ 斩杀 ]                 ← 关键天赋：大六边形节点，显示名称
└──────────────────────────────────────────┘
```
1. **列头**：取第 1 层每个节点 `effects[0].stat`，用 `statIcon` + 短名（节点名去掉“战士·”和罗马数字）。只渲染一次，`position:sticky; top:0`。
2. **节点**：`itemSlot` + `.ui-node`。内容只有 24px 属性图标 + `pipsHtml({value:rank,max,size:'sm'})`。去掉 `<span>名称</span>` 与 `<b>x/y</b>`。完整名称、效果、`rank/max` 放进 aria-label 与 `title`（已有 title，补上 rank）。节点尺寸 56×56，保持 5 列。
3. **层轨道**：每行左侧 28px 圆形层号（只写数字，Caption 13/700），圆与圆之间用 2px 竖线相连。该层已解锁时竖线与圆用 `--color-highlight`，否则 `--color-border`。删除“第 N 层”文字（层号进入行的 `aria-label="第 N 层"`）。
4. **锁定层**：圆内数字换成 `lock` 图标；若节点带 `gate` 字段（第 5 节），在层号下方显示 `pipsHtml({value:gate.current,max:gate.required,size:'sm'})`，title“前置层已投入 x 点，需要 y 点”。无字段时只显示锁。
5. **关键天赋**：最后一层且只有 1 个节点时，渲染 72px 六边形节点（`clip-path`），`star` 角标，节点下显示名称（这是唯一允许在树里显示名称的节点）。
6. **专精徽章**：替换现在的专精文字条。左侧 40px `spec-*` 图标，中间专精名（16/700），右上角主/副角标（圆形 20px，金底写“主”或浅金底写“副”，作为徽记而非句子）。未选择时整个徽章与整棵树 `data-state="locked"` 置灰，详情区只给 primary 按钮“设为主专精/设为副专精”。
7. **三系页签**：`tabsHtml` 用 `iconHtml: iconHtml('spec-warrior')` 等；删除 label 里的“ · 主/ · 副”文字，改用 `markHtml` 角标。
8. **天赋点**：页头用 `iconHtml('diamond')` + 大数字（Value 20/700）显示可用点数；有 `points` 字段时再加 `pipsHtml` 或 `meterHtml` 显示已用/总数。删除 `section.description` 常驻句，内容改为 `helpHtml`。
9. **详情区**：
   - 头部：节点图标 48px + 名称 + `pipsHtml(md)`；删除 `status` 文字行。
   - 效果：`statRowHtml({iconHtml:statIcon(stat),label,value})`，数值 Value 20/700；投入后变化用 `deltaHtml`。
   - 操作可用时**不显示**“条件已满足”徽标；`cost` 全为 0 时**不渲染**“本次消耗”块；属性无变化时**不渲染**“投入后”块（`comparison()` 返回空字符串即可）。不可用时只在按钮下显示服务端 `reason`（Warning 13/500）。
10. **服务端文案（P-07）**：`deep-progression.ts` 天赋 `description` 改为玩家文案：用 `effectLabels` 生成“攻击提高 5%”这类短句；去掉“第N层 · 前置层N点”（层级由图形表达）。不得再出现英文属性键。补一条单测断言 description 不含 `/[a-z]{3,}/`。

### 4.2 养成 · 其他模块（P-10～P-20）
- **巅峰盘**：插槽节点画成空心圆环（`.ui-node--socket`），已镶雕文时圆内放雕文图标加右下 `level` 角标；节点内不写“空雕文插槽”和状态文字。跨盘连接改为盘边缘的 `link` 图标加目标盘编号圆点，title 写完整名称。
- **雕文卡**：名称保留；`x/y` 改 `pipsHtml`；“半径 N 格”改 `iconHtml('skillRadius')` + 数字；“巅峰盘 N”改编号圆点。
- **阶段轨道**：名称后的 `x/y` 删除（轨道本身就是进度）；轨道每格画圆点 + 连线，只在当前格下方显示标签，其余标签进 title。
- **声望**：卡片 = 地区名 + `pipsHtml(档位)` + `meterHtml({markers:奖励档位})`；奖励档位不再列成徽标句子，详情区再列每档奖励（`rewardStripHtml`）和“领取”按钮。
- **通用列表项**：`progression-entry` 第二行 `status`，若条目有 `rank/max` 则改 `pipsHtml`，有 `state` 则用 `.ui-node` 状态外观，二者都没有才保留文字。
- **详情报价**：同 4.1 第 9 条，删除冗余“条件已满足/暂不可操作”徽标。
- **挑战卡**：
  - 元信息行改为图标组：`lock`+“20”（等级要求，满足时不显示）、`pipsHtml(阶段数，shape:'bar')`、`pipsHtml({value:limit-used,max:limit,label:'今日剩余次数'})`。
  - 奖励：有 `rewards` 结构字段（第 5 节）时用 `rewardStripHtml`，否则保留 `e.reward` 文字。
  - 噩梦层数：数字输入框改为步进器（`minus` 按钮 + 大数字 + `plus` 按钮，边界禁用）；“最高 N 层 · 个人最佳 M”改为数字旁两个小标记（`star`+M）。新建共享组件 `stepperHtml`，放 `ui/form-controls.ts`，副本层级也用它。
- **团队大厅**：人数改为 `size` 个座位圆点，已入座的用成员职责图标填充；需求“坦克 1 · 治疗 1 · 输出 3”改为三个职责图标各带数字角标；成员行 = 职责图标 + 名字 + 队长 `star` 角标 + 已准备 `check`（未准备不显示）；职责下拉框改为三个图标分段按钮（`tabsHtml` 紧凑或 `aria-pressed` 按钮组）。
- **赛季奖励**：改为横向里程碑轨道（`meterHtml` + `markers`），每个里程碑点开在详情显示 `rewardStripHtml` 与领取按钮。
- **最近结果**：`pipsHtml(stages/totalStages)` + `timerHtml` + `rewardStripHtml`；词缀用小徽标。

### 4.3 技能（S-01～S-07）——C 方案布局不变
- 卡片：图标加角标（3.4）：已装配 = 右上 `check` + 左上装配序号 `order`；锁定 = 右上 `level` 锁形角标写所需等级，或技能书图标角标写“×2”；可激活 = 图标金色外圈（3.5 available）。卡片内删除状态徽标，只保留“主手不匹配”这类异常 warning 文字。
- 等级：标题旁 `Lv.1` 改为 `pipsHtml({value:rank,max:5,size:'sm'})`；详情头部同样用 md 点阵，满级时点阵全金并加 `check`。
- 等级激活：`meterHtml({value:current,max:required,valueText:'end',label:'角色等级'})`，未达成时条用 warning 色，删除“还需提升N级”。
- 技能书激活：书图标 + “持有/需要”大数字（`resourceCostHtml` 已有可复用），删除“还缺 N 本”徽标；“来源：xxx”改为 `helpHtml` 或链接按钮。
- 升级变化：`deltaHtml`。
- 装配栏：空位用 `emptySlotHtml`；序号保留为左上 `order` 角标；删除“按装配顺序检查可用技能”，改 `helpHtml`。
- 分类页签计数 `2/9` 保留（页签计数允许）。

### 4.4 人物 / 背包 / 装备（G-01～G-12）——人物布局与竖版 Tips 不变
- 人物部位槽：`✓`/`+` 字符改为 3.4 角标；已穿戴且强化时左下 `rank` 角标“+3”；空槽用 `emptySlotHtml` 风格的虚线框加部位剪影（现有占位图 `gear-standard-sword-t1-<part>` 降到 30% 透明度）；删除“已装备/点击穿戴/暂无候选”徽标，有候选时右上 `count` 角标显示数量。
- “当前穿戴 3 / 6 部位”改为 `pipsHtml({value:3,max:6})`；删除“点击部位更换装备”。
- 属性：所有 `statRowHtml` 加 `iconHtml:statIcon(key)`；顶部生命/攻击/护甲三块加 24px 图标。
- 伤害乘区：加算项渲染为带 `plus` 图标的浅金胶囊（标签 + 百分比），乘算项渲染为带 `×` 图标（新增 `multiply` 图标）的浅蓝胶囊；顶部用一条横向堆叠条显示加算池构成（各段宽度 = 各项值 / 合计，仅为显示换算）。删除“加算池合计…独立相乘”说明句，改 `helpHtml`。
- 增益：合剂图标 + `ringHtml` + 剩余次数数字，title 写完整说明。
- 背包格子：`★`/`◆` 字符删除，品质由字号文档 4.8 的边框加角标表达；`✓` 改 `check` 角标；“锁定”改左上 `lock` 角标；“3 词缀”改为底部 3 个小圆点（`pipsHtml({value:n,max:n,size:'sm'})`，tone 按最高 Tier）。
- 容量：`meterHtml({value:gear.length,max:capacity,valueText:'end'})`，满时 danger 色；删除说明句。
- 待领取：`chest` 图标按钮 + 右上红色数字角标；数量 0 时不显示角标。
- 装备卡/Tips 头部“强化 3/15”：`pipsHtml({value:rank,max:15})`（>10 自动变分段条）放在名称下方，数字进 title。
- 套装：标题旁 `pipsHtml(count/total)`；档位行左侧用 2/4/6 件的圆点组，已激活点亮、未激活空心，删除“已激活/未激活”徽标；套装变化用 `deltaHtml` 包裹两组点阵。
- **G-11 落实 Tips 规范**：`equipment-tip.ts`、`ui/item-tip.ts` 按 `项目.md` 第 186–189 行加左侧图标：主属性 24px `statIcon(primary_attribute)`、词缀 16px `statIcon(affix.stat)`、套装 20px `iconHtml('link')`、特效 28px。Tier 文字（T1/T2/T3）按规范保留在最右侧。
- 合剂详情“生效中 · 剩余 N 次真实击杀”改 `ringHtml` + 数字。

### 4.5 副本（D-01～D-10）——与字号文档 5.8 合并执行
- 目录卡：左侧地区缩略图；第二行改为图标组：`swords`/`auto` 模式图标 + `people` 图标“1–4”；状态用右上角标（可进入不显示，未开放用 `lock`，原因进 title 和详情）。
- 详情：
  - 关键信息用 `statTilesHtml` 加图标：准入等级（`lock` 或 `star`）、战斗时限（`clock`）、本期次数（`pipsHtml` 剩余次数，“开战扣次/通关扣次”进 title）。
  - 规则区（字号文档要求收起到“详细规则”）每行加图标：断线 `link`、构筑锁定 `lock`、救援 `role-healer`。救援写成三个“图标 + 数字”小块：`skillRadius` 3 格、`clock` 5 秒、`hp` 30%。
  - 职责下拉框改为三个职责图标分段按钮（同 4.2 团队大厅），数字角标为名额。
  - 层级数字输入改 `stepperHtml`。
- 准备界面：标题下用 `pipsHtml` 显示人数座位；成员行 = 职责图标 + 名字 + 状态图标（已准备 `check`、未连接 `alert`、保留席位 `hourglass`），文字状态进 title。
- 局内 HUD：
  - 时钟：`pipsHtml({value:stage+1,max:totalStages,shape:'bar'})` + `timerHtml(remaining,{warnAt:30})`。
  - 目标：每个目标一行“目标图标 + 迷你 `meterHtml(valueText:'end')`”，首领目标用 `skull`。
  - 队友：名字按钮下加 `meterHtml({tone:'hp',valueText:'none'})`；掉线/倒地用名字前的 `alert`/`skull` 图标代替文字后缀；救援读条用 `ringHtml`。
  - 删除常驻说明句，改 `helpHtml`。

### 4.6 任务（Q-01～Q-04）——布局不变
- 列表行 `2/6` 改为目标文字下方 3px 高的迷你 `meterHtml({valueText:'none'})`，数字进 aria-label；总数为 1 的目标不显示条。
- 链箭头 `›`、缺图 `◇`、行尾 `›` 全部改 `iconHtml('chevron-right')`/`symbol('diamond')`。
- 链节点小字“已入档 · 当前查看”删除，用节点状态图标（已有 `chain-mark`）加选中描边表达。
- 类型选择器删除底部提示句和“N 个类型”。

### 4.7 外观（A-01～A-04）
- 造型卡：删除“已获得”徽标与“选择后可预览搭配。”；未收集用 `.ui-node[data-state=locked]` 加右上 `lock`，获取途径进 title；类型不匹配用右上 `alert` 角标（warning），原因进 title。
- “当前动作 · 剑”改为武器谱系图标 + 名称的小块（谱系图标复用 `art('gear-…')` 的武器小图或新增 `weapon-*` SVG，择一并在文档记录）。
- 预览控制：6 个动作按钮改为 `size:'icon'` 图标按钮（待机 `pause`、奔跑 `speed`、攻击 `attack`、施法 `spell`、受击 `alert`、倒下 `skull`），`title` 为动作名；“切换朝向”用 `rotate`，“播放/暂停预览”用现有 `hudIcon('play'|'pause')`。
- 本次搭配：按钮下常驻一条 7 格缩略图（`partThumbnail` 小图 32px），“自动”部位右下加 `auto` 小角标；点击缩略图跳到对应部位页签。删除展开式文字表。

### 4.8 远行 / 结算 / 设置
- 远行：分页改 `pageDotsHtml`；删除“共 N 个地区/探索区域”和“首领胜利后开放下一段旅程”（字号文档已要求）；详情分隔 `◇` 改 SVG 菱形分隔；“首领：名字”改为 `skull` 图标 + 名字；锁定卡片的要求句改为右上 `lock` 角标 + 一行短要求（服务端文字原样，最多 1 行省略），完整句进 title。
- 结算：删除“装备 3 件 · 材料 2 种 · 技能书 0 种”汇总句，战利品网格已经表达；资源行已是图标数字，保持。
- 设置：活动半径改 `rangeFieldHtml`（3–20，步长 1，值标签“8 格”），删除“可设置 3–20 格。”；方向键 `↑↓←→` 改为键帽内 `chevron` 图标（键帽样式见字号文档 5.10）；`settings-note` 段落改 `helpHtml`，“低生命时仍会继续战斗”这类风险提示保留为 warning 文字。

---

## 5. 服务端 / 契约补充（全部可选字段）

在 `packages/contracts/deep-progression.ts` 与 `packages/rules/deep-progression.ts`：

| 字段 | 位置 | 内容 | 用途 |
|---|---|---|---|
| `gate?:{required:count;current:count}` | `progressionItemSchema` | 天赋节点所在层的前置投入要求与当前已投入（服务端已有 `t.required` 与 prior 计算） | 4.1 锁定层点阵 |
| `points?:{available:count;total:count}` | `progressionViewSchema` 内 `sections` 的元素对象（天赋 section；若需要可先抽出 `progressionSectionSchema`） | 可用/总天赋点（服务端已有 `talentPoints`、`talentUsed`） | 4.1 天赋点显示 |
| 天赋 `description` | rules 文案 | 用 `effectLabels` 生成玩家文案，去掉英文键与层级信息 | P-07 |

在 `packages/contracts/progression-challenges.ts`：

| 字段 | 内容 | 用途 |
|---|---|---|
| `entries[].rewards?:{kind:'gold'|'xp'|'material'|'item';id?:string;amount:count}[]` | 结构化奖励，保留原 `reward` 字符串 | 挑战卡 `rewardStripHtml` |

要求：`.strict()` 保持；旧数据无字段时前端退回现有显示；新增单测覆盖“有字段/无字段”两种渲染；不改变任何校验和数值。

---

## 6. 保留为文字的内容（不要过度图形化）

- 窗口标题、分区标题、条目名称（装备名、技能名、任务名、地区名）。
- 详情区的描述正文、剧情文字、技能效果说明。
- 服务端给出的**不可执行原因**、错误、待确认提示（用 Warning/Danger 文字，可配图标）。
- 装备 Tips 中的 Tier（T1/T2/T3）和数值（规范要求）。
- 页签计数（如技能分类 `2/9`、任务数量）。
- 资源数量、伤害数字、属性数值本身（数字是信息，不是装饰）。
- 确认对话框中的风险说明。

---

## 7. 执行顺序与提交粒度

0. 确认 `docs/ui-game-feel-typography-plan.md` 的第 1、2 步（Token、公共组件）已完成；未完成先做那两步。
1. 图标库 `ui/icons.ts`（3.1）+ 展示页图标总览。旧 `symbol`/`travelIcon`/`currencyIconHtml` 改为包装。
2. 公共组件：`pipsHtml` → `meterHtml`（statusBar 内部改用）→ `itemSlot` 角标 → `.ui-node` → `deltaHtml` → `rewardStripHtml` → `emptySlotHtml` → `timerHtml`/`ringHtml` → `pageDotsHtml` → `helpHtml` → `stepperHtml` → `statRowHtml`/`tabsHtml` 参数。每个组件在展示页加示例，并补 `tests/` 单测（输出含 aria、max>10 切换分段条、0 值隐藏等）。
3. 契约与服务端（第 5 节）+ 单测。
4. 页面（与字号文档同窗口合并提交）：养成天赋树 → 养成其他模块 → 技能 → 人物/背包/Tips → 副本（含 HUD）→ 外观 → 任务 → 远行/结算/设置。
5. 文档：`docs/ui-design-system.md` 增加“图形表达规则”（第 0 节表格 + 第 6 节保留清单 + 组件清单）；`docs/ui-system-progress.md` 记录完成项。

每步单独提交，说明写清改了哪些组件/页面、对应本文 ID。

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
新增组件与契约字段的单测一并运行。相关 `tools/accept-*.mjs` 按需串行；脚本断言旧文字（如“技能等级 1/5”“空技能位”）时改为断言新结构（`[role=meter]`、角标 aria-label），并在提交说明中写明原因，不得删除检查。

### 8.2 文字图形化量化（每个窗口都要测）
在 `http://127.0.0.1:8612/` 打开窗口后，在控制台运行：

```js
(()=>{const root=document.querySelector('#modal .panel')||document.querySelector('#modal');const cells='.slot,.lib-card,.dungeon-card,.task-list-row,.challenge-card,.destination-card,.appearance-card,.progression-entry,.ui-progression-node';const fraction=/\d+\s*\/\s*\d+/,glyph=/[✓✔＋›‹◇◆★☆↑↓←→•]/,tierWord=/第\s*\d+\s*(层|阶段)/;const out={fractionInCells:[],glyphs:[],tierWords:[],longCaptions:0};const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let t;while(t=w.nextNode()){const s=t.textContent.trim();if(!s)continue;const el=t.parentElement;if(!el.getBoundingClientRect().width||el.closest('[aria-hidden="true"],.ui-badge--danger,.ui-tabs'))continue;if(fraction.test(s)&&el.closest(cells))out.fractionInCells.push(s);if(glyph.test(s))out.glyphs.push(s);if(tierWord.test(s))out.tierWords.push(s);if(s.length>18&&el.closest(cells)&&parseFloat(getComputedStyle(el).fontSize)<=13)out.longCaptions++;}const meters=root.querySelectorAll('[role=meter]').length,svgIcons=root.querySelectorAll('svg').length;return {...out,meters,svgIcons};})()
```

通过标准：
- `fractionInCells`：0（列表/格子里不再出现 `x/y` 文字）
- `glyphs`：0（不再用文字字符当图标；按键名“左 Shift”等不含这些字符）
- `tierWords`：0（天赋树、副本 HUD 不再写“第 N 层/阶段”）
- `longCaptions`：每窗口 ≤ 3（格子里 ≤13px 且超过 18 字的说明句）
- 天赋树、技能、副本详情、人物三窗口 `meters ≥ 1`
- 测量窗口：背包、人物、技能、养成（天赋/巅峰/声望/挑战各一次）、外观、任务、副本目录、副本准备、远行、设置；副本 HUD 在一次实际副本中对 `#dungeon-hud` 执行同样脚本（把 root 改成 `document.querySelector('#dungeon-hud')`）

### 8.3 读屏与悬停检查
- 随机抽每个窗口 3 个被图形化的元素，确认 aria-label 或 title 能读到原来的完整信息（例如天赋节点读出“战士·力量Ⅰ，1/1，已投入，攻击提高 5%”）。
- 键盘 Tab 能聚焦 `helpHtml` 图标并显示说明。

### 8.4 视觉检查（真实浏览器）
- 1280×720、1024×768、375×812 各截图，角标不被裁切、点阵不换行溢出、六边形关键天赋不遮挡相邻节点。
- 天赋树：新角色（未选专精，整树置灰，只有“设为主专精”）、选专精后（第 1 层金色光圈）、投满第 1 层后（第 2 层解锁、竖线点亮）三种状态各截图。
- 按 `项目.md「状态切换与布局稳定」`：连续切换节点、技能卡、背包格子、页签，确认角标和点阵不改变格子尺寸、不跳动。
- 开启“减少镜头与动画效果”后，可投入节点不再呼吸闪烁。
- 新角色与老角色各登录一次，确认无字段缺失报错（第 5 节字段缺失时退回旧显示）。
- 结束后浏览器视口恢复 desktop。

### 8.5 交付说明需要包含
- 每个窗口改前/改后的 8.2 量化结果表。
- 1280×720 改前/改后截图路径（至少：天赋树、技能、人物、背包、副本详情、副本 HUD）。
- 图标总览截图（展示页）。
- 未完成项与原因（尤其是第 5 节服务端字段若未加，前端处于哪种退回显示）。
