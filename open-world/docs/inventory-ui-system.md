# 背包、人物与装备 UI 系统迁移

2026-10-03 图标风格修订：用户选定「与 Q 版角色一致的简洁手绘」。当前可用的 9 种装备和 14 种消耗品／材料已用内置 imagegen 分别生成独立透明图，采用圆润轮廓、柔和深棕描边、大色块与少量明暗。原图按 alpha 边界等比归一化到透明 256px 画布，主体控制在 208px 安全区；正式目录为 `assets/ui-source/v2/items-chibi/`，`catalog.json` 含完整提示词、实际参考、原始路径、哈希与透明检查结果。`ui-assets.ts` 直接解析稳定 ID，移除了当前模板到旧图库的别名；324 件六部位美术目录保持独立。

背包、详情、人物候选、Tips、远行与结算共用新图。结算已补接 A 底槽。9 种装备的地面版本从同一正式资源构建 96px 小图，以 32px 显示。`node --import tsx tools/review-chibi-items.mjs` 检查全量 32／48px，旧新图对照见 `../../docs/reviews/open-world/chibi-items-20261003/comparison-all.png`。正式组件与真实服务验收见 `../../docs/reviews/open-world/item-presentation-chibi-20261003/result.json`；结算画面为明确的只读展示夹具，未改变玩家装备、奖励或存档结构。资源版本为 `world-art-20261003-v17-chibi-items`，UI 源登记版本 2.6。

2026-10-03 用户选择道具展示 A「清爽品质底色」，要求简单、不需要过度设计。正式样式由 `ui/item-slots.css` 统一控制：装备背景消费真实品质，对应 `Color.Item.Common/Magic/Rare/Legendary` 的灰蓝／蓝／金褐／橙褐完整色面；普通道具用 `Color.Item.Surface`。移除上一轮底槽渐变、阴影和双重选中轮廓，列表名称统一暖米白。背包、详情、比较卡、竖版 Tips 与人物候选图标使用相同底色规则；人物候选绑定实际装备品质。页面旧底槽状态样式已清理，页面 CSS 仅保留图标几何与布局。

`node tools/accept-item-presentation.mjs --direction-a` 验证了四种品质的实际计算底色互不相同、无渐变与无装饰阴影，以及五种视口的选择几何、滚动保持、竖版 Tips、地面小图和真实服务登录恢复。结果与截图保存在 `../../docs/reviews/open-world/item-presentation-a-20261003/`。图标尺寸与正式资源沿用已验证的实现，没有变更玩法与存档。

2026-10-03 道具展示细化：背包默认使用 72px 固定槽位、56px 图标，低高度与窄屏保留 64px 槽位、48px 图标。底槽采用独立蓝色 `Color.Item.Surface` 与 `Fill.Item`，装备品质仍以细边框及名称表示；详情、公共槽位与竖版 Tips 使用同一底槽，图内保留透明背景。物品名称改为 14px、500 字重，继续使用随包 WorldSans 可变字体。选中只改变底色与外轮廓，不挤压图标。

快速滚动后立即选择装备时，选择操作同步保存 DOM 中的列表滚动位置，避免滚动事件尚未写入草稿便重建列表而跳到顶部。场景文字在正式字体加载后绘制，使用至少 2 倍采样；地面小图说明见 [地面掉落](ground-loot.md)。

本轮 `tools/accept-item-presentation.mjs` 使用独立临时数据库验证 1280×720、1024×576、1600×900、1920×1080、375×812 的选中尺寸、长名称、滚动保留及视口边界，并检查竖版 Tips、地面资源、本机常驻服务版本兼容、真实登录与刷新恢复。结果和实机截图见 `../../docs/reviews/open-world/item-presentation-20261003/result.json`。当前版本为客户端 0.8.5、协议 12、规则 ow-16、数据库 11；没有改装备数值、奖励与玩家存档结构。

更新：2026-10-02。范围为前端投影与表现；未改经济、装备槽位、数值、存档、接口、资源版本或正式服务。

## 组件与状态

- 背包的分类/搜索/选择维持独立结构。全部、装备、消耗品、材料、任务共用固定列表与详情区域；普通道具不占装备的 24 格。
- 人物固定六部位与独立旧核心入口保留。只有当前部位候选进入换装区；背包装备跳转保留部位/装备 ID，返回恢复分类与选择。
- BagPanel、GearDetails、GearComparison、GearCard、CharacterPanel、CharacterPaperdoll、GearFilter 和竖版 Tips 复用 ui-components 的 buttonHtml、itemSlot、tabsHtml、fieldHtml、resourceCostHtml、statRowHtml、statusBadgeHtml、stateBlockHtml、panelHeaderHtml、resourceAmountHtml。
- page CSS 只定义各自布局与复合卡尺寸；已删除 gear-ui 的全局 .slot/.grid24 规则。页面颜色、字号、边框和状态面使用语义 Token；品质色与 T1/T2/T3 色使用独立 Token。
- 强化/分解等待真实 quote 与 tip，两者装备 ID/修订必须匹配。`#preview[data-seq]` 标记真实异步结果；初始和缺字段显示「待核对」/「—」，相关动作禁用。缺价与缺库存不会成为 0 或资源足够。
- 背包装备只显示物品自身属性。角色总属性换装对比只在人物与比较确认中显示。长装备名在详情截断，原列表 aria-label 与竖版装备 Tips 保留完整名称。
- 低高度人物换装：主属性及报价位于可滚动内容，动作固定底部；报价不会挤没主属性。桌面钱包使用人物标题的单一显示，窄屏保留换装钱包。768 竖屏使用纸娃娃与属性上下布局。
- 可见状态、焦点与动作保留原业务事件：合剂使用/恢复、书跳技能、材料跳养成、穿戴比较、强化、锁定、分解、战利品领取。

## 验证

自动化只创建临时 PostgreSQL、API 与 Vite，未修改玩家数据。每次截图需等待 `#preview[data-seq]`，而不是仅等图片或页面加载。

- `node node_modules/typescript/bin/tsc --noEmit` 通过。
- `node node_modules/vitest/vitest.mjs run tests/inventory-ui-system.test.ts tests/bag-ui.test.ts tests/gear-ui.test.ts tests/preview-guard.test.ts`：26 项通过。
- `node --import tsx tools/accept-inventory-ui-system-character.mjs`：10 组通过。包括真实比较未确认时 DB 不变、真实穿戴、成功响应丢失恢复单流水、卸下、按服务端报价强化扣费、锁定禁止分解、旧核心独立生效、候选滚动与六槽几何稳定、Esc 焦点恢复、返回背包、刷新数据保持。
- `node --import tsx tools/accept-inventory-ui-system-bag.mjs`：13 组通过。包括空库存、五类区域固定/无人物、合剂真实扣 1 瓶且生效 20 击杀、成功响应丢失后从任务空态恢复仅 1 条流水、已激活书不扣/未激活书真实激活、材料只读导航、真实人物装备管理、24 件装备与普通道具独立计数、满包先分解再领取、竖版 Tips 与点击收起、刷新保存。
- `node --import tsx tools/accept-inventory-ui-system-visual.mjs`：最终只读视觉复核通过，覆盖四尺寸长名/短名切换动作区域稳定、装备比较确认窗口、共享层修复后竖版 Tips 的 344px/14px/可交互滚动。未确认的比较仍通过取消退出，无写入。
- 四个视口：1280×720、1024×576、768×1024、375×812。人物候选动作边界与主属性可见性有断言；背包分类列表/详情矩形有逐类相等断言。

证据在仓库 `.design/global-ui-system/screenshots/`，前缀 `inventory-system-`。结果为 `inventory-system-character-result.json` / `inventory-system-bag-result.json`；两份结果均记录临时库停止与清理。

## 主要选择器

| 用途 | 选择器 |
|---|---|
| 分类 | `[data-action=bag-category][data-category]` |
| 物品 | `[data-action=bag-select][data-item]` |
| 真实报价已完成 | `#preview[data-seq][aria-busy=false]` |
| 合剂使用 | `[data-action=bag-use-tonic]` |
| 任意分类恢复 | `.bag-global-recovery [data-action=recover]` |
| 背包到人物 | `.bag-detail-region [data-action=bag-character]` |
| 人物六部位 | `.character-doll [data-equipment-part]` |
| 旧核心 | `.legacy-core-entry[data-id=core]` |
| 候选 | `.character-candidate[data-action=select]` |
| 固定操作 | `.character-chooser .bag-detail-actions` |
| 竖版 Tips | `#tooltip.equipment-tip[aria-busy=false]` |

## 发布分工

本次未构建、停服、启动正式服务或修改版本行。最终统一入口/Token/共享基础层与构建发布由主代理负责。
