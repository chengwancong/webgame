/**
 * 开场「坠星觉醒」的沙盒战斗（docs/opening-hook-design.md）：刷怪节奏、潮能、回响爆发、巨兽。
 * 不碰 DOM，客户端开场控制器（prologue-controller.ts）和巨兽血量推导工具（tools/prologue-build.ts）共用这一份，
 * 推导量的就是玩家实际打的那一场。字幕、震屏、阶段切换通过 hooks 交给宿主。
 */
import {World,walkable,findPath} from '../../../packages/simulation/index.ts';
import {regionById} from '../../../packages/content/index.ts';
// 真实野外岛（512 格风栖岛）在这个模块里注册、替换掉同名的 64 格静态占位图；开场必须打在玩家实际站的岛上，不能取决于谁先 import。
import '../../../packages/content/open-world/index.ts';
import {resolveMonsterSpawn} from '../../../packages/rules/monster-stats.ts';
import {prologueConfig,type PrologueFamily} from '../../../packages/content/starsea/prologue.ts';
import type {Spawn,Vec} from '../../../packages/contracts/index.ts';

export type PrologueConfig=typeof prologueConfig;
export type BattlePhase='land'|'waves'|'boss'|'fade'|'done';
export type PrologueBattleHooks={phase?(phase:BattlePhase):void;say?(text:string,seconds:number):void;shake?(px:number,ms:number):void};
export const T=30;

export class PrologueBattle{
 phase:BattlePhase='land';clock=0;wave=0;energy=0;burstQueued=false;bossId='';
 readonly world:World;
 private phaseAt=0;private queued:Spawn[]=[];private nextSpawn=0;private waveIds=new Set<string>();private serial=0;private counted=new Set<string>();
 constructor(readonly family:PrologueFamily,private o:{config?:PrologueConfig;automation?:Record<string,unknown>;motionReduced?:()=>boolean;hooks?:PrologueBattleHooks}={}){
  const c=this.config,f=c.families[family],region={...regionById(c.map),spawns:[]};
  const w=new World(region,structuredClone(f.granted.stats),structuredClone(f.granted.skills),[],[],f.measured.singleDps%9973||1);
  Object.assign(w,o.automation??{});w.mode='semi';w.autoSkills=true;this.world=w;
 }
 get config(){return this.o.config??prologueConfig;}
 get queuedCount(){return this.queued.length;}
 get boss(){return this.world.enemies.find(e=>e.id===this.bossId);}
 private get reduced(){return this.o.motionReduced?.()??false;}
 private go(phase:BattlePhase){this.phase=phase;this.phaseAt=this.clock;this.o.hooks?.phase?.(phase);}
 private say(text:string,seconds:number){this.o.hooks?.say?.(text,seconds);}
 private shake(px:number,ms:number){if(!this.reduced)this.o.hooks?.shake?.(px,ms);}
 /** 每个逻辑帧调用一次；move 为已换算到世界坐标的方向键输入。 */
 step(move:Vec){
  if(this.phase==='done')return;this.clock++;const w=this.world,c=this.config,age=this.clock-this.phaseAt;
  if(this.phase!=='fade')w.control(move.x,move.y);else w.control(0,0);
  if(w.hero.hp<w.stats.hp*.25)w.hero.hp=w.stats.hp;
  if(this.phase==='land'&&age>=2*T){this.go('waves');this.startWave(0);}
  if(this.phase==='waves'){
   if(this.queued.length&&this.clock>=this.nextSpawn){w.addSpawns(this.queued.splice(0,c.waveCadence.groupSize));this.nextSpawn=this.clock+Math.round(c.waveCadence.everySeconds*T);}
   if(!this.queued.length&&!w.enemies.some(e=>e.alive&&this.waveIds.has(e.id))){if(this.wave+1<c.waves.length)this.startWave(this.wave+1);else this.startBoss();}
  }
  if(this.phase==='boss'){const boss=this.boss;
   if(boss&&boss.alive&&boss.hp<=boss.maxHp*c.burst.bossUnlock&&this.energy<c.burst.kills){this.energy=c.burst.kills;this.say(c.lines.bossUnlock,6);}
   if(!boss||!boss.alive){this.go('fade');this.say(c.lines.fade,5);}
  }
  this.tryBurst();
  // 巨兽倒下后放慢 0.6 秒战斗时间（半速，实时 1.2 秒）；沙盒没有服务端时钟要对齐。减少动态时不放慢。
  const slow=this.phase==='fade'&&!this.reduced&&this.clock-this.phaseAt<1.2*T&&this.clock%2===1;
  if(!slow)w.step();
  for(const k of w.kills)if(!this.counted.has(k.source_id)){this.counted.add(k.source_id);if(this.phase==='waves'&&this.energy<c.burst.kills){this.energy++;if(this.energy===c.burst.kills)this.say(c.lines.energyFull,4);}}
  if(this.phase==='fade'&&this.clock-this.phaseAt>=4*T)this.go('done');
 }
 queueBurst(){if(this.energy>=this.config.burst.kills&&(this.phase==='waves'||this.phase==='boss'))this.burstQueued=true;}
 private startWave(i:number){
  const c=this.config,count=c.waves[i];this.wave=i;this.waveIds=new Set();this.queued=[];
  for(let n=0;n<count;n++){const s=this.spawnNear(c.mob.template,'normal',c.waveCadence.spawnRadius);if(s){this.queued.push(s);this.waveIds.add(s.id);}}
  this.nextSpawn=this.clock+(i?T:0);if(i&&c.lines.waves[i-1])this.say(c.lines.waves[i-1],3);
 }
 private startBoss(){
  const c=this.config,d=c.families[this.family].bossDifficulty,s=this.spawnNear(c.boss.template,'boss',7,d);if(!s)return;s.name=c.boss.name;this.bossId=s.id;this.world.addSpawns([s]);this.go('boss');this.say(c.lines.boss,4);this.shake(5,600);
 }
 /** 在英雄周围一圈找刷怪点：要能站、而且从英雄那里走得到（落点靠近岛缘时，悬崖下的空地不算）。 */
 private spawnNear(template:string,rank:'normal'|'boss',radius:number,difficulty={hp:1,attack:1}):Spawn|undefined{
  const w=this.world,c=this.config,h=w.hero.position;
  for(let tries=0;tries<24;tries++){const a=(this.serial*2.39996+tries*.7)%(Math.PI*2),r=radius*(1+(tries%3)*.15),p={x:h.x+Math.cos(a)*r,y:h.y+Math.sin(a)*r};
   if(!walkable(w.region,p)||!findPath(w.region,h,p).length)continue;const s=resolveMonsterSpawn({id:`prologue-${rank}-${this.serial++}`,template,level:rank==='boss'?c.boss.level:c.mob.level,rank,x:p.x,y:p.y},undefined,{...difficulty,armor:1});
   if(s.monster)s.monster.ai.aggroRadius=60;return s;}
  return undefined;
 }
 /** 回响爆发平时不在技能列表里（否则自动施法会放它）；按键时才加进去，放出后靠 9000 帧冷却挡住自动施法，下次按键再清冷却。
  * 半自动连放会一直占着施法位，所以排队期间先停自动施法；正在引导的旋转类技能直接被爆发打断。放出后恢复自动施法。 */
 private tryBurst(){
  const w=this.world;if(!this.burstQueued)return;w.autoSkills=false;const echo=this.config.families[this.family].burst,target=w.enemies.filter(e=>e.alive).sort((a,b)=>(b.boss?1:0)-(a.boss?1:0)||Math.hypot(a.position.x-w.hero.position.x,a.position.y-w.hero.position.y)-Math.hypot(b.position.x-w.hero.position.x,b.position.y-w.hero.position.y))[0];if(!target)return;
  if(!w.skills.some(s=>s.id===echo.id))w.skills=[...w.skills,structuredClone(echo)];delete w.cooldowns[echo.id];
  const point=echo.mechanics?.targeting==='ground'?(target.boss?target.position:w.densestSpot(echo.range,echo.radius)?.point??target.position):undefined;
  if(w.lastCastFailure==='busy')w.sequences=w.sequences.filter(q=>q.sourceId!==w.playerId);
  if(w.cast(echo.id,target,point)){this.burstQueued=false;w.autoSkills=true;this.energy=0;this.say('回响·'+this.config.families[this.family].echo+'！',2);this.shake(6,360);}
 }
}

/** 推导和验收用的玩家策略：身边 6 格内有敌人就站着打（技能自动放），没有就朝最近的敌人走。
 * 回响爆发：eager 潮能一满就按（字幕提示的做法），hold 留到巨兽战再按。 */
export function playPrologue(family:PrologueFamily,policy:'eager'|'hold',config?:PrologueConfig){
 const b=new PrologueBattle(family,{config});let bossAt=-1,deadAt=-1,bursts=0,walking=0,lowest=1;
 for(let tick=0;tick<T*240&&b.phase!=='fade'&&b.phase!=='done';tick++){
  if(b.energy>=b.config.burst.kills&&!b.burstQueued&&(b.phase==='boss'||b.phase==='waves'&&policy==='eager')){b.queueBurst();bursts++;}
  let move={x:0,y:0};const h=b.world.hero.position;
  if(b.phase==='waves'||b.phase==='boss'){const near=b.world.enemies.filter(e=>e.alive).map(e=>({e,d:Math.hypot(e.position.x-h.x,e.position.y-h.y)})).sort((x,y)=>x.d-y.d)[0];
   if(near&&near.d>6){move={x:(near.e.position.x-h.x)/near.d,y:(near.e.position.y-h.y)/near.d};walking++;}}
  b.step(move);const now=b.phase as BattlePhase;// step 会改阶段，别沿用循环条件里的收窄
  if(now==='boss'&&bossAt<0)bossAt=b.clock;
  if(now==='fade'&&deadAt<0)deadAt=b.clock;
  lowest=Math.min(lowest,b.world.hero.hp/b.world.stats.hp);
 }
 const r=(n:number)=>Math.round(n*10)/10;
 return {family,policy,finished:bossAt>0&&deadAt>bossAt,bossSeconds:deadAt>bossAt&&bossAt>0?r((deadAt-bossAt)/T):null,openingSeconds:deadAt>0?r(deadAt/T):null,stalledIn:deadAt>0?null:b.phase+(b.phase==='waves'?' '+b.wave:''),burstPresses:bursts,walkSeconds:r(walking/T),lowestHeroHp:Math.round(lowest*100)/100};
}
