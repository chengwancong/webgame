# 正式内联SVG像素接入（2026-10-28）

开始前，7个任务目标TS的git diff均为空。只新增静态SVG的data-pixel-icon标记、纯数据名称导出与独立候选，不改原绘制几何、事件、文字或玩法。另最终可达扫描补了通用面板和航图详情两处关闭X，复用已有ui-icon:multiply，不加新资产或依赖。

36个基符号、63张独立PNG。候选与键表：`.runtime/pixel-coherence/inline-svg/{candidates,keys,source-index}.json`。100px罗盘与120px结果旗由原SVG几何直接在100/120目标格栅格化，不是32px成品放大。状态图48px匹配原UI槽；其余64/32/24/20/16，部分有16独立档。所有图限定项目64色、二值透明并清理孤立点；不调用图生图，不下载字体。

现有glyph开关机制替换SVG内部图形，关闭后原body/viewBox/style完整恢复。没有更改共享pixel-images、色板或live manifest。主代理另完善了矩形frame支持，并在共享像素CSS入口导入本次独立`ui/pixel-inline-art.css`。

## 完整新增逻辑资源索引

| key | 原生frame | code来源 |
|---|---|---|
| `inline:task:banner` | 32×32 | `code:apps/web/src/task-symbols.ts#banner` |
| `inline:task:portal` | 32×32 | `code:apps/web/src/task-symbols.ts#portal` |
| `inline:task:feather` | 32×32 | `code:apps/web/src/task-symbols.ts#feather` |
| `inline:task:compass` | 32×32 | `code:apps/web/src/task-symbols.ts#compass` |
| `inline:task:book` | 32×32 | `code:apps/web/src/task-symbols.ts#book` |
| `inline:task:chest` | 32×32 | `code:apps/web/src/task-symbols.ts#chest` |
| `inline:task:clock` | 32×32 | `code:apps/web/src/task-symbols.ts#clock` |
| `inline:task:check` | 32×32 | `code:apps/web/src/task-symbols.ts#check` |
| `inline:task:hourglass` | 32×32 | `code:apps/web/src/task-symbols.ts#hourglass` |
| `inline:task:alert` | 32×32 | `code:apps/web/src/task-symbols.ts#alert` |
| `inline:task:diamond` | 32×32 | `code:apps/web/src/task-symbols.ts#diamond` |
| `inline:travel:lock` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:lock` |
| `inline:travel:search` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:search` |
| `inline:travel:arrow` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:arrow` |
| `inline:travel:left` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:left` |
| `inline:travel:right` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:right` |
| `inline:travel:check` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:check` |
| `inline:travel:compass` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:compass` |
| `inline:travel:coin` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:coin` |
| `inline:travel:xp` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:xp` |
| `inline:travel:material` | 24×24 | `code:apps/web/src/travel-browser.ts#travelIcon:material` |
| `inline:travel-compass` | 100×100 | `code:apps/web/src/travel-browser.ts#travelCompass` |
| `inline:result:victory` | 120×120 | `code:apps/web/src/battle-result-emblems.ts#victory` |
| `inline:result:defeat` | 120×120 | `code:apps/web/src/battle-result-emblems.ts#defeat` |
| `inline:result:pending` | 120×120 | `code:apps/web/src/battle-result-emblems.ts#pending` |
| `inline:hud-exit` | 24×24 | `code:apps/web/src/hud-context.ts#hudExitIcon` |
| `inline:form:chevron` | 16×16 | `code:apps/web/src/ui/form-art.ts#chevron` |
| `inline:graphic:empty-slot` | 64×64 | `code:apps/web/src/ui/graphic-art.ts#empty-slot` |
| `inline:graphic:timer` | 16×16 | `code:apps/web/src/ui/graphic-art.ts#timer` |
| `inline:graphic:page-prev` | 20×20 | `code:apps/web/src/ui/graphic-art.ts#page-prev` |
| `inline:graphic:page-next` | 20×20 | `code:apps/web/src/ui/graphic-art.ts#page-next` |
| `inline:graphic:help` | 16×16 | `code:apps/web/src/ui/graphic-art.ts#help` |
| `inline:state:empty` | 48×48 | `code:apps/web/src/ui/state-art.ts#empty` |
| `inline:state:loading` | 48×48 | `code:apps/web/src/ui/state-art.ts#loading` |
| `inline:state:error` | 48×48 | `code:apps/web/src/ui/state-art.ts#error` |
| `inline:state:success` | 48×48 | `code:apps/web/src/ui/state-art.ts#success` |

基符号的16档用`:16`后缀，原始source-index仅列36个实际code来源；63个完整键见keys.json。

## 动态图形保留理由

- form `field`/`range`/`toggle`分别有focus/error/disabled/checked的CSS状态。轨道是240×36、240×12、44×24动态边框；toggle活动滑块仍由原伪元素拥有。不能用固定图片冻结其颜色或拉伸行为。
- graphic `pip`/`diamond-pip`/`bar-pip`/`meter`/`page`用CSS变量显示填充数、进度或当前页，保留数据几何。
- ring显示真实ratio；hub/paragon线是节点数据连接，保持现有数据和可访问标签，不变成静态图。
- 以上8类CSS控件与3类数据几何在像素模式使用crispEdges、整数边线、无filter；保留状态颜色变量，关闭开关后通过body作用域恢复。
- component/slot两族原SVG已经由现有像素CSS隐藏并换成公共像素边框；5个pixel-frames本身是原生12px硬格SVG，不当成遗漏。

## 文件名碰撞修正和验证

最初`inline:travel:compass`与`inline:travel-compass`被冒号改连字符后撞名，后写100px覆盖24px。根接入全组检查截住，未写入live。现文件名加原始资源键SHA256前12位，并在写前以Windows大小写归一名称做全局唯一断言。写完所有PNG后再对整个候选调用checkManifest，不能只检查刚写的单项。

最终63项=63独立文件，post-write整组63项零问题，记录`inline-svg/validation.json`。联系表已实际查看：`inline-svg/fine-contact.png`。

`tests/fine-inline-svg.test.ts`覆盖语义标记、100/120替换后恢复原SVG、动态控件不被静态化、两种compass命名不碰撞及完整键集合的物理文件唯一性。只做语法和diff检查；由主代理串行执行TSC/单测/全量资源校验。

## 最终正式可达扫描

静态SVG未接入入口为0。唯一最后漏口是两处关闭X，已在确认对应文件diff干净后加已有X像素key。其余未标记命中均为上述数据/CSS状态几何、已隐藏装饰、已像素化12px框或hex-rune中字符串replace产生的扫描误报。不操作浏览器、不把源码复核称为真机通过。

## 运行路径交叉审查（只读）

已将三个真实触发路径交给主代理处理：冷decode时复用的FX Image未重试；含文字的ground-loot/kill-spoils容器被文本相机整根忽略导致名称消失；world loader直接缓存smallArt的像素URL导致关闭后缓存无法恢复且默认LINEAR。修复由主代理拥有，未修改被审运行时文件。相机矩阵/packed positions/地表源网格的其他检查未再发现已确认的实际缺陷，未把推测作为阻塞。

