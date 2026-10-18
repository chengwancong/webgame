import {readFile,writeFile,stat} from 'node:fs/promises';import {join,resolve} from 'node:path';import {group,root,out,library,json,record,sha} from './pipeline.mjs';
const validation=JSON.parse(await readFile(join(group,'evidence/validation.json'),'utf8')),blink=JSON.parse(await readFile(join(group,'evidence/blink-validation.json'),'utf8')),preview=JSON.parse(await readFile(join(group,'evidence/preview-validation.json'),'utf8'));
if(!validation.pass||!preview.pass||blink.results.some(r=>r.maxClosedFrameErrorPx>.25))throw Error('Self-check not passed');
const palette=JSON.parse(await readFile(join(group,'sources/palette.json'),'utf8')),manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8'));
const rawNames=['exec-7367e79f-bec5-45b0-9a75-3aa69309661a.png','exec-5d32c6a8-49ac-4bc5-81bb-7e7006375161.png','exec-3c76e109-9478-4d7e-a10c-523a2c310519.png'];
const gen=[];for(let style=1;style<=3;style++){const rawPath='C:/Users/ccc/.codex/generated_images/01a14a08-59ca-7d11-b164-20d3ebab897a/'+rawNames[style-1],raw=await record(rawPath),retained=await record(join(group,'sources',`style${style}-imagegen.png`));if(raw.sha256!==retained.sha256)throw Error('Imagegen copy mismatch');gen.push({style,tool:'built-in image_gen',rawPath,rawSha256:raw.sha256,retained,promptSummary:'16 separate D1 a/c/d texture parts in original 4x4 registration grid; cream #f4edda, beige #cbb694, cyan #78b9c4, thin single brown #3c2b23 outlines, point eyes with one white highlight, closed eyes on body, open eyes in yan, transparent background; '+['','minimal flat with one hard shadow and 3-5 tufts','rounded scalloped contour, one hard shadow and one light belly patch','same contour as style1 with one narrow soft-edge shadow'][style],postprocess:'Hand re-trace original part coordinate silhouettes and facial registration; no generated complete-character pose used as runtime animation.'});}
await json(join(group,'sources/imagegen-provenance.json'),gen);
const allParts=[];
for(let style=1;style<=3;style++){const path=join(group,'sources',`style${style}-parts.json`),data=JSON.parse(await readFile(path,'utf8'));for(const part of data.records){part.imagegen={...part.imagegen,rawPath:gen[style-1].rawPath,rawSha256:gen[style-1].rawSha256};allParts.push({style,...part});}await json(path,data);}
for(const a of manifest.assets){const p=a.runtime,style=+a.id.match(/style(\d)/)[1],name='guaiD1'+p.stage,packageDir=join(group,'sources','style'+style,name),parts=allParts.filter(r=>r.style===style&&r.stage===p.stage);
 delete p.locomotion;p.style=style;p.styleName=['','极简平涂','平涂毛边','柔和色面'][style];p.preview='/art/starsea/pets/repaint/preview/index.html';p.displayRule='Actual idle alpha envelope 44/56/68; per-clip camera fit baked to each stage height; native skeleton and animation unchanged';
 await json(join(out,a.id,'profile.json'),p);
 a.source={mode:'adaptation',path:join(library,name,name+'.json').replaceAll('\\','/'),sha256:sha(await readFile(join(library,name,name+'.json'))),nativeVersion:'3.6.52',family:'D1',stage:p.stage,skeletonByteIdentical:true,attachmentPathChanged:false,adjustments:['Only replacement atlas textures; skeleton JSON byte-identical including attachments, slots, draw order, animations and timing','16 original part canvases re-traced into 48 individually registered 2x PNGs across 3 styles','Painted shared palette; no slot tint or darkColor overrides','Native full actions at 30fps with PA1-style trimmed 256px atlas packaging'],paintedPalette:palette,slotTintOverrides:{},imagegen:gen[style-1],parts:parts.map(r=>({original:r.original,texture:r.output,handCorrection:r.handCorrection,imagegenRawPath:r.imagegen.rawPath,imagegenRawSha256:r.imagegen.rawSha256,method:r.method})),bones:a.source.bones,slots:a.source.slots,files:[await record(join(library,name,name+'.json')),await record(join(library,name,name+'.spine')),...parts.map(r=>r.original)]};
 a.files=[];for(const f of ['actor.png','actor.json','sockets.json','profile.json'])a.files.push(await record(join(out,a.id,f)));for(const f of [name+'.json',name+'.atlas',name+'.png'])a.files.push(await record(join(packageDir,f)));a.files.push(...parts.map(r=>r.output));a.dependencies=a.source.files.map(f=>f.path);a.status='producer-reviewed';a.notes={preview:p.preview,diagnostics:'assets/starsea/pets/repaint/evidence/validation.json',styleChoice:'not selected; user chooses among 1/2/3',scope:'PA2 wind pet texture samples only',rootAcceptance:'resource sample self-check passed; no style selected'};
}
manifest.schemaVersion=1;manifest.group='pets';manifest.version='starsea-20261017-pets-pa2';manifest.requirements='docs/pets/pet-repaint-sample.md';manifest.selectedStyle=null;manifest.notes='9 texture-repaint samples, 48 2x part PNGs; PA1 untouched; no gameplay or new cosmetic variants.';
await json(join(group,'manifest.json'),manifest);await json(join(out,'manifest.json'),manifest);
for(const a of manifest.assets)for(const f of [...a.files,...a.source.files])if(sha(await readFile(resolve(root,f.path)))!==f.sha256)throw Error('Hash mismatch '+f.path);
const refPaths=['apps/web/public/art/mini-hero/navy/profile.json','apps/web/public/art/mini-hero/navy/Character.json','apps/web/public/art/mini-hero/navy/Character.atlas','apps/web/public/art/open-world/textures/ow-art-grass.png','apps/web/public/art/open-world/five-islands/textures/ow-road-dirt.png'];const referenceFiles=[];for(const p of refPaths)referenceFiles.push(await record(join(root,p)));await json(join(group,'sources/scene-reference-files.json'),referenceFiles);
const ids=manifest.assets.map(a=>`| ${a.runtime.styleName} | ${a.runtime.stage} | ${a.runtime.displayHeight}px | ${Object.values(a.actions).reduce((s,c)=>s+c.count,0)} | \`${a.id}\` |`).join('\n');
const report=`# PA2 风栖宠物重画样稿报告

日期：2026-10-17（Asia/Shanghai）。唯一依据：\`docs/pets/pet-repaint-sample.md\`。

状态：九步制作与资源自检完成；三种画法均保留，selectedStyle=null，不替用户选择。本批只做 D1 风绒 a/c/d，无 b/d 外观批次、无 e 阶重画、无玩法接入。

## 交付

- 3 种画法 × a/c/d 三阶＝9 套。每套 idle、idle2、move、attack、knock 五个完整原生动作，共 45 段、1,179 帧；30fps、256×256 逻辑格，交付 actor.png / actor.json / sockets.json / profile.json。
- 原始 16 个零件 × 3 画法＝48 张独立透明 PNG，逐张为原尺寸 2 倍。a: tou/yan；c: tou/yan/jiao1/jiao2；d: tou/yan/jiao1/jao2/er1/er2/mao1–mao4。
- 三张样稿图 \`evidence/sample-1.png\`、\`sample-2.png\`、\`sample-3.png\`，2400×1040；每张包含正式风栖草地/土路，主角 + 港湾拾荒者 + 风栖猎犬 + 三阶宠物的实际大小同排及 4×放大同排。
- 四列对照 \`evidence/compare.png\`，1120×660；三种画法 + PA1 原版，三阶 idle 首帧，实际大小。PA1 对照原样 a/c/e，PA2 为 a/c/d，均明确标注。
- 四档预览：\`apps/web/public/art/starsea/pets/repaint/preview/index.html\`。样稿1/2/3/PA1、五动作、暂停、镜像均可用。主角与两个怪物只读正式资源。
- 资源清单：\`assets/starsea/pets/repaint/manifest.json\`。源码/分件/报告仅在 repaint；发布帧图集与预览仅在对应 public repaint。

| 画法 | 阶段 | 显示高度 | 帧数 | 资源 ID |
| --- | --- | --- | --- | --- |
${ids}

## 描边、配色和绘制方式

统一描边和点眼为 **#3c2b23**。取样来自真实主角渲染的发梢外边缘 (135,110)，RGB(60,43,35)；拾荒者发梢边缘 (106,3) 为 #3b2600，钩柄边缘 (45,49) 为 #48240e，作为暖深棕对照。原始取样 PNG 均在 evidence，坐标及记录见 \`sources/palette.json\`。

三稿共用：身体 #f4edda、米褐暗部 #cbb694、青蓝 #78b9c4、青蓝暗部 #528c99、腮红 #e8b7a4、白高光 #ffffff。样稿2额外使用同一公共色表中的浅肚皮 #fff7e6。描边原零件坐标宽 1.6px，按原生骨骼比例和实际显示缩放后约 1–1.5px；须为 2.2px 原坐标线宽，保证小尺寸可读。

使用内置 imagegen 分别出三张 16 零件原稿，保存在 \`sources/style1-imagegen.png\` 至 style3-imagegen.png；原始绝对路径、SHA-256、保留副本与提示词要点见 \`sources/imagegen-provenance.json\`。生成稿存在额外毛尖、成年身体上的耳状突起、渐变和对位偏差，按 §7 手工在原零件坐标重描。手工轮廓、色块和五官路径保留为每个零件旁的 SVG，4×栅格化后缩至2× PNG；这些是最终纹理的绘制源，不是运行时占位图。

样稿1：一个底色 + 一个硬边暗部，五处小毛尖。样稿2：圆齿绒边、同色硬边暗部和一块浅肚皮。样稿3：与1相同外轮廓，只把暗部边界收为窄幅柔边，不增加写实纹理、细毛丝或外发光。眼睛三稿完全共用同一绘制规则：深棕实心点眼 + 单个白高光；闭眼为细弧线。

## 保持不变与对位

- 九份骨骼 JSON 与库中对应 a/c/d 文件**逐字节相同**。骨骼、动画、关键帧时序、槽位、draw order、mesh UV/权重、region 宽高/偏移/旋转全部未变；连允许变动的 path 也无需改。
- 新 atlas 使用原 region 名称，2×纹理以原画布完整打包，不裁移零件画布。原始附件尺寸仍由原 JSON 控制，不能因 PNG 翻倍而放大骨骼附件。
- 没有槽位乘色或 darkColor 覆盖。repaint 渲染器对这些参数主动报错。技术上采用 PNG 上传预乘 alpha 和匹配的 PMA 混合，解决叠层边缘的白/暗圈；没有改 vendor 或 PA1。
- 以 yan 为准校准闭眼：将全部 idle/idle2 闭眼时段的眼睛中心通过原骨骼矩阵、身体 mesh 三角形反算到 UV，取共同校准位置。记录在 \`sources/eye-alignment.json\`。原生眨眼显隐时序未变。
- PA1 的固定 ground、真实骨骼局部挂点、逐帧矩阵换算和 anchor 镜像逻辑沿用；每个实际动作每帧都有 ground/body/head/emit/accessory。

## 自检结论

- 9/9 套、1,179/1,179 帧均非空、在256逻辑格内，打包帧不越界；每段有至少3个不同实际像素帧。
- 逐帧 alpha 连通检查：1,179帧均为单一连通主体（排除小于3像素的抗锯齿碎点），没有分件脱离候选。已在真实渲染中复核 idle/眨眼、attack挤压、knock旋转、镜像和三阶生长。
- 闭眼时段的身体弧线与 yan 中心最大对位误差：a **0.201px**、c **0.065px**、d **0.060px**；睁眼时对应弧线被同色覆盖层盖住。原生身体网格与眼骨骼在非闭眼时段的相对运动仍保留，没有改动画去锁死。
- 实际 idle alpha 包络按44/56/68px标定，三阶递增。其他动作沿 PA1 方法整段固定等比相机缩放，烘入图集和挂点，垂直包络不超过该阶显示高度。动作切换时可能出现体量变化，未隐藏此限制；源骨骼参数与时序完全不变。
- 四档 × 五动作共20组可视 Chrome 连续播放通过；控制台错误0，三阶均实际换帧。镜像和暂停经过交互检查。
- 48张分件尺寸/透明通道/原始与新文件SHA-256检查通过；九份原JSON不变。冻结的 **173个PA1文件** 哈希全部一致。
- 导出和预览均使用可视 Chrome（headless:false）与 RTX 4070 SUPER / D3D11，所有本批重任务串行。

证据：\`evidence/validation.json\`、\`blink-validation.json\`、\`preview-validation.json\`、\`sample-capture.json\`、\`pa1-before.json\`。大图与原始渲染仅留本地 evidence/，由 .gitignore 排除；报告只保留结论。

## 三种画法各自的优缺点

| 画法 | 优点 | 需要权衡的地方 |
| --- | --- | --- |
| 1 极简平涂 | 体块、点眼和成长附件直接；小尺寸色块清楚，轮廓信息少；硬边暗部容易在动作中保持稳定。 | 绒毛感主要靠少量毛尖，身体会更像简洁图形；体积过渡较硬。 |
| 2 平涂毛边 | 圆齿边缘更强调柔软毛团；肚皮增加前后/上下层次，三阶仍保持同一主体。 | 44px下圆齿容易合并成较密的轮廓节奏；浅肚皮会增加一个视觉焦点，整体比1更繁。 |
| 3 柔和色面 | 同样简洁的轮廓下，暗部过渡更柔和；放大后能看到较连续的体积，贴近场景手绘色面。 | 44px下窄柔边与硬边的差别较小，主要在4×检视时明显；后续其他底色场景要继续检查柔边是否降低对比。 |

本报告不排名、不指定采用哪一稿。后续五只宠物的重画属于用户选定画法后的另一个批次。

## 范围、限制和复现

没有制作外观变体、连携技、出场/收回/抚摸、跟随AI或玩法；没有修改源码、公共 manifest、版本、数据库或PA1产物；没有访问8612/8790、重启现有服务或git commit。无 §8 硬阻塞。

样稿底图读取正式 \`/art/open-world/textures/ow-art-grass.png\` 与 \`/art/open-world/five-islands/textures/ow-road-dirt.png\`；它是便于同排比较的地表构图，不冒充游戏地图实况。角色全部来自原生Spine渲染，未把生成立绘拼成样稿。主角按正式 navy profile/皮肤渲染；两只怪物读取原生导出图集及正式比例。

复现入口（open-world目录，依次等待完成）：\`anatomy.mjs\` → \`paint-parts.mjs 1\`、\`2\`、\`3\` → \`export.mjs\` → \`capture-samples.mjs\` → \`preview-check.mjs\` → \`blink-check.mjs\` → \`verify.mjs\` → \`finalize.mjs\`，均位于 \`assets/starsea/pets/repaint/\`。imagegen原稿已经保留，无需重新生成才能复现分件和导出。

可视预览启动：\`node assets/starsea/pets/repaint/serve-preview.mjs\`，使用独立只读临时端口。绘制规则在 paint-parts.mjs，完整零件来源在 sources/styleN-parts.json 与 manifest.json。
`;
await writeFile(join(group,'report.md'),report);
let progress=await readFile(join(group,'progress.md'),'utf8');progress=progress.replace('- [ ] 9 报告（仅陈述优缺点，不替用户选择）','- [x] 9 报告完成，三种画法优缺点分别列明，不排名、不替用户选择。').replace('当前：最终来源台账与报告。三稿只供选择，未指定采用任何一种。','状态：PA2 全部九步完成。9 套 / 45 段 / 1,179 帧，48 张2×零件，3张样稿 + 四列对照 + 四档预览已交付。selectedStyle=null，等待用户选择画法；本批没有未完成制作项。');await writeFile(join(group,'progress.md'),progress);
for(const f of ['report.md','progress.md','decisions.md'])if((await stat(join(group,f))).size>200*1024)throw Error('Oversized report');
console.log('PA2 COMPLETE: 9 atlases, 48 2x parts, 45 native clips, 1179 frames; no style selected');
