import {starseaAsset} from '../starsea-runtime-assets.ts';
import {project} from '../iso.ts';
import type {StarseaMap} from '../starsea-world-renderer.ts';
import {coastStone,islandEdges,islandPath,paintCoastSkirt} from '../island-edge.ts';
import {mapScatter,paintGroundDressing,dressingResources} from '../world-dressing.ts';
import {pixelRuntime} from '../pixel-texture.ts';
import {pixelAsset} from '../pixel-assets.ts';
import {pixelGroundMaterial,pixelTerrainKey} from '../pixel-ground.ts';
/**
 * Real-scene miniature (direction A, approved 2026-10-11): the radar and region map paint the same ground and road
 * materials, south cliff modules and decoration sprites as StarseaWorldRenderer, only scaled. Nothing is re-drawn by hand.
 */
type Wash={color:string;alpha:number};
type Sprite={file:string;artId:string;anchor:[number,number];width:number;mirror:boolean;tint?:string;wash?:Wash;key:string};
/** `natural` keeps scene proportion (scatter), so the region map's minimum sprite scale only enlarges authored landmarks. */
type Placed={sprite:Sprite;x:number;y:number;natural?:boolean};
const images=new Map<string,HTMLImageElement>();
const tinted=new Map<string,HTMLCanvasElement>();
const tiles=new Map<string,HTMLCanvasElement>();
const layouts=new WeakMap<StarseaMap,{edges:Placed[];decorations:Placed[]}>();
function image(file:string){let i=images.get(file);if(!i){i=new Image();i.decoding='async';i.src=file;images.set(file,i);}return i.complete&&i.naturalWidth?i:undefined;}
/** 2×2 tile with tint and wash, mirrored unless `plain` (roads, plazas), as StarseaWorldRenderer.material builds it. */
function tile(resource:string,tint?:string,wash?:Wash,plain=false){
 if(pixelRuntime.cellStage>0){const file=starseaAsset(resource)?.runtime.file;return file?pixelGroundMaterial(pixelTerrainKey(file,resource),()=>{}):undefined;}
 const r=starseaAsset(resource)?.runtime as {file?:string;tileSize?:number;tint?:string;wash?:Wash}|undefined;if(!r?.file)return;
 const size=r.tileSize??512,key=JSON.stringify([r.file,tint??r.tint,wash??r.wash,size,plain]);let c=tiles.get(key);if(c)return c;
 const img=image(r.file);if(!img)return;c=document.createElement('canvas');c.width=c.height=size*2;const x=c.getContext('2d')!;
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.save();if(plain)x.translate(i*size,j*size);else{x.translate(i?size*2:0,j?size*2:0);x.scale(i?-1:1,j?-1:1);}x.drawImage(img,0,0,size,size);x.restore();}
 if(tint??r.tint){x.globalCompositeOperation='multiply';x.fillStyle=(tint??r.tint)!;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';}
 const w=wash??r.wash;if(w){x.globalAlpha=w.alpha;x.fillStyle=w.color;x.fillRect(0,0,c.width,c.height);x.globalAlpha=1;}
 tiles.set(key,c);return c;
}
/** Sprite with the renderer's material tint/wash (five-island modules) and per-decoration tint applied once. */
function bitmap(s:Sprite):HTMLImageElement|HTMLCanvasElement|undefined{
 if(pixelRuntime.cellStage>0){let asset=pixelAsset(s.artId);if(!asset?.original.includes(s.file))asset=pixelAsset(s.file);if(!asset)return;const raw=image(asset.file);if(!raw)return;const frame=asset.defaultFrame&&asset.frames?.[asset.defaultFrame];if(!frame)return raw;const key='pixel:'+asset.file;let c=tinted.get(key);if(c)return c;c=document.createElement('canvas');c.width=frame.w;c.height=frame.h;c.getContext('2d')!.drawImage(raw,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);tinted.set(key,c);return c;}
 const img=image(s.file);if(!img||!s.tint&&!s.wash)return img;let c=tinted.get(s.key);if(c)return c;
 c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d')!;x.drawImage(img,0,0);
 if(s.tint){x.globalCompositeOperation='multiply';x.fillStyle=s.tint;x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='destination-in';x.drawImage(img,0,0);}
 if(s.wash){x.globalCompositeOperation='source-atop';x.globalAlpha=s.wash.alpha;x.fillStyle=s.wash.color;x.fillRect(0,0,c.width,c.height);x.globalAlpha=1;}
 tinted.set(s.key,c);return c;
}
function sprite(d:{resourceId:string;variant?:string;displayWidth?:number;mirrorX?:boolean;tint?:string}):Sprite|undefined{
 const r=starseaAsset(d.resourceId)?.runtime as {file?:string;anchor?:[number,number];displayWidth?:number;variants?:{id:string;file:string;anchor?:[number,number];displayWidth?:number;mirrorX?:boolean}[];material?:{tint?:string;wash?:Wash}}|undefined;if(!r?.file)return;
 const v=r.variants?.find(v=>v.id===d.variant),file=v?.file??r.file,tint=d.tint??r.material?.tint,wash=r.material?.wash;
 return {file,artId:d.resourceId,anchor:v?.anchor??r.anchor??[.5,1],width:d.displayWidth??v?.displayWidth??r.displayWidth??180,mirror:d.mirrorX??v?.mirrorX??false,tint,wash,key:JSON.stringify([file,tint,wash])};
}
/** Edge modules and decorations (authored + larger scatter: trees, bushes, rocks) in scene depth order. Flowers and road tufts are sub-pixel at map scale. */
function layout(map:StarseaMap){
 let l=layouts.get(map);if(l)return l;
 const edges:Placed[]=[],place=(d:Parameters<typeof sprite>[0]&{x:number;y:number})=>{const s=sprite(d);return s?{sprite:s,x:d.x,y:d.y}:undefined;};
 for(const piece of islandEdges(map)){const e=place(piece);if(e)edges.push(e);}
 const depth=(d:StarseaMap['decorations'][number])=>d.depthMode==='ground'?-1e9:d.x+d.y;
 const decorations=[...map.decorations,...mapScatter(map).filter(s=>s.kind!=='flower'&&s.kind!=='tuft')].sort((a,b)=>depth(a)-depth(b)).map((d):Placed|undefined=>{const p=place(d);return p?{...p,natural:'kind' in d||!map.landmarks.some(l=>l.x===d.x&&l.y===d.y)}:undefined;}).filter((p):p is Placed=>Boolean(p));
 l={edges,decorations};layouts.set(map,l);return l;
}
export type SceneView={k:number;ox:number;oy:number;density:number;width:number;height:number;
 /** Lower bound for sprite scale, so the region map still shows recognisable trees and camps. 0 keeps scene proportions. */
 minSpriteScale?:number};
/**
 * Paints ground, roads, cliff edge and decorations. View maps iso pixels to CSS pixels (x=ox+iso.x*k).
 * Returns false while the ground material is not decoded yet (caller keeps the flat fallback);
 * `complete` is false while any sprite is still loading, so cached layers know to repaint.
 */
export function paintSceneMiniature(ctx:CanvasRenderingContext2D,map:StarseaMap,v:SceneView):{painted:boolean;complete:boolean}{
 const ground=tile(map.groundResource);if(!ground)return {painted:false,complete:false};
 const l=layout(map);let complete=true;const d=v.density,scale=Math.max(v.k,v.minSpriteScale??0);
 const draw=(p:Placed,s:number)=>{const img=bitmap(p.sprite);if(!img){complete=false;return;}const q=project(p),x=v.ox+q.x*v.k,y=v.oy+q.y*v.k,w=p.sprite.width*s,h=w*img.height/img.width;
  if(x+w<0||x-w>v.width||y-h>v.height||y+h<0)return;ctx.save();ctx.translate(x,y);if(p.sprite.mirror)ctx.scale(-1,1);ctx.drawImage(img,-w*p.sprite.anchor[0],-h*p.sprite.anchor[1],w,h);ctx.restore();};
 ctx.save();ctx.setTransform(d,0,0,d,0,0);
 ctx.imageSmoothingEnabled=pixelRuntime.cellStage<=0;
 // Edge modules sit under the ground like the renderer (depth -11000 < ground -10000), so only the hanging face shows.
 for(const e of l.edges)draw(e,v.k);
 ctx.setTransform(d*v.k,0,0,d*v.k,d*v.ox,d*v.oy);
 const island=islandPath(map,project);
 // Produced islands: the same stone skirt under the camera-facing coast as the ground chunks.
 if(map.boundary.points?.length){const stone=tile(coastStone(map));if(stone)paintCoastSkirt(ctx,map,project,map.boundary.thicknessCells*60,stone,.5);else complete=false;}
 ctx.fillStyle=ctx.createPattern(ground,'repeat')!;ctx.fill(island);
 // Same soft patches, road rim, roads and plazas as the ground chunks, clipped to the island.
 ctx.save();ctx.clip(island);if(!paintGroundDressing(ctx,map,{k:d*v.k,ox:d*v.ox,oy:d*v.oy,width:Math.ceil(v.width*d),height:Math.ceil(v.height*d),quality:pixelRuntime.cellStage>0?1:2,blur:pixelRuntime.cellStage>0?0:1,pixelMask:pixelRuntime.cellStage>0},tile))complete=false;ctx.restore();
 ctx.setTransform(d,0,0,d,0,0);
 for(const p of l.decorations)draw(p,p.natural?v.k:scale);
 ctx.restore();return {painted:true,complete};
}
/** Resources the miniature cannot resolve to a runtime file (would be silently missing from the map). */
export function missingSceneArt(map:StarseaMap){
 const ids=[map.groundResource,...(map.boundary.points?.length?[coastStone(map)]:[]),...map.roads.map(r=>r.resource),...dressingResources(map)].filter(id=>!(starseaAsset(id)?.runtime as {file?:string}|undefined)?.file);
 for(const piece of islandEdges(map))if(!sprite(piece))ids.push(piece.resourceId+(piece.variant?'#'+piece.variant:''));
 for(const d of [...map.decorations,...mapScatter(map)])if(!sprite(d))ids.push(d.resourceId);
 return [...new Set(ids)];
}
