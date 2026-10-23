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
| A18 | 三选一卡框 银/金/棱彩 + 流光 + 贴合构筑小标 | 九宫格 440×600 | 奶白浅金 | 公共卡片控件 | `augments-panel.ts` | 已交 GPT（D5） |
| A19 | 找回刻片图标（亮/暗）+ 找回演出 | 图集 | 奶白浅金 | 无 | 节点卡片、`growth-cards.ts` | 已交 GPT（D6） |
| A20 | 制作材料图标 ×20（6 航区草/部件/首领核心 + 强化石、星尘） | 256×256 PNG，`item-material-<id>` | `items-chibi/` | `materialIcon()` 借通用图并着色 | `ui.v2.json`（登记即自动生效） | 已交 GPT（handoff/art-he-items-ui.md E1） |
| A21 | 消耗品图标 ×10（7 抗性药剂 + 3 料理） | 同上，`item-<id>` | 同上 | 借生命药水/草药图 | `ui.v2.json`（自动生效） | 已交 GPT（E2） |
| A22 | 召唤石 6、残页 3+通用底、三建筑声望徽记、星潮之力 | 同上 | 同上 | 宝箱/菱形线条图标 | `ui.v2.json`；进度页 | 已交 GPT（E3） |
| A23 | 右下菜单入口插画 ×8（今日/委托/港口建设/航图/仓库/档案/宠物/星门） | SVG，照 `hudMenuIcon` | 现有 7 个菜单插画 | 无 | `ui-illustrations.v1.json` → `hud-icons.ts` | 已交 GPT（E4） |
| A24 | 港口建筑头顶标识 ×8 + 角标 3 | 128×128 图集 | 奶白浅金 | 无（M15 U1 红点） | `hub-ui.v1.json` | 已交 GPT（E5） |
| A25 | 界面插画图标补齐 ×30（系统/元素/属性） | SVG，照 `illustrations` | 现有 18 个插画图标 | 线条图标 | `ui-illustrations.v1.json` → `ui/icons.ts` | 已交 GPT（E6） |
| A26 | 组件装饰件：品质格框 4 + 流光、标题花饰、分隔线、角花、提示尖角、提示条底 | 九宫格 PNG 图集 | Token 观感 | CSS | Claude 决定是否接 | 已交 GPT（E7） |
| A27 | 秘藏宝箱（M17 Z4）：hidden / glint 6 帧 / opened | 图集，单帧 160×160，锚点底部中心 | 现有宝箱、引雷桩 | 借现有宝箱图 | `ow-art-hub-cache` | 已交 GPT（ART-HF） |
| A28 | 锁门 ×2（雾锁门、炉锁门）：locked / open / opening 6 帧 | 图集，单帧 256×256 | 同上 | 剪影占位 | `ow-art-hub-door-mist`、`ow-art-hub-door-forge` | 已交 GPT（ART-HF） |
| A29 | 关口钥匙图标 ×6（含未获得灰版） | 128×128 PNG | 航区徽记 | 文字 | 航图节点卡、钥匙栏 | 已交 GPT（ART-HF） |
| A30 | 共鸣徽记 6 档 + 部位格框 3 态 | 128×128 / 96×96 PNG | 奶白浅金 | CSS 徽记 | 锻造「部位强化」页 | 已交 GPT（ART-HF） |
| A31 | 宠物阵容框（上阵/助阵 + 空槽）+ 流派选中底 | 320×360 / 200×220 / 96×96 | 奶白浅金 | CSS 框 | 宠物面板 | 已交 GPT（ART-HF） |
| A32 | 探索度圆环分层（底框、三段弧、里程碑星） | 128×128 分层 PNG | 奶白浅金 | CSS conic 圆环 | 航图航区标题 | 已交 GPT（ART-HF） |
| A33 | 火焰/暗影元素图标（A25 缺则补） | 同 A25 | A25 | 文字 | 节点卡元素行 | 已交 GPT（ART-HF） |
