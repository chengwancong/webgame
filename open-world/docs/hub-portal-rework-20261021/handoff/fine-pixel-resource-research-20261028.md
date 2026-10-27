# 细腻像素资源研究与 UI 语义候选 · 2026-10-28

只采用作者／官方仓库的许可说明，不把“免费”“画布 128px”或宣传 GIF 当作原生细节证明。下载留在 `.runtime/pixel-coherence/research/`；没有整仓 clone、购买、下载字体或浏览器自动化。本文不代表美术已通过用户验收。

## 已下载、可执行的主要来源

### OpenDuelyst：成熟单位与大范围特效，CC0

来源：[官方仓库](https://github.com/open-duelyst/duelyst)、[官方 LICENSE](https://github.com/open-duelyst/duelyst/blob/2843f2400854136598631288c2e8dfb8f5173de7/LICENSE)。README 明确整仓采用 CC0；固定提交 `2843f2400854136598631288c2e8dfb8f5173de7`。作者为 Counterplay Games。CC0 允许商用、改作与静态发布；不使用 Duelyst 品牌作背书。

已选择性下载 21 个单位、17 组特效的 PNG/plist 共 76 文件，以及许可／README。没有用网页放大 GIF。目录 `research/duelyst/app/resources/{units,fx}/`；逐文件 git SHA 与 SHA256 见本机 `duelyst-source-index.json`。确定性选定包 `duelyst-selected-cc0.zip` 的 SHA256 为 `fa8f394053f744f1a1c6150e77dbadc0be8467d1b21154089e193892c083853c`。

每个 plist 提供 frame、sourceSize、sourceColorRect、offset 与 rotated。已额外整理 `duelyst-native-frames.json`（38 组／1907 帧，所选文件均未旋转）和 `duelyst-animation-summary.json`，便于直接重排。不能用 sourceSize 代替真实身体尺寸。

| 样本 | 原生画格 | 首张 idle 可见内容 | 动画（原帧数） | 可用范围与限制 |
|---|---:|---:|---|---|
| `f2_demononi` | 120×120 | 45×52 | attack32、breathing14、death19、hit3、idle14、run8 | 成熟人形小怪；不可声称身体 120px |
| `boss_grym` | 115×115 | 76×60 | attack20、breathing14、death20、hit3、idle14、run8 | 骨龙／黑翼龙式生物，可参考 rift 生物；不足 192px 大首领 |
| `boss_treatdrake` | 120×120 | 65×69 | attack21、breathing14、death17、hit3、idle14、run8 | 彩色飞龙／宠物，需角色辨识和公共色板复核 |
| `boss_borealjuggernaut` | 120×120 | 74×50 | attack26、breathing14、death21、hit3、idle16、run8 | 冰蓝重甲四足兽，适合冰系／重型宠物 |
| `f4_demonofeternity` | 100×100 | 59×62 | attack28、breathing18、death15、hit3、idle20、run10 | 巨臂恶魔小型原型 |
| `neutral_golemnature` | 80×80 | 46×44 | attack8、breathing14、death9、hit3、idle12、run8 | 苔藓／自然石像原型 |
| `neutral_golemice` | 80×80 | 39×43 | attack10、breathing14、death9、hit3、idle13、run8 | 冰晶人／冰像原型 |
| `f6_spiritwolf` | 100×100 | 61×32 | attack29、breathing14、death19、hit3、idle12、run8 | 横向狼型，小宠物或 `ss-mon-frost-hound` 的参考；勿硬撑成高大狼 |
| `neutral_hydrax` | 100×100 | 57×39 | attack24、breathing14、death18、hit3、idle16、run8 | 多头蛇／海德拉型宠物 |
| `f6_motherofdrakes` | 100×100 | 29×55 | attack20、breathing14、death21、hit3、idle18、projectile6、run8 | 原生带投射动作的细长生物 |

所有单位是同套三分之四战斗视角，适合游戏现有左右镜像；光照与色彩应逐个统一，霓虹部分不能不经处理直接混入暖色港口。对 `ss-mon-moss-warden`、冰系小怪和 `ss-pet-*` 18 家族可做明确原型筛选；体型与动作语义最终由制作 agent 核查。所选单位身体多在 40–70px，**大尺寸首领仍是缺口**，不能用图集留白冒充高精度。

| 特效 | 原生画格／帧数 | 已看过的实际形状及建议 |
|---|---|---|
| `fx_fireslash` | 128×128／13 | 火焰三角形斩痕，适合火斩；不是普通圆爆 |
| `fx_bouldersphere` | 300×220／35 | 实际呈纵向岩体／胶囊下落痕，不是地面陨坑 |
| `fx_f4_voidpulse` | 180×180／28 | 紫色暗雷脉冲，适合暗系命中／区域 |
| `fx_f5_earthsphere` | 180×180／31 | 青色径向球体；不能仅因文件名 earth 就当裂地 |
| `fx_beamfire` | 140×380／31 | 灰白运行时着色 mask，可按元素染色；不是直接红火成品 |
| `fx_tornadoswirl` | 150×110／35 | 灰白旋风，形状清楚，可做风系原型 |
| `f6_flashfreeze` | 100×100／13+13+12 | appear／idle／disappear 冰尖完整生命周期 |
| `fx_fireimpact` | 92×80／7 | 火焰弧线命中 |
| `fx_heal` | 80×80／15 | 绿色环绕光点，适合治疗而非土裂纹 |

灰白 mask、半透明边和辉光需按元素统一色板并做二值透明轮廓。原文件没有统一 FPS 或本项目命中标记，必须沿用本项目时长／peak／挂点做 retime，不能直接按帧数更改技能。原生预览 `duelyst-native-contact.png` 和 `duelyst-fx-contact.png` 已供制作 agent 检查。

### LuizMelo · Evil Wizard 2：真正较高的暗系施法者

[作者页](https://luizmelo.itch.io/evil-wizard-2) 明确免费 CC0，包内 `License.txt` 再次明确商用／非商用可用。下载 upload `2648971`，文件 `EVil Wizard 2.zip`，SHA256 `438ee456bf4f6fde3cff1bd80a0356174756c46788911703f4ad7096c120029a`。

目录 `research/evil-wizard-2/EVil Wizard 2/Sprites/`。原生 250×250 画格，首张 Idle 的真实非透明内容 **57×95**（含法杖暗火），不是 250px 身体。Idle8、Run8、Attack1/2 各8、Take hit3、Death7、Jump/Fall 各2。纯侧视，左右镜像可用；紫黑金边很适合 `ss-mon-dusk-weaver`、`ss-mon-rift-caller` 或暗系施法者原型，但与明亮港口不是同一角色画风，须核对体态。不能据此声称所有首领已找到 192px 成品。

## 地表来源与具体裁切

### 已有 Tiny Swords Free Pack

继续沿用本项目已核对的 Pixel Frog 免费游戏使用许可；**当前 Free Pack 不是 CC0**，不能与旧 CC0 版混写。所有以下坐标均为原始 PNG 像素，原生格 64，可缩到本项目 32 native tile，不要先缩16再放大。

- `Terrain/Tileset/Tilemap_color1.png`：576×384。草地内块 `(64,64,64,64)`，或 `(384,64,64,64)`。
- 竖直石壁 `(384,256,64,64)`；续段 `(384,320,64,64)` 的底缘含草／透明。**竖直石壁绝不能再当平面地板。**
- color1..5 只是草色变化，并没有泥土或平面石地。
- `Water Background color.png`：64×64 纯色，不含波纹细节。
- `Water Foam.png`：3072×192，16 个 192×192 动画帧，每帧由3×3个64地块构成；可用于岸边泡沫，不适合作为满屏水面纹理。

对应索引与原生小样在 `research/tiny-swords-tileset-index.png`、`tiny-tiles-palette.png`、`water-foam-three.png`。

### Stealthix · RPG Nature Tileset - Seasons（CC0）

[官方作者页](https://stealthix.itch.io/rpg-nature-tileset) 明确手绘、CC0，作者进一步明确 32×32 RPG Maker XP 格式和改作再发布许可。已下载 upload `1834950` 的 `RPG Nature Tileset.png`，路径 `research/stealthix-nature.png`，641×288，SHA256 `d20d775908895bf27f0aadec21a71cd78f9b31e610dfe1bb77574721dab69543`。

| 用途 | 原生32裁切 | 备注 |
|---|---|---|
| 草地 | `(32,128,32,32)` | 低细节草丛，适合安静的自然地表 |
| 棕土／砂砾 | `(64,64,32,32)` | 自然颗粒状土石纹理 |
| 灰石 | `(96,64,32,32)` | 灰长石块；港口地板更适合下一个石板来源 |
| 水 | `(32,64,32,32)` | 纯蓝色，不伪称有原生动态波纹 |

`(96,128)` 是草土过渡，**不是纯土**。单块已保存 `stealthix-{grass,dirt,stone,water}.png`，预览 `stealthix-base-tiles.png`。

### LetargicDev / homyakokryak · Stone floor tiles（CC0）

[作者原页](https://opengameart.org/content/stone-floor-tiles) 明确单作者 CC0。文件 `research/stone-floor-tiles.png`，128×128（4×4个32原生格），SHA256 `f879ca51bbcfcea488cfe0c6365b9d5f3532eb02fcd1380d2e9b02a22e5b2f3c`。原页署名偏好 `homyakokryak`。

平面旧石板：`(0,0)`／`(32,0)`／`(64,0)`／`(96,0)` 各取32；碎石 `(64,32)`；四块小砖 `(64,96)`。暗缝较重，港口应按暖白／土色组降低对比；副本可保留暗色。它是真正地板纹理，不是墙面。可替换 `ss-scene-ground-port`、`ss-scene-road` 及 `terrain:*:cobble` 的源纹理，原道路／海岸掩膜继续保留。

### 已检查但不优先使用

- LordNeo `32x32 floor tiles`（[原页](https://opengameart.org/node/168272) CC0），已下载 `lordneo-floor.zip`，SHA256 `cdfc72dffa946fa5f73e1b141a998b5d0a44b34c7293ae4f807e7af8ac758e0b`。独立32草、土、沙、石与224×224过渡齐全；实际泥裂／照片纹理感偏强，不因“原生32”就判断适合本项目。
- DCSS/Crawl：作者／官方说明中仍有 unknown-license 清单，不可只信聚合页面“整包CC0”就采用现代 master 全库。本次未批准其任何图片。
- Foozle Pixel Magic Effects：作者页许可确实 CC0，但原生只有32×32，不能拿它撑成128大特效。
- Pimen Holy Effect 免费下载只有01–02；03–12需付费，不能把页面展示的64×80效果算入免费候选。其他包有“不得再分发 sprites”的自定义条款，不混写为CC0。

## UI 语义候选已实现

审核发现：`ui-icon:compass` 映射钟表、`hud-icon:bag` 映射箱子；HEX中大量机制与六大类被循环替成11张泛用魔法图。`hud-icon:build` 本来就是构筑书，其书本映射正确，不改成施工锤。

新工具 `tools/pixel/fine-ui-semantic.mjs` 直接保留项目原 HEX SVG 几何语义，在32与16原生格分别绘制、限定奶白／浅金／深色轮廓并清除AA残留；指南针使用红北蓝南针，背包保留提带和扣带。不是把32图缩成16，也不是放大16。六大类仍分别为剑、盾、控制准星、疾行箭、资源晶体、联动双环。HEX采用中性底，物品品质继续由外层槽位承担。

共69 glyph ×2档＝**138候选**；全部逐项 `checkAsset` 通过，32/16均无完全相同的重复图。输出：

- `.runtime/pixel-coherence/ui-icons/candidates.json`
- `keys.json`：138个键
- `replaced-cc0-keys.json`：138个需要从旧 `pixel-open-art.mapping` 移出的键，避免把本项目自制几何谎标成CC0来源
- `contact-large.png`／`glyph-order.json`／`duplicates.json`

保留成熟且语义合适的7Soul原生32/16物品图标；没有为了数量重画所有1469项。复杂机制在16档是轮廓／类别提示，完整机制细节以32档与文字为主，未把“哈希不同”当作可读性验收。

新增测试 `tests/fine-ui-semantic.test.ts`，由主代理统一执行。本 agent 未跑 tsc／全量vitest／大型检查、未改 live manifest／主色板／共享渲染代码、未提交。UI框生成器与粉底改暖白由主代理另行处理。
