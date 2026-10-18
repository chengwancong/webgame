# 养成、挑战与外观 UI 系统迁移

2026-10-02。本次将现有养成、挑战与外观流程接入公共 UI 组件和语义 Token，保留服务端规则、持久数据、报价和权限所有权。未修改装备槽位、掉落、成长公式、公共组件源、版本或常驻服务。

## 页面与信息组织

- 养成仍按武器盘、威能法典、三系天赋、巅峰雕文、召唤石、突破觉醒、声望专业组织；14 个实际子页都有常驻目录、固定图标、详情、服务端操作选择、条件、消耗和属性变化。目录、详情与窄屏整体使用独立滚动区域。
- 挑战仍保留高难、噩梦、团队、赛季与排名。挑战资格、次数、最近结果、奖励、赛季领取状态、真实排名和团队准备状态分区呈现。操作按钮按对应条目显示忙碌状态，不把其他卡片误标成正在挑战。
- 外观仍使用实际逐帧角色预览与七部位目录。自动匹配、已获得、未收集、武器类型不匹配、未保存、保存中、错误及未确认状态明确区分。搭配总览的展开状态由页面控制器保存，选择造型不会自动折叠。375px 动作按钮按三列两行排列，文字不挤成竖排。

## 公共组件与样式

动作使用 `buttonHtml`，分类使用 `tabsHtml`，物品选择使用 `itemSlot`，资源使用 `resourceCostHtml`，属性使用 `statRowHtml`，状态使用 `statusBadgeHtml` 与 `stateBlockHtml`。噩梦层数使用 `fieldHtml`。

两份页面 CSS 只维护布局、目录卡片排布与滚动；颜色、文字、间距、圆角、描边、阴影与动效引用现有语义 Token。不存在直接颜色或字号。普通、忙碌、主次操作和成本显示沿用共享组件皮肤。页面保留 `data-progress-scroll` / `data-appearance-scroll`，消费主渲染现有的滚动与焦点恢复。

旧 `.slot small` 的绝对定位曾使目录状态文字落到卡片边界外，本次在所属目录恢复正常文流。共享基础样式清理后，移除了两页旧的空错误行隐藏规则，遵从公共错误位置预留。

## 数据与完整状态

| 状态 | 展示与操作 |
| --- | --- |
| 初次读取、空数据 | 共享加载／空状态；没有数据时不制造奖励或可用操作 |
| 条件未满足、资源不足、满级 | 显示服务端原因，确认按钮禁用；不把失败前未计算出的零费用当作免费操作 |
| 缺失货币 | 持有量显示“—／待核对”，与真实 0 区分 |
| 无报价、过期报价、报价目标不一致 | 不展示旧报价作为当前结果，不允许确认；提供重新核对入口 |
| 合剂使用 | 明确本次使用消耗 1 瓶，零金币／灵石成本不被描述成零物品消耗 |
| 忙碌 | 对应操作显示忙碌，重复提交受控制器与已有写入管线阻止 |
| 网络未知结果 | 显示结果待确认、停止继续提交，恢复连接后读取原回执 |
| 外观预览失败或权限版本变化 | 保存禁用，显示核验错误；不能把旧预览当成新搭配通过 |
| 团队状态 | 已入队不能重复加入；已准备不能重复准备；无资格／满员不能加入；只有服务端 `canStart` 且为队长时可发起 |

前端只格式化服务器的数值和比较结果，不计算成长费用或持久收益。费用比较中的持有量不足仅用于显示；最终资格仍取服务端报价。所有实际写入复用原 `GameApp.write`、IndexedDB outbox、原 command ID 和服务端回执。

## 验证与证据

- `tests/progression-ui-system.test.ts`：8 项状态测试，覆盖未知／零持有量、陈旧报价、分组切换期间旧选择、未确认状态、合剂消耗文案、挑战读取失败、外观预览版本及搭配展开状态。
- `tools/verify-progression-ui-system.mjs`：独立临时 PostgreSQL、API、Vite 与 Playwright；175 项记录通过。覆盖 1280×720、1024×576、768×1024、375×812 下的全部 14 个养成子页、四类挑战页和外观七部位。
- 实际检查长名称、长目录、未开放、资源不足、满级、无报价、读取失败、缺失货币、未确认、按钮可达、图标尺寸、滚动与焦点保留。
- 真实命令验证合剂响应丢失后仅扣 1 瓶、噩梦挑战与真实成绩、赛季领取后不可重复领取、建队／准备／离队，以及外观保存响应丢失后的原回执恢复。外观保存保持金币、灵石、战斗构筑不变。团队满编战斗规则未改，本次实际组队检查止于真实创建、准备、离队和未满员禁止发起。
- 缺失货币使用明确标注的只读 API 元数据夹具；没有以模拟响应证明真实写入成功。临时测试角色采用专用测试进度与材料，不触碰玩家存档。
- `tools/verify-progression-ui-followup.mjs`：最新共享基础样式后的 7 项补充检查通过，包含四视口外观布局、动作文字、搭配展开保留、只读角色数据保护、共享忙碌按钮尺寸及未知成本。审查发现的设置 Tab 导航和 `NaN` 显示问题由主 Agent 在共享模块修复，未在本页面复制修复逻辑。
- TypeScript 检查通过；两份页面 CSS 直接颜色／字号审计为 0。测试用服务和数据库均已清理。没有构建发布或重启常驻服务。

截图与记录位于 [全局 UI 系统截图目录](../../.design/global-ui-system/screenshots)：

- [完整验证记录](../../.design/global-ui-system/screenshots/progression-system-result.json)
- [共享基础清理后补充记录](../../.design/global-ui-system/screenshots/progression-system-followup-result.json)
- [养成目录与详情](../../.design/global-ui-system/screenshots/progression-system-talents-1280x720.png)
- [375px 可达操作区](../../.design/global-ui-system/screenshots/progression-system-actions-375x812.png)
- [真实团队准备状态](../../.design/global-ui-system/screenshots/progression-system-real-raid-waiting-members.png)
- [最终外观 1280×720](../../.design/global-ui-system/screenshots/progression-system-appearance-final-1280x720.png)
- [最终外观 375×812](../../.design/global-ui-system/screenshots/progression-system-appearance-final-375x812.png)

## 共享接入

原 `renderProgression`、`renderChallenges`、`renderAppearance` 和控制器入口未变。新增的外观搭配展开 action 由已有 `appearance-*` 分派自动处理。未引入新的 API、共享 Token 或全局状态要求；主 Agent 统一更新整体进度并发布。全游戏其余页面的完成度不由本范围验收代表。
