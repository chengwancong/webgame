# Grok 问题修复进度 B0–B6

原始证据：G:/webgame/aw-deploy/grok-fixes-20261019/；原报告 grok-round2-3-report.md 不入库。

| BUG | 批次 | 状态 | 根因 | 改动文件 | 回归测试 | 提交 |
|---|---|---|---|---|---|---|
| BUG-01 | B0 | 完成 | 按交接由覆盖层处理 | main.ts/network.ts/index.html；deploy-staging.mjs/deploy-versions.ts | tsc；13 个覆盖层相关测试；发布版本测试；线上目录 50 项严格解析 | ff806220 |
| BUG-02 | B0 | 完成 | 按交接由覆盖层处理 | main.ts/network.ts/index.html；deploy-staging.mjs/deploy-versions.ts | tsc；13 个覆盖层相关测试；发布版本测试；线上目录 50 项严格解析 | ff806220 |
| BUG-03 | B0 | 完成 | 按交接由覆盖层处理 | main.ts/network.ts/index.html；deploy-staging.mjs/deploy-versions.ts | tsc；13 个覆盖层相关测试；发布版本测试；线上目录 50 项严格解析 | ff806220 |
| BUG-04 | B0 | 完成 | 按交接由覆盖层处理 | main.ts/network.ts/index.html；deploy-staging.mjs/deploy-versions.ts | tsc；13 个覆盖层相关测试；发布版本测试；线上目录 50 项严格解析 | ff806220 |
| BUG-05 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-06 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-07 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-08 | B0 | 既有日志已判定 | 已确认容器重启空窗 | 既有运维日志；进度记录（不改业务代码） | 10月18日 Caddy 日志确认重启空窗 | 20ee7748（记录） |
| BUG-09 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-10 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-11 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-12 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-13 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-14 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-15 | B1 | 已修复 | 重新 travel 初始化本场状态但未告知未确认状态重置 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归） | 768e1bd1 |
| BUG-16 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-17 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-18 | 裁决 | 按默认不追 | 缺原文，B6 若复现则用新编号记录 | — | 待回归 | — |
| BUG-19 | B1 | 已修复 | 结算层吞掉恢复/安全关闭，失败恢复仍尝试返回 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归）；图形浏览器实机通过 | 768e1bd1 / cd105ee5 |
| BUG-20 | B0 | 完成 | 旧客户端与新 schema 混用，当前线上严格解析通过 | main.ts/network.ts/index.html；deploy-staging.mjs/deploy-versions.ts | tsc；13 个覆盖层相关测试；发布版本测试；线上目录 50 项严格解析；图形浏览器实机通过 | 20ee7748 / 068a1a30 |
| BUG-21 | B1 | 已修复 | 心跳可重叠，且每次岛屿心跳都重发战报和授权；瞬断立即停战 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归） | 768e1bd1 |
| BUG-22 | B2 | 已修复 | 空槽静默返回，旧技能分支失败未登记原因 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-23 | B2 | 已修复 | 回顾只保留最近五次受击，最后一击被当作全场量 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-24 | B2 | 已修复 | 首领场目标一直使用接近文案，未检查交战状态 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-25 | B1 | 已修复 | 确定性拒绝仍当作不确定写入，重复冲刷旧授权 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归） | 768e1bd1 |
| BUG-26 | B4 | 已修复 | 回港按钮用返回地点覆盖了真实可见名称 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-27 | B3 | 已修复 | 任务导航只查询已排除岛屿的远行目录 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad / 3a89cc68 |
| BUG-28 | B3 | 已修复 | 手动接取后立即关对话，自动对白只覆盖 arrive/none | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |
| BUG-29 | B1 | 已修复 | 等待全场资源完成前直接 return，只有纯色背景 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归） | 768e1bd1 |
| BUG-30 | B4 | 已修复 | 装备名来自地面掉落/悬停提示，缺视口 HUD 避让及切场清理 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-31 | B3 | 已修复 | snapshot.field 漏 region 导致客户端忽略已采集列表 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试；图形浏览器实机通过 | 0fcc87ad / eebe53a7 |
| BUG-32 | B3 | 移交 Claude | 位面入口与实例归 Claude | — | 不改位面入口/实例 | —（移交 Claude） |
| BUG-33 | B3 | 已修复 | 远程工坊沿用现场标题，未明确只是配方预览 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |
| BUG-34 | B2 | 已修复 | 升级只开放可激活项，未按空槽自动装配 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 / cd105ee5 |
| BUG-35 | B3 | 已修复 | 物件标签按完整图片高度上移，忽略图像 originY | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad / 3a89cc68 |
| BUG-36 | B4 | 已修复 | 引导与追踪器分别布局，没有共用保留区 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-37 | B1 | 已修复 | WebSocket 沿用带凭据 href、首帧未确认连接、加载失败无明确退出 | main.ts、recovery-policy.ts、battle-result-controller.ts、dungeon-controller.ts、scene.ts | tsc；16 单测；25 PG 测试（含 19/37/25 定向回归） | 768e1bd1 |
| BUG-38 | B3 | 已修复 | 地图生成器未为 NPC 本身保留碰撞净空 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |
| BUG-39 | B5 | 已修复 | HUD 读取初始化/恢复中的本地世界 198，而非最终快照属性 | main-stat-values.ts、main-stats.ts、CharacterPanel.ts、affix-units.ts、vitals-display.ts、presentation.ts、gear-metadata.ts、GearCard.ts、GearDetails.ts、equipment-tip.ts、crafting-panel.css | tsc；56 个一致性/装备构筑/工坊测试；同件卡面与详情数值相同 | b587977c |
| BUG-40 | B3 | 已修复 | 回港交互复用登陆中心，没有选择远离营地的安全侧 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |
| BUG-41 | B4 | 已修复 | 宝箱世界标签不避让 DOM 任务面板 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-42 | B5 | 已修复 | 卡面先把比率四舍五入到 0.1，.05→.1、.04→0 | main-stat-values.ts、main-stats.ts、CharacterPanel.ts、affix-units.ts、vitals-display.ts、presentation.ts、gear-metadata.ts、GearCard.ts、GearDetails.ts、equipment-tip.ts、crafting-panel.css | tsc；56 个一致性/装备构筑/工坊测试；同件卡面与详情数值相同 | b587977c |
| BUG-43 | B5 | 已修复 | 平值格式化直接 String 浮点数，暴露二进制误差 | main-stat-values.ts、main-stats.ts、CharacterPanel.ts、affix-units.ts、vitals-display.ts、presentation.ts、gear-metadata.ts、GearCard.ts、GearDetails.ts、equipment-tip.ts、crafting-panel.css | tsc；56 个一致性/装备构筑/工坊测试；同件卡面与详情数值相同 | b587977c |
| BUG-44 | B5 | 已修复 | 未穿戴套装回退到未缩放模板文案，丢掉服务端 bonusDescriptions | main-stat-values.ts、main-stats.ts、CharacterPanel.ts、affix-units.ts、vitals-display.ts、presentation.ts、gear-metadata.ts、GearCard.ts、GearDetails.ts、equipment-tip.ts、crafting-panel.css | tsc；56 个一致性/装备构筑/工坊测试；同件卡面与详情数值相同 | b587977c |
| BUG-45 | B5 | 已修复 | 图样头部继承装备绝对定位样式，品质枚举未翻译 | main-stat-values.ts、main-stats.ts、CharacterPanel.ts、affix-units.ts、vitals-display.ts、presentation.ts、gear-metadata.ts、GearCard.ts、GearDetails.ts、equipment-tip.ts、crafting-panel.css | tsc；56 个一致性/装备构筑/工坊测试；同件卡面与详情数值相同 | 0fcc87ad / b587977c |
| BUG-46 | B3 | 已修复 | 工坊提示与现场判定分别用 2.8/4/5 格，图像锚点不一致 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad / eebe53a7 |
| BUG-47 | B2 | 已修复 | 成长卡复用了暂停世界的多页对白弹窗 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 / cd105ee5 |
| BUG-48 | B2 | 已修复 | 状态失效浮字“已结束”易被当作单位死亡 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-49 | B2 | 已修复 | 旧技能分支返回 false 未给出目标/距离等失败原因 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-50 | B4 | 已修复 | 通知、收益、世界引导分别定位，未测量冲突 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-51 | B2 | 已修复 | 可远航/曾开放岛误用“本岛”措辞 | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-52 | B4 | 已修复 | 锁定岛 note 强制 nowrap 导致窄航线说明粘连 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-53 | B4 | 已修复 | 切图未清空 feed/Toast/拾取演出队列 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-54 | B4 | 已修复 | 跨岛推荐错误落到本图 portal 并带上异地图目标文案 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-55 | B3 | 已修复 | 世界对象始终显示动作，提示/鼠标/服务端距离不一致 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad / eebe53a7 |
| BUG-56 | B4 | 已修复 | 全图把非地标装饰也放大到最小尺寸，密集亮色素材重叠 | hud-avoidance.ts、scene 标签/交互/掉落渲染、starsea-controller.ts、minimap-scene.ts、main.ts、story-panel.css、battle-result-panel.ts | tsc；23 个避让/引导/小地图/结算测试 | 3a89cc68 |
| BUG-57 | B3 | 已修复 | 学会配方与制作阶段条件混淆，产出品质直接显示枚举 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |
| BUG-58 | B2 | 已修复 | 每帧渲染失败可能覆盖有效像素，缺帧仍强制 setFrame | main.ts、growth-cards.ts、starsea-controller.ts、hero-appearance.ts、scene.ts、world-numbers.ts、rules/index.ts、simulation/index.ts/combat-review.ts、contracts/combat-review.ts | tsc；28 个技能恢复/受击累计/换装回退/浮字/结算测试 | d08264f3 |
| BUG-59 | B3 | 已修复 | 当前 150 点均可达；补接近格校验及最近可达接近点导航 | world-interactions.ts、app.ts、gather-nodes.ts、field-activities.ts、starsea-controller.ts、starsea-story-renderer.ts、CraftingPanel.ts、build-production-islands.ts、production.json | tsc、内容校验、20 单测、8 真实 PG 采集测试 | 0fcc87ad |

## 决策日志

- B0 覆盖层原样提交 ff806220；其他脏文件（含上轮 database.test.ts 修改）不纳入本批。
- BUG-20 当前线上严格目录解析通过，判为部署错配；新增激活前 client/protocol/rules/assets/db 一致及 API SOURCE_COMMIT 检查。
- 保留等级或前岛首领的开放远航设计；BUG-32 移交 Claude；不改技能动作、节奏、数值平衡。
- BUG-15 按裁决明确提示生命/位置/冷却初始化及已确认存档保留；不伪造服务端回执。BUG-21 使用现有 150 秒租约预算内单飞续租，只在到期前续战斗授权。
- 新等级解锁仅对新流程角色、服务端已判定符合等级/岛屿条件、兼容武器且存在空槽的技能自动激活装配；不消费技能书，不替换已有装配。
- 伤害回顾增加可选 totalTaken 展示字段，保留最后一击/最近记录独立含义；不改任何伤害计算。B6 同步提升协议版本以防旧严格客户端拒绝新增字段。
- 品红/空白回退只改像素发布：候选帧画到独立画布，空帧不覆盖最后可见帧；不更改动作、时序、技能姿态。
- BUG-59 当前 150 个采集点的中心和至少 4 个周边站位通过通行校验，原报告未提供具体坐标，不盲目挪动合法点；新增最近可达接近点导航和构建期接近格检查。
- BUG-38/40 修改生成内容的碰撞留白与回港交互点；NPC 坐标继续来自 NPC 表，未修改工作簿、怪物数据或位面实例。
- 配方“已学会”和制作所需熟练/设施/阶段条件分开说明，已学不免除原地城/阶段条件，装备等级仍消费服务端预览。
- 发现其他会话尚未提交的 ui/world-label-layout.ts、toast-queue.ts、overlay-stack.ts 原型；按禁止触碰约束不引用或提交。正式路径接入本批 hud-avoidance.ts，保留原型原样。
- 世界标签只在有限距离内避让，离开视口的掉落名称不夹到顶栏；关键交互气泡可寻找独立空位。小地图只给地标最小尺寸，普通装饰保持实景比例。
- BUG-42 根因是显示前错误舍入，不调整物品配置或效果倍率；将主属性分解提取为服务端与卡面共用的纯实现。
- BUG-44 服务端当前/预览套装描述优先；尚未核对时不显示原始未缩放百分比。BUG-39 安全营地/港口读取快照最终生命；战斗仍显示执行器当前生命，未伪造治疗。
- B6 客户端提升至 0.11.30，协议 39，以显式阻止旧严格客户端消费新增回顾字段；rules/assets/db 版本与数值规则不变。
- 发布工具改为差异 gzip 上传、候选镜像版本核对和可回滚原子切换；不再先发布 API 后长时间上传旧客户端。
- 最终本机回归 156 单测 + 73 PG 测试通过（PG 数量包含工作区既有且未提交的 1 条租约回归，按约束未代为提交）。
- B6 实机补充：自动装配提示遇到已有成长卡仍需追加栏位说明；恢复连接完成后若有保存的结算上下文须重开原结算页。已在 cd105ee5 修复并发布 client 0.11.31 / protocol 39。
- BUG-19 图形复验使用本任务自己的 handoff_browser_1019：正常首领战获胜、刷新恢复结算；通过正常 API 接管/登出制造 CONTROL 中断（不改角色数据），随后原结算重现并从可见按钮回港。/api/safe 200，金币 319 与装备 9 件前后相同。
- BUG-20 图形目录实际有条目，最终线上严格解析 50 项；BUG-31 正常走到矿点 E 采集风纹铁2个后节点/提示消失，再按 E 不重复提交，采集状态在后续刷新及回港后仍保留。
- 收尾时发现交接文件被 Claude 追加 HUD 原型接入说明，引用文件仍未提交。B4 实现已在该补充被读取前完成；按“不触碰其他会话改动”及补充允许的 B6 后统一接入边界，未修改/提交这些原型。正式修复路径与原型整合留给 Claude，已记录的 BUG 修复和验收不依赖它们。
- B6 结算补丁部署代码 cd105ee5，文本镜像 0d224f1e7；激活与产物哈希校验成功，本机预览健康。未关闭协议校验，未改 expires+30s，未清测试服数据、删测试或修改技能动作/数值平衡。
- 最终鼠标交互与 E 使用相同 reach，并去掉采集位置的 0.1 格量化；新边界回归证明原本合法的 (1.351,1.471) 偏移舍入后会超距，现请求保留原值。eebe53a7 已发布，附加 5 项测试及 tsc 通过。
- 最终发布代码 eebe53a7fb324b226fa12ac9df7fc733bc19686a，镜像 3ce294e99；10:34:35（北京时间）恢复健康。最终 HTML 入口哈希与产物一致，health/content/build-info 以及本机版本一致。

## 完成定义

- [x] B0 覆盖层已原样提交；BUG-20 已判定并加入候选版本/源码一致检查
- [x] B1 六项已修；BUG-19/37/25 定向回归通过
- [x] B2–B5 逐项修复/裁决已记录；BUG-32 移交 Claude
- [x] tsc、内容校验、156 项相关单测、73 项真实 PG 测试通过；实机补丁另有 16 项、交互边界另有 5 项回归通过（不累加重叠用例）
- [x] 测试服与本机均 0.11.31 / protocol 39；BUG-19/20/31 图形浏览器复验通过
- [x] 第四轮复测清单已提交（068a1a30，版本更新 cd105ee5）
- [x] 每个 BUG 的状态、根因、文件、测试、提交号齐全；原始证据仅在仓库外

## 最终验收证据

- 最终代码：eebe53a7；版本：client 0.11.31 / protocol 39 / rules ow-74 / assets world-art-20261007-v24-world-runtime / db 17。
- 自动检查：仓库外证据目录的 B6-typecheck.log、B6-content.log、B6-unit.log、B6-database.log；补充 B6-followup-tests.log、B6-boundary-tests.log。
- 部署与镜像：B6-boundary-deploy.log；入口哈希、线上及本机版本：B6-final-release-verification.json。
- 图形浏览器：B6-browser-results.json、BUG-20-directory.jpg、BUG-31-before.jpg、BUG-31-after-repeat.jpg、BUG-19-result-before.jpg、BUG-19-recovered-result.txt、BUG-19-returned-port.jpg。
- 结算恢复后 /api/safe 200；等级5、金币319、装备9件前后保持。最终控制台采样为空，无协议/凭据 URL 异常。
- API 中断试验仅操作本任务自己的 handoff_browser_1019 控制租约，已登出释放；没有修改角色状态来制造结果。

## 硬阻塞

无。BUG-32 按用户要求移交 Claude；其未提交 HUD 原型的后续统一接入按补充说明留给 Claude，不影响本批已完成的修复路径与三项实机验收。
