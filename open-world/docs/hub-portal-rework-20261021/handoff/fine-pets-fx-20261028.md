# 细腻像素宠物与特效交接（2026-10-28）

本文件仅记录 pets/FX 子任务的候选交接。未改 live manifest、共享渲染器、玩法参数，未提交 Git；最终整体验证、接入、提交和部署由主代理统一串行执行。技术覆盖不等于用户视觉认可。

## 产物

| 范围 | 候选条目 | 说明 |
| --- | ---: | --- |
| SP33 宠物 | 54 | 18 家族 × 3 形态；新源稿恢复网格、64 色量化、二值 alpha 和独立像素轮廓清理 |
| 宠物头像 | 54 | 从 idle 第一帧的可见范围裁切为独立小图，避免每个 UI 卡片加载整个动作大图集 |
| 原 PX6 特效 | 95 | 保留原 frame 名、clip 时钟、峰值和事件接入 |
| 补充分组特效 | 6 | blizzard、danger-circle、ritual、ultimate-charge、hero-native-fx、tip-glow；这些旧条目归在 PX8，不能只按 PX6 统计 |

FX 共 101 条、2532 个物理画格、2599 个可寻址 frame 名（67 个为兼容别名），最大 atlas 单边 4096。宠物使用 160×160 画格、scale=1，但实际身高继续按原各形态的 44/56/68、48/62/74、54/70/84 舞台像素，未统一放大为 96。bodyHeight 与 displayHeight 一致，脚底 anchor=[80,148]。

候选清单与键名：

- `.runtime/pixel-coherence/pets-fx/pets-candidates.json`、`pet-keys.json`
- `.runtime/pixel-coherence/pets-fx/fx-candidates.json`、`fx-keys.json`
- `.runtime/pixel-coherence/pets-fx/pets-source-map.json`、`fx-source-map.json`
- PNG 全部位于 `.runtime/pixel-redraw/candidates/art-pixel/`；不提交 PNG、原始生成稿、ZIP 或 contact。

## 宠物设计与动作

保留原家族辨识：青眼苔石怪、蓝冰刃人、白金羽翼龙、黑红蜘蛛、绿苔巨人、九头蛇、红小恶魔、红胖恶魔、熔岩龙、浅紫幼龙、蓝甲龟龙、青骨翼龙、紫幼龙、绿龙王、深渊九头龙、蓝兜帽幽灵、三头犬、黑紫龙。

原九头蛇草稿的头数不合格，已换成可数的三组三头、共九头；最终绿蛇与蓝蛇均复核了九头轮廓。绿苔和绿龙的源色先校正为 leaf ramp，避免公共量化将绿色误归为青蓝。

五个源动作 idle/idle2/move/attack/knock 的 duration、loop 和原帧名均保留；从原 SP33 sockets 导出的 body/head 矩阵做新拆件姿态，挂点仍为 feet/chest/hand/weapon/muzzle。腿与翼有额外步态和摆动。限制：这是 body/head 拆件重定向及次级运动，没有复刻原始完整腿翼骨架网格；三形态沿用原 v3 共用家族造型的逻辑，主要改变实际体型和原生细节密度，并非 54 种独立物种造型。不能把这两点描述成已完成全骨架逐部位重制。

`apps/web/src/hub/pet-portrait.ts` 增加可见范围裁切及紧凑头像入口，头像盒原尺寸不变；fit<1 使用最近邻缩小，fit>1 仅取整数倍。关闭像素模式仍使用原图集。

## FX 接入契约

所有候选带 `preserveDisplaySize:true`、`preserveTint:true`，需由主代理共享渲染接缝实现。实际视觉攻击范围必须来自原 presenter 最新 displayWidth/displayHeight；不能按新源图大小替代。原 tint/alpha/rotation/显示范围仍由原机制驱动。scale=1 表示新源像素，不表示放大伤害或预警范围。

大型地面 crater/crack/ring、void-zone、rain/wave/flood/rockfall 和章节仪式/预警/暴雪使用 256 原生画格；beam 为 384×128，先把 Duelyst 的竖向源旋转后再适配横向射线，避免把竖光柱硬压成横贴图。小粒子和箭弹使用 64/128。图集紧凑排布不超过 4096。

原本显式播放 clip.frames 的资源保持原帧列表与峰值时间。原本作为静态 __BASE 贴图的资源选专业动画的可读峰值为 defaultFrame，避免只看到 fade-in 的微小首帧；新增画格数量不代表所有静态 presenter 会自动播放。持续范围 ring/zone 在首帧即显示完整轮廓，不随一次性爆炸的末帧消散。

土系坑、裂纹、碎石、尘土、石环和灼痕使用专门源稿；未把 Duelyst `bouldersphere` 纵向轨迹误称为陨坑，也未把青色 `earthsphere` 魔法球误称裂地。雨是多枚小火焰分布，波浪由多层原生冰浪组成。预警仍是明确的边界圆环，避免装饰改变机制语义。

## 来源与生成简报

专业 FX 来源为 Counterplay Games 官方 `open-duelyst/duelyst`，CC0-1.0，固定 commit `2843f2400854136598631288c2e8dfb8f5173de7`。许可核验见同目录 `fine-pixel-resource-research-20261028.md`，逐文件 git SHA/SHA256 见 `.runtime/pixel-coherence/research/duelyst-source-index.json`。归档 SHA256：`fa8f394053f744f1a1c6150e77dbadc0be8467d1b21154089e193892c083853c`。候选 provenance 保存实际使用的文件、作者、许可、固定 URL、sourceSha256 和修改说明。

源动画先按 plist sourceColorRect/sourceSize 还原，不放大专业像素源；再按元素明暗 ramp 映射至公共 64 色并清除软 alpha，按原游戏时钟重排。部分源是运行时着色的灰白 mask，按火/冰/雷/暗/治疗元素赋色，而非照搬灰白外观。

新宠物和六项物理地面源稿由内置 image_gen 生成，不能标为开源或 CC0。可复现的设计简报如下：透明背景、独立部件不相交、左上光源、细腻可读像素簇、无文字/水印/柔焦；六格布局依次为上述家族 A（前六）、B（中六）、C（后六）；角色右朝向、保留各家族关键器官。物理六格为正面俯视的 crater/crack/dust/rock/ring/scorch，禁止画成魔法球。九头蛇额外编辑简报要求每条蛇明确出现九条脖颈与九个独立头，按 3+3+3 排列，分别绿金与蓝金，保留透明背景。

生成稿只作草稿，`fine-pets-source.py` 使用本机 proper-pixel-art 恢复网格，随后 `fine-pets-pixels.mjs` 做公共色板、硬 alpha、孤立像素和轮廓清理，最终按原实际显示身高降采样；没有取旧 PX7 PNG 上采样。源稿、裁切坐标和网格参数留在该脚本以及 `.runtime/pixel-coherence/pets-fx/source-grids.json`。原始源文件路径明确写在脚本中，选中的九头修正稿为 `exec-ea5e6e54-eae9-42a8-a14a-7fa7c7a8cb54.png`；早先头数不足稿未接入。

## 复现与验证

从项目根目录按顺序执行（Python 需 Pillow 和 proper-pixel-art；脚本内已设置本机模块路径）：

```powershell
python tools/pixel/fine-pets-source.py
node tools/pixel/fine-pets-build.mjs
python tools/pixel/fine-fx-source.py
node tools/pixel/fine-fx-build.mjs
```

子任务已执行头像 helper 单测 2 项通过；抽样 `checkAsset` 包括宠物、九头蛇/头像、大型陨坑/冰命中/共享 skill-source/beam/fire-rain、6 项补充分组 FX，均为零问题。最新 6 补充项及九头宠物/头像共 8 项再次校验，零问题。未自行跑 tsc、全套 Vitest 或大范围全量校验，避免与主代理重任务并发。新增集成断言 `fine-pets-assets.test.ts`、`fine-fx-assets.test.ts` 应在合入候选后由主代理运行；现存 `pixel-pet-assets.test.ts` 的旧 frame64/scale2 断言需要一并更新。

离线 contact 位于 `.runtime/pixel-coherence/pets-fx/{pet-contact,pet-motion-contact,fx-contact}.png`。已复核新九头轮廓、绿色量化、大型 FX、横向 beam 和章节点阵符号，未运行浏览器或无头浏览器。

## 真机检查交给 Grok

1. 宠物图鉴、战斗跟随及三形态切换：18 家族可辨、九头与三头可数、体型维持原版、头像不撑大盒子。
2. idle/idle2/move/attack/knock：脚底不飘、拼接处不裂、头与嘴不脱节；特别看龙翼、蜘蛛步态、九头重叠与三头犬。
3. 火雨、冰浪、暗域、陨坑、裂地、落石：与原伤害范围、预警边界和持续时间一致，不能因为新帧256而放大范围。
4. 横向 beam、箭弹和近战斩击：方向、释放点、旋转、峰值命中时间正确；静态贴图不只显示不可读的淡入点。
5. 章节暴雪/仪式/蓄力与 hero-native-fx：符号含义、元素着色及当前 tint 保留，持续范围首帧可见。
6. 连续切换像素模式开关并重复释放各类技能：恢复原纹理/原帧/最新显示范围与 tint，没有资源池复用造成的突然大小变化。技术校验通过后仍需按实际视觉列出不达标对象。
