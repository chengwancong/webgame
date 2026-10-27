# 柴犬冒险者 · 复用现有主角 Spine 骨架的试作

预览：<http://127.0.0.1:8612/shiba-spine-sample.html>。此页独立于游戏，未替换正式主角。支持实时骨骼／烘焙精灵表、暂停、减速、左右镜像与骨架查看。

角色为本次原创设计：柴犬黄白脸、三角耳、卷尾、蓝色冒险服与短剑。原生 64×64 画格，角色高 48px，共用项目 60 色色板；烘焙结果实际使用 32 色。生成草稿使用内置 image_gen；先通过本机 proper-pixel-art 找回网格，再量化、修眼部像素与关节遮盖并拆件。提示词见同目录 `generation-prompt.md`。草稿不作为实机成品。

## 骨架与动作

- 按用户最新要求，复用 `assets/mini-hero/navy/runtime/Character.json` 的 **41 根骨骼**、2 个腿部 IK、3 个变换约束（包括原 RIGHTHAND 约束）及原物理约束定义。未改写原骨骼 setup pose。
- 直接使用原 `Wait1`、`Run1`、`Attack_OneHand1` 动作轨道，不重新编造一套人形动作。时长为 2s／0.6s／1s；释放时间沿用原 profile 的 0.35s。
- 柴犬皮肤共 13 个图片拆件，使用原骨架的相应关节进行逆绑定校准，保留参考待机时的造型。附加一根尾骨、五个命名挂点和眨眼换附件，不改原动作轨道。
- 使用当前已安装的官方 Spine 4.2.120 运行库解析并计算世界顶点。实时预览和离线烘焙使用同一实现；在原生像素中心采样，避免浏览器旋转图片带来的半透明边。
- 烘焙 36 帧：待机 16、跑动 8、挥剑 12；命中边界精确保留在 0.35s。精灵表不注册到游戏正式 manifest。

## 文件

本目录的 `shiba.json`、`shiba.atlas`、`images/*.png` 可作为 Spine 4.2 导入数据；`shiba.png` 为打包图集，`shiba-sprites.png` 为像素精灵表。公开样片副本在 `apps/web/public/art-pixel/shiba-spine-sample/`。PNG 不进 Git。

本机打包文件：`.runtime/shiba-spine/shiba-spine-sample.zip`。动画 GIF：`.runtime/shiba-spine/shiba-motion.gif`。包中不含原有主角贴图、账号数据或游戏凭据。

没有找到可直接调用的 Spine 编辑器，因此没有生成或验收 `.spine` 编辑器工程。交付的是可导入 JSON、图集和可播放样片；官方运行库解析通过不等于编辑器打开验收通过。不要把角色造型或此样片标记为已获用户视觉认可。

## 重建

1. 使用 proper-pixel-art Python API 处理 `.runtime/shiba-spine/concept.png`，保存 `grid.png`。工具位于 `G:/webgame/aw-third-party/pixel-tools/proper-pixel-art/repo`，venv 位于同级 `.venv`。
2. `node tools/pixel/shiba-source.mjs`。
3. `node tools/pixel/shiba-rig.mjs`：生成拆件及中性姿态校准数据。
4. `node --import tsx tools/pixel/shiba-reuse-hero.mjs`：按现有主角骨架逆绑定，替换上一步中间骨架。
5. `node --import tsx tools/pixel/shiba-bake.mjs`。
6. `node tools/pixel/check-pixel-art.mjs --manifest apps/web/public/art-pixel/shiba-spine-sample/sample-manifest.json`。

验证：样片像素校验 0 issues；`tsc --noEmit` 与独立 Vite 生产打包通过；样片、像素生产校验、主角外观和换装渲染共 4 文件／33 项单测通过（`--maxWorkers=1 --no-file-parallelism`）。针对旧骨架/约束/原动作轨道逐项不变、腿部 IK 相位、手与武器、镜像和眨眼的检查均通过。没有运行浏览器自动化；只打开本机可见样片页，未宣称浏览器视觉验收通过。真实视觉质量由可播放样片验收。
