# 箱庭位面：场景美术制作（交接给 GPT）

日期：2026-10-18　仓库：`G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world`（git 根在上一级 `abyss-walker-rewrite`）
设计：`docs/plane-world-design.md`（下称「总设计」），本期对应 **B6 场景资源**；风格气质见 B6.1，布局语法见 B6.4。
本期目录：`docs/reviews/plane-art-20261018/`；进度文件 `progress.md`，裁决记录 `decisions.md`（A0 创建）。
全部回复、文档、提交说明都用中文。

**分工（用户 2026-10-18 定）**：**GPT 只做美术**：出图、导入、登记、构建、校验，以及特效库的选片登记。**设计层和落地层（玩法、服务端、客户端集成、场地生成、数值）由 Claude 做**，Claude 只通过第 3 节的资源 ID 和登记表使用你的产出。
- 不要改 `apps/`、`packages/`（`packages/asset-manifest/` 除外）、`config/`、`tools/` 里的玩法代码；
- 新增的美术构建、校验脚本可以放进 `tools/`。

---

## 0. 执行方式（强制）

1. **一次跑完 A0→A6 全部批次。** 每批做完立即进入下一批，不停下汇报，不问「是否继续」。
2. 只允许两种结束状态：
   - **完成**：第 8 节全部打勾；
   - **硬阻塞**：遇到第 6 节的硬阻塞，**且其余能做的批次全部做完**才停，在进度文件写清阻塞点和恢复步骤。
3. 第 5 节默认裁决直接执行，并记进 `decisions.md`。表外歧义按「与五岛美术一致 > 总设计 B6 > 改动最小」自行决定，同样记录。
4. 每批结束更新进度文件：打勾、产出数量、校验结果、下一步的**精确**命令。中断后从进度文件恢复。
5. **同一时间只跑一个重任务**（用户电脑会卡）：批量出图、图集打包、构建、校验都算。
6. **不跑任何浏览器**；不连接或修改 8612 正式库，不调用 8790 写接口。
7. 原图、预览截图、构建中间产物只留本地，按现有 `.gitignore` 和留档规则来；出图提示词 JSON、spec、登记表、构建和校验脚本照常提交。
8. **先发布占位，再逐项替换**：A1 第一件事，就是按第 3 节的完整 ID 清单生成可以构建的登记表。暂时没画的项，用现有本岛资源换色调占位，状态标 `placeholder`。这样 Claude 落地时 ID 从第一天起就能用；你画完一项，就把那项换成正式图，状态改成 `imported`。

---

## 1. 照着做的现成管线（五岛美术）

| 东西 | 位置 |
|---|---|
| 说明与口径 | `assets/open-world/five-islands/README.md`（数量口径、复用、新原图与材质适配分开统计） |
| 定义 | `assets/open-world/five-islands-spec.mjs` |
| 出图队列 / 提示词 | `assets/open-world/five-islands/generation-queue.json`，源图在 `source/`，提示词逐项存成同名 JSON |
| 构建 / 校验 | `tools/build-five-island-art.mjs`、`tools/verify-five-island-art.mjs` |
| 发布 / 登记 | `apps/web/public/art/open-world/five-islands/`、`packages/asset-manifest/open-world-five.v1.json` |
| 条目格式 | `id, name, island, kind, category, sourceMode(imagegen / registered-material-adaptation), displayWidth, material{tint, wash}, files[], runtime{file, width, height, anchor, displayWidth, states, registration…}, status` |
| 画风基准 | `.design/npc-scene-unification-20261003/camp-unified-v2.png`；`docs/world-art-unification.md`（手绘轮廓、柔和深色描边、等距投影 `[32,18]`） |

本期**一比一照抄这套结构**，新建一个独立的包：

| 项 | 路径 |
|---|---|
| 定义 | `assets/open-world/plane-kits-spec.mjs` |
| 包目录 | `assets/open-world/plane-kits/`（`README.md`、`generation-queue.json`、`source/`、`review.json`） |
| 构建 / 校验 | `tools/build-plane-kit-art.mjs`、`tools/verify-plane-kit-art.mjs` |
| 发布 | `apps/web/public/art/open-world/plane-kits/` |
| 登记 | `packages/asset-manifest/open-world-planes.v1.json`（schemaVersion 1，格式和 five 一致） |

---

## 2. 风格要求（总设计 B6.1、B6.3）

- 守「奶白浅金」的明亮卡通手绘：**不做恐怖、不做大面积深棕或纯黑**。室内靠暖色光源和发光物提亮，暗部用带色相的蓝紫或灰绿。
- 投影、透视、描边粗细、明暗方向，都和五岛的户外摆件同一套。把室内件和户外件摆在一起，要看不出是两个人画的。
- 墙和崖口这类模块要能无缝拼接：同一套里的直墙、内角、外角、断口共用画布尺寸和接地线（参照五岛 boundary 的 `registration`、`joinPolicy`）。
- 有状态的件（封石开 / 合、巢口闭 / 裂、入口未平定 / 已平定、拉杆、裂隙三态）**同一张画布、同一个缩放、同一个枢轴**，只改画的内容（参照五岛「Physical state pairs」规则）。
- 本岛色调用 `material{tint, wash}` 做适配，**不复制像素另存一张**。各岛的色调取五岛登记表里同岛已有的 tint。

### 2.1 方向定稿（用户 2026-10-18 看过样张后定，覆盖「按 A 继续」）

| 套件 | 方向 | 基准样张 |
|---|---|---|
| `cave` 洞穴 | **B**（封闭地下，有色阴影 + 局部光源） | `style-samples/cave-b.png` |
| `crypt` 地宫 | **B** | `style-samples/crypt-b.png` |
| `maze` 迷宫 | **B** | `style-samples/maze-b.png` |
| `vault` 秘室 | **B 的光影 + 下面的包围感硬要求**（两张秘室样张都露了天空和窗外景，不作基准，只借 B 的光影层次） | `style-samples/vault-b.png`（只取光影） |
| `rift` 裂隙 | **保持星海浮岛**（户外悬空、露星海），不受包围感要求约束 | `style-samples/rift-a.png` / `rift-b.png` 的明亮度 |

A 方向的露天、采石场感被否决：玩家看上去像在户外，不像进了洞。

**包围感硬要求（cave / crypt / maze / vault 全部适用，逐件审核，不满足就重出）：**
1. **四面有墙**：段落样张和任何一段拼出来的场景，可走区域四周都被岩壁或砌石包住；岩面贴图 `wall-straight` / `wall-top` 要画出岩石或砌石的厚重质感，不是矮栏杆、不是悬崖边。
2. **能看到顶**：画面上沿要有钟乳石、拱顶、梁或顶棚边缘；`wall-top`、`backdrop-near` 负责交代「头顶是封住的」。
3. **画面里不准出现**：天空、云、星海、太阳、窗外风景、远处地平线、户外树冠、瀑布从天上落下。
4. **远景是「洞的深处」**：`backdrop-near` / `backdrop-far` 画洞壁层次、更深的甬道、地下水面、远处的光点，**不是风景**；往远处退到带色相的深蓝紫或深青绿，**不用纯黑**。
5. **地面保持明亮**：可走区域靠火把、灯笼、发光晶体、`light-pool` 照亮，亮度和五岛户外地面接近，角色和怪物站上去要清楚；暗只出现在墙根、顶部和远景。
6. **植物收敛**：只允许苔藓、发光菌、少量垂藤；不放户外花盆、灌木、树。
7. 「不做恐怖、不做大面积深棕或纯黑」仍然有效：暗部用蓝紫 / 青绿，暖光点缀，整体是「明亮的地下探险」，不是阴森地牢。
8. **前沿要矮**：面向镜头的一侧由程序按视线规则自动压矮（见 2.3），美术不用单独画前沿件；高墙只出现在后方和左右两侧。
9. **不要天光**：不画从洞顶斜射下来的阳光光柱，那会让人以为头顶有开口。亮光只来自灯笼、火盆、晶体、发光菌。

**标杆**：
- 构图线稿 `docs/reviews/plane-art-20261018/style-samples/benchmark-cave-sketch.svg`（Claude 画）：只定空间关系——封顶、后两侧高墙、前沿矮石、地面最亮、灯笼在墙上光圈落地、甬道通往深处、墙外蓝紫暗部、小人与矮石的比例。**画风不照线稿**，画风照 cave-b。
- 画风参照 `style-samples/benchmark-cave.png`（cave-b 加标注：1–7 照着做，8–9 要改，本地文件）。
四套的审核都拿这两张对照。

**已经按 A 做出来的 cave / crypt / maze / vault 件全部按上述要求重出**（ID、画布、枢轴不变，只换画面），状态退回 `placeholder` 直到重出合格；rift 已出的件不动。

### 2.2 标杆关口（先做一套，用户看过再铺量）
1. 先只做 **cave**：按 2.1 重画一张段落样张 `style-samples/cave-benchmark.png`（修掉标注 8、9），再出这 8 件正式资源：`ground-main`、`ground-path`、`wall-straight`、`wall-top`、`light`、`light-pool`、`prop-s1`、`backdrop-near`（契约见 2.3）。
2. 用这 8 件**真资源**按等距网格拼一张约 24×20 格的场景 `style-samples/cave-kit-assembled.png`（脚本拼，不手绘），证明零件拼起来也有包围感、前沿不挡人、墙能无缝接。
3. 在 `progress.md` 写「标杆待用户确认」，**cave / crypt / maze / vault 其余件暂停**；等待期间不停工，继续做不受影响的批次：rift 套件和裂隙特色件、野外入口与 60 条材质适配、特效选片、脚本和文档。
4. 用户确认标杆后，按标杆铺 cave 其余件和 crypt / maze / vault；用户提出修改就先改标杆再铺。这是本期唯一允许等待用户的地方，不算硬阻塞。
5. 第 2 步的拼装图**改用实机灰盒场景截图**（见 2.3）：把画好的件放到 runtime.file 后，在 `plane-review.html?stage=plane-wind-nest-cave-1&calm=1` 截图，替代脚本拼图。

### 2.3 灰盒契约（2026-10-18 第二版：Claude 已重搭 6 个可走场景，GPT 只换画面）
第一版灰盒（逐格贴墙片、64 格小图）因「太小、不像洞穴、到处穿模」被用户否掉，已整体换成**高度场地形**；随后的平滑岩坡版又因「和人物、怪物风格不一致」被否，cave 改为 cave-b 那种**高低错落的圆块岩石台**，三套统一加深色描边、平涂色块。下面是现行契约，第一版的 `wall-inner`、`edge-front` 逐件摆放规则作废。

**画风硬要求（和角色、怪物一致）**：所有件都要柔和深色描边、手绘平涂色块、明暗分 2–3 档，参照已入库的 cave 摆件（碎石堆、蓝晶簇、石笋）和 cave-b 样张；不要写实噪点纹理、不要照片质感、不要大面积模糊渐变。灰盒已按这个方向画，正式图在它基础上提精度即可。

| 场景 ID | 套件 | 尺寸 | 说明 |
|---|---|---|---|
| `plane-wind-nest-cave-1` / `-2` | cave | 128² / 100² | 五个岩厅（半径 8–12 格）单线串联，宽 5 格窄甬道、无环路 / 窄道通往半径 22 的首领深井 |
| `plane-wind-nest-crypt-1` / `-2` | crypt | 116² / 100² | 五间墓室单线串联（宽 5 格走廊、每厅只有进出两口）/ 46×46 主墓室环柱 |
| `plane-wind-nest-maze-1` / `-2` | maze | 116² / 100² | 8×8 回廊（走廊宽 6、墙厚 6、墙高 104，只留 2 条环路，其余为分岔和死路）/ 核心首领厅 |

上表是作者版（复核页默认显示）。**正式副本每场随机生成**（`packages/content/plane-layouts.ts`）：表里只提供套件、尺寸、等级和怪物/宝箱数量，布局按本场种子重新铺。普通层仍是一条主线加一个死胡同侧室，首领层的入口方向随机四选一。所以素材不能只按某一种朝向画：墙、灯、摆件在四个方向都要成立。复核页加 `&seed=<数字>` 或 `&seed=random` 可看任意一场。

**怎么看**：本机 vite 开着时打开 `http://127.0.0.1:8612/plane-review.html?stage=<场景ID>&calm=1`（`calm=1` 不刷怪）；控制台有 `awPlaneWalk([{x,y}])`、`awPlaneTeleport(x,y)`、`awPlaneDiagnostics()`。只读静态页，不登录、不调接口。ASCII 布局：`npx tsx tools/plane-scene-preview.ts cave`。

**来源（GPT 不改）**：布局 `packages/content/plane-scenes.json`（挖空规则 disk/rect/path/pillars/maze/fill + 套件参数），高度场与摆放 `packages/content/plane-scenes.ts`，渲染 `apps/web/src/plane-scene-renderer.ts`，灰盒件生成 `tools/build-plane-greybox-art.mjs` → `packages/asset-manifest/open-world-planes-greybox.v1.json`（每件带 `contract`）。

**场景怎么画出来的**（画面必须适配，不能要求改规则）：
- 一格 = 64×36 等距菱形。每个岩石格有一个高度：离地面越远越高，最深 6 格以外不画（就是洞里的黑）。
- **视线规则（防穿模的核心）**：岩石不会高到挡住它前方（屏幕下方）任何一格地面上的角色——高度上限 = 18×前后距离 − 24px。所以前沿的岩体自然是矮坡，后侧和左右才是高墙；墙永远画在角色下层，**不需要也不允许**半透明淡出。
- 三套都是**竖直格块**：`wall-straight` 是正视墙面条带，程序斜切贴到每格的前面和右面（右面叠冷色阴影），从地面线向上平铺；顶面贴 `wall-top`；程序在块的轮廓和折边上描深色线，离地面越远按档压暗到背景色。挡视线的前沿块只留 14px 矮墩。
- **cave（rock）**：每格高度不同（10px 一档、相邻格随机错开），越往后越高，形成一层层岩台；基准墙高 130。**crypt / maze（block）**：同高墙，crypt 128、maze 80。
- `light` 挂在面向镜头、足够高的岩面上，地上同点叠 `light-pool`（加色混合），灯附近的岩面有暖色反光。
- 摆件两类：**岩台件**（cave `prop-s*`）立在第一排岩块顶上靠地面一侧，不占可走区、没有碰撞；**挡路件**（cave `prop-m*`，crypt/maze 全部摆件）占一格、有碰撞，crypt/maze 靠墙放，cave 放在开阔处。`pillar` 占 2×2 格。只有挡路件和柱子挡住角色时会淡到 40%。

**每件契约**（画布像素 / 枢轴 anchor / 显示宽，替换时三项都不能变；以灰盒清单 `contract` 为准）：

| part | cave | crypt | maze | 要点 |
|---|---|---|---|---|
| `ground-main` / `ground-path` | 512×512 无缝 | 256×144 | 256×144 | 屏幕空间平铺；cave 是夯土地面加零星扁平石块，不画规则方格；crypt/maze 石板缝必须对齐 64×36 菱形格，周期 256×144 |
| `wall-straight` | 128×256，[0,1] | 128×128，[0,1] | 128×80，[0,1] | 左右两个 64 宽变体，底行=地面线；cave 是带描边的圆块岩石，上下无缝（向上平铺）；crypt/maze 是砖墙加压顶；最底 14px 要能单独当矮墩看 |
| `wall-top` | 512×512 | 512×512 | 512×512 | 块顶俯视纹理，无缝；cave 浅奶色岩面，crypt/maze 偏暗；平涂加少量描边裂纹，程序再按距离压暗 |
| `light` | 40×64，[.5,.469] | 同左 | 同左 | 锚点=灯体中心，挂墙 |
| `light-pool` | 256×144，[.5,.5] | 同左 | 同左 | 半透明，加色混合；maze 已压到 .45 |
| `pillar` | — | 128×208，[.5,.808] | 128×160，[.5,.75] | 锚点 = 2×2 占地中心 |
| `prop-s*` | 64×64，[.5,.85] 岩台件 | 64×64 挡路件 | 64×64 挡路件 | cave s1–s3；crypt s1–s2；maze s1–s2 |
| `prop-m*` | 96×96，[.5,.85] 挡路件 | 同左 | 同左 | cave m1 晶簇、m2 矿车、m3 石笋；crypt m1–m3；maze m1 |
| `backdrop-near` | 1280×720 | 同左 | 同左 | 屏幕固定深色背景：岩体深处，无天空/星/地平线 |

第 3.1 节里的 `wall-inner` `wall-outer` `wall-break` `edge-front` `edge-side` 当前渲染器不用：ID 保留，放到各套最后做，画成可单独摆放的岩块/断墙装饰件即可，不再要求和格边对缝。

**替换方式**：同一个 ID，在 `open-world-planes.v1.json`（GPT 的正式清单）里给出 `runtime.file`，画布、anchor、displayWidth 与灰盒 `contract` 完全一致；GPT 交付后由 Claude 把 `open-world-assets.ts` 从灰盒清单切到正式清单，场景代码不动。灰盒 PNG 只是本地生成物（`npm run build` 时生成，art 目录不进 git）。

**批量化新场景**：新地图只在 `plane-scenes.json` 加 stage 条目（尺寸 + 挖空规则 + 刷怪 + 宝箱），在 `dungeons.json` 加对应副本定义，在世界表加位面门；这一步由 Claude 做，GPT 只交套件画面。GPT 若想提新布局，写成 JSON 草案放 `reviews/plane-world-20261018/layout-drafts/`，不要直接改正式文件。

---

## 3. 资源清单与 ID 契约（Claude 按这些 ID 接，不得改名）

### 3.1 风格套件：4 套 × 36 件（`<kit>` = `cave` / `crypt` / `maze` / `vault`）
ID 格式：`ow-art-plane-<kit>-<part>`

| 类 | part | category | 状态 |
|---|---|---|---|
| 地表 | `ground-main` `ground-detail` `ground-path` `ground-rubble` | ground | — |
| 墙体 | `wall-straight` `wall-inner` `wall-outer` `wall-break` `wall-top` | boundary | — |
| 边缘 | `edge-front` `edge-side` | boundary | — |
| 结构 | `pillar` `arch` `passage` | building | — |
| 封石 | `seal` | world-state | `closed` / `open` |
| 巢口 | `mouth` | world-state | `closed` / `open` |
| 光源 | `light` | nature | — |
| 光圈 | `light-pool` | mask（叠加用，半透明） | — |
| 摆件 | `prop-l1..l3`，`prop-m1..m4`，`prop-s1..s4` | nature | — |
| 交互 | `lever`（`off` / `on`），`plate`（`up` / `down`），`lore-stone` | event-prop | 见左 |
| 远景 | `backdrop-near` `backdrop-far` | ambient（宽幅，可横向平铺） | — |

注：`seal`、`mouth`、`lever`、`plate` 各是一个 ID，在 `runtime.states` 里声明多态；合计 36 个 ID。各套摆件的主题：
- cave：钟乳石、蓝晶簇、湿岩、矿车残骸；
- crypt：石棺、描金柱础、长明灯、碎碑；
- maze：苔墙残段、藤架、碎瓦堆、倒塌拱；
- vault：宝箱台、齿轮机关、金砖堆、封印柱。

### 3.2 裂隙套件：20 件
ID 格式：`ow-art-plane-rift-<part>`

| 类 | part |
|---|---|
| 地表 | `ground-main` `ground-detail` `ground-path` |
| 悬浮边缘 | `edge-front` `edge-side` `edge-corner` `edge-under`（岛块底部悬垂的岩根） |
| 摆件 | `shard-1..3` `floating-rock-1..2` `crystal` |
| 野外入口 | `gate`（`closed` / `active` / `cooldown`） |
| 守护目标 | `anchor`（`idle` / `damaged`） |
| 远景 | `backdrop-starsea` `backdrop-tide-band` `backdrop-cloud` |

### 3.3 本岛特色件：4 套 × 6 岛 × 2 = 48 件
ID 格式：`ow-art-plane-<island>-<kit>-feature-1|2`，其中 `<island>` = `wind` / `mist` / `forge` / `frost` / `rift` / `dragon`。
都是**新造型**，不是换色调。示例：
- 赤炉 cave：熔渣管、冷却池；
- 霜镜 crypt：冰封石棺、霜灯；
- 雾铃 maze：铃架残骸、雾灯；
- 风栖 vault：风车齿轮机关、羊毛货箱。

其余 20 组按本岛已有地标的主题自行发挥，并记进裁决。

### 3.4 野外入口：14 个基础造型
ID 格式：`ow-art-plane-entry-<shape>`

| shape | 用途 | 状态 |
|---|---|---|
| `cave-mouth` | 洞穴巢穴 | `unsettled` / `cleared`（已平定：火把点亮、爪痕消失、有花草） |
| `crypt-door` | 地宫巢穴 | `unsettled` / `cleared` |
| `maze-gate` | 迷宫巢穴 | `unsettled` / `cleared` |
| `cracked-wall` | 秘室 | `hidden`（一面普通岩壁，只有细裂纹）/ `found`（破开露出门洞） |
| `vine-curtain` | 秘室 | `hidden` / `found` |
| `well-cover` | 秘室 | `hidden` / `found` |
| `bone-gate` | 首领巢 | `default` / `cooldown` |
| `thorn-cave` | 首领巢 | `default` / `cooldown` |
| `link-stone` | 贯通位面两头 | `sealed` / `open` |
| `portal-base` | 位面内出口传送门底座 | `dormant` / `open` |

以上共 10 个 ID、14 个以上造型状态。另外，每个 ID 为 6 个岛各生成一条材质适配，ID 写成 `ow-art-plane-<island>-entry-<shape>`，只加 material，不新画。

### 3.5 特效选片（只选片登记，不接入游戏）
从 `G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套` 里，为下面 6 个用途各选 1–2 个候选片段，登记进同一份登记表（`kind: "spine-fx"`，记录原始路径、哈希、骨骼版本、图集、动画名、建议缩放和颜色调整）：
`fx-plane-portal-open`、`fx-plane-portal-loop`、`fx-plane-mouth-burst`、`fx-plane-seal-dust`、`fx-plane-discover`、`fx-plane-cleared`。
用途不明的片段不要登记；某个用途库里找不到合适的，就记进缺口，不新画。

### 3.6 段落样张：5 套 × A / B 两个方向 = 10 张
每套把地表、墙、光源、3 件摆件和远景拼成一段大厅（约 24×20 格的视野），**只作方向选择用，不作为游戏资源**。放进 `docs/reviews/plane-art-20261018/style-samples/<kit>-a.png` 和 `-b.png`，每张附一句方向说明。A 是「贴近五岛户外的明亮度」，B 是「室内感更强，但仍守明亮底线」。**做完样张不等用户选择，直接按 A 继续生产**；用户选了 B 的话，之后按记录的提示词差异替换。

### 3.7 数量合计
- 新原图：套件 4×36 + 20 = 164，特色件 48，入口 10 个 ID 的全部状态。
- 材质适配：入口 10 × 6 = 60。
- 特效登记：6 个用途。
- 样张：10 张。

---

## 4. 批次

| 批 | 内容 | 验收 |
|---|---|---|
| A0 | 读总设计 B6、五岛 README / spec / 构建 / 校验；建本期目录、`progress.md`、`decisions.md` | 进度文件存在 |
| A1 | 建 spec、包目录、构建和校验脚本；**生成第 3 节完整 ID 的占位登记表**（用本岛现有资源换色调，`status: placeholder`），能构建、能校验 | `node tools/build-plane-kit-art.mjs --allow-pending`、`verify` 通过；登记表 ID 与第 3 节一一对应 |
| A2 | 样张 10 张（3.6） | 文件存在，附说明 |
| A3 | 出图：cave、crypt 两套（各 36 件）+ 对应的本岛特色件 | 逐项替换占位，状态改成 `imported`；校验透明留边、拼接、多态同画布 |
| A4 | 出图：maze、vault 两套 + 对应特色件；rift 套件 20 件 | 同上 |
| A5 | 野外入口 10 个 ID 的全部状态 + 60 条材质适配；特效选片登记（3.5） | 同上；特效条目路径和哈希可复查 |
| A6 | 去掉 `--allow-pending` 后完整构建并校验；写 `README.md`（数量口径：新原图 / 材质适配 / 特效登记分开统计）；`art-gaps.md`（仍是占位的项和原因）；提交 | 第 8 节全部打勾 |

## 5. 默认裁决

| 歧义 | 裁决 |
|---|---|
| 画布尺寸、displayWidth | 按五岛同类 category 的惯例：墙和边缘照 boundary，摆件照 nature，结构照 building，入口照 entrance（displayWidth 约 185） |
| 地表是贴图还是平铺 | 照五岛 ground 的做法 |
| 远景尺寸 | 宽 2048、高 768，左右能无缝平铺 |
| 光圈 | 白到透明的柔光，由渲染器按套件着色，不画死颜色 |
| 某一项出图三次都不合格 | 保留占位，记进 `art-gaps.md`，继续下一项 |
| imagegen 不可用 | 全部保持占位，把出图队列和提示词写完整，记成缺口，继续把其余批次（脚本、登记、特效选片、文档）做完 |
| 特色件主题 | 取本岛五岛地标的主题，避免和同岛户外地标同造型 |

## 6. 硬阻塞（只有这些可以停）
- 需要改玩法代码才能继续；
- 需要推翻用户已经确认的画风（奶白浅金、方案 2 等距手绘）；
- 需要清档，或者要碰 8612 / 8790。

出图不合格、imagegen 不可用、特效库里找不到合适片段，**都不是**硬阻塞。

## 7. 禁止
- 改动第 3 节的 ID 或删掉条目；砍件数；把换色调算成新原图；
- 用整幅概念图代替独立资源；用样张当游戏资源；
- 改玩法代码、配置表、地图生成；跑浏览器；
- 新画特效来代替特效库里已经有的合格片段。

## 8. 完成定义
- [ ] `plane-kits-spec.mjs`、构建脚本、校验脚本、登记表 `open-world-planes.v1.json` 齐全，完整构建（不带 `--allow-pending`）通过
- [ ] 登记表 ID 与第 3 节一一对应（4×36 + 20 + 48 + 10 个入口 + 60 条适配 + 特效登记）
- [ ] 多态件同画布、同枢轴；墙和边缘能拼接；透明留边校验通过
- [ ] 10 张样张及方向说明
- [ ] 特效选片登记可复查
- [ ] `README.md`、`art-gaps.md`、`decisions.md`、`progress.md` 写完，并已提交
