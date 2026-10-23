# ART-HF 进度

2026-10-23，按 R0 → A27…A33 → R9 连续执行。

- [x] R0 准备
- [x] A27 秘藏
- [x] A28 两种锁门
- [x] A29 六把钥匙
- [x] A30 共鸣与部位格
- [x] A31 宠物阵容框
- [x] A32 探索度
- [x] A33 元素补图
- [x] R9 验收与交付

## R0

- `.runtime/art-hf/baseline.png`｜1200×630｜sha256 `e61244887566`

自检：已看基准板，宝箱、引雷桩、巡猎兽、ART-HE与九流派齐全。协作文档26578字符，未达40000归档阈值；已通过专用脚本加任务行。

## A27

- `apps/web/public/art/hub-fun/hub-cache.png`｜656×328｜sha256 `6edeb05bd2cc`
- `apps/web/public/art/hub-fun/hub-cache.json`｜—×—｜sha256 `d41c23a67a98`
- `apps/web/public/art/hub-fun/hub-cache-hidden.png`｜160×160｜sha256 `a6746b53ff95`
- `apps/web/public/art/hub-fun/hub-cache-glint.png`｜160×160｜sha256 `393128220e31`
- `apps/web/public/art/hub-fun/hub-cache-opened.png`｜160×160｜sha256 `259c44ccf8e6`
- `.runtime/art-hf/A27-compare.png`｜1200×750｜sha256 `1fb8a448fa98`

自检：160×160三态和6帧闪光齐全，固定箱体叠加本地ART-HE光笔触；草/沙/暗石与现有箱并排检查，旧箱尺寸更小、半埋、开盖空箱可辨。54px复查后按D-F5修正一次，减少土石、加强箱盖轮廓与大色面；新版与现有宝箱更一致。hidden仍半藏，只露上角，按D-F1保留；glint彩色与开盖状态可明确辨识。

## A28

- `apps/web/public/art/hub-fun/hub-door-mist.png`｜1040×520｜sha256 `b6b19bfb667e`
- `apps/web/public/art/hub-fun/hub-door-mist.json`｜—×—｜sha256 `0f44ec492fab`
- `apps/web/public/art/hub-fun/hub-door-mist-locked.png`｜256×256｜sha256 `221befb38c0f`
- `apps/web/public/art/hub-fun/hub-door-mist-opening.png`｜256×256｜sha256 `57df87a16f65`
- `apps/web/public/art/hub-fun/hub-door-mist-open.png`｜256×256｜sha256 `a154fa0673f2`
- `apps/web/public/art/hub-fun/hub-door-forge.png`｜1040×520｜sha256 `b63559690449`
- `apps/web/public/art/hub-fun/hub-door-forge.json`｜—×—｜sha256 `071db8db8d63`
- `apps/web/public/art/hub-fun/hub-door-forge-locked.png`｜256×256｜sha256 `4d628bbb8275`
- `apps/web/public/art/hub-fun/hub-door-forge-opening.png`｜256×256｜sha256 `1733303b3346`
- `apps/web/public/art/hub-fun/hub-door-forge-open.png`｜256×256｜sha256 `09df37f2421c`
- `.runtime/art-hf/A28-compare.png`｜1200×750｜sha256 `f2e1c73a9464`

自检：两门各256×256、locked/open与opening-0…5完整，8帧共享同一石拱与门槛。三地表并排检查通过，铃锁与炉口锁可辨；opened状态别名同时登记，兼容现有场景state。背景遮罩导出已清理，轮廓透明。

## A29

- `apps/web/public/art/hub-ui/keys/key-dragon-locked.png`｜128×128｜sha256 `b6fa0edd5bf6`
- `apps/web/public/art/hub-ui/keys/key-dragon.png`｜128×128｜sha256 `189e74207653`
- `apps/web/public/art/hub-ui/keys/key-forge-locked.png`｜128×128｜sha256 `260154338f61`
- `apps/web/public/art/hub-ui/keys/key-forge.png`｜128×128｜sha256 `0c081421ff02`
- `apps/web/public/art/hub-ui/keys/key-frost-locked.png`｜128×128｜sha256 `f0ee1cdc49e5`
- `apps/web/public/art/hub-ui/keys/key-frost.png`｜128×128｜sha256 `0de3382820e3`
- `apps/web/public/art/hub-ui/keys/key-mist-locked.png`｜128×128｜sha256 `35fcbf24e443`
- `apps/web/public/art/hub-ui/keys/key-mist.png`｜128×128｜sha256 `e5a3a852d547`
- `apps/web/public/art/hub-ui/keys/key-rift-locked.png`｜128×128｜sha256 `f7479c5b8026`
- `apps/web/public/art/hub-ui/keys/key-rift.png`｜128×128｜sha256 `c58e20a3c9bf`
- `apps/web/public/art/hub-ui/keys/key-wind-locked.png`｜128×128｜sha256 `a258019c681a`
- `apps/web/public/art/hub-ui/keys/key-wind.png`｜128×128｜sha256 `620565265170`
- `.runtime/art-hf/A29-compare.png`｜1200×600｜sha256 `57e14d5bc182`

自检：六区徽记与新绘分层金属钥匙杆合成，12张128×128透明PNG，彩色/灰色一一对应，轮廓与图案一致。已与基准并排查看；未直接交付未处理库图。

## A30

- `apps/web/public/art/hub-ui/resonance/resonance-0.png`｜128×128｜sha256 `10e248ebd077`
- `apps/web/public/art/hub-ui/resonance/resonance-1.png`｜128×128｜sha256 `12a03dcfb624`
- `apps/web/public/art/hub-ui/resonance/resonance-2.png`｜128×128｜sha256 `8d2112f8b44c`
- `apps/web/public/art/hub-ui/resonance/resonance-3.png`｜128×128｜sha256 `9011e69eb790`
- `apps/web/public/art/hub-ui/resonance/resonance-4.png`｜128×128｜sha256 `eb7893de96f5`
- `apps/web/public/art/hub-ui/resonance/resonance-5.png`｜128×128｜sha256 `afed87f7e0ba`
- `apps/web/public/art/hub-ui/resonance/slot-limited.png`｜96×96｜sha256 `1272c7a82ee7`
- `apps/web/public/art/hub-ui/resonance/slot-maxed.png`｜96×96｜sha256 `3f6b1730b048`
- `apps/web/public/art/hub-ui/resonance/slot-normal.png`｜96×96｜sha256 `202b9cfc5e43`
- `.runtime/art-hf/A30-compare.png`｜1200×600｜sha256 `f3b4ae627008`

自检：六角共鸣0–5档，同一主体逐角点亮；5档六角全亮带浅光晕。部位格3态96×96，保留ART-HE细花饰框，limited右上锁、maxed金边，中心透明。并排检查层级和状态不改变尺寸。

## A31

- `apps/web/public/art/hub-ui/pets/flow-selected.png`｜96×96｜sha256 `1202b0b74d9e`
- `apps/web/public/art/hub-ui/pets/lineup-main-empty.png`｜320×360｜sha256 `f76a70dce524`
- `apps/web/public/art/hub-ui/pets/lineup-main.png`｜320×360｜sha256 `a01023f16cfd`
- `apps/web/public/art/hub-ui/pets/lineup-support-empty.png`｜200×220｜sha256 `172698d577bc`
- `apps/web/public/art/hub-ui/pets/lineup-support.png`｜200×220｜sha256 `44f199ccf808`
- `.runtime/art-hf/A31-compare.png`｜1200×600｜sha256 `ee955346c49b`

自检：主框320×360、助阵200×220，实槽透明内腔与脚底椭圆留空；各有虚线+加号空槽。选中光圈96×96，九个badge原图不重画。小尺寸并排可辨主/辅层级，暖金细框与奶白底融合；已清理生成边缘孤立透明噪点。

## A32

- `apps/web/public/art/hub-ui/explore/icon-cache.png`｜48×48｜sha256 `bf93ff77b4ad`
- `apps/web/public/art/hub-ui/explore/icon-door.png`｜48×48｜sha256 `b26767b47cf1`
- `apps/web/public/art/hub-ui/explore/icon-node.png`｜48×48｜sha256 `232f874d1687`
- `apps/web/public/art/hub-ui/explore/ring-arc-caches.png`｜128×128｜sha256 `7718f8e9ddfc`
- `apps/web/public/art/hub-ui/explore/ring-arc-doors.png`｜128×128｜sha256 `dff5e5af75ac`
- `apps/web/public/art/hub-ui/explore/ring-arc-nodes.png`｜128×128｜sha256 `79079c13f6e3`
- `apps/web/public/art/hub-ui/explore/ring-base.png`｜128×128｜sha256 `9d349c105c85`
- `apps/web/public/art/hub-ui/explore/ring-star-off.png`｜128×128｜sha256 `19817426f004`
- `apps/web/public/art/hub-ui/explore/ring-star-on.png`｜128×128｜sha256 `25a3970866fa`
- `.runtime/art-hf/A32-compare.png`｜1200×600｜sha256 `8406aac03c5a`

自检：128px底框、3色整圈进度层、两星齐全；48px清单三图标可辨。并排检查三个环同心同半径、中心透明，前端可独立遮罩。节点蓝、秘藏金、锁门紫均引用已有Token。

## A33

- `packages/asset-manifest/ui-illustrations.v1.json`｜—×—｜sha256 `a954b817f8e9`
- `.runtime/art-hf/A33-compare.png`｜750×155｜sha256 `17c1a7d71f24`

自检：A25补充清单原无fire/shadow；fire复用基础UI既有火焰轮廓并使用element-fire内焰，shadow补彩色月牙星。两项写回A25同目录同icons键，viewBox32×32、2px主描边，64/24px与A25六元素并排检查通过；不改前端。

## R9 验收与交付

- 运行时：50 个文件（47 PNG + 3 TexturePacker hash JSON），2,285,429 bytes / 6,000,000 bytes。场景图集24帧，UI35张，A33另外2个内嵌SVG图标，9个宠物流派徽记复用。
- `npx tsc --noEmit -p .`：通过，最终像素修正后复验 exit 0；日志 `.runtime/art-hf/tsc.log`。
- `pnpm config:check`：通过，10本工作簿一致；日志 `.runtime/art-hf/config-check.log`。
- 资源相关单测：`npx vitest run <tests中直接引用asset-manifest的16个测试文件> --maxWorkers=1`，16文件 / 83测试全部通过，命令完整列表在下方；日志 `.runtime/art-hf/manifest-tests.log`。
- `python .runtime/art-hf/validate.py`：通过。检查精确尺寸、完整SHA256、RGBA/sRGB/straight alpha、透明像素RGB为零、2px边距、不旋转不裁切、图集≤2048、全部帧名/状态别名、元素Token引用和9个旧徽记路径。
- `npx tsx .runtime/art-hf/resolve.ts`：通过。三个场景id、default/hidden/glint/opened与locked/open/opened共12个静态状态从正式runtimeResources解析，无占位回退。
- 已查看三地表总览、54px黑剪影、64px界面拼图和24px元素拼图；秘藏在R9按D-F5修正一次后采用更清楚的版本，原稿保留本地。
- 全程未下载新素材、未改玩法/数值/前端代码、未运行浏览器或浏览器自动化；本机检查串行。静态拼图不能冒充实机动画验收。
- 图像生成使用内置imagegen；生成规格和修订记录 `.runtime/art-hf/source/prompts.json`，原图与可重放导出脚本均在 `.runtime/art-hf/`，不入Git。
- 清单：`open-world-five.v1.json`仅新增3个指定场景id；`hub-hf.v1.json`记录35张UI及来源/预算；`ui-illustrations.v1.json`仅补fire/shadow。与开始快照语义比对，其他条目保持不变。
- Git仅提交上述3份JSON与本进度、决策文件；图片、图集旁车JSON、源稿、总览均为本地忽略文件。协作中心通过专用脚本改为「待接线」并追加指定留言。

测试文件（均在tests/）：effect-attachments、hub-art-wiring、legacy-actor-art、lightning-arrow-vfx、loaded-actor-animations、plane-layouts、plane-scenes、skill-effects、story-npc-art、telegraph-polish、vfx-art、vfx-hit-style、vfx-physical、vfx-presence、world-resource-wiring、world-tables；均以`.test.ts`结尾。

### 完成定义

- [x] A27–A33运行时文件与尺寸、帧名、锚点齐全。
- [x] 各项与基准并排查看；三地表总览完成，本地保留。
- [x] A27/A28指定id登记，完整技术校验通过。
- [x] 接线清单完整，静态与动画消费边界写明。
- [x] 提交范围无图片；协作状态待接线。

- `.runtime/art-hf/overview.png`｜3600×1020｜sha256 `27f1d2d901e5`

- `.runtime/art-hf/silhouettes-54.png`｜1000×180｜sha256 `41719afc1e85`

- `.runtime/art-hf/ui-64.png`｜1200×760｜sha256 `d8745220b349`

## 接线清单

以下路径相对`apps/web/public`，清单相对`packages/asset-manifest`。逐文件完整哈希见`hub-hf.v1.json`或场景five清单；上文逐项列sha256前12位。所有源尺寸按交接§2，建议显示为一半；锚点使用归一化坐标。

| 资源路径 | 帧名/键 | 锚点 | 建议显示尺寸 | 替换占位/接入位置 |
|---|---|---|---|---|
| `/art/hub-fun/hub-cache.{png,json}` | `hidden`、`glint-0…5`、`opened` | [0.5,1] | 80×80 | `ow-art-hub-cache`，秘藏宝箱；替代fine-chest占位 |
| `/art/hub-fun/hub-cache-{hidden,glint,opened}.png` | 静态状态同文件名；default=hidden，glint=峰值帧3 | [0.5,1] | 80×80 | 当前prop的stateFiles自动取图 |
| `/art/hub-fun/hub-door-mist.{png,json}` | `locked`、`opening-0…5`、`open` | [0.5,1] | 128×128，洞口约2格 | `ow-art-hub-door-mist`，风栖雾锁门，铃钥 |
| `/art/hub-fun/hub-door-forge.{png,json}` | 同上 | [0.5,1] | 128×128 | `ow-art-hub-door-forge`，雾铃炉锁门，炉钥 |
| `/art/hub-fun/hub-door-{mist,forge}-{locked,opening,open}.png` | default=locked；opened别名=open | [0.5,1] | 128×128 | 当前prop静态状态，替代rocks占位 |
| `/art/hub-ui/keys/key-{wind,mist,forge,frost,rift,dragon}.png` | 单图，id同文件名去扩展名 | [0.5,0.5] | 64×64 | 风印/铃钥/炉钥/霜钥/星钥/龙钥 |
| `/art/hub-ui/keys/key-*-locked.png` | 同6区，灰色未获得 | [0.5,0.5] | 64×64 | 未持有钥匙占位 |
| `/art/hub-ui/resonance/resonance-{0..5}.png` | 0灰；1–4亮相应角；5六角全亮带晕 | [0.5,0.5] | 64×64 | 工坊共鸣档位徽记 |
| `/art/hub-ui/resonance/slot-{normal,maxed,limited}.png` | 三态，中心透明 | [0.5,0.5] | 48×48 | 工坊六部位格；limited表示本件品质封顶 |
| `/art/hub-ui/pets/lineup-main.png`、`lineup-main-empty.png` | 主框/虚线加号空槽 | [0.5,0.5] | 160×180 | 上阵主槽；宠物脚放约源坐标[160,309] |
| `/art/hub-ui/pets/lineup-support.png`、`lineup-support-empty.png` | 助阵框/空槽 | [0.5,0.5] | 100×110 | 两个助阵槽共用；脚底约源坐标[100,187] |
| `/art/hub-ui/pets/flow-selected.png` | 单图 | [0.5,0.5] | 48×48 | 当前流派选中底，放在徽记后面 |
| `/art/starsea/pets/v3/accessories/badge-*-large.png` | 原9图不改：arcanum/blade/ember/frostneedle/glacier/shade/storm/ricochet/venom | 中心 | 沿用现有 | 宠物流派徽记 |
| `/art/hub-ui/explore/ring-base.png` | 单图 | [0.5,0.5] | 64×64 | 航区探索度底框 |
| `/art/hub-ui/explore/ring-arc-{nodes,caches,doors}.png` | 3张整圈，半径54源px，宽7源px | [0.5,0.5] | 64×64 | 各计分分段，前端使用真实百分比遮罩；图中不预写进度 |
| `/art/hub-ui/explore/ring-star-{off,on}.png` | 灰星/亮星 | [0.5,0.5] | 基准64×64，可缩至16–24 | 50%/100%两个里程碑共用状态图 |
| `/art/hub-ui/explore/icon-{node,cache,door}.png` | 3张单图 | [0.5,0.5] | 24×24 | 探索度清单节点/秘藏/锁门 |
| `ui-illustrations.v1.json` → `icons.fire`、`icons.shadow` | 内嵌SVG片段，viewBox 0 0 32 32，主描边2 | SVG中心 | 24/32/64px | A25同目录/同键，出战方案与节点元素提示 |

动画建议：秘藏glint 0→5按8fps循环，减少动态使用静态glint；门opening 0→5按8fps单次播放后停open。当前`open-world-assets.ts`的sprite适配器读取静态`stateFiles`；登记即能换静态图，动画播放需前端消费已登记的`image/atlas/stateFrames`。本任务按分工不改该逻辑。

A33沿用A25的数据交付形式；若当前组件仍使用硬编码基础图标，接入同一补充JSON的fire/shadow，不能把清单已登记误称为前端消费已验收。
