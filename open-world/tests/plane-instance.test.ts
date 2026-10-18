import {describe,it,expect} from 'vitest';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {generatePlaneStage,isPlaneStage} from '../packages/content/plane-layouts.ts';
import {planeStageSpecs} from '../packages/content/plane-scenes.ts';
import {NavigationGrid} from '../packages/simulation/navigation-grid.ts';

const SEEDS=Array.from({length:12},(_,i)=>1+i*104729);
const pathLength=(grid:NavigationGrid,from:{x:number;y:number},to:{x:number;y:number})=>{let len=0,prev=from;for(const p of grid.path(from,to)){len+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}return len;};
describe('plane instances (箱庭位面实例 F2)',()=>{
 it('every plane gate opens a solo realtime plane definition, and every plane definition has a gate',()=>{
  const planes=dungeonContent.definitions.filter(d=>d.policy.plane);expect(planes.length).toBeGreaterThan(0);
  for(const gate of worldTables.planeGates){const d=dungeonContent.definitions.find(d=>d.id===gate.plane);expect(d,gate.id).toBeTruthy();
   expect(d!.policy.plane,gate.id).toEqual({passageRadius:expect.any(Number),exitRadius:expect.any(Number)});expect(d!.policy.party.max).toBe(1);expect(d!.mode).toBe('realtime');
   expect(d!.stages.every(isPlaneStage),gate.id).toBe(true);}
  for(const d of planes)expect(worldTables.planeGates.some(g=>g.plane===d.id),d.id).toBe(true);
 });
 it('the way on is deep in the stage: passages at the far end of the line, the exit inside the boss hall',()=>{
  for(const spec of planeStageSpecs)for(const seed of SEEDS){const {region}=generatePlaneStage(spec.id,seed),grid=new NavigationGrid(region.width,region.height,region.obstacles,.55);
   expect(grid.walkable(region.portal),`${spec.id} ${seed}`).toBe(true);const len=pathLength(grid,region.safe,region.portal);
   if(spec.boss){expect(len,`${spec.id} ${seed}`).toBeGreaterThanOrEqual(25);const boss=region.spawns.find(s=>s.boss)!;expect(Math.hypot(boss.x-region.portal.x,boss.y-region.portal.y)).toBeGreaterThanOrEqual(3);}
   else expect(len,`${spec.id} ${seed}`).toBeGreaterThanOrEqual(60);}
 },20000);
});
