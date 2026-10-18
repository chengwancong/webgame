import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {findPath,walkable,navigationGrid,invalidateNavigation} from '../packages/simulation/navigation.ts';
import {terrainContact} from '../packages/simulation/collision.ts';
import type {Region} from '../packages/content/index.ts';
const fixture=JSON.parse(readFileSync(new URL('../.design/open-world-m0/graybox.json',import.meta.url),'utf8'));
const region:Region=fixture.region;
const legacy=(r:Region,p:{x:number;y:number},pad:number)=>p.x>=1&&p.y>=1&&p.x<r.width-1&&p.y<r.height-1&&!r.obstacles.some(o=>p.x>o.x-pad&&p.x<o.x+o.w+pad&&p.y>o.y-pad&&p.y<o.y+o.h+pad);
describe('512-cell island navigation',()=>{
 it('matches continuous collision at fractional positions for every body radius',()=>{let state=7;for(const pad of [.05,.35,.55,.65,.9])for(let n=0;n<1500;n++){state=(Math.imul(state,1664525)+1013904223)>>>0;const x=state/4294967296*512;state=(Math.imul(state,1664525)+1013904223)>>>0;const p={x,y:state/4294967296*512};expect(walkable(region,p,pad)).toBe(legacy(region,p,pad));}});
 it('keeps all generated camps and waypoints reachable without clipping a wall',()=>{const grid=navigationGrid(region,.55);grid.prepare();for(const end of [...fixture.camps,...fixture.waypoints]){const path=findPath(region,region.safe,end);expect(path.length,`unreachable ${end.id}`).toBeGreaterThan(0);let from=region.safe;for(const to of path){expect(terrainContact(region,from,to,.55),`crossed terrain to ${end.id}`).toBeNull();from=to;}}});
 it('does not join disconnected components that share a chunk',()=>{const r={...region,obstacles:[{x:256,y:0,w:1,h:512}]};expect(findPath(r,{x:120,y:200},{x:390,y:200})).toEqual([]);expect(findPath(r,{x:120,y:200},{x:120,y:400})).toEqual([{x:120,y:400}]);});
 it('routes around a temporary blocker and leaves the static grid reusable',()=>{const r={...region,obstacles:[]},base=navigationGrid(r,.55),blocked={...r,dynamicObstacles:[{x:250,y:250,w:12,h:12}]};const path=findPath(blocked,{x:245,y:256},{x:270,y:256});expect(path.length).toBeGreaterThan(1);let from={x:245,y:256};for(const to of path){expect(terrainContact(blocked,from,to,.55)).toBeNull();from=to;}expect(navigationGrid(r,.55)).toBe(base);expect(findPath(r,{x:245,y:256},{x:270,y:256})).toEqual([{x:270,y:256}]);});
 it('invalidates cached geometry explicitly after an editor moves a wall',()=>{const r={...region,obstacles:[{x:20,y:20,w:5,h:5}]};expect(walkable(r,{x:22,y:22})).toBe(false);r.obstacles[0].x=200;invalidateNavigation(r);expect(walkable(r,{x:22,y:22})).toBe(true);expect(walkable(r,{x:202,y:22})).toBe(false);});
 it('preserves all eight straight screen directions on open land',()=>{const r={...region,obstacles:[]},start={x:256,y:256};for(const [x,y]of [[40,0],[-40,0],[0,40],[0,-40],[40,40],[-40,-40],[40,-40],[-40,40]]){const end={x:start.x+x,y:start.y+y};expect(findPath(r,start,end)).toEqual([end]);}});
});
