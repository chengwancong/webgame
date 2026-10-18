# 养成界面优化执行文档

> 日期：2026-10-05　范围：`open-world`　状态：待执行
> 按阶段顺序执行；每阶段完成后通过“验收”再进入下一阶段。

## 0. 必守约束

- 只用 `packages/ui-tokens/tokens.json` 的 token 与 `apps/web/src/ui-components.ts`、`apps/web/src/ui/` 共享组件，不新建平行皮肤。
- CSS 层级：页面样式（`progression-panel.css`）在 legacy 层，不能覆盖 `.ui-*` 组件的 color/font-size/font-weight/display；需要新外观时在 `apps/web/src/ui/controls.css` 加组件变体，或使用组件 CSS 变量。
- `buttonHtml` 的 attributes 只允许 `aria-*`、`data-*`、`id`、`name`、`tabindex`、`title`；隐藏按钮用 `data-ui-hidden`。
- 服务端负责所有计算与校验；客户端不解析描述文字、不复制公式或解锁条件。剧情锁定入口继续走 `apps/web/src/story-gates.ts`。
- 新契约字段一律可选，缺失时前端退回当前列表展示。
- 机器负载：tsc、vitest、浏览器验收串行执行，不并行。
- 每阶段结束必须在真实浏览器（`http://127.0.0.1:8612/`）验证。

## 1. 涉及文件

| 文件 | 作用 |
|---|---|
| `packages/contracts/deep-progression.ts` | `progressionItemSchema` / `progressionOperationSchema` |
| `packages/rules/deep-progression.ts` | 服务端组装各 section（天赋约第 197 行起） |
| `apps/web/src/progression-panel.ts` | 养成面板渲染、`progressionGroups`、`visibleProgressionGroups` |
| `apps/web/src/progression-controller.ts` | 选中项、操作、报价（`preview()`） |
| `apps/web/src/progression-panel.css` | 页面样式（legacy 层） |
| `apps/web/src/ui/controls.css` | 组件变体（components 层） |
| `apps/web/src/main.ts` | `progression-group` / `bag-progression` 等动作与键盘导航 |
| `apps/web/src/presentation.ts` | `renderProgression(...)` 调用处 |
| `tests/progression-ui-system.test.ts`、`tests/story-gates-ui.test.ts` | 回归测试 |

## 2. 阶段一：通用改造（所有模块受益）

### 2.1 操作按钮替换“本次操作”下拉框
- 删除 `progression-panel.ts` 中 `<select id="progression-operation" data-progression-operation>`。
- 详情区底部渲染 `item.operations`：
  - 第一个 `enabled` 的操作为 primary 按钮；其余为 secondary；全部不可用时第一个操作为 primary 但禁用。
  - 每个按钮 `action:'progression-run'`、`id:operation.id`；禁用按钮下方一行 `ui-caption` 显示 `operation.reason`。
  - 重置类操作（`talent.reset` 等）放入次级区并要求二次确认（复用现有 confirm 流程）。
- `progression-controller.ts`：`progression-run` 先把 `ui.operation` 设为该 id，再走现有确认校验（revision、报价一致性不变）。

### 2.2 报价只为可执行操作拉取
- `preview()`：选中操作 `enabled===false` 时不请求 `progression/preview`，`ui.preview=undefined`、`previewLoading=false`。
- 渲染：不可执行时不显示“报价尚未就绪 / 重新核对”，只显示原因；可执行且报价返回后显示属性变化。
- 属性变化改用 `statRowHtml({...,previousValue,valueTone,className:'ui-stat--delta'})`，只列 delta≠0 的行；全为 0 时显示“角色属性不变”。

### 2.3 页头只显示相关资源
- 删除 `progression-overview` 中固定的“金币 · 强化石”。
- 资源来源：当前 section 所有 operations 的 `cost`（gold/material/items 中 >0 的 id）→ 在 `view.currencies` 中取名称和数量显示。
- 天赋 section 显示“天赋点 x / y”：取 `view.summary` 中服务端提供的项；若无对应项，在服务端 summary 增加 `{name:'天赋点',value:'1/1'}`，前端不计算。
- 数字使用 `num` 类、`--font-size-h2`。

### 2.4 底部加成条改为浮层
- 移除详情底部的全局加成行（普通攻刃、方阵攻击……）。
- 页头加 secondary 按钮“总加成”，点击打开共享浮层组件，列出 `view.summary`；术语改为玩家可读名称（名称由服务端 summary 提供，必要时在 `packages/rules/deep-progression.ts` 调整文案）。

### 2.5 “刷新信息”只在出错时出现
- 常驻的“刷新信息”按钮删除；`ui.error` 存在时由 `stateBlockHtml` 的 action 提供“重新读取”。

### 2.6 左侧竖排分类导航
- 养成分组页签改为左侧竖排（仍用 `tabsHtml`，加 `orientation` 或组件变体 `ui-tabs--vertical`，样式加在 `ui/controls.css`）。
- `main.ts` 键盘导航：竖排时支持 ArrowUp/ArrowDown，保留 Home/End。
- 有可执行操作的分组显示提示点：判断依据为该分组任一 operation `enabled===true`（服务端已算好）。
- ≤760px 时退回横排可滚动页签。

### 阶段一验收
- [ ] 详情区没有下拉框；不可执行操作只显示原因，不出现“报价尚未就绪”。
- [ ] 可执行操作自动显示“投入后”属性变化，只列有变化的属性。
- [ ] 天赋页头显示天赋点，不显示金币/强化石；锻造类页面仍显示金币/强化石。
- [ ] 底部加成条消失，“总加成”浮层可打开、可 Esc 关闭、焦点回到按钮。
- [ ] 左侧导航键盘可用；1024px 与 375px 下无溢出。
- [ ] `npx tsc --noEmit -p .` 通过；`npx vitest run tests/progression-ui-system.test.ts tests/story-gates-ui.test.ts` 通过。

## 3. 阶段二：天赋树

### 3.1 契约（可选字段）
在 `packages/contracts/deep-progression.ts` 的 `progressionItemSchema` 增加：
```ts
state: z.enum(['learned','available','locked']).optional(),
rank: count.optional(),
max: count.optional(),
tier: count.optional(),
requires: z.array(key).optional(),
effects: z.array(z.object({stat:key,label:z.string(),value:z.number()})).optional(),
```
保持 `.strict()`；旧数据无这些字段时仍通过校验。

### 3.2 服务端
- `packages/rules/deep-progression.ts` 天赋 section：为每个天赋填 `state/rank/max/tier/effects`，`state` 由服务端按专精、前置层点数、剩余点数计算。
- 专精条目（`spec-*`）增加 `state`：已选为主/副时 `learned`，可选时 `available`。
- 不改变 `talent.learn` / `specialization.set` / `talent.reset` 的校验逻辑。
- 补单测：新角色、已选专精、点满前置、点数用尽四种状态。

### 3.3 前端
- `progression-panel.ts` 新增 `talentTreeHtml(section)`：当 section 内条目都有 `tier` 时渲染树，否则走原列表。
  - 顶部三系切换（沿用 section 页签），标注“主”“副”。
  - 按 `tier` 分行、每行 5 列；关键天赋（tier 最大且单个）整行显示。
  - 节点用 `itemSlot`，`data-state` 映射样式：learned=成功色边框、available=警示色底、locked=弱化。
  - 节点文字：短名 + `rank/max`；完整名称与效果放 `title` 与详情。
- 未选专精：树整体 locked 预览；右侧只显示专精说明和 primary 按钮“设为主专精”；已有主专精时显示“设为副专精”。
- 详情区：效果数值使用 `--font-size-h2` 强调；“投入 1 点”为 primary。

### 阶段二验收
- [ ] 新角色进入天赋：树为灰色预览，只有“设为主专精”。
- [ ] 选专精后第 1 层可投点节点高亮；投点后节点变已点，天赋点数同步减少。
- [ ] 前置不足节点不可选为 primary 操作，原因来自服务端。
- [ ] 老存档（无新字段）退回列表展示且可正常操作。
- [ ] tsc、相关 vitest、服务端单测通过；浏览器中新角色与老角色各验证一次。

## 4. 阶段三：其他模块专属布局

| 模块 | 布局 | 服务端需补字段 |
|---|---|---|
| 巅峰盘 `paragon` | 节点连线盘面，插槽显示已镶雕文 | `state`、`requires`、位置坐标 `x/y`（服务端或内容表提供） |
| 雕文 `glyphs` | 卡片网格：等级、半径、对应盘 | `rank/max`、`state` |
| 突破 / 觉醒 `character`、`skill-awakening` | 阶段进度轨道 | `rank/max`、下一阶段需求（cost 已有） |
| 区域声望 `reputation` | 每区域进度条 + 档位奖励 | `rank/max`、当前值/下一档值 |

每个模块单独提交、单独验收；字段缺失时退回列表。

## 5. 文档与收尾
- 更新 `docs/hybrid-implementation.md`（或新建 `docs/progression-ui.md`）记录：新字段含义、回退规则、组件变体名。
- 浏览器验收结束后把视口恢复为 desktop。
- 在本文件顶部把状态改为“已完成阶段 N”。

## 6. 执行命令（串行）
```bash
npx tsc --noEmit -p .
npx vitest run tests/progression-ui-system.test.ts tests/story-gates-ui.test.ts
node tools/build-ui-tokens.mjs --check
npm run service:status
```
