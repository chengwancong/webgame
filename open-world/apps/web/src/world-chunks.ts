import {project,unproject,type IsoPoint} from './iso.ts';
export type WorldViewport={x:number;y:number;width:number;height:number};
export const worldChunkCells=32;
/** Ground chunks are built in small steps under a per-frame budget. A chunk already on screen but still missing gets
 * `urgentBudgetMs`; only when the hero's own chunk is missing (map entry, teleport) does a frame spend `entryBudgetMs`,
 * so walking never pays the large budget. Up to `spareChunks` chunks that left the loading ring stay, so walking back
 * does not repaint them. */
export const chunkBuild={stepBudgetMs:4,urgentBudgetMs:12,entryBudgetMs:40,spareChunks:4} as const;
export function chunkBudgetMs(entry:boolean,urgent:boolean){return entry?chunkBuild.entryBudgetMs:urgent?chunkBuild.urgentBudgetMs:chunkBuild.stepBudgetMs;}
/** A missing hero tile is not necessarily a map entry: ordinary walking can catch
 * up with a pending chunk. Keep startup loading latched only until that tile is
 * ready, then re-arm only for a discontinuous position jump. Eight cells matches
 * the existing snapshot presentation teleport threshold; no movement rules change. */
export class ChunkBuildBudget{
 private previous?:IsoPoint;private entering=true;
 next(hero:IsoPoint,heroChunkMissing:boolean,urgent:boolean){
  if(this.previous&&Math.hypot(hero.x-this.previous.x,hero.y-this.previous.y)>8)this.entering=true;
  this.previous={x:hero.x,y:hero.y};
  if(!heroChunkMissing)this.entering=false;
  return chunkBudgetMs(this.entering&&heroChunkMissing,urgent);
 }
}
/** Workbook roads store vertices. Rasterize every segment so sparse vertices
 * produce a connected road across chunk boundaries. */
export function roadCells(points:readonly (readonly [number,number])[]){
 const cells=new Map<string,[number,number]>();
 for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[i],steps=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]))*2));
  for(let n=0;n<=steps;n++){const p:[number,number]=[Math.round(a[0]+(b[0]-a[0])*n/steps),Math.round(a[1]+(b[1]-a[1])*n/steps)];cells.set(p.join(','),p);}
 }return [...cells.values()];
}
/** Camera footprint in navigation space, plus a ring for decoration overhang
 * and ahead-of-camera loading. The map size never controls the live node count. */
export function visibleWorldChunks(width:number,height:number,view:WorldViewport,margin=1){
 const corners=[[view.x,view.y],[view.x+view.width,view.y],[view.x,view.y+view.height],[view.x+view.width,view.y+view.height]].map(([x,y])=>unproject({x,y}));
 const left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x))/worldChunkCells)-margin),right=Math.min(Math.ceil(width/worldChunkCells)-1,Math.floor(Math.max(...corners.map(p=>p.x))/worldChunkCells)+margin);
 const top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y))/worldChunkCells)-margin),bottom=Math.min(Math.ceil(height/worldChunkCells)-1,Math.floor(Math.max(...corners.map(p=>p.y))/worldChunkCells)+margin);
 const result=new Set<string>();for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)result.add(`${x},${y}`);return result;
}
export function chunkKey(p:IsoPoint){return `${Math.floor(p.x/worldChunkCells)},${Math.floor(p.y/worldChunkCells)}`;}
export function chunkViewDistance(key:string,view:WorldViewport){const [x,y]=key.split(',').map(Number),p=project({x:(x+.5)*worldChunkCells,y:(y+.5)*worldChunkCells});return Math.hypot(p.x-view.x-view.width/2,p.y-view.y-view.height/2);}
export function inWorldViewport(point:IsoPoint,view:WorldViewport,overhang=200){const p=project(point);return p.x>=view.x-overhang&&p.x<=view.x+view.width+overhang&&p.y>=view.y-overhang&&p.y<=view.y+view.height+overhang;}
type CameraFrame={scrollX:number;scrollY:number;width:number;height:number;zoom:number};
/** World rectangle a camera shows; Phaser zooms around the viewport centre, so scroll is not the top-left at zoom≠1. */
export function cameraView(c:CameraFrame):WorldViewport{const width=c.width/c.zoom,height=c.height/c.zoom;return {x:c.scrollX+(c.width-width)/2,y:c.scrollY+(c.height-height)/2,width,height};}
/** Position for a scroll-factor-0 object so its local coordinates are stage pixels under the camera zoom. */
export function screenOrigin(c:CameraFrame){return {x:(c.width-c.width/c.zoom)/2,y:(c.height-c.height/c.zoom)/2};}
