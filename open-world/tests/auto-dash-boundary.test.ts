import {it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {World,distance,type CombatEvent} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {standardState} from '../tools/spine/player.ts';
import type {Spawn} from '../packages/contracts/index.ts';
// 验收 D8（progression-goal-20261017，规则 §11.1）：半自动下冲刺技只对 4 格内的目标自动放。
// 用标准人在进港路等级装配起手招 + 进港路 a 线送的冲刺技，放进风栖真实地图，统计每次自动冲刺开始时与目标的距离。
const T=30,level=6,map='ss-map-wind';
const kits={sword:['cut','whirl','ward','rush'],staff:['staff_strike','chain','ward','pole_vault'],hidden:['throwing_knife','fan_of_knives','ward','shadow_step']} as const;
type Family=keyof typeof kits;
function build(family:Family){
 const s=standardState(level,family);s.skills=[...kits[family]];s.skillRanks=Object.fromEntries(s.skills.map(id=>[id,1]));
 const b=resolveBuild(s);expect(b.resolvedSkills.map(k=>k.id),family+' 构筑技能必须全部可用').toEqual(s.skills);return b;
}
const mob=(id:string,x:number,y:number,still=false):Spawn=>{const s=resolveMonsterSpawn({id,template:'ss-mon-wind-hound',level,rank:'normal',x,y});if(still)s.monster!.ai.speed=0;return s;};
function world(family:Family,spawns:(at:{x:number;y:number})=>Spawn[],only?:string){
 const b=build(family),w=new World({...regionById(map),spawns:[]},b.stats,b.resolvedSkills.filter(k=>!only||k.id===only),[],[],41);w.setMode('semi');w.autoSkills=true;w.addSpawns(spawns({...w.hero.position}));return w;
}
function dashes(w:World,ticks:number,dash:string){
 const out:number[]=[];for(let i=0;i<ticks;i++){w.step();for(const e of w.events as CombatEvent[])if(e.type==='cast_started'&&e.skill===dash&&e.id===w.playerId&&e.origin&&e.target)out.push(Math.round(distance(e.origin,e.target)*100)/100);}return out;
}
it('auto dash starts only within 4 cells: boundary pair, and a 20-second mixed-distance pack',async()=>{
 const rows=[];
 for(const family of Object.keys(kits) as Family[]){
  const dash=kits[family][3];
  // 边界：技能栏只留冲刺技（否则排在前面的基础招会先接管走位），一只不会动的靶子分别放在 3.8 格和 4.3 格，跑 5 秒，记每次冲刺开始时的距离。
  const inside=dashes(world(family,at=>[mob('in',at.x+3.8,at.y,true)],dash),5*T,dash),outside=dashes(world(family,at=>[mob('out',at.x+4.3,at.y,true)],dash),5*T,dash);
  // 混战：完整 4 技能栏，8 只巡猎兽散在 2–12 格，正常追人，跑 20 秒（英雄不走位）。
  const pack=dashes(world(family,at=>[2,3.5,5,6.5,8,9.5,11,12].map((r,i)=>{const a=i*2.4;return mob('p'+i,at.x+Math.cos(a)*r,at.y+Math.sin(a)*r);})),20*T,dash);
  rows.push({family,dash,insideCasts:inside.length,insideDistances:inside.join(' '),outsideCasts:outside.length,outsideDistances:outside.join(' '),packCasts:pack.length,packMaxDistance:pack.length?Math.max(...pack):null,packDistances:pack.join(' ')});
 }
 console.table(rows);
 const dir=resolve(import.meta.dirname,'../.runtime/acceptance-g3');await mkdir(dir,{recursive:true});
 await writeFile(resolve(dir,'D8-auto-dash.json'),JSON.stringify({item:'D8',source:'tests/auto-dash-boundary.test.ts',level,map,rows},null,1));
 for(const r of rows){expect(r.insideCasts,r.family).toBeGreaterThan(0);// 4.3 格的靶子：英雄先走近，进到 4 格内才冲；任何一次自动冲刺开始时都不超过 4 格。
  for(const d of [r.insideDistances,r.outsideDistances,r.packDistances].join(' ').split(' ').filter(Boolean).map(Number))expect(d,r.family).toBeLessThanOrEqual(4);}
},120_000);
