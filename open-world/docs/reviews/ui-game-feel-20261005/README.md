# 奶白浅金层级与 0.5 冲突裁定验收

日期：2026-10-05。生产范围：open-world/apps/web；本轮先执行字号文档，再按用户追加的图形化文档 0.5 节 C1–C16 返修。最终截图以 graphic-after 为准，after 是此前字号阶段截图。

## 已完成

- Token 配色、H2 20px、Value 20px、Emphasis、按钮实色底边、页签金条、标题分隔线、分区标题、数值层级与加载文案统一；World / Combat / Minimap / Rarity / Resource 数值未由本轮改动。
- 按 C1/C2：正常状态移到 SVG 角标和节点外观；技能等级为点阵，卡片没有状态徽标。
- 按 C3：人物六槽布局保持，空槽仅有部位名、虚线、剪影，无“空”字；候选数是右上 count 角标。
- 按 C4：外观未获得以锁定节点和 lock 角标表达，获取途径进入 title 和详情；搭配是常驻七格缩略图。
- 按 C5：任务列表为迷你条，分数保留在 aria-label；详情进度数字仍为 20px。
- 按 C6/C7/C8：副本目录为模式图标、人数图标与数字；未开放只有 lock，原因在 title / 详情。有限次数是数值块内点阵；奖励条隐藏零项，全部为零显示“首通后可得”。
- 按 C9/C10/C12：ui-card / ui-node 共用四态变量；节点 learned 为浅金 / 深金、available 为金圈、locked 置灰。物品槽恢复 Color.Item 的 A 底色与 1px 品质边，移除三角，选中为单圈杏金。
- 按 C11/C13/C14/C15/C16：天赋节点为属性图标与点阵，名称只在列头、title、aria 与详情；无变化比较块不渲染；sections[].points 由既有服务端函数提供，前端不解析 summary；禁用原因 Warning 13/500；主副专精为 tabsHtml.markHtml 圆形角标。
- 删除无引用的 v2-layout.css，清理 16 处 legacy 对公共组件的 color / font-size / font-weight / display 覆盖。新 SVG / 点阵 / 角标来自 ui/icons.ts、ui/graphics.ts 和 components 层样式，未新增位图。

## 文字层级（1280×720）

统计沿用字号文档 TreeWalker 口径；任务实际根是 .task-window，因此补充该根选择器。数值是本次采集结果，不把原文六窗口旧样本拼作本次基线。改前使用已有成长验收角色，改后为其只读数据克隆的本轮专用 QA 角色，姓名与后续受控交互导致少量字符数差异；两者都是真实服务数据。

| 窗口 | ≤13px 字符占比 | 灰字占比 | 标题外 ≥20px 节点 | 1280×720 截图 |
|---|---|---|---|---|
| 背包 | 51% → 34% | 36% → 24% | 3 → 3 | [改前](before/bag-1280x720.png) / [改后](graphic-after/bag-1280x720.png) |
| 人物 | 43% → 24% | 55% → 30% | 8 → 4 | [改前](before/character-1280x720.png) / [改后](graphic-after/character-1280x720.png) |
| 技能 | 46% → 18% | 66% → 10% | 3 → 4 | [改前](before/skills-1280x720.png) / [改后](graphic-after/skills-1280x720.png) |
| 养成 | 34% → 15% | 47% → 35% | 0 → 2 | [改前](before/progression-1280x720.png) / [改后](graphic-after/progression-1280x720.png) |
| 外观 | 59% → 7% | 56% → 26% | 0 → 1 | [改前](before/appearance-1280x720.png) / [改后](graphic-after/appearance-1280x720.png) |
| 任务 | 66% → 27% | 57% → 21% | 1 → 4 | [改前](before/tasks-1280x720.png) / [改后](graphic-after/tasks-1280x720.png) |
| 副本 | 58% → 5% | 66% → 28% | 0 → 4 | [改前](before/dungeons-1280x720.png) / [改后](graphic-after/dungeons-1280x720.png) |
| 远行 | 59% → 11% | 54% → 14% | 2 → 6 | [改前](before/travel-1280x720.png) / [改后](graphic-after/travel-1280x720.png) |
| 设置 | 49% → 34% | 44% → 19% | 0 → 1 | [改前](before/settings-1280x720.png) / [改后](graphic-after/settings-1280x720.png) |

1280×720、1024×768、375×812 共 27 份窗口记录均满足 ≤13px 占比 ≤35%、灰字 ≤40%、重点节点 ≥1，无文档横向溢出或窗口越界。[完整 JSON](graphic-after/result.json)。尺寸恢复为 desktop 后关闭验收浏览器。

## 图形化量化与状态

以下来自 [图形裁定验收](graphic-conflicts/result.json)，格内分数、字符图标、层级句与长说明均为 0。天赋三状态通过真实“设为主专精 / 投入 1 点”命令生成，专用 QA 数据测试后恢复，未改普通玩家。

| 窗口 / 状态 | 格内分数 | 字符图标 | 层级句 | 长说明 | meters |
|---|---:|---:|---:|---:|---:|
| talents-unselected | 0 | 0 | 0 | 0 | 31 |
| talents-1280 | 0 | 0 | 0 | 0 | 32 |
| talents-1024 | 0 | 0 | 0 | 0 | 32 |
| talents-375 | 0 | 0 | 0 | 0 | 32 |
| paragon | 0 | 0 | 0 | 0 | 0 |
| reputation | 0 | 0 | 0 | 0 | 13 |
| bag | 0 | 0 | 0 | 0 | 1 |
| character | 0 | 0 | 0 | 0 | 1 |
| skills | 0 | 0 | 0 | 0 | 3 |
| appearance | 0 | 0 | 0 | 0 | 0 |
| tasks | 0 | 0 | 0 | 0 | 1 |
| dungeons | 0 | 0 | 0 | 0 | 0 |
| travel | 0 | 0 | 0 | 0 | 0 |
| settings | 0 | 0 | 0 | 0 | 0 |

天赋树：[未选专精](graphic-conflicts/talents-unselected-1280x720.png)、[第一层可投入](graphic-conflicts/talents-first-tier-available-1280x720.png)、[第二层解锁](graphic-conflicts/talents-second-tier-unlocked-1280x720.png)。三个视口的 56px 五列树无横向裁切。改前天赋树可参考此前同日的 [未选专精真实截图](../progression-ui-20261005/stage2-fresh-locked-preview.png)，这是已归档记录，未冒充本轮新采集。

副本：[有限次数详情](graphic-dungeon/finite-quota-detail-1280x720.png)、[准备状态](graphic-dungeon/preparation-1280x720.png)、[实际战斗 HUD](graphic-dungeon/actual-dungeon-hud-1280x720.png)。准备 meters=1，实际 HUD meters=4，格内分数 / 字符图标 / 层级句为 0；以 [实战结果](graphic-dungeon/result.json) 为准。单人副本保留原来的自动准备 / 开战流程，完成实际退出与正常回城。没有改人数、目标、扣次或持续战斗规则。

图标：[16 / 24 / 32 总览](graphic-conflicts/icon-gallery-16-24-32.png)、[公共图形组件](graphic-conflicts/graphic-component-examples.png)。原信息保留在节点 aria-label / title 与详情，帮助按钮能通过键盘聚焦显示完整说明。

## 验证与版本

- Token --check、strict 源审计、tsc 通过；当前工作树 320 项 Token，包含过程中其他并入的 Token，生产审计 0 直接色值 / 0 直接字号。
- 10 个测试文件、76 项测试通过，含 11 项新图形 / 可选契约边界测试。旧箭头、展开表、纯文字计数断言已转换为 SVG、七缩略图与 meter 断言，保留数据、禁用、过期报价及操作防重检查。
- 13 项 [真实 Chrome 交互](interactions/result.json) 通过：两像素按下同步去底边、三种按钮实际截图、连续选择 / 图标 / 滚动 / 焦点、任务页签键盘、外观真实保存不改钱包 / 属性 / build / Canvas、旧会话恢复、新角色登录并用实际移动 / E 返回拾星港。无 pageerror 或美术缺失。
- protocol / rules / assets 在 API health、content 与真实客户端一致；具体版本记录在 interactions/result.json。原为 client 0.10.10、protocol 18、rules ow-32、assets world-art-20261005-v21-collision、DB 12；最终实际记录优先。
- 样式与浏览器 / 单测串行。遇到本机 PostgreSQL 连接超时与服务自动重载时，该次未计通过；恢复常驻服务后重跑。账号、角色、回执与流水保留；QA 副本的真实收益由正常回执产生。
- 编译另在 .qa/ui-game-feel/build 暂存目录验证，不覆盖在线 dist，不执行发布或改版本校验。

## 字段回退与未完成项

sections[].points 已新增可选字段，旧字段缺失时显示“天赋点未同步”，summary 中的点数仅用于总加成浮层。节点元数据不齐仍退回原列表，未造 rank / max。未新增图形文档完整扩展中的 item.gate 或 challenge entries.rewards；缺失前者仅显示锁，挑战奖励仍保留既有服务端文字。图形文档中步进器、赛季里程碑、伤害乘区堆叠条等不属于 0.5 节本轮返修的扩展，未宣称整份图形化文档全部交付。

Git 编号提交尚未生成。开工前已有大量代码 / 美术改动，项目规范还未跟踪，过程中还有其他修改进入；没有将它们混入新提交。patches/ 提供按逻辑分组、基于开工工作树的可审阅补丁及说明（包括“按图形化文档 0.5 节 Cxx 调整”）；补丁已经体现在当前文件，不应再次应用到已修改目录。
