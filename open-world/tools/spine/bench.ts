import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sampleCombatBuild,type BuildBenchmarkInput} from '../build-variety-benchmark.ts';
import {World,type CombatEvent} from '../../packages/simulation/index.ts';
import {regions,type Region} from '../../packages/content/index.ts';
import {monsterSkills} from '../../packages/content/chapter-combat.ts';
import {resolveMonsterSpawn} from '../../packages/rules/monster-stats.ts';
import {versions,type DamageType} from '../../packages/contracts/index.ts';
import {median,continuousBurstWindow} from './math.ts';
import {armorMitigation} from '../../packages/rules/combat-numerics.ts';
export type ResolvedPlayer={id:string;level:number;skillRanks:Record<string,number>;build:BuildBenchmarkInput['build']};
export const benchSeeds=[41,42,43];
export const measurementVersion='finite-window-v2-b3-tail' as const;
export const benchArena:Region={id:'spine-bench',name:'数值主干测量台',subtitle:'',theme:'meadow',width:64,height:64,safe:{x:24,y:24},portal:{x:2,y:2},obstacles:[],spawns:[],landmarks:[],boss:false,auto:true};
export type Axis='D1'|'dense'|'spread'|'B3'|'EHP'|'AV';
/** S1实测标准人可打穿1e9；统一扩大测量靶至1e15，避免重置和溢出裁剪，正式怪物不变。 */
export function targets(level:number,count:number,spread=false){return Array.from({length:count},(_,i)=>{
 const spawn=resolveMonsterSpawn({id:'spine-target-'+i,template:'raider',level,rank:'elite',x:count===1?27:spread?27+(i%6)*2.5:26.5+(i%4)*.8,y:count===1?24:spread?22.75+Math.floor(i/6)*2.5:23.2+Math.floor(i/4)*.8});
 spawn.hp=1e15;spawn.attack=0;return spawn;
});}
export function damageMix(level:number):DamageType[]{
 const spawns=regions.filter(r=>!r.boss).flatMap(r=>r.spawns).filter(s=>s.monster&&Math.floor((s.monster.level-1)/10)===Math.floor((level-1)/10));
 return spawns.length?spawns.flatMap(s=>['physical' as DamageType,...(s.monster?.skills??[]).map(id=>(monsterSkills[id]?.damageType??'physical') as DamageType)]):['physical'];
}
export function benchSample(player:ResolvedPlayer,axis:Axis,seed:number,standardHp:number,options:{extraTicks?:number;omitCast?:number;linearPressure?:boolean;spawns?:ReturnType<typeof targets>;stopWhen?:BuildBenchmarkInput['stopWhen'];seconds?:number}={}){
 assert(standardHp>0&&Number.isFinite(standardHp));
 const seconds=options.seconds??(axis==='B3'?3:axis==='EHP'?120:axis==='AV'?60:30),count=axis==='dense'||axis==='spread'?12:axis==='EHP'?3:axis==='AV'?4:1;
 const spawns=options.spawns??targets(player.level,count,axis==='spread'),mix=damageMix(player.level),rL=standardHp/20;
 let potentialRaw=0,receivedRaw=0,armorOnlyInput=0,grossLoss=0,healing=0,shieldAbsorbed=0,emitted=0,controlled=0,serial=1e7,castOrdinal=0;
 const damageFrames:Record<string,number>={},damageCasts:Record<string,number>={},began=performance.now();
 const hook:BuildBenchmarkInput['instrument']={created(w){
  // 替换测量台参考攻击者的调度，不改战斗执行器的伤害、状态、投射物、区域或随机计算。
  const engine=w as any;assert.equal(typeof engine.enemyStep,'function');assert.equal(typeof engine.hurt,'function');
  engine.enemyStep=()=>{};
  const hurt=engine.hurt.bind(w);engine.hurt=(amount:number,...args:any[])=>{receivedRaw+=amount;armorOnlyInput+=args[1]?.damageType==='pure'?amount:armorMitigation(amount,engine.effectiveStats().armor,w.rules.combatNumerics.armor).damage;return hurt(amount,...args);};
  if(options.omitCast!==undefined){const start=engine.cast.bind(w);engine.cast=(...args:any[])=>{const accepted=start(...args);if(accepted&&castOrdinal++===options.omitCast){const pending=engine.pending.find((p:any)=>p.skill.id===args[0]);if(pending)pending.at++;}return accepted;};}
 },afterStep(w){
  const engine=w as any,t=w.tick;
  if(axis==='EHP'&&t%10===0&&w.hero.hp>0){
   const i=(t/10-1)%3,e=w.enemies[i],raw=rL/3*(options.linearPressure?1+t/30/15:1);potentialRaw+=raw;emitted++;
   engine.withVfx({sourceId:e.id,castId:++serial},()=>engine.hurt(raw,'basic-melee',{category:'direct',damageType:mix[(t/10-1)%mix.length],scaled:true}));
  }
  if(axis==='AV'){
   // 四个攻击者沿固定方形路线匀速走动；控制会真实延误射击，分母保持未受控出手节拍。
   const corners=[{x:22,y:22},{x:29,y:22},{x:29,y:29},{x:22,y:29}];
   for(const [i,e]of w.enemies.entries())if(!engine.movementBlocked(e.id)){const phase=(t/240+i)%4,a=corners[Math.floor(phase)],b=corners[(Math.floor(phase)+1)%4],f=phase%1;e.position={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
   engine.grid.rebuild(w.enemies);
   if(t%15===0&&w.hero.hp>0){const i=(t/15-1)%4,e=w.enemies[i],raw=standardHp/240/2;potentialRaw+=raw;
    if(engine.actionBlocked(e.id)||engine.hasStatus(e.id,'silence'))controlled++;
    else{emitted++;const vfx={sourceId:e.id,castId:++serial},type=mix[(t/15-1)%mix.length];
     if(i%2){engine.withVfx(vfx,()=>engine.shoot(e.position,{...w.hero.position},raw,true,false,'basic-ranged'));w.projectiles.at(-1)!.damageType=type;}
     else{w.zones.push({...vfx,id:++serial,position:{...w.hero.position},radius:1.5,damage:raw,life:1,delay:15,enemy:true,slow:false,skill:'basic-area',damageType:type});}
    }
   }
  }
  for(const event of w.events){if(event.type==='hit_resolved'){
    if(event.id===w.playerId){if(w.enemies.some(e=>e.id===event.sourceId))grossLoss+=event.amount??0;}
    else{damageFrames[t]=(damageFrames[t]??0)+(event.amount??0);const key=String(event.castId??event.skill??'来源未分配');damageCasts[key]=(damageCasts[key]??0)+(event.amount??0);}
   }else if(event.type==='healed'&&event.id===w.playerId)healing+=event.amount??0;
   else if(event.type==='shielded'&&event.id===w.playerId&&event.shieldPhase==='absorbed')shieldAbsorbed+=event.amount??0;
  }
 }};
 const sample=sampleCombatBuild({requestedSkills:player.build.skills.map(s=>s.id),skillRanks:player.skillRanks,build:player.build,region:benchArena,spawns,seed,maxTicks:Math.round(seconds*30)+(options.extraTicks??0),mode:'auto',stopWhen:options.stopWhen??'window',instrument:hook});
 if(sample.failed==='window_target_exhausted')throw Error('测量窗口内目标耗尽，拒绝把截断伤害作为DPS：'+player.id+'/'+axis);
 const loss=Math.max(0,player.build.stats.hp-sample.hero.hp),censored=axis==='EHP'&&sample.deathSeconds===null&&loss<=0;
 const literalEHP=axis==='EHP'?(censored?null:sample.deathSeconds!==null?receivedRaw:receivedRaw*player.build.stats.hp/loss):null;
 // 净损失为0时原式发散。统一采用有限窗口已承受原始输入＋末态剩余生命的护甲等价输入。
 // 原式数值/删失标志同时保留，严禁用1点损失伪造有穷结果。
 const burstWindow=axis==='B3'?continuousBurstWindow(damageFrames,Math.round(seconds*30)+(options.extraTicks??0)):undefined;
 const value=axis==='EHP'?armorOnlyInput>0?receivedRaw+sample.hero.hp*receivedRaw/armorOnlyInput:null:axis==='AV'?potentialRaw?1-grossLoss/potentialRaw:null:burstWindow?burstWindow.value:sample.totalDamage/(seconds+(options.extraTicks??0)/30);
 return {axis,value,seed,level:player.level,player:player.id,seconds:sample.elapsed,deathSeconds:sample.deathSeconds,clearSeconds:sample.clearSeconds,censored,
  measurementVersion,rawWindowDps:sample.totalDamage/seconds,burstWindow,potentialRaw,receivedRaw,armorOnlyInput,literalEHP,grossLoss,healing,shieldAbsorbed,emitted,controlled,netHpLoss:loss,rL,damageMix:mix,
  maxFrameShare:sample.totalDamage?Math.max(0,...Object.values(damageFrames))/sample.totalDamage:0,maxCastShare:sample.totalDamage?Math.max(0,...Object.values(damageCasts))/sample.totalDamage:0,
  requested:sample.requested,executed:sample.executed,skillRanks:sample.skillRanks,casts:sample.casts,failures:sample.failures,totalDamage:sample.totalDamage,damageBySkill:sample.damageBySkill,rules:sample.rules,
  failed:sample.failed,remainingTargets:sample.remaining.length,runtimeMs:performance.now()-began};
}
export function benchPlayer(player:ResolvedPlayer,standardHp:number,seeds=benchSeeds){
 const rows=seeds.flatMap(seed=>(['D1','dense','spread','B3','EHP','AV'] as Axis[]).map(axis=>benchSample(player,axis,seed,standardHp)));
 const metrics=Object.fromEntries(['D1','B3','EHP','AV'].map(axis=>{const values=rows.filter(r=>r.axis===axis).map(r=>r.value);return [axis,values.some(v=>v===null)?null:median(values as number[])];}));
 const dn=median(seeds.map(seed=>{const v=rows.filter(r=>r.seed===seed&&['dense','spread'].includes(r.axis));return (v[0].value!+v[1].value!)/2;}));
 return {versions,measurementVersion,player:player.id,level:player.level,seeds,metrics:{...metrics,DN:dn,NT:dn/metrics.D1!},rows,censored:rows.filter(r=>r.censored).length,runtimeMs:rows.reduce((sum,r)=>sum+r.runtimeMs,0)};
}
