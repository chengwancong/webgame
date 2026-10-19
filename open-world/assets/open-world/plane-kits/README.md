# 箱庭位面美术包

当前铺量依据 `docs/plane-art-handoff-20261018.md` 第9节。旧总包和本轮验收分开统计；本轮进度见 `docs/reviews/plane-art-20261018/rollout-progress.md`。

## 本轮交付数量

| 批次 | 正式ID | 状态图 | 新原图 | 复用原图 |
|---|---:|---:|---:|---:|
| R1 套件底图 | 18 | 18 | 18 | 0 |
| R2 特色件 | 36 | 36 | 0 | 36 |
| R3 岛屿地面/远景 | 30 | 30 | 30 | 0 |
| R4 入口/底座 | 19 | 38 | 38 | 0 |
| R5 材质复核 | 18组合 | — | 0 | 0 |
| R6 岛屿墙/顶/路 | 45 | 45 | 45 | 0 |
| 合计（不含复核组合） | 148 | 167 | 131 | 36 |

另有6条既有底座材质引用随基础图更新，不算新图。此前19件保持原图，只同步最新契约。当前随机场地163项均解析到正式像素（148直接、15风栖别名；直接项包含此前19件，不包含R4入口）；剩余174个旧可选/未用ID见art-gaps，未宣称旧总包完全完成。

## 唯一几何来源

现役套件和岛屿件从 `packages/asset-manifest/open-world-planes-greybox.v1.json` 的 contract 实时读取画布、anchor、displayWidth；不在脚本另抄墙高。maze 墙面128×104，柱128×160保持不变。R4入口采用交接明确的256×256 / [.5,.88] / 192，传送底座192×128 / [.5,.6] / 160。

正式登记在 `packages/asset-manifest/open-world-planes.v1.json`。现役取图代码由Claude维护：只使用 imported 且 registration 为 greybox-contract-exact 的同ID资源。风栖使用套件件；未画岛屿别名回退套件图并叠原 material；新岛屿原图不再重复叠色。入口状态资源交给后续L5接入，不在本轮改玩法或客户端状态逻辑。

R4的 `runtime.file` 是初始态；消费方需按 `runtime.stateFiles` / `stateFrames` 选择另一态，不能把初始文件用于全部状态。

## 本地原图与提示词

- 已交付19件：`source/props-contract/`，规格 `props-contract-spec.mjs`。
- R1/R3/R4/R6新原图：`source/rollout/`；逐ID JSON保存提示词、源图哈希、状态和导入变换。
- R2特色件：复用 `source/ow-art-plane-<island>-<kit>-feature-<1|2>.png`，并在 rollout JSON记录复用与新小画布变换。
- 生产队列：`rollout-queue.json`；唯一生产规格：`rollout-spec.mjs`。
- PNG原图、实机截图、发布目录、生产日志只留本地；Git只保存可复核的文本规格与登记。

## 构建与校验

在 open-world 根目录运行：

```text
node tools/build-plane-prop-art.mjs
node tools/build-plane-rollout-art.mjs --batch=R1
node tools/verify-plane-rollout-batch.mjs R1
node tools/preview-plane-rollout.mjs R2
```

批次参数支持 R1/R2/R3/R4/R6；完整本轮导入为 `node tools/build-plane-rollout-art.mjs`，完整本轮校验为 `node tools/verify-plane-rollout-art.mjs`。首次工作区缺少PNG时，构建会报缺源图，不能伪造通过；先恢复本地原图或按逐项提示词重出。

通用旧包入口 `node tools/build-plane-kit-art.mjs --allow-pending` 在末尾应用19件及铺量专用导入，保证重建不退回528画布。旧包仍有范围外占位，不能将 allow-pending 的契约通过描述为全包美术完成。

导入技术：R2轮廓宽≤64px、高≤80px；R4多态共用原画布、联合裁切矩形与缩放，并校验轮廓IoU。石板从生成的石面内部低方差区域采样，按64×36精确投影；cave地面/墙顶做镜像平铺。所有变换不修改原图，参数与哈希可追踪。

批次校验严格串行：本批构建、专项校验、已导入项回归、原19件、旧总包契约、运行时解析、scene测试、layout测试、世界资源接线。可视复核固定同一随机seed比较3套×6岛，截图和console记录仅在本地评审目录。
