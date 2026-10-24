import {writeFile,readFile} from 'node:fs/promises';
import {versions} from '../../packages/contracts/index.ts';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {pacingBuildTargets} from '../../packages/content/pacing-targets.ts';
import {spineScenes} from './math.ts';
import {knobPath} from '../pacing/derive-model.ts';
import {get} from './content.ts';
import {readJson,save,review as defaultReview,data,stamp,evidence,decision} from './io.ts';
const review=process.argv.find(a=>a.startsWith('--review='))?.slice(9)??defaultReview;
const optional=async(path:string)=>readJson(path).catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;return null;});
const finalSource=await optional(data+'/spine-final-validation.json'),V3=review+(finalSource?'/S8/final-validation':'/S7/V3'),worldPointer=await optional(data+'/spine-world-source.json'),worldPath=(worldPointer?.summary??defaultReview+'/S7/correction-2/world/world-summary.json').replace(defaultReview,review);
const validation=await readJson(V3+'/validation.json'),initial=await readJson(review+'/S2/audit-summary.json'),current=await readJson(V3+'/budget/audit-summary.json'),baseline=await readJson(review+'/S2/core-summary.json'),player=await readJson(data+'/spine-player.json'),initialPlayer=await readJson(review+'/S5/player-summary.json'),world=await readJson(worldPath),correction2=await readJson(review+'/S7/correction-2/correction-summary.json'),knobs=await readJson(data+'/build-knobs.json'),solver=(await optional(review+'/S8/measurement-repair/rebased/elasticities-summary.json'))??await readJson(review+'/S4/elasticities-summary.json'),s2Targets=await readJson('config/json/spine-targets.json'),lock=await readJson('tools/spine/data/spine-anchor.json');
const regression=await optional(review+'/S8/final-isolated-tests/test-result.json'),buildResult=await optional(review+'/S8/final-isolated-build/build.json'),commitRecord=await optional(review+'/S9/commit.json'),stability=await optional(review+'/S8/measurement-repair/continuity-summary.json'),bossRepair=await optional(review+'/S8/runtime-repair/campaign-bosses-summary.json');
const pressureVerification=await optional(review+'/S8/runtime-repair/world/final-pressure-summary.json');
const finalCheck=await optional(review+'/S9/check-summary.json');
const regressionCalendars=[];for(const strategy of ['no-quests','attempt-all-tasks']){const path=review+'/S8/final-isolated-tests/natural/natural-calendar-'+strategy+'.json',raw=await optional(path);for(const r of raw?.results??[])regressionCalendars.push({run:'最终隔离回归',strategy:r.strategy,seed:raw.seed,minutes:r.minutes,level:r.level,failures:r.failures,bosses:r.bosses,source:await evidence(path)});}
const previousCalendars=await optional(review+'/S8/final-isolated-attempt1-calendar-summary.json');if(previousCalendars)for(const r of previousCalendars.rows)regressionCalendars.push({...r,source:await evidence(review+'/S8/final-isolated-attempt1-calendar-summary.json')});
const budgetSources={content:await evidence(review+'/S8/measurement-repair/validation-budget/budget/content-measurements.json'),elite:await evidence(review+'/S8/elite-audit-correction/elite-budget-summary.json'),audit:await evidence(V3+'/budget/audit-summary.json')};
const regressionLog=await readFile(review+'/S8/final-isolated-tests/tests.log','utf8').catch(()=>''),regressionBlocks=regressionLog.replace(/\u001b\[[0-9;]*m/g,'').split(/\r?\n Test Files\s+/).slice(1).map(s=>{const files=s.split(/\r?\n/)[0],tests=s.match(/^\s+Tests\s+([^\r\n]+)/m)?.[1]??'',n=(v:string,kind:string)=>Number(v.match(new RegExp('(\\d+) '+kind))?.[1]??0);return {filesPassed:n(files,'passed'),filesFailed:n(files,'failed'),passed:n(tests,'passed'),failed:n(tests,'failed'),skipped:n(tests,'skipped')};});
const regressionComplete=regression?.passed&&buildResult?.passed,status=regressionComplete?(commitRecord?.status==='完成但数值有残差'?'完成但数值有残差':'回归与构建完成，提交留档中'):'收尾进行中；最终回归/构建尚未全部完成';
const fmt=(v:number|null|undefined,d=3)=>v===null||v===undefined?'未测':Number(v).toFixed(d),pct=(v:number|null|undefined,d=1)=>v===null||v===undefined?'未知':(v*100).toFixed(d)+'%';
const sceneName={single:'单体',clear:'清怪',elite:'精英',survival:'生存',safety:'安全'} as Record<string,string>,baselineCounts=initial.counts,finalCounts=current.counts;
const profileTable=validation.builds.matrix.map((r:any)=>{const target=pacingBuildTargets.find(t=>t.id===r.build)!;return '| '+r.build+' | '+spineScenes.map(s=>r.ratios[s]===null?'失败/未知':fmt(r.ratios[s],3)+' / '+fmt(target[s],3)+' ('+pct(r.cells.find((c:any)=>c.scene===s).error)+')').join(' | ')+' | '+fmt(r.budget)+' |';}).join('\n');
const gateTable=Object.entries(validation.checks).map(([key,value])=>'| '+key+' | '+(value?'通过':'未通过')+' | '+String((validation as any)[key]?.count??(validation as any)[key]?.rows?.length??'—')+' |').join('\n');
const wallTable=validation.walls.map((r:any)=>'| '+r.id+' | L'+r.level+' | '+r.target+' | '+fmt(r.actual,2)+' | '+pct(r.error)+' | '+pct(r.winRate)+' |').join('\n');
const fieldTable=validation.field.rows.map((r:any)=>'| L'+r.level+' | '+r.rank+' | '+(r.pressure?'TTD':'TTK')+' | '+fmt(r.actual,2)+' | '+fmt(r.target,2)+' | '+(r.error===null?(r.censored?'删失，下界≥实测窗口':'未测'):pct(r.error))+' |').join('\n');
const calendar=validation.calendar,calendarRows=calendar.rows.map((r:any)=>'| '+r.seed+' | '+r.level+' | '+fmt(r.minutes,2)+' | '+((r.minutes??0)>300?'超过300分钟上限':r.failures?.length?'有失败':'—')+' |').join('\n'),milestoneRows=calendar.milestones.map((r:any)=>'| L'+r.level+' | '+fmt(r.target,2)+' | '+fmt(r.actual,2)+' | '+pct(r.actual===null?null:r.actual/r.target-1)+' |').join('\n');
const currentGroups:Record<string,any[]>={};for(const row of current.rows) (currentGroups[row.category]??=[]).push(row);const distribution=Object.entries(currentGroups).map(([category,rows])=>{const xs=rows.filter(r=>!r.functional&&r.center>0&&r.observed>0).map(r=>r.observed/r.center),negative=rows.filter(r=>!r.functional&&r.observed<0).length,unknown=rows.filter(r=>r.error===null&&!r.functional).length;return '| '+category+' | '+rows.length+' | '+rows.filter(r=>r.functional).length+' | '+negative+' | '+unknown+' | '+rows.filter(r=>!r.inBand).length+' | '+(xs.length?fmt(Math.min(...xs),2)+'–'+fmt(Math.max(...xs),2):'—')+' |';}).join('\n');
const outside=current.rows.filter((r:any)=>!r.inBand),todo=outside.map((r:any)=>'| '+r.category+' | '+r.id+' | '+r.host+' | '+fmt(r.observed,5)+' | '+fmt(r.center,5)+' | '+(r.error===null?'未定义正预算比':pct(r.error,2))+' | '+(r.reason??(r.functional?'窗口影响<1%':r.elasticity===null?'缺实测弹性':r.elasticity===0?'实测弹性为零':r.functional?'功能型':'未越界'))+' |').join('\n');
const coverage=(solver.coverage??[]).map((b:any)=>'| '+b.build+' | '+spineScenes.map(s=>b.scenes[s]?.length?'有':'无').join(' | ')+' |').join('\n');
const curveRows=(player.points as any[]).map(p=>{const old=initialPlayer.points.find((v:any)=>v.level===p.level);return '| L'+p.level+' | '+fmt(old?.D1,1)+' | '+fmt(p.D1,1)+' | '+fmt(p.DN,1)+' | '+fmt(p.EHP,1)+' | '+fmt(p.AV,4)+' |';}).join('\n');
const weights=(await readJson(data+'/stat-weights.json')).rows,weightRows=weights.filter((r:any)=>r.level===20).sort((a:any,b:any)=>Math.abs(b.powerWeight)-Math.abs(a.powerWeight)).slice(0,12).map((r:any)=>'| '+r.stat+' | L20 | '+fmt(r.delta,3)+' | '+fmt(r.powerWeight,5)+' | '+(r.deltaSource??'S2配对World扰动')+' |').join('\n');
const monsterLines=(await readJson(review+'/S5/monster-summary.json')).lines,curveTable=[...new Set(monsterLines.map((r:any)=>r.family))].map((family:any)=>{const rows=monsterLines.filter((r:any)=>r.family===family),a=rows[0],b=rows.at(-1);return '| '+family+' | L'+a.level+' '+fmt(a.beforeHp,0)+'→'+fmt(a.hp,0)+' / '+fmt(a.beforeAttack,0)+'→'+fmt(a.attack,0)+' | L'+b.level+' '+fmt(b.beforeHp,0)+'→'+fmt(b.hp,0)+' / '+fmt(b.beforeAttack,0)+'→'+fmt(b.attack,0)+' | '+rows.filter((r:any)=>r.smoothed).length+' |';}).join('\n');
const finalRanks=(await readJson('packages/content/monsters.json')).ranks;
const oneHit=validation.field.oneHitRows.flatMap((r:any)=>r.targets.map((t:any)=>({level:r.level,seed:r.seed,camp:r.camp,skill:r.skill,...t}))),oneHitMiss=oneHit.filter((r:any)=>!r.passed).map((r:any)=>'| L'+r.level+' | '+r.seed+' | '+r.camp+' | '+r.hp+' | '+(r.hit??'未命中')+' | '+(r.hit===null?'没有观察到非暴击直接命中':'未达到一击线')+' |').join('\n');
const sourceStamp={...stamp(),anchor:lock.anchor,sourceEngine:player.engineSha256,sourceBench:player.benchSha256,sourcefiles:{anchor:await evidence(data+'/spine-anchor.json'),player:await evidence(data+'/spine-player.json'),weights:await evidence(data+'/stat-weights.json'),world:await evidence(worldPath),V3:await evidence(V3+'/validation.json')}};
const standard50=player.points.find((p:any)=>p.level===50),sigma=Object.fromEntries(['D1','DN','B3','EHP','AV'].map(k=>[k,medianHelper(validation.builds.metrics.map((p:any)=>p[k]))/standard50[k]]));
const acceptance=(validation.accepted?'六套件全部通过':finalSource?'六套件结果齐备；受影响项重跑，原三种子日程经依赖核验复用；仍有未通过项':'六套件均已运行；按证据保留未通过项及其约束残差');
const report=`# 数值主干验收报告（${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})}）

状态：**${status}**。${acceptance}。原V1/V2/V3及两轮修正记录保留；用户随后授权修复测量定义并复核受影响结果。没有新增牛顿或自由调参轮次。S8另修复了旧区首领预算遗漏、地城压力漏算随从两处实现错误。实际提交见S9/commit.json。

## 目标与数据边界

主干按“用户目标 → 有限窗口World测量 → 实测价值/内容预算 → 构筑求解 → 怪物与层级 → 进度与掉率 → V1/V2/V3 → 回归”运行。正式锚点为D1=${fmt(lock.anchor.D1,3)}、DN=${fmt(lock.anchor.DN,3)}、B3=${fmt(lock.anchor.B3,3)}、EHP=${fmt(lock.anchor.EHP,3)}、AV=${fmt(lock.anchor.AV,6)}、r50=${fmt(lock.anchor.r50,3)}；标准人和参考构筑用41/42/43，内容宿主用41，首领墙另用5种子。每格的输入签名、原始World路径及SHA256保留在本机arms目录；代码变更前后的样本没有合并。

测量限制：M2木桩生命为1e15（原1e9在高阶标准人下会耗尽）；无失血时EHP采用有限窗口容量，原式删失标志仍保留；AV参考压力较低，后期饱和为1。原B3定义是前三秒总伤害/3，单位实现原本正确。修复针对第90帧命中被一帧延迟移出窗口：v2用于求解的B3在最后1秒线性结算，按2.5秒有效面积归一；原始3秒DPS另存为rawWindowDps。519组S2冻结输入、82个S4冻结扰动的原始B3逐值一致，只有统计定义改变。

原有标准人50/先手构筑的2%断言未放宽，已通过；扩展到13等级点和8构筑后仍有${stability?.failures.length??0}格真实施法、选敌、移动及护盾时序敏感性，最大${pct(stability?.maximum)}。这些不能冒称全局连续；超限构筑轴已被禁止继续进入牛顿求解。删除整次施法的真实损失也未被压成小于2%。完整残差见numeric-todo。

除B3外，S2锚点全部保持不变。B3由${fmt(lock.originalAnchor?.B3??lock.anchor.B3,3)}换算为${fmt(lock.anchor.B3,3)}，使用原S2的8个冻结构筑输入，没有重新挑选基准；原始B3复现值逐项相等。

配置导出的主干目标表有${s2Targets.targets.length}行。${s2Targets.targets.filter((r:any)=>r.locked).length}行用户目标保持锁定。本报告固定数值基线${versions.rules}、protocol ${versions.protocol}、client ${versions.client}、DB ${versions.db}；共享工作区同期制作迁移的ow-72/protocol36/db17保留，未混入本期提交。隔离副本保留起点已有改动，803组战斗输入与重测证据完全一致。早期V1/V2与V3预算口径不同，未合并成连续时间序列。

## 标准人与属性权重

| 等级 | 初始D1 | 最终D1 | 最终DN | 最终EHP | 最终AV |
|---:|---:|---:|---:|---:|---:|
${curveRows}

| 属性 | 等级 | 中位扰动 | 每单位ΔP | 来源 |
|---|---:|---:|---:|---|
${weightRows}

上表每级的标准人D1/DN/EHP/AV是在13个真实等级点上的三种子中位数。L20/35/50有207项标准属性配对扰动；公式从同等级中位词缀/主属性量级计算每单位对数力量权重。平价测量使用同档真实法杖、暗器装备及正确的技能、亲和与套装。最终最大/最小D1差如下：

| 等级 | 剑、法杖、暗器D1 | 相对差 | ≤15% |
|---:|---|---:|---|
${validation.budget.parity.map((r:any)=>'| '+r.level+' | '+r.values.map((v:any)=>v.family+': '+fmt(v.D1,1)).join('；')+' | '+pct(r.gap)+' | '+(r.passed?'是':'否')+' |').join('\n')}

8个参考构筑中位数/标准人L50的σ为：${Object.entries(sigma).map(([k,v])=>k+'='+fmt(v as number,6)).join('，')}。D1/DN/B3远小于1，说明受控构筑配置与SCHEDULE全养成标准人的投入口径差异很大；测量台相对预算不能当成终局通关保证。本期没有暗中补充参考构筑投入来掩盖差异。

## 内容预算与归一

S2初始内容宿主有${initial.counts.all}项，按原初次报告的绝对值口径有${initial.counts.outside}项超带。原V3修复有符号P、宿主与功能技能对照后有139项超带。本次再按B3 v2口径复核${finalCounts.all}项：${finalCounts.functional}项在窗口内未观察到超过1%的影响，${finalCounts.numericOutside??finalCounts.outside}项实测越界，另${finalCounts.unknown??0}项缺少可判定观测；内容数值没有因这次预算复核再次归一。S2与后续审计不可直接同比，不能据此声称归一改善幅度。

| 类别 | 总数 | 功能型 | 负净P | 无法换算 | 未通过 | 正预算比范围 |
|---|---:|---:|---:|---:|---:|---|
${distribution}

词条/套装/铭文按实际宿主World加入或移除；非伤害技能按宿主构筑加入/移除；内容价格从同档中位数与三种子实测弹性闭式推导，弹性为零或符号跨零的条目不会通过除零/绝对值补出正预算。词缀和主属性按实测属性权重×数值定价，精英词缀沿用实测TTD降低比例。归一计划应用183处差量；另同步盾/疗功能分类与机制说明。S4后没有增删机制或旋钮。

## 构筑验收与机制

| 构筑 | 单体 实测/目标(偏差) | 清怪 实测/目标(偏差) | 精英 实测/目标(偏差) | 生存 实测/目标(偏差) | 安全 实测/目标(偏差) | 预算 |
|---|---|---|---|---|---|---:|
${profileTable}

| 构筑 | 单体 | 清怪 | 精英 | 生存 | 安全 |
|---|---|---|---|---|---|
${coverage}

历史S4三步牛顿及两轮各两步修正均使用当时的实测矩阵，边界夹紧且单步不超过范围50%。本次只复核同一S4冻结扰动的弹性和专用性，追加牛顿0步。当前只有${validation.builds.budgets}/8构筑预算落在1.0±5%，${validation.builds.scenePass}/40场景格进入容差，正式场景矩阵与V3逐值相等。未触发机制、超带及失败样本不删除；当前失败样本${validation.builds.failed.length}条。

## 怪物、地城与层级

| 曲线族 | 低等级HP/攻击（前→后） | 高等级HP/攻击（前→后） | 单调整数投影点数 |
|---|---|---|---:|
${curveTable}

曲线关系维持模板相对值后按S5一刀线整数化，并对相邻点作后缀最小HP投影；生命小于整数最小表达时会出现多个相同小整数，所以一些早期普通怪或不同模版的展示生命相同。攻击按标准人有效生命、三次/秒参考节奏和用户TTD反推。精英/稀有/首领档位以等级中位TTK比乘D1组预算，故生命档位小于1也保留。所有模板和内容身份仍在。

S5实测野外效率η的五个等级为${(await readJson(review+'/S5/efficiency-summary.json')).field.map((r:any)=>'L'+r.level+': '+fmt(r.eta,4)).join('，')}；六个故事首领η为${fmt(medianHelper((await readJson(review+'/S5/efficiency-summary.json')).boss.map((r:any)=>r.eta)),4)}中位数。S7按六故事首领各五种子，胜率均为${pct(Math.min(...validation.walls.map((r:any)=>r.winRate)))}以上；首领击杀时间范围${fmt(Math.min(...validation.walls.map((r:any)=>r.actual)),2)}–${fmt(Math.max(...validation.walls.map((r:any)=>r.actual)),2)}秒，逐个目标和误差见下表。

S8定位到原推导只测首领、却把攻击系数施加给全房间的错误：沉星密仓目标733原始伤害/秒，完整终局房间实际约55301.8。现使用首领及随从的完整30秒压力，53个房间闭式推导一次；沉星密仓攻击系数2005.9→26.6，裂隙炮台2346.8→30.85。Tier4为HP=${world.tierBasis.constrained.hp}、attack=${world.tierBasis.constrained.attack}，保持单调与相同阶段目标。没有额外扫描候选。各处取整误差保留；30秒静止靶压力不等同于通关胜率，实际通关由S8原任务/地城测试验证。

旧区首领也不再继承普通怪的一刀线。按S2原生首领难度及新旧标准人D1/EHP比例独立反推${bossRepair?.rows.length??0}个模板；首个首领此前从1000生命误缩到66，独立预算恢复后，首章12项原测试（含预警、阶段、自动/半自动）均通过。故事六首领的锁定目标保持原值。

最终档位系数（C2后）：${Object.entries(finalRanks).map(([name,r]:[string,any])=>name+' HP='+r.hp+' / attack='+r.attack+' / armor='+r.armor).join('；')}。曲线及模板值与档位相乘后再作整数投影；普通怪最小生命1会造成低等级不同模板的显示值相同。

| 首领 | 到达等级 | 目标秒数 | 复测秒数 | 偏差 | 胜率 |
|---|---:|---:|---:|---:|---:|
${wallTable}

## 日程、野外与反作弊

| 种子 | 等级 | 自然日程分钟 | 失败 |
|---:|---:|---:|---|
${calendarRows}

| 里程碑 | 目标分钟 | 三种子中位分钟 | 偏差 |
|---|---:|---:|---:|
${milestoneRows}

最终V3的L50日程中位数${fmt(calendar.minutes,2)}分钟（范围${fmt(calendar.min,2)}–${fmt(calendar.max,2)}），与240分钟目标偏差${pct(calendar.minutes/240-1)}；V1=${fmt((await readJson(review+'/S7/V1/calendar-summary.json')).minutes,2)}、V2=${fmt((await readJson(review+'/S7/V2/calendar-summary.json')).minutes,2)}，用于记录修正路径，不和V3混算。最大种子${Math.max(...calendar.rows.map((r:any)=>r.minutes))>300?'超过':'未超过'}300分钟硬上限。自然私有掉落未固定，三种子为实际随机样本而非玩家群体置信区间。

S8原始回归另含两种自然策略，使用各自的真实任务驱动。这些是额外回归样本，不并入V3三种子中位数；任务驱动成功与节奏目标达标分别报告。两次均固定战斗种子41，但私有掉落未固定，不是完全相同输入的复现。最终较快的样本不能抹去首次401.08分钟的超时；该项仍列为残差。首次同名原始日程被重跑覆盖，覆盖前记录的结果和SHA256保存在first-attempt摘要，不声称旧原始文件仍可读取。

| 回归轮次/策略 | 种子 | 等级 | 分钟 | 300分钟上限 |
|---|---:|---:|---:|---|
${regressionCalendars.map(r=>'| '+r.run+' / '+r.strategy+' | '+r.seed+' | '+r.level+' | '+fmt(r.minutes,2)+' | '+(r.minutes>300?'未通过':'通过')+' |').join('\n')}

真实营地一刀线以${validation.field.oneHitRate>=.9?'达到':'未达到'}90%判定：当前${pct(validation.field.oneHitRate)}。野外AI环境下的TTK/TTD列在下表；删失于120秒的存活样本只报告下界，不当作精确的有限TTD。

| 等级 | 档位 | 指标 | 实测秒数 | 目标秒数 | 偏差/限制 |
|---|---|---|---:|---:|---|
${fieldTable}

| 等级 | 种子 | 未达一刀线营地 | 原生命 | 非暴击命中 | 原因 |
|---|---:|---|---:|---:|---|
${oneHitMiss}

RATE误判计数${validation.guard.falseFlags.length}次；原阈值15击杀/秒按日志观测最大36×2放宽为72。反作弊公式、鉴权、协议判定未改。阈值变宽数据和原公式行变更见S6/rate summary及本期变更表。

## 回归、构建与提交边界

完整回归：${regressionBlocks[0]?regressionBlocks[0].filesPassed+'个文件通过、'+regressionBlocks[0].filesFailed+'个失败；测试'+regressionBlocks[0].passed+'通过、'+regressionBlocks[0].failed+'失败、'+regressionBlocks[0].skipped+'个原有跳过':'尚在运行'}。第二独立自然策略：${regressionBlocks[1]?regressionBlocks[1].passed+'通过、'+regressionBlocks[1].failed+'失败':'尚未结束'}。没有新增skip/only或删除失败断言。类型检查与7本工作簿一致性检查已通过；最终正式隔离构建${buildResult?.passed?'通过，'+buildResult.files+'个产物文件，实验入口'+buildResult.hits.length+'处':'待完成'}。

主干门禁${finalCheck?'已运行：固定副本源漂移'+finalCheck.drift.length+'项，预算未通过'+finalCheck.budget.outside+'项，测量敏感性'+finalCheck.measurementFailures.length+'项，退出码1保留':'将在最终配置发布后运行'}。数值残差不会被全量测试通过覆盖；共享工作区存在制作迁移时还会独立报告源漂移。

初始全量46项失败按过期期望、驱动缺陷与内容错误分别处理：精确数值及全帧固定哈希同步；长任务驱动续租、终局确认和完整排列时限修复；测量边界与上述两处推导修复。原始轨迹保留在本机，全部字段参与固定哈希比较。制作会话和前端同期改变了共享契约，验收使用S0既有工作树加本期改动的固定副本；起点245个测试文件全部保留，并加入本期3个测试文件，803组战斗输入零差异。共享制作源码没有被回退或提交。实际清理记录见S9/cleanup.json。

验证覆盖上述固定工作树，不能把它表述为单独clean checkout本期提交的验收。只提交本期hunk，S0已存在的客户端0.11.26及其他未提交工作仍归原会话；本期版本差量仅rules ow-70→ow-71。复现副本及最终源清单见S8/final-verified-source-summary.json。

## 验收结论与待办

| 套件 | 最终结果 | 样本/记录数 |
|---|---|---:|
${gateTable}

本期完成原V1/V2/V3和两次公式修正，随后按用户授权修复测量并复核受影响结果；没有额外牛顿/自由调参。当前状态为“${status}”。逐格实测、锁定目标、超带内容、失败/删失及触及边界保留在numeric-todo；原始arms、自然日程、完整validation不入库。主要残差是构筑预算/场景、武器族平价、野外一刀线与TTD删失，以及参考构筑投入口径和真实时序敏感性。原V3证据没有被覆盖，新复核明确区分新跑与依赖核验后复用的数据。

## 内容改动后如何复算

在已安装依赖的工程目录中，先将Excel内容导出并执行config:check。保留当前冻结锚点供同一主干周期对比。运行

'node --import tsx tools/spine/cli.ts bench --player'

重测13个标准人等级点和法杖/暗器平价，输出新的测量签名。对完整对比周期还要运行'bench --builds'、'bench --stats'、'bench --sources'、'bench --content'以及'bench --scenes'，逐项指定同一新输出目录。完成新基线后依次预览/保存归一计划、应用8构筑机制计划、求有限牛顿解、应用怪物/地城/层级计划、运行三种子timeline并独立应用经验/钥匙计划，最后按每次V仅允许一次的顺序启动validate。变更数值的唯一写入口为统一apply；任何输入签名变化都会拒绝覆盖旧arms。只改文案/表不假称测量结果变化。

## 复核来源

冻结M2锚点来自8构筑L50测量的中位数，为${fmt(lock.anchor.D1,3)}/${fmt(lock.anchor.DN,3)}/${fmt(lock.anchor.B3,3)}/${fmt(lock.anchor.EHP,3)}/${fmt(lock.anchor.AV,6)}；13个等级点另用于标准人曲线。冻结来源和SHA256见data/spine-anchor.json。原V3和授权复核明细保留本地，本报告实际输入：${sourceStamp.sourcefiles.V3.path}（SHA256 ${sourceStamp.sourcefiles.V3.sha256}）。
`;
function medianHelper(values:number[]){const x=[...values].sort((a,b)=>a-b),i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;}
await writeFile(review+'/S9/report.md',report);
await save(review+'/S9/report-inputs-summary.json',{...stamp(),validation:await evidence(V3+'/validation.json'),initialAudit:await evidence(review+'/S2/audit-summary.json'),finalAudit:await evidence(V3+'/budget/audit-summary.json'),players:await evidence(data+'/spine-player.json'),anchor:await evidence(data+'/spine-anchor.json'),weights:await evidence(data+'/stat-weights.json'),world:await evidence(worldPath),sigma,regressionBlocks,regressionCalendars,budgetSources});
await decision('S9当前σ与标准人投入口径',Object.entries(sigma).map(([k,v])=>k+'='+fmt(v as number,4)).join('，')+'；参考构筑受控配置与SCHEDULE全养成标准人投入不同，不能当成同投入溢价。不暗加成长补齐，不强制σ=1。','S9/report-inputs-summary.json、tools/spine/player.ts',review);
const todos:any[]=[];
const aspects=await readJson('packages/content/aspects.json');
const boundaries=(build:string)=>knobs.knobs.filter((k:any)=>k.bd===build).map((k:any)=>{const value=get(aspects,knobPath(aspects,k));return {rule:k.rule,path:k.path,value,floor:k.floor,ceiling:k.ceiling,touched:value<=k.floor?'floor':value>=k.ceiling?'ceiling':null};});
for(const build of validation.builds.matrix){
 for(const cell of build.cells)if(!cell.passed||cell.error===null||Math.abs(cell.error)>.25)todos.push({suite:'builds',key:build.build+'/'+cell.scene,actual:cell.actual,target:cell.target,error:cell.error,bounds:boundaries(build.build),rootCause:cell.scene==='safety'?'AV饱和到1，S4安全轴局部梯度为零；当前旋钮无法沿目标方向改善。':'S4局部雅可比和V3实际场景映射不一致；专用轴不足、边界夹紧与有限步数共同限制可达性。',mechanisms:validation.builds.mechanisms.filter((m:any)=>m.build===build.build&&!m.passed).map((m:any)=>m.rule)});
 if(!build.budgetPassed)todos.push({suite:'build-budget',key:build.build,actual:build.budget,target:1,error:build.budget-1,bounds:boundaries(build.build),rootCause:'预算由五场景相对值加权；未达标场景和饱和安全轴的偏差传入线性预算。'});
}
for(const r of validation.builds.mechanisms)if(!r.passed)todos.push({suite:'mechanism',key:r.build+'/'+r.rule,actual:r.counts,target:'每个目标场景每种子触发>0',bounds:boundaries(r.build).filter((k:any)=>k.rule===r.rule),rootCause:'至少一个目标场景/种子的身份条件未触发，V3后结构冻结，不以其它场景触发替代。'});
for(const r of validation.budget.parity)if(!r.passed)todos.push({suite:'parity',key:'L'+r.level,actual:r.gap,target:.15,error:r.gap/.15-1,values:r.values,bounds:[],rootCause:'同档真实武器族的技能、亲和与套装组合产生不同D1；标准人修复暴露了真实组合差异，本期没有武器族平价专用求解轴。'});
for(const r of validation.budget.rows)if(!r.inBand)todos.push({suite:'budget',key:r.category+'/'+r.id,group:r.group,actual:r.observed,center:r.center,error:r.error,band:r.band,elasticity:r.elasticity,parameter:{file:r.file,path:r.path,value:r.value,step:r.step},censored:r.censored,baselineCensored:r.baselineCensored,basis:r.reason??r.basis??null,source:r.raw??{ref:'budgetSources'}});
for(const r of validation.field.rows)if(!r.passed)todos.push({suite:'field',key:'L'+r.level+'/'+r.rank+'/'+(r.pressure?'TTD':'TTK'),actual:r.actual,target:r.target,error:r.error,censored:r.censored,failed:r.failed,lowerBound:r.limits});
for(const r of validation.walls)if(!r.passed)todos.push({suite:'walls',key:r.id,level:r.level,actual:r.actual,target:r.target,error:r.error,winRate:r.winRate,samples:r.samples});
for(const r of calendar.milestones)if(r.actual===null||Math.abs(r.actual/r.target-1)>(r.level===50?.05:.1))todos.push({suite:'calendar',key:'L'+r.level,actual:r.actual,target:r.target,values:r.values});
if(calendar.rows.some((r:any)=>r.level<50||r.minutes>300||r.failures?.length))todos.push({suite:'calendar-hard-limit',seedRows:calendar.rows.map((r:any)=>({seed:r.seed,level:r.level,minutes:r.minutes,failures:r.failures}))});
for(const r of regressionCalendars)if(r.minutes>300||r.level<50||r.failures?.length)todos.push({suite:'regression-calendar',key:r.run+'/'+r.strategy+'/'+r.seed,actual:r.minutes,target:300,error:r.minutes/300-1,level:r.level,failures:r.failures,bounds:[],source:r.source,rootCause:'独立任务策略增加任务路线、战斗及养成用时，且私有掉落未固定；原三种子无任务日程不能证明任务路线稳定达标。最终较快样本不能抹去首次超时，不再追加经验修正。'});
for(const r of validation.field.oneHitRows.flatMap((r:any)=>r.targets.map((t:any)=>({level:r.level,seed:r.seed,camp:r.camp,...t}))))if(!r.passed)todos.push({suite:'one-hit-line',key:'L'+r.level+'/'+r.id,seed:r.seed,camp:r.camp,hp:r.hp,nonCritHit:r.hit,failed:!r.hit});
for(const r of stability?.failures??[])todos.push({suite:'measurement-sensitivity',key:r.key,actual:Math.abs(r.error),target:.02,error:Math.abs(r.error)/.02-1,bounds:[{rule:'时序敏感性',value:Math.abs(r.error),floor:0,ceiling:.02,touched:'超过诊断上限'}],rootCause:'一帧施法变化传播到后续施法、移动、命中和防护结果；末端平滑修复了窗口截断，真实动力学敏感性仍保留。未逐条分离随机序列、碰撞与状态触发的贡献；对应构筑禁止牛顿。',source:'S8/measurement-repair/continuity-summary.json'});
for(const [axis,value] of Object.entries(sigma))if((value as number)<1||(value as number)>2.5)todos.push({suite:'scope-sigma',key:axis,actual:value,target:'仅报告，非强制目标',error:null,bounds:[],rootCause:'参考构筑受控配置与标准人SCHEDULE养成投入不同，测得的比值不是同投入条件下的构筑溢价。',source:'S9/report-inputs-summary.json'});
for(const r of pressureVerification?.rows??[])for(const axis of ['hp','dps']){const error=r[axis+'Error'];if(Math.abs(error)>.15)todos.push({suite:'world-pressure',key:r.dungeon+'/'+(r.hard?'hard':'normal')+'/'+axis,actual:axis==='hp'?r.hp:r.rawDps,target:axis==='hp'?r.targetHp:r.targetDps,error,bounds:[{rule:'enemyScale.'+(axis==='hp'?'hp':'attack'),value:axis==='hp'?r.hpScale:r.attackScale,floor:.05,ceiling:null,touched:(axis==='hp'?r.hpAtFloor:r.attackAtFloor)?'floor':null}],rootCause:'完整房间实际复测仍有整数属性、固定攻击项与0.05难度步长误差；显示超过15%的较大偏差，不新增验收门槛或再次调参。',source:r.source?.path??'S8/runtime-repair/world/final-pressure-summary.json'});}
for(const r of todos){
 r.target??=r.center??(r.suite==='one-hit-line'?r.hp:undefined);if(r.actual===undefined&&'nonCritHit' in r)r.actual=r.nonCritHit;
 r.bounds??=[];
 r.rootCause??=r.suite==='budget'?(r.actual===null&&(r.censored||r.baselineCensored)?'120秒观察窗口中存在TTD删失，只能报告界限，不能计算精确降低比例或归为功能型。':r.parameter?.value===null?'缺少独立可调主数值通道，原归一已保留残差；当前预算仍超带。':r.actual<0?'有符号净P为负；初始绝对值归一无法表达替换损失，正预算幂式不适用。':r.elasticity===0?'实测弹性为零，不能闭式换算。':'初始归一使用S2局部弹性；宿主/符号修复、同步内容交互及B3口径改变后仍有偏差。本次验收没有重新扰动弹性，null不能冒称已测为零；未再次归一。'):r.suite==='field'?(r.censored?'存活达120秒观察上限，真实TTD只有下界，不能证明有限目标容差。':'真实营地组成、AI移动与离散伤害造成效率模型偏差；档位统一缩放未消除逐营地差异。'):r.suite==='walls'?'六个首领共用档位，而该首领的招式、护甲和走位效率偏离平均；两轮修正后仍有残差。':r.suite==='calendar'?'经验分段缩放只近似控制日程；实际掉落、战斗耗时和后续世界派生使末段偏离上次比例预测。':r.suite==='one-hit-line'?'一刀约束从五等级效率模型派生，实际营地该模板生命仍高于主群攻非暴击伤害。':'详见逐种子证据。';
}
await save(review+'/S9/numeric-todo-summary.json',{...stamp(),remaining:todos.length,budgetSources,rows:todos,source:await evidence(V3+'/validation.json'),limits:['使用原V3与授权复核的实测目标和边界，不估计零弹性；没有额外牛顿或自由调参。','初始/后续错误基线按不同source签名分开保留，不用绝对值P、通用raider或120秒删失值补造通过记录。','任何用户锁定目标保持原值。','source.ref=budgetSources引用本文件顶层共享来源索引；所有路径与SHA保留。','根因是基于测量口径、梯度和边界的诊断；没有额外候选实验来分离每种交互贡献。']});
const touched=(r:any)=>r.bounds.filter((k:any)=>k.touched).map((k:any)=>k.rule+'='+k.value+' ['+k.floor+','+(k.ceiling??'未设上限')+'] '+k.touched).join('；')||'无专用数值边界触及记录';
await writeFile(review+'/S9/numeric-todo.md','# 数值待办与残差\n\n原V3与授权复核的残差分开留档；没有额外牛顿/自由调参。逐项原始证据路径及SHA256、完整边界保存在numeric-todo-summary.json。根因来自现有测量和边界诊断，没有追加候选实验。\n\n| 套件 | 项目 | 实测 | 目标 | 相对偏差 | 根因 | 触及边界 |\n|---|---|---:|---:|---:|---|---|\n'+todos.map(r=>`| ${r.suite} | ${r.key??'多个样本'} | ${r.actual===null||r.actual===undefined?'未测':typeof r.actual==='number'?Number(r.actual).toPrecision(5):'见汇总'} | ${r.suite==='budget'?(r.center>0?Number(r.center).toPrecision(5)+' ±'+pct(r.band):'正预算中心未定义'):r.target===null||r.target===undefined?'未定义':typeof r.target==='number'?Number(r.target).toPrecision(5):'见汇总'} | ${r.error===null||r.error===undefined?'不可换算':pct(r.error)} | ${r.rootCause} | ${touched(r)} |`).join('\n')+'\n');
console.log(JSON.stringify({report:review+'/S9/report.md',todo:todos.length,checks:validation.checks,calendar:calendar.minutes,field:validation.field.oneHitRate,highBudgetRows:finalCounts.outside,parity:validation.budget.parity.map((r:any)=>({level:r.level,gap:r.gap}))}));
