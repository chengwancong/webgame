import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {regionById} from '../../packages/content/index.ts';
import {pacingTargets,pacingWeights,pacingBuildTargets} from '../../packages/content/pacing-targets.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {mechanismTargetScenes} from '../pacing/mechanisms.ts';
import {referencePlayer,resolvePlayer,standardState} from './player.ts';
import {measureScenes} from './scenes.ts';
import {measured} from './measure.ts';
import {measureField} from './field.ts';
import {measureAuthoredField} from './authored-field.ts';
import {currentParity} from './parity.ts';
import {measureContent} from './audit.ts';
import {finishBudgetAudit} from './budget.ts';
import {naturalTimeline} from './progression.ts';
import {median,mapBench,spineScenes} from './math.ts';
import {save,readJson,review,data,evidence,stamp} from './io.ts';
export async function measureWalls(output:string){const rows=[];
 for(const target of pacingTargets.milestones.filter(t=>t.kind==='boss')){
  const region=regionById(target.id),player=resolvePlayer(target.id,standardState(target.level)),samples=[];
  for(const seed of [41,42,43,44,45]){const path=output+'/arms/wall-'+target.id+'-'+seed+'.json';let sample;try{sample=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;sample=sampleCombatBuild({requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region,spawns:region.spawns,seed,maxTicks:180*30,mode:'auto',stopWhen:'clear',goal:'final_boss',approachTargets:true});await save(path,sample);}samples.push({seed,seconds:sample.clearSeconds,death:sample.deathSeconds,failed:sample.failed,success:sample.clearSeconds!==null&&(sample.deathSeconds===null||sample.deathSeconds>=sample.clearSeconds),source:await evidence(path)});}
  const wins=samples.filter(s=>s.success),actual=wins.length?median(wins.map(s=>s.seconds)):null,winRate=wins.length/5;rows.push({id:target.id,level:target.level,target:target.bossKillSeconds,actual,error:actual===null?null:actual/target.bossKillSeconds!-1,winRate,passed:actual!==null&&Math.abs(actual/target.bossKillSeconds!-1)<=.15&&winRate>=.8,samples});console.log('首领墙 '+target.id+' '+actual+'秒 胜率'+winRate);
 }await save(output+'/walls-summary.json',{...stamp(),rows,passed:rows.every(r=>r.passed)});return rows;
}
export async function validateSpine(suite='all',output=review+'/S7/V1'){
 await mkdir(output,{recursive:true});const anchor=(await readJson(data+'/spine-anchor.json')).anchor,result:any={...stamp(),suite,checks:{},limits:['三种子引擎自然路线与合法受控构筑分开。自然掉落私有随机没有固定，离散度原样报告。','失败、死亡、超时和删失样本全部保留，不以预测代替场景实测。']};
 if(suite==='all'||suite==='builds'){
  const builds:any[]=[];for(const p of pacingProfiles){const b=await measured(output,p.id,referencePlayer(p.id).player,anchor.r50*20);builds.push({build:p.id,...b.metrics,predicted:mapBench(b.metrics,anchor)});}const scenes=await measureScenes(output);
  const mechanisms=pacingProfiles.flatMap(p=>{const player=referencePlayer(p.id).player;return (player.build.stats.rules??[]).filter(r=>r.source===p.aspect).map(rule=>{const targets=mechanismTargetScenes[rule.id]??(rule.id.includes('-spine-')?[rule.id.split('-spine-')[1]]:spineScenes);const counts=targets.map(scene=>({scene,seeds:scenes.rows.filter(r=>r.build===p.id&&r.scene===scene).map(r=>({seed:r.seed,activations:r.rules[rule.id]?.activations??0,uses:r.rules[rule.id]?.uses??0,uptime:r.rules[rule.id]?.activeFrames??0,count:r.rules[rule.id]?.count??0}))}));return {build:p.id,rule:rule.id,counts,passed:counts.every(c=>c.seeds.length===3&&c.seeds.every(r=>r.activations>0||r.uses>0||r.uptime>0||r.count>0))};});});
  const matrix=scenes.summary.matrix,budgets=matrix.filter(r=>r.budgetPassed).length,cells=matrix.flatMap(r=>r.cells),scenePass=cells.filter(c=>c.passed).length;
  result.builds={metrics:builds,matrix,mechanisms,mappingError:matrix.map(r=>({build:r.build,ratios:Object.fromEntries(spineScenes.map(s=>[s,r.ratios[s]===null?null:r.ratios[s]/builds.find(b=>b.build===r.build)!.predicted[s]]))})),budgets,scenePass,failed:scenes.summary.failed};result.checks.builds=budgets>=7&&scenePass>=34&&cells.length===40&&cells.every(c=>c.error!==null&&Math.abs(c.error)<=.25)&&mechanisms.every(m=>m.passed)&&!scenes.summary.failed.length;
 }
 if(suite==='all'||suite==='calendar'){
  const calendar=await naturalTimeline(output);result.calendar=calendar;result.checks.calendar=calendar.minutes!==null&&Math.abs(calendar.minutes/240-1)<=.05&&calendar.rows.every(r=>r.level>=50&&r.minutes<=300&&!r.failures.length)&&calendar.milestones.every(r=>r.actual!==null&&Math.abs(r.actual/r.target-1)<=(r.level===50?.05:.1));
 }
 if(suite==='all'||suite==='walls'){result.walls=await measureWalls(output);result.checks.walls=result.walls.every((r:any)=>r.passed);}
 if(suite==='all'||suite==='field'){
  const authored=await measureAuthoredField(output),rows=authored.rows,targets=(await readJson('config/json/spine-targets.json')).targets;const checks=rows.map(r=>{const levels=(Math.floor((r.level-1)/10)*10+1)+'–'+(Math.floor((r.level-1)/10)*10+10),target=targets.find((t:any)=>t.levels===levels&&t.key===(r.pressure?'danger.ttd.':'field.ttk.')+r.rank)?.value,actual=r.pressure?r.ttd:r.ttk,unknown=r.pressure&&r.censored;return {...r,target,actual,error:actual===null||target===undefined||unknown?null:actual/target-1,passed:actual!==null&&target!==undefined&&!unknown&&Math.abs(actual/target-1)<=.2,limits:unknown?'120秒删失，只能断言TTD下界，不能证明有限目标±20%':undefined};});const oneHitRate=authored.oneHitRate;result.field={rows:checks,oneHitRate,oneHitRows:authored.oneHitRows,source:'服务端相位等级表与真实营地；通用raider V1原型单列保留，不用于正式野外验收'};result.checks.field=oneHitRate>=.9&&checks.every(r=>r.passed);
 }
 if(suite==='all'||suite==='budget'){
  await measureContent(output+'/budget',false);await finishBudgetAudit(output+'/budget',false);const audit=await readJson(output+'/budget/audit-summary.json'),parity=await currentParity(output+'/budget');result.budget={counts:audit.counts,rows:audit.rows,parity};result.checks.budget=audit.rows.every((r:any)=>r.inBand)&&parity.every(r=>r.passed);
 }
 // 自然日程是真实临时服务RATE证据；引擎场景另汇总吞吐，以供只放宽阈值。
 const failures=result.calendar?.rows.flatMap((r:any)=>r.failures)??[],falseFlags=failures.filter((r:any)=>JSON.stringify(r).includes('RATE'));result.guard={falseFlags,maximumKillsPerSecond:Math.max(0,...(result.field?.rows??[]).filter((r:any)=>!r.pressure&&r.ttk).map((r:any)=>(r.samples?.[0]?.targets??(r.rank==='normal'?12:1))/r.ttk))};result.checks.guard=falseFlags.length===0;
 result.accepted=Object.values(result.checks).every(Boolean);await save(output+'/validation.json',result);await save(output+'/validation-summary.json',{...result,budget:result.budget?{counts:result.budget.counts,parity:result.budget.parity}:undefined});
 await writeFile(output+'/report.md','# 主干验证结果\n\n'+Object.entries(result.checks).map(([k,v])=>'- '+k+'：'+(v?'通过':'未通过')).join('\n')+'\n\n'+(result.builds?'| 构筑 | 单体 | 清怪 | 精英 | 生存 | 安全 | 预算 |\n|---|---:|---:|---:|---:|---:|---:|\n'+result.builds.matrix.map((r:any)=>'| '+r.build+' | '+spineScenes.map(s=>r.ratios[s]===null?'失败/未知':r.ratios[s].toFixed(4)).join(' | ')+' | '+(r.budget===null?'未知':r.budget.toFixed(4))+' |').join('\n'):'')+'\n');return result;
}
