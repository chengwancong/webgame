import {islandOutline} from '../island-edge.ts';
import {starseaAsset} from '../starsea-runtime-assets.ts';
const markerImages=new Map<string,HTMLImageElement>();
import type {World} from '../../../../packages/simulation/index.ts';
import {project,type IsoPoint} from '../iso.ts';
import {minimapTerrain,minimapNpcs,requestMinimapMap,type MapMarker} from './minimap-data.ts';
import {resolvedToken} from './tokens.ts';
export type {MapMarker} from './minimap-data.ts';
import type {FieldMapView} from '../field-controller.ts';
import {decodeExploration,explorationGrid,exploredAt} from '../../../../packages/rules/exploration.ts';
import {stageLayout,STAGE} from '../stage.ts';
import {artColor,minimapArtFiles} from './minimap-art.ts';
import {paintSceneMiniature} from './minimap-scene.ts';
import {fieldMaps} from '../../../../packages/content/open-world/index.ts';
import type {StarseaMap} from '../starsea-world-renderer.ts';
const ink=(name:Parameters<typeof resolvedToken>[0])=>resolvedToken(name);
export type MapProjection={scale:number;x:number;y:number;width:number;height:number;padding:number};
export const mapCorners=(width:number,height:number)=>[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
export function minimapBounds(width:number,height:number){
 const corners=mapCorners(width,height).map(project);return {minX:Math.min(...corners.map(p=>p.x)),maxX:Math.max(...corners.map(p=>p.x)),minY:Math.min(...corners.map(p=>p.y)),maxY:Math.max(...corners.map(p=>p.y))};
}
export function minimapHeight(width:number,height:number,size=320,padding=8){
 const b=minimapBounds(width,height);return Math.ceil((size-padding*2)*(b.maxY-b.minY)/(b.maxX-b.minX)+padding*2);
}
export function minimapProjection(width:number,height:number,size=320,padding=8,canvasHeight=minimapHeight(width,height,size,padding)):MapProjection{
 const b=minimapBounds(width,height),scale=Math.min((size-padding*2)/(b.maxX-b.minX),(canvasHeight-padding*2)/(b.maxY-b.minY));
 return {scale,x:size/2-(b.minX+b.maxX)/2*scale,y:canvasHeight/2-(b.minY+b.maxY)/2*scale,width:size,height:canvasHeight,padding};
}
/** Half the stage width in cells, so the radar reaches as far sideways as the main view does. */
export const RADAR_RADIUS_CELLS=Math.round(STAGE.width/2/(32*Math.SQRT2));
export const RADAR_ZOOMS=[.75,1,1.5] as const;
export const radarRadius=(zoom:number)=>RADAR_RADIUS_CELLS/zoom;
const hexRgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mixHex=(a:number[],b:number[],t:number)=>'#'+a.map((v,i)=>Math.round(v*(1-t)+b[i]*t).toString(16).padStart(2,'0')).join('');
/** Real texture average first; the sand token only covers the moment before the image has loaded. */
export function minimapGround(region:{theme:string;presentationKey?:string},map?:StarseaMap){
 const color=artColor(minimapArtFiles(region,map).ground);if(!color)return ink('Color.Minimap.Terrain');
 return mixHex(hexRgb(color),[255,255,255],.12);
}
const heroTrail=new WeakMap<HTMLCanvasElement,{x:number;y:number;a:number}>();
/** 地面平均色的相对亮度超过 0.55 时返回正片叠底的不透明度（0～0.45），暗底岛返回 0。 */
export function minimapExposureShade(hex?:string){
 if(!hex||!/^#[0-9a-f]{6}$/i.test(hex))return 0;const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),l=.2126*v[0]+.7152*v[1]+.0722*v[2];
 return l<=.55?0:Math.min(.45,(l-.55)*1.6+.12);
}
export function radarProjection(hero:IsoPoint,size=192,radius=RADAR_RADIUS_CELLS,padding=2):MapProjection{
 const center=project(hero),scale=(size/2-padding)/(radius*32*Math.SQRT2);
 return {scale,x:size/2-center.x*scale,y:size/2-center.y*scale,width:size,height:size,padding};
}
export function minimapPoint(p:IsoPoint,projection:Pick<MapProjection,'x'|'y'|'scale'>){const q=project(p);return {x:projection.x+q.x*projection.scale,y:projection.y+q.y*projection.scale};}

/** Gold ring width of the radar (CSS px); the map is clipped inside it. */
const RING=5;
type Ctx=CanvasRenderingContext2D;
const fullLayers=new WeakMap<HTMLCanvasElement,{key:string;canvas:HTMLCanvasElement}>();
const fogLayers=new WeakMap<HTMLCanvasElement,{key:string;canvas:HTMLCanvasElement}>();
const seeded=(text:string)=>{let seed=[...text].reduce((n,c)=>(n*31+c.charCodeAt(0))%2147483647,7)||7;return ()=>(seed=(seed*16807)%2147483647)/2147483647;};
/** Sea with two dashed surf lines following the coast. */
function paintSea(ctx:Ctx,width:number,height:number,outline:(grow:number)=>void){
 const g=ctx.createLinearGradient(0,0,0,height);g.addColorStop(0,ink('Color.Minimap.SeaLight'));g.addColorStop(1,ink('Color.Minimap.Sea'));ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.strokeStyle=ink('Color.Minimap.Surf');ctx.globalAlpha=.55;ctx.lineWidth=1.2;for(const [grow,dash] of [[6,[6,5]],[14,[3,7]]] as const){ctx.setLineDash([...dash]);outline(grow);ctx.stroke();}ctx.restore();
}
/** Unexplored parchment: soft cloud puffs over the island; explored 8×8 cells are cut out with blurred edges. Cached per explored mask. */
function fogLayer(canvas:HTMLCanvasElement,region:World['region'],projection:MapProjection,field:FieldMapView,density:number,width:number,height:number,outline:(c:Ctx,grow:number)=>void){
 const key=[region.id,width,height,density,field.explored].join('|'),hit=fogLayers.get(canvas);if(hit?.key===key)return hit.canvas;
 const layer=hit?.canvas??document.createElement('canvas');layer.width=Math.round(width*density);layer.height=Math.round(height*density);const f=layer.getContext('2d')!;f.setTransform(density,0,0,density,0,0);f.clearRect(0,0,width,height);
 const cell=projection.scale*32,light=ink('Color.Minimap.FogLight'),shade=ink('Color.Minimap.FogShade');
 f.save();outline(f,2);f.clip();f.fillStyle=ink('Color.Minimap.Fog');f.fillRect(0,0,width,height);
 const rnd=seeded(region.id);f.filter=`blur(${Math.max(3,cell*6)*density}px)`;
 for(let i=0;i<Math.round(region.width*region.height/1900);i++){const p=minimapPoint({x:rnd()*region.width,y:rnd()*region.height},projection),r=(14+rnd()*26)*cell/1.6,lit=rnd()<.5;f.fillStyle=lit?light:shade;f.globalAlpha=lit?.55:.16;f.beginPath();f.ellipse(p.x,p.y,r*1.6,r,0,0,Math.PI*2);f.fill();}
 f.restore();
 const grid=explorationGrid(region.width,region.height);let bits:Uint8Array;try{bits=decodeExploration(field.explored,grid.bytes);}catch{bits=new Uint8Array(grid.bytes);}
 f.globalCompositeOperation='destination-out';f.filter=`blur(${Math.max(2,cell*5)*density}px)`;f.fillStyle='#000';
 f.setTransform(density*projection.scale*32,density*projection.scale*18,-density*projection.scale*32,density*projection.scale*18,density*projection.x,density*projection.y);
 for(let i=0;i<grid.columns*grid.rows;i++)if(bits[i>>>3]&(1<<(i&7)))f.fillRect((i%grid.columns)*8-1,Math.floor(i/grid.columns)*8-1,10,10);
 f.filter='none';f.globalCompositeOperation='source-over';fogLayers.set(canvas,{key,canvas:layer});return layer;
}
/** Map pin (tip on the point) with a white glyph. */
function pin(ctx:Ctx,x:number,y:number,color:string,glyph:string,r=6.5){
 ctx.save();ctx.translate(x,y);ctx.fillStyle=ink('Color.Minimap.FrameInk');ctx.globalAlpha=.3;ctx.beginPath();ctx.ellipse(0,1,r*.6,r*.25,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
 ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-r*.6,-r*.8,-r,-r*1.2,-r,-r*1.75);ctx.arc(0,-r*1.75,r,Math.PI,0);ctx.bezierCurveTo(r,-r*1.2,r*.6,-r*.8,0,0);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=ink('Color.Minimap.Background');ctx.stroke();
 ctx.fillStyle=ink('Color.Minimap.Background');ctx.font=`700 ${Math.round(r*1.3)}px ${ink('Font.Family')}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,0,-r*1.7);ctx.restore();
}
function diamondMark(ctx:Ctx,x:number,y:number,r:number,fill:string,stroke:string){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.8,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.8,y);ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}
/** Gold ring with an inner shade and four ivory ticks (no north marker: the radar keeps the scene's orientation). */
function radarFrame(ctx:Ctx,size:number){
 const c=size/2,r=c-RING,shade=ctx.createRadialGradient(c,c,r*.62,c,c,r);shade.addColorStop(0,'transparent');shade.addColorStop(1,ink('Color.Minimap.FrameInk'));
 ctx.save();ctx.globalAlpha=.3;ctx.fillStyle=shade;ctx.beginPath();ctx.arc(c,c,r,0,Math.PI*2);ctx.fill();ctx.restore();
 const gold=ctx.createLinearGradient(0,0,0,size);gold.addColorStop(0,ink('Color.Minimap.FrameLight'));gold.addColorStop(.5,ink('Color.Minimap.Frame'));gold.addColorStop(1,ink('Color.Minimap.FrameShade'));
 ctx.lineWidth=RING;ctx.strokeStyle=gold;ctx.beginPath();ctx.arc(c,c,r+RING/2-.5,0,Math.PI*2);ctx.stroke();
 ctx.save();ctx.lineWidth=.8;ctx.strokeStyle=ink('Color.Minimap.FrameInk');ctx.globalAlpha=.7;ctx.beginPath();ctx.arc(c,c,r-.4,0,Math.PI*2);ctx.stroke();ctx.restore();
 for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.save();ctx.translate(c+Math.cos(a)*(r+RING/2),c+Math.sin(a)*(r+RING/2));ctx.rotate(a+Math.PI/2);ctx.beginPath();ctx.moveTo(0,-3.5);ctx.lineTo(2.5,0);ctx.lineTo(0,3.5);ctx.lineTo(-2.5,0);ctx.closePath();ctx.fillStyle=ink('Color.Minimap.Background');ctx.fill();ctx.strokeStyle=ink('Color.Minimap.FrameShade');ctx.lineWidth=.8;ctx.stroke();ctx.restore();}
}
function fullFrame(ctx:Ctx,width:number,height:number){
 ctx.lineWidth=3;ctx.strokeStyle=ink('Color.Minimap.Frame');ctx.beginPath();ctx.roundRect(1.5,1.5,width-3,height-3,10);ctx.stroke();
 ctx.save();ctx.lineWidth=1;ctx.strokeStyle=ink('Color.Minimap.Background');ctx.globalAlpha=.9;ctx.beginPath();ctx.roundRect(5,5,width-10,height-10,7);ctx.stroke();ctx.restore();
}

const radarLayers=new WeakMap<HTMLCanvasElement,{key:string;at:number;canvas:HTMLCanvasElement;left:number;top:number;width:number;height:number}>();
/** The radar miniature only depends on map, zoom and density, so the whole island is painted once at that scale and slid under the hero.
 * Re-running the ground dressing (blur passes) and every sprite on each HUD tick made the client stutter (2026-10-11).
 * An incomplete paint (art still decoding) is retried at most once a second. Layers stay under ~16M device pixels. */
function radarLayer(owner:HTMLCanvasElement,map:StarseaMap,scale:number,density:number){
 const b=minimapBounds(map.width,map.height),margin=Math.max(24,400*scale),left=b.minX*scale-margin,top=b.minY*scale-margin,width=(b.maxX-b.minX)*scale+margin*2,height=(b.maxY-b.minY)*scale+margin*2;
 const d=Math.min(density,Math.sqrt(16e6/(width*height))),key=[map.id,scale,d].join('|'),hit=radarLayers.get(owner),now=performance.now();
 if(hit&&(hit.key===key||hit.key==='~'+key&&now-hit.at<1000))return hit;
 const canvas=hit?.canvas??document.createElement('canvas');canvas.width=Math.ceil(width*d);canvas.height=Math.ceil(height*d);
 const r=paintSceneMiniature(canvas.getContext('2d')!,map,{k:scale,ox:-left,oy:-top,density:d,width,height,minSpriteScale:0});if(!r.painted)return;
 const layer={key:(r.complete?'':'~')+key,at:now,canvas,left,top,width,height};radarLayers.set(owner,layer);return layer;
}

export function paintMinimap(canvas:HTMLCanvasElement,world:World,options:{mode?:'radar'|'full';size?:number;radius?:number;npcs?:MapMarker[];field?:FieldMapView}={}){
 const full=options.mode==='full',region=world.region,size=options.size??(canvas.clientWidth||(full?320:192)),pad=full?18:8,height=full?minimapHeight(region.width,region.height,size,pad):size;
 const density=Math.min(3,Math.ceil(Math.max(window.devicePixelRatio||1,stageLayout().render))),pixelWidth=Math.round(size*density),pixelHeight=Math.round(height*density);
 if(canvas.width!==pixelWidth||canvas.height!==pixelHeight){canvas.width=pixelWidth;canvas.height=pixelHeight;}
 const projection=full?minimapProjection(region.width,region.height,size,pad,height):radarProjection(world.hero.position,size,options.radius,RING),{scale}=projection;
 // Same source as the scene (main.ts bridge.worldMap): produced islands carry their sealed map in fieldMaps.
 const fieldMap=fieldMaps[region.id] as StarseaMap|undefined,state=!fieldMap&&region.presentationKey?.startsWith('ss-map-')?requestMinimapMap(region.presentationKey):undefined,map=fieldMap??state?.map,terrain=minimapTerrain(region,map);
 const supplied=options.npcs??[],npcs=fieldMap?supplied:state?.map?minimapNpcs(state.npcs,options.npcs):state?[]:supplied;
 canvas.dataset.mapMode=full?'full':'radar';canvas.dataset.mapSource=terrain.source;canvas.dataset.regionId=region.id;
 canvas.dataset.centerX=String(world.hero.position.x);canvas.dataset.centerY=String(world.hero.position.y);
 const ctx=canvas.getContext('2d')!;ctx.setTransform(density,0,0,density,0,0);ctx.clearRect(0,0,size,height);
 const point=(x:number,y:number)=>minimapPoint({x,y},projection);
 // Produced islands are a round coast inside the square map: sea, surf, fog and markers follow the coast, not the square.
 const coast=map?.boundary.points?.length?islandOutline(map):undefined,centre=coast&&{x:coast.reduce((n,p)=>n+p.x,0)/coast.length,y:coast.reduce((n,p)=>n+p.y,0)/coast.length};
 const shape=(grow:number)=>coast&&centre?coast.map(p=>{const d=Math.hypot(p.x-centre.x,p.y-centre.y)||1;return {x:p.x+(p.x-centre.x)/d*grow,y:p.y+(p.y-centre.y)/d*grow};}):[{x:-grow,y:-grow},{x:region.width+grow,y:-grow},{x:region.width+grow,y:region.height+grow},{x:-grow,y:region.height+grow}];
 const outline=(c:Ctx,grow=0)=>{c.beginPath();shape(grow).forEach((p,i)=>{const q=minimapPoint(p,projection);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();};
 const polygon=()=>outline(ctx);
 ctx.save();ctx.beginPath();if(full)ctx.roundRect(1,1,size-2,height-2,10);else ctx.arc(size/2,size/2,size/2-RING,0,Math.PI*2);ctx.clip();
 if(terrain.source==='loading'){ctx.fillStyle=ink('Color.Minimap.Sea');ctx.fillRect(0,0,size,height);}else paintSea(ctx,size,height,grow=>outline(ctx,grow));
 // Direction A (2026-10-11): sealed maps show the real scene in miniature; the region map caches that static layer.
 let scene=false;
 if(map&&terrain.source==='starsea'){
  const view={k:scale,ox:projection.x,oy:projection.y,density,width:size,height,minSpriteScale:full?9/140:0};
  if(full){const key=[map.id,pixelWidth,pixelHeight].join('|'),hit=fullLayers.get(canvas);
   if(hit?.key===key){ctx.drawImage(hit.canvas,0,0,size,height);scene=true;}
   else{const layer=hit?.canvas??document.createElement('canvas');layer.width=pixelWidth;layer.height=pixelHeight;const r=paintSceneMiniature(layer.getContext('2d')!,map,view);
    if(r.painted){ctx.drawImage(layer,0,0,size,height);scene=true;fullLayers.set(canvas,{key:r.complete?key:'',canvas:layer});}}
  }else{const layer=radarLayer(canvas,map,scale,density);if(layer){ctx.drawImage(layer.canvas,Math.round((projection.x+layer.left)*density)/density,Math.round((projection.y+layer.top)*density)/density,layer.width,layer.height);scene=true;}}
  ctx.setTransform(density,0,0,density,0,0);
 }
 // 亮底岛（赤炉沙地、霜镜雪地）缩成小图后发白：按地面平均亮度压一层正片叠底，只罩岛内（Grok：小地图过曝）。
 const shade=scene?minimapExposureShade(artColor(minimapArtFiles(region,map).ground)):0;
 if(shade>0){ctx.save();polygon();ctx.clip();ctx.globalCompositeOperation='multiply';ctx.fillStyle=`rgba(96,88,80,${shade})`;ctx.fillRect(0,0,size,height);ctx.restore();}
 // Flat fallback: regions without a sealed map, or the moment before the ground material decodes.
 if(!scene&&terrain.source!=='loading'){
  const files=minimapArtFiles(region,map),roadColor=artColor(files.road),cliffColor=artColor(files.cliff);
  ctx.save();polygon();ctx.clip();ctx.fillStyle=minimapGround(region,map);ctx.fill();
  // All ground geometry is in world cells; icons below use a uniform screen transform.
  ctx.setTransform(density*scale*32,density*scale*18,-density*scale*32,density*scale*18,density*projection.x,density*projection.y);
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const [width,color] of [[2.75,roadColor?mixHex(hexRgb(roadColor),[0,0,0],.3):ink('Color.Minimap.RoadEdge')],[2.2,roadColor??ink('Color.Minimap.Road')]] as const){
   ctx.strokeStyle=color;ctx.lineWidth=width;
   for(const route of terrain.roads){ctx.beginPath();route.forEach((p,i)=>{i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();}
  }
  ctx.fillStyle=roadColor??ink('Color.Minimap.Road');for(const p of terrain.roadCells)ctx.fillRect(p.x-.5,p.y-.5,1,1);
  ctx.fillStyle=ink('Color.Minimap.Obstacle');ctx.strokeStyle=ink('Color.Minimap.ObstacleEdge');ctx.lineWidth=.14;for(const o of terrain.obstacles){const sealed=terrain.source==='starsea',x=sealed?o.x-o.w/2:o.x,y=sealed?o.y-o.h/2:o.y;ctx.fillRect(x,y,o.w,o.h);ctx.strokeRect(x,y,o.w,o.h);}
  ctx.restore();polygon();ctx.strokeStyle=cliffColor?mixHex(hexRgb(cliffColor),[0,0,0],.15):ink('Color.Minimap.Cliff');ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.stroke();
 }
 // Field maps: unexplored 8×8 cells stay under fog on the full map (expansion plan §3.6).
 if(full&&options.field&&terrain.source!=='loading'){ctx.globalAlpha=.94;ctx.drawImage(fogLayer(canvas,region,projection,options.field,density,size,height,outline),0,0,size,height);ctx.globalAlpha=1;}
 // Keep markers upright and at constant CSS sizes, while clipping to the real map.
 ctx.save();outline(ctx,4);ctx.clip();
 const circle=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);};
 const bg=ink('Color.Minimap.Background');
 const portals=[region.portal,...(region.bossPortal?[region.bossPortal]:[])];
 const landmarks=terrain.source==='loading'?[]:[...terrain.landmarks.filter(l=>!portals.some(p=>p.x===l.x&&p.y===l.y)&&!npcs.some(n=>n.x===l.x&&n.y===l.y)),{...region.portal,kind:'portal'},...(region.bossPortal?[{...region.bossPortal,kind:'boss'}]:[])];
 for(const landmark of landmarks){const p=point(landmark.x,landmark.y);
  if(landmark.kind==='landmark'){if(full&&options.field&&!exploredAt(options.field.explored,region.width,region.height,landmark))continue;ctx.fillStyle=ink('Color.Minimap.Landmark');ctx.strokeStyle=bg;ctx.lineWidth=1;circle(p.x,p.y,2.2);ctx.fill();ctx.stroke();}
  else if(landmark.kind==='boss')pin(ctx,p.x,p.y,ink('Color.Minimap.Boss'),'☠');
  else if(['portal','next'].includes(landmark.kind))diamondMark(ctx,p.x,p.y,5.5,ink('Color.Minimap.Portal'),bg);
  else if(landmark.kind==='forge'){ctx.fillStyle=ink('Color.Minimap.Landmark');ctx.fillRect(p.x-4,p.y-2,8,3);ctx.fillRect(p.x-2,p.y+1,4,3);}
  else if(landmark.kind==='safe'){ctx.fillStyle=ink('Color.Minimap.Safe');ctx.strokeStyle=ink('Color.Minimap.FrameShade');ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(p.x-3.5,p.y-3,7,6,1.5);ctx.fill();ctx.stroke();}
 }
 for(const waypoint of options.field?.waypoints??[]){const p=point(waypoint.x,waypoint.y);diamondMark(ctx,p.x,p.y,full?5:4.5,ink(waypoint.unlocked?'Color.Minimap.Portal':'Color.Minimap.Background'),ink(waypoint.unlocked?'Color.Minimap.Background':'Color.Minimap.Portal'));}
 for(const enemy of world.enemies){if(!enemy.alive)continue;const p=point(enemy.position.x,enemy.position.y);
  ctx.globalAlpha=enemy.boss||enemy.elite||full?1:Math.max(.45,1-Math.hypot(p.x-size/2,p.y-size/2)/size);
  if(enemy.boss)diamondMark(ctx,p.x,p.y,5,ink('Color.Minimap.Boss'),bg);
  else if(enemy.elite){ctx.beginPath();ctx.moveTo(p.x,p.y-4.5);ctx.lineTo(p.x+4,p.y+3);ctx.lineTo(p.x-4,p.y+3);ctx.closePath();ctx.fillStyle=ink('Color.Minimap.Enemy');ctx.fill();ctx.strokeStyle=ink('Color.Minimap.EliteEdge');ctx.lineWidth=1.3;ctx.stroke();}
  else{ctx.fillStyle=ink('Color.Minimap.Enemy');ctx.strokeStyle=ink('Color.Minimap.EnemyEdge');ctx.lineWidth=.9;circle(p.x,p.y,2.4);ctx.fill();ctx.stroke();}
  ctx.globalAlpha=1;
 }
 for(const npc of npcs){const p=point(npc.x,npc.y);if(npc.resource){const asset=starseaAsset(npc.resource),file=asset?.runtime.file;if(file&&/\.(png|svg|webp)$/.test(file)){let image=markerImages.get(file);if(!image){image=new Image();image.src=file;markerImages.set(file,image);}if(image.complete&&image.naturalWidth){const size=full?16:12;ctx.drawImage(image,p.x-size/2,p.y-size/2,size,size);continue;}}}
  if(npc.question){pin(ctx,p.x,p.y,ink('Color.Minimap.Portal'),'?',full?6:5.5);continue;}
  if(npc.main){pin(ctx,p.x,p.y,ink('Color.Minimap.Quest'),'!',full?7:6.5);continue;}
  ctx.fillStyle=ink('Color.Minimap.Roof');ctx.strokeStyle=bg;ctx.lineWidth=1.5;circle(p.x,p.y,3.2);ctx.fill();ctx.stroke();}
 // Hero chevron along the last real movement (hero.facing is only left/right); standing still keeps the previous heading.
 const hero=point(world.hero.position.x,world.hero.position.y),hp=world.hero.position,trail=heroTrail.get(canvas);let heading=trail?.a??Math.PI/2;
 if(!trail||Math.hypot(hp.x-trail.x,hp.y-trail.y)>.15){if(trail){const d=project({x:hp.x-trail.x,y:hp.y-trail.y});heading=Math.atan2(d.y,d.x);}heroTrail.set(canvas,{x:hp.x,y:hp.y,a:heading});}
 ctx.save();ctx.translate(hero.x,hero.y);
 if(!full){const reach=size*.22,cone=ctx.createRadialGradient(0,0,4,0,0,reach);cone.addColorStop(0,ink('Color.Minimap.Surf'));cone.addColorStop(1,'transparent');ctx.globalAlpha=.35;ctx.fillStyle=cone;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,reach,heading-.6,heading+.6);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
 ctx.rotate(heading);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5.5,6);ctx.lineTo(-2.5,0);ctx.lineTo(-5.5,-6);ctx.closePath();ctx.lineJoin='round';ctx.lineWidth=2;ctx.strokeStyle=bg;ctx.stroke();ctx.fillStyle=ink('Color.Minimap.Hero');ctx.fill();ctx.restore();
 ctx.restore();
 // Quest direction: when the nearest objective is outside the circle, point at it from the rim (no path line).
 if(!full){const goal=npcs.filter(n=>n.main&&!n.question).map(n=>{const p=point(n.x,n.y);return {p,d:Math.hypot(p.x-size/2,p.y-size/2)};}).sort((a,b)=>a.d-b.d)[0];
  if(goal&&goal.d>size/2-RING-8){const a=Math.atan2(goal.p.y-size/2,goal.p.x-size/2),r=size/2-RING-7,cx=size/2+Math.cos(a)*r,cy=size/2+Math.sin(a)*r,t=(k:number,o:number)=>[cx+Math.cos(a+o)*k,cy+Math.sin(a+o)*k] as const;
   ctx.beginPath();ctx.moveTo(...t(7,0));ctx.lineTo(...t(6,2.5));ctx.lineTo(...t(6,-2.5));ctx.closePath();ctx.fillStyle=ink('Color.Minimap.Quest');ctx.strokeStyle=bg;ctx.lineWidth=1.6;ctx.stroke();ctx.fill();}}
 ctx.restore();
 if(full)fullFrame(ctx,size,height);else radarFrame(ctx,size);
}
