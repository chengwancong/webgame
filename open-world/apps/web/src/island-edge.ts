import {regionById} from '../../../packages/content/index.ts';
import type {Point} from './starsea-assets.ts';

/** Coast rows of a produced island: for each sampled row the walkable span is [left,right) (same source as the region's blocking strips). */
export type IslandBoundary={resourceId:string;stepCells:number;thicknessCells:number;points?:Point[]};
export type EdgePiece={resourceId:string;x:number;y:number;displayWidth:number;variant?:string;mirrorX?:boolean};
type Bounded={width:number;height:number;boundary:IslandBoundary};

/**
 * Island outline in world cells. Produced 512 islands are a round coast inside the square map; everything outside is blocked,
 * so ground must stop at the coast or the player sees grass they cannot walk on (user report 2026-10-11).
 * Maps without coast rows keep the full rectangle.
 */
const outlines=new WeakMap<object,Point[]>();
export function islandOutline(map:Bounded&{id?:string}):Point[]{
 if(!map.boundary.points?.length)return [{x:0,y:0},{x:map.width,y:0},{x:map.width,y:map.height},{x:0,y:map.height}];
 const cached=outlines.get(map);if(cached)return cached;
 // Exact coast from the region's per-row blocking strips (the sampled coast rows are every 4 rows and drift up to 4 cells at the tips).
 const rows=new Map<number,{left:number;right:number}>();
 for(const o of map.id?regionById(map.id).obstacles:[]){if(o.h!==1)continue;const row=rows.get(o.y)??{left:0,right:map.width};if(o.x===0)row.left=Math.max(row.left,o.w);else if(o.x+o.w>=map.width)row.right=Math.min(row.right,o.x);else continue;rows.set(o.y,row);}
 for(const [y,row] of rows)if(row.left>=row.right)rows.delete(y);
 if(!rows.size)for(const p of map.boundary.points){const row=rows.get(p.y);if(row){row.left=Math.min(row.left,p.x);row.right=Math.max(row.right,p.x);}else rows.set(p.y,{left:p.x,right:p.x});}
 const ys=[...rows.keys()].sort((a,b)=>a-b),first=rows.get(ys[0])!,last=rows.get(ys.at(-1)!)!,top=ys[0],bottom=ys.at(-1)!+1;
 // Row midpoints keep the drawn coast within half a cell of the walkable edge without a one-cell staircase.
 const outline=[{x:first.left,y:top},...ys.map(y=>({x:rows.get(y)!.left,y:y+.5})),{x:last.left,y:bottom},{x:last.right,y:bottom},...ys.slice().reverse().map(y=>({x:rows.get(y)!.right,y:y+.5})),{x:first.right,y:top}];
 outlines.set(map,outline);return outline;
}

/**
 * Legacy rectangle maps: cliff modules along the two camera-facing sides, under the ground layer.
 * Coast maps get no modules — straight modules on a round coast form a saw-tooth fence; the skirt below replaces them.
 */
export function islandEdges(map:Bounded):EdgePiece[]{
 if(map.boundary.points?.length)return [];
 const step=map.boundary.stepCells,out:EdgePiece[]=[];
 for(let n=0;n<Math.max(map.width,map.height);n+=step){
  if(n<map.width)out.push({resourceId:map.boundary.resourceId,x:Math.min(map.width-.1,n+step/2),y:map.height-.1,displayWidth:260,variant:'edge-west'});
  if(n<map.height)out.push({resourceId:map.boundary.resourceId,x:map.width-.1,y:Math.min(map.height-.1,n+step/2),displayWidth:260,variant:'edge-east'});
 }
 return out;
}
/** Boundary art the scene must preload. */
export function edgeResources(map:Bounded&{groundZones?:{resource:string}[]}){return map.boundary.points?.length?[coastStone(map)]:[map.boundary.resourceId];}

/** Path of the island outline in projected pixels, for clipping ground layers. */
export function islandPath(map:Bounded,toScreen:(p:Point)=>Point){
 const path=new Path2D();islandOutline(map).forEach((p,i)=>{const q=toScreen(p);i?path.lineTo(q.x,q.y):path.moveTo(q.x,q.y);});path.closePath();return path;
}

const hash=(n:number)=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
/** Tileable rock for the coast face: the island's own stone ground material (groundZones), so each island keeps its palette. */
export function coastStone(map:Bounded&{groundZones?:{resource:string}[]}){
 const id=map.groundZones?.find(z=>/stone/.test(z.resource))?.resource;if(!id)throw Error('Coast island has no stone ground zone');return id;
}
/**
 * Rock skirt hanging under the camera-facing coast, in projected pixels under the caller's transform.
 * Continuous at any coast angle (the straight modules alone leave a saw-tooth on diagonal coasts); the bottom edge is
 * jagged per outline vertex, so neighbouring ground chunks paint the identical band.
 */
export function paintCoastSkirt(ctx:CanvasRenderingContext2D,map:Bounded,toScreen:(p:Point)=>Point,depth:number,rock:HTMLCanvasElement,tile=1){
 if(!map.boundary.points?.length)return;
 const outline=islandOutline(map),drop=(i:number)=>depth*(.6+hash(i)*.4),front=(a:Point,b:Point)=>b.x-a.x-(b.y-a.y)>0;
 const band=new Path2D();
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length,a=outline[i],b=outline[j];if(!front(a,b))continue;
  const p=toScreen(a),q=toScreen(b);band.moveTo(p.x,p.y-1);band.lineTo(q.x,q.y-1);band.lineTo(q.x,q.y+drop(j));band.lineTo(p.x,p.y+drop(i));band.closePath();
 }
 ctx.save();ctx.clip(band);
 const pattern=ctx.createPattern(rock,'repeat')!,scale=tile;pattern.setTransform(new DOMMatrix([scale,0,0,scale,0,0]));ctx.fillStyle=pattern;ctx.fill(band);
 // Shade each face: lit under the rim, dark toward the hanging tip.
 for(let i=0;i<outline.length;i++){
  const j=(i+1)%outline.length,a=outline[i],b=outline[j];if(!front(a,b))continue;
  const p=toScreen(a),q=toScreen(b),top=Math.min(p.y,q.y),g=ctx.createLinearGradient(0,top,0,top+depth);
  g.addColorStop(0,'rgba(255,248,225,.18)');g.addColorStop(.3,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(20,16,30,.55)');
  ctx.beginPath();ctx.moveTo(p.x,p.y-1);ctx.lineTo(q.x,q.y-1);ctx.lineTo(q.x,q.y+depth);ctx.lineTo(p.x,p.y+depth);ctx.closePath();ctx.fillStyle=g;ctx.fill();
 }
 ctx.restore();
 // Grass overhang lip so the rim reads as the island top edge.
 ctx.save();ctx.lineWidth=Math.max(1,depth*.06);ctx.strokeStyle='rgba(40,30,20,.35)';ctx.lineJoin='round';ctx.beginPath();
 for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if(!front(a,b))continue;const p=toScreen(a),q=toScreen(b);ctx.moveTo(p.x,p.y+ctx.lineWidth/2);ctx.lineTo(q.x,q.y+ctx.lineWidth/2);}
 ctx.stroke();ctx.restore();
}
