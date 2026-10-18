import {it,expect} from 'vitest';
import production from '../packages/content/open-world/production.json';
import {mapScatter,groundLayers,roadHalf,roadCurves,roadJunctions} from '../apps/web/src/world-dressing.ts';
import type {StarseaMap} from '../apps/web/src/starsea-world-renderer.ts';

// Scene dressing (2026-10-11, docs/scene-dressing.md): soft roads per island, settlement cobblestone, dense non-blocking scatter.
const islands=(production as unknown as {islands:{region:{id:string;safe:{x:number;y:number}};map:StarseaMap&{worldObjects:Record<string,unknown>}}[]}).islands;
const segment=(p:{x:number;y:number},a:[number,number],b:[number,number])=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-dx*t,p.y-a[1]-dy*t);};

it('dresses all six production islands with their own road and cobblestone materials',()=>{
 expect(islands).toHaveLength(6);
 const wind=islands.find(i=>i.map.id==='ss-map-wind')!;expect(wind.map.roads.every(r=>r.resource==='ow-road-dirt')).toBe(true);expect(wind.map.dressing?.plaza?.resource).toBe('ow-road-stone');
 for(const {map,region} of islands){const d=map.dressing!;expect(d.patches.length,map.id).toBeGreaterThan(0);expect(d.scatter?.step,map.id).toBe(5);
  // The landing is always a settlement plaza.
  expect(d.plaza!.points.some(([x,y])=>Math.hypot(x-region.safe.x,y-region.safe.y)<1),map.id).toBe(true);
  expect(groundLayers(map).length,map.id).toBeGreaterThanOrEqual(d.patches.length+3);}
});

it('scatters dense, deterministic decoration that stays off roads, camps, waypoints and spawn points',()=>{
 for(const {map,region} of islands){
  const items=mapScatter(map),again=mapScatter(structuredClone(map));expect(again,map.id).toEqual(items);
  expect(items.length,map.id).toBeGreaterThan(3500);for(const kind of ['tree','bush','flower','rock','tuft'])expect(items.some(i=>i.kind===kind),map.id+' '+kind).toBe(true);
  // Independent of the generator's clear list: recompute play points from the sealed world objects.
  const points:{x:number;y:number;r:number}[]=[{...region.safe,r:7}];
  for(const [key,rows] of Object.entries(map.worldObjects))if(Array.isArray(rows))for(const row of rows as any[])for(const p of row.path??row.spots??(Number.isFinite(row.x)?[row]:[]))points.push({x:p.x,y:p.y,r:key==='camps'?row.radius+2:5});
  expect(points.length,map.id).toBeGreaterThan(300);
  for(const item of items){
   const near=points.find(p=>Math.hypot(p.x-item.x,p.y-item.y)<p.r);expect(near,`${map.id} ${item.id} covers a play point`).toBeUndefined();
   // Against the drawn (curved) road; one expect per item, the curves have hundreds of segments.
   if(item.kind!=='tuft')roadCurves(map).forEach((c,ri)=>{let d=Infinity;for(let i=1;i<c.length;i++)d=Math.min(d,segment(item,c[i-1],c[i]));expect(d,`${map.id} ${item.id} on road`).toBeGreaterThan(roadHalf(map.roads[ri]));});
  }
  // Only trees fade for the hero; everything is presentation (no blocker field).
  expect(items.every(i=>!('blocker' in i)&&(i.kind==='tree')===(i.occlusion==='foreground'))).toBe(true);
 }
});

it('draws roads as gentle curves that keep to the sealed route, run through plazas and miss decorations',()=>{
 for(const {map} of islands){const curves=roadCurves(map),decor=(map as {decorations?:{x:number;y:number}[]}).decorations??[];expect(roadCurves(structuredClone(map)),map.id).toEqual(curves);
  map.roads.forEach((road,ri)=>{const c=curves[ri],p=road.points,half=roadHalf(road),off=(q:[number,number])=>Math.min(...p.slice(1).map((b,i)=>segment({x:q[0],y:q[1]},p[i],b)));
   expect(c[0],map.id).toEqual(p[0]);expect(c.at(-1),map.id).toEqual(p.at(-1));
   // Presentation only: the drawn road never strays far from the walkable route, but it is no longer ruler-straight.
   const offs=c.map(off);expect(Math.max(...offs),map.id).toBeLessThan(6);expect(Math.max(...offs),map.id).toBeGreaterThan(1.5);
   for(let i=1;i<c.length;i++)expect(Math.hypot(c[i][0]-c[i-1][0],c[i][1]-c[i-1][1]),map.id).toBeLessThan(2);
   // A vertex under a plaza keeps a tight corner: the drawn road still covers it, so the plaza sits on the road.
   for(const v of p)if((map.dressing?.plaza?.points??[]).some(([x,y,r])=>Math.hypot(v[0]-x,v[1]-y)<r))expect(Math.min(...c.slice(1).map((b,i)=>segment({x:v[0],y:v[1]},c[i],b))),`${map.id} plaza vertex ${v}`).toBeLessThan(half);
   // The bend never pushes the road onto a decoration the straight road kept clear of (some sit on the route by design).
   for(const d of decor){const was=Math.min(...p.slice(1).map((b,i)=>segment(d,p[i],b)));if(was<=half)continue;
    expect(Math.min(...c.slice(1).map((b,i)=>segment(d,c[i],b))),`${map.id} decoration ${d.x},${d.y}`).toBeGreaterThan(half);}});
 }
});

it('closes road junctions with fillets and gap bridges between roads of one material only',()=>{
 const dist=(c:[number,number][],p:[number,number])=>Math.min(...c.map(q=>Math.hypot(q[0]-p[0],q[1]-p[1])));
 for(const {map} of islands){const curves=roadCurves(map),{fillets,bridges}=roadJunctions(map),R=2.5;
  // Every island has several roads, so every island has junctions to close.
  expect(fillets.length,map.id).toBeGreaterThan(0);
  for(const f of fillets){
   // The fillet circle touches its own road and one other road, and sits clear of every road's paving.
   expect(Math.abs(dist(curves[f.road],f.c)-roadHalf(map.roads[f.road])-R),map.id).toBeLessThan(.6);
   expect(curves.some((c,j)=>j!==f.road&&Math.abs(dist(c,f.c)-roadHalf(map.roads[j])-R)<.6),map.id).toBe(true);
   curves.forEach((c,j)=>expect(dist(c,f.c),map.id).toBeGreaterThan(roadHalf(map.roads[j])+R-.6));}
  for(const b of bridges){const j=curves.findIndex((c,k)=>k!==b.road&&c.includes(b.b));expect(j,map.id).toBeGreaterThanOrEqual(0);
   expect(map.roads[j].resource,map.id).toBe(map.roads[b.road].resource);
   expect(Math.hypot(b.a[0]-b.b[0],b.a[1]-b.b[1])-roadHalf(map.roads[b.road])-roadHalf(map.roads[j]),map.id).toBeLessThan(2*R);}
  // A lone road is left exactly as drawn before.
  const lone={...map,id:map.id+':lone',roads:map.roads.slice(0,1)};expect(roadJunctions(lone),map.id).toEqual({fillets:[],bridges:[]});}
});
