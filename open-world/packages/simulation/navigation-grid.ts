import type {Vec} from '../contracts/index.ts';
import type {Region} from '../content/index.ts';

type Obstacle=Region['obstacles'][number];
const CELL=8,CHUNK=32;
const caches=new WeakMap<Obstacle[],Map<string,NavigationGrid>>();
/** Geometry is immutable between explicit invalidations. Moving blockers use
 * Region.dynamicObstacles, so a summon never rebuilds the island's static grid. */
export function invalidateNavigation(region:Region){caches.delete(region.obstacles);}
export function navigationGrid(region:Region,pad=.55){
 let byRadius=caches.get(region.obstacles);if(!byRadius){byRadius=new Map();caches.set(region.obstacles,byRadius);}
 const key=`${region.width}:${region.height}:${pad}:${region.obstacles.length}`;
 let grid=byRadius.get(key);if(!grid){grid=new NavigationGrid(region.width,region.height,region.obstacles,pad);byRadius.set(key,grid);}
 return grid;
}
const inside=(p:Vec,o:Obstacle,pad:number)=>p.x>o.x-pad&&p.x<o.x+o.w+pad&&p.y>o.y-pad&&p.y<o.y+o.h+pad;
export function overlayWalkable(region:Region,p:Vec,pad:number){return !region.dynamicObstacles?.some(o=>inside(p,o,pad));}
export class NavigationGrid{
 private buckets=new Map<number,Obstacle[]>();private cols:number;
 private centers?:Uint8Array;private labels?:Int32Array;private links=new Map<number,Map<number,[number,number][]>>();
 private nodeCenters:Vec[]=[];private marks?:Uint32Array;private closed?:Uint32Array;private costs?:Float64Array;private parents?:Int32Array;private generation=0;
 constructor(readonly width:number,readonly height:number,obstacles:Obstacle[],readonly pad:number){
  this.cols=Math.ceil(width/CELL);
  for(const o of obstacles)for(let y=Math.max(0,Math.floor((o.y-pad)/CELL));y<=Math.min(Math.ceil(height/CELL)-1,Math.floor((o.y+o.h+pad)/CELL));y++)for(let x=Math.max(0,Math.floor((o.x-pad)/CELL));x<=Math.min(this.cols-1,Math.floor((o.x+o.w+pad)/CELL));x++){
   const k=y*this.cols+x,list=this.buckets.get(k);if(list)list.push(o);else this.buckets.set(k,[o]);
  }
 }
 walkable(p:Vec){return p.x>=1&&p.y>=1&&p.x<this.width-1&&p.y<this.height-1&&!(this.buckets.get(Math.floor(p.y/CELL)*this.cols+Math.floor(p.x/CELL))??[]).some(o=>inside(p,o,this.pad));}
 /** Segment broad phase visits only the bins along the swept path. */
 candidates(a:Vec,b:Vec){const found=new Set<Obstacle>(),steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/(CELL/2)));
  for(let i=0;i<=steps;i++){const x=Math.floor((a.x+(b.x-a.x)*i/steps)/CELL),y=Math.floor((a.y+(b.y-a.y)*i/steps)/CELL);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(x+dx<0||x+dx>=this.cols||y+dy<0)continue;for(const o of this.buckets.get((y+dy)*this.cols+x+dx)??[])found.add(o);}}
  return found;
 }
 clear(a:Vec,b:Vec){
  if(!this.walkable(a)||!this.walkable(b))return false;
  for(const o of this.candidates(a,b))if(segmentObstacle(a,b,o,this.pad)!==null)return false;
  return true;
 }
 prepare(){
  if(this.centers)return;
  const size=this.width*this.height;this.centers=new Uint8Array(size);this.labels=new Int32Array(size);this.labels.fill(-1);
  this.marks=new Uint32Array(size);this.closed=new Uint32Array(size);this.costs=new Float64Array(size);this.parents=new Int32Array(size);
  // Rasterize each radius once at map load, never inside a per-tick A* query.
  for(let y=1;y<this.height-1;y++)for(let x=1;x<this.width-1;x++)this.centers[y*this.width+x]=this.walkable({x:x+.5,y:y+.5})?1:0;
  const queue=new Int32Array(CHUNK*CHUNK);
  for(let top=0;top<this.height;top+=CHUNK)for(let left=0;left<this.width;left+=CHUNK){const right=Math.min(left+CHUNK,this.width),bottom=Math.min(top+CHUNK,this.height);
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const src=y*this.width+x;if(!this.centers[src]||this.labels[src]>=0)continue;
    const label=this.nodeCenters.length;this.nodeCenters.push({x:(left+right)/2,y:(top+bottom)/2});let head=0,tail=1;queue[0]=src;this.labels[src]=label;
    while(head<tail){const k=queue[head++],cx=k%this.width,cy=Math.floor(k/this.width);for(const [dx,dy] of directions){const nx=cx+dx,ny=cy+dy,n=ny*this.width+nx;if(nx<left||nx>=right||ny<top||ny>=bottom||!this.canStep(cx,cy,nx,ny)||this.labels[n]>=0)continue;this.labels[n]=label;queue[tail++]=n;}}
   }
  }
  const link=(a:number,b:number)=>{const la=this.labels![a],lb=this.labels![b];if(la<0||lb<0||la===lb)return;let neighbors=this.links.get(la);if(!neighbors){neighbors=new Map();this.links.set(la,neighbors);}let gates=neighbors.get(lb);if(!gates){gates=[];neighbors.set(lb,gates);}gates.push([a,b]);};
  for(let x=CHUNK;x<this.width;x+=CHUNK)for(let y=1;y<this.height-1;y++){const a=y*this.width+x-1,b=a+1;link(a,b);link(b,a);}
  for(let y=CHUNK;y<this.height;y+=CHUNK)for(let x=1;x<this.width-1;x++){const a=(y-1)*this.width+x,b=a+this.width;link(a,b);link(b,a);}
 }
 private canStep(x:number,y:number,nx:number,ny:number){if(nx<0||ny<0||nx>=this.width||ny>=this.height||!this.centers![ny*this.width+nx])return false;return nx===x||ny===y||!!(this.centers![y*this.width+nx]&&this.centers![ny*this.width+x]);}
 private point(k:number){return {x:k%this.width+.5,y:Math.floor(k/this.width)+.5};}
 private localPath(src:number,dst:number,label?:number){
  if(src===dst)return [];
  if(++this.generation===0xffffffff){this.marks!.fill(0);this.closed!.fill(0);this.generation=1;}
  const gen=this.generation,marks=this.marks!,closed=this.closed!,g=this.costs!,parent=this.parents!,ex=dst%this.width,ey=Math.floor(dst/this.width);
  const h=(k:number)=>{const dx=Math.abs(k%this.width-ex),dy=Math.abs(Math.floor(k/this.width)-ey);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
  const heap=new MinHeap();marks[src]=gen;g[src]=0;heap.push(src,h(src));let reached=false;
  while(heap.length){const c=heap.pop();if(closed[c]===gen)continue;if(c===dst){reached=true;break;}closed[c]=gen;const x=c%this.width,y=Math.floor(c/this.width);
   for(const [dx,dy] of directions){const nx=x+dx,ny=y+dy,n=ny*this.width+nx;if(!this.canStep(x,y,nx,ny)||label!==undefined&&this.labels![n]!==label)continue;const next=g[c]+(dx&&dy?Math.SQRT2:1);if(marks[n]===gen&&next>=g[n])continue;marks[n]=gen;g[n]=next;parent[n]=c;heap.push(n,next+h(n));}
  }
  if(!reached)return null;const path:number[]=[];for(let c=dst;c!==src;c=parent[c])path.push(c);return path.reverse();
 }
 path(start:Vec,end:Vec):Vec[]{
  if(!this.walkable(end)||!this.walkable(start))return [];
  if(this.clear(start,end))return [{...end}];this.prepare();
  const nearest=(p:Vec)=>{const x=Math.floor(p.x),y=Math.floor(p.y);let best=-1,bestDistance=Infinity;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,k=ny*this.width+nx;if(nx<0||ny<0||nx>=this.width||ny>=this.height||!this.centers![k])continue;const q=this.point(k),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bestDistance&&this.clear(p,q)){best=k;bestDistance=d;}}return best;};
  const src=nearest(start),dst=nearest(end);if(src<0||dst<0)return [];
  const first=this.labels![src],last=this.labels![dst],parent=new Map<number,number>([[first,first]]),queue=[first];
  for(let i=0;i<queue.length&&!parent.has(last);i++)for(const next of this.links.get(queue[i])?.keys()??[]){if(parent.has(next))continue;parent.set(next,queue[i]);queue.push(next);}
  if(!parent.has(last))return [];
  const corridor=[last];while(corridor.at(-1)!==first)corridor.push(parent.get(corridor.at(-1)!)!);corridor.reverse();
  const raw:Vec[]=[{...start},this.point(src)];let current=src;
  for(let i=0;i<corridor.length-1;i++){
   const gates=this.links.get(corridor[i])!.get(corridor[i+1])!;let gate=gates[0],score=Infinity;
   for(const candidate of gates){const a=this.point(candidate[0]),b=this.point(candidate[1]),p=this.point(current),value=Math.hypot(a.x-p.x,a.y-p.y)+Math.hypot(end.x-b.x,end.y-b.y);if(value<score){score=value;gate=candidate;}}
   const part=this.localPath(current,gate[0],corridor[i]);if(!part)return [];raw.push(...part.map(k=>this.point(k)),this.point(gate[1]));current=gate[1];
  }
  const part=this.localPath(current,dst,last);if(!part)return [];raw.push(...part.map(k=>this.point(k)),{...end});
  // Keep straight screen directions; each shortened segment uses swept collision.
  const path:Vec[]=[];let anchor=raw[0];for(let i=1;i<raw.length;i++){if(i+1<raw.length&&this.clear(anchor,raw[i+1]))continue;if(Math.hypot(anchor.x-raw[i].x,anchor.y-raw[i].y)<1e-8)continue;path.push(raw[i]);anchor=raw[i];}return path;
 }
 diagnostics(){return {width:this.width,height:this.height,pad:this.pad,bins:this.buckets.size,prepared:!!this.centers,components:this.nodeCenters.length,bytes:this.centers?this.width*this.height*25:0};}
}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
class MinHeap{
 private keys:number[]=[];private scores:number[]=[];get length(){return this.keys.length;}
 push(key:number,score:number){let i=this.keys.length;this.keys.push(key);this.scores.push(score);while(i){const p=(i-1)>>1;if(this.scores[p]<=score)break;this.keys[i]=this.keys[p];this.scores[i]=this.scores[p];i=p;}this.keys[i]=key;this.scores[i]=score;}
 pop(){const first=this.keys[0],key=this.keys.pop()!,score=this.scores.pop()!;if(this.keys.length){let i=0;while(i*2+1<this.keys.length){let c=i*2+1;if(c+1<this.keys.length&&this.scores[c+1]<this.scores[c])c++;if(this.scores[c]>=score)break;this.keys[i]=this.keys[c];this.scores[i]=this.scores[c];i=c;}this.keys[i]=key;this.scores[i]=score;}return first;}
}
/** Earliest segment/expanded rectangle contact. Shared by path and projectiles. */
export function segmentObstacle(a:Vec,b:Vec,o:Obstacle,pad:number):number|null{
 let lo=0,hi=1;for(const [start,delta,min,max] of [[a.x,b.x-a.x,o.x-pad,o.x+o.w+pad],[a.y,b.y-a.y,o.y-pad,o.y+o.h+pad]]){if(Math.abs(delta)<1e-12){if(start<=min||start>=max)return null;}else{const v=(min-start)/delta,w=(max-start)/delta;lo=Math.max(lo,Math.min(v,w));hi=Math.min(hi,Math.max(v,w));}}return lo<hi&&hi>0&&lo<1?Math.max(0,lo):null;
}
