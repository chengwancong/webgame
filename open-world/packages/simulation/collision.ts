import type {Vec} from '../contracts/index.ts';
import type {Region} from '../content/index.ts';
import {distance,walkable} from './navigation.ts';
import {navigationGrid,segmentObstacle} from './navigation-grid.ts';
export type Body={id:string;position:Vec;radius:number};

/** Earliest contact along the entire motion segment, including a zero-length segment. */
export function segmentContact(from:Vec,to:Vec,center:Vec,radius:number):number|null{
 const dx=to.x-from.x,dy=to.y-from.y,fx=from.x-center.x,fy=from.y-center.y;
 const c=fx*fx+fy*fy-radius*radius;if(c<=0)return 0;
 const a=dx*dx+dy*dy;if(a<1e-12)return null;
 const b=2*(fx*dx+fy*dy),disc=b*b-4*a*c;if(disc<0)return null;
 const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:null;
}
export function terrainContact(region:Region,from:Vec,to:Vec,pad=.05):number|null{
 let first:number|null=null;
 for(const o of [...navigationGrid(region,pad).candidates(from,to),...region.dynamicObstacles??[]]){const t=segmentObstacle(from,to,o,pad);if(t!==null)first=first===null?t:Math.min(first,t);}
 for(const [start,end,min,max] of [[from.x,to.x,1,region.width-1],[from.y,to.y,1,region.height-1]]){
  if(end<min||end>=max){const t=((end<min?min:max)-start)/(end-start);if(t>=0&&t<=1)first=first===null?t:Math.min(first,t);}
 }
 return first;
}

/** Substeps prevent fast dashes crossing bodies or walls; ordinary walking can slide. */
export function moveBody(region:Region,from:Vec,to:Vec,amount:number,radius:number,others:Body[],slide=true):Vec{
 const length=distance(from,to);if(length<1e-8||amount<=0)return {...from};
 const travel=Math.min(amount,length),steps=Math.ceil(travel/.12),dx=(to.x-from.x)/length*travel/steps,dy=(to.y-from.y)/length*travel/steps;
 let p={...from};
 const clear=(q:Vec)=>walkable(region,q,radius)&&others.every(body=>distance(q,body.position)>=radius+body.radius-1e-6);
 for(let i=0;i<steps;i++){
  const next={x:p.x+dx,y:p.y+dy};
  if(clear(next)){p=next;continue;}
  if(!slide)break;
  // Slide along the contact surface, keeping the full body outside the blocker.
  let tangent={...next};
  for(const body of others){const d=distance(tangent,body.position),required=radius+body.radius;
   if(d>1e-8&&d<required){tangent={x:body.position.x+(tangent.x-body.position.x)/d*(required+1e-5),y:body.position.y+(tangent.y-body.position.y)/d*(required+1e-5)};}
  }
  if(clear(tangent)&&distance(p,tangent)>.00001){p=tangent;continue;}
  const x={x:next.x,y:p.y},y={x:p.x,y:next.y};
  if(Math.abs(dx)>=Math.abs(dy)){if(clear(x))p=x;else if(clear(y))p=y;}
  else{if(clear(y))p=y;else if(clear(x))p=x;}
 }
 return p;
}
/** Deterministic normals let coincident spawns separate instead of remaining stacked. */
export function contactNormal(a:Body,b:Body):Vec{
 const d=distance(a.position,b.position);
 if(d>1e-8)return {x:(a.position.x-b.position.x)/d,y:(a.position.y-b.position.y)/d};
 const first=a.id<b.id?a.id:b.id,second=a.id<b.id?b.id:a.id;let hash=0;
 for(const char of first+'|'+second)hash=(hash*31+char.charCodeAt(0))>>>0;
 const angle=(hash%360)*Math.PI/180,sign=a.id<b.id?1:-1;return {x:Math.cos(angle)*sign,y:Math.sin(angle)*sign};
}
