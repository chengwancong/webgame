import {readFile,writeFile,readdir,stat} from 'node:fs/promises';import {join} from 'node:path';import {group,out,json,record} from './r2-pipeline.mjs';import {pets} from './r2-definitions.mjs';
const get=async f=>JSON.parse(await readFile(join(group,'evidence',f),'utf8')),size=await get('r2-size-estimate.json'),quant=await get('r2-cost-probe.json'),lod=await get('r2-cost-lod-1.6.json'),previous=await get('size-estimate.json'),oldLod=await get('cost-lod-1.6.json'),oldFx=await get('fx-cost.json'),audit=await get('r2-final-audit.json'),area=await get('r2-ornament-area.json'),sil=await get('r2-silhouette-check.json'),live=await get('r2-live-check.json');
if(!audit.pass||!area.pass||!sil.pass||!live.pass)throw Error('Required checks incomplete');
const sum=(arr,key,field)=>arr.filter(r=>r.id.startsWith('ss-pet-'+key+'-')).reduce((n,r)=>n+r[field],0),mb=n=>(n/1e6).toFixed(2),scenarios=[];
for(const p of pets){const raw=sum(size.rows,p.key,'bytes30'),packed24=sum(size.rows,p.key,'bytes24Gzip'),q=sum(lod.rows,p.key,'bytes'),oldKey='heavy'+p.style,oldRaw=previous.measured[oldKey].bytes30,oldPacked=oldLod.rows.filter(r=>r.tier===oldKey).reduce((n,r)=>n+r.bytes,0),selected=p.family==='A10'?packed24:q,global=oldFx.projections[p.style].bytes-oldPacked+selected;scenarios.push({key:p.key,name:p.name,family:p.family,rawThreeForms:raw,packed24Gzip:packed24,quantizedLodThreeForms:q,selectedBudgetPrototype:selected,prototypeChoice:p.family==='A10'?'24fps lossless images + gzip; reject RGB-residual removal because p95 error15–29':'24fps + 5bit mix + 1.6display density + gzip; lossy prototype, p95 RGB error4–5',raw162Model:previous.projections[p.style].bytes30.pa4ComplexityWeighted-oldRaw+raw,budget162Model:global,plus15Percent:Math.round(global*1.15),lightReassignmentAllowance:p.family==='A10'?2000000:0,budgetWithLightAllowance:global+(p.family==='A10'?2000000:0),passesNominal65MB:global+(p.family==='A10'?2000000:0)<=65000000});}
await json(join(group,'evidence/r2-budget-summary.json'),{budgetBytes:65000000,scenarios,scope:'Replace only Dragon heavy3bases in previous162 forecast; other islands remain prior assumptions; choose ONE of4 variants',notProductionAcceptance:true});
async function bytes(d){let n=0;for(const e of await readdir(d,{withFileTypes:true}))n+=e.isDirectory()?await bytes(join(d,e.name)):(await stat(join(d,e.name))).size;return n;}
const sourcePrompt=await record(join(group,'sources/r2-imagegen-prompt.md')),sourceImage=await record(join(group,'evidence/r2-imagegen-anatomy-reference.png'));await json(join(group,'sources/r2-imagegen-provenance.json'),{mode:'built-in image_gen',use:'Anatomy and color reference only; not animation frames',prompt:sourcePrompt,output:sourceImage});
const table=scenarios.map(s=>`|${s.name} · ${s.family}|${mb(s.rawThreeForms)}|${mb(s.packed24Gzip)}|${mb(s.selectedBudgetPrototype)}|${mb(s.raw162Model)}|${mb(s.budget162Model)}|${mb(s.budgetWithLightAllowance)}|`).join('\n');
const text=[
'', '---', '', '## PA5-r2 · 龙眠重氪重画（2026-10-18）', '',
'本节追加于PA5报告之后，覆盖本轮重氪的五官和本体配色规则。五项交付完成，停在用户选择家族与画法的阶段；零氪、轻氪未制作替换，旧PA5样稿保留作对照。', '',
'### 交付与检查结果', '',
'- [r2-heavy-dragon.png](evidence/r2-heavy-dragon.png)：甲A、甲B、乙A、乙B四行；每行以原库c/d/e拼装开头，再放主角、原PA5零氪眠角成年、轻氪晓翼成年与新三形态。风栖正式地表，实际大小＋2×。',
'- [r2-silhouette.png](evidence/r2-silhouette.png)：12个形态的idle首帧纯黑剪影，实际54px。A/B不改外轮廓，剪影相同是预期；不是用饰件把黑轮廓撑大。',
'- [r2-actions.png](evidence/r2-actions.png)：四个方案的觉醒形态，idle/move/attack各0%、40%、80%，36格、2×。保留A10原生喷火等动作内效果，未以平移静图冒充动作。',
'- 预览入口仍为 /art/starsea/pets/v4-sample/preview/index.html，新增「r2 重画」开关；?r2=1可直接打开本轮。内页支持家族/画法/形态、五动作、镜像、1×/2×和常驻特效。当前本地地址见 [r2-preview-url.txt](r2-preview-url.txt)。',
'- [r2-visible-chrome.png](evidence/r2-visible-chrome.png)、[r2-toggle-visible-chrome.png](evidence/r2-toggle-visible-chrome.png)为可视Chrome截图；[r2-parts-comparison.png](evidence/r2-parts-comparison.png)把头、身体、鳍翼、下颌或角部件的原图与重画A/B放在同一尺寸下比较。', '',
`12套形态，共${audit.frames}帧原生30fps采样、60段动作、${audit.parts}份2×零件变体。全部原生JSON与库文件字节一致，原骨骼、槽位、附件尺寸偏移与动作时序不变。${audit.freeLightFilesUnchanged}个冻结的零氪/轻氪运行文件hash保持一致。`, '',
'五动作映射仍为std/std2/walk/atk/jifei；所有形态齐全。256逻辑格、54/70/84px名义高度，逐动作边界、挂点、镜像和无损分区重建通过。60个形态动作组合 × 三时间点 × 两朝向，共360次合成检查通过；切换r2/PA5也已实操。', '',
'### 本体改动与剪影结论', '',
'甲A10采用深砖红背鳞、浅金腹甲、铜橙翼膜。保留原图长吻、额角、鼻部轮廓、背棘、爪和翼骨；用杏仁眼白、蓝色圆虹膜与圆瞳替换原凶眼，清楚保留嘴角和下颌。乙A7采用深青背部、浅金腹甲、铜橙鳍片和骨线；不再把前鳍与身体一起画成米白色。眼睛采用与眼白对比更强的蓝紫虹膜，保留原眼部窗口与眼睑动作。d阶长须用背色区分，不把浅色尖端画成獠牙。', '',
'原生外轮廓和颜色分区转为可编辑的硬边矢量层，另绘眼睛、嘴角、腹甲横纹、鳍翼骨线和小饰甲；最终零件保留原画布和UV关系，仅在贴图中消除露牙。没有通过削短吻部、抹平角冠或修改站姿来换画风。', '',
'54px黑剪影制作自检：甲c可辨长吻/额角、背棘、后足与尖尾；甲d可辨双角、展开翼与站姿；甲e虽在首帧折翼，角冠、背棘、爪和尾仍保留龙的轮廓。乙c/d/e均可辨角冠、抬颈、长尾和鳍爪，读为低伏鳍龙，未归类为虫子、豆子或无结构的一团。A/B各三阶共12项通过本轮制作目视检查；这不是用户盲测或用户选型通过。逐项结论和与原库剪影重合度在 r2-silhouette-check.json。', '',
'### 饰件面积', '',
`采用逐帧独立身体mask/饰件mask渲染，遍历全部${audit.frames}帧。分母排除原生特效，分子仍保守计入可能被身体遮挡的饰甲投影。最大饰件/本体面积为 **${(Math.max(...area.rows.map(r=>r.maxRatio))*100).toFixed(2)}%**，全部低于15%。`, '',
'A保留微小嵌入式余烬标识，本体色面、鳞片、腹甲和翼骨承担主要精绘；B添加头角根部金边、小胸/肩甲和翼缘镶边，不加大围巾、不盖住吻部和眼睛。面积明细见 r2-ornament-area.json。', '',
'|方案|幼年最大|成年最大|觉醒最大|', '|---|---:|---:|---:|',
...pets.map(p=>'|'+p.name+'|'+['young','adult','awakened'].map(f=>(area.rows.find(r=>r.id===`ss-pet-${p.key}-${f}`).maxRatio*100).toFixed(2)+'%').join('|')+'|'), '',
'### 方案优缺点（不替用户选择）', '',
'|方案|优点|限制|', '|---|---|---|',
'|甲 A10|站姿、长吻、背鳞与翼骨的物种特征明确；展翼动作强化龙的轮廓；背腹对比清楚|c/e首帧翼折叠，需结合动作看翼龙结构；原生攻击特效使256格的统一取景较宽，2×放大下精度弱于高分辨率原库静态参照；若选甲，轻氪需另换家族|',
'|乙 A7|保留低伏鳍龙的长冠、长尾、层叠鳍和骨线；本体分色后各结构不再混成一排米白肢体|低伏横长是原生姿态，重画不会变成站立龙；小尺寸鳍和冠的线条较密，原始精度的存储成本较高|',
'|画法 A|身体结构更完整地露出，鳞甲、腹甲、鳍翼色面承担精致感；饰件干扰最少|与B的差距更多在局部，54px下需看肩胸位置才能辨别；不靠额外装饰制造巨大轮廓差|',
'|画法 B|小面积肩胸甲、翼缘与角根金边形成守护兽感，和主体色面配合|部分甲片会随原姿态遮挡；54px细节不如成年/觉醒或2×明显；不能再继续堆饰件突破15%|', '',
'如果用户选择甲A10，轻氪仅推荐另用 **A7 a/b/c**：保留较小的鳍龙谱系，与零氪D2、重氪A10同岛不重复，且可拉开站姿差别。本轮只登记这个有条件的推荐，没有制作、替换或验收这组三阶轻氪，也没有预先决定用户会选甲。', '',
'### 体量变化与65MB预算', '',
`本轮r2运行子目录实测 **${mb(await bytes(out))}MB**，包含四个互斥方案的12套形态。它们是供选择的开发样稿，量产时只保留用户选中的一个方案三形态，不能把四份都计入正式162只。旧PA5仍保留，父目录合计不是最终交付包大小。`, '',
'下表只把前次162只估算中的「龙眠重氪三形态」替换为本轮实测，其他五岛仍沿用前次假设。甲还预留2MB作为尚未制作的轻氪换家族估算额度；这2MB是规划余量，不是实测。单位：十进制MB。', '',
'|方案|三形态原精度|三形态24fps+gzip|采用的预算原型|162原精度外推|162预算模型|计入甲轻氪额度|', '|---|---:|---:|---:|---:|---:|---:|', table, '',
'原精度直接铺量仍超过65MB。预算原型继续保留全部形态与动作，但按家族区分处理：', '',
'- 甲A10：只使用24fps原帧重采样、无损图集和gzip元数据。本轮复测发现沿用上一版「去RGB残差」会造成15–29/255的95分位通道误差，因此该有损步骤不采纳为甲的预算路径。',
'- 乙A7：采用上一版24fps、5bit混色、1.6×显示密度与gzip原型；95分位RGB误差为4–5/255，仍属于有损试验，必须在定稿后复核小眼、翼骨及2×画质。正式r2样稿没有替换为这些预算原型。',
'- 共用特效沿前次96px物理采样预算，实际显示大小与0.85透明度不变。没有删减162只、形态或动作，也没有逐只完整烘焙。', '',
'当前替换模型加上上述甲的轻氪额度仍低于65MB，但不是完整162只的实包验收。若再统一加15%安全余量，部分方案会越线；最终家族组合和甲的新轻氪都未确认，不能宣布全包预算已通过。后续应先保留本体/眼睛质量，进一步做跨动作共享、元数据精简与特效共享后复测，不以减数量掩盖超限。数据见 r2-budget-summary.json 与 r2-size-estimate.json。', '',
'### 来源、预览与停点', '',
'本轮使用内置image_gen制作结构与配色参考：[参考图](evidence/r2-imagegen-anatomy-reference.png)、[完整prompt](sources/r2-imagegen-prompt.md)、[来源登记](sources/r2-imagegen-provenance.json)。参考图没有被当作动画帧；最终图集来自原骨架播放和重画零件。零件绝对来源路径、sha256、2×尺寸和矢量源登记在 sources/r2-*-parts.json，局部资源登记在 r2-manifest.json。', '',
'可视Chrome、硬件ANGLE/D3D11，所有导出、mask渲染、预算试验与预览串行。仅写v4-sample两个允许目录；PA1–PA4、源库及零氪/轻氪资源保持只读，无正式服务、源码、版本或公共manifest修改，未git commit。原始大图和渲染明细只留本地evidence。', '',
'本轮到此停止，等待用户选择 **甲/乙家族** 和 **A/B画法**。不替用户选，不继续铺162只。', ''
].join('\n');
const path=join(group,'report.md'),old=await readFile(path,'utf8'),marker='\n---\n\n## PA5-r2';await writeFile(path,(old.includes(marker)?old.slice(0,old.indexOf(marker)):old)+text);
let progress=await readFile(join(group,'progress.md'),'utf8');progress=progress.replace('- [ ] r2-5.','- [x] r2-5.').replace('状态：制作中；先检查原生剪影与头部结构。','状态：五项交付完成，等待用户选择甲/乙与A/B。');progress+='\nPA5-r2最终检查：12形态，1776原生采样帧，198份2×零件；54px剪影制作自检通过；饰件面积最大11.65%；360次合成检查通过。\n';await writeFile(join(group,'progress.md'),progress);
const hashes=[];for(const f of ['r2-heavy-dragon.png','r2-silhouette.png','r2-actions.png','r2-visible-chrome.png','r2-toggle-visible-chrome.png'])hashes.push(await record(join(group,'evidence',f)));await json(join(group,'evidence/r2-deliverables.json'),{hashes,scenarios});console.log(JSON.stringify(scenarios,null,2));
