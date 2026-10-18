# PA3 六岛基础宠物

2026-10-18。依据 docs/pets/pet-rollout-v2.md。18套完成，2290帧，五个完整原生动作，30fps / 256逻辑格。风绒收编PA2样稿2，其余按平涂规范重画。接下来继续PA4，不在此停工。

| 岛 | 名字 | 家族 | 阶段 | 兼容 |
| --- | --- | --- | --- | --- |
|风栖|风绒|D1|a/c/d|全部动作可视渲染通过|
|雾铃|苔芽|D3|a/c/d|全部动作可视渲染通过|
|赤炉|炉鬃|C6|a/c/e|全部动作可视渲染通过|
|霜镜|霜团|B5|a/c/e|全部动作可视渲染通过|
|龙眠|眠角|D2|a/c/e|全部动作可视渲染通过|
|沉星|星漪|B1|a/c/e|全部动作可视渲染通过|

没有换家族。3.5的C6/B5/D2/B1逐帧可视Chrome硬件渲染，原零件和动作关键姿态对照未发现缺件、IK翻转、网格撕裂或绘制顺序错误。没有3.5原版编辑器，使用需求允许的原零件/关键帧核对，不声称原版编辑器双播放器验证。

全部源JSON逐字节不变。新旧分件绝对来源、2倍PNG尺寸、手工SVG、sha256和色板登记在manifest及sources/*-parts.json。D1原稿沿用PA2来源，其他为手工原坐标重描，无imagegen原稿。描边/点眼 #3c2b23，颜色直接绘入PNG，不乘槽位颜色。熊的紧贴UV网格用内描边避免裁边，颈/肩保留原生大轮廓；猪鬃毛根部圆弧色块、末阶火焰平涂，C6e内置TX1保留并标记。龙下颌圆滑无牙，开合仍由原嘴部骨骼负责。星漪头部保留3颗奶白星点。

显示高度为44/56/68px的idle垂直包络，其他动作整段相机等比缩放烘入，均不超过各阶限高。动作切换存在比例变化；源动作、时序、位移未修改。五挂点每帧完整，镜像围绕anchor，帧在格内、源/新哈希与2倍尺寸通过。眼睛覆盖层按原生眼骨骼与主体UV对位，D3闭眼弧线收小避免露出覆盖层；D2原闭眼槽继续工作。没有牙、獠牙、怒眉或竖瞳的贴图细节；旧贴图RGB没有混入新画面。

证据：evidence/compatibility.json、validation.json、browser-validation.json；overview.png为正式风栖草地+土路、主角/两怪/18形态实际大小和4倍同排；wind/mist/forge/frost/dragon/star-growth.png为每只三阶×idle/move/attack首帧4倍。可视预览在public/art/starsea/pets/v2/preview/，五动作/暂停/镜像通过。

已知限制：没有游戏接入或玩法；严格继承原生关节比例和网格轮廓，部分部位仍保留原轮廓棱角。成长规格以垂直包络而非每一帧固定身高定义。所有原始图和渲染只在本地evidence；代码与资源仅写v2，未改PA1/PA2、公共manifest、源码、版本、数据库，未触及8612/8790、未重启服务、未commit。

复现依次：compat.mjs → face-map.mjs → paint.mjs 各key → export.mjs → verify.mjs → sheets.mjs → preview-check.mjs → finalize.mjs。均位于assets/starsea/pets/v2，重任务串行。
