import {describe,it,expect} from 'vitest';
import {generatePlaneStage,planeLayoutMap} from '../packages/content/plane-layouts.ts';
import {planeStageSpecs,PLANE_SIGHT_MARGIN} from '../packages/content/plane-scenes.ts';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import {NavigationGrid} from '../packages/simulation/navigation-grid.ts';

const SEEDS=Array.from({length:24},(_,i)=>1+i*104729);
describe('plane random layouts (箱庭位面随机布局)',()=>{
 it('every seed builds, and the same seed gives the same layout while different seeds differ',()=>{
  for(const spec of planeStageSpecs){const shapes=new Set<string>();
   for(const seed of SEEDS){const a=generatePlaneStage(spec.id,seed);shapes.add(a.map.cells);expect(a.region.id).toBe(spec.id);expect(a.region.layoutSeed).toBe(seed);expect(a.region.boss).toBe(spec.boss);}
   const again=generatePlaneStage(spec.id,SEEDS[3]);expect(JSON.stringify(again.map)).toBe(JSON.stringify(generatePlaneStage(spec.id,SEEDS[3]).map));expect(planeLayoutMap(spec.id,SEEDS[3]).cells).toBe(again.map.cells);
   expect(shapes.size,spec.id).toBeGreaterThanOrEqual(SEEDS.length-2);}
 });
 it('keeps the authored monster budget, and the portal, every enemy and every chest are reachable',()=>{
  for(const spec of planeStageSpecs)for(const seed of SEEDS){const {region}=generatePlaneStage(spec.id,seed),grid=new NavigationGrid(region.width,region.height,region.obstacles,.55);
   expect(region.spawns.length).toBe(spec.pack.reduce((n,p)=>n+p.count,0));expect(region.spawns.filter(s=>s.boss).length).toBe(spec.boss?1:0);expect((region.keyChests??[]).length).toBe(spec.chests.length);
   for(const p of [region.portal,...region.spawns,...(region.keyChests??[]).map(c=>({x:c.x+.5,y:c.y+.5}))])expect(grid.path(region.safe,p).length,`${spec.id} ${seed} ${JSON.stringify(p)}`).toBeGreaterThan(0);}
 });
 it('is one main line: halls are chained by single passages plus at most one dead-end side room',()=>{
  for(const spec of planeStageSpecs.filter(s=>!s.boss&&s.kit!=='maze'))for(const seed of SEEDS.slice(0,8)){const {spec:run}=generatePlaneStage(spec.id,seed);
   const rooms=run.carve.filter(op=>'disk' in op||'rect' in op).length,passages=run.carve.filter(op=>'path' in op).length;expect(passages,`${spec.id} ${seed}`).toBe(rooms-1);}
  for(const seed of SEEDS.slice(0,8)){const {spec:run}=generatePlaneStage('plane-wind-nest-maze-1',seed),maze=run.carve.map(op=>'maze' in op?op.maze:undefined).find(Boolean)!;expect(maze.loops).toBeLessThanOrEqual(2);}
 });
 it('generated rock never hides floor in front of it, and every placed part has a runtime file',()=>{
  for(const spec of planeStageSpecs)for(const seed of SEEDS.slice(0,2)){const {map}=generatePlaneStage(spec.id,seed),w=map.width;
   for(let y=0;y<map.height;y++)for(let x=0;x<w;x++){const e=map.heights[y*w+x];if(map.cells[y*w+x]!=='#'||e<=14)continue;
    for(let k=1;k<=12;k++)for(let j=-2;j<=2;j++){const s=x+y-k+(x-y)+j;if(s&1)continue;const fx=s/2,fy=(x+y-k-(x-y)-j)/2;if(fx<0||fy<0||fx>=w||fy>=w||map.cells[fy*w+fx]==='#')continue;
     if(e>18*k-PLANE_SIGHT_MARGIN+.5)throw Error(`${map.id}#${seed} rock ${x},${y} h${e} hides ${fx},${fy}`);}}
   for(const id of map.resources)expect((runtimeResources.get(id) as any)?.runtime.file,id).toBeTruthy();}
 });
});
