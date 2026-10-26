# 工坊与装备流程 UX 修复（Claude → GPT，2026-10-25）

## 背景

v0.11.57 用测试账号 `ux_flow_1025` 走了一遍：创建角色 → 背包选装备 → 替换 → 人物并排比较 → 返回背包 → 材料页前往工坊 → 尝试强化 → 返回港口。发现 6 条问题（2 高 4 中）。强化成功分支没验证到，因为新角色金币和强化石都是 0。

本文给出每条的原因、改法和验收。**只改前端表现和交互；F3 允许在服务端快照里补字段，其余不改接口、规则和数值。**

## F1（高）内层「关闭部位强化」点了没反应

- 原因：`apps/web/src/hub/slot-upgrade-panel.ts` 在工坊面板里又套了一层完整的 `<section class="panel">`，自带 `panelHeaderHtml('部位强化',{closeLabel:'关闭部位强化',closeAction:'slot-upgrade-close'})`。`main.ts` 里没有处理 `slot-upgrade-close`。
- 改法：去掉内层的 section 外壳和 panelHeader，部位强化作为工坊面板正文渲染，只保留外层工坊面板的关闭按钮。一屏只留一个 ×，不补处理函数。
- 验收：单测断言部位强化 HTML 不含 `slot-upgrade-close`，也不含嵌套的 `class="panel`。

## F2（高）资源为 0 时「强化」仍可点、仍高亮

- 原因：`canUpgrade = !blocked && s.cost !== null`，没比较玩家资源；函数收了 `snapshot` 参数却没用。
- 改法：
  - 从 `snapshot` 取金币和强化石（字段以快照实际为准），和 `cost.gold`、`cost.material` 对比，算出缺口。
  - 缺资源时，按钮改为 secondary 并 `disabled`，文案写缺口，如「缺 120 金币」「缺 3 强化石」；两种都缺就写差得多的那种，另一种在消耗行里标红。
  - 消耗行常驻显示「需要 / 持有」，不够的数字用 tokens 里的危险色（没有就先进 `tokens.json`），下面常驻一行来源提示：金币 → 通关节点；强化石 → 分解装备、节点掉落（按现有掉落配置写，查不到就写「通关节点」）。
  - primary 只给第一个**买得起**的部位；全都买不起时整屏没有 primary。
  - 原来的 `block`（未穿装备、已满级、品质上限）优先级高于缺资源，文案不变。
- 验收：单测覆盖三种情况：资源为 0、刚好够、只缺一种。断言按钮的 disabled 状态、primary 与否、缺口文案和来源行。

## F3（中）人物并排比较缺主属性，候选缺 ▲▼

- 原因（推测，**先验证**）：`apps/web/src/components/CharacterPanel.ts` 的 `gearMainStat` → `mainStatValues(g)`（`packages/rules/main-stat-values.ts`），`g.mainStat` 缺失就返回 undefined，于是 `wornCard` 不显示主属性，`candidateDelta` 不出差值。怀疑快照里的装备没带 `mainStat`。
- 第一步：用本地服务新建角色，或直接读 PG，看快照 `equipment` 和背包装备对象上有没有 `mainStat`。把结论写进进度文件。
- 改法：
  - **缺字段**：在服务端组装快照时补上 `mainStat`，从装备实例或模板推出，与 `/gear/:id/tip` 同源。这是本批唯一允许的后端改动。contracts 里类型已有该字段就不动；没有就加成可选字段。
  - **有字段但取不到**：修前端的取值路径。
  - 不要用异步 tip 接口兜底，并排比较要一次渲染完成。
- 验收：
  - 单测：穿戴卡显示主属性名和数值；候选卡显示 ▲ 或 ▼ 和差值；主属性不同类时显示「主属性不同」，不出箭头。
  - 有后端改动的，补一个 PG 或 api 测试，断言快照装备带 `mainStat`。

## F4（中）「装备后」变化在首屏下方

- 原因：`apps/web/src/components/GearDetails.ts` 先渲染词缀，后渲染「装备后」比较区。
- 改法：顺序改为 名称/品质 → 主属性 → 「装备后」变化 → 替换按钮 → 词缀 → 其余。变化区只列有变动的属性，最多 4 行，其余折成「+N 项」，点开再展开（纯前端展开，不新增接口）。主属性还在读取时，变化区显示占位行，不跳动布局。
- 验收：1280×720 下不滚动，能同时看到变化区和替换按钮。单测断言 HTML 中变化区在词缀之前、替换按钮在词缀之前。

## F5（中）装备详情没有去工坊的按钮

- 原因：`apps/web/src/components/BagPanel.ts` 只给材料详情加了 `buttonHtml('前往工坊',{action:'bag-workshop'})`，装备详情里只有一句文字。
- 改法：装备详情（已穿戴和背包里的都算）加 secondary 按钮「去工坊强化」，复用 `bag-workshop` action（`main.ts` 里的 `goWorkshop()`），不新增 action。按钮带 `data-slot=<部位>`，`goWorkshop` 接收可选的部位参数，到工坊后打开「强化」页签并选中该部位。原来那句文字删掉。
- 验收：
  - 单测：装备详情 HTML 含 `bag-workshop` 按钮和正确的 `data-slot`。
  - 内置浏览器自查：点按钮后到工坊，选中的是对应部位。

## F6（中）工坊右侧大片留白，左侧部位列表显示不全；没有重铸入口

- 原因：
  - `apps/web/src/hub/slot-upgrade-panel.css` 写死了 `.slot-upgrade-panel{width:640px;...overflow:hidden}`。
  - `apps/web/src/presentation.ts` 工坊分支在 `craft.tab==='upgrade' && view.slotsView` 时只渲染部位强化，重铸面板（ForgePanel）进不去。
- 改法：
  - **布局**：去掉固定宽度和 `overflow:hidden`，改两列，占满工坊面板正文。
    - 左列约 280px：6 个部位的列表，每行显示部位名、装备名、+等级，加一个能强化/缺资源/已满的小状态，用 `statusBadgeHtml`。内容超出时只让左列滚动。
    - 右列：选中部位的详情，包括当前和下一级的属性变化、消耗行（含 F2 缺口）、唯一的强化按钮。
    - 默认选中 F5 传入的部位，否则选第一个能强化的，都没有就选第一个。部位切换在前端完成，记在面板状态里。
  - **页签**：`apps/web/src/crafting-model.ts` 的 craftTabs 把「强化·重铸」拆成「强化」和「重铸」两个页签。「强化」走部位强化，「重铸」走现有 ForgePanel。presentation 按页签分开渲染，不再由 `slotsView` 决定。
- 验收：
  - 1280×720 下 6 个部位全部可见，或左列可以滚动到全部；面板不超出舞台。
  - 两个页签都能进入各自面板，重铸的原有功能不变。
  - 单测断言页签含「强化」「重铸」，并分别渲染对应面板。

## 强化成功分支

- 加 PG 测试：给角色发足够的金币和强化石，强化一个已穿戴部位一次。断言等级 +1、资源按 cost 扣减、刷新后的部位视图给出下一级消耗。资源刚好用完后，再看部位视图进入 F2 的缺资源状态。
- 云测试服真机：给 `ux_flow_1025` 补够强化 3 次的金币和强化石（走现有 GM/后台方式，没有就直接改该测试角色的数据，先备份），交 Grok 走成功分支。

## 默认裁决（直接采用，不回来问）

- 复用 `tokens.json`、`controls.css`、`buttonHtml`、`tabsHtml`、`panelHeaderHtml`、`statusBadgeHtml`、`resourceAmountHtml`。新颜色和尺寸先进 tokens 再生成，CSS 不写十六进制字面量。
- 每屏只一个 primary；面板不超出 1280×720 舞台；正文最小 14px，塞不下就滚动，不缩字号。
- 强化消耗、成功率、上限等数值和规则一律不动。
- 规则没覆盖的边角，选对玩家更直观、更少点击的处理，记进进度文件（问题｜处理｜依据）。要改信息结构或接口的（F3 的快照字段除外），记「待 Claude」并跳过。

## 测试

- 每步跑：`node tools/build-ui-tokens.mjs --check`、全仓 `npx tsc --noEmit -p .`、相关单测（`npx vitest run <files> --maxWorkers=1 --no-file-parallelism`）。重任务一次一个。
- 新单测放在 `tests/forge-gear-ux.test.ts`。已有的工坊、背包、人物面板测试因结构变化失败的，改成新口径的断言。
- 静态验收页 `apps/web/src/hub/hub-review.ts` 加工坊样例：资源为 0、刚好够、部位已满、重铸页签，供 Claude 审阅。

## 约束

- 禁无头浏览器、Playwright 探针和自动化脚本。可以用 agent 内置浏览器（非无头 GUI）对本地服务短时自查：新角色走一遍 背包 → 装备详情去工坊 → 强化缺资源提示 → 重铸页签 → 关闭，再看控制台。一次一个，保持简短；没做过 GUI 自查就不要写成实机通过。完整真机验收发云测试服交 Grok。
- 只按明确路径提交本任务文件，不碰工作区里其他会话的未提交改动。`main.ts` 等共享文件只暂存自己的 hunk。
- 不提交图片、截图、原始明细、构建产物。
- 云测试服口令只在 `G:\webgame\aw-deploy\staging-credentials.txt`，不得写进报告、日志、提交或链接。不清库；只允许改 `ux_flow_1025` 这个测试角色的资源，先备份。
