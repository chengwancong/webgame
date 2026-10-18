import {createHash} from 'node:crypto';
// 全参数与全帧原样参与比较；大体积原始轨迹留本地，入库固定SHA256期望。
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
import {describe,it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import historical from './fixtures/combat-feedback-before.json';
import golden from './fixtures/numeric-spine/combat-feedback-summary.json';
import {stats,trace} from './fixtures/combat-feedback-scenario.ts';
describe('authoritative combat feedback facts',()=>{
 it('keeps the current ruleset seeded damage trace and RNG state while retaining historical evidence',()=>{expect(historical.hits.length).toBeGreaterThan(0);expect(digest(trace())).toBe(golden.trace);});
 it('marks only actual critical hits without adding RNG draws',()=>{
  const w=new World(regionById('meadow'),{...stats,critChance:1},[],[{id:'target',x:8,y:8,name:'target',kind:'melee',hp:1000,attack:0,boss:false,elite:false,art:'raider'}]);
  (w as any).damage(w.enemies[0],20);expect(w.events.at(-1)).toMatchObject({type:'hit_resolved',crit:true,amount:30});
  w.stats.critChance=0;(w as any).damage(w.enemies[0],20);expect(w.events.at(-1)?.crit).toBeUndefined();
 });
 it('reports applied, partially absorbed and fully consumed shield amounts and serializes them',()=>{
  const ward=skillCatalog.find(s=>s.id==='ward')!,w=new World(regionById('town'),{...stats,armor:0},[ward],[]);
  w.mode='manual';w.cast('ward');for(let i=0;i<ward.windup+2;i++)w.step();
  const applied=w.events.find(e=>e.type==='shielded');
  // The application event may have occurred on an earlier windup tick.
  expect(w.hero.shield).toBe(ward.damage);
  w.events=[];(w as any).stepping=true;(w as any).hurt(10);expect(w.events.find(e=>e.type==='shielded')).toMatchObject({shieldPhase:'absorbed',amount:10,shieldRemaining:ward.damage-10});
  w.events=[];(w as any).stepping=true;(w as any).hurt(ward.damage+100);expect(w.events.find(e=>e.type==='shielded')).toMatchObject({shieldPhase:'absorbed',shieldRemaining:0});
  expect(World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint()))).events).toEqual(w.events);
  const fresh=new World(regionById('town'),stats,[ward],[]);fresh.mode='manual';fresh.cast('ward');let gain=applied;
  for(let i=0;i<ward.windup+2;i++){fresh.step();gain??=fresh.events.find(e=>e.type==='shielded');}
  expect(gain).toMatchObject({shieldPhase:'applied',shieldRemaining:ward.damage,amount:ward.damage});
 });
 it('emits full absorption even when health damage is zero',()=>{
  const w=new World(regionById('town'),{...stats,armor:0},[],[]);w.hero.shield=50;(w as any).stepping=true;(w as any).hurt(20);
  expect(w.events.find(e=>e.type==='shielded')).toMatchObject({shieldRemaining:30,amount:20});
  expect(w.events.find(e=>e.type==='hit_resolved')).toMatchObject({amount:0});
 });
});
