import type {CharacterState,Stats,Skill} from '../contracts/index.ts';
import {challengeProgressSchema,type ChallengeProgress,type ChallengeResult,type RaidRole} from '../contracts/progression-challenges.ts';
import {challengeContent,seasonActive,type ChallengeDefinition} from '../content/progression-challenges.ts';
import {regionById} from '../content/index.ts';
import {resolveBuild} from './index.ts';
import {World} from '../simulation/index.ts';
import {storyFeatureUnlocked} from './story-campaign.ts';

export function ensureChallengeProgress(s:CharacterState):ChallengeProgress{
 return s.challengeProgress??=challengeProgressSchema.parse({});
}
// UTC+08 fixed game reset, independent from the host's local timezone.
export function challengePeriods(now=Date.now()){
 const shifted=new Date(now+8*3600000),day=shifted.toISOString().slice(0,10);
 const monday=new Date(shifted);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 return {day,week:monday.toISOString().slice(0,10)};
}
export function challengeAvailability(s:CharacterState,d:ChallengeDefinition,now=Date.now()){
 const p=s.challengeProgress??challengeProgressSchema.parse({}),dates=challengePeriods(now);
 const kind=d.kind,limit=kind==='high'?challengeContent.limits.highDaily:kind==='nightmare'?challengeContent.limits.nightmareDaily:challengeContent.limits.raidWeekly;
 const key=kind+':'+(kind==='raid'?dates.week:dates.day),used=(kind==='raid'?p.weekly:p.daily)[key]??0;
 const reason=s.level<d.level?`角色需达到 ${d.level} 级`:!s.progress.regions.includes(d.region.replace('-boss',''))?'请先开放对应区域':!storyFeatureUnlocked(s,d.kind)?'先完成对应主线，开放此类挑战':used>=limit?'本周期挑战次数已用完':'';
 return {eligible:!reason,reason,used,limit,key};
}
export function consumeChallenge(s:CharacterState,d:ChallengeDefinition,now=Date.now()){
 const p=ensureChallengeProgress(s),a=challengeAvailability(s,d,now),book=d.kind==='raid'?p.weekly:p.daily;
 if(!a.eligible)throw Error(a.reason);
 book[a.key]=(book[a.key]??0)+1;
 // Keep bounded period counters while retaining the current reset windows.
 const dates=challengePeriods(now);
 for(const key of Object.keys(p.daily))if(!key.endsWith(dates.day))delete p.daily[key];
 for(const key of Object.keys(p.weekly))if(!key.endsWith(dates.week))delete p.weekly[key];
}
export function awardSeasonXp(s:CharacterState,amount:number,now=Date.now()){
 if(!seasonActive(now))return;const p=ensureChallengeProgress(s),id=challengeContent.season.id;
 p.seasonXp[id]=(p.seasonXp[id]??0)+amount;
}

type PartyMember={state:CharacterState;role:RaidRole};
export function resolveRaidBuild(members:PartyMember[]):{stats:Stats;resolvedSkills:Skill[]}{
 const builds=members.map(m=>({...resolveBuild(m.state),role:m.role}));
 const stats:Stats={hp:builds.reduce((n,b)=>n+b.stats.hp,0),attack:builds.reduce((n,b)=>n+b.stats.attack,0),armor:Math.round(builds.filter(b=>b.role==='tank').reduce((n,b)=>n+b.stats.armor,0)),speed:Math.min(...builds.map(b=>b.stats.speed)),mana:builds.reduce((n,b)=>n+b.stats.mana,0),regen:builds.reduce((n,b)=>n+b.stats.regen,0),effects:[]};
 // One shared frontline: all members' actual resolved attacks contribute; healers
 // contribute their resolved healing/wards. Do not duplicate passive multipliers.
 const damage=builds.filter(b=>b.role!=='healer').flatMap(b=>b.resolvedSkills.filter(s=>!['heal','shield'].includes(s.kind)));
 const healing=builds.filter(b=>b.role==='healer').flatMap(b=>b.resolvedSkills.filter(s=>s.kind==='heal'));
 const ward=builds.filter(b=>b.role==='tank').flatMap(b=>b.resolvedSkills.filter(s=>s.kind==='shield'));
 const group=(id:string,kind:Skill['kind'],skills:Skill[]):Skill|undefined=>skills.length?{...skills[0],id,kind,damage:Math.round(skills.reduce((n,s)=>n+s.damage,0)),cooldown:Math.round(skills.reduce((n,s)=>n+s.cooldown,0)/skills.length),cost:skills.reduce((n,s)=>n+s.cost,0),radius:Math.max(...skills.map(s=>s.radius)),range:Math.max(...skills.map(s=>s.range))}:undefined;
 return {stats,resolvedSkills:[group('raid-strike','single',damage),group('raid-heal','heal',healing),group('raid-ward','shield',ward)].filter((s):s is Skill=>Boolean(s))};
}

export function simulateChallenge(s:CharacterState,d:ChallengeDefinition,tier:number,seed:number,runId:string,rules:string,party?:PartyMember[]):ChallengeResult{
 const base=party?resolveRaidBuild(party):resolveBuild(s),region=regionById(d.region);
 let rng=seed>>>0;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 const pool=[...challengeContent.affixes],affixes:typeof pool=[];
 if(d.kind==='nightmare')for(let i=0;i<challengeContent.nightmare.affixCount;i++)affixes.push(pool.splice(Math.floor(random()*pool.length),1)[0]);
 const growth=d.kind==='nightmare'?tier-1:0;
 const hp=d.hp*(1+growth*challengeContent.nightmare.hpPerTier)*affixes.reduce((n,a)=>n*a.hp,1);
 const attack=d.attack*(1+growth*challengeContent.nightmare.attackPerTier)*affixes.reduce((n,a)=>n*a.attack,1);
 const cooldown=affixes.reduce((n,a)=>n*a.cooldown,1),healing=affixes.reduce((n,a)=>n*(a.healing??1),1);
 const skills=base.resolvedSkills.map(sk=>({...sk,cooldown:Math.round(sk.cooldown*cooldown),damage:sk.kind==='heal'?Math.round(sk.damage*healing):sk.damage}));
 const stats={...base.stats,lifesteal:(base.stats.lifesteal??0)*healing};
 const tickBudget=d.kind==='raid'?challengeContent.limits.raidMaxTicks:challengeContent.limits.maxTicks;
 let remainingHp=stats.hp,ticks=0,stages=0;
 for(let stage=0;stage<d.stages&&ticks<tickBudget;stage++){
  const spawns=region.spawns.map(m=>({...m,id:`${runId}:${stage}:${m.id}`,hp:Math.max(1,Math.round(m.hp*hp*(1+stage*.12))),attack:Math.max(1,Math.round(m.attack*attack*(party?party.length:1)*(1+stage*.06)))}));
  const world=new World(region,stats,skills,spawns,[],seed+stage);world.hero.hp=remainingHp;world.radius=Math.max(region.width,region.height);world.setMode('auto');
  while(ticks<tickBudget&&world.hero.hp>0&&world.enemies.some(e=>e.alive)){world.step();ticks++;}
  remainingHp=world.hero.hp;
  if(world.enemies.some(e=>e.alive)||remainingHp<=0)break;
  stages++;
 }
 const won=stages===d.stages&&remainingHp>0,mult=1+growth*challengeContent.nightmare.rewardPerTier;
 return {run_id:runId,challenge_id:d.id,name:d.name,kind:d.kind,tier:d.kind==='nightmare'?tier:0,won,ticks,stages,totalStages:d.stages,remainingHp,reason:won?'挑战成功':remainingHp<=0?'队伍倒下':'战斗超时',rules,seed,reward:{gold:won?Math.round(d.reward.gold*mult):0,xp:won?Math.round(d.reward.xp*mult):0,material:won?Math.round(d.reward.material*mult):0},affixes:affixes.map(a=>a.name)};
}
