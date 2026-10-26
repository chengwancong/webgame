import type {Skill,Stats} from '../contracts/index.ts';
import {executableRule,type EffectRule} from '../contracts/effects.ts';
import {prologueConfig,type PrologueFamily} from '../content/starsea/prologue.ts';
import type {World,Entity} from './index.ts';
/**
 * 27 号 R3 出手点：爆发能量与爆发键、首领破绽窗口、宠物指令（planning-bd-v1/27 §4）。
 * 只在副本里开（World.burstEnabled，服务端副本打开）；野外不放常驻爆发键（10-16 开场裁决，D-A6）。
 * 爆发技能沿用开场三套回响（剑刃风暴/星辰法阵/飞刃之雨），伤害按本人技能栏的理论秒伤折算，不用开场的固定大数。
 */
export const burstRules={
 max:100,
 /** 击杀普通怪/精英；连杀（3 秒内）每层再 +1，最多 +5。首领击杀不给。 */kill:3,eliteKill:12,streakWindow:90,streakCap:5,
 /** 受击：掉 1% 生命 +0.3 能量。 */hurtPerHp:30,
 /** 首领在活动半径内时每秒 +4（约 25 秒一管）。窗口打开时不送能量，免得自动释放正好落进窗口。 */bossPerSecond:4,
 /** 爆发总伤 ≈ 技能栏理论秒伤 × seconds；破绽窗口里放再 ×windowBurst（叠上窗口加成约 ×2.6）。 */seconds:2,windowBurst:2,
 /** 破绽窗口：首领读条 ≥1.3 秒的大招结算（或被打断）后 2.5 秒，受到伤害 +30%；同一首领两次窗口至少隔 10 秒；首领 18 秒没出大招时补一次「力竭」窗口。 */
 window:{ticks:75,bonus:.3,minWindup:40,gap:10*30,tiredTicks:18*30},
 /** 宠物指令：每场（每个首领）一次。伤害型宠物把自身技能按 ×5 打在当前目标上；护盾型宠物给全队回 25% 生命并套双倍护盾。 */
 pet:{charges:1,damageScale:5,heal:.25,shieldScale:2},
} as const;
export type BurstState={energy:number;lastHp:number;lastKill:number;streak:number;queued:boolean;casts:number;castAt:number;inWindow:number};
export type PetCommandState={left:number;usedAt:number;uses:number};
export type BreakWindow={boss:string;from:number;until:number;bonus:number;reason:'heavy'|'interrupt'|'tired'};
export const newBurst=():BurstState=>({energy:0,lastHp:-1,lastKill:-999,streak:0,queued:false,casts:0,castAt:-1,inWindow:0});
export const newPetCommand=():PetCommandState=>({left:burstRules.pet.charges,usedAt:-1,uses:0});
const families=prologueConfig.families;
export const burstSkillIds=new Set(Object.values(families).map(f=>f.burst.id));
export function burstFamily(weapon:string|null|undefined):PrologueFamily{return weapon==='staff'||weapon==='wand'?'staff':weapon==='bow'||weapon==='hidden'?'hidden':'sword';}
const hitsOf=(s:Skill)=>(s.mechanics?.schedule?.hits??s.mechanics?.zone?.hits??1)*Math.min(3,s.projectiles??1);
/** 技能栏理论秒伤：每个伤害技能 单次伤害×段数 / 冷却（至少 1 秒）之和。不看蓝量，只用来给爆发定量。 */
export function skillBarDps(skills:Skill[]){return skills.filter(s=>s.damage>0&&!burstSkillIds.has(s.id)).reduce((n,s)=>n+s.damage*hitsOf(s)*30/Math.max(30,s.cooldown),0);}
/** 爆发技能：本人武器对应的回响，按技能栏秒伤重新定伤害；冷却挡住自动施法，只能由能量放出。 */
export function burstSkill(stats:Pick<Stats,'weapon'>,skills:Skill[],inWindow=false):Skill{
 const f=families[burstFamily(stats.weapon)],out=structuredClone(f.burst) as Skill,total=Math.max(1,skillBarDps(skills)*burstRules.seconds*(inWindow?burstRules.windowBurst:1));
 // 每个目标吃到的总量≈total：剑 5 段；法阵 4 段 + 灼烧 20%；飞刃对首领大约中 6 把。
 const parts=burstFamily(stats.weapon)==='sword'?5:burstFamily(stats.weapon)==='staff'?4/.8:6;
 out.damage=Math.max(1,Math.round(total/parts));
 if(out.mechanics?.statuses)out.mechanics.statuses=out.mechanics.statuses.map(st=>st.kind==='burn'?{...st,total:Math.round(total*.2)}:st);
 out.cooldown=9000;out.cost=0;return out;
}
export const burstName=(weapon:string|null|undefined)=>families[burstFamily(weapon)].burst.name;
/** 当前玩家（forPlayer 上下文里）身上的宠物主动技能。 */
export function petRule(stats:Pick<Stats,'rules'>):EffectRule|undefined{return (stats.rules??[]).find((r):r is EffectRule=>'icd' in r&&r.id.startsWith('pet-')&&String(r.source).startsWith('pet:'));}
export const windowOpen=(w:Pick<World,'breakWindow'|'tick'>,boss?:string)=>!!w.breakWindow&&w.breakWindow.until>w.tick&&(!boss||w.breakWindow.boss===boss);

type Any=World;
const t0=(w:World,boss:Entity)=>w.tick-(w.breakOpened[boss.id]??-1e9);
// World 的私有方法只在这里借用。
type Priv={comboAct(r:ReturnType<typeof executableRule>,e:Entity,reference:number,depth:number,carried:never[]):void;restoreResources(hp:number,mana:number,skill:string):void;effectProxy():Entity};
const priv=(w:World)=>w as unknown as Priv;
const each=(w:Any,fn:()=>void)=>{if(w.players.size){for(const p of w.players.values())if(p.active&&p.hero.hp>0)w.forPlayer(p.id,fn);}else fn();};
function openWindow(w:Any,boss:Entity,reason:BreakWindow['reason']){
 if(t0(w,boss)<burstRules.window.gap)return;
 w.breakWindow={boss:boss.id,from:w.tick,until:w.tick+burstRules.window.ticks,bonus:burstRules.window.bonus,reason};w.breakWindows++;w.breakClock[boss.id]=w.tick;w.breakOpened[boss.id]=w.tick;
}
/** 每帧收尾调用：开破绽窗口、记能量、处理排队的爆发。 */
export function stepBurst(world:World){
 const w=world as Any;if(!w.burstEnabled)return;const t=w.tick,cfg=burstRules.window;
 const bosses=w.enemies.filter(e=>e.boss&&e.alive),near=(e:Entity)=>{let hit=false;each(w,()=>{if(Math.hypot(e.position.x-w.hero.position.x,e.position.y-w.hero.position.y)<=w.rules.aiRules.activeRadius)hit=true;});return hit;};
 // 首领读条结算/被打断：章节首领技能走 bossCasts；草地首领的砸地只有 danger_started 事件（带 windup）。
 const live=new Set(w.bossCasts.map(c=>c.id));w.breakCasts=w.breakCasts.filter(id=>live.has(id));
 for(const c of w.bossCasts){if(!c.resolved||w.breakCasts.includes(c.id))continue;w.breakCasts.push(c.id);const owner=bosses.find(e=>e.id===c.owner);if(owner&&c.ends-c.started>=cfg.minWindup)openWindow(w,owner,c.interrupted?'interrupt':'heavy');}
 for(const ev of w.events)if(ev.type==='danger_started'&&(ev.windup??0)>=cfg.minWindup&&bosses.some(e=>e.id===ev.id)&&!w.bossCasts.some(c=>c.owner===ev.id&&!c.resolved))w.breakPending.push({boss:ev.id,at:t+(ev.windup??0)});
 for(const p of w.breakPending.filter(p=>p.at<=t)){const owner=bosses.find(e=>e.id===p.boss);if(owner)openWindow(w,owner,'heavy');}
 w.breakPending=w.breakPending.filter(p=>p.at>t);
 const engaged=bosses.filter(near);
 for(const b of engaged){w.breakClock[b.id]??=t;if(t-w.breakClock[b.id]>=cfg.tiredTicks&&!w.bossCasts.some(c=>c.owner===b.id&&!c.resolved)&&!w.breakPending.some(p=>p.boss===b.id))openWindow(w,b,'tired');}
 const kills=w.kills.filter(k=>k.tick===t).map(k=>w.enemies.find(e=>e.id===k.source_id)).filter((e):e is Entity=>!!e),bossDown=w.events.some(ev=>ev.type==='entity_died'&&w.enemies.some(e=>e.id===ev.id&&e.boss));
 each(w,()=>{
  const b=w.burst as BurstState,max=w.stats.hp;
  if(b.lastHp>=0&&w.hero.hp<b.lastHp)b.energy+=burstRules.hurtPerHp*(b.lastHp-w.hero.hp)/max;b.lastHp=w.hero.hp;
  for(const e of kills){if(e.boss)continue;b.streak=t-b.lastKill<=burstRules.streakWindow?b.streak+1:0;b.lastKill=t;b.energy+=(e.elite?burstRules.eliteKill:burstRules.kill)+Math.min(burstRules.streakCap,b.streak);}
  if(engaged.length)b.energy+=burstRules.bossPerSecond/30;
  b.energy=Math.min(burstRules.max,b.energy);
  if(bossDown)w.petCommand={...w.petCommand,left:burstRules.pet.charges};
  if(b.energy>=burstRules.max&&w.tactics?.burstAuto!==false&&w.mode!=='manual')b.queued=true;
  if(b.queued)tryBurst(w);
 });
}
function tryBurst(w:Any){
 const b=w.burst as BurstState;if(b.energy<burstRules.max||w.hero.hp<=0){b.queued=false;return;}
 const alive=w.enemies.filter(e=>e.alive),boss=alive.find(e=>e.boss&&windowOpen(w,e.id))??alive.find(e=>e.boss),target=boss??w.closest();if(!target){b.queued=false;return;}
 const skill=burstSkill(w.stats,w.skills,!!boss&&windowOpen(w,boss.id));w.skills=[...w.skills.filter(s=>!burstSkillIds.has(s.id)),skill];delete w.cooldowns[skill.id];
 const point=skill.mechanics?.targeting==='ground'?(target.boss?target.position:w.densestSpot(skill.range,skill.radius)?.point??target.position):undefined;
 // 引导中的旋转类技能直接被爆发打断（和开场一致）。
 if(w.lastCastFailure==='busy')w.sequences=w.sequences.filter(q=>q.sourceId!==w.playerId);
 w.burstCasting=true;let ok=false;try{ok=w.cast(skill.id,target,point);}finally{w.burstCasting=false;}
 if(ok){b.energy=0;b.queued=false;b.casts++;b.castAt=w.tick;if(windowOpen(w))b.inWindow++;}else w.cooldowns[skill.id]=w.tick+9000;
}
/** 爆发键：能量满时排队，下一帧放出。返回是否接受。 */
export function requestBurst(world:World){const w=world as Any;if(!w.burstEnabled||w.burst.energy<burstRules.max)return false;w.burst.queued=true;return true;}
/** 宠物指令：每场一次。返回失败原因（空串为成功）。 */
export function commandPet(world:World):string{
 const w=world as Any;if(!w.burstEnabled)return '这里不能下宠物指令。';const c=w.petCommand as PetCommandState,rule=petRule(w.stats);
 if(!rule)return '没有出战宠物。';if(c.left<=0)return '本场宠物指令已用过。';if(w.hero.hp<=0)return '倒地时不能下指令。';
 const a=rule.action;
 if(a.type==='shield'){
  each(w,()=>{priv(w).restoreResources(Math.round(w.stats.hp*burstRules.pet.heal),0,rule.id);});
  priv(w).comboAct(executableRule({...rule,id:rule.id+'-command',action:{...a,ratio:a.ratio*burstRules.pet.shieldScale}}),priv(w).effectProxy(),w.stats.attack,1,[]);
 }else{
  const alive=w.enemies.filter(e=>e.alive),target=alive.find(e=>e.boss)??w.closest();if(!target)return '附近没有目标。';
  const scaled:EffectRule={...rule,id:rule.id+'-command',action:'ratio' in a?{...a,ratio:a.ratio*burstRules.pet.damageScale} as EffectRule['action']:a,after:rule.after?.map(x=>'ratio' in x?{...x,ratio:x.ratio*burstRules.pet.damageScale} as typeof x:x)};
  priv(w).comboAct(executableRule(scaled),target,w.stats.attack,1,[]);
 }
 w.petCommand={left:c.left-1,usedAt:w.tick,uses:c.uses+1};return '';
}
