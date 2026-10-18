import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='docs/reviews/open-world-m2-m4',out=base+'/W11',read=async p=>JSON.parse(await readFile(p,'utf8'));
const content=(await readFile(out+'/content.log','utf8')).split(/\r?\n/).find(l=>l.startsWith('{"productionIslands"'));
const islands=JSON.parse(content).productionIslands,global=await read(base+'/W10/global-acceptance.json'),loot=await read(out+'/loot-cadence-detail.json'),flow=await read('.design/numeric-flow-20261006/flow.json');
const commits=['9e6887f','91fc055','ca7c03d','005e147','83f3a2e','a391e05','95e95f6','c11fb1d','da128d2','614e64e','8010b1f'];
let files='# 逐批修改文件\n\n来自各批提交的实际Git树；不使用文件数表示完成度。W11文件见最终提交。\n';
for(let n=0;n<commits.length;n++)files+='\n## W'+n+' · '+commits[n]+'\n\n'+execFileSync('git',['show','--format=','--name-only',commits[n]],{encoding:'utf8'}).trim().split(/\r?\n/).map(p=>'- `'+p+'`').join('\n')+'\n';
files+='\n## W11 · 最终选择性提交\n\n'+execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).map(p=>'- `'+p+'`').join('\n')+'\n';
await writeFile(out+'/batch-files.md',files);
const logs=await readFile(out+'/regression.log','utf8'),testRows=[...logs.matchAll(/(?:✓|↓) (tests\/[^\r\n]+?\.test\.ts) \(([^\r\n]+?)\) ([^\r\n]+)/g)];
await writeFile(out+'/test-results.md','# 逐文件最终测试结果\n\n完整回归：195文件通过，1498项通过，2项原有跳过。完整命令/耗时/原始输出见regression.log；隔离PG清理见regression.json。回归后新增真实产出驾驶器单独通过，不需要重跑已稳定的全量。\n\n| 文件 | 项目 | 结果/时间 |\n|---|---|---|\n'+testRows.map(r=>'| `'+r[1]+'` | '+r[2]+' | 通过 · '+r[3]+' |').join('\n')+'\n| `tests/world-loot-cadence.database.test.ts` | 真实采集/过滤/奖励保留/重复命令 | 通过 · 37.49秒；loot-cadence.log |\n\nconfig故意三种破坏、全岛全地城资源解析与纹理完成后动画登记是用户明确要求保留的工程检查。废弃首领固定预算断言已删除，由当前真实地城创建、战斗、冻结/恢复与防重流程取代；没有归档废弃测试源码。\n');
const bursts=loot.events.filter(e=>e.elites>0&&e.issued>0),gap=Math.max(...loot.burstIntervalsMinutes,loot.minutes-(bursts.at(-1)?.minutes??0));
const report={versions:flow.versions,generated:new Date().toISOString(),islands,fieldPass:global.fields.filter(f=>f.accepted).length,fieldTotal:global.fields.length,wallFailedStages:global.walls.filter(w=>w.scenarios.some(s=>s.rho!==.8&&!s.accepted)).map(w=>w.stage),legendaryRatio:global.grind.legendaryRatio,loot:{minutes:loot.minutes,initialBag:loot.initialBag,finalBag:loot.finalBag,capacity:loot.capacity,pending:loot.pending,issued:loot.gearIssued,full:loot.full,eliteBursts:loot.eliteBursts,maxObservedGapIncludingEnd:gap,scope:loot.limits},journeys:flow.journeys.map(j=>({...j,p90p10:j.p90/j.p10,scope:'calibrated distribution model; not actual PG acquisition distribution'})),calendar:global.calendar.map(r=>({strategy:r.strategy,minutes:r.minutes,level:r.level,milestones:r.milestones})),exceptions:['17分区交战占比超过5%容差；一次密度调整后仍未达。','阶段13/14/15当前受控ρ探针0胜，真实末两地城自然负载同样失败；合法登记负载独立可达，不抵销自然失败。','首传奇配对0.7915倍，后期8目标/单体约5.1–5.25，未达设计增长目标。','自然虚拟日程约5.44/5.54小时，不能认作30小时真人平均；任务尝试到50不是全部任务完成日程。','纯刷级路线通关全部墙的4倍时间保证，现有自然失败未证明达标；不把模拟grind路径当实际成功。','装备爆发频率的实际采集路线有超过10分钟空窗，保留保证包量，不削减奖励或篡改时钟。']};
await writeFile(out+'/delivery-summary.json',JSON.stringify(report,null,2));
const table=islands.map(i=>'| '+i.name+' | '+i.width+'×'+i.height+' / '+(i.walkableRatio*100).toFixed(2)+'% | '+i.zones+' | '+i.camps+'/'+i.monsterPositions+' | '+i.waypoints+' | '+i.dungeonEntrances+' | '+i.events+'/'+i.chests+' | '+i.rares+'/'+i.patrols+' | '+i.reachablePoints+' |').join('\n');
const matrix=[
 ['心流1 开荒分位','当前World三种子实际地城精英频率→私有掉率/材料保底；24阶段×20000模拟样本，旅程seed99×5000。模型与实测基线分开；操作/额外BD分布仍是假设。','模型报告，不能当真实PG分位通过'],
 ['心流2 墙','24阶段×4ρ×20种子、真实World/当前技能/死亡超时全部保留；13–15失败，其余通过。','§6.1数据例外'],
 ['心流3 只刷级过墙','自然赚取Lv50、六岛首领与裂星潮；全任务续接173自然目标完成，末两地城自然失败，独立合法发行构筑可达175。','4倍时间保证未达证据要求，§6.1自然失败数据例外'],
 ['心流4 爽刷提升','同等级/同图/配对seed41、73、107：首传奇前后0.7915倍；阶段源kill-rate和清群时间在grind/field JSON。','§6.1数据例外'],
 ['心流5 爽占比','阶段开荒/爽刷模型与36分区真实90秒交战占比并列；19区通过含5%容差，17未达。模型爽占比不替代实际行为。','实测例外；理论分配单独标注'],
 ['心流6 运气平均化','当前源分布模型：主线P90/P10 '+report.journeys[0].p90p10.toFixed(3)+'，裂星潮 '+report.journeys[1].p90p10.toFixed(3)+'；没有声称5000个真实PG玩家。','理论模型达标，实际分布仍有限制'],
 ['心流7 总节奏','无任务326.19分钟，任务尝试332.43分钟；真实PG成长，无授予；估算走路/恢复和虚拟等待的乐观路线。','30小时目标§6.1数据例外'],
 ['心流8 清图力','360个实际DPS场景＋60个群攻命中；后期8目标/单体约5.1–5.25。','§6.1数据例外'],
 ['割草1 力量跳跃','首传奇配对同上。','§6.1数据例外'],
 ['割草2 阶段曲线','36分区真实World90秒seed41，TTK/交战/击杀/死亡全留；源模板群体角色预算由数值工具写回。','分区数据例外同上'],
 ['割草3 满包','新角色rare过滤，'+loot.minutes.toFixed(2)+'分钟、背包'+loot.initialBag+'→'+loot.finalBag+'/'+loot.capacity+'，发出'+loot.gearIssued+'件、待领取'+loot.pending+'件，过滤未删奖励。','单路线≥3小时未满通过；不是群体平均'],
 ['割草4 高潮频率','同一实际采集路线'+loot.eliteBursts+'次精英带装备记录，最大观察空窗（含末尾）'+gap.toFixed(2)+'分钟。','§6.1数据例外'],
 ['割草5 自动/手动','贪心手动输入策略/自动配对1.176倍，对1.2差1.96%，按用户5%容差通过。自动交战占比不足单独留实测。','配对比通过；自动效率有数据例外'],
 ['割草6 性能','可见IAB1280×720，60原生敌人/40登记特效，60.42秒3300帧平均56.90FPS；Dragon加载1.154秒。','通过；i5-14600K/RTX4070SUPER/64GB'],
 ['割草7 节奏/装备量','节奏同上；实际采集'+loot.gearIssued+'件/'+loot.minutes.toFixed(2)+'分钟、保留每次保证包量；正式源经济报告给普通等价值估计，真实付款/制作见PG日志。','30小时数据例外，未削减包量']
 ];
await writeFile(out+'/numeric-matrix.md','# 心流8项与割草7项最终数据\n\n版本 '+JSON.stringify(flow.versions)+'。测量与分布模型明确分开。阈值相对差距≤5%直接通过，其余数值失败按§6.1记录，不降标准。\n\n| 项目 | 实际数据/来源/样本/限制 | 结论 |\n|---|---|---|\n'+matrix.map(r=>'| '+r.join(' | ')+' |').join('\n')+'\n\n原始来源：W10/global-acceptance.json、field-*.json、wall-*.json、grind-paired.json、key-source-basis.json、key-pool-derivation.json、numeric-pipeline.json、natural-calendar*.json、all-quests.json；W11/loot-cadence-detail.json、pressure.json、new-island-map.json。模型源.design/numeric-flow-20261006/flow.json。报告包含所有数值项，但不表示所有阈值达标。\n');
const paths=[
 'W0：冻结基线、已有改动/版本/内容ID白名单。baseline.json、pre-existing-worktree.json。',
 'W1：工作簿修改→正式512生成→导航/内容检查；两分区变体证明配置影响生成。',
 'W2：事件三类、宝箱、稀有、巡逻、相位与世界事实执行；真实PG结算/防重/恢复；修改条件→两角色可见世界不同→重连不变。activities.json、world-phase-player-flow日志。',
 'W3：实际地城开战/失败诊断→来源掉落→真实制作/消费→过墙与层级冻结/恢复；资源引用/动画纹理时序Node固定。numeric-pipeline、player-flow日志。',
 'W4 风栖：开场自动接取对白、Milo accept_stay、两线索乱序汇合、机关门、区域任务并行、首领/相位/回港。wind-driver.json、current-flow.log。',
 'W5 雾铃：认门/clear_camp、三线索六顺序、NPC单位置与跨岛认识兜底、世界相位。story-flow.log/json。',
 'W6 赤炉：汇合开场、守护、炉门、首领、六顺序和并行任务。story-flow.log/json。',
 'W7 霜镜：接取前task_ready站位→接取后站位→回港；三线索/机关门/相位重连。story-flow.log/json。',
 'W8 沉星：机关门、难民/供能分散节点、首领后撤场及商人、两角色相位与重连。story-flow.log/json。',
 'W9 龙眠：三处守护/关键会盟/机关门、六岛首领实际全清→侵军撤场与航标激活；后接任务不伪造击杀。story-flow.log/json。',
 'W10：六个裂星潮实际地城/阶段19–24、合法发行构筑实际战斗开放层5、永久晶核/巅峰增益/制作防重；全任务续接及自然失败单列。formal-endgame-player-flow、all-quests、event-tier-frozen-flow。',
 'W11：最终全回归和发布；正式新/老角色登录风栖+任务页、隔离已有角色Dragon+地城目录、可见压力/加载、清档后只读审计。全部GUI console=[]。'
 ];
await writeFile(out+'/final-report.md','# 大世界M2–M4最终交付\n\nW0–W11工程与真实流程已经收口；下列数值例外按交接单§6.1留实际数据，不表示全部数值阈值通过。无§6硬阻塞。\n\n正式预览 http://127.0.0.1:8612/ ，实际health/content一致 client0.11.21 / protocol32 / rulesow-62 / db16 / assetsv24。\n\n## 逐批文件和实际玩家路径\n\n实际修改文件逐批见[batch-files.md](batch-files.md)，源码与依赖按编译节点一并提交；其他会话四树/外观等未混入提交。\n\n'+paths.map(p=>'- '+p).join('\n')+'\n\n所有编排流程含无任务功能兜底、先完成再接取、≥5任务并行、六种乱序、NPC唯一位置、相位重连、附近值得去；故事等级预算独立标注。配置故意三类破坏均报错；相位条件、地城冻结/掉落与成本改变→行为改变的当前机制验证保留。\n\n## 运行时数量\n\n以下来自W11/content.log实际内容校验；每岛6区，每区5精英营地；每岛2稀有共6出现点，3类事件，6+区域人物；区域支线12/引路3/探索6/悬赏18，36旧故事迁移+13串场。对白草稿与battle→clear_camp体验清单保留“待用户试玩确认”。全部资源引用/未选用变体原因见W4–W9/resource-usage.json。\n\n| 岛 | 正式图/可走 | 区 | 营地/怪物点 | 传送 | 地城入口 | 事件/宝箱 | 稀有/巡逻 | 导航可达点 |\n|---|---|---:|---:|---:|---:|---:|---:|---:|\n'+table+'\n\n## 测试、数值和配置\n\n[逐测试结果](test-results.md)：最终全量195文件、1498通过/2原有跳过；新增真实掉落采集1条单独通过。类型、内容、config:check、所有资源引用与生产构建通过，内容ID扫描相对W0新增0（505现有命中）。纹理加载后才登记动画的针对性检查通过。原始证据checks.json/regression.json/publication.json；废弃固定预算测试直接删除并以当前流程替代，没有逐条移植数字。\n\n[全部15项数值数据和限制](numeric-matrix.md)，以及W10/global-acceptance.json/md逐区逐墙原始结果。实测36区90秒seed41，24墙四档ρ各20种子；配对seed41/73/107；真实来源三种子。理论分布单独声明，不冒充PG掉落或真人时长。\n\n5%以内差距直接通过：部分交战占比、手动/自动配对比等已入进度文件。仍未达数据：\n\n'+report.exceptions.map(p=>'- '+p).join('\n')+'\n\n## GUI、存档与清理\n\nGUI只做短冒烟和指定可见压力，无无头或浏览器逐项战斗流程。已有正式角色登录Wind/任务页；新账号真实Lv1创建进入Wind；隔离已有Lv33进入Dragon，正常E回港/铜铃“地城钥匙”打开正式目录；控制台全部无错误，无版本拦截。机器与FPS在machine.json/pressure.json，平均56.90FPS，进岛1.154秒。\n\n生产构建前后同cluster已有账号、角色、回执和流水一致。delivery-save-audit.json在GUI后再次只读核对：6账号/6角色/401回执/401流水；原始行全部保留，1个角色变化和8条新增回执已核对为合法GUI操作。2026-10-06用户授权开发期清档按既定决策结案，正式库保持新库；备份wipe-before-r5-20261006-222451.dump保留，原267/148/1910/1910及哈希与R4一致。没有恢复旧库或新增清档。\n\n自建IAB页已关闭、1280×720临时视口恢复，压力/地图样本服务停止；最终回归临时PG1283375200字节、最后GUI44489779字节、采集92547256字节均清理到0，自身重任务锁正常释放。正式Limited常驻服务保持可访问。最终体验由用户试玩。\n');
console.log(JSON.stringify({report:out+'/final-report.md',testsListed:testRows.length,islands:islands.length,lootGap:gap}));
