import {writeFile} from 'node:fs/promises';
import {runPacingCalendar} from '../pacing/run-calendar.mjs';
import {pacingTargets} from '../../packages/content/pacing-targets.ts';
import {proposeKeyPoolRefresh} from '../propose-world-numeric-refresh.ts';
import {median} from './math.ts';
import {readJson,save,review,data,stamp,evidence,decision} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
export async function naturalTimeline(output:string){
 const rows:any[]=[];for(const seed of [41,42,43]){const directory=output+'/natural/seed-'+seed;let raw:any=null,error:string|null=null;try{try{raw=await readJson(directory+'/natural-calendar-no-quests.json');const clean=await readJson(directory+'/cleanup.json');if(!raw.results?.[0]||!clean.stopped||(clean.bytes_after??clean.remainingBytes??Infinity)!==0)throw Error('日程证据或临时库清理无效');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await runPacingCalendar(directory,seed);raw=await readJson(directory+'/natural-calendar-no-quests.json');}if(!raw.results?.[0])throw Error('自然日程未生成结果');}catch(e){error=String(e);}
  if(error||!raw?.results?.[0]){const cleanup=await readJson(directory+'/cleanup.json').catch(()=>null);rows.push({seed,level:null,minutes:null,failures:[error],bosses:[],milestones:[],observations:null,cleanup,source:await evidence(directory+'/calendar.log').catch(()=>null)});console.error('自然日程种子'+seed+'失败，保留样本并继续验证其他套件：'+error);continue;}
  const result=raw.results[0];rows.push({seed,level:result.level,minutes:result.minutes,failures:result.failures,bosses:result.bosses,milestones:result.milestones,observations:result.observations,source:await evidence(directory+'/natural-calendar-no-quests.json')});console.log('自然日程种子'+seed+'：'+result.minutes+'分钟，L'+result.level);
 }
 const milestones=pacingTargets.milestones.filter(t=>t.kind==='level').map(t=>{const values=rows.map(r=>r.milestones.find((m:any)=>!m.boss&&!m.region&&m.level>=t.level)?.minutes??null);return {id:t.id,level:t.level,target:t.targetMinutes,actual:values.every(v=>v!==null)?median(values as number[]):null,values};}),times=rows.map(r=>r.minutes);const result={...stamp(),rows,milestones,minutes:times.every(v=>v!==null)?median(times as number[]):null,min:times.every(v=>v!==null)?Math.min(...times as number[]):null,max:times.every(v=>v!==null)?Math.max(...times as number[]):null};await save(output+'/calendar-summary.json',result);return result;
}
export function segmentExperience(thresholds:number[],milestones:{level:number;target:number;actual:number|null}[]){
 const next=[...thresholds],segments=[];let previous={level:1,target:0,actual:0};for(const row of [...milestones].sort((a,b)=>a.level-b.level)){if(row.actual===null||row.actual<=previous.actual||row.target<=previous.target)throw Error('里程碑时间缺失或不单调，不能缩放经验');const factor=(row.target-previous.target)/(row.actual-previous.actual);for(let level=previous.level;level<row.level;level++)next[level-1]=Math.max(1,Math.round(thresholds[level-1]*factor));segments.push({from:previous.level,to:row.level,factor,actualInterval:row.actual-previous.actual,targetInterval:row.target-previous.target});previous={...row,actual:row.actual};}for(let i=1;i<next.length;i++)next[i]=Math.max(next[i],next[i-1]);return {thresholds:next,segments};
}
export async function deriveProgression(output=review+'/S6',apply=false,calendarPath=output+'/calendar-summary.json'){
 const calendar=await readJson(calendarPath),raw=await readJson('packages/content/progression-curve.json'),xp=segmentExperience(raw.thresholds,calendar.milestones),changes:SpineChange[]=[];
 xp.thresholds.forEach((after,i)=>{if(after!==raw.thresholds[i])changes.push({file:'packages/content/progression-curve.json',path:['thresholds',i],before:raw.thresholds[i],after,basis:'M9里程碑区间统一乘目标区间分钟/三种子实测区间分钟；整数单调投影。区间='+JSON.stringify(xp.segments.find(s=>i+1>=s.from&&i+1<s.to))});});
 if(output===review+'/S6'){
  const targets=(await readJson('config/json/spine-targets.json')).targets,efficiency=await readJson(review+'/S5/efficiency-summary.json'),pools=await readJson('apps/api/src/stage-key-pools.json');
  const stages=pools.pools.map((p:any)=>{const t=targets.find((t:any)=>t.key==='stage.'+p.stage+'.push');if(!t)throw Error('缺阶段目标 '+p.stage);return {index:p.stage,level:Number(t.levels),push:t.value,lam:Math.log(2)/t.value};});
  const bases=stages.map((s:any)=>{const row=[...efficiency.field].filter((r:any)=>r.seconds>0&&r.eliteKills>0).sort((a,b)=>Math.abs(a.level-s.level)-Math.abs(b.level-s.level))[0];if(!row)throw Error('缺少实测精英击杀频率');return {stage:s.index,elitePerMinute:row.eliteKills/row.seconds*60,samples:[{kills:row.eliteKills,seconds:row.seconds,completed:!row.failed,survived:true}]};});
  const key=proposeKeyPoolRefresh(pools,stages,bases);for(let i=0;i<pools.pools.length;i++)for(const field of ['level','dropProbability','required','basis']){const before=pools.pools[i][field],rawAfter=key.content.pools[i][field],after=field==='dropProbability'?Number((Math.max(.05,Math.round(rawAfter/.05)*.05)).toFixed(2)):rawAfter;if(JSON.stringify(before)!==JSON.stringify(after))changes.push({file:'apps/api/src/stage-key-pools.json',path:['pools',i,field],before,after,basis:'M9复用proposeKeyPoolRefresh；阶段锁定开荒时间、当前主干实测精英频率；λ=ln2/目标分钟，掉率0.05档'});}
  await save(output+'/keys-summary.json',{stages,bases,changes:key.changes});
 }
 await save(output+'/progression-plan.json',{...stamp(),changes,segments:xp.segments,calendar:calendarPath});await save(output+'/progression-summary.json',{...stamp(),changes:changes.length,segments:xp.segments});return applySpinePlan('.',changes,spineSchemas,{apply,output});
}
