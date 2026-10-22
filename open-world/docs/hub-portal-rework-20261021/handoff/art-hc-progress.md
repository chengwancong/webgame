# ART-HC 进度

执行日期：2026-10-22。只制作美术与登记，素材不入 Git，U10/U12 不定稿。

- [x] R0 准备：协作中心 ART-HC 已改进行中；读取时 25,917 字符，未触发 40,000 归档门槛。基准板 `.runtime/art-hc/baseline.png`｜1400×850｜SHA256 `672e8ec73975`。四个 sys 图标、项目色板、港口三建筑、chart-panel.css 对应 Token 面板齐全。
- [x] C1 航图节点图标
- [x] C2 航区徽记
- [x] C3 航图底图
- [x] C4 港口补充场景物件
- [x] C5 港口建设页插画
- [x] C6 U10/U12 三方案
- [x] R9 校验、登记、总览、提交与交接

## C1 产物与自检

- `apps/web/public/art/hub-ui/chart-nodes.png`｜500×200｜SHA256 `1973319423a5`
- `apps/web/public/art/hub-ui/chart-nodes.json`｜—×—｜SHA256 `53aa390717fb`
- `.runtime/art-hc/qa/c1.png`｜1400×900｜SHA256 `4b5d36927ea2`

自检：已与基准板并排；修正首版细节偏多与灯塔双色强调；24px 书本、洞口、交叉矛、塔、宝箱、角骨门剪影可区分，浅色/浅金底均保留深墨轮廓。


## C2 产物与自检

- `apps/web/public/art/hub-ui/sea-emblems.png`｜924×264｜SHA256 `017dd234b933`
- `apps/web/public/art/hub-ui/sea-emblems.json`｜—×—｜SHA256 `76ac7508f8b0`
- `.runtime/art-hc/qa/c2.png`｜1400×900｜SHA256 `9e7973f09524`

自检：七航区各有正常与灰雾锁定态，共14帧。并排基准对比，轮廓/低饱和色面一致；锁定态具有独立雾带，32/64px 可辨识。


## C3 产物与自检

- `apps/web/public/art/hub-ui/chart-bg-wind.webp`｜2400×960｜SHA256 `8606b3ac3d7d`
- `apps/web/public/art/hub-ui/chart-bg-wind-thumb.webp`｜600×240｜SHA256 `af11ee2ffe27`
- `apps/web/public/art/hub-ui/chart-bg-mist.webp`｜2400×960｜SHA256 `b489cf33d9e7`
- `apps/web/public/art/hub-ui/chart-bg-mist-thumb.webp`｜600×240｜SHA256 `7289efa8e288`
- `apps/web/public/art/hub-ui/chart-bg-forge.webp`｜2400×960｜SHA256 `f4e7f5619e6b`
- `apps/web/public/art/hub-ui/chart-bg-forge-thumb.webp`｜600×240｜SHA256 `e6f87285561e`
- `apps/web/public/art/hub-ui/chart-bg-frost.webp`｜2400×960｜SHA256 `1730110b0542`
- `apps/web/public/art/hub-ui/chart-bg-frost-thumb.webp`｜600×240｜SHA256 `d7c08f3f66e5`
- `apps/web/public/art/hub-ui/chart-bg-rift.webp`｜2400×960｜SHA256 `dac8d2e7f1d1`
- `apps/web/public/art/hub-ui/chart-bg-rift-thumb.webp`｜600×240｜SHA256 `9a8af0c83d02`
- `apps/web/public/art/hub-ui/chart-bg-dragon.webp`｜2400×960｜SHA256 `b3983170b188`
- `apps/web/public/art/hub-ui/chart-bg-dragon-thumb.webp`｜600×240｜SHA256 `162a0bf46ff7`
- `apps/web/public/art/hub-ui/chart-bg-deep.webp`｜2400×960｜SHA256 `a3aac41854e6`
- `apps/web/public/art/hub-ui/chart-bg-deep-thumb.webp`｜600×240｜SHA256 `47cf290f8708`
- `.runtime/art-hc/qa/c3.png`｜1400×1500｜SHA256 `9a117f311900`

自检：七航区地貌、罗盘、羊皮纸齐全，无节点无文字；与基准板并排检查。按 D-C2 对中央宽高各80%柔和压低对比，亮度标准差/外圈比均 <0.5，实测 wind=0.1537, mist=0.1594, forge=0.1584, frost=0.1363, rift=0.1719, dragon=0.166, deep=0.1269。WebP quality=85，不透明，正图2400×960、缩略600×240。


## C4 产物与自检

- `apps/web/public/art/hub-port/port-warehouse.png`｜320×320｜SHA256 `254471f34b64`
- `apps/web/public/art/hub-port/port-pet-yard.png`｜300×240｜SHA256 `438898d5a3c0`
- `apps/web/public/art/hub-port/port-wardrobe.png`｜280×320｜SHA256 `1ae53df13fce`
- `apps/web/public/art/hub-port/port-stall-xuemi.png`｜220×240｜SHA256 `69d76449609e`
- `apps/web/public/art/hub-port/port-stall-mijia.png`｜220×240｜SHA256 `b89e041951d3`
- `apps/web/public/art/hub-port/port-stall-jinyu.png`｜220×240｜SHA256 `7abd52f93434`
- `apps/web/public/art/hub-port/workshop-tier-1.png`｜584×534｜SHA256 `faa3ce267ac9`
- `apps/web/public/art/hub-port/workshop-tier-2.png`｜584×534｜SHA256 `90d3224a8a50`
- `apps/web/public/art/hub-port/workshop-tier-3.png`｜584×534｜SHA256 `01679d0aea35`
- `apps/web/public/art/hub-port/port-extra.png`｜1764×862｜SHA256 `352f0d8d56eb`
- `apps/web/public/art/hub-port/port-extra.json`｜—×—｜SHA256 `2a17d1c93ad1`
- `.runtime/art-hc/qa/c4-full-port.png`｜1500×1250｜SHA256 `86fec14fd166`

自检：九件全部透明、2×源图、脚下安全边>=4px；与现有港口三建筑和地表并排对比，3/4俯视、左上光、木石铜色一致。工坊三档584×534，显示292×267，锚点[0.5,0.9]，三档实像底边统一525px（原图475/483同等比例）；六件新物件锚点[0.5,1]。合集无裁切、无旋转、2px内边距。


## C5 产物与自检

- `apps/web/public/art/hub-ui/port-build.png`｜1520×424｜SHA256 `c34410affd11`
- `apps/web/public/art/hub-ui/port-build.json`｜—×—｜SHA256 `b56e4d8da917`
- `.runtime/art-hc/qa/c5-cards.png`｜1500×900｜SHA256 `08fc8073ff95`
- `.runtime/art-hc/qa/c5-small.png`｜1400×900｜SHA256 `80cf8660fa4f`

自检：三建筑近景480×320，四周24px平滑衰减至alpha=0，奶白/白色板上无硬矩形边；四阶共用铜银金棱彩六角64×64；生命星晶和星核96×96，菱晶与六角星核剪影不同。已与基准板并排。


## C6 产物与自检

- `.runtime/art-hc/mockups/u10-a.png`｜1280×720｜SHA256 `6d8a294e4a52`
- `.runtime/art-hc/mockups/u10-b.png`｜1280×720｜SHA256 `caa13de655cf`
- `.runtime/art-hc/mockups/u10-c.png`｜1280×720｜SHA256 `b378f13711e3`
- `.runtime/art-hc/mockups/u12-a.png`｜1280×720｜SHA256 `8dbf8c0904cd`
- `.runtime/art-hc/mockups/u12-b.png`｜1280×720｜SHA256 `51bcdb770a8f`
- `.runtime/art-hc/mockups/u12-c.png`｜1280×720｜SHA256 `8cb19168d448`
- `.runtime/art-hc/qa/c6.png`｜1536×940｜SHA256 `63c3eaab4c3a`

自检：六张1280×720 PNG齐全；逐案字段、边界、中文排版和既有素材核对；未开启游戏或浏览器。 UI颜色直接读取 packages/ui-tokens/tokens.json。

| 方案 | 布局要点 | 优点 | 风险 |
|---|---|---|---|
| U10-A | 顶部横排航区，左六卡，右深渊及三个入口 | 延续 U2 顶部页签，重复刷图路径短 | 右列入口密度较高，深渊文案需保持单行 |
| U10-B | 左列六航区顺序，中间两列六卡，右深渊 | 裂星潮推进顺序直观，今日卡片空间大 | 三列分配使长航区/节点名更容易折行 |
| U10-C | 顶部航区带，左大里程碑，右六卡，底部入口 | 深渊目标醒目，周常入口宽松 | 今日卡片高度较紧，次要信息仅一行 |
| U12-A | 左四列三行网格，右固定详情 | 浏览与阅读分区稳定，延续 U9 左列右详情习惯 | 详情获取途径很长时需两行，避免挤压形态按钮 |
| U12-B | 左大图详情，右四列三行网格 | 选中宠物更突出，详情始终可见 | 从左侧详情扫到右侧网格的视线距离较长 |
| U12-C | 顶部横向详情，下六列两行网格 | 名称与途径有更宽空间，已获得/未获得可同时比较 | 网格宠物缩图较小；次要状态字号为12px，长名称需折行 |

六案均只列优缺点，未选择最终方案，由 Claude 裁决。全部中文真实字段以本机微软雅黑排版；宠物名称与图帧来自原 profile/actor，样例收集数不代表服务端存档。无喂养、升级、出战按钮。


## R9 收尾验证

- `.runtime/art-hc/overview.png`｜1800×2550｜SHA256 `bbfb14fedfb0`
- `packages/asset-manifest/hub-ui.v1.json`｜—×—｜SHA256 `b88ff4c9dcdb`
- `.runtime/art-hc/qa/contract-validation.json`｜—×—｜SHA256 `01b1687bba3d`
- `.runtime/art-hc/qa/tsc.log`｜—×—｜SHA256 `e3b0c44298fc`
- `.runtime/art-hc/qa/config-check.log`｜—×—｜SHA256 `015cc41140ff`
- `.runtime/art-hc/qa/validate-content.log`｜—×—｜SHA256 `da9f75c452e6`
- `.runtime/art-hc/qa/manifest-tests.log`｜—×—｜SHA256 `6abb872e1cb1`

- [x] C1–C5 全部导出并登记，C6 六张本地方案图齐全；总览与逐项基准板对照已检查。
- [x] `npx tsc --noEmit -p .`：退出0。
- [x] `pnpm config:check`：退出0，10本工作簿一致。
- [x] `npx tsx tools/validate-content.ts`：退出0；99 regions、83 skills、155 actors。
- [x] `npx vitest run <rg -l asset-manifest tests -g '*.test.ts' 返回的16个文件> --maxWorkers=1 --no-file-parallelism`：16文件/83测试全部通过，20.94秒；包括 plane-scenes，本次无既有失败。
- [x] 资源专项验证：31个运行时文件/40帧，4张图集≤2048，PNG均RGBA+sRGB ICC，straight alpha，全透明RGB=0；2px内边距，无旋转、无裁切；尺寸、SHA256、图集与单图像素一致；本批合计 **6,775,705 bytes**，小于10,000,000。
- [x] 所有新清单条目 `accepted:false`；生产者静态自检通过，接线/动态/游戏内验收由 Claude 后续处理。
- [x] 共享清单保留现有142条资源（含ART-HB 13条），只追加本批9条并更新汇总计数，前后逐条深比较通过。

生成方式：内置 imagegen；提示词与原始图保存在 `.runtime/art-hc/source/prompts.json` 和同目录。导出、自检、精确中文示意图排版使用本机 Pillow；宠物图帧溯源见 `source/pet-crops.json`。没有新素材下载，没有游戏/无头/浏览器自动化，没有改 apps/web/src 或地图JSON。

Git提交仅限以下4个路径：
- `packages/asset-manifest/hub-ui.v1.json`
- `packages/asset-manifest/starsea.v1.json` 中 ART-HC 的9条新增及计数增量
- `docs/hub-portal-rework-20261021/handoff/art-hc-progress.md`
- `docs/hub-portal-rework-20261021/handoff/art-hc-decisions.md`

提交前读取共享清单最新已提交版本 `005e147c30dc`；当时 ART-HB 13条仍在工作区未提交。提交时重新基于最新 HEAD 合并本批条目，以独立临时索引仅提交 HC 增量，工作区 HB 内容保留，不等待 HB。

最终交接：协作中心已通过 `更新游戏协作.ps1` 改为「待接线」并追加指定留言，锁已释放。独立索引的 `git diff --cached --stat` 仅4个允许文件；无图片或原始素材。提交前对照共享清单最新HEAD，只提交HC9条，不夹带尚未提交的HB13条。

## 接线清单

路径以 open-world 为根，运行时前缀 `/art/` 对应 `apps/web/public/art/`。图集JSON均 TexturePacker hash；资源不在 Git，部署时须从本机复制所列运行时文件。

| 资源 | 帧名 | 锚点 | 源尺寸 → 显示尺寸 | 替换位置 / 条件 |
|---|---|---|---|---|
| `/art/hub-ui/chart-nodes.{png,json}` | `node-story` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：story |
| `/art/hub-ui/chart-nodes.{png,json}` | `node-nest` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：nest |
| `/art/hub-ui/chart-nodes.{png,json}` | `node-hunt` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：hunt |
| `/art/hub-ui/chart-nodes.{png,json}` | `node-tide` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：tide |
| `/art/hub-ui/chart-nodes.{png,json}` | `node-treasure` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：treasure |
| `/art/hub-ui/chart-nodes.{png,json}` | `node-gate` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | chart-panel.ts KIND_ICONS：gate |
| `/art/hub-ui/chart-nodes.{png,json}` | `mark-collect` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | hub-node__collect 收藏角标 |
| `/art/hub-ui/chart-nodes.{png,json}` | `mark-hidden` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | 未开放/隐藏节点 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-wind` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 wind；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-mist` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 mist；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-forge` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 forge；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-frost` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 frost；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-rift` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 rift；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-dragon` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 dragon；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-deep` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 deep；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-wind-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 wind-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-mist-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 mist-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-forge-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 forge-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-frost-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 frost-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-rift-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 rift-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-dragon-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 dragon-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/sea-emblems.{png,json}` | `emblem-deep-locked` | [0.5, 0.5] | 128×128 → 32×32 / 64×64 | 顶部航区页签 deep-locked；-locked为未开放灰雾态 |
| `/art/hub-ui/port-build.{png,json}` | `build-card-forge` | [0.5, 0.5] | 480×320 → 240×160 | port-panel.ts U9：建筑详情近景 |
| `/art/hub-ui/port-build.{png,json}` | `build-card-dock` | [0.5, 0.5] | 480×320 → 240×160 | port-panel.ts U9：建筑详情近景 |
| `/art/hub-ui/port-build.{png,json}` | `build-card-post` | [0.5, 0.5] | 480×320 → 240×160 | port-panel.ts U9：建筑详情近景 |
| `/art/hub-ui/port-build.{png,json}` | `build-tier-1` | [0.5, 0.5] | 64×64 → 32×32 | port-panel.ts U9：三建筑共用4阶徽章 |
| `/art/hub-ui/port-build.{png,json}` | `build-tier-2` | [0.5, 0.5] | 64×64 → 32×32 | port-panel.ts U9：三建筑共用4阶徽章 |
| `/art/hub-ui/port-build.{png,json}` | `build-tier-3` | [0.5, 0.5] | 64×64 → 32×32 | port-panel.ts U9：三建筑共用4阶徽章 |
| `/art/hub-ui/port-build.{png,json}` | `build-tier-4` | [0.5, 0.5] | 64×64 → 32×32 | port-panel.ts U9：三建筑共用4阶徽章 |
| `/art/hub-ui/port-build.{png,json}` | `collect-life-crystal` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | port-panel.ts U9：收藏统计 |
| `/art/hub-ui/port-build.{png,json}` | `collect-star-core` | [0.5, 0.5] | 96×96 → 24×24 / 48×48 | port-panel.ts U9：收藏统计 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-warehouse.png（id ss-scene-port-warehouse）` | `port-warehouse` | [0.5, 1] | 320×320 → 160×160 | ss-map-port 南 warehouse |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-pet-yard.png（id ss-scene-port-pet-yard）` | `port-pet-yard` | [0.5, 1] | 300×240 → 150×120 | ss-map-port 东南 pet-yard；宠物系统开放后 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-wardrobe.png（id ss-scene-port-wardrobe）` | `port-wardrobe` | [0.5, 1] | 280×320 → 140×160 | ss-map-port 西 wardrobe |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-stall-xuemi.png（id ss-scene-port-stall-xuemi）` | `port-stall-xuemi` | [0.5, 1] | 220×240 → 110×120 | ss-map-port 港务厅附近；霜镜 NPC 搬入 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-stall-mijia.png（id ss-scene-port-stall-mijia）` | `port-stall-mijia` | [0.5, 1] | 220×240 → 110×120 | ss-map-port 港务厅附近；沉星 NPC 搬入 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/port-stall-jinyu.png（id ss-scene-port-stall-jinyu）` | `port-stall-jinyu` | [0.5, 1] | 220×240 → 110×120 | ss-map-port 港务厅附近；龙眠 NPC 搬入 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/workshop-tier-1.png（id ss-scene-workshop-tier-1）` | `workshop-tier-1` | [0.5, 0.9] | 584×534 → 292×267 | ss-map-port 东 forge；M09 工坊设施外观第1档；三档互斥替换 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/workshop-tier-2.png（id ss-scene-workshop-tier-2）` | `workshop-tier-2` | [0.5, 0.9] | 584×534 → 292×267 | ss-map-port 东 forge；M09 工坊设施外观第2档；三档互斥替换 |
| `/art/hub-port/port-extra.{png,json}；单图 /art/hub-port/workshop-tier-3.png（id ss-scene-workshop-tier-3）` | `workshop-tier-3` | [0.5, 0.9] | 584×534 → 292×267 | ss-map-port 东 forge；M09 工坊设施外观第3档；三档互斥替换 |
| `/art/hub-ui/chart-bg-wind.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；wind航区；pointer-events:none |
| `/art/hub-ui/chart-bg-wind-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-mist.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；mist航区；pointer-events:none |
| `/art/hub-ui/chart-bg-mist-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-forge.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；forge航区；pointer-events:none |
| `/art/hub-ui/chart-bg-forge-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-frost.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；frost航区；pointer-events:none |
| `/art/hub-ui/chart-bg-frost-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-rift.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；rift航区；pointer-events:none |
| `/art/hub-ui/chart-bg-rift-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-dragon.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；dragon航区；pointer-events:none |
| `/art/hub-ui/chart-bg-dragon-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |
| `/art/hub-ui/chart-bg-deep.webp` | — | [0,0] | 2400×960 → 1200×480 | .hub-links 下方节点图背景；deep航区；pointer-events:none |
| `/art/hub-ui/chart-bg-deep-thumb.webp` | — | [0,0] | 600×240 | 对应航区缩略预览，不替代正图 |

工坊特别说明：当前 `ss-scene-workshop` 显示宽292，锚点[0.5,0.9]。三档统一584×534画布、实像底边y=525，显示底边相对锚点下方22.2px；整体宽与底边保持同位替换，不按交接旧建议255再缩一次。六件新物件底边中心锚点[0.5,1]，底部4px源图透明安全边（显示2px）。地图碰撞与摆位由Claude按现有地图规则确定。

U10/U12 本地方案：`.runtime/art-hc/mockups/u10-a.png`、`u10-b.png`、`u10-c.png`、`u12-a.png`、`u12-b.png`、`u12-c.png`；全部1280×720，只供Claude裁决，未定稿、未接线。上文C6表列每案优点与风险。
