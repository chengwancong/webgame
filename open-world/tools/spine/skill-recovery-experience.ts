/** docs/progression-goal-plan.md §6.1/§6.2：招牌技找回前后的清群提速，与落点求生用时。推导一次、验证一次，不扫参。
 * 用法：node --import tsx tools/spine/skill-recovery-experience.ts */
import '../../packages/content/open-world/index.ts';
import {standardState,resolvePlayer} from './player.ts';
import {benchSample,benchSeeds} from './bench.ts';
import {SCHEDULE} from '../standard-player-model.ts';
import {applyStarseaOp,newStarseaState} from '../../packages/rules/starsea.ts';
import {makeGear} from '../../packages/rules/index.ts';
import {makeStarseaStarterWeapon} from '../../packages/rules/starsea-starter.ts';
import {choosePrologueWeapon,finishPrologue} from '../../packages/rules/starsea-prologue.ts';
import {prologueConfig} from '../../packages/content/starsea/prologue.ts';
const starterSkills=prologueConfig.families.sword.starterSkills;
import type {CharacterState} from '../../packages/contracts/index.ts';
type Family='sword'|'staff'|'hidden';
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
// §6.1 技能栏表（§11.3 技能一个一个给后的定稿）：每次找回的等级、找回前、找回后。
const plan:Record<Family,{level:number;before:string[];after:string[];floor:number}[]>={
 sword:[{level:1,before:['cut'],after:['cut','whirl'],floor:.3},{level:8,before:['cut','whirl','rush','ward'],after:['cut','whirl','vortex_blade','rush'],floor:.2},{level:11,before:['cut','whirl','vortex_blade','rush'],after:['cut','whirl','vortex_blade','leap_strike'],floor:.1},{level:15,before:['whirl','vortex_blade','cut','leap_strike'],after:['whirl','vortex_blade','leap_strike','blade_fury'],floor:.15}],
 staff:[{level:1,before:['staff_strike'],after:['staff_strike','chain'],floor:.3},{level:8,before:['staff_strike','chain','staff_sweep','ward'],after:['staff_strike','chain','nova','staff_sweep'],floor:.2},{level:13,before:['frost','ember','chain','nova'],after:['barrage','ember','chain','nova'],floor:.1},{level:15,before:['barrage','ember','chain','nova'],after:['meteor','ember','chain','nova'],floor:.15}],
 hidden:[{level:1,before:['throwing_knife'],after:['throwing_knife','fan_of_knives'],floor:.3},{level:8,before:['throwing_knife','fan_of_knives','shadow_step','ward'],after:['throwing_knife','fan_of_knives','explosive_kunai','shadow_step'],floor:.2},{level:13,before:['throwing_knife','fan_of_knives','shadow_step','explosive_kunai'],after:['death_lotus','fan_of_knives','shadow_step','explosive_kunai'],floor:.1},{level:15,before:['fan_of_knives','explosive_kunai','death_lotus','shadow_step'],after:['night_veil','explosive_kunai','death_lotus','shadow_step'],floor:.15}],
};
function player(level:number,family:Family,skills:string[],tag:string){
 const s=standardState(level,family);s.skills=[...skills];s.skillRanks=Object.fromEntries(skills.map(id=>[id,SCHEDULE.skillRank(level)]));
 s.progression!.skillAwakenings={};return resolvePlayer(tag,s);
}
const rows:any[]=[];
for(const family of Object.keys(plan) as Family[])for(const [i,step] of plan[family].entries()){
 const b=player(step.level,family,step.before,`${family}-r${i+1}-before`),a=player(step.level,family,step.after,`${family}-r${i+1}-after`),hp=b.build.stats.hp;
 const axis=(p:typeof b,x:'dense'|'D1')=>median(benchSeeds.map(seed=>{const r=benchSample(p,x,seed,hp);if(!r.value||!r.totalDamage)throw Error('伤害样本失败 '+p.id+'/'+x);return r.value;}));
 const bd=axis(b,'dense'),ad=axis(a,'dense'),b1=axis(b,'D1'),a1=axis(a,'D1');
 const row={family,recovery:i+1,level:step.level,dense:+(ad/bd-1).toFixed(3),floor:step.floor,pass:ad/bd-1>=step.floor,single:+(a1/b1-1).toFixed(3)};rows.push(row);console.log(JSON.stringify(row));
}
// §6.2 落点求生：真实任务刷怪（2 只 1 级风原巡猎兽），只用开场后的起手招（§11.3：每把武器 1 招）。
for(const family of ['sword','staff','hidden'] as Family[]){
 const gear=[makeStarseaStarterWeapon(crypto.randomUUID()),makeGear(2,crypto.randomUUID())];
 const s={field:{gathered:[]},id:crypto.randomUUID(),name:'m',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 s.starsea!.prologue={done:false};choosePrologueWeapon(s,family);finishPrologue(s);
 const spawns=applyStarseaOp(s,'start',{task:'ss-c01-t01',region:'ss-map-wind',now:Date.now()}).spawns.map((m,i)=>({...m,x:27+i,y:24}));
 const live=[...s.skills],p=resolvePlayer('landing-'+family,{...s,skills:live});
 const clear=median(benchSeeds.map(seed=>benchSample(p,'D1',seed,p.build.stats.hp,{spawns:spawns as any,stopWhen:'clear',seconds:30}).clearSeconds??99));
 const dps=spawns.length*Math.max(...spawns.map(m=>m.attack))/(spawns[0].monster!.ai.cooldown/30);
 const row={family,landing:true,skills:live,houndHp:spawns.map(m=>m.hp),clearSeconds:clear,perKill:+(clear/spawns.length).toFixed(2),pass:clear/spawns.length<=12,heroHp:p.build.stats.hp,secondsToDieIfIgnored:+(p.build.stats.hp/dps).toFixed(1)};rows.push(row);console.log(JSON.stringify(row));
}
// §11.3 抢救船台：守引擎那一波（3 名侵军），只用起手招 + 找回 1，英雄不能死。
for(const family of ['sword','staff','hidden'] as Family[]){
 const gear=[makeStarseaStarterWeapon(crypto.randomUUID()),makeGear(2,crypto.randomUUID())];
 const s={field:{gathered:[]},id:crypto.randomUUID(),name:'m',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear,equipment:{weapon:gear[0].id,armor:gear[1].id},weaponLoadouts:{},skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),skillBooks:{},progress:{kills:0,regions:[],bosses:[],safe:'ss-map-wind',tasks:[]},starsea:newStarseaState()} as CharacterState;
 s.starsea!.prologue={done:false};choosePrologueWeapon(s,family);finishPrologue(s);s.level=3;
 const first=plan[family][0].after;s.skills=[...first];s.skillRanks=Object.fromEntries(first.map(id=>[id,1]));
 for(const t of ['ss-c01-t01','ss-c01-n01','ss-c01-t02'])s.starsea!.done.push(t);
 (s.starsea as any).quests['ss-c01-t03']={step:0,attempt:0,acceptedAt:0};(s.starsea as any).tracked='ss-c01-t03';
 const spawns=applyStarseaOp(s,'interact',{task:'ss-c01-t03',target:'object:engine',region:'ss-map-wind',now:Date.now()} as any).spawns.map((m,i)=>({...m,x:27+i,y:24}));
 const p=resolvePlayer('engine-'+family,s);
 const runs=benchSeeds.map(seed=>benchSample(p,'D1',seed,p.build.stats.hp,{spawns:spawns as any,stopWhen:'clear',seconds:30}));
 const clear=median(runs.map(r=>r.clearSeconds??99));
 const dps=spawns.reduce((a,m)=>a+m.attack/(m.monster!.ai.cooldown/30),0);
 const row={family,engine:true,skills:first,level:s.level,invaders:spawns.map(m=>[m.name,m.hp,m.attack]),clearSeconds:clear,heroHp:p.build.stats.hp,secondsToDieIfIgnored:+(p.build.stats.hp/dps).toFixed(1),pass:clear<30&&p.build.stats.hp/dps>clear};rows.push(row);console.log(JSON.stringify(row));
}
console.log(rows.every(r=>r.pass)?'ALL PASS':'SOME FAIL');
