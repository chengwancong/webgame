import type {StarseaMap} from './starsea-world-renderer.ts';
/**
 * 剧情副本段（content/hub-dungeon-templates cropHubStoryRegion）只截原岛的一块矩形，presentationKey 记作「源图:crop:x,y」。
 * 静态 fieldMaps 里没有这些段的地图，画面要从源岛地图按同一矩形平移裁出，否则进图只剩相机底色（2026-10-26 用户反馈抢救船台）。
 */
export function cropOrigin(key?:string){const m=key?.match(/^(.+):crop:(\d+),(\d+)$/);return m?{source:m[1],x:Number(m[2]),y:Number(m[3])}:undefined;}
export function cropStarseaMap(map:StarseaMap,id:string,x:number,y:number,width:number,height:number):StarseaMap{
 const pad=4,near=(p:{x:number;y:number})=>p.x>=x-pad&&p.y>=y-pad&&p.x<x+width+pad&&p.y<y+height+pad,shift=<T extends {x:number;y:number}>(p:T)=>({...p,x:p.x-x,y:p.y-y});
 const triples=(list:number[])=>list.map((v,i)=>i%3===0?v-x:i%3===1?v-y:v);
 const dressing=map.dressing&&{...map.dressing,
  plaza:map.dressing.plaza&&{...map.dressing.plaza,points:map.dressing.plaza.points.map(([px,py,r])=>[px-x,py-y,r] as [number,number,number])},
  scatter:map.dressing.scatter&&{...map.dressing.scatter,land:[map.dressing.scatter.land[0]-x,map.dressing.scatter.land[1]-y,map.dressing.scatter.land[2],map.dressing.scatter.land[3]] as [number,number,number,number],clear:triples(map.dressing.scatter.clear)}};
 // 截出来的是岛内一块：不再有海岸线，边界按整块矩形画。
 return {...map,id,width,height,landmarks:map.landmarks.filter(near).map(shift),decorations:map.decorations.filter(near).map(shift),
  roads:map.roads.map(r=>({...r,points:r.points.map(([px,py])=>[px-x,py-y] as [number,number])})),boundary:{...map.boundary,points:undefined},...(dressing?{dressing}:{})};
}
const cache=new Map<string,StarseaMap>();
export function storyCropMap(region:{id:string;presentationKey?:string;width:number;height:number},maps:Record<string,unknown>):StarseaMap|undefined{
 const o=cropOrigin(region.presentationKey),source=o&&maps[o.source] as StarseaMap|undefined;if(!o||!source)return;
 const key=region.id+'@'+region.presentationKey+'@'+region.width+'x'+region.height;let map=cache.get(key);
 if(!map){map=cropStarseaMap(source,region.id,o.x,o.y,region.width,region.height);cache.set(key,map);}return map;
}
