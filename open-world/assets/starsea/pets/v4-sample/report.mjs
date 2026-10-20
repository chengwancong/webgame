import {readFile,writeFile,readdir,stat} from 'node:fs/promises';import {join} from 'node:path';import {group,out,json,record} from './pipeline.mjs';
const read=async f=>JSON.parse(await readFile(join(group,'evidence',f),'utf8')),audit=await read('final-audit.json'),codec=await read('final-codec-validation.json'),live=await read('live-check.json'),size=await read('size-estimate.json'),cost=await read('cost-probe.json'),lod=await read('cost-lod-1.6.json'),fx=await read('fx-cost.json'),candidates=await read('candidates-validation.json'),mb=n=>(n/1e6).toFixed(2);
if(!audit.pass||!codec.pass||!live.pass)throw Error('Cannot report incomplete validation');
async function bytes(d){let n=0;for(const e of await readdir(d,{withFileTypes:true}))n+=e.isDirectory()?await bytes(join(d,e.name)):(await stat(join(d,e.name))).size;return n;}
const total=await bytes(out),table=Object.entries(size.projections).map(([v,p])=>`|重氪 ${v}|${mb(p.bytes30.pa4ComplexityWeighted)}|${mb(p.bytes24.pa4ComplexityWeighted)}|${mb(p.bytes24Gzip.pa4ComplexityWeighted)}|${mb(cost.projections[v].bytes)}|${mb(lod.projections[v].bytes)}|${mb(fx.projections[v].bytes)}|${mb(fx.projections[v].plus15Percent)}|`).join('\n');
const text=`# PA5 氪度阶梯样稿报告

2026-10-18。六项样稿交付完成，停在用户选择 A/B 的阶段；未开始重做 162 只。

## 交付与入口

- 总表：[evidence/ladder-dragon.png](evidence/ladder-dragon.png)。余烬 / 霜卫 × 零氪 / 轻氪 / 重氪 A / 重氪 B × 三形态，共 24 个逻辑外观；每个同时提供实际像素和 2×。风栖正式草地、道路，主角约100px、风原巡猎兽约80px，与宠物共享脚底参考线。
- 动作：[evidence/heavy-actions.png](evidence/heavy-actions.png)。A/B 各三形态 × idle/move/attack × 0%/40%/80%，共54格，2×；全部取自完整原生 Spine 动画。
- 候选：[evidence/heavy-candidates.png](evidence/heavy-candidates.png) 与 [candidates.md](candidates.md)。六岛各两候选、每行c/d/e，36个展示单元；复用18套不同原生阶段渲染。
- 预览：\`/art/starsea/pets/v4-sample/preview/index.html\`。可切余烬/霜卫、三形态、五动作、镜像、实际/2×、统一44px、特效与挂点；「阶梯样稿」开关切至独立复制的 PA4 页，读取旧资源。当前本地地址见 [preview-url.txt](preview-url.txt)。启动：\`node assets/starsea/pets/v4-sample/serve.mjs\`。
- 实际 Chrome 截图：[preview-visible-chrome.png](evidence/preview-visible-chrome.png)、[pa4-toggle-visible-chrome.png](evidence/pa4-toggle-visible-chrome.png)、[normalized-44px.png](evidence/normalized-44px.png)。前两张为浏览器截图，总表和动作表为同一可视浏览器内 Canvas 原生渲染结果导出。

## 阶梯与画法

|档位|家族与阶段|幼 / 成 / 觉醒高度|绘制与装饰|
|---|---|---|---|
|零氪|D2 a/c/e|44 / 56 / 68px|米金底色＋一块暗部；流派色仅在项圈吊牌，无职业挂件、无常驻特效|
|轻氪|A10 a/c/e|48 / 62 / 74px|增加硬边高光、流派色条纹/翼纹；肩侧护片徽记、小号职业围巾|
|重氪 A|A7 c/d/e|54 / 70 / 84px|五档硬边色面，鳍翼分片、结构线、边缘亮面；冠饰徽记、大号职业围巾|
|重氪 B|A7 c/d/e|54 / 70 / 84px|A基础上把金边额冠、胸甲、翼尖与尾环画进贴图；胸甲宝石中嵌徽记，大围巾后置给饰甲让位|

两流派共享身体底色 \`#e6cea0\`，暗部 \`#b0966b\`、深暗部 \`#816846\`、高光 \`#f5dfb5\`、边缘光 \`#fff0cf\`。描边和点眼都是 \`#3c2b23\`。余烬的纹样/饰件采用暖橙、锻金，霜卫采用冰蓝、银灰；没有把流派主色混成整只身体底色。重氪眼睛扩大，两个高光保留在2×零件源；实机小尺寸下两个亮点可能合并为一个亮斑。

画法 A 的优点：翼鳍与长角轮廓较轻，暖冷配色容易维持灵兽感，金属负担少。缺点：小尺寸下深暗和结构线会合并；与轻氪的「精致程度」差距不能只靠细小色阶保证。

画法 B 的优点：额冠、胸甲、翼尖与尾环形成明确的饰甲关系；中大形态的金属/宝石更容易识别。缺点：同一套A7轮廓内饰件更密，54px幼年和统一44px时部分甲片会并在一起；大围巾须退后，2×查看时更有优势。没有把 B 设为默认定稿，也没有替用户选择。

### 44px 实测结论

统一44px诊断按当前帧真实alpha高度归一，不拿透明画布或整段最大翼展冒充44px。零氪、轻氪、重氪可以依靠本批不同家族的轮廓与纹样区分；但**不能宣称仅凭精绘色阶就能在44px稳定一眼分档**。A/B本来同属重氪，同骨架同阶段，在44px下差异较弱，2×和成年/觉醒时更易看到胸甲、翼尖与尾环。证据见 \`evidence/normalized-44px.png\`。正式阶梯还叠加了54/70/84px体型及c/d/e取阶差异，不能把这些因素当成单独的画法胜出证据。

## 原生动作、来源与自检

- 12套共享形态，24个逻辑样稿，${audit.frames}个原生30fps采样帧，60个动作段。不是24份重复烘焙图集，也没有两张姿态拼接。
- ${audit.sourcePartVariants}份采用的零件变体，原尺寸2×独立PNG与可编辑SVG，按原画布对位。来源登记在 \`sources/*-parts.json\`，包括原始绝对路径、sha256、原/输出宽高、绘制源；每个原生JSON与素材库字节一致，骨骼、动作、时序、槽位、附件尺寸偏移不变。
- 宠物原库：\`G:/webgame/abyss-walker-migration/spine源文件_召唤与合成Q版spine动画源文件欧美风格小怪物素材819套/\`。D2/A7为3.6，A10为3.5.51并经vendored3.6运行时验证；具体版本逐条写入局部manifest。
- 全部模型动作：idle←std，idle2←std2，move←walk，attack←atk，knock←jifei；skill无。重氪A7 c/d/e五动作齐全。没有制作连携、出场、收回、抚摸或玩法。
- 256逻辑单格；2×硬件采样后缩回256、透明裁切、去重、无损WebP。主图和分区图保存完整原生30fps时间线。各动作采用整段固定、脚底锚定的镜头适配；模型动作竖向范围均不超过本形态上限，最大84px。适配系数记录在 \`bakedPresentationScale\`，没有改动画中的骨骼数值。
- ${audit.frames}帧的ground/body/head/emit/accessory及新增badge/job挂点齐全。镜像以anchor.x为轴统一翻转；最大数值误差 ${Math.max(...audit.rows.map(r=>r.mirrorError)).toExponential(2)} 像素。角色原生跃起/呼吸/受击位移保留；这不是跟随AI或世界移动滑步验收。
- ${codec.rows.length}套最终打包图集逐像素检查，可见RGB重建误差0；alpha直接来自同一共享底图。透明像素的隐藏RGB不计入视觉一致性。
- 可视Chrome、RTX4070 SUPER的ANGLE D3D11硬件GL，串行导出/渲染/预览。120个外观形态动作组合 × 三时间点 × 两朝向，共720次Canvas合成通过；实操五动作、镜像及PA4切换通过，无页面异常。
- 候选中C8d缺原生jifei，已标「候补」，不虚构受击。其余本批候选c/d/e五动作抽查正常。B7原生为兜帽人形，筛查淘汰，没有放进最终候选。

## 材质分区解码与叠加规则

本批16个材质语义：body、shadow、pattern、patternShadow、belly、outlineAndEyes、eyeLight、blush、deepShadow、bodyLight、rim、metal、metalShadow、metalLight、gem、gemLight。分区编码改为 **RGB24_LE_INDEX_OPAQUE_ALPHA_FROM_BASE**：精绘抗锯齿产生的独特RGB超出了旧版65535码字上限，不能直接用PA4的16位解码器。

1. \`regions.webp\`是全不透明RGB数据图，像素索引为 \`R + G*256 + B*65536\`；禁止线性采样、sRGB色彩转换或有损压缩索引。
2. \`materials.bin\`每条6字节 \`[m0,m1,t,dr,dg,db]\`。色板都是sRGB字节值：\`rgb=clamp(round(p[m0]+(p[m1]-p[m0])*t/255)+[dr,dg,db]-128)\`。m0=255时最后三字节是固定RGB。
3. 覆盖率读共享 \`actor.webp\`的alpha；索引图不能携带半透明alpha，否则Canvas预乘会破坏索引。先逐像素还原裁切帧RGBA，再按普通颜色图双线性绘制。实际解码器是 \`preview/composer.js\`。
4. 码字是两材质色＋残差的精确RGB拟合，抗锯齿交界可能混入两个材质；16个语义并不等于16种唯一RGB。冷暖色板只替换纹样/金属/宝石条目，身体条目保持一致。
5. badge/job挂点由原附件UV重心坐标映射到逐帧原生变形网格，再映射到镜头坐标。绝不固定贴在屏幕上。贴花随对应骨骼的相对旋转/缩放，整组只镜像一次。
6. 图层：地面弧-10、跟随粒子-5、B围巾-1、主体0、A/轻氪围巾18、徽记32。自由吊牌在颈下，轻氪徽记在护片上，A冠饰/B胸甲中心嵌徽记。装备颜色和流派一致。
7. 宝石材质14/15按码字混合权重生成发光遮罩，主体后叠加 \`lighter\`、alpha0.18；不改变眼睛。常驻特效alpha0.85，尺寸随displayHeight增长；地面环只保留三段不闭合的环带，不画实线闭合警告圈，跟随效果置于身体后侧避免遮脸。
8. 特效取自原库182-eff51dianran、188-eff57binghuan、220-eff70mofazhen，原生2.1.27字段适配3.6，30fps、原时序保留。采用128px原生帧，余烬/霜卫粒子与一份共享地面效果用颜色引用复用。来源及sha256在effects.json，不改特效库。

## 162只总体量估算与降本方案

当前正式样稿运行目录 **${mb(total)}MB**，包含A/B两种重氪，12套底图及分区、代码表、挂点、两流派附件与128px特效。证据、原零件和制作源不算运行包。未来162只=54套家族/形态＋162套色板数据，重氪选择A或B其中一种；不能把两种同时乘进正式162只。

按龙眠实测字节乘PA4各岛同档资源体量比例，保留共享附件/特效/元数据预算。家族尚未最终选定，因此这是估算而非已制作完成162只的实测总包。所有数值为十进制MB。

|方案|30fps高精度|24fps|24fps+gzip元数据|再做5bit混色试验|再按1.6×显示密度打包|再以96px存特效|最后方案+15%余量|
|---|---:|---:|---:|---:|---:|---:|---:|
${table}

当前高精度样稿的外推**超过65MB**，没有把它写成预算通过。降本试验实际保留了全部形态和动作数量：

- 30→24fps仅重采样原动画，时长不变；按PA4已有24fps交付口径测量，没有插入新姿态。
- 代码表/atlas/sockets等元数据gzip；之后接入需显式解压，不依赖HTTP传输压缩来假装磁盘体积减少。
- 将混色权重限制到32档并省去RGB残差，硬边主体色板本身不变。样本可见通道误差95分位为${Math.min(...cost.rows.map(r=>r.p95ChannelError))}–${Math.max(...cost.rows.map(r=>r.p95ChannelError))}/255。这一步相对原渲染是**有损**的，量化后的底图与分区仍能精确互相还原。
- 烘焙帧的物理纹理密度按各形态实际高度分配，上限1.6×显示高度，保留256逻辑坐标、原挂点和原2×制作零件。当前小形态有多余像素，收回这部分预算；放大2×查看会比原样稿柔一些。
- 特效物理采样从128降到96，播放的世界尺寸和0.85透明度保持不变，不退回PA4的64px小尺寸显示。

这些预算版本都只保存在本地 \`evidence/size-probe24/\`、\`cost-probe/\`、\`cost-lod-1.6/\`、\`fx96/\`，**没有偷偷替换用户比较的高精度样稿**。最后组合能把当前家族复杂度模型压进65MB，仍需在选定A/B和六岛家族后复核画质与真实包体；不以删宠物、删动作或逐只完整烘焙解决预算。测量明细见size-estimate.json、cost-probe.json、cost-lod-1.6.json、fx-cost.json。

## 边界与待选择项

只写v4-sample两处允许目录；PA1–PA4和源库只读。无源码、公共manifest、版本、数据库或正式服务修改；未访问8612/8790，未git commit。原始大图和细节检查仅在本地evidence，已有gitignore。

A/B均为可运行样稿，不标记为用户验收通过。用户仍需选重氪画法与六岛候选；统一44px的细节差距和预算压缩的2×画质是后续需重点复核的两点。此批按要求到此停止，不继续铺162只。
`;
await writeFile(join(group,'report.md'),text);
await writeFile(join(group,'progress.md'),'# PA5 进度\n\n状态：六项样稿交付完成，等待用户选择 A/B；未开始162只重做。\n\n- [x] 1. 余烬/霜卫 × 四档 × 三形态，共24逻辑外观；总表含实际尺寸和2×，主角＋巡猎兽同排。\n- [x] 2. 重氪A/B三形态、三动作、三时间点，共54格动作抽查。\n- [x] 3. 六岛各两候选，c/d/e原生拼装总表；C8d缺受击已标候补。\n- [x] 4. 阶梯/PA4开关、五动作、镜像；120组合/720次合成与可视Chrome截图通过。\n- [x] 5. 按实际字节推算162只；当前高精度超65MB，给出实测降本组合和误差，试验未覆盖正式样稿。\n- [x] 6. report.md、decisions.md、局部manifest、来源sha256与最终审计齐全。\n\n最终数据：12共享形态，1663原生采样帧，189份2×零件变体；原生JSON字节一致，24位分区无损重建。报告如实记录44px细节辨识限制。\n');
const evidence=[];for(const f of ['ladder-dragon.png','heavy-actions.png','heavy-candidates.png','normalized-44px.png','preview-visible-chrome.png','pa4-toggle-visible-chrome.png'])evidence.push(await record(join(group,'evidence',f)));await json(join(group,'evidence/deliverable-hashes.json'),evidence);console.log('REPORT',Buffer.byteLength(text),'bytes; runtime',total);
