import type {Region} from '../../../../packages/content/index.ts';
import type {IsoPoint} from '../iso.ts';
import type {StarseaMap} from '../starsea-world-renderer.ts';
import {mapRoads} from '../map-layout.ts';
import {roadCells} from '../world-chunks.ts';

export type MapMarker=IsoPoint&{id?:string;name:string;main:boolean;question?:boolean;resource?:string;priority?:number};
/** Priority only changes the active objective arrow; all map marks still render. */
export function minimapMainTarget(markers:readonly MapMarker[],projectPoint:(marker:MapMarker)=>IsoPoint,center:IsoPoint){
 return markers.filter(marker=>marker.main&&!marker.question).map(marker=>{const p=projectPoint(marker);return{marker,p,d:Math.hypot(p.x-center.x,p.y-center.y)};})
  .sort((a,b)=>(a.marker.priority??0)-(b.marker.priority??0)||a.d-b.d)[0];
}
/** Live scene snapshots can move residents and omit NPCs who have not arrived. */
export function minimapNpcs(mapped:MapMarker[],live?:MapMarker[]){return live??mapped;}
type MapState={map?:StarseaMap;npcs:MapMarker[];pending:Promise<void>};
const maps=new Map<string,MapState>();
const cellsCache=new WeakMap<StarseaMap,IsoPoint[]>();
const dimensionErrors=new WeakMap<StarseaMap,Set<string>>();

/** Exactly the cell-band expansion used by StarseaWorldRenderer: segments rasterized by roadCells, then widened. */
export function starseaRoadCells(map:StarseaMap){
 let cells=cellsCache.get(map);if(cells)return cells;
 const unique=new Map<string,IsoPoint>();
 for(const road of map.roads){const radius=Math.floor(road.widthCells/2);
  for(const [x,y] of roadCells(road.points))for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)unique.set(`${x+dx},${y+dy}`,{x:x+dx,y:y+dy});
 }
 cells=[...unique.values()];cellsCache.set(map,cells);return cells;
}
export function minimapTerrain(region:Region,map?:StarseaMap){
 if(map||region.presentationKey?.startsWith('ss-map-')){
  if(map&&(map.width!==region.width||map.height!==region.height)){
   const key=`${region.id}:${region.width}x${region.height}`,seen=dimensionErrors.get(map)??new Set<string>();
   if(!seen.has(key)){console.error('[minimap] Map dimensions differ; using region bounds',{id:map.id,map:[map.width,map.height],region:[region.width,region.height]});seen.add(key);dimensionErrors.set(map,seen);}
  }
  return {source:map?'starsea':'loading',roads:[],roadCells:map?starseaRoadCells(map):[],obstacles:map?map.decorations.filter(d=>d.occlusion==='foreground'&&d.depthMode!=='ground').map(d=>({x:d.x,y:d.y,w:Math.max(1,(d.displayWidth??96)/64),h:1})):[],landmarks:map?map.landmarks.map(l=>({...l,kind:'landmark'})):[]} as const;
 }
 return {source:'region',roads:mapRoads(region),roadCells:[],obstacles:region.obstacles,landmarks:region.landmarks} as const;
}
/** Lazy engine imports keep the pure geometry/test path independent of Phaser. */
export function requestMinimapMap(id:string){
 let state=maps.get(id);if(state)return state;
 state={npcs:[],pending:Promise.resolve()};maps.set(id,state);const result=state;
 result.pending=import('../starsea-world-renderer.ts').then(({loadStarseaMap})=>loadStarseaMap(id)).then(async map=>{
  if(map.id!==id)throw Error('Map identity differs '+id);
  const {starseaPortObjects}=await import('../starsea-story-renderer.ts');
  result.npcs=starseaPortObjects(map).map(n=>({id:n.npcId,name:n.name??n.id,...n.position,main:false}));result.map=map;
 }).catch(error=>{console.error('[minimap] Starsea map unavailable '+id,error);});
 return result;
}
