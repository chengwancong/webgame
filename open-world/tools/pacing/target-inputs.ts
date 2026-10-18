import {readFile,writeFile} from 'node:fs/promises';
import {regionById} from '../../packages/content/index.ts';
import {pacingProfiles} from './profiles.ts';
const out='docs/reviews/pacing-tool-20261010',inventory=JSON.parse(await readFile(out+'/P0/inventory-data.json','utf8')),baseline=JSON.parse(await readFile(out+'/P0/bd-measurements.json','utf8'));
const shape:Record<string,number[]>={
 burn:[.9,1.25/1.05,1.05,.95,.9],freeze:[1.1,.8/1.05,1.3,.9,1.25],mobile:[.8,1.1/1.05,.8,1,1.3],quake:[1.1,1.3/1.05,.95,1.05,.6],arrows:[.7,1.3/1.05,.9,1,1.1],echo:[1.15,1/1.05,.8,1.3,.9],bulwark:[.8,.75/1.05,1.5,.9,1.3],opening:[1.4,.75/1.05,1.05,1.4,.9],
};
const levels=inventory.timeline.levelRows.map((p:any)=>({id:'level-'+p.level,kind:'level',name:'Lv'+p.level,level:p.level,currentMinutes:p.minutes,wallMinutes:0,method:'升级与换装，保留已开放可刷路径'}));
const bosses=inventory.timeline.bossRows.map((p:any)=>{const enemy=regionById(p.boss).spawns.find(s=>s.boss)!;return {id:p.boss,kind:'boss',name:regionById(p.boss).name,level:p.level,currentMinutes:p.minutes,wallMinutes:1,method:'升级或换构筑；不要求随机钥匙',bossKillSeconds:Math.round(p.killSeconds),baselineKillSeconds:p.killSeconds,inferredDps:enemy.hp/p.killSeconds,enemyHp:enemy.hp,template:enemy.template};});
const counts=inventory.counters,xpRate=inventory.observedXpPerVirtualMinute;
const endgame=[
 ['quality','装备品质覆盖',6,1,6/180,180,'部位','equip-quality',null,'六部位达到稀有及以上；产出率是设计校准输入，非自然补齐承诺'],
 ['skills','技能满级',counts.skills,1,counts.skills/240,240,'技能','skill-upgrade','skills','已解锁技能为分母；每个技能五级，未解锁技能不冒充已满'],
 ['talents','天赋点分配',60,1,60/240,240,'点','talent','talent','按可用点分配率，不要求互斥天赋同时满'],
 ['awakening','角色觉醒',10,1,10/300,300,'层','awakening','awakening','保留10层与晶体玩法结构'],
 ['skill-awakening','技能觉醒',counts.skills,.5,counts.skills/600,600,'技能','skill-awakening','skillAwakening','每技能选一分支；不同时选三支'],
 ['sets','套装覆盖',counts.setIdentities,.5,counts.setIdentities/600,600,'身份','set-collection',null,'按18身份统计；掉落结构保持，收集时长仍需自然样本'],
 ['aspects','威能覆盖',counts.obtainableAspects,.5,counts.obtainableAspects/600,600,'身份','codex','extract','可掉落身份为分母；旧版不可掉落项不纳入'],
 ['augments','潮印体验',counts.augments,.25,counts.augments/600,600,'选项','run-augments',null,'按报告中见过/选过的选项，不写角色永久拥有'],
 ['crafting','制造配方',counts.recipes,.25,counts.recipes/600,600,'配方','recipes','recipeLearn','维持配方总量与来源'],
 ['reputation','声望阶段',24,.5,24/600,600,'阶段','reputation','donation','六势力各四阶段，产出率先作为设计输入'],
 ['paragon','巅峰节点',48,1,xpRate,5,'节点','paragon','paragon','48节点、47级可点齐；每级目标5+0.1×巅峰级虚拟分钟，不作为巅峰整体时间KPI'],
 ...pacingProfiles.map(p=>['bd-'+p.id,p.name+'成型',1,1,1/45,45,'构筑','bd-formation',null,'设计目标45虚拟分钟；受随机来源影响，实际自然成型待采样']),
].map(([id,name,total,target,rate,minutes,unit,measure,costKey,notes])=>({id,name,total,target,rate,minutes,unit,measure,costKey,notes}));
const settings=[
 ['mainGoal',240,'满级主目标，虚拟分钟'],['targetBand',[210,270],'3.5–4.5小时虚拟日程目标带'],['hardLimit',300,'满级硬上限，虚拟分钟'],['tolerance',.05,'里程碑与预算默认容差'],
 ['whitelist',['dev','developer','ccc','pacing_dev'],'仅隔离开发服务启用，正式包无入口'],['benchmark',{level:50,itemLevel:50,skillRank:5,artStage:1,seed:41},'合法同预算受控装备；不代替自然养成'],
 ['paragonMinutesSlope',.1,'每个巅峰级增加的目标虚拟分钟，仅耗时诊断'],['weightsOwner','user-20261010','五场景权重由用户指定，本工具不推导或修改'],
 ['baseline','docs/reviews/pacing-tool-20261010/P0','当前ow-63自然/BD测量，不读取正式库'],['accountsIsolated',true,'试玩覆盖仅当前内存会话，新开战使用；不写奖励'],
 ];
const bd=pacingProfiles.map(p=>{const actual=baseline.matrix.find((r:any)=>r.bd===p.id);return {id:p.id,name:p.name,targets:shape[p.id],profile:p,baseline:actual.ratios,budgetBefore:actual.budget};});
await writeFile(out+'/P1-target-inputs.json',JSON.stringify({levels,bosses,endgame,settings,bd,baselineMinutes:inventory.timeline.virtualMinutes,weights:[.2,.3,.1,.15,.25]},null,2));
await writeFile(out+'/P1-bd-decisions.md','# P1 目标矩阵幅度\n\n权重原样；以下是设计目标，不是实测通过。分裂箭雨采用P0披露的暗器替代构筑。\n\n|BD|首领|清图|生存|精英|机动安全|目标预算|\n|---|---|---|---|---|---|---|\n'+bd.map(p=>'| '+p.name+' | '+['single','clear','survival','elite','safety'].map((k,i)=>p.baseline[k].toFixed(3)+' → '+p.targets[i].toFixed(3)+'（'+((p.targets[i]/p.baseline[k]-1)*100).toFixed(1)+'%）').join(' | ')+' | '+p.targets.reduce((n,v,i)=>n+v*[.2,.3,.1,.15,.25][i],0).toFixed(3)+' |').join('\n')+'\n');
