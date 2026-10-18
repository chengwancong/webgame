# 全局 UI Design System

这是当前游戏全部UI共用的设计系统。0.7.3已完成页面接入与真实流程验收；工作台展示不单独作为交付证据。总范围和验证记录见 [进度矩阵](ui-system-progress.md)。

## 唯一来源

`packages/ui-tokens/tokens.json` 是颜色、文字、间距、尺寸、圆角、描边、动效、层级、阴影和材质的源文件。`tools/build-ui-tokens.mjs` 生成 `apps/web/src/ui/tokens.css` 与 `tokens.ts`。禁止直接改生成文件；`pnpm ui:tokens:check` 和 QA 会检查源与生成结果一致。

同一语义只使用一个 Token。`Color.Primary`为主要确认／保存操作，`Color.Secondary`为次操作，`Color.Highlight`用于选择与键盘焦点。资源、品质、任务类别和生命周期状态分别有自己的语义，不能用任务颜色推断可操作性。稀有度中的Epic仅预留配色，不新增游戏品质或物品规则。

2026-10-03起默认主题采用用户确认的 4「奶白浅金」现代明亮卡通冒险风格，规范见项目根目录 `项目.md`。提供浅色Token作组件检验，游戏未增加主题开关，系统浅色偏好不会改变当前游戏画风。普通文字与操作文字在各自背景的对比度由 `tests/ui-tokens.test.ts` 检查；禁用状态以明确灰色和原生disabled表达。

## 字体

统一WorldSans／Noto Sans SC。实际字体是100–900的可变字体，`@font-face`已声明范围并关闭合成字重。数字使用tabular-nums，不另换字体。

| 层级 | Token | 字号／字重 | 用途 |
| --- | --- | --- | --- |
| Display | Font.Size.Display | 32／700 | 核心大数值，每窗口最多一个 |
| H1 | Font.Size.H1 | 28／700 | 窗口标题 |
| H2 | Font.Size.H2 | 20／700 | 模块标题 |
| H3 | Font.Size.H3 | 16／700 | 分区标题、条目名称、普通数值 |
| Value | Font.Size.Value | 20／700 | 详情中的关键数值 |
| Body | Font.Size.Body | 14／400 | 正文与描述，使用主文字色 |
| Control | Font.Size.Control / H3 | 14／600、16／700 | 普通控件、唯一主行动 |
| Caption | Font.Size.Caption | 13／500 | 标签与元信息 |
| Micro | Font.Size.Micro | 12／700 | 计数与状态胶囊 |
| EquipmentName | Font.Size.EquipmentName | 15／700 | 已确认的两侧人物装备槽名称 |
| ItemName / Stat | 独立Token | 22／700、30／700 | 保留已认可的装备名称与主属性 |

2026-10-05：Body 保持 14px，Caption 保持 13px，Micro 保持 12px。只用灰字呈现补充信息；正文用 TextPrimary，普通及关键数值用 Emphasis。每个窗口 ≤13px 文字占比不超过 35%，灰字不超过 40%；说明不承担条目名称、核心数值或主按钮文字。字号来自 Token；固定六槽布局所需的 15px 名称使用独立 EquipmentName Token。

## 公共组件

入口仍为 `ui-components.ts`，扩展已有入口而不是另建每页一套控件。新组件实现位于 `ui/primitives.ts`，状态与键盘行为位于 `ui/interaction.ts`。

| 组件 | 规则 |
| --- | --- |
| buttonHtml | 主要、次要、普通、危险、禁用、忙碌；`size: 'action'` 为 42px / 16px 主行动，触摸至少 44px。2px 实色底边来自 Border.Edge 和 PrimaryEdge / SecondaryEdge；按下同步下沉 2px、去掉底边，颜色保持快速过渡。禁用态用 Disabled 底、虚线边且无底边。普通与忙碌文本保留相同占位。 |
| panelHeaderHtml | 同一标题、工具区、关闭按钮结构；模块标题通过level参数选择，不各页重写。 |
| fieldHtml | 明确label、固定提示区、aria-invalid和说明关联；错误文字不会新插一行挤动操作区。 |
| tabsHtml | 标准 tablist；选中为浅金底、主字色、700 字重与 3px 金条，竖排使用左侧金条。支持方向键及 Home／End，响应式布局同步 aria-orientation。 |
| sectionTitleHtml | 16px / 700 主色分区标题，8px 金色菱形，复用计数徽标与可选操作区；紧凑装配栏可将计数放在下一行。 |
| statusBadgeHtml | 按图形化文档 0.5 节 C1 调整：仅用于失败、待确认、不可执行原因、类型不匹配等异常，12px / 700 语义色实底胶囊。已装配、已获得、已装备、可激活、可进入等正常状态使用角标或节点外观。 |
| resourceCostHtml | 接受真实报价与持有量；0、缺失、大数量分别展示，缺失不当作0。支持紧凑布局，大数值自动拆分资源行，金额自身不折断；不决定是否允许操作。`display: 'requirements'` 仅呈现所需资源，足够用亮色字、不足用红字，保留可访问的不足状态，不显示持有量和重复状态文案。默认详细模式保持原行为。 |
| resourceAmountHtml / currencyIconHtml | 金币、强化石、经验共用图标与语义色；默认 16px / 700，`emphasis: true` 用 Value 20px，标题资源保持 16px。 |
| statTilesHtml | 2–4 个并列数值块；Raised 底与 Shadow.Card，13px 灰标签、20px / 700 Emphasis 数值。只呈现调用方已有数据。 |
| ui-card / itemSlot | 按 C9/C10 调整：列表卡片使用 ui-card，图形节点使用 ui-node；`data-state="locked|available|learned|maxed"` 驱动同组变量。道具沿用 A「清爽品质底色」的 Color.Item 底与 1px 品质边，无三角，选中只用单圈细杏金边；右上保留给 check / lock / count 角标。 |
| toggleHtml / rangeFieldHtml / selectFieldHtml | 统一开关、范围与选择器，使用原生输入和显式label；设置页与组件工作台共用。 |
| statRowHtml | 默认将属性、次级说明、数值和变化分栏，变化列预留空间；`previousValue` 在数值列呈现当前值 → 下一值，差值仍由调用方提供。`layout: 'stacked'` 可用于上下标签与数值，`valueTone` 指定数值的正向／负向强调。默认属性行保持原行为。 |
| stateBlockHtml | 空、加载、错误、成功；48px 图标、16px / 700 标题。加载只呈现“读取中…”，补充说明保持单行并提供完整 title；错误提供明确恢复入口。 |
| confirmationHtml | 共用确认窗口、取消与确认、焦点约束、Esc取消、忙碌禁止再次提交；用于实际装备分解。 |

## 图形表达规则（2026-10-05，按 0.5 节 C1–C16）

等级与有限次数使用 `pipsHtml`：最多 10 点，超过 10 自动转 `meterHtml` 分段条；完整分数保留在 aria-label / title。正常状态使用 SVG 角标与节点外观，异常状态保留 Warning / Danger 文字或徽标。技能卡内没有等级／正常状态徽标；人物空槽仅保留部位名、剪影与虚线，不显示“空”。外观搭配用常驻七格缩略图条；任务列表用迷你条，详情仍显示 Value 20px 的目标数字。`rewardStripHtml` 隐藏零数量单项，全部为零时由副本详情显示“首通后可得”。

`ui/icons.ts` 统一代码 SVG 与 `statIcon` 未知属性回退；`ui/graphics.ts` 提供点阵、进度条、角标、变化箭头、奖励条、空格、时钟、圆环、分页点与帮助。图标图形、角标均不改变布局占位，人物绝对定位槽位不被通用节点定位覆盖。窗口／分区标题、条目名称、详情描述、服务端原因、资源数量、属性值、Tier 与确认风险说明保留文字。

天赋页头只读可选 `sections[].points:{available,total}`，不从 summary 解析；缺失时显示未同步提示，原 summary 项仍可在“总加成”浮层呈现。无费用／无变化的块不渲染；禁用原因是 Warning 13px / 500。旧节点元数据缺失时保留列表回退。图标总览与组件样例位于 `/ui-system.html`。

价格、等级条件、奖励、可操作性继续由服务端或已有应用控制器提供；组件只呈现结果。确认已提交的操作不通过客户端取消来假装回滚。

## 样式边界

`ui-entry.css`集中管理导入顺序，使用tokens、legacy、components层。legacy暂时保留旧页面布局；新组件由components层控制，避免每页依靠更多覆盖规则改变按钮和表单。迁移某组件时应同时清理原有对应样式，不能永久留下多套同义实现。当前生产入口已移除v2-layout.css；style.css只保留基础表面、默认物品槽位和登录构图，HUD由ui/hud.css负责。旧构图样例样式仅由showcase.ts导入ui/legacy-showcase.css，不进入游戏。legacy层名保留以兼容导入结构，当前页级布局也在该层。

源审计入口 `node tools/audit-ui-system.mjs` 跟踪生产CSS入口的递归导入和UI渲染TypeScript，记录剩余直接颜色及字号；`--strict`在仍有未迁移定义时失败。数量只是迁移线索，必须结合语义、实际计算样式与交互截图判断，不能把所有颜色搬到一组无语义的“旧色值”变量里来通过检查。

## 已接入与已验证

2026-10-05 当前工作树生成 320 项 Token（包含其他并入的 Token）。任务、远行、技能、背包、人物、外观、养成、挑战、设置以及 HUD 使用共用组件与语义 Token。生产 CSS 与 UI 渲染 TS 严格审计为 0 直接色值、0 直接字号，legacy 页级文件不覆盖 `.ui-*` 的 color / font-size / font-weight / display。最新三视口文字统计、改前改后截图及真实交互见 [游戏感与文字层级验收](reviews/ui-game-feel-20261005/README.md)。

`node tools/verify-system-panels.mjs`验证任务/远行布局切换、无结果状态、四视口、设置范围校验、按键冲突/取消、切地图和刷新后设置恢复，以及暂停按钮焦点。设置按设备保存，开新地图时保留自动战斗偏好，不能通过重建World重置已选配置。

工作台：[ui-system.html](http://127.0.0.1:8612/ui-system.html)。`node tools/verify-ui-foundation.mjs`已在清理旧样式后再次通过：暗／浅配色和1280／768／375组件布局、真实账号登录、健康检查重试、固定错误区、防重复提交、接管及丢失创建响应后的恢复。开发登录仍只输入账号。

技能、背包/人物、养成/挑战的隔离真实数据库与浏览器验收分别见对应模块文档；临时数据仅用于验收，不进入玩家数据库。技能保持C方案；新增类型只更新数据目录，不另写专用页签实现。

客户端0.7.3已发布到本机预览，完整验收范围与数据准备边界见[交付矩阵](ui-system-progress.md)。
