# ART-HD 副本场内美术进度

2026-10-22；美术交付，接线由 Claude 完成。图片/源稿/导出脚本只留本地。

- [x] R0 协作中心 ART-HD 已改进行中，写入前 25,956 字符，无需体量归档。基准板 `.runtime/art-hd/baseline.png`，(1200, 700)，sha256 `628d1bd6ac26`；三块真实地表、巡猎兽、冻舰巡守、宝箱、引雷桩、评价章及连斩字样齐全。
- [x] D1 `apps/web/public/art/hub-fun/tide-beacon.{png,json}`；23 帧（本体192×256，光环256×128），图集 (1962, 780)，PNG sha256 `367620fe1412`，JSON `ecbe6a91aaef`；兼容单图 `beacon-full-0.png` 192×256 / `c65d10713b21`。登记 `ow-art-hub-tide-beacon`。三地表对比 `.runtime/art-hd/D1-comparison.png`：粗短石身、星核与裂纹三档明确；循环固定石身，仅核部亮度变化；光环降至30% alpha。
- [x] D2 `apps/web/public/art/hub-fun/hunt-flood.{png,json}`；22帧（水面/预警/退水128×64，水花96×48），图集 (1982, 136)，PNG `fb69ebeb8546`，JSON `59c2841ee2eb`。另静态兼容 `flood-water-0.png` / `flood-splash-0.png`，哈希见末尾文件表。菱形投影，运行时纵向×1.125 对齐[32,18]。`.runtime/art-hd/D2-comparison.png` 三地表可读；`flood-seam-check.png` 5×5拼接检查，镜像周期采样无纹理断缝；末退水帧全透明为预期。
- [x] D3 `apps/web/public/art/hub-fun/hunt-rockfall.{png,json}`；17帧（预警256×128，下落160×256，冲击256×192，残留160×96），图集 (1890, 620)，PNG `573bb5e4dacf`，JSON `7858290cc535`；兼容 `rock-warn-0.png`、`rock-rubble.png`。`.runtime/art-hd/D3-comparison.png`：与现有危险色一致，碎石点保留手绘质感，完整下落轨迹不越画布，冲击尘土来自084库原始片段重新采样与调色；残留建议3秒后淡出。
- [x] D4 `apps/web/public/art/hub-fun/gather-nodes.{png,json}`；12件×2态=24帧，全128×128；图集 (1982, 264)，PNG `d80e117569de`，JSON `22428fc326bb`。12张可采单图兼容file，清单12条、done为同条stateFrames；逐件尺寸/哈希见末尾文件表。风栖先定样，三地表矿/植物对比 `D4-ore-comparison.png`、`D4-plant-comparison.png`，64px两态表 `D4-64px-states.png`：六航区造型色相可分，已采无强光、低轮廓，脚底保留4px透明边。
- [x] D5 `apps/web/public/art/hub-fun/augment-frames.{png,json}`；12帧（3卡框+8流光均440×600，徽记96×96），图集 (1778, 1812)，PNG `a1f858f7264c`，JSON `7abd95be2989`。九宫格源切片：左/上/右/下均48px（2倍显示时24px）；文字安全区[56,56,328,488]。`D5-comparison.png` 含A1试排、A3并排与520×380拉伸：角花不变形、正文深色可读；正式帧不含文字。
- [x] D6 `apps/web/public/art/hub-fun/recover-tablet.{png,json}`；13帧（图标/暗态128×128，演出10帧与柔光256×256），图集 (1826, 520)，PNG `47a87ff2af24`，JSON `da70d1cc5d00`。`D6-comparison.png` 与A1/A3并排，24/48px图标清楚，中央留白支持技能图标覆盖；源叠图安全区[43,38,42,48]。演出前3帧亮起、中4帧裂光、末3帧光点收束，10fps非循环，独立柔光叠底。
- [x] R9 总览 .runtime/art-hd/overview.png，2600×1820，sha256 145a17286840；六图集111帧技术验收通过，16测试文件83测试全部通过，类型/配置/内容检查通过。各项比较图、逐帧表、14个本地GIF及接线清单齐全；协作中心已由指定脚本改为待接线并留言。Git限定四个文本文件提交，图片不入库。

## 导出与校验记录

- 本批共 **6张图集、111帧、17条场景资源、2条界面资源、29个运行时文件**，总量 **2791016 bytes（2.791MB，8,000,000 bytes上限）**。
- 所有PNG为RGBA/straight alpha，嵌入sRGB ICC，全透明像素RGB归零；图集TexturePacker hash，2px内边距、帧间4px，不旋转、不裁切，最大1778×1812或1962×780等，边长均≤2048。111帧名称、尺寸、矩形不重叠、状态引用、文件sha256均已检查。`flood-recede-3`全透明是设计终帧。
- `npx tsc --noEmit -p .`：退出0；日志 `.runtime/art-hd/tsc.log`。
- `pnpm config:check`：退出0，10本工作簿一致；日志 `.runtime/art-hd/config-check.log`。
- `npx tsx tools/validate-content.ts`：退出0；日志 `.runtime/art-hd/content-check.log`。
- `npx vitest run <rg -l asset-manifest tests -g *.test.ts所得16个测试文件> --maxWorkers=1 --no-file-parallelism`：**16文件/83测试全部通过**，20.53秒；日志 `.runtime/art-hd/manifest-tests.log`。本轮无既有失败，`plane-scenes.test.ts`也通过。
- 本批专项导出检查：`python .runtime/art-hd/verify.py`，证据 `.runtime/art-hd/technical-check.json`。前端源码和地图JSON没有本批改动；未下载新素材、未运行游戏或浏览器自动化。
- 清单提交前已对照当前HEAD `ece580fed3c2a153d14ff29efdb7fd0046270174`（含ART-HB `ece580fe` / ART-HC `e51c8968`）逐项合并核对；非本批条目及既有根字段完全不变。`hub-fun.v1.json`既有根统计属于ART-FP，本批完整清单/总量独立置于 `batches.ART-HD`。
- 新图均使用内置imagegen，复用特效来自本机055/056/084库，原始路径/sha256在本批清单source及 `.runtime/art-hd/source/d2-provenance.json`、`d3-provenance.json`；全部生成提示、源图哈希见 `.runtime/art-hd/source/prompts.json`（本地）。

### 运行时文件核对表

路径均相对 `apps/web/public/art/hub-fun/`。JSON为对应图集元数据。

| 文件 | 尺寸 | sha256前12 | 自检 |
|---|---|---|---|
| `augment-frames.json` | JSON | `7abd95be2989` | 通过 |
| `augment-frames.png` | 1778×1812 | `a1f858f7264c` | 通过 |
| `beacon-full-0.png` | 192×256 | `c65d10713b21` | 通过 |
| `flood-splash-0.png` | 96×48 | `a766ff2ab430` | 通过 |
| `flood-water-0.png` | 128×64 | `85a19de398fd` | 通过 |
| `gather-dragon-ore.png` | 128×128 | `46a1afe004dd` | 通过 |
| `gather-dragon-plant.png` | 128×128 | `be27ae1d850b` | 通过 |
| `gather-forge-ore.png` | 128×128 | `6c7a1333336e` | 通过 |
| `gather-forge-plant.png` | 128×128 | `f8138eeed0ce` | 通过 |
| `gather-frost-ore.png` | 128×128 | `67a2b5a64bdd` | 通过 |
| `gather-frost-plant.png` | 128×128 | `e2eba5d5d7f4` | 通过 |
| `gather-mist-ore.png` | 128×128 | `032f565f56ac` | 通过 |
| `gather-mist-plant.png` | 128×128 | `1bf096e38354` | 通过 |
| `gather-nodes.json` | JSON | `22428fc326bb` | 通过 |
| `gather-nodes.png` | 1982×264 | `d80e117569de` | 通过 |
| `gather-rift-ore.png` | 128×128 | `7df171c603fa` | 通过 |
| `gather-rift-plant.png` | 128×128 | `782a36316cdc` | 通过 |
| `gather-wind-ore.png` | 128×128 | `7c96ebbf3f58` | 通过 |
| `gather-wind-plant.png` | 128×128 | `86b3e3bc1a1e` | 通过 |
| `hunt-flood.json` | JSON | `59c2841ee2eb` | 通过 |
| `hunt-flood.png` | 1982×136 | `fb69ebeb8546` | 通过 |
| `hunt-rockfall.json` | JSON | `7858290cc535` | 通过 |
| `hunt-rockfall.png` | 1890×620 | `573bb5e4dacf` | 通过 |
| `recover-tablet.json` | JSON | `da70d1cc5d00` | 通过 |
| `recover-tablet.png` | 1826×520 | `47a87ff2af24` | 通过 |
| `rock-rubble.png` | 160×96 | `bf15b7463c20` | 通过 |
| `rock-warn-0.png` | 256×128 | `e70e772cbe3a` | 通过 |
| `tide-beacon.json` | JSON | `ecbe6a91aaef` | 通过 |
| `tide-beacon.png` | 1962×780 | `367620fe1412` | 通过 |

### 本地对比、逐帧与预览

下表只留本地，均未提交Git。三地表对比采用实际草地/沙地/暗石纹理；冻舰巡守参照来自既有证据截图，其白底保留以避免伪造运行状态。

| 路径（`.runtime/art-hd/`下） | 尺寸 | sha256前12 |
|---|---|---|
| `baseline.png` | 1200×700 | `628d1bd6ac26` |
| `overview.png` | 2600×1820 | `145a17286840` |
| `baseline-comparison.png` | 1200×700 | `628d1bd6ac26` |
| `D1-comparison.png` | 1200×700 | `2392aad37d40` |
| `D2-comparison.png` | 1200×700 | `2cf9bc67702e` |
| `D3-comparison.png` | 1200×700 | `4d8d87248a2e` |
| `D4-ore-comparison.png` | 1300×700 | `b24033ffc7b5` |
| `D4-plant-comparison.png` | 1300×700 | `79c0cd29096a` |
| `D4-wind-sample-comparison.png` | 1200×700 | `23d530542f62` |
| `D5-comparison.png` | 1200×720 | `837baf6a7a30` |
| `D6-comparison.png` | 1200×400 | `539d6668f5c1` |
| `R9-scene-comparison.png` | 2600×700 | `ec02ecd42bec` |
| `D4-64px-states.png` | 1000×520 | `91696243a764` |
| `flood-seam-check.png` | 700×380 | `b230a7b61f2f` |
| `augment-frames-all-frames.png` | 1000×540 | `6a552d57cbcc` |
| `gather-nodes-all-frames.png` | 1000×900 | `249f8be5b8b3` |
| `hunt-flood-all-frames.png` | 1000×900 | `a793a77d97df` |
| `hunt-rockfall-all-frames.png` | 1000×720 | `e95c1414b8fc` |
| `recover-tablet-all-frames.png` | 1000×540 | `5181e9db3d51` |
| `tide-beacon-all-frames.png` | 1000×900 | `93f6d5228d07` |
| `augment-shine.gif` | 440×600 | `94df06af2af7` |
| `beacon-critical.gif` | 192×256 | `11fb148f80a3` |
| `beacon-damaged.gif` | 192×256 | `e358ab5a5ceb` |
| `beacon-full.gif` | 192×256 | `30726a7c1010` |
| `beacon-hit.gif` | 192×256 | `998d8c34287c` |
| `flood-recede.gif` | 128×64 | `44c5be747c3e` |
| `flood-splash.gif` | 96×48 | `dc44b1590075` |
| `flood-warn.gif` | 128×64 | `551b1df6d4f3` |
| `flood-water.gif` | 128×64 | `451268925fb7` |
| `gather-states.gif` | 800×180 | `6e63fda877ec` |
| `recover-flash.gif` | 256×256 | `69bfdcf4cee8` |
| `rock-fall.gif` | 160×256 | `1be6ffd495fa` |
| `rock-impact.gif` | 256×192 | `eaf65c911cdf` |
| `rock-warn.gif` | 256×128 | `1acbf22f8b61` |

### 提交范围与状态

仅提交 `packages/asset-manifest/open-world-five.v1.json`、`packages/asset-manifest/hub-fun.v1.json`、本进度文件与 `art-hd-decisions.md`。提交前检查暂存统计和限定路径，图片、原始素材、脚本、GIF、图集运行时JSON均不进Git。协作中心通过 `更新游戏协作.ps1` 将ART-HD改为「待接线」并按指定文本留言。

## 接线清单

运行时前缀 `/art/hub-fun/`；每项加载同名 `.png` 与 `.json`，atlas为TexturePacker hash。没有硬阻塞。美术已交付，状态选择、时序与地图摆放由Claude接线。播放时按公开战斗时间定位帧，避免重连后从首帧重播。

| 资源 / 图集 | 帧名 | 锚点 | 显示尺寸 | 帧率 / 时序 | 接到哪里 |
|---|---|---|---|---|---|
| ow-art-hub-tide-beacon / tide-beacon | beacon-full-0…5 | [0.5,1] | 96×128 | 8fps循环；hp/max >0.5 | 怪潮beacon公开状态，dungeon-controller.ts中心信标 |
| 同上 | beacon-damaged-0…5 | [0.5,1] | 96×128 | 10fps循环；0.2 < hp/max ≤0.5 | beacon耐久档位 |
| 同上 | beacon-critical-0…5 | [0.5,1] | 96×128 | 16fps循环；0 < hp/max ≤0.2 | beacon危急档位 |
| 同上 | beacon-hit-0…2 | [0.5,1] | 96×128 | 16fps一次；受击后返回实时耐久态 | beacon受击表现；3帧是完整本体闪白替换帧 |
| 同上 | beacon-broken | [0.5,1] | 96×128 | 静态；hp≤0 | beacon摧毁态 |
| 同上 | beacon-aura | [0.5,0.5] | 128×64 | 静态 | 信标脚下独立地面层，中心对齐脚底；不当作判定半径 |
| ow-art-hub-hunt-flood / hunt-flood | flood-water-0…7 | [0.5,0.5] | 128×72 | 8fps循环 | hub-dungeon-runtime.ts flood公开进水分区；dungeon-controller.ts地面层 |
| 同上 | flood-warn-0…3 | [0.5,0.5] | 128×72 | 2fps循环/2秒预警 | flood进水前公开预警阶段 |
| 同上 | flood-recede-0…3 | [0.5,0.5] | 128×72 | 8fps一次/0.5秒 | flood退水，末帧透明后移除 |
| fx-hub-flood-splash / hunt-flood | flood-splash-0…5 | [0.5,0.75] | 48×24 | 12fps一次/0.5秒 | 角色在flood区移动时脚下叠；停止移动不重复生成 |
| fx-hub-rockfall / hunt-rockfall | rock-warn-0…5 | [0.5,0.5] | 256×128，范围按公开半径缩放 | 5fps一次/1.2秒 | hub-dungeon-runtime.ts rockfall预警；dungeon-controller.ts地面层 |
| 同上 | rock-fall-0…3 | [0.5,1] | 80×128 | 16fps一次/0.25秒 | rockfall落点，固定底部锚点，帧内含下落位移 |
| 同上 | rock-impact-0…5 | [0.5,0.67] | 128×96 | 12fps一次/0.5秒 | 公开落石命中阶段；脚下尘土与碎石 |
| ow-art-hub-rock-rubble / hunt-rockfall | rock-rubble | [0.5,1] | 80×48 | 静态保留3秒，再由前端淡出 | 落石命中位置的残留层 |
| ow-art-hub-gather-wind-ore / gather-nodes | gather-wind-ore / gather-wind-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-wind-plant / gather-nodes | gather-wind-plant / gather-wind-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-mist-ore / gather-nodes | gather-mist-ore / gather-mist-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-mist-plant / gather-nodes | gather-mist-plant / gather-mist-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-forge-ore / gather-nodes | gather-forge-ore / gather-forge-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-forge-plant / gather-nodes | gather-forge-plant / gather-forge-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-frost-ore / gather-nodes | gather-frost-ore / gather-frost-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-frost-plant / gather-nodes | gather-frost-plant / gather-frost-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-rift-ore / gather-nodes | gather-rift-ore / gather-rift-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-rift-plant / gather-nodes | gather-rift-plant / gather-rift-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-dragon-ore / gather-nodes | gather-dragon-ore / gather-dragon-ore-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| ow-art-hub-gather-dragon-plant / gather-nodes | gather-dragon-plant / gather-dragon-plant-done | [0.5,1] | 64×64 | 静态；default / done | gather-nodes.ts gatherArt()；只消费公开采集状态 |
| hub-augment-frames / augment-frames | augment-frame-silver / gold / prismatic | [0.5,0.5] | 220×300 | 静态；源图九宫格48/48/48/48 | augments-panel.ts按档位选卡框；中间动态文本 |
| 同上 | augment-shine-0…7 | [0.5,0.5] | 220×300 | 8fps循环/1秒 | 棱彩卡框透明叠层；与卡框同九宫格切片和尺寸 |
| 同上 | augment-fit-badge | [0.5,0.5] | 32×32 | 静态 | augments-panel.ts贴合构筑小标 |
| hub-recover-tablet / recover-tablet | recover-tablet / recover-tablet-dim | [0.5,0.5] | 24×24或48×48 | 静态 | 节点卡片刻片图标，已亮/未亮按公开进度选态 |
| 同上 | recover-flash-0…9 | [0.5,0.5] | 128×128 | 10fps一次/1秒 | growth-cards.ts回港找回演出；帧内已含刻片，避免重复叠本体 |
| 同上 | recover-glow | [0.5,0.5] | 128×128或按演出卡片缩放 | 静态；演出结束淡出 | growth-cards.ts卡片背后柔光层 |

接线补充：

- 水贴源128×64菱形，按现有projection=[32,18]纵向×1.125显示128×72，拼贴中心步进[±64,36]；所有相邻贴片用同一动画相位，外边界按公开分区裁切。
- 本体/采集点源底部留4px透明安全边，底部中心锚点照表；信标光环中心可相对底锚上移2显示像素对齐接地。
- 三选一卡框文字安全区源[56,56,328,488]，显示[28,28,164,244]；四角各48px不可拉伸，边条只作材质拉伸/平铺。
- 刻片技能图标叠加区源[43,38,42,48]，24px档缩放×0.1875、48px档×0.375；演出帧已有刻片，技能图标需要时按同一局部偏移单独叠。
- 清单中的兼容单图只用于现有sprite消费入口；动画消费请取image/atlas/stateFrames/stateFps。不同帧族锚点/显示尺寸见frameAnchors/frameDisplaySizes和上表，不用图集默认尺寸统一缩放。
