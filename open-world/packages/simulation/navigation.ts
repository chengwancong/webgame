import type {Vec} from '../contracts/index.ts';
import type {Region} from '../content/index.ts';
import {navigationGrid,overlayWalkable,segmentObstacle} from './navigation-grid.ts';
export {navigationGrid,invalidateNavigation} from './navigation-grid.ts';
export function distance(a:Vec,b:Vec){return Math.hypot(a.x-b.x,a.y-b.y);}
export function walkable(r:Region,p:Vec,pad=.35){return Number.isFinite(p.x)&&Number.isFinite(p.y)&&navigationGrid(r,pad).walkable(p)&&overlayWalkable(r,p,pad);}
export function move(r:Region,p:Vec,to:Vec,amount:number):Vec{
 const d=distance(p,to);if(d<.01)return {...p};const a=Math.min(amount,d)/d;
 const next={x:p.x+(to.x-p.x)*a,y:p.y+(to.y-p.y)*a};
 if(walkable(r,next))return next;
 if(walkable(r,{x:next.x,y:p.y}))return {x:next.x,y:p.y};
 if(walkable(r,{x:p.x,y:next.y}))return {x:p.x,y:next.y};
 return {...p};
}
export function findPath(r:Region,start:Vec,end:Vec,pad=.55):Vec[]{
 if(!Number.isFinite(start.x)||!Number.isFinite(start.y)||!Number.isFinite(end.x)||!Number.isFinite(end.y))return [];
 if(Math.max(r.width,r.height)>=128&&!r.dynamicObstacles?.length)return navigationGrid(r,pad).path(start,end);
 if(!walkable(r,end,pad))return [];
 const sx=Math.floor(start.x),sy=Math.floor(start.y);let ex=Math.floor(end.x),ey=Math.floor(end.y);
 if(!walkable(r,{x:ex+.5,y:ey+.5},pad)){
  const cells=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   const point={x:ex+dx+.5,y:ey+dy+.5},steps=Math.max(1,Math.ceil(distance(point,end)*8));
   if(walkable(r,point,pad)&&Array.from({length:steps+1},(_,i)=>({x:point.x+(end.x-point.x)*i/steps,y:point.y+(end.y-point.y)*i/steps})).every(p=>walkable(r,p,pad)))cells.push(point);
  }
  const cell=cells.sort((a,b)=>distance(a,end)-distance(b,end))[0];if(!cell)return [];
  ex=Math.floor(cell.x);ey=Math.floor(cell.y);
 }
 // 8 方向 A*：等距投影下屏幕水平/竖直 = 网格对角线，只走 4 方向会走成阶梯或 V 字。
 const W=r.width,key=(x:number,y:number)=>y*W+x,src=key(sx,sy),dst=key(ex,ey);
 const open=new Int8Array(W*r.height),cell=(x:number,y:number)=>{if(x<0||y<0||x>=W||y>=r.height)return false;const k=key(x,y);if(!open[k])open[k]=walkable(r,{x:x+.5,y:y+.5},pad)?1:2;return open[k]===1;};
 const g=new Map<number,number>([[src,0]]),parent=new Map<number,number>([[src,src]]),closed=new Set<number>();
 const h=(x:number,y:number)=>{const dx=Math.abs(x-ex),dy=Math.abs(y-ey);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
 const heap:[number,number][]=[[h(sx,sy),src]];
 const push=(item:[number,number])=>{heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
 const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<heap.length&&heap[a][0]<heap[m][0])m=a;if(b<heap.length&&heap[b][0]<heap[m][0])m=b;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
 const steps=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
 while(heap.length){const [,c]=pop();if(closed.has(c))continue;if(c===dst)break;closed.add(c);const x=c%W,y=Math.floor(c/W),base=g.get(c)!;
  for(const [dx,dy,cost] of steps){const nx=x+dx,ny=y+dy;if(!cell(nx,ny))continue;if(dx&&dy&&(!cell(x+dx,y)||!cell(x,y+dy)))continue;
   const n=key(nx,ny),next=base+cost;if(next>=(g.get(n)??Infinity))continue;g.set(n,next);parent.set(n,c);push([next+h(nx,ny),n]);}
 }
 if(!parent.has(dst))return [];
 const raw:Vec[]=[end];let c=dst;while(c!==src){raw.push({x:c%W+.5,y:Math.floor(c/W)+.5});c=parent.get(c)!;}
 raw.push({...start});raw.reverse();
 // 拉直：从当前锚点一直走到最远的直线可达点，去掉网格折线。
 const clear=(a:Vec,b:Vec)=>{const n=Math.max(1,Math.ceil(distance(a,b)*4));for(let i=1;i<=n;i++)if(!walkable(r,{x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},pad))return false;return true;};
 const path:Vec[]=[];let anchor=raw[0];
 for(let i=1;i<raw.length;i++){if(i+1<raw.length&&clear(anchor,raw[i+1]))continue;path.push(raw[i]);anchor=raw[i];}
 return path;
}
export function lineOfSight(r:Region,a:Vec,b:Vec){if(r.activationRadius)return navigationGrid(r,.05).clear(a,b)&&!r.dynamicObstacles?.some(o=>segmentObstacle(a,b,o,.05)!==null);const d=distance(a,b),steps=Math.ceil(d*4);for(let i=1;i<steps;i++)if(!walkable(r,{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps},.05))return false;return true;}
