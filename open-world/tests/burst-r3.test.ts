// 27 号 R3 出手点：爆发能量/爆发键、首领破绽窗口、宠物指令。验收：首领战手动（爆发留给破绽+宠物指令）明显快于纯自动。
import {it,expect,describe} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {burstRules,burstSkill,burstSkillIds,commandPet,requestBurst,skillBarDps,windowOpen} from '../packages/simulation/burst.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import {petFamilyById} from '../packages/content/zhangjian.ts';
import {petActiveRule} from '../packages/rules/zhangjian-build.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {skillSchema,type Skill,type Spawn,type Stats} from '../packages/contracts/index.ts';
import {resolveTactics} from '../packages/rules/tactics.ts';
import type {Tactics} from '../packages/contracts/tactics.ts';
// 技能伤害按攻击 30 折算（rules resolveSkill：攻击/14），和宠物（按攻击力算）同一口径。
const skill=(id:string)=>{const s=skillSchema.parse(structuredClone(skillCatalog.find(s=>s.id===id)));s.damage=Math.round(s.damage*30/14);return s;};
const mage=[skill('arcane_missile'),skill('lance'),skill('fireball'),skill('meteor')];
const pet=petActiveRule(petFamilyById.get('wind-heavy')!,10,'storm');
const hero=(weapon:Stats['weapon']='staff'):Stats=>({hp:3000,attack:30,armor:0,speed:6,mana:100,regen:10,effects:[],weapon,rules:[pet]} as Stats);
const boss=(hp:number,seed=0):Spawn=>{const s=resolveMonsterSpawn({id:'boss',template:'ss-boss-port-vanguard',level:10,rank:'boss',x:27+seed%5*1.5,y:18+seed%3*2});return {...s,hp};};
const arena=()=>({...regionById('meadow'),safe:{x:20,y:20},obstacles:[]});
type Plan='auto'|'manual'|'hold'|'off';
// 首领约 60 秒的量级（不开 R3 时约 76 秒）；站位按种子错开，让能量满的时刻与破绽窗口的相位不固定。
function fight(plan:Plan,seed:number,hp=5000,skills:Skill[]=mage){
 const w=new World(arena(),hero(),skills,[boss(hp,seed)],[],seed);w.burstEnabled=plan!=='off';w.radius=60;w.setMode('auto');
 const base=resolveTactics(undefined,skills);
 w.tactics=plan==='manual'?{...base,burstAuto:false}:plan==='hold'?{...base,conditions:{meteor:'burst'}} satisfies Tactics:base;
 let ticks=0;for(;ticks<30*240&&w.enemies.some(e=>e.alive);ticks++){
  if(plan==='manual'&&windowOpen(w)){requestBurst(w);if(w.petCommand.left)commandPet(w);}
  w.step();
 }
 return {ticks,cleared:w.enemies.every(e=>!e.alive),w};
}
const mean=(plan:Plan,hp?:number)=>{const rs=Array.from({length:10},(_,i)=>fight(plan,i+1,hp));expect(rs.every(r=>r.cleared)).toBe(true);return {s:rs.reduce((n,r)=>n+r.ticks,0)/300,rs};};

describe('爆发能量与爆发键',()=>{
 it('爆发技能按技能栏秒伤定量，不进自动施法，也不能被普通施法放出',()=>{
  const b=burstSkill({weapon:'staff'},mage);expect(burstSkillIds.has(b.id)).toBe(true);expect(b.cooldown).toBe(9000);
  expect(b.damage*4/.8).toBeCloseTo(skillBarDps(mage)*burstRules.seconds,-1);
  const w=new World(arena(),hero(),mage,[boss(9000)],[],1);w.burstEnabled=true;w.skills=[...w.skills,b];
  expect(w.cast(b.id,w.enemies[0])).toBe(false);
 });
 it('能量来自击杀、受击和首领在场，满了才能按；关掉自动释放时不会自己放',()=>{
  const mobs:Spawn[]=Array.from({length:6},(_,i)=>({id:'m'+i,name:'m',kind:'melee',x:22+i%3,y:21+Math.floor(i/3),hp:20,attack:40,elite:i===0,boss:false,art:'raider'}));
  const w=new World(arena(),hero(),mage,mobs,[],3);w.burstEnabled=true;w.radius=60;w.setMode('auto');w.tactics={...resolveTactics(undefined,mage),burstAuto:false};
  expect(requestBurst(w)).toBe(false);
  for(let i=0;i<30*20&&w.enemies.some(e=>e.alive);i++)w.step();
  expect(w.burst.energy).toBeGreaterThanOrEqual(burstRules.eliteKill+5*burstRules.kill);
  w.burst.energy=burstRules.max;w.addSpawns([boss(9000)]);for(let i=0;i<30;i++)w.step();expect(w.burst.casts).toBe(0);
  expect(requestBurst(w)).toBe(true);for(let i=0;i<5;i++)w.step();expect(w.burst.casts).toBe(1);expect(w.burst.energy).toBeLessThan(5);
 });
 it('野外（未开）不攒能量',()=>{const w=new World(arena(),hero(),mage,[boss(9000)],[],1);w.setMode('auto');for(let i=0;i<300;i++)w.step();expect(w.burst.energy).toBe(0);});
});

describe('首领破绽窗口',()=>{
 it('首领读条大招结算后开 2.5 秒窗口，手动爆发都落在窗口里，窗口内对首领伤害 +30%',()=>{
  const {w}=fight('manual',1);
  expect(w.breakWindows).toBeGreaterThan(0);
  const log=w.burst;expect(log.casts).toBeGreaterThan(0);expect(log.inWindow).toBe(log.casts);
  // 窗口加成：同一发打首领，窗口里比窗口外多 30%。
  const hit=(broken:boolean)=>{const p=new World(arena(),hero(),mage,[boss(99999)],[],1);p.burstEnabled=true;const e=p.enemies[0];if(broken)p.breakWindow={boss:e.id,from:0,until:999,bonus:burstRules.window.bonus,reason:'heavy'};p.cast('lance',e);for(let i=0;i<40;i++)p.step();return 99999-e.hp;};
  const plain=hit(false),broken=hit(true);expect(plain).toBeGreaterThan(0);
  expect(broken/plain).toBeCloseTo(1+burstRules.window.bonus,1);
 });
 it('"保留给破绽"的技能只在窗口里自动放',()=>{
  const w=new World(arena(),hero(),mage,[boss(99999)],[],2);w.burstEnabled=true;w.radius=60;w.setMode('auto');w.tactics={...resolveTactics(undefined,mage),conditions:{meteor:'burst'}};
  let outside=0,inside=0;for(let i=0;i<30*40;i++){w.step();for(const ev of w.events)if(ev.type==='cast_started'&&ev.skill==='meteor'&&ev.id===w.playerId)windowOpen(w)?inside++:outside++;}
  expect(w.breakWindows).toBeGreaterThan(1);expect(outside).toBe(0);expect(inside).toBeGreaterThan(0);
 });
});

describe('宠物指令',()=>{
 it('每个首领一次，没有出战宠物时拒绝',()=>{
  const w=new World(arena(),hero(),mage,[boss(9000)],[],1);w.burstEnabled=true;w.setMode('auto');for(let i=0;i<60;i++)w.step();
  const hp=w.enemies[0].hp;expect(commandPet(w)).toBe('');expect(w.enemies[0].hp).toBeLessThan(hp);expect(commandPet(w)).toBe('本场宠物指令已用过。');
  const bare=new World(arena(),{...hero(),rules:[]},mage,[boss(9000)],[],1);bare.burstEnabled=true;expect(commandPet(bare)).toBe('没有出战宠物。');
 });
});

describe('验收：首领战手动明显快于纯自动',()=>{
 it('同一首领各 10 次：手动（爆发留给破绽、宠物指令卡窗口）比纯自动快 ≥10%，纯自动也比不开 R3 快',()=>{
  const off=mean('off'),auto=mean('auto'),manual=mean('manual');
  console.log('boss seconds',{off:off.s.toFixed(1),auto:auto.s.toFixed(1),manual:manual.s.toFixed(1),windows:manual.rs.map(r=>r.w.breakWindows).join(','),bursts:manual.rs.map(r=>r.w.burst.casts).join(',')});
  expect(auto.s).toBeLessThan(off.s);
  expect(manual.s).toBeLessThan(auto.s*.9);
 });
});
