# ART-FP A1–A5 进度

执行日期：2026-10-22。严格顺序 R0 → A1 → A2 → A3 → A4 → A5 → R9；仅出图与资源登记，不修改 apps/web/src，不运行浏览器。

- [x] R0 基准板与协作登记：`.runtime/art-fp/baseline.png`，1200×660，sha256 143084f70b11。项目色板、真实伤害数字旧截图、巡猎兽、冻舰巡守、宝箱、方尖碑齐全；协作中心低于归档门槛。
- [x] A1 连斩字效：`apps/web/public/art/hub-fun/kill-streak.{png,json}`，(932, 400)；15帧，字样96px高、数字/×72px高、4px深描边；sha256 a65ebfefce5f。NotoSansSC 900字重，分档渐变与少量生成笔触星屑；三地表对比及半尺寸可读性通过。
- [x] A2 首领横幅：`boss-banner.png` / `boss-banner-shield.png`，1200×160，sha256 f73b2a65c065 / 4ef2e00bb324。左右各180px渐隐，x240–960/y24–136为两行安全区；48px/28px试排清楚。
- [x] A3 评价章：`grade-{s,a,b}.png`，各256×256，sha256 c400cb61bd42 / 2f8f2222963e / 1e048b5af12e；64px缩略通过。
- [x] A4 引雷桩：`hunt-pylon.{png,json}`，656×520，8帧160×256，锚点[0.5,1]；sha256 08e36accf634。完整/碎裂/六帧电弧，54px剪影可辨，登记 `ow-art-hub-hunt-pylon`。
- [x] A5 宝箱怪：`mimic.{png,json}`，1820×1560，36张256×256原帧，锚点[0.5,0.90625]；sha256 dd11f959c0cc。idle4/wake10/move6/attack6/hurt4/death6，54px剪影可辨；已清相邻格碎片，登记 `hub-mimic`。
- [x] R9 总览与交接：`.runtime/art-fp/overview.png`，1600×1290，sha256 d7212fefe7d6；本批技术/清单/类型/内容检查通过，既有非资源断言失败单独留档（见下），仅提交资源JSON与本交接两份MD，协作中心转待接线。

## 最终交付与验收证据

- 运行时目录：`apps/web/public/art/hub-fun/`，15个文件（10 PNG + 5 JSON），合计 **3,830,842字节 / 3.83MB**，低于6,000,000字节；单图集最大1820×1560，小于2048×2048。
- 全部PNG已嵌入sRGB ICC；straight alpha，不预乘；全透明像素RGB归零。TexturePacker hash，2px透明内边距，不旋转，frame/sourceSize不裁切。
- 完整文件路径、尺寸和SHA256登记在 `packages/asset-manifest/hub-fun.v1.json`；A4/A5来源、调整、原图和运行时哈希登记在 `packages/asset-manifest/open-world-five.v1.json`。经既有 `open-world-assets.ts → actors.ts/runtime-resources.ts` 读取，无需修改这两个适配器。
- 基准与逐项对比：`.runtime/art-fp/baseline.png`、`a1-comparison.png` 至 `a5-comparison.png`；每张均带现有巡猎兽、冻舰巡守、航图宝箱和方尖碑。草地/沙地/暗石地逐行检查。`silhouettes-comparison.png` 检查54px可见高度黑剪影；`mimic-contact.png` 检查36帧，邻格残片已清除。
- 本地逐帧预览：`.runtime/art-fp/pylon-loop.gif`、`mimic-{idle,wake,move,attack,hurt,death}.gif`。未开游戏、未跑浏览器自动化；GIF和拼图是离线美术证据，不是实机接线验收。
- 原稿、图像生成提示规格、字体合成配方：`.runtime/art-fp/source/`；`prompts.json` 记录各项生产提示规格。使用内置imagegen，本机库检索，无素材下载。重任务串行。
- A1：四档阈值10/25/50/100，字体NotoSansSC 900；96px字样与72px数字为源尺寸，建议显示48/36px高，深描边4px源像素。
- A2：源图中心安全区x240–960/y24–136；48px首行和28px次行是源坐标字号，显示600×80时对应24px/14px。图内无预烘焙文案。
- A3：256源图可显示128或64px，金/银/铜与字母双重表达等级。
- A4：图集8帧共用160×256画布；石桩身体固定，仅叠生成电弧。另附静态idle/broken图，便于现有sprite消费者接入；完整/破碎的实际接地在y252，底部4px透明安全边，统一origin[0.5,1]。
- A5：36张独立帧。idle用四张图引用成18帧/6fps的3秒闭箱慢循环；wake10帧/10fps；move6帧/10fps；attack6帧/10fps；hurt4帧/12fps；death6帧/8fps。`skill`仅别名引用attack，用于既有加载契约，不增加技能或规则。`mimic.sockets.json`为视觉估计挂点，不宣称原生骨骼或真实攻击时序。

## 检查结果（如实保留基线失败）

| 检查 | 结果 | 本地日志 |
| --- | --- | --- |
| `npx tsc --noEmit -p .` | 通过，最终清单变更后复跑通过 | `.runtime/art-fp/tsc-final.log` |
| `pnpm config:check` | 通过，9本工作簿一致 | `.runtime/art-fp/config-check.log` |
| `npx tsx tools/validate-content.ts` | 通过，99地区、83技能、155角色 | `.runtime/art-fp/content-check.log` |
| grep `asset-manifest` 找到15份测试，`npx vitest run --maxWorkers=1 --no-file-parallelism <15 files>` | 63/64通过；唯一失败不是美术/清单断言，详见下文 | `.runtime/art-fp/manifest-tests.log` |
| 本批技术检查 `python -X utf8 .runtime/art-fp/verify.py` | 通过，15文件哈希、sRGB、透明边界、2px图集间隔、帧名/尺寸、动作与挂点及体积预算 | `.runtime/art-fp/technical-check.json` |
| 直接导入actorCatalog/runtimeResources | 通过，hub-mimic为atlas且wake10帧，ow-art-hub-hunt-pylon可读取 | 已实际运行tsx导入检查 |

既有失败：`tests/plane-scenes.test.ts:14` 断言旧巢穴返回`ss-map-wind`，当前内容返回`ss-map-port`。以**修改前HEAD的five资源清单**替换测试依赖后，在本地独立配置复跑仍为5/6通过、同一断言失败（`.runtime/art-fp/baseline-test.log`、`baseline-vitest.config.ts`）。该用例失败与A4/A5登记无关；不为迎合旧断言回退既定返回主城设计，不改正式测试、不隐藏失败。请Claude随主城改版统一验收口径。本批资源相关断言通过，不能将本报告表述为全仓单测全绿。

## Git与交接边界

本批提交仅：`packages/asset-manifest/open-world-five.v1.json`、`packages/asset-manifest/hub-fun.v1.json`、本文件、`art-fp-decisions.md`。图片、源图、GIF、对比图、技术脚本及原始日志均位于被忽略目录；提交前检查`git diff --cached --stat`及暂存文件扩展名。未编辑`apps/web/src`玩法/表现逻辑，未修改数值或服务器宝箱怪模板。

## 接线清单

以下URL以web public为根；所有PNG采用straight alpha。清单内`accepted:false`与“待接线”表示美术已交付，尚未冒充实机接线完成。

| 资源路径 | 帧名 | 锚点 | 建议显示尺寸 | 替换哪个占位常量 / 接线入口 |
| --- | --- | --- | --- | --- |
| `/art/hub-fun/kill-streak.{png,json}` | `streak-tier-1…4`、`streak-digit-0…9`、`streak-x` | [0.5,0.5]；字/数字同行中心对齐 | tier源96高→显示48高；数字源72高→显示36高 | `kill-streak.ts` 的 `KILL_STREAK_ART_KEY`；保留KILL_STREAK_TIERS 10/25/50/100，3–9沿用第1档 |
| `/art/hub-fun/boss-banner.png` | 单图 | [0.5,0.5] | 600×80；安全区源x240–960/y24–136 | `boss-phase-banner.ts` 的 `BOSS_BANNER_ART_KEY`，狂暴阶段横条；文字仍由现有逻辑绘制 |
| `/art/hub-fun/boss-banner-shield.png` | 单图 | [0.5,0.5] | 600×80 | 同横幅模块的`announce`护盾破碎分支；使用冷色图 |
| `/art/hub-fun/grade-s.png`、`grade-a.png`、`grade-b.png` | 单图S/A/B | [0.5,0.5] | 128×128；紧凑结算可64×64 | `hub/run-grade.ts`现有评价结果；替换结算UI的圆形描边与字母占位，不改评分规则 |
| `/art/hub-fun/hunt-pylon.{png,json}` | `pylon-idle`、`pylon-broken`、`pylon-charge-0…5` | [0.5,1] | 80×128（源160×256） | `dungeon-controller.ts` 的 `HUB_PYLON_ART`→`ow-art-hub-hunt-pylon`；broken保持碎裂图，charge 10fps循环 |
| `/art/hub-fun/hunt-pylon-idle.png`、`hunt-pylon-broken.png` | 两张静态单图 | [0.5,1] | 80×128 | 兼容现有sprite对象路径，完整态`runtime.file`已登记；接线时显式消费atlas/stateFrames；目前`pylonObjects()`会过滤broken，展示碎裂需Claude处理该表现分支 |
| `/art/hub-fun/mimic.{png,json}` + `mimic.profile.json` + `mimic.sockets.json` | `idle_0…3`、`wake_0…9`、`move_0…5`、`attack_0…5`、`hurt_0…3`、`death_0…5` | [0.5,0.90625]，脚点[128,232] | 源256×256→显示128×128，scale0.5 | 只在寻宝实例内把**名称精确为「宝箱怪」**的精英表现映射到`hub-mimic`；不改服务端template/hp/奖励。载入后wake播放一次；苏醒后动作间隙保持`wake_9`，不要循环伪装idle；减少动态可停终态 |
