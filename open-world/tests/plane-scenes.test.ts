import {describe,it,expect} from 'vitest';
import {buildPlaneStage,planeStageSpecs,planeResource,PLANE_SIGHT_MARGIN,PLANE_ISLANDS,PLANE_ISLAND_PARTS,PLANE_FEATURES} from '../packages/content/plane-scenes.ts';
import {planeMaps} from '../packages/content/open-world/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById,dungeonRegionInfo} from '../packages/content/index.ts';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import {NavigationGrid} from '../packages/simulation/navigation-grid.ts';
import {worldTables} from '../packages/content/world-tables.ts';

describe('plane scenes (箱庭位面 greybox)',()=>{
 it('every wind nest gate leads to a registered two-stage plane dungeon that returns to the port (HUB rework)',()=>{
  for(const gate of worldTables.planeGates.filter(g=>g.region==='ss-map-wind'&&g.kind==='nest')){
   const d=dungeonContent.definitions.find(d=>d.id===gate.plane)!;expect(d,gate.plane).toBeTruthy();
   expect(d.policy.returnRegion).toBe('ss-map-port');expect(d.stages.length).toBe(2);
   for(const id of d.stages){expect(planeMaps[id]?.kit).toBe(gate.style);expect(dungeonRegionInfo(id)).toBe(gate.region);}
   expect(regionById(d.stages[1]).spawns.some(s=>s.boss)).toBe(true);
  }
 });
 it('is deterministic, and collision covers exactly the rock and pillar cells',()=>{
  for(const spec of planeStageSpecs){
   const a=buildPlaneStage(spec),b=buildPlaneStage(spec);expect(JSON.stringify(a.map)).toBe(JSON.stringify(b.map));expect(a.region.spawns).toEqual(b.region.spawns);
   const w=a.map.width;expect(a.map.cells.length).toBe(w*a.map.height);
   for(let y=0;y<a.map.height;y++)for(let x=0;x<w;x++){const solid=!'.,'.includes(a.map.cells[y*w+x]),covered=a.region.obstacles.some(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h);if(solid!==covered)throw Error(`${spec.id} cell ${x},${y}`);}
  }
 });
 it('entry, every enemy and every chest are reachable from the safe point',()=>{
  for(const spec of planeStageSpecs){const r=regionById(spec.id),grid=new NavigationGrid(r.width,r.height,r.obstacles,.55);
   for(const p of [r.portal,...r.spawns,...(r.keyChests??[])])expect(grid.path(r.safe,p).length,`${spec.id} ${JSON.stringify(p)}`).toBeGreaterThan(0);}
 });
 it('rock never rises high enough to hide a floor cell in front of it (front rows keep only a 14px stub)',()=>{
  for(const map of Object.values(planeMaps)){
   const w=map.width,floor:number[][]=[];
   for(let y=0;y<map.height;y++)for(let x=0;x<w;x++)if(map.cells[y*w+x]!=='#')floor.push([x,y]);
   for(let y=0;y<map.height;y++)for(let x=0;x<w;x++){const e=map.heights[y*w+x];if(map.cells[y*w+x]!=='#'||e<=14)continue;// 14px stubs are allowed everywhere
    for(const [fx,fy] of floor){const k=(x+y)-(fx+fy);if(k<1||k>12||Math.abs((fx-fy)-(x-y))>2)continue;
     if(e>18*k-PLANE_SIGHT_MARGIN+.5)throw Error(`${map.id} rock ${x},${y} h${e} hides ${fx},${fy}`);}}
  }
 });
 it('blockers are solid, and every placed part has a runtime file',()=>{
  for(const map of Object.values(planeMaps)){
   // Blockers sit on their cell centre; 2×2 pillars on the shared corner of their four cells.
   for(const p of map.pieces.filter(p=>p.layer==='blocker'||p.layer==='pillar'))expect('ox'.includes(map.cells[Math.floor(p.y-.5)*map.width+Math.floor(p.x-.5)]),`${map.id} ${p.part} ${p.x},${p.y}`).toBe(true);
   for(const id of map.resources)expect((runtimeResources.get(id) as any)?.runtime.file,id).toBeTruthy();
   for(const part of ['ground-main','wall-straight','wall-top','backdrop-near'])expect(map.resources).toContain(planeResource(map.kit,part,map.island));
  }
 });
 it('every island dresses every kit: island parts and feature pieces resolve to runtime files, features block a cell',()=>{
  for(const spec of planeStageSpecs)for(const island of PLANE_ISLANDS){const {map}=buildPlaneStage({...spec,island:'ss-map-'+island});expect(map.island).toBe(island);
   for(const id of map.resources)expect((runtimeResources.get(id) as any)?.runtime.file,id).toBeTruthy();
   for(const part of [...PLANE_ISLAND_PARTS])expect((runtimeResources.get(planeResource(map.kit,part,island)) as any)?.runtime.file,`${island} ${map.kit} ${part}`).toBeTruthy();
   for(const p of map.pieces.filter(p=>PLANE_FEATURES.includes(p.part)))expect(p.layer).toBe('blocker');
   expect(island==='wind'||Boolean(map.material?.tint),island).toBe(true);}
  // Across the six stages at least one feature of each kind is placed somewhere.
  for(const f of PLANE_FEATURES)expect(Object.values(planeMaps).some(m=>m.pieces.some(p=>p.part===f)),f).toBe(true);
 });
});
