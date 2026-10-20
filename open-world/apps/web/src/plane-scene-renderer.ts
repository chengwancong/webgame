import Phaser from 'phaser';
import type {WorldPhaseView} from '../../../packages/contracts/open-world.ts';
import {planeResource,PLANE_DRAW_DEPTH,type PlaneMap,type PlaneMaterial,type PlanePiece} from '../../../packages/content/plane-scenes.ts';
import {starseaAsset,starseaTexture} from './starsea-runtime-assets.ts';
import type {Point} from './starsea-assets.ts';
import {project} from './iso.ts';
import {visibleWorldChunks,chunkKey,chunkViewDistance,cameraView,screenOrigin,chunkBuild} from './world-chunks.ts';
const {stepBudgetMs,urgentBudgetMs,spareChunks}=chunkBuild;

/** Chunk canvases reserve TOP pixels above the floor diamond for rock rising out of it. */
const TOP=340,groundWidth=2178,groundHeight=1226+TOP,groundLeft=1089,groundTop=37+TOP,CHUNK=32;
const depthOffset:Record<PlanePiece['layer'],number>={light:.5,pillar:0,prop:0,blocker:0};
/** Haze per distance band from the floor: flat steps (cel look), not a gradient. */
const HAZE=[0,0,.3,.55,.74,.87,.95];
type Node={image:Phaser.GameObjects.Image;occludes:boolean;bounds:Phaser.Geom.Rectangle};
type V={x:number;y:number;z:number};
const hash=(x:number,y:number)=>(((x+7)*73856093)^((y+3)*19349663))>>>0;
const rgba=(hex:string,a:number)=>{const v=parseInt(hex.slice(1),16);return `rgba(${v>>16&255},${v>>8&255},${v&255},${a})`;};
/** Presentation of a carved plane stage (plane-scenes.ts). Collision is the
 * Region's; this draws the floor and the rock height field into chunk
 * canvases under every actor (the field never rises into an actor's line of
 * sight), plus depth-sorted props, pillars and wall lights. A painted kit
 * replaces textures and sprites, never geometry. */
export class PlaneSceneRenderer{
 private chunks=new Map<string,{image:Phaser.GameObjects.Image;key:string;canvas:HTMLCanvasElement}>();private nodes=new Map<string,Node[]>();private source=new Map<string,PlanePiece[]>();
 private backdrop?:Phaser.GameObjects.Image;private pendingChunks=0;private job?:{key:string;steps:Generator<void,void>};private destroyed=false;private errors:string[]=[];private walk:Uint8Array;private lamps:V[];
 constructor(private scene:Phaser.Scene,readonly map:PlaneMap){
  this.walk=Uint8Array.from(map.cells,c=>c==='.'||c===','?1:0);
  scene.cameras.main.setBackgroundColor(map.background);
  this.backdrop=scene.add.image(0,0,this.texture('backdrop-near')).setOrigin(0).setScrollFactor(0).setDepth(-20000);
  for(const piece of map.pieces){const key=chunkKey(piece),bucket=this.source.get(key)??[];bucket.push(piece);this.source.set(key,bucket);}
  this.lamps=map.pieces.filter(p=>p.layer==='light').map(p=>({x:p.x,y:p.y,z:p.z??0}));
 }
 private rock(x:number,y:number){const n=this.map.width;return x<0||y<0||x>=n||y>=n||this.map.cells[y*n+x]==='#';}
 /** The part's texture key, with the island material (tint multiply, then wash) baked in once per resource. */
 private texture(part:string){const id=planeResource(this.map.kit,part,this.map.island),asset=starseaAsset(id);if(!asset?.runtime.file)throw Error('Plane part missing '+part);const key=starseaTexture(asset.runtime.file);if(!this.scene.textures.exists(key))throw Error('Unloaded plane texture '+part);
  // Island parts carry their own material (only while they fall back to the kit's art); shared parts take the island's.
  const own=asset.runtime as typeof asset.runtime&PlaneMaterial,r=id.startsWith(`ow-art-plane-${this.map.island}-`)?own:part==='light-pool'?{}:this.map.material??{};if(!r.tint&&!r.wash)return key;
  const tinted='plane-material:'+id;if(this.scene.textures.exists(tinted))return tinted;
  const image=this.scene.textures.get(key).getSourceImage() as HTMLImageElement,c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d')!;x.drawImage(image,0,0);
  if(r.tint){x.globalCompositeOperation='multiply';x.fillStyle=r.tint;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='destination-in';x.drawImage(image,0,0);}
  if(r.wash){x.globalCompositeOperation='source-atop';x.globalAlpha=r.wash.alpha;x.fillStyle=r.wash.color;x.fillRect(0,0,c.width,c.height);x.globalAlpha=1;}
  x.globalCompositeOperation='source-over';this.scene.textures.addCanvas(tinted,c);return tinted;}
 private image(part:string){return this.scene.textures.get(this.texture(part)).getSourceImage() as HTMLImageElement;}
 private cell(path:Path2D,x:number,y:number,z=0){[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].forEach(([i,j],k)=>{const p=project({x:i,y:j});k?path.lineTo(p.x,p.y-z):path.moveTo(p.x,p.y-z);});path.closePath();}
 private glow(x:number,y:number,z:number){let g=0;for(const l of this.lamps){const d=Math.hypot(l.x-x,l.y-y,(l.z-z)/36);if(d<5)g+=1-d/5;}return Math.min(1,g);}
 private *chunk(cx:number,cy:number):Generator<void,void>{
  const map=this.map,n=map.width,cell=`${cx},${cy}`,key=`plane-ground:${map.id}:${cx}:${cy}`,canvas=document.createElement('canvas');canvas.width=groundWidth;canvas.height=groundHeight;
  const ctx=canvas.getContext('2d')!,origin=project({x:cx*CHUNK,y:cy*CHUNK});ctx.translate(groundLeft-origin.x,groundTop-origin.y);
  // Floor: clipped to the padded chunk diamond so neighbouring chunks paint identical overlap.
  const clip=new Path2D();[[cx*CHUNK-1,cy*CHUNK-1],[cx*CHUNK+CHUNK+1,cy*CHUNK-1],[cx*CHUNK+CHUNK+1,cy*CHUNK+CHUNK+1],[cx*CHUNK-1,cy*CHUNK+CHUNK+1]].forEach(([x,y],i)=>{const p=project({x,y});i?clip.lineTo(p.x,p.y):clip.moveTo(p.x,p.y);});clip.closePath();
  const floor=new Path2D(),worn=new Path2D(),rock=new Path2D(),x0=Math.max(0,cx*CHUNK-4),y0=Math.max(0,cy*CHUNK-4),x1=Math.min(n,cx*CHUNK+CHUNK+4),y1=Math.min(n,cy*CHUNK+CHUNK+4);
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const c=map.cells[y*n+x];// Pillars and blocking props stand on floor.
   if(c==='#')this.cell(rock,x,y);else this.cell(floor,x,y);if(c===',')this.cell(worn,x,y);}
  ctx.save();ctx.clip(clip);ctx.clip(floor);
  ctx.fillStyle=ctx.createPattern(this.image('ground-main'),'repeat')!;ctx.fill(floor);
  yield;
  // Worn route: feathered so it reads as trodden ground, not a cell staircase.
  ctx.globalAlpha=.85;ctx.filter='blur(7px)';ctx.fillStyle=ctx.createPattern(this.image('ground-path'),'repeat')!;ctx.fill(worn);ctx.filter='none';ctx.globalAlpha=1;
  yield;
  // Underground ambient: the floor sits a step darker than daylight and the lamp pools lift it back.
  ctx.fillStyle=rgba(map.shadow,.2);ctx.fill(floor);
  // Soft contact shade where the floor meets rock.
  ctx.filter='blur(8px)';ctx.fillStyle=rgba(map.shadow,.45);ctx.fill(rock);ctx.filter='none';
  yield;
  const pool=this.image('light-pool');ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.75;
  for(const l of map.lights){if(l.x<x0-4||l.x>x1+4||l.y<y0-4||l.y>y1+4)continue;const p=project(l);ctx.drawImage(pool,p.x-pool.width/2,p.y-pool.height/2);}
  ctx.restore();
  // Rock: this chunk's own cells only, back to front (ascending x+y).
  const xs=cx*CHUNK,ys=cy*CHUNK,xe=Math.min(n,xs+CHUNK),ye=Math.min(n,ys+CHUNK),top=ctx.createPattern(this.image('wall-top'),'repeat')!;
  for(let d=xs+ys;d<=xe+ye-2;d++){for(let x=Math.max(xs,d-ye+1);x<=Math.min(xe-1,d-ys);x++){const y=d-x;if(!this.rock(x,y)||map.dist[y*n+x]>PLANE_DRAW_DEPTH)continue;
   this.blockCell(ctx,x,y,top);}if((d-xs-ys)%8===7)yield;}
  yield;
  ctx.setTransform(1,0,0,1,0,0);const texture=this.scene.textures.create(key,canvas,groundWidth,groundHeight);if(!texture)throw Error('Unable to register plane ground '+key);texture.add('__BASE',0,0,0,groundWidth,groundHeight);
  const image=this.scene.add.image(origin.x-groundLeft,origin.y-groundTop,key).setOrigin(0).setDepth(-10000+cx+cy);this.chunks.set(cell,{image,key,canvas});
  this.nodes.set(cell,(this.source.get(cell)??[]).map(p=>this.sprite(p)));
 }
 private release(key:string){const node=this.chunks.get(key);if(node){node.image.destroy();this.scene.textures.remove(node.key);node.canvas.width=0;node.canvas.height=0;this.chunks.delete(key);}for(const n of this.nodes.get(key)??[])n.image.destroy();this.nodes.delete(key);}
 /** Shadow tint, warm lamp light and banded haze over one surface already outlined by `path`. */
 private finish(ctx:CanvasRenderingContext2D,path:Path2D,dark:number,glow:number,haze:number){
  if(dark>0){ctx.fillStyle=rgba(this.map.shadow,dark);ctx.fill(path);}
  if(glow>0){ctx.globalCompositeOperation='lighter';ctx.fillStyle=rgba(this.map.glow,glow*.3);ctx.fill(path);ctx.globalCompositeOperation='source-over';}
  if(haze>0){ctx.fillStyle=rgba(this.map.background,haze);ctx.fill(path);}
 }
 /** One rock cell as an upright block: the wall strip sheared onto its +y and +x faces (tiled
  * upward from the floor line), the top texture on its diamond, and a dark outline on the
  * silhouette and creases so it reads like the hand-drawn actors standing in front of it. */
 private blockCell(ctx:CanvasRenderingContext2D,x:number,y:number,top:CanvasPattern){
  const map=this.map,n=map.width,e=map.heights[y*n+x],depth=map.dist[y*n+x],strip=this.image('wall-straight'),Hs=strip.height,variant=hash(x,y)%Math.max(1,Math.floor(strip.width/64));
  const level=(a:number,b:number)=>a>=n||b>=n?e:this.rock(a,b)?map.heights[b*n+a]:0,haze=HAZE[Math.min(HAZE.length-1,depth)];
  const line=(pts:number[][],alpha:number,width:number)=>{ctx.beginPath();pts.forEach(([X,Y],k)=>k?ctx.lineTo(X,Y):ctx.moveTo(X,Y));ctx.strokeStyle=rgba(map.outline,alpha*(1-haze*.7));ctx.lineWidth=width;ctx.stroke();};
  ctx.lineJoin='round';ctx.lineCap='round';
  // +y face runs (32,18) per cell from its left corner, +x face (32,-18).
  const wall=(left:{x:number;y:number},slope:number,low:number,shade:number,gx:number,gy:number)=>{
   ctx.save();ctx.transform(.5,slope/64,0,1,left.x,left.y);
   for(let z=low;z<e;){const zz=z%Hs,seg=Math.min(e-z,Hs-zz);ctx.drawImage(strip,variant*64,Hs-zz-seg,64,seg,0,-(z+seg)-.5,65,seg+1);z+=seg;}
   ctx.restore();
   const P=(dx:number,dz:number)=>[left.x+dx,left.y+dx*slope/32-dz],path=new Path2D();[P(0,e),P(32,e),P(32,low),P(0,low)].forEach(([X,Y],k)=>k?path.lineTo(X,Y):path.moveTo(X,Y));path.closePath();
   this.finish(ctx,path,shade,this.glow(gx,gy,e/2),haze);
   line([P(0,e),P(0,low)],.3,1.5);line([P(32,e),P(32,low)],.3,1.5);if(!low)line([P(0,0),P(32,0)],.85,2.5);};
  const ey=level(x,y+1),ex=level(x+1,y);
  if(e>ey)wall(project({x,y:y+1}),18,ey,0,x+.5,y+1);
  if(e>ex)wall(project({x:x+1,y:y+1}),-18,ex,.42,x+1,y+.5);
  const path=new Path2D();this.cell(path,x,y,e);ctx.fillStyle=top;ctx.fill(path);this.finish(ctx,path,0,0,haze);
  // Outline every top edge that drops to something lower: the block's silhouette and its front creases.
  const c=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([i,j])=>{const p=project({x:i,y:j});return[p.x,p.y-e];});
  const edge=(a:number,b:number,other:number)=>{if(other<e)line([c[a],c[b]],.9,2.5);else if(other===e)line([c[a],c[b]],.18,1.2);};
  edge(0,1,level(x,y-1));edge(3,0,level(x-1,y));edge(2,3,ey);edge(1,2,ex);
 }
 private sprite(piece:PlanePiece):Node{
  const asset=starseaAsset(planeResource(this.map.kit,piece.part,this.map.island));if(!asset?.runtime.file)throw Error('Plane part missing '+piece.part);const r=asset.runtime,p=project(piece),anchor=r.anchor??[.5,1];
  const image=this.scene.add.image(p.x,p.y-(piece.z??0),this.texture(piece.part)).setOrigin(anchor[0],anchor[1]);image.setScale((r.displayWidth??image.width)/image.width).setFlipX(Boolean(piece.mirrorX)).setDepth(p.y+depthOffset[piece.layer]);
  return {image,occludes:piece.layer==='pillar'||piece.layer==='blocker',bounds:image.getBounds()};
 }
 /** True when the foot point stands on a floor cell (used by tests and the walk-through probe). */
 walkable(p:Point){const x=Math.floor(p.x),y=Math.floor(p.y);return x>=0&&y>=0&&x<this.map.width&&y<this.map.height&&this.walk[y*this.map.width+x]===1;}
 draw(hero:Point,_phase?:WorldPhaseView){
  if(this.destroyed)return;const map=this.map,camera=this.scene.cameras.main,origin=screenOrigin(camera);
  this.backdrop?.setPosition(origin.x,origin.y).setDisplaySize(camera.width/camera.zoom,camera.height/camera.zoom);
  const view=cameraView(camera),wanted=visibleWorldChunks(map.width,map.height,view),onScreen=visibleWorldChunks(map.width,map.height,view,0),retain=visibleWorldChunks(map.width,map.height,view,2);
  // Same streaming as the island ground: spare chunks linger briefly, building runs in steps under a frame budget.
  const spare=[...this.chunks.keys()].filter(key=>!wanted.has(key)).sort((a,b)=>chunkViewDistance(a,view)-chunkViewDistance(b,view));
  spare.forEach((key,i)=>{if(!retain.has(key)||i>=spareChunks)this.release(key);});
  if(this.job&&!wanted.has(this.job.key))this.job=undefined;
  const pending=[...wanted].filter(key=>!this.chunks.has(key)&&key!==this.job?.key).sort((a,b)=>chunkViewDistance(a,view)-chunkViewDistance(b,view));this.pendingChunks=pending.length+(this.job?1:0);
  const urgent=[...onScreen].some(key=>!this.chunks.has(key)),deadline=performance.now()+(urgent?urgentBudgetMs:stepBudgetMs);
  try{do{
   if(!this.job){const key=pending.shift();if(!key)break;const [x,y]=key.split(',').map(Number);this.job={key,steps:this.chunk(x,y)};}
   if(this.job.steps.next().done){this.job=undefined;this.pendingChunks--;}
  }while(performance.now()<deadline);}catch(error){this.errors.push(String(error));console.error('[plane-scene]',error);this.destroyed=true;return;}
  // A pillar or blocking prop standing between the camera and the hero fades so the hero stays readable.
  const foot=project(hero),near=chunkKey(hero),[hx,hy]=near.split(',').map(Number);
  for(const [key,bucket] of this.nodes){const [x,y]=key.split(',').map(Number),close=Math.abs(x-hx)<=1&&Math.abs(y-hy)<=1;
   for(const n of bucket){if(!n.occludes)continue;const hidden=close&&n.image.depth>foot.y&&n.bounds.contains(foot.x,foot.y-40);const alpha=hidden?.4:1;if(n.image.alpha!==alpha)n.image.setAlpha(alpha);}}
 }
 get mapData(){return undefined;}
 diagnostics(){return{map:this.map.id,kit:this.map.kit,ready:!this.destroyed||this.errors.length>0,chunks:this.chunks.size,pendingChunks:this.pendingChunks,pieces:[...this.nodes.values()].reduce((n,b)=>n+b.length,0),totalPieces:this.map.pieces.length,errors:[...this.errors]};}
 destroy(){if(this.destroyed&&!this.chunks.size&&!this.backdrop)return;this.destroyed=true;this.job=undefined;for(const node of this.chunks.values()){node.image.destroy();this.scene.textures.remove(node.key);node.canvas.width=0;node.canvas.height=0;}this.chunks.clear();for(const bucket of this.nodes.values())for(const n of bucket)n.image.destroy();this.nodes.clear();this.source.clear();this.backdrop?.destroy();this.backdrop=undefined;}
}
