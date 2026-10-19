# 位面美术铺量 R1–R6

依据交接 §9；第 9 节覆盖旧尺寸、旧禁用浏览器及旧标杆等待。只用静态复核页，不登录、不调用写接口。基线 a193ac73，重任务串行。

| 批次 | 计划 | 当前状态 |
|---|---:|---|
| R1 套件底图 | 18 ID | 18 新图 imported；契约/构建通过 |
| R2 岛屿特色件 | 36 ID | 36 原图复用 imported；96×96 联系表逐件复核通过 |
| R3 岛屿地面/远景 | 30 ID | 30新图 imported；9.3 自动校验与18组合实机复核通过 |
| R4 野外入口/传送底座 | 19 ID / 38 状态图 | imported，38态共用画布/变换及IoU检查通过 |
| R5 材质 | 6 岛 × 3 套复核 | 18组合已看，无需修改material；0数值变更 |
| R6 岛屿墙顶/墙面/路面与未用件 | 优先45个岛屿纹理 | 45新图 imported；其余174个可选/未用ID明确列入art-gaps，不阻塞 |

R1/R2 验收：专项分别 18/18、36/36；现役19件同步最新 contract 后通过。各批依次运行 scene 6项、layout 4项、world-resource-wiring（passed:true），运行时按163项现读并覆盖18个岛屿套件组合。R1/R2 联合静态复核 URL 模板为 `http://127.0.0.1:8612/plane-review.html?stage=plane-wind-nest-<cave|crypt|maze>-1&island=<wind|mist|forge|frost|rift|dragon>&seed=412872777&calm=1`；18组合全部已看、无 console error。截图仅在 `rollout-screens/R1-R2-*`，原始记录 `rollout-browser.json`。

R3：30项新原图已看过；封闭地下、无天空/地平线。`node tools/verify-plane-rollout-batch.mjs R3` 八步依次通过；石面采样修复了非方形缩略图默认cover导致的位置偏差，改为fill与4%内部采样，防止描金边被误铺满地面。R3 18个URL使用上面的模板与seed，无console error，最终截图覆盖在 `rollout-screens/R3-*`。已落地图片不叠本岛材质。

R4：18个本岛入口均以 unsettled 编辑出 cleared；传送底座前两版带多余光雾，丢弃3张候选，第三版采用无外部光效石盘，open 只点亮盘内符文。最终38态全部目视通过，`verify-plane-rollout-batch R4` 九步通过，轮廓IoU≥0.75。六条既有底座材质引用同步新契约，未复制像素，单独计引用不计新图。R4入口由Claude在L5接入，此轮不冒称野外玩法已接好。

R4/R5联合静态复核：同上18URL与seed，截图 `rollout-screens/R4-R5-*`，无console error；入口联系表 `rollout-contact/R4-*` 已逐对查看。R5保持所有material原值：wind无叠色；mist #b8d4ca/.12；forge tint #e7b392、wash #ce9b78/.18；frost #d6e9f5/.38；rift tint #c8b6d5、wash #a99abb/.2；dragon #e6d5b2/.2。没有修改 `plane-scenes.json`，因此未调用灰盒重建。

R6：45图已生成、保存并逐组查看联系表；批量工具预览曾超过单次传输上限，实际45张本地文件全部存在，随后用本地联系表完成复核，没有将传输失败当成出图失败或跳过视觉检查。`verify-plane-rollout-batch R6` 九步通过。

## 最终交付（2026-10-19）

- 本轮148个稳定ID、167张状态图全部 imported：R1 18、R2 36、R3 30、R4 19（38态）、R6 45。新生成原图131张，复用特色原图36张；另同步6条既有底座材质引用，不计新原图。此前19件保留，不重复统计。
- 当前163项随机场地取图：148项直接使用正式图、15项风栖别名使用正式套件图、灰盒像素回退0项。这里的148直接项包含此前19件，不包含R4入口。R4入口仍由L5接入，不冒称已有野外交互/状态逻辑。
- `node tools/build-plane-kit-art.mjs --allow-pending` 通用重建通过；五批默认态发布文件重建前后完全一致。`node tools/verify-plane-rollout-art.mjs` 严格通过：148项、167态、pending=0。`verify-plane-kit-art --allow-pending` 契约0错误；旧总包仍有134项占位、168条占位/接缝校验缺口，不等同于本轮必做项缺口。
- `npx tsc --noEmit --pretty false` 本次完整通过（退出0），没有沿用上轮已知错误结论。各批scene测试6项、layout测试4项、资源接线passed:true；原19件、163项运行时和18岛屿套件组合均通过。详见rollout-R3/R4/R6-checks.json与rollout-summary.json。
- 最终可视复核：18个URL仍使用上方模板、seed=412872777，等待角色与地形稳定后保存到 `rollout-screens/R6-final-<kit>-<island>.png`，全部无console error。每套联系表顺序：wind/mist/forge；frost/rift/dragon。截图仅留本地。
- 未修改场地生成、渲染器、灰盒构建、运行时取图接线和 `plane-scenes.json`；R5材质数值变更0。R6剩余可选/未用项174个已逐ID列入art-gaps；旧A5特效6用途未包含在本轮绘制数内。
- 提交仅包含本轮规格、提示词/哈希/变换、登记、工具与小型报告；原图、截图、发布PNG、旧生产日志、其他会话文件不提交。

恢复/复核命令：`node tools/build-plane-rollout-art.mjs` → `node tools/verify-plane-rollout-art.mjs` → `npx tsx tools/verify-plane-prop-runtime.ts`。本轮R1–R6已执行完毕，无必做项待完成；后续可选项从art-gaps选取。
