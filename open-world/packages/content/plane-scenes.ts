import source from './plane-scenes.json';
import {resolveMonsterSpawn} from '../rules/monster-stats.ts';
import {NavigationGrid} from '../simulation/navigation-grid.ts';
import type {Region} from './index.ts';
import type {MonsterRank} from '../contracts/monsters.ts';

/** Plane scenes (箱庭位面) are carved from a solid square block by declarative
 * operations. Rock is a height field: every rock cell rises to the kit's wall
 * height, except where it would stand between the camera and walkable floor —
 * there it is cut down along the line of sight (rock kits step down in uneven
 * stone blocks, block kits keep a low stub). Terrain therefore never hides an actor, and walls never
 * need fading. The same deterministic output feeds collision (Region) and
 * presentation (PlaneMap); a kit repaint changes textures, never geometry. */
export type PlaneKit='cave'|'crypt'|'maze';
type Pt=[number,number];
type Carve={disk:[number,number,number]}|{rect:[number,number,number,number]}|{fill:[number,number,number,number]}|{path:Pt[];width:number}|{pillars:{x:number;y:number;w:number;h:number;step:number;ring?:boolean}}|{maze:{x:number;y:number;cols:number;rows:number;cell:number;wall:number;loops:number;rooms:[number,number,number,number][]}};
type Pack={template:string;rank:MonsterRank;count:number;center:{x:number;y:number};radius:number};
export type PlaneStageSpec={id:string;name:string;kit:PlaneKit;island:string;theme:string;seed:number;level:number;boss:boolean;size?:number;safe:{x:number;y:number};portal:{x:number;y:number};carve:Carve[];route:Pt[];pack:Pack[];chests:NonNullable<Region['keyChests']>};
/** rock: stacked stone blocks of uneven height (caves); block: upright walls of one height (built halls).
 * Both draw as upright cell blocks with a dark outline; `shadow` tints faces turned from the light. */
type KitSpec={profile:'rock'|'block';wallHeight:number;stub:number;background:string;glow:string;outline:string;shadow:string;lightEvery:number;foot:string[];footEvery:number;blockers:string[];blockerEvery:number;blockerPlace:'open'|'wall'};
/** World position in cells; `z` lifts the sprite (pixels) onto a wall face. */
export type PlanePiece={part:string;x:number;y:number;z?:number;mirrorX?:boolean;layer:'pillar'|'prop'|'blocker'|'light'};
export type PlaneMap={kind:'plane';id:string;name:string;kit:PlaneKit;profile:'rock'|'block';width:number;height:number;wallHeight:number;background:string;glow:string;outline:string;shadow:string;
 /** Row-major: '#' rock, '.' floor, ',' worn path, 'o' pillar, 'x' blocking prop (both drawn as floor + sprite). */
 cells:string;
 /** Rock elevation in pixels (0 for every non-rock cell), and Chebyshev distance to the nearest non-rock cell. */
 heights:number[];dist:number[];
 pieces:PlanePiece[];lights:{x:number;y:number;z:number}[];resources:string[];landmarks:{id:string;x:number;y:number}[]};
export const PLANE_SIZE=64;
/** Rock deeper than this many cells from the floor is not drawn: it is the cave dark. */
export const PLANE_DRAW_DEPTH=6;
/** Rock in front of floor stays at least this many pixels below the floor's line of sight. */
export const PLANE_SIGHT_MARGIN=24;
export const planeResource=(kit:PlaneKit,part:string)=>`ow-art-plane-${kit}-${part}`;
const WALL=0,FLOOR=1,PATH=2,PILLAR=3,BLOCK=4;

function rng(seed:number){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function carve(spec:PlaneStageSpec,n:number){
 const grid=new Uint8Array(n*n),random=rng(spec.seed),inside=(x:number,y:number)=>x>=1&&y>=1&&x<n-1&&y<n-1;
 const set=(x:number,y:number,v:number)=>{if(inside(x,y))grid[y*n+x]=v;};
 for(const op of spec.carve){
  if('disk' in op){const [cx,cy,r]=op.disk,phase=random()*6.283,wobble=.12+random()*.08;
   for(let y=Math.floor(cy-r-3);y<=cy+r+3;y++)for(let x=Math.floor(cx-r-3);x<=cx+r+3;x++){const dx=x+.5-cx,dy=y+.5-cy,a=Math.atan2(dy,dx),edge=r*(1+wobble*Math.sin(a*3+phase)+wobble*.6*Math.sin(a*5-phase*1.7));if(Math.hypot(dx,dy)<=edge)set(x,y,FLOOR);}}
  else if('rect' in op){const [x0,y0,w,h]=op.rect;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)set(x,y,FLOOR);}
  else if('fill' in op){const [x0,y0,w,h]=op.fill;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)set(x,y,WALL);}
  else if('path' in op){const r=op.width/2;for(let i=1;i<op.path.length;i++){const [ax,ay]=op.path[i-1],[bx,by]=op.path[i],steps=Math.ceil(Math.hypot(bx-ax,by-ay)*3);
   for(let s=0;s<=steps;s++){const px=ax+(bx-ax)*s/steps,py=ay+(by-ay)*s/steps,rr=spec.kit==='cave'?r*(1+.15*Math.sin((px+py)*.7+spec.seed)):r;for(let y=Math.floor(py-rr-1);y<=py+rr+1;y++)for(let x=Math.floor(px-rr-1);x<=px+rr+1;x++){const dx=x+.5-px,dy=y+.5-py;if(spec.kit==='cave'?Math.hypot(dx,dy)<=rr:Math.max(Math.abs(dx),Math.abs(dy))<=rr)set(x,y,FLOOR);}}}}
  else if('pillars' in op){const p=op.pillars,cols=Math.floor(p.w/p.step),rows=Math.floor(p.h/p.step);for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const x=p.x+i*p.step,y=p.y+j*p.step;if(p.ring&&i&&j&&i<cols&&j<rows)continue;set(x,y,PILLAR);set(x+1,y,PILLAR);set(x,y+1,PILLAR);set(x+1,y+1,PILLAR);}}
  else{const m=op.maze,corridor=m.cell-m.wall,at=(i:number)=>m.x+i*m.cell+m.wall,cy=(j:number)=>m.y+j*m.cell+m.wall,open=(i:number,j:number)=>{for(let y=0;y<corridor;y++)for(let x=0;x<corridor;x++)set(at(i)+x,cy(j)+y,FLOOR);};
   const link=(i:number,j:number,di:number,dj:number)=>{const x0=di?at(i)+corridor:at(i),y0=dj?cy(j)+corridor:cy(j),w=di?m.wall:corridor,h=dj?m.wall:corridor;for(let y=0;y<h;y++)for(let x=0;x<w;x++)set(x0+x,y0+y,FLOOR);};
   const seen=new Uint8Array(m.cols*m.rows),stack:[number,number][]=[[0,0]];seen[0]=1;open(0,0);const dirs:[number,number][]=[[1,0],[-1,0],[0,1],[0,-1]];
   while(stack.length){const [i,j]=stack[stack.length-1],next=dirs.filter(([di,dj])=>{const a=i+di,b=j+dj;return a>=0&&b>=0&&a<m.cols&&b<m.rows&&!seen[b*m.cols+a];});
    if(!next.length){stack.pop();continue;}const [di,dj]=next[Math.floor(random()*next.length)],a=i+di,b=j+dj;seen[b*m.cols+a]=1;open(a,b);link(Math.min(i,a),Math.min(j,b),Math.abs(di),Math.abs(dj));stack.push([a,b]);}
   for(let k=0;k<m.loops;k++){const horizontal=random()<.5,i=Math.floor(random()*(m.cols-(horizontal?1:0))),j=Math.floor(random()*(m.rows-(horizontal?0:1)));link(i,j,horizontal?1:0,horizontal?0:1);}
   for(const [i,j,w,h] of m.rooms){const x0=at(i),y0=cy(j),x1=at(i+w-1)+corridor,y1=cy(j+h-1)+corridor;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)set(x,y,FLOOR);}}
 }
 // Worn path follows the authored route through the halls; it only marks floor.
 for(let i=1;i<spec.route.length;i++){const [ax,ay]=spec.route[i-1],[bx,by]=spec.route[i],steps=Math.ceil(Math.hypot(bx-ax,by-ay)*3);for(let s=0;s<=steps;s++){const px=ax+(bx-ax)*s/steps,py=ay+(by-ay)*s/steps;for(let y=Math.floor(py-1.5);y<=py+1.5;y++)for(let x=Math.floor(px-1.5);x<=px+1.5;x++)if(inside(x,y)&&grid[y*n+x]===FLOOR&&Math.hypot(x+.5-px,y+.5-py)<=1.6)grid[y*n+x]=PATH;}}
 return grid;
}
const isRock=(grid:Uint8Array,n:number,x:number,y:number)=>x<0||y<0||x>=n||y>=n||grid[y*n+x]===WALL;
/** Single-cell blocking props: scattered in open halls (caves) or hugging the back walls (built halls). */
function placeBlockers(spec:PlaneStageSpec,kit:KitSpec,grid:Uint8Array,n:number){
 const pieces:PlanePiece[]=[],random=rng(spec.seed^0x2545f491),hash=(x:number,y:number)=>((x*2654435761)^(y*40503)^spec.seed)>>>0;
 const keep=[spec.safe,spec.portal,...spec.chests],floorAt=(x:number,y:number)=>{const v=x<0||y<0||x>=n||y>=n?WALL:grid[y*n+x];return v===FLOOR||v===PATH;};
 const clear=(x:number,y:number,r:number)=>{for(let j=-r;j<=r;j++)for(let i=-r;i<=r;i++)if(!floorAt(x+i,y+j))return false;return true;};
 for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
  if(grid[y*n+x]!==FLOOR||!kit.blockers.length||hash(x,y)%kit.blockerEvery)continue;
  if(keep.some(p=>Math.hypot(x+.5-p.x,y+.5-p.y)<5))continue;
  if(kit.blockerPlace==='open'){if(!clear(x,y,2))continue;}
  else{const back=isRock(grid,n,x,y-1)?[0,1]:isRock(grid,n,x-1,y)?[1,0]:undefined;if(!back)continue;const [dx,dy]=back;
   // Against the wall, with open floor in front and to both sides, and no other blocker near.
   if(!floorAt(x+dx,y+dy)||!floorAt(x+2*dx,y+2*dy)||!floorAt(x+dy,y+dx)||!floorAt(x-dy,y-dx)||!floorAt(x+dy+dx,y+dx+dy)||!floorAt(x-dy+dx,y-dx+dy))continue;
   let near=false;for(let j=-3;j<=3;j++)for(let i=-3;i<=3;i++){const v=grid[(y+j)*n+x+i];if(v===BLOCK||v===PILLAR)near=true;}if(near)continue;}
  grid[y*n+x]=BLOCK;pieces.push({part:kit.blockers[Math.floor(random()*kit.blockers.length)],x:x+.5,y:y+.5,mirrorX:random()<.5,layer:'blocker'});
 }
 return pieces;
}
/** Rock height field. A rock cell may not rise above the line of sight of any
 * floor cell behind it in the same screen column (|Δ(x-y)|≤2): each step of
 * depth (x+y) buys 18 screen pixels. */
function terrain(spec:PlaneStageSpec,kit:KitSpec,grid:Uint8Array,n:number){
 const rock=(x:number,y:number)=>isRock(grid,n,x,y),dist=new Uint8Array(n*n).fill(99),queue:number[]=[];
 for(let i=0;i<n*n;i++)if(grid[i]!==WALL){dist[i]=0;queue.push(i);}
 for(let h=0;h<queue.length;h++){const i=queue[h],x=i%n,y=(i-x)/n;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const a=x+dx,b=y+dy;if(a<0||b<0||a>=n||b>=n)continue;const j=b*n+a;if(dist[j]>dist[i]+1){dist[j]=dist[i]+1;queue.push(j);}}}
 const H=kit.wallHeight,heights=new Int16Array(n*n),reach=Math.ceil((H*1.4+60+PLANE_SIGHT_MARGIN)/18)+1;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(!rock(x,y))continue;
  const d=x+y,c=x-y,noise=.5+.5*Math.sin(x*.41+spec.seed*.013)*Math.cos(y*.33-spec.seed*.007);
  // Rock: each cell is its own stone block, so heights jitter per cell in 10px steps.
  const jitter=((((x+7)*73856093)^((y+3)*19349663)^spec.seed)>>>0)%5-2,base=kit.profile==='rock'?H*(.7+.35*noise)+18*Math.min(dist[y*n+x]-1,4)+jitter*18:H;
  let cap=Infinity;search:for(let k=1;k<=reach;k++)for(let j=-2;j<=2;j++){const s=d-k+c+j;if(s&1)continue;const fx=s/2,fy=(d-k-c-j)/2;if(fx>=0&&fy>=0&&fx<n&&fy<n&&!rock(fx,fy)){cap=18*k-PLANE_SIGHT_MARGIN;break search;}}
  heights[y*n+x]=kit.profile==='rock'?Math.max(kit.stub,Math.floor(Math.min(base,cap)/10)*10):cap>=base?H:kit.stub;
 }
 return {heights,dist};
}
function dress(spec:PlaneStageSpec,kit:KitSpec,grid:Uint8Array,n:number,heights:Int16Array,dist:Uint8Array){
 const at=(x:number,y:number)=>x<0||y<0||x>=n||y>=n?WALL:grid[y*n+x],walk=(x:number,y:number)=>{const v=at(x,y);return v===FLOOR||v===PATH;};
 const pieces:PlanePiece[]=[],lights:PlaneMap['lights']=[],random=rng(spec.seed^0x5bd1e995),hash=(x:number,y:number)=>((x*73856093)^(y*19349663)^spec.seed)>>>0,H=kit.wallHeight;
 const nearSafe=(x:number,y:number)=>Math.hypot(x-spec.safe.x,y-spec.safe.y)<3.5||Math.hypot(x-spec.portal.x,y-spec.portal.y)<2.5;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  if(at(x,y)===PILLAR&&at(x-1,y)!==PILLAR&&at(x,y-1)!==PILLAR)pieces.push({part:'pillar',x:x+1,y:y+1,layer:'pillar'});
  if(at(x,y)!==WALL||dist[y*n+x]!==1)continue;const e=heights[y*n+x];
  // Lights hang on tall faces that look at the camera (open floor at +y or +x).
  if(e>=H*.8){
   if(walk(x,y+1)&&hash(x,y)%kit.lightEvery===0){const z=Math.round(e*.45);pieces.push({part:'light',x:x+.5,y:y+1,z,layer:'light'});lights.push({x:x+.5,y:y+1.9,z});}
   else if(walk(x+1,y)&&hash(y,x)%kit.lightEvery===0){const z=Math.round(e*.45);pieces.push({part:'light',x:x+1,y:y+.5,z,mirrorX:true,layer:'light'});lights.push({x:x+1.9,y:y+.5,z});}
  }
  // Ledge props stand on top of the first row of stone blocks, near the edge facing the floor; never on walkable cells.
  if(kit.foot.length&&hash(x+11,y+7)%kit.footEvery===0){
   const spot=walk(x,y+1)?{x:x+.5,y:y+.75}:walk(x+1,y)?{x:x+.75,y:y+.5}:walk(x,y-1)?{x:x+.5,y:y+.35}:walk(x-1,y)?{x:x+.35,y:y+.5}:undefined;
   if(spot&&!nearSafe(spot.x,spot.y))pieces.push({part:kit.foot[Math.floor(random()*kit.foot.length)],...spot,z:e,mirrorX:random()<.5,layer:'prop'});
  }
 }
 return {pieces,lights};
}
/** Solid cells (rock, pillars, blocking props) merged into rectangles: row runs, then equal runs stacked. */
function obstacles(grid:Uint8Array,n:number){
 const out:{x:number;y:number;w:number;h:number}[]=[],open=new Map<string,{x:number;y:number;w:number;h:number}>(),free=(v:number)=>v===FLOOR||v===PATH;
 for(let y=0;y<n;y++){const runs:string[]=[];for(let x=0;x<n;){if(free(grid[y*n+x])){x++;continue;}let e=x;while(e<n&&!free(grid[y*n+e]))e++;const key=x+':'+(e-x),prior=open.get(key);if(prior)prior.h++;else{const r={x,y,w:e-x,h:1};open.set(key,r);out.push(r);}runs.push(key);x=e;}
  for(const key of [...open.keys()])if(!runs.includes(key))open.delete(key);}
 return out;
}
function reachableSpawns(spec:PlaneStageSpec,region:Pick<Region,'obstacles'|'width'|'height'>){
 const grid=new NavigationGrid(region.width,region.height,region.obstacles,.55);
 if(!grid.walkable(spec.safe)||!grid.walkable(spec.portal))throw Error('位面入口不可站立 '+spec.id);
 return spec.pack.flatMap((pack,p)=>Array.from({length:pack.count},(_,i)=>{let at;for(let j=0;j<32;j++){const angle=(i+j*.37)*2.399963,radius=pack.radius*(1-j/48),candidate={x:pack.center.x+Math.cos(angle)*radius,y:pack.center.y+Math.sin(angle)*radius};if(grid.walkable(candidate)&&grid.path(spec.safe,candidate).length){at=candidate;break;}}if(!at)throw Error('位面敌人不可达 '+spec.id+' #'+p);return resolveMonsterSpawn({id:spec.id+':'+p+':'+i,template:pack.template,rank:pack.rank,level:spec.level,...at});}));
}
export function buildPlaneStage(spec:PlaneStageSpec,kits:Record<PlaneKit,KitSpec>=source.kits as Record<PlaneKit,KitSpec>,options:{spawns?:boolean}={}){
 const kit=kits[spec.kit];if(!kit)throw Error('Unknown plane kit '+spec.kit);
 const n=spec.size??PLANE_SIZE,grid=carve(spec,n);
 // The drawn rock band must fit inside the map, or the hall would end at a cut edge.
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(grid[y*n+x]!==WALL&&Math.min(x,y,n-1-x,n-1-y)<PLANE_DRAW_DEPTH+1)throw Error(`位面地面离地图边缘太近 ${spec.id} ${x},${y}`);
 const blockers=placeBlockers(spec,kit,grid,n),solid=obstacles(grid,n),{heights,dist}=terrain(spec,kit,grid,n),{pieces,lights}=dress(spec,kit,grid,n,heights,dist);
 for(const chest of spec.chests){const v=grid[Math.floor(chest.y)*n+Math.floor(chest.x)];if(v!==FLOOR&&v!==PATH)throw Error('位面宝箱在墙内 '+spec.id);}
 const region:Region={keyChests:structuredClone(spec.chests),id:spec.id,name:spec.name,subtitle:'箱庭位面',width:n,height:n,theme:spec.theme,safe:{...spec.safe},portal:{...spec.portal},boss:spec.boss,auto:true,obstacles:solid,spawns:[],landmarks:[]};
 if(options.spawns!==false)region.spawns=reachableSpawns(spec,region);
 const all=[...pieces,...blockers],parts=new Set(['ground-main','ground-path','wall-straight','wall-top','light-pool','backdrop-near',...all.map(p=>p.part)]);
 const map:PlaneMap={kind:'plane',id:spec.id,name:spec.name,kit:spec.kit,profile:kit.profile,width:n,height:n,wallHeight:kit.wallHeight,background:kit.background,glow:kit.glow,outline:kit.outline,shadow:kit.shadow,cells:Array.from(grid,v=>'#.,ox'[v]).join(''),heights:Array.from(heights),dist:Array.from(dist),pieces:all,lights,resources:[...parts].map(p=>planeResource(spec.kit,p)),landmarks:[]};
 return {region,map,spec};
}
export const planeStageSpecs=source.stages as unknown as PlaneStageSpec[];
