/** M10实际营地：消费服务端同一相位等级表、营地布置和World，不把通用木桩当野外验收。 */
import {sampleCombatBuild,type BuildBenchmarkInput} from '../build-variety-benchmark.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {regionById} from '../../packages/content/index.ts';
import {characterWorldTables} from '../../packages/rules/world-levels.ts';
import {worldPhaseVisible} from '../../packages/rules/world-phase.ts';
import {campSpawns} from '../../packages/rules/world-camps.ts';
import {World,walkable} from '../../packages/simulation/index.ts';
import {lineOfSight} from '../../packages/simulation/navigation.ts';
import {standardState,resolvePlayer} from './player.ts';
import {save,readJson,evidence,stamp} from './io.ts';
import {median} from './math.ts';
function noCritical(build:ReturnType<typeof resolvePlayer>['build']){
 const copy=structuredClone(build);copy.stats.critChance=0;
 for(const c of copy.stats.conditional??[])if(c.stat==='critChance')c.value=0;
 for(const r of [...copy.stats.rules??[],...copy.stats.combos??[]] as any[]){const a=r.action;if(a?.type==='buff'){if(a.mods&&'critChance'in a.mods)a.mods.critChance=0;if(a.flags?.forceCrit)a.flags.forceCrit=false;for(const mods of a.alternate??[])if('critChance'in mods)mods.critChance=0;for(const p of a.variants??[])if('critChance'in p.mods)p.mods.critChance=0;}}
 for(const skill of copy.skills)if(skill.runtimeEffects?.forceCrit)skill.runtimeEffects.forceCrit=false;return copy;
}
export async function measureAuthoredField(output:string){
 const rows:any[]=[],oneHitRows:any[]=[];
 for(const level of [10,20,30,40,50]){
  const state=standardState(level),tables=characterWorldTables(state,worldTables),zone=[...tables.zones].filter(z=>tables.camps.some(c=>c.zone===z.id&&worldPhaseVisible(state,c)&&c.pack.some(p=>p.rank==='elite'))).sort((a,b)=>Math.abs((a.levelBand[0]+a.levelBand[1])/2-level)-Math.abs((b.levelBand[0]+b.levelBand[1])/2-level))[0],camp=tables.camps.find(c=>c.zone===zone.id&&worldPhaseVisible(state,c)&&c.pack.some(p=>p.rank==='elite'))!,region=regionById(camp.region),spawns=campSpawns(region,tables,camp,1),player=resolvePlayer('authored-field-'+level,state);
  let position;for(const radius of [5,4,3])for(let n=0;n<16&&!position;n++){const p={x:camp.x+Math.cos(n*Math.PI/8)*radius,y:camp.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,p,1))position=p;}if(!position)throw Error('实际营地没有合法探针位置 '+camp.id);
  for(const rank of ['normal','elite'] as const)for(const pressure of [false,true])for(const seed of [41,42,43]){
   const chosen=spawns.filter(s=>rank==='normal'?!s.elite:s.elite&&!s.boss);if(!chosen.length)throw Error('营地缺少目标档位 '+camp.id+'/'+rank);const targets=structuredClone(chosen);if(pressure)targets.forEach(s=>s.hp=1e15);const path=output+'/arms/authored-'+level+'-'+rank+'-'+pressure+'-'+seed+'.json';let sample;try{sample=await readJson(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;sample=sampleCombatBuild({requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:{...region,safe:position},spawns:targets,seed,maxTicks:120*30,mode:'auto',stopWhen:pressure?'death':'clear',approachTargets:true});await save(path,sample);}
   rows.push({level,rank,pressure,seed,camp:camp.id,region:region.id,monsterLevels:chosen.map(s=>s.monster!.level),targets:chosen.length,ttk:sample.clearSeconds,ttd:sample.deathSeconds??sample.elapsed,censored:pressure&&sample.deathSeconds===null,failed:sample.failed,source:await evidence(path)});
  }
  const primary=player.build.skills.find(s=>s.damage>0&&['area','zone','dash'].includes(s.kind));if(!primary)throw Error('标准人缺少主群攻技能');
  for(const seed of [41,42,43]){
   const path=output+'/arms/one-hit-observed-'+level+'-'+seed+'.json';let raw;
   try{raw=await readJson(path);}catch(e){
    if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const normals=spawns.filter(s=>!s.elite),build=noCritical({...player.build,skills:[primary]}),observations=[];
    for(const focus of normals){
     let adjacent;for(const radius of [1.25,1.5,2])for(let n=0;n<16&&!adjacent;n++){const p={x:focus.x+Math.cos(n*Math.PI/8)*radius,y:focus.y+Math.sin(n*Math.PI/8)*radius};if(walkable(region,p,1)&&lineOfSight(region,p,{x:focus.x,y:focus.y}))adjacent=p;}if(!adjacent)throw Error('一刀线目标附近没有合法可见站位 '+focus.id);
     const targets=structuredClone(normals);for(const s of targets){s.hp=1e15;s.attack=0;}
     const w=new World({...region,safe:adjacent},build.stats,build.skills,targets,[],seed);w.setMode('auto');(w as any).enemyStep=()=>{};let hit:number|null=null,castCount=0;
     for(let tick=0;tick<450&&hit===null&&w.hero.hp>0;tick++){w.step();for(const event of w.events){if(event.type==='cast_started'&&event.id===w.playerId)castCount++;if(event.type==='hit_resolved'&&event.id===focus.id&&event.skill===primary.id&&event.category==='direct'){if(event.crit)throw Error('非暴击投影遗漏来源');hit=event.amount??0;}}}
     observations.push({id:focus.id,hp:focus.hp,hit,passed:hit!==null&&hit>=focus.hp,ticks:w.tick,castCount,position:adjacent,armor:focus.monster!.armor});
    }
    raw={level,seed,camp:camp.id,skill:primary.id,scope:'仅主群攻且精确去暴击；每目标附近合法可见站位。保留原营地普通怪位置/数量/护甲/地形，敌方AI关闭、非攻击无限HP靶不放大敌方护盾；只比较首次直接命中与原始HP。未命中仍计分母，不补角色生命法力',targets:observations};await save(path,raw);
   }
   oneHitRows.push({level,seed,camp:camp.id,skill:raw.skill,targets:raw.targets,source:await evidence(path)});
  }
 }
 const aggregate=[];for(const level of [10,20,30,40,50])for(const rank of ['normal','elite'])for(const pressure of [false,true]){const samples=rows.filter(r=>r.level===level&&r.rank===rank&&r.pressure===pressure),values=samples.map(r=>pressure?r.ttd:r.ttk);aggregate.push({level,rank,pressure,camp:samples[0].camp,monsterLevels:samples[0].monsterLevels,ttk:pressure?null:values.some(v=>v===null)?null:median(values),ttd:pressure?median(values):null,censored:pressure&&samples.every(s=>s.censored),samples});}
 const all=oneHitRows.flatMap(r=>r.targets),result={...stamp(),rows:aggregate,oneHitRows,oneHitRate:all.filter(r=>r.passed).length/all.length};await save(output+'/authored-field-summary.json',result);return result;
}
