# 美术需求清单（交 GPT 批量生产）

代码里先用占位，素材到位后只换资源登记，不改逻辑。风格统一按项目.md「奶白浅金」现代明亮卡通 + 手绘符记；战斗字效走世界显示 Token 的可读性要求（深色描边，任意地表上可读）。

| 编号 | 用途 | 规格 | 风格参照 | 当前占位 | 登记位置 | 状态 |
|---|---|---|---|---|---|---|
| A1 | 连斩字效：「连斩」「横扫」「无双」「神威」四档字样 + 0–9 数字 | 透明 PNG 图集；字样高 96px，数字高 72px；四档由暖白→浅金→橙金→棱彩渐强 | 现有伤害数字的描边与字重；手绘符记的柔和描边 | 文字（世界显示 Token 字体 + 描边） | `apps/web/src/kill-streak.ts`（FP1） | 已交 GPT（handoff/art-fp-a1-a5.md） |
| A2 | 首领阶段横幅底图 | 透明 PNG，1200×160，左右渐隐，中间可放 2 行字 | 奶白浅金横条，边缘手绘笔触，暗红点缀 | 纯色半透明条 + 文字 | `apps/web/src/boss-phase-banner.ts`（FP2） | 已交 GPT（handoff/art-fp-a1-a5.md） |
| A3 | 本场评价章 S / A / B | 透明 PNG，每枚 256×256 | 手绘印章感：S 金、A 银、B 铜，带少量星屑 | 圆形描边 + 大字母 | `apps/web/src/hub/run-grade.ts`（FP3） | 已交 GPT（handoff/art-fp-a1-a5.md） |
| A4 | 狩猎引雷桩（完整 / 碎裂两态 + 带电循环 6 帧） | 透明 PNG 图集，单帧 160×256，锚点底部中心 | 星潮海场景摆件比例；蓝白电弧 | 裂隙方尖碑 `ow-art-rift-rift-obelisk`（不着色），碎了不显示 | `apps/web/src/dungeon-controller.ts` `HUB_PYLON_ART` | 已交 GPT（handoff/art-fp-a1-a5.md） |
| A5 | 宝箱怪（待机伪装 / 苏醒 / 攻击 / 受击 / 死亡） | 与现有怪物图集同规格 | 现有航图宝箱外形 + 牙齿舌头，卡通不惊悚 | 本区精英模板的现有图集，名称改「宝箱怪」；苏醒时借 `danger_started` 圈 1 秒 | 服务端 `apps/api/src/dungeon-service.ts` `finishHubChest`（生成名 `宝箱怪`）；前端按名称/模板换图集时登记到 `packages/asset-manifest/actors.ts` | 已交 GPT（handoff/art-fp-a1-a5.md） |
| A6 | 星门地标（M01 §8 / M02 转场）：六角石环 + 旋转星图盘 | 分层图集：base 440×520、chart 300×300、glow 6 帧、ring-lit、open 8 帧；锚点底部中心 | 港口现有建筑（港务厅/工坊/码头）手绘厚涂 | 无（地标 `stargate` 只有坐标，转场暂无） | `packages/asset-manifest/starsea.v1.json` `ss-scene-stargate`；接线进 `ss-map-port` 装饰 + M02 转场 | 已交 GPT（handoff/art-hb-port-hex.md） |
| A7 | 港口建设摆件 ×12（M09 §3.4，三建筑×4 阶） | 静态透明 PNG，2× 出图，显示宽 48–96px，锚点底部中心；另合一张图集 | 同 A6 | 无 | `starsea.v1.json` `ss-scene-build-{forge,dock,post}-1…4`；接线按建设等级显示 | 已交 GPT（handoff/art-hb-port-hex.md） |
| A8 | 词缀（HEX）图标 ×59（d09）：11 个复用现有字形，48 个新画 | 50×50 内联 SVG 字形标记（单一强调填充，品质色由前端着色） | `hex-rune-icon.ts` 现有 12 字形 | 类别占位字形 / 通用标记 | `packages/asset-manifest/hex-glyphs.v1.json`；接线进 `hex-rune-icon.ts` | 已交 GPT（handoff/art-hb-port-hex.md） |
| A9 | 航图节点类型图标 6 + 收藏/未开放标记 2 | 透明 PNG 图集，源 96×96 | `ui-v2/icons/sys-*.png` 手绘 | `ui/icons.ts` 通用线条图标 | `chart-panel.ts` `KIND_ICONS` | 已交 GPT（handoff/art-hc-chart-ui.md C1） |
| A10 | 航区徽记 ×7（含灰暗态）+ 航图底图 ×7 | 徽记源 128×128；底图 2400×960 webp | 同上 / 手绘海图 | 文字页签、纯色面板 | 航图页签、节点图背景 | 已交 GPT（C2、C3） |
| A11 | 港口补充物件：仓库、宠物小院、外观铺、工坊外观 3 档、三位航区 NPC 摊位 | 同 A7 规格 | 港口现有建筑 | 无 | `starsea.v1.json` `ss-scene-port-*`、`ss-scene-workshop-tier-*` | 已交 GPT（C4） |
| A12 | 港口建设页插画：三建筑卡、阶级徽章、生命星晶/星核图标 | 图集，卡 480×320 | 奶白浅金 | 文字 + 进度条 | `hub/port-panel.ts` | 已交 GPT（C5） |
| A13 | U10 深潮菜单、U12 宠物图鉴示意图各 3 方案 | 1280×720 PNG（本地） | U2/U9 已选方案 B | — | Claude 裁决后做前端 | 已交 GPT（C6） |
| A14 | 怪潮信标（满/受损/危急/受击/倒塌 + 守护光圈） | 图集，单帧 192×256，锚点底部中心 | A4/A5 场景基准 | 无场景表现，仅 HUD 耐久条 | `open-world-five.v1.json` `ow-art-hub-tide-beacon` | 已交 GPT（handoff/art-hd-dungeon-fx.md D1） |
| A15 | 涨潮淹没（水贴片、预警、退水、脚下水花） | 图集，贴片 128×64 | 同上 | 无（只有服务端 `flood`） | `ow-art-hub-hunt-flood`、`fx-hub-flood-splash` | 已交 GPT（D2） |
| A16 | 落石（预警圈、落石、砸地、碎石残留） | 图集 | 同上 | 无（只有服务端 `rockfall`） | `fx-hub-rockfall`、`ow-art-hub-rock-rubble` | 已交 GPT（D3） |
| A17 | 副本采集点 6 航区 × 矿/植物（含已采态） | 图集，单帧 128×128 | 同上 | `gatherArt()` 借 rocks/bush/flowers | `ow-art-hub-gather-*` | 已交 GPT（D4） |
| A18 | 三选一卡框 银/金/棱彩 + 流光 + 贴合构筑小标 | 九宫格 440×600 | 奶白浅金 | 公共卡片控件 | `augments-panel.ts` | **作废**（10-24 潮印撤销，见 planning-bd-v1/20） |
| A19 | 找回刻片图标（亮/暗）+ 找回演出 | 图集 | 奶白浅金 | 无 | 节点卡片、`growth-cards.ts` | 已交 GPT（D6） |
| A20 | 制作材料图标 ×20（6 航区草/部件/首领核心 + 强化石、星尘） | 256×256 PNG，`item-material-<id>` | `items-chibi/` | `materialIcon()` 借通用图并着色 | `ui.v2.json`（登记即自动生效） | 已交 GPT（handoff/art-he-items-ui.md E1） |
| A21 | 消耗品图标 ×10（7 抗性药剂 + 3 料理） | 同上，`item-<id>` | 同上 | 借生命药水/草药图 | `ui.v2.json`（自动生效） | 已交 GPT（E2） |
| A22 | 召唤石 6、残页 3+通用底、三建筑声望徽记、星潮之力 | 同上 | 同上 | 宝箱/菱形线条图标 | `ui.v2.json`；进度页 | 已交 GPT（E3） |
| A23 | 右下菜单入口插画 ×8（今日/委托/港口建设/航图/仓库/档案/宠物/星门） | SVG，照 `hudMenuIcon` | 现有 7 个菜单插画 | 无 | `ui-illustrations.v1.json` → `hud-icons.ts` | 已交 GPT（E4） |
| A24 | 港口建筑头顶标识 ×8 + 角标 3 | 128×128 图集 | 奶白浅金 | 无（M15 U1 红点） | `hub-ui.v1.json` | 已交 GPT（E5） |
| A25 | 界面插画图标补齐 ×30（系统/元素/属性） | SVG，照 `illustrations` | 现有 18 个插画图标 | 线条图标 | `ui-illustrations.v1.json` → `ui/icons.ts` | 已交 GPT（E6） |
| A26 | 组件装饰件：品质格框 4 + 流光、标题花饰、分隔线、角花、提示尖角、提示条底 | 九宫格 PNG 图集 | Token 观感 | CSS | 方向 A 决定接入（planning-bd-v1/22 U0） | 已交付 `hub-ui/ui-ornaments.*` |
| A27 | 秘藏宝箱（M17 Z4）：hidden / glint 6 帧 / opened | 图集，单帧 160×160，锚点底部中心 | 现有宝箱、引雷桩 | 借现有宝箱图 | `ow-art-hub-cache` | 已交 GPT（ART-HF） |
| A28 | 锁门 ×2（雾锁门、炉锁门）：locked / open / opening 6 帧 | 图集，单帧 256×256 | 同上 | 剪影占位 | `ow-art-hub-door-mist`、`ow-art-hub-door-forge` | 已交 GPT（ART-HF） |
| A29 | 关口钥匙图标 ×6（含未获得灰版） | 128×128 PNG | 航区徽记 | 文字 | 航图节点卡、钥匙栏 | 已交 GPT（ART-HF） |
| A30 | 共鸣徽记 6 档 + 部位格框 3 态 | 128×128 / 96×96 PNG | 奶白浅金 | CSS 徽记 | 锻造「部位强化」页 | 已交 GPT（ART-HF） |
| A31 | 宠物阵容框（上阵/助阵 + 空槽）+ 流派选中底 | 320×360 / 200×220 / 96×96 | 奶白浅金 | CSS 框 | 宠物面板 | 已交 GPT（ART-HF） |
| A32 | 探索度圆环分层（底框、三段弧、里程碑星） | 128×128 分层 PNG | 奶白浅金 | CSS conic 圆环 | 航图航区标题 | 已交 GPT（ART-HF） |
| A33 | 火焰/暗影元素图标（A25 缺则补） | 同 A25 | A25 | 文字 | 节点卡元素行 | 已交 GPT（ART-HF） |
| A34 | 缎带标题底 ×3（胜利金/撤退灰蓝/解锁浅金） | 九宫格 720×120 | 方向 A 对照页 + E7 | CSS 渐变缎带 | `ribbonTitleHtml`（U1） | 已交 GPT（handoff/art-hg-game-feel.md G1） |
| A35 | 星级星 亮/暗 + 点亮闪光 6 帧 | 96×96 / 128×128 | 同上 | 文字 ★ | U1 结算 | 已交 GPT（G2） |
| A36 | NEW / HEX 角标 + 经验图标 | 96×48 / 128×128 | 金币图标 | CSS 角标、绿圆 | `resourcePillHtml`、`rewardRevealHtml` | 已交 GPT（G3） |
| A37 | 结算放射光底 + 星屑粒子 ×8 | 800×800 / 32–48px | 浅金 | 无 | `ceremony.css`（U1） | 已交 GPT（G4） |
| A38 | 空状态插画 ×6 | 320×240 | 港口建筑原稿、items-chibi | 线条图标 | `stateBlockHtml` | 已交 GPT（G5） |
| A39 | 战棋棋盘地表：按航区手绘地表块（草/土/石板各 3 变体 + 过渡边）、棋盘四周收边（崖壁/灌木/水岸）、格线改地表浅刻纹 | 128×128 无缝贴片图集 + 收边九宫格；2× 出图 | `docs/scene-dressing.md` 野外地表与道路材质；Q 版角色的柔和深描边 | 单张草地平铺 + CSS 网格线 | `tactical/board-view.ts` 地表层（接入由 Claude 做） | 作废（2026-10-25 撤销战棋，见 planning-bd-v1/27） |
| A40 | 战棋场景构图摆件：每航区 8–12 件（残墙、木箱、篝火、旗帜、碎石堆等），分占格 / 不占格两类 | 透明 PNG，显示宽 0.6–1.6 格，锚点底部中心 | 现有棋盘树木/岩石摆件；港口建筑手绘厚涂 | 只有树和石头，中间大片空地 | `tactical` 遭遇配置的 dressing 列表 | 作废（同 A39） |
| A41 | 战棋 HUD 牌匾件：金边牌匾九宫格（回合牌/行动序/生命牌）、技能槽底座 可用/选中/锁定 3 态、圆形图标钮底 | 九宫格 PNG；槽底 128×128；钮底 96×96 | E7 `ui-ornaments` 稀有金框；方向 A 4px 底边 + 内高光；禁皮革/铜钉/浮雕 | CSS 金边渐变 + E7 稀有框覆层 | `tactical/tactical.css` HUD 材质段 | 作废（同 A39；金边牌匾材质可留给 R3 爆发键另行提需求） |

## 方向 A 剩余批次占位接入登记（2026-10-24）

沿用现有资源，正式素材交付后只更新登记/URL；以下为新增使用位置，不重复启动美术制作。

| 批次 / 用途 | 当前占位 | 接入位置 | 后续替换依据 |
|---|---|---|---|
| U0 缎带、星级、NEW/HEX、空奖励 | 现有 CSS 缎带、`star` 图标及暗星色、CSS 角标、空状态线图 | `ui/primitives.ts`、`ui/ceremony.css` | A34–A38，当前登记库未见对应交付条目 |
| U4 工坊配方分类 / 设施 | `swords`、`diamond`、`book`、`armor`、`arcane`、`poison` / `hammer` | `components/CraftingPanel.ts` | 现有 `ui/icons.ts`，以后按配方/设施正式图登记替换 |
| U4 养成模块 | 雕文 `skillRadius`、突破阶段 `star`、声望 `compass` | `progression-layouts.ts`、`progression-panel.ts` | 现有通用图标；材料继续使用 A20/A22 的既有解析器 |
| U6 未带物品 ID 的战棋奖励 | `chest` 宝箱图标、中性格 | `tactical/presentation.ts` | 先由 Claude 裁决奖励元数据契约，再按真实物品登记替换；不推测品质/评级 |
| U6 开局技能优先级 / 双方标识 | `star` / `people`、`skull` | `tactical/tactical-board.ts`、`tactical/controller.ts` | 已有通用图标；正式技能图仅在真实 iconSrc 存在时接入 |


## 战棋紧凑 HUD 使用登记（2026-10-25）

用户最新确认：布局沿用，组件复用项目现有公共件。H3 在本页面改用现有 SVG 角饰、按钮和槽位，不接入独立厚重牌匾皮肤；H1/H2 交付状态不因本轮 HUD 落地而改变。

| 用途 | 当前占位 / 复用 | 接入位置 | 后续替换依据 |
|---|---|---|---|
| 行动区双方标识 | 公共 people / skull 图标与真实单位名 | tactical/controller.ts | 有正式头像映射后只替换资源，不推测敌人身份 |
| 技能缺图 / 空槽 | 公共 swords / lock | tactical/hud.ts | iconSrc 存在时直接使用已登记图标；空槽不补造技能 |
| 宠物头像加载中或缺图 | pet-portrait.ts；缺资源时公共 star | tactical/compact-status.ts | 使用真实 runtimeId 对应图集，加载完成后替换占位；状态角标不代表当前护盾 |


### 2026-10-25 实机纠偏更新

- H1/H2 当前场景层实际复用 `scene-art.ts` 中的海面、sand/soil/stone、cliff-straight 与已有柱/箱/旗/花草；A39/A40 专用素材仍未交付。未引入生成背景或第三方新素材。
- 行动区主角改用已有 portrait-bust，敌人按真实 assetId 读取既有图集 idle 帧；people/skull 仅保留失败占位。
- 沙盒八种技能已按真实技能 ID 接入已登记的手绘符记，通用 swords 只用于未知或缺图的能力。空槽继续 lock，不新增技能内容。
- 单位标签统一布局后不再并排叠加旧姓名板和意图 pill。美术加载或数据缺口均不能用“测试通过”代替视觉验收。
