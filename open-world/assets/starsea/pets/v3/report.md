# PA4：162只数据驱动宠物资源交付

2026-10-18。唯一依据：docs/pets/pet-rollout-v2.md、docs/pets/pet-skin-tiers.md。PA3已完成后顺序执行PA4；没有在中途停等确认。状态：资源制作、自检和预览完成，未接入游戏玩法。

## 结果与计数

- PA3：六岛18套、2,290帧，30fps，源/运行资源在v2；报告见 ../v2/report.md。v2在PA4期间只读，344个源文件哈希保持一致。
- PA4：6岛 × 3职业 × 3氪度 × 3流派＝**162只**，每只3形态＝**486个逻辑形态**。
- 实际只保存 **18家族 × 3形态＝54套底图与材质分区**；每套共享给9只，不存在162只逐只完整帧图集。
- 54套交付底图共 **5702个逻辑帧**、270段完整原生动作，交付24fps；原始30fps采样共7158帧，原骨骼与动作时长未改。
- 9种徽记 + 3种职业挂件，各小/中/大三档，共36张独立透明PNG；9个原库常驻特效引用，共329个原生特效帧，特效30fps。
- 162套独立色板、162条skins.json，全部组合可运行。新旧零件来源与2倍PNG检查覆盖 **575张被采用的分件**（含PA3收编），原始路径、sha256、手工SVG和成品sha256在manifest和sources/*-parts.json。

## 最终家族与阶段

|岛|氪度|暂名|家族|幼年/成年/觉醒|
|---|---|---|---|---|
|风栖|零氪|风绒|D1|a/c/d|
|风栖|轻氪|风芽鹿|A3|a/c/e|
|风栖|重氪|岚羽|C8|a/c/e|
|雾铃|零氪|苔芽|D3|a/c/d|
|雾铃|轻氪|铃沼|D6|a/c/e|
|雾铃|重氪|竹团|D5|a/d/e|
|赤炉|零氪|炉鬃|C6|a/c/e|
|赤炉|轻氪|铜砾|A1|a/c/e|
|赤炉|重氪|炉芯|C4|a/c/e|
|霜镜|零氪|霜团|B5|a/c/e|
|霜镜|轻氪|霜壳|B4|a/c/e|
|霜镜|重氪|镜鳍|S9|a/c/e|
|龙眠|零氪|眠角|D2|a/c/e|
|龙眠|轻氪|晓翼|A10|a/c/e|
|龙眠|重氪|岚鳞|A7|a/c/e|
|沉星|零氪|星漪|B1|a/c/e|
|沉星|轻氪|星尾|C5|a/c/e|
|沉星|重氪|灯绫|B7|a/c/e|

唯一家族替换：A11原五阶的独立零件数为13/12/11/10/10，持续合并部件且保留树人站姿，不适合本批同一宠物逐阶增件要求。按§8改为后备D5熊猫 a/d/e（11/13/15件），贴合雾铃林地。竹件作为竹芽装饰，没有画成武器。D6蝌蚪到蛙属于同种发育；其余推荐家族均保留。A11被否决的原始检查留本地evidence，不进入运行包。

## 流派、职业和氪度

元素标签采用现有 packages/content/skill-tags.ts 的 physical/fire/cold/lightning/arcane/shadow/poison，物理与六元素并列。流派名称为美术暂名，不新增技能、数值或强度规则。

|职业|流派|现有元素标签|徽记图形|流派主色|
|---|---|---|---|---|
|剑|锋刃 (blade)|physical|crossed blades|#748eaa|
|剑|余烬 (ember)|fire|flame|#e68655|
|剑|霜卫 (glacier)|cold|shield snow|#74bfd0|
|法杖|雷鸣 (storm)|lightning|zigzag lightning|#ddc65d|
|法杖|奥星 (arcanum)|arcane|six-point star|#a58ed7|
|法杖|暮月 (shade)|shadow|crescent|#71658c|
|暗器|青毒 (venom)|poison|leaf drop|#8dbc65|
|暗器|回锋 (ricochet)|physical|three returning edges|#b58c68|
|暗器|冰针 (frostneedle)|cold|needle crystal|#7799d3|

职业挂件：剑＝围巾/肩片，法杖＝浮空晶石，暗器＝尾饰。零氪使用小徽记；轻氪中徽记+小职业挂件；重氪大徽记+大职业挂件+常驻特效。PNG源尺寸最终为24/36/48px，实际显示尺寸、锚点、偏移、层级在每条skin中独立声明。

岛底色继承PA3。流派主色与岛底色按零/轻/重0.44/0.52/0.60混合，暗部另按0.40/0.46/0.52混合，点缀直接用流派主色。描边与点眼固定#3c2b23，高光固定#ffffff，腮红固定#e8b7a4。没有给Spine槽位增加乘色；换皮发生在分区解码阶段。色板两两检查中，同岛同档九只的主体RGB最小距离为16.062，九枚徽记各不相同；同一流派的徽记跨六岛复用。

## 原生常驻特效

全部来自用户指定的Q版日式手游SPINE特效300套，原JSON/atlas/PNG绝对路径和hash登记在effects.json与manifest.effects。原库为2.1.27，复用项目既有spine21-convert.js字段适配器在内存中兼容3.6，保留变换、顶点、权重和关键帧时间；原文件没有修改，没有新画特效。

|流派|原始目录/JSON|版本|帧数|运行时调色|
|---|---|---|---|---|
|锋刃|115-eff1001baqi/eff1001baqi.json|2.1.27|31|#748eaa|
|余烬|182-eff51dianran/skeleton.json|2.1.27|23|#e68655|
|霜卫|188-eff57binghuan/skeleton.json|2.1.27|37|#74bfd0|
|雷鸣|160-eff38shandianfd/skeleton.json|2.1.27|65|#ddc65d|
|奥星|220-eff70mofazhen/skeleton.json|2.1.27|38|#a58ed7|
|暮月|189-eff58fengyincx/skeleton.json|2.1.27|27|#71658c|
|青毒|208-eff66juducx/skeleton.json|2.1.27|34|#8dbc65|
|回锋|121-eff14minizengyi/skeleton.json|2.1.27|37|#b58c68|
|冰针|258-eff93-bingdonglong/skeleton.json|2.1.27|37|#7799d3|

特效按原动作时长循环，source-in调色保持原alpha与运动；循环内原有淡入淡出也保留。最终64px单格；重氪外层透明度0.60、名义尺寸62px再按成长/动作比例换算。静态证据的宠物取idle首帧，常驻特效取其原生峰值帧，避免第一帧透明导致误判缺失。预览中则按独立帧序列持续播放。

## 分区图解码契约（供后续接入）

每个base目录包含 actor.webp、actor.json、regions.webp、materials.bin、sockets.json、profile.json。

actor.webp 是原生帧的基准直接渲染图集，用于对照。**运行换皮只需要 regions.webp + materials.bin + skin.palette**，无需读取或逐皮肤复制基准底图。逻辑帧仍为256×256，透明裁边与共享帧矩形在actor.json中。

regions.webp 为无损、完全不透明的RGB数据图：**R/G为16位小端索引，B为覆盖alpha，A恒255**。不能将B当颜色，不能把RGBA的A当覆盖率。这样浏览器读图时不会因预乘透明度破坏索引。

每个materials.bin码本条目6字节：[m0,m1,t,dr,dg,db]。材质号：0底色、1暗部、2点缀、3点缀暗部、4肚皮/奶白星点、5描边与点眼、6白高光、7腮红。描边和点眼按规范共用固定深棕材质。

解码伪代码（逐通道在sRGB **字节空间**运算）：

`index = R + 256 * G; alpha = B`

`rgb = clamp(round(palette[m0] + (palette[m1]-palette[m0]) * t / 255) + [dr,dg,db] - 128, 0, 255)`

若m0=255，则条目最后三个字节直接是固定RGB（包括透明背景零项）。三稿式平涂内部是单一材质，抗锯齿/重叠边缘由两材质混合及有符号校正保存。码本是共享分区元数据，不是162套烘焙图片。

**不能对索引图做线性采样、调色或sRGB纹理解码。** 参考实现先解码当前裁边帧为RGBA，再由Canvas正常缩放。GPU实现应对索引使用NEAREST/非sRGB格式；要做平滑缩放，应分别解码相邻样本，再对解码后的预乘RGBA插值，不能插值索引。

54套基准色板都与直接渲染底图逐像素比对：覆盖alpha与可见RGB差异为0。完全透明像素的隐藏RGB统一按0理解；WebP可能重写这些不可见RGB，不影响任何合成像素。任意新色板按同一码本权重和校正值展开，参考代码是 preview/composer.js 的 expand/frame。

## 帧、挂点和叠加规则

1. skin.forms[young/adult/awakened].base选择共享base；从该base动作的duration和fps选择帧。预览循环重播五动作，游戏接入应尊重actions.loop，非循环动作结束后按游戏表现状态切回。
2. actor.json.frame 给出打包矩形；spriteSourceSize是原256格内的裁边偏移。绘制位置为 `(spriteSourceSize - anchor*256) * profile.scale`。多个逻辑帧可能共享同一像素矩形，不能因此丢掉各自的时序、裁边偏移或挂点。
3. sockets.actions[action][frame]与逻辑帧一一对应。挂点像素先减anchor*256，再乘profile.scale。ground固定深度；body/head/emit/accessory来自原生骨骼矩阵。
4. 附件偏移和尺寸乘 `growth = displayHeight/44 * action.bakedPresentationScale`。徽记、围巾、尾饰再继承该帧socket.transforms里的Canvas2D [a,b,c,d]，它等于 `J * currentBone * inverse(idleBone) * J`，J为y轴反向；这样挤压、旋转、击飞时仍贴住挂点。晶石和常驻特效是朝向屏幕的悬浮层，只跟随点的位置，不继承骨骼转角。
5. 默认层级：常驻特效-10、尾饰-5、主体0、围巾20、晶石25、徽记30。徽记放在身体下部避开脸；B4寄居蟹眼位较低，徽记单独上移到壳体（offset=[0,-3]）。层级和偏移来自skin数据，后续可调，不改骨骼。
6. 镜像一次性作用于包含主体、附件、特效的公共父坐标：x取反，y不变；同时翻转贴图和偏移。不要既用mirrored点又把父层镜像两次。外置层不能被主体裁边矩形裁掉，合成包围盒应包含附件/特效。
7. 常驻特效建议使用独立持续时钟，避免每次换动作都重新起播。原生特效是30fps；主体为24fps，两者独立取帧。

## 体量与采样裁定

原始未优化v3约89MB。先做共享矩形去重、无损WebP和JSON精简，并按§8将特效96→64px、挂件32/48/64→24/36/48px；仍约55.5MB。之后才将主体降至24fps，保留所有162只和每只三形态。

24fps样本从30fps原生采样中选最近帧，动作duration不变，原始JSON关键帧完全不改；sourceFrameIndices/sourceSampleTimes明确记录取样，最大采样量化约16.7ms。这是允许的帧率降档，不是新造动作或只保留两姿态。PA3的30fps产物没有修改。

最终PA4运行目录：**47,536,647字节 = 47.537MB**，严格小于50,000,000字节。口径是public/art/starsea/pets/v3全目录，包含54套底图/分区/码本/挂点、36挂件、9特效、162配置和预览代码；不计只读旧批次、原始库和既有共用地表/字体。

|类别|字节|
|---|---:|
|base|21,140,896|
|regions|19,060,652|
|codebook|1,832,772|
|frames|955,817|
|sockets|2,679,649|
|profiles|345,476|
|other|1,521,385|

完整体量清单在evidence/delivery-inventory.json。原始30fps、未打包PNG、截图和测量仅在本地evidence，已gitignore，不进入运行包。

## 验收与证据

- 162只×3形态×5动作＝**2430组合**，每组合3个时刻、正反朝向，共14,580次真实Canvas合成检查；没有空白合成、缺材质索引、缺挂点或镜像偏移误差。
- 可视Chrome同时播放162只，3形态×5动作15组实时检查均通过，每只实际换帧；不以静态截图冒充动画。
- 54套分区逐像素还原通过；575张采用分件均2倍尺寸、源/新sha256通过；54份源JSON逐字节一致。
- 每岛27只、每岛每档9只，两两色板+徽记区分；同流派跨岛共用徽记。五官重画为点眼、小嘴，源牙/怒眉/竖瞳/骷髅RGB不保留。原网格约束下个别外轮廓仍有棱角，未擅改骨骼。
- 预览可按岛、职业、氪度、流派筛选，三形态、五动作、暂停、镜像、挂点显示可用。过滤结果162/27/9/3/1均检查。
- evidence/wind-27.png、mist-27.png、forge-27.png、frost-27.png、dragon-27.png、star-27.png：幼年idle首帧，实际44px与2倍同图；evidence/all-162.png：全部162套。三形态全量由动态预览与上述2430组合覆盖。
- 最终验证：final-validation.json、composite-validation.json、live-validation.json、browser-validation.json，均在本地evidence。

已知限制：这是模型/外观资源，没有跟随AI、连携、共鸣、数值、定价或游戏源码接入。24fps与原生30fps相比略少采样；严格限高仍使用整段相机比例，动作切换可能有体量变化。常驻特效保留原片段淡入淡出，循环不是每一帧都等亮。WebP解码、码本、逐帧变换和层级须按本报告接入；只读actor.webp不能实现162套换皮。

## 复现

所有脚本位于assets/starsea/pets/v3。顺序：compat.mjs（新家族）→ face-map.mjs → paint.mjs（每岛轻氪后重氪）→ export.mjs（新家族30fps）→ import-pa3.mjs → partition.mjs → accessories.mjs → effects.mjs → skins.mjs → pack-runtime.mjs → resample-runtime.mjs → socket-transforms.mjs → preview-check.mjs → live-check.mjs → verify-final.mjs → finalize.mjs。导出/渲染/预览始终串行、headless:false、硬件D3D11。

启动最终预览：`node assets/starsea/pets/v3/serve-preview.mjs`。只有v2/v3两个批次各自的源码和public目录被写入；PA1/PA2、库/特效库、公共manifest、游戏源码、版本与数据库未改，不触及8612/8790，不重启现有服务，未git commit。没有剩余硬阻塞。
