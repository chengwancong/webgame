import {describe,it,expect,vi} from 'vitest';
import {regions} from '../packages/content/index.ts';
import {findPath} from '../packages/simulation/navigation.ts';
import {mapRoads} from '../apps/web/src/map-layout.ts';
import * as mapLayout from '../apps/web/src/map-layout.ts';
import {minimapProjection,radarProjection,minimapPoint,mapCorners,RADAR_RADIUS_CELLS,RADAR_ZOOMS,radarRadius} from '../apps/web/src/ui/minimap.ts';
import {minimapTerrain,minimapNpcs} from '../apps/web/src/ui/minimap-data.ts';
import {project,unproject} from '../apps/web/src/iso.ts';
import type {StarseaMap} from '../apps/web/src/starsea-world-renderer.ts';
import {questHudHeader,questHudButton} from '../apps/web/src/ui/quest-tracker.ts';
describe('painted world HUD',()=>{
 it.each([[32,32],[64,24],[24,80]])('fits the isometric %ix%i region corners inside full-map padding', (width,height)=>{
  for(const size of [144,270,320]){const p=minimapProjection(width,height,size);expect(p.height).toBeLessThan(p.width);
   for(const corner of mapCorners(width,height)){const q=minimapPoint(corner,p);expect(q.x).toBeGreaterThanOrEqual(p.padding-1e-9);expect(q.x).toBeLessThanOrEqual(p.width-p.padding+1e-9);expect(q.y).toBeGreaterThanOrEqual(p.padding-1e-9);expect(q.y).toBeLessThanOrEqual(p.height-p.padding+1e-9);}
  }
 });
 it('keeps the radar player at the center while terrain shifts by the real movement delta',()=>{
  const before={x:5,y:12},after={x:7,y:9},a=radarProjection(before,144),b=radarProjection(after,144);
  expect(minimapPoint(before,a)).toEqual({x:72,y:72});expect(minimapPoint(after,b)).toEqual({x:72,y:72});
  const landmark={x:14,y:14},p=minimapPoint(landmark,a),q=minimapPoint(landmark,b);
  const delta=project({x:after.x-before.x,y:after.y-before.y});expect(q.x-p.x).toBeCloseTo(-delta.x*a.scale);expect(q.y-p.y).toBeCloseTo(-delta.y*a.scale);
 });
 it.each([{x:-1,y:-1},{x:1,y:-1}])('scrolls only along the matching screen axis for movement $x/$y',delta=>{
  const hero={x:9,y:13},other={x:14,y:11},a=radarProjection(hero,144),b=radarProjection({x:hero.x+delta.x,y:hero.y+delta.y},144);
  const before=minimapPoint(other,a),after=minimapPoint(other,b),screen=project(delta);
  if(screen.x===0){expect(after.x).toBeCloseTo(before.x,12);expect(after.y).toBeGreaterThan(before.y);}
  if(screen.y===0){expect(after.y).toBeCloseTo(before.y,12);expect(after.x).toBeLessThan(before.x);}
 });
 it('keeps the hero centered at arbitrary positions and matches projected direction and scale',()=>{
  for(const size of [104,144])for(const hero of [{x:0,y:0},{x:32,y:32},{x:24,y:80},{x:7.125,y:11.875}]){
   const p=radarProjection(hero,size),center=minimapPoint(hero,p);expect(center.x).toBeCloseTo(size/2,12);expect(center.y).toBeCloseTo(size/2,12);
   for(const point of [{x:3,y:4},{x:19,y:20},{x:-2.5,y:91.2}]){const projected=project(point),origin=project(hero),q=minimapPoint(point,p),dx=projected.x-origin.x,dy=projected.y-origin.y;
    const mx=q.x-center.x,my=q.y-center.y;expect(Math.atan2(my,mx)-Math.atan2(dy,dx)).toBeCloseTo(0,12);expect(Math.hypot(mx,my)/Math.hypot(dx,dy)).toBeCloseTo(p.scale,12);
   }
  }
 });
 it('puts a world point twelve cells away along screen-right on the radar edge',()=>{
  const hero={x:16,y:18},p=radarProjection(hero,144,12),q=minimapPoint({x:hero.x+12/Math.SQRT2,y:hero.y-12/Math.SQRT2},p);expect(q.x).toBeCloseTo(p.width-p.padding);expect(q.y).toBeCloseTo(p.height/2);
 });
 it('radar reaches as far sideways as the 1280-wide stage and zoom levels scale the radius',()=>{
  expect(RADAR_RADIUS_CELLS*32*Math.SQRT2).toBeGreaterThanOrEqual(640*.9);expect(RADAR_RADIUS_CELLS*32*Math.SQRT2).toBeLessThanOrEqual(640*1.1);
  expect(RADAR_ZOOMS.map(z=>radarRadius(z))).toEqual([RADAR_RADIUS_CELLS/.75,RADAR_RADIUS_CELLS,RADAR_RADIUS_CELLS/1.5]);
  const hero={x:16,y:18},p=radarProjection(hero),q=minimapPoint({x:hero.x+RADAR_RADIUS_CELLS/Math.SQRT2,y:hero.y-RADAR_RADIUS_CELLS/Math.SQRT2},p);expect(q.x).toBeCloseTo(p.width-p.padding);
 });
 it('round-trips through the shared scene projection without an engine',()=>{
  for(const p of [{x:0,y:0},{x:32,y:24},{x:-2.125,y:17.75}]){const q=unproject(project(p));expect(q.x).toBeCloseTo(p.x,12);expect(q.y).toBeCloseTo(p.y,12);}
 });
 it('does not pin radar position at the map edge or reuse the overview scale',()=>{
  const hero={x:0,y:80};expect(minimapPoint(hero,radarProjection(hero,144))).toEqual({x:72,y:72});expect(radarProjection(hero,144).scale).toBeGreaterThan(minimapProjection(24,80,144).scale);
 });
 it('uses the existing ground road geometry and refreshes when navigation changes',()=>{
  const region=structuredClone(regions[0]),points=[region.portal,...region.landmarks.filter(l=>l.kind!=='portal'),...(region.bossPortal?[region.bossPortal]:[])],expected=points.map(p=>[region.safe,...findPath(region,region.safe,p)]).filter(p=>p.length>1);
  expect(mapRoads(region)).toEqual(expected);const before=mapRoads(region);expect(mapRoads(region)).toBe(before);region.obstacles.push({x:2,y:2,w:1,h:1});expect(mapRoads(region)).not.toBe(before);
 });
 it('uses only sealed Starsea road cells, landmarks and foreground decorations; never navigation roads',()=>{
  const region={...structuredClone(regions[0]),id:'ss-map-test',presentationKey:'ss-map-test',width:8,height:8};
  const map:StarseaMap={id:region.id,name:'test',width:8,height:8,groundResource:'ground',backdropResource:'sky',boundary:{resourceId:'edge',stepCells:8,thicknessCells:1},roads:[{resource:'road',widthCells:3,points:[[2,2]]},{resource:'road',widthCells:1,points:[[3,2],[4,2]]}],landmarks:[{id:'hall',x:3,y:5}],decorations:[{id:'house',resourceId:'house',x:4,y:6,depthMode:'footpoint',occlusion:'foreground'},{id:'decal',resourceId:'decal',x:2,y:2,depthMode:'ground',occlusion:'foreground'},{id:'background',resourceId:'tree',x:1,y:2,depthMode:'footpoint'}]};
  const spy=vi.spyOn(mapLayout,'mapRoads');
  try{const loading=minimapTerrain(region);expect(loading.source).toBe('loading');expect(loading.roads).toEqual([]);expect(loading.landmarks).toEqual([]);
   const actual=minimapTerrain(region,map);expect(actual.source).toBe('starsea');expect(actual.roads).toEqual([]);
   expect(actual.roadCells.map(p=>`${p.x},${p.y}`).sort()).toEqual(['1,1','1,2','1,3','2,1','2,2','2,3','3,1','3,2','3,3','4,2']);
   expect(actual.landmarks).toEqual([{id:'hall',x:3,y:5,kind:'landmark'}]);expect(actual.obstacles).toHaveLength(1);expect(actual.obstacles[0]).toMatchObject({x:4,y:6});expect(spy).not.toHaveBeenCalled();
  }finally{spy.mockRestore();}
 });
 it('reports a Starsea dimension mismatch once and keeps region bounds',()=>{
  const region={...structuredClone(regions[0]),presentationKey:'ss-map-test',width:32,height:24},map={id:'ss-map-test',width:64,height:64,roads:[],landmarks:[],decorations:[]} as unknown as StarseaMap;
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});try{minimapTerrain(region,map);minimapTerrain(region,map);expect(error).toHaveBeenCalledTimes(1);const p=minimapProjection(region.width,region.height);for(const corner of mapCorners(region.width,region.height)){const q=minimapPoint(corner,p);expect(q.x).toBeGreaterThanOrEqual(p.padding);}}finally{error.mockRestore();}
 });
 it('follows actual NPC positions and arrival state, keeping map-mapped NPCs for snapshot-free previews',()=>{
  const mapped=[{id:'ss-npc-cheng',name:'cheng',x:10,y:19,main:false},{id:'ss-npc-tongling',name:'tongling',x:19,y:20,main:false},{id:'ss-npc-milo',name:'milo',x:25,y:10,main:false}];
  const live=[mapped[0],{...mapped[2],x:23,y:12,main:true}];expect(minimapNpcs(mapped,live)).toEqual(live);expect(minimapNpcs(mapped,[])).toEqual([]);expect(minimapNpcs(mapped)).toEqual(mapped);
 });
 it('escapes quest headings and preserves command identity and disabled state',()=>{
  expect(questHudHeader('<script>主线</script>')).toContain('&lt;script&gt;');const button=questHudButton('报告',{action:'story-object',id:'keeper',disabled:true});expect(button).toContain('data-action="story-object"');expect(button).toContain('data-id="keeper"');expect(button).toContain('disabled');expect(button).toContain('hud-quest-action');
 });
});
