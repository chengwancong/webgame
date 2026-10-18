/** 用户授权后的配对诊断；不改正式内容、不更新锚点或canonical模型。 */
import {benchSample,benchArena,targets,type Axis} from './bench.ts';
import {resolvePlayer,standardState,referencePlayer,standardLevels} from './player.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {sampleCombatBuild} from '../build-variety-benchmark.ts';
import {save,review,stamp,evidence} from './io.ts';
import {median} from './math.ts';
const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??review+'/S8/measurement-repair',standard=resolvePlayer('标准人50',standardState(50)),opening=referencePlayer('opening').player;const rows:any[]=[];
const players=process.argv.includes('--all')?[...standardLevels.map(L=>resolvePlayer('标准人'+L,standardState(L))),...pacingProfiles.map(p=>referencePlayer(p.id).player)]:[standard,opening];
for(const player of players)for(const axis of ['D1','dense','spread','B3','EHP','AV'] as Axis[])for(const seed of [41,42,43]){
 const hp=player.id.startsWith('标准人')?player.build.stats.hp:standard.build.stats.hp,base=benchSample(player,axis,seed,hp);
 for(const options of [{omitCast:0},{extraTicks:1}]){const next=benchSample(player,axis,seed,hp,options);rows.push({player:player.id,axis,seed,options,base:base.value,next:next.value,error:base.value&&next.value?next.value/base.value-1:null,baseCasts:base.casts,nextCasts:next.casts,baseDamage:base.damageBySkill,nextDamage:next.damageBySkill});}
}
const traces=[];
for(const delayed of [false,true]){
 const events:any[]=[],castChanges:any[]=[];let ordinal=0;
 const result=sampleCombatBuild({requestedSkills:standard.build.skills.map(s=>s.id),skillRanks:standard.skillRanks,build:standard.build,region:benchArena,spawns:targets(50,1),seed:41,maxTicks:90,mode:'auto',stopWhen:'window',instrument:{created(w){const engine=w as any;engine.enemyStep=()=>{};const cast=engine.cast.bind(w);engine.cast=(...args:any[])=>{const accepted=cast(...args);if(accepted){const n=ordinal++,pending=engine.pending.find((p:any)=>p.skill.id===args[0]);if(n===0&&delayed&&pending)pending.at++;castChanges.push({n,tick:w.tick,skill:args[0],release:pending?.at,actionUntil:w.hero.actionUntil,cooldown:w.cooldowns[args[0]]});}return accepted;};},afterStep(w){events.push(...structuredClone(w.events));}}});
 const path=output+'/arms/B3-'+(delayed?'delay':'baseline')+'.json';await save(path,{...stamp(),delayed,result,castChanges,events});traces.push({delayed,totalDamage:result.totalDamage,castChanges,hits:events.filter(e=>e.type==='hit_resolved').map(e=>({tick:e.tick,skill:e.skill,amount:e.amount,category:e.category,crit:e.crit,castId:e.castId})),source:await evidence(path)});
}
const aggregate=[...new Set(rows.map(r=>r.player+'/'+r.axis+'/'+JSON.stringify(r.options)))].map(key=>{const group=rows.filter(r=>r.player+'/'+r.axis+'/'+JSON.stringify(r.options)===key),base=median(group.map(r=>r.base!)),next=median(group.map(r=>r.next!));return {key,base,next,error:next/base-1};});
await save(output+'/diagnosis-summary.json',{...stamp(),rows,traces,aggregate});console.log(JSON.stringify({players:players.length,errors:aggregate.filter(r=>Math.abs(r.error)>=.02),maximum:Math.max(...aggregate.map(r=>Math.abs(r.error))),rawMaximum:Math.max(...rows.map(r=>Math.abs(r.error??Infinity)))}));
