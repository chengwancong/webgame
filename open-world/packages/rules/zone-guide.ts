import type {Region} from '../content/index.ts';
import {findPath} from '../simulation/navigation.ts';
import {worldTables,worldZoneAt} from '../content/world-tables.ts';

type Vec={x:number;y:number};
export type GuideTarget=Vec&{label:string};

/** Zone-aware guidance (expansion plan §引导): a target in the hero's own zone is shown as
 * is. A target in another zone points at the nearest unlocked waypoint of that zone (travel
 * from the map), else at the exit of the hero's zone along the walkable route. Direction
 * arrow plus one short line only — never a ground path. */
export function zoneGuide(region:Region,hero:Vec,target:GuideTarget,unlocked:readonly string[]):GuideTarget{
 const here=worldZoneAt(region.id,hero),there=worldZoneAt(region.id,target);
 if(!here||!there||here.id===there.id)return target;
 const waypoint=worldTables.waypoints.filter(w=>w.region===region.id&&w.zone===there.id&&unlocked.includes(w.id)).sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))[0];
 if(waypoint)return {x:waypoint.x,y:waypoint.y,label:`${target.label}（可传送：${waypoint.name}）`};
 const exit=zoneExit(region,hero,target,here.rect);if(!exit)return target;
 const next=worldZoneAt(region.id,exit);
 return {x:exit.x,y:exit.y,label:next&&next.id!==there.id?`${target.label}（经${next.name}）`:target.label};
}

/** First walkable point outside the hero's zone along the route to the target. */
function zoneExit(region:Region,hero:Vec,target:Vec,rect:{x:number;y:number;w:number;h:number}){
 const inside=(p:Vec)=>p.x>=rect.x&&p.x<rect.x+rect.w&&p.y>=rect.y&&p.y<rect.y+rect.h;
 let from=hero;
 for(const to of findPath(region,hero,target)){
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)));
  for(let i=1;i<=steps;i++){const p={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};if(!inside(p))return {x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10};}
  from=to;
 }
 return undefined;
}
