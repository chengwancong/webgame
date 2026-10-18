import {describe,it,expect} from 'vitest';
import {starseaMaps,starseaRegions,starseaCampaign,starseaRelics,starseaHub} from '../packages/content/starsea/index.ts';
import {starseaTaskSteps,starseaPortSpots} from '../packages/rules/starsea.ts';
import {walkable,findPath,World} from '../packages/simulation/index.ts';
import type {Region} from '../packages/content/index.ts';
import {regionById} from '../packages/content/index.ts';
import {npcs} from '../packages/content/task-tables.ts';
import legacyWind from '../packages/content/starsea/maps/ss-map-wind.json';
import {decorationBlockers} from '../packages/content/starsea/collision.ts';
import {starseaRegion,type StarseaMapSource} from '../packages/content/starsea/index.ts';

// 碰撞来自摆件底座：每个立体摆件都挡路，所有需要走到的点都必须能走到，道路不能从建筑底下穿过。
const region=(id:string)=>regionById(id);
const reach=(r:Region,from:{x:number;y:number},to:{x:number;y:number})=>Math.hypot(from.x-to.x,from.y-to.y)<1||findPath(r,from,to).length>0;
describe('starsea collision',()=>{
 it('every standing decoration blocks and nothing else does',()=>{
  for(const m of starseaMaps){
   const standing=m.decorations.filter(d=>d.depthMode!=='ground');
   if(m.width!==512)expect(m.obstacles.length,m.id).toBe(standing.length);else expect(m.obstacles.length).toBeGreaterThan(standing.length);
  }
 });
 it('landmarks, port NPCs, relics and task points stand on reachable ground',()=>{
  const bad:string[]=[];
  const check=(map:string,label:string,p:{x:number;y:number})=>{const r=region(map),start=r.safe;if(!walkable(r,p))bad.push(`${map} ${label} blocked @${p.x},${p.y}`);else if(!reach(r,start,p))bad.push(`${map} ${label} unreachable @${p.x},${p.y}`);};
  for(const m of starseaMaps)for(const l of m.landmarks)check(m.id,'landmark '+l.id,l);
  for(const [npc,p] of Object.entries(starseaPortSpots))check(npcs.find(n=>n.id===npc)!.home_map,npc,p);
  for(const relic of starseaRelics)check(relic.map,relic.id,relic);
  for(const c of starseaCampaign.chapters)for(let t=0;t<c.tasks.length;t++)for(const choice of ['a','b'] as const)
   for(const s of starseaTaskSteps(c,t,choice))for(const p of s.points)check(s.map,`c${c.n}t${t} ${s.label}`,p);
  expect([...new Set(bad)]).toEqual([]);
 });
 it('field spawns start outside collision',()=>{
  for(const r of starseaRegions)for(const s of r.spawns)expect(walkable(r,s,.2),`${r.id} ${s.id}`).toBe(true);
 });
 it('roads never run under a building',()=>{
  const bad:string[]=[];
  for(const m of starseaMaps)for(const road of m.roads)for(const [x,y] of road.points)
   if(m.obstacles.some(o=>x>o.x-.5&&x<o.x+o.w+.5&&y>o.y-.5&&y<o.y+o.h+.5))bad.push(`${m.id} ${(road as {id?:string}).id} @${x},${y}`);
  expect(bad).toEqual([]);
 });
 it('the hero walks around a building instead of through it or stopping at an air wall',()=>{
  // 风语岛登陆点紧挨停靠的飞艇：直线穿过船身的目标必须绕行抵达，途中不能进入船身。
  const legacy={...legacyWind,obstacles:decorationBlockers(legacyWind.decorations)},r={...starseaRegion(legacy as unknown as StarseaMapSource),spawns:[]},hull=r.obstacles.find(o=>o.x<12&&o.x>9&&o.y>51&&o.y<54)!;
  const w=new World(r,{hp:500,attack:20,armor:40,speed:6,mana:100,regen:0,effects:[]},[],[]);
  w.hero.position={x:8,y:56};w.setMode('semi');w.go({x:14,y:50});
  let entered=false;for(let t=0;t<30*8;t++){w.step();const h=w.hero.position;if(h.x>hull.x&&h.x<hull.x+hull.w&&h.y>hull.y&&h.y<hull.y+hull.h)entered=true;}
  expect(hull).toBeTruthy();expect(entered).toBe(false);expect(Math.hypot(w.hero.position.x-14,w.hero.position.y-50)).toBeLessThan(.6);
 });
});
