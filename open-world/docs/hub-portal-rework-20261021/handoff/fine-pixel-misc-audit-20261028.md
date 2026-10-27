# 杂项资源的实际用途、语义和细节复核（2026-10-28）

本记录只描述子 agent 制作和复核的候选，不等于已接入、已部署或用户认可。所有 PNG、草稿、网格图、联系表和大键表均留在 `.runtime/pixel-coherence/misc/`；不提交图片。主代理统一合并 live manifest、检查、提交和发布。

2026-10-28 主代理美术复核：138语义UI、132杂项和4图集可接入；**22张 scenic 第一版偏写实且高频碎噪，不作为风格完成验收**。第二版风原代表已获主代理离线批准，再完成全部22项，均采用新画的清晰块面源、实际地标与暖白留白，不混第一版。子agent已查看完整旅行、七区边景和三Boss卡联系表；三Boss卡已在怪物agent最终C组新风格208原生稿就绪后重新叠加并复核。

## 已修正的具体问题

| 实际资源 / 用途 | 旧像素资源的问题 | 本轮候选 |
|---|---|---|
| `chart-bg:{wind,mist,forge,frost,rift,dragon,deep}` / 900×504 节点图区的底纸 | 原图是留白地图纸和地区边景；旧 PX9 将七区画成同一随机岛轮廓和四棵树，既改变用途，也没有表现七区环境 | 7 张新画的地区边景，900×504、scale1。中央暖白留白，边缘分别为风车海崖、雾林废墟、火山城、冰崖、紫晶裂隙、龙骨、潮海；不烘焙节点、路线或虚构真实地理 |
| `supplement:travel/{meadow,forest,rift,tundra,abyss,dragonbone}.png` / 任务地点插画 | 旧生成器为各区复用草地、三棵树与道路的320×184程序场景，丢失原插画的地标 | 6 张新640×360原生插图，按原图保留门楼溪流、吊桥瀑布、火山桥城、冰谷、紫渊石桥、沙漠龙骨等主要地标和构图 |
| `supplement:travel/{tundra-boss,abyss-boss,dragonbone-boss}.png` / 首领地点预览 | 与普通地区复用简陋场景，缺少真正竞技场和同一首领身份 | 按原3个圆形竞技场重新画空场，并叠怪物 agent 最终采用的同一208px原生中性帧；不放大首领、不另画随机怪物 |
| `supplement:chapters/{tundra,abyss,dragonbone,tundra-boss,abyss-boss,dragonbone-boss}.png` / 章节登记的环境插图 | 同样复用旧程序场景 | 普通环境复用相应本轮新景；首领环境保留空竞技场，不把首领烘焙进战斗场地 |
| `wardrobe-thumb:{16套}:head`、`wardrobe-style:100011` / 头部静态缩略 | 旧的风格头图画成盾，其他套装也是通用头盔；与当前柴犬身份不符 | 从游戏实际新柴犬拆件 `fine/shiba/images/head.png` 制作32/16头部缩略；保持柴犬毛色，不给头/手/装备都换成整个人 |
| `wardrobe-thumb:{16套}:hands` / 手部缩略 | 旧程序图像火焰，不是手套或袖口 | 在32和16格分别画有袖口、金边、皮革明暗与拇指轮廓的一对手套；按现有 cloth 色阶表达套装 |
| `wardrobe-thumb:{16套}:legs` / 裤装缩略 | 旧程序图只有大块裤腿，细节和体积不足 | 在32/16分别画腰带、扣、前裆、裤缝、明暗腿和裤脚 |
| `wardrobe-thumb:{16套}:back` / 背饰缩略 | 旧 PX9 将所有套装统一画成披风，连空背饰也伪造新装备 | 6个非空按实际部件含义画：100061长灰蓝发、100092弓、100102短红发、200291双马尾、200311箭筒、200331短披风。另10个空层用相同的中性四角框＋横杠；不为去重乱造差别 |
| `css-ground:title-grass`、`css-ground:title-road` / 标题营地背景的铺地 | 仍为16px/scale2 | 已从主代理最终 native32 地表的 Wang 满内块（15×32,0,32,32）重取原生32瓦片，保持草和路语义；RGBA与源rect逐像素相等 |
| `supplement:hub-ui/chart-nodes.png` / 航图节点与详情小图 | 8帧中7帧是同一个通用菱形；32×scale2还会在40/16控件中被裁 | 40px原生主档＋16px原生`:small`档：书、巢穴洞口、狩猎准星、怪潮波浪、宝箱、关口门、收藏晶体、隐藏问号 |
| `supplement:hub-ui/sea-emblems.png` / 24px航区页签 | 多区是同菱形，锁态大量误作盾；64px显示图被24控件裁掉 | 24px原生风车、杉林、铁砧、雪花、裂晶、龙骨、海波，另各自灰色锁态，保留原 sourceFrames 对照 |
| `supplement:hub-ui/port-build.png` / 建设卡、阶级与收藏图 | 工坊/船台/邮局是极小铃/小船/小车程序图；徽章不适合24px控件 | 对应实际新工坊、码头、邮局造型，200×134大卡＋120×80小卡，24px阶级、生命晶体、星核；LOD保留原帧名和`:small` |
| `supplement:hub-ui/explore/icon-cache.png` / 秘藏 | 原程序通用材料图不清楚是宝箱 | 复用成熟7Soul `I_Chest02.png`，诚实继承其CC0来源和SHA |

主角/NPC/世界大物件/地表、怪物与首领动画、宠物与战斗FX各有其他 agent 所有者，本记录没有重复制作它们。

## 保留与排除

- 成熟且含义正确的7Soul原生32/16物品、胸甲、鞋、武器、技能图标继续保留。没有为数量重画合格图标。
- `supplement:hub-fun/kill-streak.png` 的中文笔画、数字和乘号能读出连斩/横扫/无双/神威，语义正确；没有下载新字体，也没有为换风格重画全部文字。
- `supplement:hub-fun/boss-banner{,-shield}.png` 是留给实时文本的空横幅底图，旧图本身为二值透明、硬轮廓，未用精细插画遮住安全文字区；本子任务保留，主代理可以按公共UI色板调整。
- 宠物编队/流派选中和 `ui-ornaments` 的6个旧CSS图片，在像素模式实际由 `pixel-mode.css` 的公共奶白浅金边框替代，不把旧图片“有覆盖”当作它们已重画，也不额外生产不会显示的新图。
- 标题树、风车、帐篷、营火和石头，复用主代理的新实际地物；标题不是另一套独立生成风景。
- `pixel-ui:hero-portrait` / `pixel-ui:hero-figure` 由主代理用真实新柴犬制作，本子任务不覆盖。
- 对话头像和现有字体按用户此前要求保留；未下载字体。
- `chapters.json` 经 `actors.ts` 可达并不证明其中所有场景都独立加载。仍为其登记插图补齐候选，但不据此扩大“真机已展示”或“独立场景已验收”的结论。

## 生产记录

- 使用内置 imagegen 模式。第一版和第二版各7张航图边景、6张普通旅行景、3张首领空竞技场；第一版经美术复核拒用，当前22条候选只使用第二版16份源。草稿从 `C:/Users/ccc/.codex/generated_images/…` 复制进项目 `.runtime/pixel-coherence/misc/v2/` 后才使用；未引用仅存在默认目录的素材。
- 航图提示词要点：单张900×504横幅，中间76%宽高空暖白，外缘8–12%七气候边景；无地图岛轮廓、路径、节点、字符或人物；左上光、清楚硬格、密集但克制的像素簇。
- 普通旅行提示词要点：原六图联系表仅作构图参考，每次单独重画一景，保持具体地标；16:9、原生640×360意图、硬方格、无模糊/画笔/抖动，无首领/人物/UI。
- 首领空场提示词要点：分别保持原冰竞技场、紫渊祭坛、龙骨竞技场布局，完全空场，后续只在旅行预览叠本游戏同一首领。
- `tools/pixel/fine-misc-source.py` 先调用本机 proper-pixel-art 恢复网格，再量化到项目当前64色、二值不透明和暖白留白整理；输入图不是直接成品。恢复与最终尺寸写在运行时 `*-grid-report.json`。`--cached-grid` 只复用已恢复的网格，不跳过色板阶段。
- `tools/pixel/fine-misc.mjs` 生产真实头部裁图、各独立槽位和标题瓦片；图标在各原生格直接画，不放大16px成品。
- `tools/pixel/fine-misc-scenes.mjs` 生产航图和15张环境插图；首领来自 `monsters/native/{frost-queen,abyss-lord,dragon}-208.png`。`dragonbone` 对应章节登记 `dragon_king`，没有凭文件名引入不存在的 `bone_dragon`。
- `tools/pixel/fine-misc-atlases.mjs` 生产4个UI图集，保留真实sourceFrames/动作以外的语义帧名。港口图集含PixelFrog免费游戏使用来源的邮局房屋，保留GameUse许可，不标为CC0；宝箱继承7Soul的CC0记录。

## 交付和单项验证

| 候选清单（都在 `.runtime/pixel-coherence/misc/`） | 条目 | 键表 |
|---|---:|---|
| `misc-candidates.json` | 132 | `misc-keys.json` |
| `scenic-candidates.json`（全部V2） | 22 | `scenic-keys.json` |
| `atlas-candidates.json` | 4 | `atlas-keys.json` |
| 合计 | 158 | 三个清单的键不重叠 |

158项逐一通过 `checkAsset`；检查原生格、整数锚、scale1、当前主色板、二值透明、孤立像素、SHA和来源字段。检查通过不能代替画面认可。已查看头/手/腿/背联系表、七航区联系表、九场景联系表、三首领卡及图集联系表，修掉航图强制中央清空产生的生硬裁边。

`misc-replaced-cc0-keys.json` 有32项头部原CC0绑定应从旧 `pixel-open-art.mapping` 移除；不能给新的本项目柴犬头保留旧头盔来源。前一批语义UI还有138项移除列表，主代理合并时一并处理。当前旧测试 `open.mapping >1400` 需要按真实来源调整，不为通过数量断言保留假来源。

本子 agent 未改 live manifest、公共色板、共享渲染、UI布局、玩法或任何真实玩家状态，未 commit，未执行 tsc/全量vitest/部署。由主代理串行执行这些任务。标题瓦片已在最终183个native32地表银行就绪后重取：`ow-art-grass`、`ss-scene-road` 的frame15，RGBA逐像素相等，均为32×32/scale1；重生前后132项SHA均无变化。

- 标题草地SHA256：`c93e4656f5108639d1dd181111ec9fd924723cfd6f266d7cb319d70933c3783a`。
- 标题石路SHA256：`03f937345d710d237e711dc3ccf654a1880fcbf735de9fe67e97e37cd7e6e199`。
- 最终来源rect、银行SHA和rawMatch记录在 `.runtime/pixel-coherence/misc/final-title-sync.json`。

## 给真机检查者

1. 七航区切换时，中央仍是原实际节点与连线；背景只有气候边景，不出现随机新岛，字/按钮不被边景淹没。
2. 任务卡查看六普通区域和三首领地点；冰女王、深渊领主、龙王与实际游戏造型一致。章节竞技场本身不应多画一只静态首领。
3. 外观七槽逐个点开：头是柴犬头，手是手套，腿是裤装；6个非空背饰保持实际类型，10个原空背饰明确显示中性无背饰，不统一披风。
4. 航图40px节点、16px详情/收藏标、24px地区徽记都完整可见，无裁掉一半；锁态仍能辨认地区，不是同一把盾。
5. 建设页在120×80列表与200×134详情同时检查新建筑卡；24px阶级、生命晶体和星核都完整且彼此可区分。
6. 开关反复切换应完整恢复原图和原布局；标题草路是32原生格，文字保留清晰原生渲染。

## Scenic 二版代表图：先审核、再扩展

风原代表已新画并完成 proper-pixel-art 和主色板38色子集整理，输出640×360；它不是对第一版的锐化、缩小或滤镜。仅保留第一版的门楼/溪流/树/山等地标构图，画风直接参考用户最早的明快蓝橙港口图。大树冠、三面石块、平涂草坡、条带水面和大云代替写实碎材质。横向颜色段变化由110875减为47369（约57%），只作为高频纹理辅助指标，不当作美术认可。

代表路径：`.runtime/pixel-coherence/misc/v2/travel-meadow-native.png`；上旧下新对照：`v2/meadow-before-after.png`。主代理已实际看代表对照，批准第二版色块/阴影/树叶簇方向后，才继续生产其余场景。现22项V2全部逐项checkAsset通过，22个SHA相对拒用V1全部改变，V1混用为0；普通景/空竞技场的横向颜色段变化比第一版降低45–59%，只作辅助指标。全部成品file路径为 `misc-scenes-v2/`，其他138语义UI、132杂项、4图集保持冻结，本子agent未改live。

最终联系表位于 `v2/travel-contact.png`、`v2/chart-contact.png`、`v2/boss-card-contact.png`；核验记录 `v2/final-review.json`。完整16份实际生产提示词与参考来源见 [Scenic V2完整提示词](fine-pixel-scenic-v2-prompts-20261028.md)。Boss卡已使用最终新风格208源重叠加并再次逐项校验22项，保持同一Boss身份和原生尺寸，不放大；`v2/final-boss-sync.json`记录最终三源SHA与旅行卡SHA。

内置 imagegen 模式。第一张参考为用户蓝橙港口图，第二张旧风原只作地标构图参考，明确丢弃其碎噪材质。完整首张生产提示词如下（另保存 `v2/production-prompts.json`）：

```text
Create ONE newly painted clean pixel-art scenic illustration, landscape16:9, intended native640x360. REFERENCE1 is the required ART DIRECTION: charming bright blue/orange medieval harbor RPG, broad deliberate flat pixel clusters, simple readable volumes, crisp selective dark outlines, 3–5 shade planes per material. Match REFERENCE1's clean solid stone blocks, rounded foliage masses and geometric blue water, NOT photographic detail. REFERENCE2 is COMPOSITION AND LANDMARKS ONLY; completely discard its noisy/painterly texturing. Rebuild the meadow composition: shallow blue creek in lower foreground, a few large light sandstone boulders and grassy banks, one or two chunky tree canopies at left framing the view, central/right short ruined sandstone gate with a bright blue portal and a few connected arches, simple blue mountains and cream clouds far away. Preserve these major landmarks and relative positions while reducing architectural micro-detail. NEW STYLE RULES: visually quiet wide flat-color planes. Grass is 2–3 uninterrupted green shapes, NOT thousands of grass blades. Trees use 3–4 large leaf-mass shades, no individual leaves. Rocks have 3 broad clean polygon planes with only a few cracks. Water is broad blue/cyan bands with few rectangular highlights, no scattered glitter. Stonework uses big legible rectangular bricks with sparse seams. Sky is large flat bright blue plus 2–3 stepped cream clouds. Choose a restrained palette around45 colors, warm ivory/gold highlights, navy shadows, green clusters, saturated blue and orange accents. Fine enough for native640, no coarse 16px upscaling. No stippling, dithering, mottling, pixel noise, faux film grain, tiny scattered leaves, surface flecks, painterly brushwork, realistic intricate ruins, micro-texture, smooth gradients, blur or antialiasing. NO characters, no monsters, no text, no UI. Every major object should be recognizable at thumbnail size, with the same friendly crafted game aesthetic as reference1.
```
