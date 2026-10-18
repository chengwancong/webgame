import {sampleCombatBuild,type BuildBenchmarkInput} from '../build-variety-benchmark.ts';
import {benchArena} from './bench.ts';
import {standardState,resolvePlayer} from './player.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {monsterContent} from '../../packages/content/monsters.ts';
import {regions} from '../../packages/content/index.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {campSpawns} from '../../packages/rules/world-camps.ts';
import {median} from './math.ts';
import {save,review,readJson,stamp,evidence,decision} from './io.ts';
export function fieldSample(level:number,rank:'normal'|'elite'|'rare'|'boss',seed=41,pressure=false){
 const state=standardState(level),player=resolvePlayer('field-'+level,state),spawns=Array.from({length:rank==='normal'?12:1},(_,i)=>resolveMonsterSpawn({id:'field-'+i,template:'raider',level,rank,x:26.5+(i%4)*.8,y:23.2+Math.floor(i/4)*.8}));
 if(pressure)for(const spawn of spawns)spawn.hp=1e15;
 let firstHit:number|null=null,maxHitsPerCast=0;const casts=new Map<string,number>(),critical=new Set<number>();
 const instrument:BuildBenchmarkInput['instrument']={afterStep(w){for(const e of w.events){if(e.type==='hit_resolved'&&e.id!==w.playerId&&e.category==='direct'&&e.amount&&e.castId&&!e.crit){firstHit??=e.amount;const key=String(e.castId);casts.set(key,(casts.get(key)??0)+1);maxHitsPerCast=Math.max(maxHitsPerCast,casts.get(key)!);}}}};
 const sample=sampleCombatBuild({requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:benchArena,spawns,seed,maxTicks:120*30,mode:'auto',stopWhen:pressure?'death':'clear',instrument});
 return {level,rank,seed,pressure,firstHit,maxHitsPerCast,hp:spawns[0].hp,sample,ttk:sample.clearSeconds,ttd:sample.deathSeconds??sample.elapsed,censored:pressure&&sample.deathSeconds===null};
}
export async function measureField(output:string,levels=[10,20,30,40,50],seeds=[41]){
 const rows=[];for(const level of levels)for(const rank of ['normal','elite','rare','boss'] as const)for(const pressure of [false,true])for(const seed of seeds){const path=output+'/arms/field-'+level+'-'+rank+'-'+(pressure?'pressure':'kill')+'-'+seed+'.json';let r;try{r=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;r=fieldSample(level,rank,seed,pressure);await save(path,r);}rows.push({level,rank,seed,pressure,ttk:r.ttk,ttd:r.ttd,hit:r.firstHit,censored:r.censored,oneHit:r.firstHit!==null&&r.firstHit>=r.hp,source:await evidence(path)});}
 await save(output+'/field-summary.json',{...stamp(),levels,seeds,rows});return rows;
}
export async function completeFieldTargets(){
 const rows=await measureField(review+'/S2',[5,15,25,35,45,55],[41,42,43]),targetData=await readJson('config/json/spine-targets.json');
 const add=(key:string,level:number,value:number,unit:string)=>{const levels=(Math.floor((level-1)/10)*10+1)+'–'+(Math.floor((level-1)/10)*10+10);if(!targetData.targets.some((t:any)=>t.key===key&&t.levels===levels))targetData.targets.push({key,levels,value,unit,source:'实测',reference:'S2/field-summary.json：当前标准人L'+level+'，种子41/42/43中位数，时间取0.5秒档；120秒存活为下界',locked:false,date:'2026-10-14'});};
 for(const level of [5,15,25,35,45,55]){
  add('field.oneHit',level,1,'非暴击命中次数');
  for(const rank of ['normal','elite','rare'] as const){const samples=rows.filter(r=>r.level===level&&r.rank===rank&&!r.pressure);const seconds=median(samples.map(r=>r.ttk??120));add('field.ttk.'+rank,level,Math.max(.5,Math.round(seconds*2)/2),'秒');}
  for(const rank of ['normal','elite','boss'] as const){const seconds=median(rows.filter(r=>r.level===level&&r.rank===rank&&r.pressure).map(r=>r.ttd));add('danger.ttd.'+rank,level,Math.max(.5,Math.round(seconds*2)/2),'秒');}
 }
 await save(review+'/S2/complete-targets.json',targetData);return targetData;
}
