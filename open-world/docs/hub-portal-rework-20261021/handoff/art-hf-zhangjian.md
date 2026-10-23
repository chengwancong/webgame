# 交接：杖剑借鉴 Z1–Z4 美术 A27–A33（秘藏 / 锁门 / 钥匙 / 共鸣 / 宠物阵容 / 探索度 / 元素补图）

> 2026-10-23 Claude（总策划）写给 Codex/GPT。设计见 `../modules/M17-zhangjian-z1-z4.md`。**设计已定，照做**；有默认裁决的直接按默认做，并记进决策日志，不回来问。
> 分工：你出图、导出运行时文件、登记资源清单；**前端接线由 Claude 做**，你不改 `apps/web/src` 的逻辑。前端先用占位跑，图到了再换。
> 本批与 ART-HB / HC / HD / HE 互不依赖，可以并行。

## 0. 执行方式（强制）

1. **一次连续做完 R0 → A27 → … → A33 → R9**，项与项之间不停、不等确认、不回来问。允许的结束状态只有两种：
   - **全部完成**：§6 完成定义全部勾上；
   - **硬阻塞**：已做完所有不受影响的项，只剩 §5 列出的硬阻塞。
2. 进度文件：同目录 `art-hf-progress.md`。每完成一项勾一项，写输出路径、尺寸、sha256 前 12 位、一句自检结论。中断后从第一个未勾项接着做。
3. 决策日志：同目录 `art-hf-decisions.md`，每条一行：问题｜处理｜依据条目。
4. 协作中心：`游戏协作.md` 超过 40,000 字符先归档；任务队列加 `ART-HF | P1 | 进行中 | Codex | Z1–Z4 美术 A27–A33 | 素材不入库`，完成改「待接线」。只用 `更新游戏协作.ps1`。
5. **素材不进 Git**：`apps/web/public/art/`、`.runtime/` 被忽略；提交只含清单 JSON/TS 与进度、决策文件。提交前看 `git diff --cached --stat`，有图片就撤掉。
6. **不下载新素材**：只用本机已有库（SP33、819 套、Q 版特效 300 套、现有游戏图）和图像生成。
7. 本机重任务一次只跑一个；不跑无头浏览器和浏览器自动化（本机常驻 MU）。看效果用本地拼图。

**禁止**：只写文档不出图；纯色块、几何图形、文字截图冒充成品；库素材原样不处理就交；改玩法代码和数值；把原始生成图、对比图、PSD 提交进 Git；用纯 SVG 程序化自绘做场景物件（A27、A28）。

## 1. 画风基准

| 用途 | 基准 | 硬要求 |
|---|---|---|
| 场景类：A27 秘藏、A28 锁门 | MiniFantasy / SP33 手绘厚涂（多层明暗、顶光高光边、固有色深描边、低饱和） | 与现有宝箱 `ow-art-fine-chest-closed`、引雷桩 `hunt-pylon`、巡猎兽并排拼图，比例和描边对得上；54px 黑剪影能认 |
| 界面类：A29–A33 | 仓库根 `项目.md` 的「奶白浅金」 + 手绘符记；与 ART-HE 的图标同一套线宽 | 64px 缩略可读；元素色只用 `tokens.json` 已有 Token 名 |

## 2. 批次清单

### R0 准备
- [ ] 归档协作文档、加任务行（§0.4）。
- [ ] 基准板 `.runtime/art-hf/baseline.png`：现有宝箱、引雷桩、巡猎兽、ART-HE 已交图标、`apps/web/public/art/starsea/pets/v3/accessories/badge-*-large.png`。

### A27 秘藏宝箱（场景，`hub-cache`）
- [ ] 比现有宝箱小一号、半埋在土石里的旧箱，带藤蔓或贝壳（风栖、雾铃通用一套）。三态：`hidden`（半埋，几乎和地面一色，只露一角）、`glint-0…5`（同一张箱子上叠 6 帧闪光循环）、`opened`（盖子掀开、里面空）。
- [ ] 单帧 160×160，锚点底部中心。图集 `apps/web/public/art/hub-fun/hub-cache.{png,json}`（TexturePacker hash，内边距 2px，不旋转）。
- [ ] 登记 `packages/asset-manifest/open-world-five.v1.json`，id `ow-art-hub-cache`，格式照 `ow-art-hub-hunt-pylon`；三态写进 `stateFiles` 或帧名表。

### A28 锁门（场景，`hub-door`）
- [ ] 两种门，同一个石拱结构，换门板和锁：
  - **雾锁门**（放在风栖副本，要雾铃的「铃钥」）：雾铃色系，门板上挂铃形锁。
  - **炉锁门**（放在雾铃副本，要赤炉的「炉钥」）：铜红色系，门板上是炉口形锁。
- [ ] 每种门两态 `locked`、`open`，外加开门 6 帧 `opening-0…5`。单帧 256×256，锚点底部中心，门洞宽约 2 格。
- [ ] 图集 `apps/web/public/art/hub-fun/hub-door-mist.{png,json}`、`hub-door-forge.{png,json}`；登记 id `ow-art-hub-door-mist`、`ow-art-hub-door-forge`。

### A29 钥匙图标 ×6（界面）
- [ ] 六个航区关口钥匙：风印（风栖）、铃钥（雾铃）、炉钥（赤炉）、霜钥（霜镜）、星钥（沉星）、龙钥（龙眠）。每把钥匙的柄做成该航区徽记（参照 `hub-ui/sea-emblems`）。
- [ ] 128×128 透明 PNG，`apps/web/public/art/hub-ui/keys/key-{wind,mist,forge,frost,rift,dragon}.png`；另出灰色未获得版 `key-*-locked.png`。

### A30 共鸣徽记 + 部位格（界面，工坊）
- [ ] 共鸣徽记 5 档：同一个六角形徽记，档位越高点亮的角越多（1 档亮 1 角……5 档全亮带光晕），外加未激活灰色版。128×128，`apps/web/public/art/hub-ui/resonance/resonance-{0..5}.png`。
- [ ] 部位格框：一个 96×96 格框，三态 `normal`、`maxed`（金边）、`limited`（右上角小锁角标，表示本件品质封顶）。`apps/web/public/art/hub-ui/resonance/slot-{normal,maxed,limited}.png`。

### A31 宠物阵容框（界面，宠物页）
- [ ] 「上阵」大框 320×360：圆台底座 + 奶白浅金拱形框，底座留出放宠物脚底的椭圆；「助阵」小框 200×220，同风格简化。各出空槽版（虚线轮廓 + 加号）。
- [ ] 流派选择用现有 `badge-*-large.png` 九个徽记，不重画；只出一张选中底 `flow-selected.png`（96×96 光圈）。
- [ ] 输出 `apps/web/public/art/hub-ui/pets/lineup-{main,support}{,-empty}.png`、`flow-selected.png`。

### A32 探索度圆环（界面，航图）
- [ ] 圆环底框 + 分段进度弧（分 3 色：节点、秘藏、锁门）+ 50% 和 100% 两个里程碑小星。128×128，分层导出：`ring-base.png`、`ring-arc-{nodes,caches,doors}.png`（整圈，前端用遮罩裁）、`ring-star-{off,on}.png`。放 `apps/web/public/art/hub-ui/explore/`。
- [ ] 清单行小图标 48×48：`icon-node.png`、`icon-cache.png`、`icon-door.png`。

### A33 元素图标补齐
- [ ] 先查 ART-HE（A25）已交的元素图标；缺 `fire`、`shadow` 就补，补的要和 A25 同线宽同底框。若 A25 已有，本项只在进度文件写「复用 A25，路径 …」。
- [ ] 补图输出到 A25 同目录、同命名规则。

### R9 收尾
- [ ] 总览图 `.runtime/art-hf/overview.png`：A27、A28 与基准板并排，草地 / 沙地 / 暗石地三行；界面类放在奶白底上一行。不提交。
- [ ] 跑 `npx tsc --noEmit -p .`、`pnpm config:check`、`tests/` 里与 `asset-manifest` 相关的单测，通过后只提交清单和进度、决策文件。
- [ ] 进度文件末尾写「接线清单」：资源路径｜帧名｜锚点｜建议显示尺寸｜替换哪个占位。
- [ ] 协作中心改「待接线」，双方留言一行：`ART-HF A27–A33 已出图，接线清单见 handoff/art-hf-progress.md`。

## 3. 技术要求
- 透明 PNG（sRGB，预乘关闭）；图集 TexturePacker hash，内边距 2px，不旋转。
- 运行时按显示尺寸 2 倍出图，单张图集 ≤ 2048×2048，本批运行时合计 ≤ 6MB。
- 源文件放 `.runtime/art-hf/source/`（被忽略；`open-world/assets/`、`.design/` 是入库目录，不要放）。

## 4. 默认裁决

| # | 问题 | 默认 |
|---|---|---|
| D-F1 | 秘藏的 hidden 态太隐蔽，54px 剪影认不出 | 剪影能认出「箱角」即可，hidden 本来就是半藏；glint 态必须一眼认出 |
| D-F2 | 锁门两种颜色和场景地表撞色 | 门框石料统一，只改门板和锁的颜色 |
| D-F3 | 钥匙徽记在 128px 下太碎 | 去掉细节，只留徽记外形 |
| D-F4 | imagegen 出的字错 | 界面图一律不放字，文字由前端排 |
| D-F5 | 某项第一版自检不过 | 改一次再自检；仍不过写清差在哪，留最好的一版，接着做下一项 |
| D-F6 | 本文没写到的小歧义 | 按「和现有游戏画面放一起不突兀」处理，记决策日志，不停 |

## 5. 硬阻塞（只有这些可以停）
- 必须从网上下载新素材（需用户逐次同意）；
- 需要改玩法、数值或推翻 M17 设计；
- 本机库和图像生成都做不出来。

## 6. 完成定义
- [ ] A27–A33 运行时文件全部到位，尺寸、帧名、锚点符合 §2、§3。
- [ ] 每项和基准板并排对比过，自检写进进度文件；总览图已出（只留本地）。
- [ ] A27、A28 已登记进资源清单，校验通过。
- [ ] 接线清单完整，Claude 不用问就能接上。
- [ ] Git 提交里没有图片；协作中心状态为「待接线」。
