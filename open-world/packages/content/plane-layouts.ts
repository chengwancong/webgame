import {buildPlaneStage,planeStageSpecs,PLANE_DRAW_DEPTH,type PlaneStageSpec} from './plane-scenes.ts';
import {NavigationGrid} from '../simulation/navigation-grid.ts';

/** Random plane layouts (箱庭位面随机布局). Every run of a plane dungeon draws a
 * fresh seed; the authored stage in plane-scenes.json only supplies identity,
 * kit, size, level and the monster/chest budget. Layouts stay a single main line
 * (one way in, one way on) with at most one dead-end side room, so a plane never
 * opens into a web of shortcuts. The server freezes the generated Region into the
 * run; the client rebuilds the identical PlaneMap from `region.layoutSeed`. */
type Pt=[number,number];
type Spec=PlaneStageSpec;type Pack=Spec['pack'][number];type Carve=Spec['carve'][number];
type Hall={x:number;y:number;r:number};
const PASSAGE=5,BORDER=PLANE_DRAW_DEPTH+2;

function rng(seed:number){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const mix=(seed:number,k:number)=>(Math.imul(seed^0x9e3779b9,0x85ebca6b)+Math.imul(k+1,0xc2b2ae35))>>>0;
const segDist=(p:Pt,a:Pt,b:Pt)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const segSeg=(a:Pt,b:Pt,c:Pt,d:Pt)=>{let m=Infinity;for(let i=0;i<=8;i++){const t=i/8;m=Math.min(m,segDist([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],c,d),segDist([c[0]+(d[0]-c[0])*t,c[1]+(d[1]-c[1])*t],a,b));}return m;};
const round=(v:number)=>Math.round(v*10)/10;

/** Packs spread over the fight halls along the line; elites wait in the later halls. */
function placePacks(base:Pack[],halls:Hall[],random:()=>number):Pack[]{
 const fights=halls.slice(1),normals=base.filter(p=>p.rank==='normal'),others=base.filter(p=>p.rank!=='normal');
 const at=(p:Pack,h:Hall):Pack=>{const a=random()*6.283,d=random()*h.r*.35;return {...p,center:{x:round(h.x+Math.cos(a)*d),y:round(h.y+Math.sin(a)*d)},radius:Math.min(p.radius,Math.max(1,Math.floor(h.r-2)))};};
 return [...normals.map((p,i)=>at(p,fights[i%fights.length])),...others.map((p,i)=>at(p,fights[Math.max(0,fights.length-1-i*2)]))];
}
const fail=(why:string):never=>{throw Error('layout:'+why);};

/** Cave: round halls joined by winding narrow passages, laid out by a forward-biased walk. */
function caveLine(base:Spec,random:()=>number):Spec{
 const n=base.size!,reach=(r:number)=>r*1.32,lo=(r:number)=>BORDER+reach(r)+1,hi=(r:number)=>n-1-lo(r),inside=(p:Pt,r:number)=>p[0]>=lo(r)&&p[1]>=lo(r)&&p[0]<=hi(r)&&p[1]<=hi(r);
 const corner=Math.floor(random()*4),r0=8,start:Pt=[corner&1?hi(r0)-random()*6:lo(r0)+random()*6,corner&2?hi(r0)-random()*6:lo(r0)+random()*6];
 const halls:Hall[]=[{x:start[0],y:start[1],r:r0}],passages:Pt[][]=[];let heading=Math.atan2(n/2-start[1],n/2-start[0]);
 const clearOf=(path:Pt[],r:number,skip:Set<number>,skipPassage:Set<number>)=>{const end=path[path.length-1];
  for(let j=0;j<halls.length;j++){if(skip.has(j))continue;const h=halls[j];if(Math.hypot(end[0]-h.x,end[1]-h.y)<reach(h.r)+reach(r)+12)return false;for(let s=1;s<path.length;s++)if(segDist([h.x,h.y],path[s-1],path[s])<reach(h.r)+PASSAGE+3)return false;}
  for(let q=0;q<passages.length;q++){if(skipPassage.has(q))continue;for(let s=1;s<path.length;s++)for(let t=1;t<passages[q].length;t++)if(segSeg(path[s-1],path[s],passages[q][t-1],passages[q][t])<PASSAGE+7)return false;}
  return true;};
 const reachFrom=(from:Hall,r:number,spread:number,gap:[number,number],skip:Set<number>,skipPassage:Set<number>)=>{
  for(let attempt=0;attempt<60;attempt++){const angle=heading+(random()-.5)*spread,d=from.r*1.1+r*1.1+gap[0]+random()*(gap[1]-gap[0]),to:Pt=[from.x+Math.cos(angle)*d,from.y+Math.sin(angle)*d];if(!inside(to,r))continue;
   const bend=(random()-.5)*.5*d,mid:Pt=[(from.x+to[0])/2-Math.sin(angle)*bend,(from.y+to[1])/2+Math.cos(angle)*bend],path:Pt[]=[[from.x,from.y],mid,to];
   if(clearOf(path,r,skip,skipPassage))return {angle,path};}
  return undefined;};
 for(let k=1;k<5;k++){const r=k===4?8+random()*2:10+random()*2.5,prev=halls[k-1],found=reachFrom(prev,r,Math.PI*.9,[7,15],new Set([k-1]),new Set([k-2]))??fail("cave walk");
  heading=found.angle;passages.push(found.path);const to=found.path[2];halls.push({x:to[0],y:to[1],r});}
 // One dead-end pocket off a middle hall holds the chest.
 const host=1+Math.floor(random()*3);let pocket:Hall|undefined,pocketPath:Pt[]|undefined;
 for(let tries=0;tries<6&&!pocket;tries++){heading=random()*6.283;const found=reachFrom(halls[host],6,Math.PI*.5,[4,9],new Set([host]),new Set([host-1,host]));if(found){pocketPath=found.path;pocket={x:found.path[2][0],y:found.path[2][1],r:6};}}
 if(!pocket)fail('cave pocket');
 const carve:Carve[]=[];halls.forEach((h,i)=>{carve.push({disk:[round(h.x),round(h.y),round(h.r)]});if(i<passages.length)carve.push({path:passages[i].map(([x,y])=>[round(x),round(y)] as Pt),width:PASSAGE});});
 carve.push({path:pocketPath!.map(([x,y])=>[round(x),round(y)] as Pt),width:PASSAGE-1},{disk:[round(pocket!.x),round(pocket!.y),6]});
 const route:Pt[]=[];passages.forEach(p=>route.push(...p.slice(0,2).map(([x,y])=>[round(x),round(y)] as Pt)));route.push([round(halls[4].x),round(halls[4].y)]);
 const safe={x:Math.round(start[0]),y:Math.round(start[1])},toward=Math.sign(n/2-safe.x)||1;
 return {...base,carve,route,safe,portal:{x:safe.x-2*toward,y:safe.y+2*(Math.sign(n/2-safe.y)||1)},pack:placePacks(base.pack,halls.map(h=>({...h,r:h.r*.7})),random),
  chests:base.chests.map(c=>({...c,x:Math.round(pocket!.x),y:Math.round(pocket!.y)}))};
}

/** Crypt: square chambers on a coarse slot grid, chained by straight corridors to neighbouring slots. */
function cryptLine(base:Spec,random:()=>number):Spec{
 const n=base.size!,slots=4,pitch=26,first=Math.round((n-pitch*(slots-1))/2),centre=(i:number)=>first+i*pitch;
 const used=new Set<string>(),walk:Pt[]=[];let at:Pt=[random()<.5?0:slots-1,random()<.5?0:slots-1];walk.push(at);used.add(at.join());
 const steps:Pt[]=[[1,0],[-1,0],[0,1],[0,-1]],free=(p:Pt)=>p[0]>=0&&p[1]>=0&&p[0]<slots&&p[1]<slots&&!used.has(p.join());
 while(walk.length<5){const options=steps.map(([dx,dy])=>[at[0]+dx,at[1]+dy] as Pt).filter(free);if(!options.length)fail('crypt walk');at=options[Math.floor(random()*options.length)];walk.push(at);used.add(at.join());}
 const hosts=[1,2,3].sort(()=>random()-.5);let side:{slot:Pt;host:number}|undefined;
 for(const h of hosts){const options=steps.map(([dx,dy])=>[walk[h][0]+dx,walk[h][1]+dy] as Pt).filter(free);if(options.length){side={slot:options[Math.floor(random()*options.length)],host:h};break;}}
 if(!side)fail('crypt side');
 const rooms=[...walk,side!.slot].map((s,i)=>{const size=i===0?14:i===5?12:14+2*Math.floor(random()*4),w=size,h=i===0||i===5?size:14+2*Math.floor(random()*4);return {cx:centre(s[0]),cy:centre(s[1]),w,h};});
 const links:[number,number][]=[[0,1],[1,2],[2,3],[3,4],[side!.host,5]],carve:Carve[]=[];
 for(const r of rooms)carve.push({rect:[r.cx-r.w/2,r.cy-r.h/2,r.w,r.h]});
 for(const [a,b] of links)carve.push({path:[[rooms[a].cx,rooms[a].cy],[rooms[b].cx,rooms[b].cy]],width:PASSAGE});
 // Pillars line the long walls of the bigger chambers, clear of every doorway.
 rooms.forEach((r,i)=>{if(i===0||i===5||Math.min(r.w,r.h)<16||random()<.35)return;const x0=r.cx-r.w/2,y0=r.cy-r.h/2,doors=links.filter(l=>l.includes(i)).map(([a,b])=>rooms[a===i?b:a]);
  const blocked=(x:number,y:number)=>doors.some(d=>{const dx=Math.sign(d.cx-r.cx),dy=Math.sign(d.cy-r.cy);return dx?Math.abs(y+1-r.cy)<4.5&&(dx>0?x>=r.cx:x<r.cx):Math.abs(x+1-r.cx)<4.5&&(dy>0?y>=r.cy:y<r.cy);});
  const step=r.w>=18?5:6;for(let x=x0+3;x<=x0+r.w-5;x+=step)for(const y of [y0+3,y0+r.h-5])if(!blocked(x,y))carve.push({pillars:{x,y,w:0,h:0,step:1}});});
 const halls=rooms.slice(0,5).map(r=>({x:r.cx,y:r.cy,r:Math.min(r.w,r.h)/2-2})),chest=rooms[5];
 return {...base,carve,route:rooms.slice(0,5).map(r=>[r.cx,r.cy] as Pt),safe:{x:rooms[0].cx,y:rooms[0].cy},portal:{x:rooms[0].cx-2,y:rooms[0].cy+2},pack:placePacks(base.pack,halls,random),
  chests:base.chests.map(c=>({...c,x:chest.cx,y:chest.cy}))};
}

/** Maze: a fresh spanning-tree maze with two loops; the entrance is a random corner. */
function mazeLine(base:Spec,random:()=>number,seed:number):Spec{
 const cols=8,rows=8,cell=12,wall=6,x=7,y=7,corridor=cell-wall,mid=(i:number)=>x+i*cell+wall+corridor/2;
 const ri=2+Math.floor(random()*3),rj=2+Math.floor(random()*3),corner:Pt=[random()<.5?0:cols-1,random()<.5?0:rows-1];
 const maze={x,y,cols,rows,cell,wall,loops:2,rooms:[[ri,rj,2,2]] as [number,number,number,number][]};
 const draft:Spec={...base,seed,carve:[{maze}],route:[],pack:[],chests:[],safe:{x:mid(corner[0]),y:mid(corner[1])-1},portal:{x:mid(corner[0])-1,y:mid(corner[1])+1}};
 const {map}=buildPlaneStage(draft,undefined,{spawns:false}),open=(cx:number,cy:number)=>map.cells[Math.floor(cy)*map.width+Math.floor(cx)]!=='#';
 // Cell graph from the carved grid: a link is open when the wall gap between two cell centres is floor.
 const id=(i:number,j:number)=>j*cols+i,depth=new Int16Array(cols*rows).fill(-1),degree=new Uint8Array(cols*rows),queue=[id(...corner)];depth[queue[0]]=0;
 for(let h=0;h<queue.length;h++){const c=queue[h],i=c%cols,j=(c-i)/cols;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=cols||b>=rows)continue;
  if(!open((mid(i)+mid(a))/2,(mid(j)+mid(b))/2))continue;degree[c]++;if(depth[id(a,b)]<0){depth[id(a,b)]=depth[c]+1;queue.push(id(a,b));}}}
 const inRoom=(c:number)=>{const i=c%cols,j=(c-i)/cols;return i>=ri&&i<ri+2&&j>=rj&&j<rj+2;};
 const cells=[...depth.keys()].filter(c=>depth[c]>=3).sort((a,b)=>depth[b]-depth[a]),ends=cells.filter(c=>degree[c]===1&&!inRoom(c)),taken:number[]=[];
 const far=(c:number)=>taken.every(t=>Math.abs(t%cols-c%cols)+Math.abs(Math.floor(t/cols)-Math.floor(c/cols))>=2);
 const pick=(list:number[])=>{const c=list.find(far)??list.find(c=>!taken.includes(c));if(c===undefined)fail('maze cells');taken.push(c!);return {x:mid(c!%cols),y:mid(Math.floor(c!/cols))};};
 const others=base.pack.filter(p=>p.rank!=='normal'),normals=base.pack.filter(p=>p.rank==='normal').sort((a,b)=>b.count-a.count),pack:Pack[]=[];
 for(const p of others)pack.push({...p,center:pick(ends.length?ends:cells),radius:1});
 const chest=pick([...ends.slice(Math.floor(ends.length/3)),...cells]);
 const room=cells.find(inRoom);if(room!==undefined&&normals.length){taken.push(room);pack.push({...normals.shift()!,center:{x:mid(ri)+cell/2,y:mid(rj)+cell/2},radius:4});}
 normals.forEach((p,i)=>{const spread=cells.filter((_,k)=>k%Math.max(1,normals.length)===i);pack.push({...p,center:pick([...spread,...cells]),radius:Math.min(p.radius,3)});});
 return {...draft,pack,chests:base.chests.map(c=>({...c,...chest}))};
}

/** Boss floors: an antechamber, one narrow approach and the boss hall, turned to a random side. */
function bossFloor(base:Spec,random:()=>number):Spec{
 const n=base.size!,turns=Math.floor(random()*4),C:Pt=[Math.round(56+random()*8-4),Math.round(50+random()*8-4)];
 const turn=([x,y]:Pt):Pt=>{let p:Pt=[x,y];for(let k=0;k<turns;k++)p=[n-p[1],p[0]];return p;};
 const box=(x0:number,y0:number,w:number,h:number):[number,number,number,number]=>{const a=turn([x0,y0]),b=turn([x0+w,y0+h]);return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])];};
 const at=(p:Pt)=>{const [x,y]=turn(p);return {x:round(x),y:round(y)};},carve:Carve[]=[];let entrance:Pt,hallR:number;
 if(base.kit==='cave'){hallR=20+random()*3;entrance=[18,Math.round(C[1]+random()*16-8)];const bend=random()*10-5;
  carve.push({disk:[...turn(entrance),8]},{path:[turn(entrance),turn([(entrance[0]+C[0])/2,(entrance[1]+C[1])/2+bend]),turn(C)].map(([x,y])=>[round(x),round(y)] as Pt),width:PASSAGE},{disk:[...turn(C),round(hallR)]});}
 else{const S=random()<.5?42:46,x0=C[0]-S/2,y0=C[1]-S/2;hallR=S/2-4;entrance=[15,C[1]];
  carve.push({rect:box(8,C[1]-7,14,14)},{path:[turn(entrance),turn(C)],width:PASSAGE},{rect:box(x0,y0,S,S)});
  if(base.kit==='crypt'){const w=S-10,[px,py]=box(x0+4,y0+4,w+2,w+2);carve.push({pillars:{x:px,y:py,w,h:w,step:w/4,ring:true}});}
  else{const f=5+Math.floor(random()*3);for(const [fx,fy] of [[6,6],[S-6-f,6],[6,S-6-f],[S-6-f,S-6-f]])carve.push({fill:box(x0+fx,y0+fy,f,f)});}}
 const pack=base.pack.map(p=>p.rank==='boss'?{...p,center:at([C[0]+2,C[1]])}:{...p,center:at([C[0]-6,C[1]+(random()<.5?-4:4)]),radius:Math.min(p.radius,4)});
 const safe=at(entrance),portal=at([entrance[0]-2,entrance[1]+2]);
 return {...base,carve,route:[turn(entrance),turn(C)].map(([x,y])=>[round(x),round(y)] as Pt),safe:{x:Math.round(safe.x),y:Math.round(safe.y)},portal:{x:Math.round(portal.x),y:Math.round(portal.y)},pack,chests:[]};
}

/** One concrete layout for a run; retries derived seeds until the stage builds and every chest is reachable. */
export function generatePlaneStage(stageId:string,seed:number){
 const base=planeStageSpecs.find(s=>s.id===stageId);if(!base)throw Error('Unknown plane stage '+stageId);
 let last:unknown;
 for(let attempt=0;attempt<24;attempt++){const s=mix(seed,attempt),random=rng(s);
  try{const spec={...(base.boss?bossFloor(base,random):base.kit==='cave'?caveLine(base,random):base.kit==='crypt'?cryptLine(base,random):mazeLine(base,random,s)),seed:s};
   const built=buildPlaneStage(spec),grid=new NavigationGrid(built.region.width,built.region.height,built.region.obstacles,.55);
   for(const c of spec.chests)if(!grid.path(spec.safe,{x:c.x+.5,y:c.y+.5}).length)fail('chest');
   built.region.layoutSeed=seed;built.region.presentationKey=stageId+'#'+seed;return built;}
  catch(error){last=error;}}
 throw Error('位面随机布局失败 '+stageId+' '+seed+': '+String(last));
}
/** Same seed → same layout. Clients rebuild only the picture, never spawns. */
const cache=new Map<string,ReturnType<typeof generatePlaneStage>['map']>();
export function planeLayoutMap(stageId:string,seed:number){const key=stageId+':'+seed;let map=cache.get(key);if(!map){map=generatePlaneStage(stageId,seed).map;if(cache.size>8)cache.clear();cache.set(key,map);}return map;}
export const isPlaneStage=(id:string)=>planeStageSpecs.some(s=>s.id===id);
