import {readFile,writeFile,readdir,stat} from 'node:fs/promises';import {join} from 'node:path';import {root,out,toolsDir,evidence,readJSON,json,note,sha} from './common.mjs';
const audit=await readJSON(join(evidence,'final-audit.json')),validation=await readJSON(join(evidence,'pa4-validation.json')),attachments=await readJSON(join(evidence,'attachment-audit.json')),pictures=await readJSON(join(evidence,'evidence-check.json')),config=await readJSON(join(toolsDir,'families.json')),source=await readJSON(join(root,'assets/starsea/pets/v3/manifest.json'));
if(!audit.pass||!validation.pass||validation.cases!==2430||validation.maxMirrorError!==0||validation.emptyFrames!==0||validation.consoleErrors.length||attachments.overLimit.length||!pictures.pass)throw Error('Completion gates not passed');
for(const a of source.assets)for(const f of a.files){if(sha(await readFile(join(root,f.path)))!==f.sha256)throw Error('Runtime changed since raw-frame audit: '+f.path);}const old=await readJSON(join(evidence,'backup-v3/skins.json')),skins=await readJSON(join(out,'skins.json'));for(const s of skins.skins){const b=old.skins.find(o=>o.id===s.id);for(const k of ['id','name','island','profession','tier','flow','palette','forms','effects'])if(JSON.stringify(s[k])!==JSON.stringify(b[k]))throw Error('Protected skin field changed');}
async function size(d){let n=0;for(const e of await readdir(d,{withFileTypes:true}))n+=e.isDirectory()?await size(join(d,e.name)):(await stat(join(d,e.name))).size;return n;}const bytes=await size(out);audit.runtimeBytes=bytes;await json(join(evidence,'final-audit.json'),audit);
const names={wind:'风栖',mist:'雾铃',forge:'赤炉',frost:'霜镜',dragon:'龙眠',star:'沉星'},table=Object.entries(names).map(([key,name])=>'|'+name+'|'+['free','light','heavy'].map(t=>config.families.find(f=>f.key===key+'-'+t).creature).join('|')+'|').join('\n');
const completion=[
'## 第6批：完成', '',
`在既有 web-public-static 配置的 http://127.0.0.1:8626/art/starsea/pets/v3/preview/index.html 上运行原pa4.validate()：**${validation.cases}/2430通过，镜像误差${validation.maxMirrorError}，空帧${validation.emptyFrames}，控制台错误${validation.consoleErrors.length}**。实际合成采样${validation.renderedSamples}次。`, '',
`最终18家族、54成长runtime、162皮肤、486皮肤形态实例；共${audit.logicalFrames}原生24fps采样帧。所有帧与原生导出逐像素复核：alpha不变，RGB差异只来自规定shift（最大2/255），码本还原误差0。9套皮肤的底图均由a=255原色码字输出，palette保留但不改色。`, '',
`挂件逐原生帧检查共${attachments.frameSkinTests}个皮肤/帧组合，最大可见alpha面积比 ${(attachments.maxRatio*100).toFixed(4)}%，超限0；三形态因同源同比例缩放，面积比不变。保留原挂件/特效PNG及ID、类型、层级、anchor和全部特效参数；定位offset及63套超限组的displaySize展示适配已经单独记录。`, '',
'### 最终18家族', '', '|岛屿|零氪|轻氪|重氪|','|---|---|---|---|',table,'',
'18个baseFamily去重通过；assets/actors占用家族及其_1版本全部避开。julongzisi只用于本地回归对照，不在最终资源或18家族生产数组内。', '',
'### 体积结论', '',
`整个 apps/web/public/art/starsea/pets/v3 实际 **${bytes}字节 = ${(bytes/1e6).toFixed(3)}MB = ${(bytes/1048576).toFixed(3)}MiB**。50MB目标**未达标**。已依次实行三形态共享、符合清晰度下限的9族192物理格、额外无损索引重排；继续降低其余族分辨率会低于referencePixelHeight≥1.3×最大显示高度条件。依第6节“仍超则记录实际体积，不算阻塞”保留此实测结果，没有伪称达标、删动作或进一步有损降精度。`, '',
'### 最终裁决与实现说明', '',
'- SkeletonBinary.ts由typescript在内存中转译，保留许可注释；无编译产物写入工具目录。与样板再次回归仍为163帧、挂点误差0px。',
'- 原库个别touying区域名有尾随空格，加载器仅在查找失败时trim匹配；源skel/atlas/png未改动。',
'- composer.js逐字节不变，实际字节协议仍为RG16索引＋B8覆盖率、码字首字节255原色输出。样板描述字符串中误写的RGB24已纠正为实际协议名，不是运行格式升级。',
'- 192物理格在256逻辑格内虚拟补32px，spriteSourceSize/anchor/sockets同步平移；不存储透明补边，因此无需改合成器。',
'- 目视检查后将雾铃小蛛徽记上移到身体侧面，避免原偏移落到足下；尾饰按收缩后的尺寸对准尾根。',
'- 预览网格按全部动作和挂件实际范围扩大为340×300，三列按同流派的零/轻/重排列；统一位置不裁切动作或遮住标签。形态下拉去掉旧44/56/68数字，每格显示真实高度。',
'- 原生地影/嵌入效果已隐藏。验收同排图上的部分蓝色光盘来自按要求保留的skins.effects；18张裸模型动作图不叠这些皮肤效果。',
'- 8626原只读静态进程曾退出，按既有web-public-static命令恢复同一静态根目录；未访问或修改8612/8790正式写接口。', '',
'### 本地验收文件', '',
'根目录：G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/.design/pet-sp33-rollout/', '',
'- candidates-wind/mist/forge/frost/dragon/star.png：每岛每档2候选，1×与2×，含主角/巡猎兽。',
'- acceptance-wind/mist/forge/frost/dragon/star.png：每岛三档×三形态，主角/巡猎兽，1×与2×。',
'- skins81-wind/mist/forge/frost/dragon/star.png：每岛27皮肤×3形态，共486实例。',
'- all-162.png：全部162皮肤幼年1×总览。',
'- actions-<island>-<tier>.png：18族各五动作×六帧及五挂点。',
'- preview-8626.png、preview-mirrored-8626.png：最终可视Chrome预览。',
'- pa4-validation.json、final-audit.json、attachment-audit.json、size.json：原始检查明细，仅本地。', '',
'### 第8节完成定义', '',
'- [x] 工具配置化；岚鳞样板回归帧数一致、挂点0px误差、全量验证通过。',
'- [x] 18家族选定、去重、避开占用和禁用生物，理由与表格已登记。',
'- [x] 54形态全部SP33原生帧，三档尺寸为44/56/68、48/62/74、54/70/84。',
'- [x] 三形态共用一套资源；体积超目标，已按明确默认裁决记录。',
'- [x] 162个skins.family更新；挂件位置、面积及镜像检查通过。',
'- [x] pa4.validate() 2430/2430，镜像误差0、无空帧、无控制台错误。',
'- [x] 六岛同排、162总览、486实例对比、18族动作抽查图齐全。',
'- [x] 进度文件包含批次开始/完成、选型、隐藏规则、裁决与最终数字。', '',
'状态：六批全部完成（含第6节体积超限记录例外），非硬阻塞。模型资源已替换；最终动作映射抽查与游戏接入仍由Claude负责。未做玩法、强度、价格、数据库或合同版本修改，未git commit。', ''
].join('\n');
let log=await readFile(join(root,'docs/pets/pa6-progress.md'),'utf8');const marker='\n## 第6批：完成';if(log.includes(marker))log=log.slice(0,log.indexOf(marker));await writeFile(join(root,'docs/pets/pa6-progress.md'),log+'\n'+completion);await json(join(evidence,'completion.json'),{complete:true,families:18,runtimes:54,skins:162,frames:audit.logicalFrames,runtimeBytes:bytes,under50MB:bytes<=50000000,sizeExceptionRecorded:true,validation:validation.cases,mirrorError:validation.maxMirrorError,consoleErrors:validation.consoleErrors.length,maxAttachmentRatio:attachments.maxRatio,preview:validation.url});console.log('COMPLETE',bytes,validation.cases,attachments.maxRatio);
