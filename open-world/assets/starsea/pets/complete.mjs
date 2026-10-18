import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {group,out,root,json,record} from './pipeline.mjs';
import {pets,forms} from './definitions.mjs';
const manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8'));
if(manifest.assets.length!==30)throw Error('Need all 30 assets');
const live=JSON.parse(await readFile(join(group,'evidence/live-playback-validation.json'),'utf8'));
const browser=JSON.parse(await readFile(join(group,'evidence/final-browser-check.json'),'utf8'));
const movement=JSON.parse(await readFile(join(group,'evidence/locomotion-validation.json'),'utf8'));
if(!live.pass||browser.errors.length||!movement.pass)throw Error('Review evidence not passed');
for(const a of manifest.assets){
 const p=a.runtime;
 for(const [key,clip] of Object.entries(p.actions)){if(p.family==='C4'&&p.stage==='e'&&key==='move'){clip.containsBuiltInEffects=true;clip.builtInEffectSlots=['guaiC4e/01','guaiC4e/1'];clip.effectNote='含内置特效：原生双臂喷焰，保留原始附件显隐和运动';}}
 a.actions=p.actions;a.states.skill=p.actions.skill?'skill':'无';a.states.knock=p.actions.knock?'knock':'无';a.states.idle2=p.actions.idle2?'idle2':'无';
 a.notes.missingActions=['idle','idle2','move','attack','knock','skill'].filter(k=>!p.actions[k]);a.notes.reviewScope='PA1 model resources only; not gameplay acceptance';a.notes.worldMovement='Use calibrated stride when integrating locomotion; no following AI implemented';
 await json(join(out,a.id,'profile.json'),p);a.files[a.files.findIndex(f=>f.path.endsWith('/profile.json'))]=await record(join(out,a.id,'profile.json'));
}
manifest.assets.sort((a,b)=>pets.findIndex(p=>'ss-pet-'+p.key+'-'===a.id.slice(0,a.id.lastIndexOf(a.runtime.form)))-pets.findIndex(p=>'ss-pet-'+p.key+'-'===b.id.slice(0,b.id.lastIndexOf(b.runtime.form)))||forms.findIndex(f=>f.key===a.runtime.form)-forms.findIndex(f=>f.key===b.runtime.form));
manifest.preview={path:'assets/starsea/pets/preview/index.html',runtime:'/art/starsea/pets/preview/index.html',heroSources:['/art/mini-hero/navy/profile.json','/art/mini-hero/navy/Character.json','/art/mini-hero/navy/Character.atlas'],launch:'node assets/starsea/pets/serve-preview.mjs'};
await json(join(group,'manifest.json'),manifest);await json(join(out,'manifest.json'),manifest);
await import('./verify.mjs');
const validation=JSON.parse(await readFile(join(group,'evidence/validation.json'),'utf8'));
if(!validation.pass||validation.assets!==30)throw Error('Final verification failed');
for(const a of manifest.assets){a.status='producer-reviewed';a.notes.rootAcceptance='passed PA1 model-resource scope; recorded in report.md';const path=join(group,'evidence',a.id+'-diagnostics.json'),d=JSON.parse(await readFile(path,'utf8')),v=validation.results.find(v=>v.id===a.id);d.actualIdleHeight=v.actualIdleHeight;d.actualIdleFirstFrameHeight=JSON.parse(await readFile(join(out,a.id,'actor.json'),'utf8')).frames.idle_0.spriteSourceSize.h*a.runtime.scale;d.referenceHeight=a.runtime.referenceHeight;d.status='producer-reviewed';d.finalValidation=v;d.locomotion=movement.results.find(r=>r.id===a.id);await json(path,d);}
await json(join(group,'manifest.json'),manifest);await json(join(out,'manifest.json'),manifest);
const max=(key)=>Math.max(...validation.results.map(r=>r[key])),maxSlip=Math.max(...movement.results.map(r=>r.maxHorizontalContactSlipPx));
const actionCount=manifest.assets.reduce((s,a)=>s+Object.keys(a.actions).length,0),fits=manifest.assets.flatMap(a=>Object.entries(a.actions).filter(([k,c])=>c.bakedPresentationScale<1).map(([key,c])=>({id:a.id,key,scale:c.bakedPresentationScale})));
const familyRows=pets.map(p=>`| ${p.island} | ${p.name} | ${p.family} | a / c / e | b / d | 44 / 56 / 68 |`).join('\n');
const actionRows=pets.flatMap(p=>forms.map(f=>{const a=manifest.assets.find(a=>a.id===`ss-pet-${p.key}-${f.key}`);return `| ${p.name} ${f.label} (${p.family}${f.stage}) | ${['idle','idle2','move','attack','knock','skill'].map(k=>a.actions[k]?a.actions[k].count+' 帧'+(a.actions[k].containsBuiltInEffects?'，含内置特效':''):'无').join(' | ')} |`;})).join('\n');
const decisions=await readFile(join(group,'decisions.md'),'utf8'),candidateTable=decisions.slice(decisions.indexOf('| 家族 |'),decisions.indexOf('\n六只均取'));
const report=`# PA1 宠物模型资源交付报告

日期：2026-10-17（Asia/Shanghai）。唯一需求依据：\`docs/pets/pet-modeling-requirements.md\`。状态：资源制作与自检完成（producer-reviewed），主代理 PA1 模型资源验收通过；未接入玩法。

## 交付结果

- 17 家族 × 五阶＝85 个原生 Spine 3.6 idle 首帧拼装预览，全部成功；不是零件 PNG 预览。
- 六岛各一只，家族互不重复；18 个成长形态 + 12 个外观，共 30 套。${actionCount} 段原生动作，${validation.totalFrames} 帧。
- 每套：\`actor.png\`、\`actor.json\`、\`sockets.json\`、\`profile.json\`；30fps，逻辑帧 256×256，透明裁边打包，格式沿用怪物 TexturePacker 风格。
- 局部清单：\`assets/starsea/pets/manifest.json\`；全部 type=pet，30 条完整来源、文件哈希、骨骼/槽位、调色参数和动作 provenance。
- 工作源码与记录只在 \`assets/starsea/pets/\`；运行资源只在 \`apps/web/public/art/starsea/pets/\`。证据和大图在本地 evidence/，由本组 .gitignore 排除。未 git commit。

## 家族与阶段

| 岛屿 | 模型名 | 家族 | 幼年 / 成年 / 觉醒 | 两个外观 | 成长显示高度 px |
| --- | --- | --- | --- | --- | --- |
${familyRows}

b/d 为对应阶整套原生外观缩到 44px，保留原配色与原生动作，未拼接不同阶骨骼或拿静态图冒充换皮。没有新增挂件贴图；accessory 点保留给后续装饰。

## 85 格拼装总表与候选理由

![17 家族五阶原生拼装](evidence/candidate-contact-sheet.png)

逐项原始路径、版本、骨骼、槽位、相机与首帧像素边界见 \`evidence/candidates.json\`。可复现命令：\`node assets/starsea/pets/candidates.mjs\`。

${candidateTable}

## 动作齐全表

所有已导出动作 provenance 均为 \`complete original native animation\`。idle←std、idle2←std2、move←walk、attack←atk、knock←jifei。下表数字是完整动作帧数，不是不同静态姿态数。

| 模型 / 阶段 | idle | idle2 | move | attack | knock | skill |
| --- | --- | --- | --- | --- | --- | --- |
${actionRows}

C8d 缺 jifei，按 §8 记「无」；全部所选基础阶无 skill。C4e 的 move 保留原生喷焰槽 guaiC4e/01、guaiC4e/1，明确标「含内置特效」。未从 ds/es 借用动作。

## 尺寸、挂点与移动验收

- 30/30 套、${validation.totalFrames}/${validation.totalFrames} 帧通过：像素非空，逻辑格四周至少 2px，打包区域不越界；每段至少 3 个不同的实际像素帧。
- 44/56/68px 是完整 idle 的实际 alpha>3 垂直包络，不按透明画布。单帧会因呼吸/跳动小于包络值。ground 固定于 idle 首帧脚底；成长高度严格递增；外观均 44px。
- 每段动作的垂直边界、相对 ground 的最高/最低距离都 ≤75px。实测最大单动作垂直包络 ${max('maxActionVerticalHeight').toFixed(3)}px。75% 按角色垂直高度理解；横向攻击/尾巴跨度和位移完整保留，不能声称横向也 ≤75px。
- ${fits.length} 段因跳起/旋转超过限高而采用整段固定等比相机缩放，已烘入帧和挂点。最小比例 ${Math.min(...fits.map(f=>f.scale)).toFixed(4)}。不改源骨骼时序，不逐帧缩放；动作切换会有可见体型变化。每段 \`bakedPresentationScale\` 与 \`displayBounds\` 可查；运行时只需 profile.scale。
- ground/body/head/emit/accessory 每个已导出动作每一帧齐全；body/head/emit/accessory 由真实骨骼局部坐标逐帧转换，rest 标准比例跨成长一致。D1 没有明显嘴部，用正面中心偏上。绑定骨骼名逐套记录于 sockets.bindings。
- 镜像围绕 anchor.x；数值镜像最大误差 ${max('mirrorError').toExponential(3)} 逻辑像素，可视预览检查原生和镜像、五点叠加、b/d 切换。
- 原生大位移保留在帧中，逐帧 \`nativeDisplacement\` 记录 scale 骨骼相对 idle 的位移；完整原始骨骼矩阵留在 evidence/*-frames.json。
- 移动倍率实测 1.0、1.3、1.6。固定 ground 的每套每倍率采样 600 次；有足 IK 的模型从低位后移支撑段标定步幅，最大水平支撑残差 ${maxSlip.toFixed(3)}px/原生采样间隔，预览显示同步地面刻度。它是模型播放数据，不是跟随 AI；任意外部世界移动速度仍须与步幅同步，不能把此验收扩大为任意速度都不滑脚。
- 无足绒团/软泥、振翅悬浮鸟和轮式幼体保留原生移动；无支撑脚的项目不伪造足骨，也不把“0 个支撑段”当作实体脚零滑移。建议播放范围 1.0–1.6；更高倍率未验收。
- 30 套源 JSON / atlas / 所引用 PNG / .spine 的绝对路径及 SHA-256 均核对；所有输出文件 SHA-256 核对通过。原始 Spine 版本为 3.6.51/3.6.52，以单条来源字段为准。新挂件来源均为“无新增”。

## 可视预览与证据

预览入口：\`assets/starsea/pets/preview/index.html\`，发布副本 \`/art/starsea/pets/preview/index.html\`。启动：\`node assets/starsea/pets/serve-preview.mjs\`（独立只读临时端口，打开可视 Chrome）。

主角直接读取现有 \`/art/mini-hero/navy/profile.json\`、Character.json / atlas / 纹理与正式皮肤。宠物由交付图集播放；可切动作、b/d、1.0/1.3/1.6 倍速、镜像、五点、暂停和 2×检视。缺动作明确显示“无”。

![实际像素并排预览](evidence/final-overview.png)

- \`evidence/final-overview.png\`：主角 + 6×3 成长形态。
- \`evidence/final-idle2.png\`、\`final-move.png\`、\`final-attack.png\`、\`final-knock.png\`、\`final-skill.png\`：动作与缺项。
- \`evidence/final-mirrored-young.png\`、\`final-mirrored-variant-b.png\`、\`final-mirrored-variant-d.png\`：镜像与挂点/外观。
- \`evidence/live-playback-validation.json\`：可视 Chrome 真实连续播放，3 倍率 × 3 外观组合，每次 18 个精灵至少出现 8 个不同帧，覆盖全部 30 套。
- \`evidence/validation.json\`：逐帧边界/像素/挂点/来源哈希/尺寸复核。
- \`evidence/locomotion-validation.json\`：原生足 IK 支撑段及步幅/残差。
- \`evidence/final-browser-check.json\`：9 个动作/镜像外观状态，控制台错误 0。
- 导出硬件：可视 Chrome，headless:false，ANGLE / NVIDIA GeForce RTX 4070 SUPER / Direct3D11；检测到 SwiftShader/软件渲染即失败。所有导出/渲染/预览任务串行。

## 未覆盖项与已知限制

| 项目 | 状态 |
| --- | --- |
| 出场 / 收回 / 抚摸 | 程序演出，待做；未伪造源动作 |
| 连携技动作 | 由 Claude 亲手做，本批不制作 |
| 跟随 AI / 连携规则 / 数值 / 游戏界面 / 付费 | 未做 |
| 公共 manifest / 生产绑定 / contracts / 数据库 | 未修改；本批只登记宠物局部 manifest |
| 8612 / 8790 / 现有服务 | 未访问、未重启 |
| 公共游戏运行接入 | 未验收；不能把资源通过等同玩法上线 |

岛屿调色只用 Spine 原生 slot color 与 darkColor，贴图、UV 和轮廓不重画；原生局部固有色仍可见，尤其羽鸟羽片和鳍龙末阶的暖色/紫色纹理。小体量下保留原生明暗可读性优先，不以重绘强行统一色相。完整原生技能缺项、片段尺度差异和外部移动步幅同步要求均如上列出。

## 复现与恢复

在 open-world 目录执行（重任务必须等上一条结束）：

\`node assets/starsea/pets/candidates.mjs\`

\`node assets/starsea/pets/export.mjs --pets=wind --forms=young,adult,awakened,variant-b,variant-d\`

\`node assets/starsea/pets/export.mjs --pets=mist,forge,frost,dragon,star --forms=young,adult,awakened\`

\`node assets/starsea/pets/export.mjs --pets=mist,forge,frost,dragon,star --forms=variant-b,variant-d\`

\`node assets/starsea/pets/calibrate.mjs\`

\`node assets/starsea/pets/locomotion-check.mjs\`

\`node assets/starsea/pets/preview-check.mjs\`

\`node assets/starsea/pets/complete.mjs\`

export 每套完成后写局部清单，可按 --pets/--forms 单独重做。源码、选型与调色配置均在本组目录。progress / decisions / report 各自小于 200KB。无 §9 硬阻塞。
`;
await writeFile(join(group,'report.md'),report);
await writeFile(join(group,'progress.md'),`# PA1 进度\n\n状态：全部模型资源制作与本组自检完成。日期：2026-10-17（Asia/Shanghai）。\n\n- [x] ① 17 家族 × 五阶原生 idle 首帧拼装总表，85/85。\n- [x] ② 六岛六家族已确定；17 家族选/不选理由在 decisions.md 与 report.md。\n- [x] ③ 风栖三成长 + 两变体先完成图集与可视样板检查。\n- [x] ④ 其余五只三形态，成长总数 18/18。\n- [x] ⑤ 十二个 b/d 外观，12/12。\n- [x] ⑥ 30 套、${validation.totalFrames} 帧、${actionCount} 段动作自检；并排预览、镜像、真实连续播放与截图齐全。\n- [x] ⑦ report.md 完成，包含阶段/动作表、缺项、来源、边界、复现命令和限制。\n\n最终：manifest.json 的 30 条 type=pet，status=producer-reviewed。C8d 缺 knock、全体无 skill，按默认裁定记“无”。出场/收回/抚摸为“程序演出，待做”；连携动作留给 Claude。\n\n范围：只写宠物两个目录，未触碰正式服务、公共 manifest、玩法/版本/数据库，未 git commit。evidence/ 仅本地。\n\n复核入口：report.md；复现入口：export.mjs、calibrate.mjs、locomotion-check.mjs、preview-check.mjs、complete.mjs。可视预览：node assets/starsea/pets/serve-preview.mjs。\n`);
for(const name of ['progress.md','decisions.md','report.md'])if((await stat(join(group,name))).size>200*1024)throw Error(name+' too large');
console.log('COMPLETE',manifest.assets.length,'assets',actionCount,'clips',validation.totalFrames,'frames');
