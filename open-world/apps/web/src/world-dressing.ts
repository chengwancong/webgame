import {starseaAsset} from './starsea-runtime-assets.ts';
/**
 * Scene dressing approved 2026-10-11 (docs/scene-dressing.md): soft-edged roads with a trodden rim, settlement cobblestone,
 * large soft ground patches and a dense non-blocking scatter. Everything is derived deterministically from the sealed map's
 * `dressing` block, so ground chunks stay seamless and the minimap paints the same picture without storing thousands of sprites.
 */
type Wash={color:string;alpha:number};
type Road={resource:string;widthCells:number;points:[number,number][];tint?:string;wash?:Wash};
export type ScatterKind='tree'|'bush'|'flower'|'tuft'|'rock';
export type Dressing={patches:{resource:string;alpha:number;tint?:string;share:number}[];plaza?:{resource:string;points:[number,number,number][]};
 scatter?:{seed:number;step:number;land:[number,number,number,number];clear:number[];pools:Record<ScatterKind,string[]>}};
type DressedMap={id:string;width:number;height:number;groundResource:string;roads:Road[];dressing?:Dressing;decorations?:{x:number;y:number}[]};
export type ScatterItem={id:string;resourceId:string;x:number;y:number;displayWidth:number;mirrorX:boolean;kind:ScatterKind;depthMode:'y';occlusion?:'foreground'};
/** Integer hash → [0,1). Pure function of its inputs, so every chunk and the minimap agree. */
export function hash(...n:number[]){let h=0x9e3779b9;for(const v of n){h=Math.imul(h^Math.round(v*1000),0x85ebca6b);h=h<<13|h>>>17;h=Math.imul(h,0xc2b2ae35);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return (h>>>0)/4294967296;}
/** Smooth 1D value noise in [-1,1]. */
function noise(seed:number,t:number){const i=Math.floor(t),f=t-i,u=f*f*(3-2*f);return (hash(seed,i)*(1-u)+hash(seed,i+1)*u)*2-1;}
const textSeed=(s:string)=>[...s].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
function segmentDistance(px:number,py:number,a:[number,number],b:[number,number]){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-a[0]-dx*t,py-a[1]-dy*t);}
/** Drawn road half width before wobble (cells); scatter keeps clear of half width × 1.2 + pad. */
export const roadHalf=(r:Road)=>(r.widthCells+.6)/2;
/** Every resource the dressing can paint, for preloading before the renderer builds chunks. */
export function dressingResources(map:{dressing?:Dressing}){const d=map.dressing;return d?[...d.patches.map(p=>p.resource),...(d.plaza?[d.plaza.resource]:[]),...Object.values(d.scatter?.pools??{}).flat()]:[];}
/**
 * Drawn road centre lines (2026-10-16). The sealed roads are ruler-straight polylines (legs up to 150 cells) that read as
 * stickers in the iso view; the drawn road rounds every corner and meanders gently on long legs. The bend fades out near
 * authored vertices (plazas sit there) and backs off where it would run over a map decoration (the generator only kept
 * those clear of the straight line). Pure presentation: navigation, collision and the sealed map are unchanged.
 */
const curveCache=new WeakMap<object,[number,number][][]>();
export function roadCurves(map:DressedMap):[number,number][][]{
 let curves=curveCache.get(map);if(curves)return curves;const seed=textSeed(map.id),decor=map.decorations??[],plazas=map.dressing?.plaza?.points??[];
 curves=map.roads.map((r,ri)=>{
  const p=r.points;if(p.length<2)return p.map(q=>[q[0],q[1]] as [number,number]);const base:[number,number][]=[[p[0][0],p[0][1]]];
  // A plaza vertex keeps a tight corner so the road still runs through the plaza (a fillet pulls the curve up to c/2 inward).
  for(let i=1;i<p.length-1;i++){const a=p[i-1],v=p[i],b=p[i+1],la=Math.hypot(v[0]-a[0],v[1]-a[1])||1,lb=Math.hypot(b[0]-v[0],b[1]-v[1])||1,
   onPlaza=plazas.some(([x,y,r])=>Math.hypot(x-v[0],y-v[1])<r),c=Math.min(onPlaza?4:10,la/3,lb/3);
   const s0=[v[0]+(a[0]-v[0])*c/la,v[1]+(a[1]-v[1])*c/la],e=[v[0]+(b[0]-v[0])*c/lb,v[1]+(b[1]-v[1])*c/lb];
   for(let k=0;k<=8;k++){const t=k/8,u=1-t;base.push([u*u*s0[0]+2*u*t*v[0]+t*t*e[0],u*u*s0[1]+2*u*t*v[1]+t*t*e[1]]);}}
  base.push([p[p.length-1][0],p[p.length-1][1]]);
  // Resample by arc length so the bend and the disc spacing do not depend on how the polyline was authored.
  const STEP=1.2,pts:[number,number][]=[],tan:[number,number][]=[];let carry=0;
  for(let i=1;i<base.length;i++){const [ax,ay]=base[i-1],[bx,by]=base[i],len=Math.hypot(bx-ax,by-ay);if(!len)continue;const ux=(bx-ax)/len,uy=(by-ay)/len;
   let d=carry;for(;d<len;d+=STEP){pts.push([ax+ux*d,ay+uy*d]);tan.push([ux,uy]);}carry=d-len;}
  pts.push(base[base.length-1]);tan.push(tan[tan.length-1]??[1,0]);
  const half=roadHalf(r)*1.2,clearOf=(x:number,y:number)=>decor.every(d=>Math.hypot(d.x-x,d.y-y)>half+1.4);
  const dvs=pts.map(([x,y])=>Math.min(...p.map(v=>Math.hypot(v[0]-x,v[1]-y))));
  const offsets=pts.map(([x,y],i)=>{const dv=dvs[i],taper=Math.max(0,Math.min(1,(dv-7)/12)),arc=i*STEP;
   let o=taper*(3.2*noise(seed+ri*13,arc/24)+.9*noise(seed+ri*13+5,arc/9));const nx=-tan[i][1],ny=tan[i][0];
   for(const k of [1,.5,0])if(k===0||clearOf(x+nx*o*k,y+ny*o*k)){o*=k;break;}return o;});
  // Smooth the backed-off offsets so avoidance never leaves a kink, then pin authored vertices (smoothing leaks a little).
  for(let pass=0;pass<2;pass++){const prev=offsets.slice();for(let i=0;i<offsets.length;i++){let n=0,t=0;for(let j=Math.max(0,i-3);j<=Math.min(offsets.length-1,i+3);j++){t+=prev[j];n++;}offsets[i]=t/n;}}
  offsets.forEach((o,i)=>{offsets[i]=o*Math.min(1,dvs[i]/4);});
  return pts.map(([x,y],i)=>[x-tan[i][1]*offsets[i],y+tan[i][0]*offsets[i]] as [number,number]);
 });
 curveCache.set(map,curves);return curves;
}
type P=[number,number];
/** Junction closing radius (cells): concave corners round to it and gaps narrower than twice it are paved over. */
const FILLET=2.5;
export type RoadFillet={road:number;c:P;ti:P;tj:P;x:P};
export type RoadJunctions={fillets:RoadFillet[];bridges:{road:number;a:P;b:P}[]};
const junctionCache=new WeakMap<object,RoadJunctions>();
/**
 * Junction closing (2026-10-16): every island has several roads of one material. Their union met at sharp concave notches,
 * and roads converging on a junction left thin strips of ground whose two rims read as one seam line through the paving.
 * This approximates a morphological closing of the paving with a FILLET-radius disc, between different roads only:
 * - each concave corner gets the fillet of the circle touching both edges (centre where the two offset curves cross, free
 *   of every road);
 * - where two nearly parallel roads (< 30°) run closer than 2×FILLET edge to edge, centre-to-centre bridges pave the gap.
 * A road with no other road nearby gets neither and looks as before.
 */
export function roadJunctions(map:DressedMap):RoadJunctions{
 let out=junctionCache.get(map);if(out)return out;out={fillets:[],bridges:[]};const {fillets,bridges}=out,curves=roadCurves(map),R=FILLET,B=4,key=(r:Road)=>JSON.stringify([r.resource,r.tint,r.wash]),halves=map.roads.map(roadHalf);
 const grids=curves.map(c=>{const g=new Map<number,number[]>();c.forEach(([x,y],k)=>{const id=Math.floor(y/B)*1024+Math.floor(x/B),list=g.get(id)??[];list.push(k);g.set(id,list);});return g;});
 const near=(j:number,p:P,reach:number)=>{let best=-1,d=reach;const bx=Math.floor(p[0]/B),by=Math.floor(p[1]/B),span=Math.ceil(reach/B);
  for(let y=by-span;y<=by+span;y++)for(let x=bx-span;x<=bx+span;x++)for(const k of grids[j].get(y*1024+x)??[]){const q=curves[j][k],e=Math.hypot(q[0]-p[0],q[1]-p[1]);if(e<d){d=e;best=k;}}return best<0?undefined:{q:curves[j][best],k:best,d};};
 const tangent=(c:P[],k:number):P=>{const u=c[Math.max(k-1,0)],w=c[Math.min(k+1,c.length-1)],len=Math.hypot(w[0]-u[0],w[1]-u[1])||1;return [(w[0]-u[0])/len,(w[1]-u[1])/len];};
 map.roads.forEach((ri,i)=>map.roads.forEach((rj,j)=>{if(i===j||key(ri)!==key(rj))return;const hi=halves[i],hj=halves[j],c=curves[i];
  c.forEach((a,k)=>{const n=near(j,a,hi+hj+2*R);if(!n||n.d<=Math.max(hi,hj))return;const ta=tangent(c,k),tb=tangent(curves[j],n.k);
   if(Math.abs(ta[0]*tb[0]+ta[1]*tb[1])>.87)bridges.push({road:i,a,b:n.q});});
  for(const s of [-1,1]){let prev:{a:P;c:P;f:number}|undefined;
   c.forEach((a,k)=>{const t=tangent(c,k),o:P=[a[0]-s*t[1]*(hi+R),a[1]+s*t[0]*(hi+R)],nj=near(j,o,hj+R+2),cur=nj&&{a,c:o,f:nj.d-hj-R};
    // The circle centre sits where the offset curve of road i crosses the offset curve of road j.
    if(prev&&cur&&(prev.f<0)!==(cur.f<0)){const t=prev.f/(prev.f-cur.f),C:P=[prev.c[0]+(cur.c[0]-prev.c[0])*t,prev.c[1]+(cur.c[1]-prev.c[1])*t],A:P=[prev.a[0]+(cur.a[0]-prev.a[0])*t,prev.a[1]+(cur.a[1]-prev.a[1])*t],q=near(j,C,hj+R+2);
     if(q&&map.roads.every((_,m)=>{const n=near(m,C,halves[m]+R);return !n||n.d>halves[m]+R-.4;})){const toward=(p:P):P=>{const l=Math.hypot(p[0]-C[0],p[1]-C[1])||1;return [C[0]+(p[0]-C[0])/l*R,C[1]+(p[1]-C[1])/l*R];};
      const ti=toward(A),tj=toward(q.q),mx=(ti[0]+tj[0])/2-C[0],my=(ti[1]+tj[1])/2-C[1],dm=Math.hypot(mx,my);
      // A very narrow wedge (tangent points almost opposite) puts the corner over 4×FILLET away; the bridges pave it.
      if(dm>R*.25){const f=R*R/(dm*dm);fillets.push({road:i,c:C,ti,tj,x:[C[0]+mx*f,C[1]+my*f]});}}}
    prev=cur;});}}));
 junctionCache.set(map,out);return out;
}
const scatterCache=new WeakMap<object,ScatterItem[]>();
/**
 * Groves, bushes, flowers and rocks on a jittered grid plus grass tufts along road edges. Purely visual: nothing blocks,
 * and items keep out of camps, waypoints, spawn points, plazas, the landing and the generator's own scenery (`clear`).
 */
export function mapScatter(map:DressedMap):ScatterItem[]{
 const cached=scatterCache.get(map);if(cached)return cached;const s=map.dressing?.scatter,out:ScatterItem[]=[];scatterCache.set(map,out);if(!s)return out;
 const B=16,buckets=new Map<number,number[]>(),circles:number[]=[...s.clear];for(const [x,y,r] of map.dressing?.plaza?.points??[])circles.push(x,y,r*.8);
 for(let i=0;i<circles.length;i+=3){const [x,y,r]=[circles[i],circles[i+1],circles[i+2]];for(let by=Math.floor((y-r-4)/B);by<=Math.floor((y+r+4)/B);by++)for(let bx=Math.floor((x-r-4)/B);bx<=Math.floor((x+r+4)/B);bx++){const k=by*1024+bx,b=buckets.get(k)??[];b.push(i);buckets.set(k,b);}}
 const blocked=(x:number,y:number,pad:number)=>(buckets.get(Math.floor(y/B)*1024+Math.floor(x/B))??[]).some(i=>Math.hypot(circles[i]-x,circles[i+1]-y)<circles[i+2]+pad);
 // Scatter keeps off the drawn (curved) road; segments are bucketed because each curve has hundreds of them.
 const curves=roadCurves(map),RB=8,roadBuckets=new Map<number,{a:[number,number];b:[number,number];half:number}[]>();
 const segs=[...curves.flatMap((c,ri)=>{const half=roadHalf(map.roads[ri])*1.2;return c.slice(1).map((b,i)=>({a:c[i],b,half}));}),
  // A fillet is kept clear along its corner-to-arc spokes (it is at most FILLET deep); a bridge like a narrow road.
  ...roadJunctions(map).fillets.flatMap(f=>[f.ti,f.tj,[(f.ti[0]+f.tj[0])/2,(f.ti[1]+f.tj[1])/2] as P].map(b=>({a:f.x,b,half:.6}))),
  ...roadJunctions(map).bridges.map(({a,b})=>({a,b,half:1}))];
 for(const g of segs){const {a,b}=g,reach=g.half+4;
  for(let by=Math.floor((Math.min(a[1],b[1])-reach)/RB);by<=Math.floor((Math.max(a[1],b[1])+reach)/RB);by++)for(let bx=Math.floor((Math.min(a[0],b[0])-reach)/RB);bx<=Math.floor((Math.max(a[0],b[0])+reach)/RB);bx++){const k=by*1024+bx,list=roadBuckets.get(k)??[];list.push(g);roadBuckets.set(k,list);}}
 const nearRoad=(x:number,y:number,pad:number)=>(roadBuckets.get(Math.floor(y/RB)*1024+Math.floor(x/RB))??[]).some(g=>segmentDistance(x,y,g.a,g.b)<g.half+pad);
 const [cx,cy,rx,ry]=s.land,land=(x:number,y:number)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1&&x>1&&y>1&&x<map.width-1&&y<map.height-1;
 const pick=(kind:ScatterKind,...key:number[])=>{const pool=s.pools[kind];return pool.length?pool[Math.floor(hash(s.seed,...key,91)*pool.length)]:undefined;};
 const place=(kind:ScatterKind,x:number,y:number,scale:number,...key:number[])=>{const id=pick(kind,...key);if(!id)return;const base=(starseaAsset(id)?.runtime as {displayWidth?:number}|undefined)?.displayWidth??90;
  out.push({id:`scatter:${kind}:${key.join(':')}`,resourceId:id,x:Math.round(x*10)/10,y:Math.round(y*10)/10,displayWidth:Math.round(base*scale*(.85+hash(s.seed,...key,92)*.3)),mirrorX:hash(s.seed,...key,93)<.5,kind,depthMode:'y',...(kind==='tree'?{occlusion:'foreground' as const}:{})});};
 const step=s.step;
 for(let gy=0;gy<map.height;gy+=step)for(let gx=0;gx<map.width;gx+=step){
  const x=gx+step/2+(hash(s.seed,gx,gy,2)-.5)*step*.8,y=gy+step/2+(hash(s.seed,gx,gy,3)-.5)*step*.8,roll=hash(s.seed,gx,gy,1);if(!land(x,y))continue;
  if(roll<.16){if(blocked(x,y,2.5)||nearRoad(x,y,3))continue;const n=2+Math.floor(hash(s.seed,gx,gy,4)*3);
   for(let k=0;k<n;k++){const a=hash(s.seed,gx,gy,k,5)*Math.PI*2,d=k?.9+hash(s.seed,gx,gy,k,6)*1.4:0,tx=x+Math.cos(a)*d,ty=y+Math.sin(a)*d;if(land(tx,ty)&&!blocked(tx,ty,1)&&!nearRoad(tx,ty,2))place('tree',tx,ty,1,gx,gy,k);}
   const a=hash(s.seed,gx,gy,7)*Math.PI*2,bx=x+Math.cos(a)*2,by=y+Math.sin(a)*2;if(land(bx,by)&&!blocked(bx,by,.5)&&!nearRoad(bx,by,1))place('bush',bx,by,1,gx,gy,9);}
  else if(roll<.45){if(!blocked(x,y,1.5)&&!nearRoad(x,y,1.6))place('bush',x,y,1,gx,gy);}
  else if(roll<.8){if(!blocked(x,y,1)&&!nearRoad(x,y,.8))place('flower',x,y,.9,gx,gy);}
  else if(roll<.9){if(!blocked(x,y,1.5)&&!nearRoad(x,y,1.5))place('rock',x,y,.8,gx,gy);}
 }
 // Grass tufts break the road edge, as in the approved sample.
 // One tuft slot per 2 cells of curve; slot ids count arc length so they stay stable along the road.
 map.roads.forEach((r,ri)=>{let t=0;const half=roadHalf(r),c=curves[ri];for(let i=1;i<c.length;i++){const [ax,ay]=c[i-1],[bx,by]=c[i],len=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/(len||1),uy=(by-ay)/(len||1);
  const from=Math.floor(t/2);t+=len;for(let slot=from+1;slot<=Math.floor(t/2);slot++)for(const side of [-1,1]){if(hash(s.seed,ri,slot,side,11)>.55)continue;const off=half+.3+hash(s.seed,ri,slot,side,12)*.9,along=hash(s.seed,ri,slot,side,13)*len,x=ax+ux*along-uy*off*side,y=ay+uy*along+ux*off*side;
   if(land(x,y)&&!blocked(x,y,0)&&!nearRoad(x,y,-.1))place('tuft',x,y,.75,ri,slot,side);}}});
 return out;
}
/** Cell-space shape: discs are filled in one path; items with `line` are stroked at that width (cells) along their path;
 * `solo` items are filled on their own path, so a winding that differs from the discs' never cuts a hole. */
type Item={box:[number,number,number,number];draw:(ctx:CanvasRenderingContext2D)=>void;line?:number;solo?:boolean};
function drawMask(c:CanvasRenderingContext2D,items:Item[]){
 for(const it of items)if(it.line||it.solo){c.beginPath();it.draw(c);if(it.line){c.lineWidth=it.line;c.stroke();}else c.fill();}
 c.beginPath();for(const it of items)if(!it.line&&!it.solo)it.draw(c);c.fill();
}
/** `scale` shrinks the material pattern (cobblestone reads too coarse at the tile's native size). */
/** `cut` is erased from the mask before blurring (the rim is a ring, so translucent roads such as ice do not show it through). */
/** `plain` tiles the material unmirrored (mirrored cobblestone shows kaleidoscope seams); `soften` scales the mask blur; `blend` composites the finished layer (multiply only darkens). */
type Layer={resource:string;tint?:string;wash?:Wash;alpha:number;items:Item[];fade?:Item[];cut?:Item[];scale?:number;plain?:boolean;soften?:number;blend?:GlobalCompositeOperation};
const layerCache=new WeakMap<object,Layer[]>();
const circleItem=(x:number,y:number,r:number):Item=>({box:[x-r,y-r,x+r,y+r],draw:c=>{c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);}});
/**
 * Road outline along the drawn curve: a rounded stroke in short runs (so chunk culling stays local) plus a disc at every
 * curve sample (1.2 cells) whose radius and centre drift with smooth noise.
 */
function roadItems(r:Road,curve:[number,number][],seed:number,widen:number):Item[]{
 const items:Item[]=[],half=roadHalf(r)+widen/2;
 for(let i=0;i<curve.length-1;i+=12){const run=curve.slice(i,i+13),xs=run.map(q=>q[0]),ys=run.map(q=>q[1]);
  items.push({box:[Math.min(...xs)-half,Math.min(...ys)-half,Math.max(...xs)+half,Math.max(...ys)+half],line:half*1.7,draw:c=>{c.moveTo(run[0][0],run[0][1]);for(let k=1;k<run.length;k++)c.lineTo(run[k][0],run[k][1]);}});}
 curve.forEach(([x,y],i)=>{const t=i*1.2,rr=half*(1+.16*noise(seed,t/3)),o=.32*noise(seed+1,t/4),a=curve[Math.max(i-1,0)],b=curve[Math.min(i+1,curve.length-1)],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  items.push(circleItem(x-(b[1]-a[1])/len*o,y+(b[0]-a[0])/len*o,rr));});
 return items;
}
/** Cached layers in paint order: ground patches, trodden rim, roads per material, settlement cobblestone. */
export function groundLayers(map:DressedMap):Layer[]{
 let layers=layerCache.get(map);if(layers)return layers;layers=[];const seed=textSeed(map.id),dressing=map.dressing;
 const patches=dressing?.patches??[],total=patches.reduce((n,p)=>n+p.share,0),blobs=patches.map(()=>[] as Item[]),P=20;
 if(total)for(let by=0;by<map.height;by+=P)for(let bx=0;bx<map.width;bx+=P){if(hash(seed,bx,by,1)>.6)continue;let w=hash(seed,bx,by,2)*total,i=0;while(i<patches.length-1&&w>=patches[i].share){w-=patches[i].share;i++;}
  const x=bx+hash(seed,bx,by,3)*P,y=by+hash(seed,bx,by,4)*P,r=4+hash(seed,bx,by,5)*7,n=3+Math.floor(hash(seed,bx,by,6)*3);
  for(let k=0;k<n;k++){const a=hash(seed,bx,by,k,7)*Math.PI*2,d=k?r*.6*hash(seed,bx,by,k,8):0;blobs[i].push(circleItem(x+Math.cos(a)*d,y+Math.sin(a)*d,r*(.45+.4*hash(seed,bx,by,k,9))));}}
 patches.forEach((p,i)=>layers!.push({resource:p.resource,tint:p.tint,alpha:p.alpha,items:blobs[i]}));
 // Trodden rim: the road's own material darkened, slightly wider, under the road. Narrow, multiplied (it only darkens, so
 // pale road stone on dark ground does not glow) and with half the mask blur (2026-10-16); road and plaza tile unmirrored.
 const curves=roadCurves(map),groups=new Map<string,{road:Road;items:Item[];rim:Item[]}>();map.roads.forEach((r,i)=>{const key=JSON.stringify([r.resource,r.tint,r.wash]),g=groups.get(key)??{road:r,items:[],rim:[]};g.items.push(...roadItems(r,curves[i],seed+i*7,0));g.rim.push(...roadItems(r,curves[i],seed+i*7,.6));groups.set(key,g);});
 // Junction fillets and bridges join only roads of one material, so each lands in that group: paving, rim (a wider fillet
 // on the same circle, a wider bridge) and the rim cut alike.
 const fillet=(f:RoadFillet,widen:number):Item=>{const r=FILLET-widen,at=(t:P,l:number):P=>[f.c[0]+(t[0]-f.c[0])*l/FILLET,f.c[1]+(t[1]-f.c[1])*l/FILLET],
   [p,q]=[at(f.ti,r),at(f.tj,r)],[pi,qi]=[at(f.ti,FILLET+.6),at(f.tj,FILLET+.6)],xl=Math.hypot(f.x[0]-f.c[0],f.x[1]-f.c[1])||1,x:P=[f.x[0]+(f.x[0]-f.c[0])/xl,f.x[1]+(f.x[1]-f.c[1])/xl];
  const xs=[x[0],pi[0],qi[0],p[0],q[0]],ys=[x[1],pi[1],qi[1],p[1],q[1]],ccw=(p[0]-f.c[0])*(q[1]-f.c[1])-(p[1]-f.c[1])*(q[0]-f.c[0])<0;
  // Corner → tangent point → the short arc (it bulges toward the corner) → other tangent point. Corner and sides reach
  // into the paving: a side lying exactly on the road edge would leave an antialiasing seam between the two fills.
  return {box:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],solo:true,draw:c=>{c.moveTo(x[0],x[1]);c.lineTo(pi[0],pi[1]);c.lineTo(p[0],p[1]);c.arc(f.c[0],f.c[1],r,Math.atan2(p[1]-f.c[1],p[0]-f.c[0]),Math.atan2(q[1]-f.c[1],q[0]-f.c[0]),ccw);c.lineTo(qi[0],qi[1]);c.closePath();}};};
 const bridge=(a:P,b:P,half:number):Item=>({box:[Math.min(a[0],b[0])-half,Math.min(a[1],b[1])-half,Math.max(a[0],b[0])+half,Math.max(a[1],b[1])+half],line:half*2,draw:c=>{c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);}});
 const {fillets,bridges}=roadJunctions(map),groupOf=(road:number)=>{const r=map.roads[road];return groups.get(JSON.stringify([r.resource,r.tint,r.wash]))!;};
 for(const f of fillets){const g=groupOf(f.road);g.items.push(fillet(f,0));g.rim.push(fillet(f,.3));}
 for(const {road,a,b} of bridges){const g=groupOf(road);g.items.push(bridge(a,b,.8));g.rim.push(bridge(a,b,1.1));}
 for(const {road,items,rim} of groups.values())layers.push({resource:road.resource,tint:'#9a7a58',alpha:.45,items:rim,cut:items,plain:true,soften:.5,blend:'multiply'});
 for(const {road,items} of groups.values())layers.push({resource:road.resource,tint:road.tint,wash:road.wash,alpha:1,items,plain:true,soften:.5});
 const plaza=dressing?.plaza;if(plaza?.points.length){const near=(it:Item)=>plaza.points.some(([x,y,r])=>it.box[0]<x+r&&it.box[2]>x-r&&it.box[1]<y+r&&it.box[3]>y-r);
  layers.push({resource:plaza.resource,alpha:1,scale:.65,plain:true,items:[...map.roads.flatMap((r,i)=>roadItems(r,curves[i],seed+i*7,.6)).filter(near),...plaza.points.flatMap(([x,y,r])=>[0,1,2,3].map(j=>{const a=hash(seed,x,y,j,21)*Math.PI*2,d=r*.22*hash(seed,x,y,j,22);return circleItem(x+Math.cos(a)*d,y+Math.sin(a)*d,r*(.42+.12*hash(seed,x,y,j,23)));}))],
   fade:plaza.points.map(([x,y,r])=>({box:[x-r,y-r,x+r,y+r],draw:c=>{const g=c.createRadialGradient(x,y,r*.55,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}}))});}
 layerCache.set(map,layers);return layers;
}
/** Device-space view: device = (ox,oy) + iso × k, iso = project(cell). */
export type GroundView={k:number;ox:number;oy:number;width:number;height:number;
 /** Mask downscale (4 for full-size chunks, 1–2 for the minimap) and mask blur in low-res px. */
 quality:number;blur:number;pixelMask?:boolean};
type Scratch={low:HTMLCanvasElement;soft:HTMLCanvasElement;fade:HTMLCanvasElement;full:HTMLCanvasElement};
const scratches=new Map<string,Scratch>();
function scratch(w:number,h:number,lw:number,lh:number){const key=`${w}x${h}:${lw}x${lh}`;let s=scratches.get(key);if(s)return s;
 const make=(a:number,b:number)=>{const c=document.createElement('canvas');c.width=a;c.height=b;return c;};s={low:make(lw,lh),soft:make(lw,lh),fade:make(lw,lh),full:make(w,h)};
 if(scratches.size>3){const [first]=scratches.keys();scratches.delete(first);}scratches.set(key,s);return s;}
const cellOf=(v:GroundView,px:number,py:number)=>{const ix=(px-v.ox)/v.k/32,iy=(py-v.oy)/v.k/18;return [(ix+iy)/2,(iy-ix)/2];};
/**
 * Paints patches, road rim, roads and plazas over an already filled ground. Each layer is drawn as a white mask at
 * 1/quality resolution, blurred there (cheap), upscaled (soft edge), then filled with the layer material in world-aligned
 * pattern space. `material` returns the tile canvas (mirrored unless `plain`) or undefined while loading. Returns false if a material was missing.
 */
export function paintGroundDressing(ctx:CanvasRenderingContext2D,map:DressedMap,v:GroundView,material:(resource:string,tint?:string,wash?:Wash,plain?:boolean)=>CanvasImageSource|undefined){
 const steps=groundDressingSteps(ctx,map,v,material);let r=steps.next();while(!r.done)r=steps.next();return r.value;
}
/** Same painting as paintGroundDressing, one layer per step, so a chunk can be built across frames without a long main-thread task. */
export function* groundDressingSteps(ctx:CanvasRenderingContext2D,map:DressedMap,v:GroundView,material:(resource:string,tint?:string,wash?:Wash,plain?:boolean)=>CanvasImageSource|undefined):Generator<void,boolean>{
 const corners=[[0,0],[v.width,0],[0,v.height],[v.width,v.height]].map(([x,y])=>cellOf(v,x,y)),pad=3;
 const area=[Math.min(...corners.map(c=>c[0]))-pad,Math.min(...corners.map(c=>c[1]))-pad,Math.max(...corners.map(c=>c[0]))+pad,Math.max(...corners.map(c=>c[1]))+pad];
 const hit=(it:Item)=>it.box[0]<area[2]&&it.box[2]>area[0]&&it.box[1]<area[3]&&it.box[3]>area[1];
 const q=v.quality,m=Math.ceil(v.blur*3)+2,lw=Math.ceil(v.width/q)+m*2,lh=Math.ceil(v.height/q)+m*2,s=scratch(v.width,v.height,lw,lh);
 const lowView=(c:CanvasRenderingContext2D)=>c.setTransform(32*v.k/q,18*v.k/q,-32*v.k/q,18*v.k/q,v.ox/q+m,v.oy/q+m);
 let complete=true;
 for(const layer of groundLayers(map)){
  const items=layer.items.filter(hit);if(!items.length)continue;const tile=material(layer.resource,layer.tint,layer.wash,layer.plain);if(!tile){complete=false;continue;}
  // Device bounding box of the layer inside the view, so masks and fills only touch what the layer covers.
  const pts=items.flatMap(it=>[[it.box[0],it.box[1]],[it.box[2],it.box[1]],[it.box[0],it.box[3]],[it.box[2],it.box[3]]].map(([x,y])=>[v.ox+(x-y)*32*v.k,v.oy+(x+y)*18*v.k]));
  const x0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0]))-v.blur*q*3)),y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1]))-v.blur*q*3)),x1=Math.min(v.width,Math.ceil(Math.max(...pts.map(p=>p[0]))+v.blur*q*3)),y1=Math.min(v.height,Math.ceil(Math.max(...pts.map(p=>p[1]))+v.blur*q*3));if(x1<=x0||y1<=y0)continue;
  const low=s.low.getContext('2d')!;low.setTransform(1,0,0,1,0,0);low.clearRect(0,0,lw,lh);lowView(low);low.fillStyle=low.strokeStyle='#fff';low.lineCap=low.lineJoin='round';
  drawMask(low,items);
  if(layer.cut){low.globalCompositeOperation='destination-out';drawMask(low,layer.cut.filter(hit));low.globalCompositeOperation='source-over';}
  if(layer.fade&&!v.pixelMask){const f=s.fade.getContext('2d')!;f.setTransform(1,0,0,1,0,0);f.clearRect(0,0,lw,lh);lowView(f);for(const it of layer.fade.filter(hit))it.draw(f);low.setTransform(1,0,0,1,0,0);low.globalCompositeOperation='destination-in';low.drawImage(s.fade,0,0);low.globalCompositeOperation='source-over';}
  const soft=s.soft.getContext('2d')!;soft.setTransform(1,0,0,1,0,0);soft.clearRect(0,0,lw,lh);const blur=v.pixelMask?0:v.blur*(layer.soften??1);soft.filter=blur?`blur(${blur}px)`:'none';soft.drawImage(s.low,0,0);soft.filter='none';
  const full=s.full.getContext('2d')!;full.setTransform(1,0,0,1,0,0);full.clearRect(x0,y0,x1-x0,y1-y0);full.imageSmoothingEnabled=!v.pixelMask;
  full.drawImage(s.soft,m+x0/q,m+y0/q,(x1-x0)/q,(y1-y0)/q,x0,y0,x1-x0,y1-y0);
  full.globalCompositeOperation='source-in';full.setTransform(v.k,0,0,v.k,v.ox,v.oy);const pattern=full.createPattern(tile,'repeat')!;if(layer.scale)pattern.setTransform(new DOMMatrix().scale(layer.scale));full.fillStyle=pattern;full.fillRect((x0-v.ox)/v.k,(y0-v.oy)/v.k,(x1-x0)/v.k,(y1-y0)/v.k);full.globalCompositeOperation='source-over';full.setTransform(1,0,0,1,0,0);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=v.pixelMask?1:layer.alpha;if(layer.blend&&!v.pixelMask)ctx.globalCompositeOperation=layer.blend;ctx.drawImage(s.full,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);ctx.restore();
  yield;
 }
 return complete;
}
