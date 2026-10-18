import {fiveIslandMaterialTexture} from './open-world-five-runtime.ts';
import type {WorldPhaseView} from '../../../packages/contracts/open-world.ts';
import Phaser from 'phaser';
import {starseaAsset,starseaJSON,starseaTexture,type RuntimeAsset} from './starsea-runtime-assets.ts';
import type {Point} from './starsea-assets.ts';
import {project} from './iso.ts';
import {visibleWorldChunks,chunkKey,chunkViewDistance,cameraView,screenOrigin} from './world-chunks.ts';
import {coastStone,islandEdges,islandPath,paintCoastSkirt,type EdgePiece,type IslandBoundary} from './island-edge.ts';
import {mapScatter,paintGroundDressing,type Dressing} from './world-dressing.ts';
export type StarseaMap={id:string;name:string;width:number;height:number;groundResource:string;backdropResource:string;landmarks:{id:string;x:number;y:number}[];roads:{resource:string;widthCells:number;points:[number,number][];tint?:string;wash?:{color:string;alpha:number}}[];decorations:{id:string;phaseTable?:'landmarks';resourceId:string;x:number;y:number;variant?:string;displayWidth?:number;depthMode:string;occlusion?:string;mirrorX?:boolean;tint?:string}[];boundary:IslandBoundary;groundZones?:{resource:string}[];dressing?:Dressing};
export function loadStarseaMap(id:string){const asset=starseaAsset(id);if(asset?.runtime.kind!=='map'||!asset.runtime.file)return Promise.reject(Error('Unregistered starsea map '+id));return starseaJSON<StarseaMap>(asset.runtime.file);}
type Node={id:string;phaseTable?:'landmarks';image:Phaser.GameObjects.Image;foreground:boolean};
const groundPadding=1,groundWidth=2178,groundHeight=1226,groundLeft=1089,groundTop=37;
/** Presentation consumes the sealed map; collision stays in the shared Region/navigation model. */
export class StarseaWorldRenderer{
 private map?:StarseaMap;private chunks=new Map<string,{image:Phaser.GameObjects.Image;key:string;canvas:HTMLCanvasElement}>();private decorations=new Map<string,Node[]>();private decorationSource=new Map<string,StarseaMap['decorations']>();private edgeSource=new Map<string,EdgePiece[]>();private edges=new Map<string,Phaser.GameObjects.Image[]>();private sky?:Phaser.GameObjects.Image;
 private pendingChunks=0;private chunkMs:number[]=[];
 private materials=new Map<string,HTMLCanvasElement>();private destroyed=false;private errors:string[]=[];
 constructor(private scene:Phaser.Scene,readonly mapId:string,source?:StarseaMap){void (source?Promise.resolve(source):loadStarseaMap(mapId)).then(map=>{if(this.destroyed)return;if(map.id!==mapId)throw Error('Map identity differs '+mapId);this.map=map;this.createLayers(map);}).catch(error=>{if(!this.destroyed){this.errors.push(String(error));console.error('[starsea-world]',error);}});}
 private imageSource(file:string){const key=starseaTexture(file);if(!this.scene.textures.exists(key))throw Error('Unloaded starsea texture '+file);return this.scene.textures.get(key).getSourceImage() as HTMLImageElement;}
 private createLayers(map:StarseaMap){
  const sky=starseaAsset(map.backdropResource);if(!sky?.runtime.file)throw Error('Map sky missing '+map.id);this.sky=this.scene.add.image(0,0,starseaTexture(sky.runtime.file)).setOrigin(0).setScrollFactor(0).setDepth(-20000);
  // Scatter is derived from the sealed map's dressing block (non-blocking, clear of play points), binned like authored decorations.
  for(const decoration of [...map.decorations,...mapScatter(map)]){const key=chunkKey(decoration),bucket=this.decorationSource.get(key)??[];bucket.push(decoration);this.decorationSource.set(key,bucket);}
  const edge=(d:EdgePiece)=>{const key=chunkKey(d),bucket=this.edgeSource.get(key)??[];bucket.push(d);this.edgeSource.set(key,bucket);};
  for(const piece of islandEdges(map))edge(piece);
 }
 private sprite(d:{resourceId:string;x:number;y:number;variant?:string;displayWidth?:number;mirrorX?:boolean;tint?:string}){
  const asset=starseaAsset(d.resourceId);if(!asset?.runtime.file)throw Error('Decoration missing '+d.resourceId);const r=asset.runtime,v=r.variants?.find(v=>v.id===d.variant),file=v?.file??r.file!,p=project(d),anchor=v?.anchor??r.anchor??[.5,1];
  const image=this.scene.add.image(p.x,p.y,((r as any).material?fiveIslandMaterialTexture(this.scene,d.resourceId,starseaTexture):starseaTexture(file))).setOrigin(anchor[0],anchor[1]);image.setScale((d.displayWidth??v?.displayWidth??r.displayWidth??180)/image.width).setFlipX(d.mirrorX??v?.mirrorX??false);if(d.tint)image.setTint(parseInt(d.tint.slice(1),16));return image;
 }
 private material(asset:RuntimeAsset,tint?:string,washOverride?:{color:string;alpha:number},plain=false){
  const r=asset.runtime,file=r.file!,wash=washOverride??r.wash,size=r.tileSize??512,key=JSON.stringify([file,tint??r.tint,wash,size,plain]);let tile=this.materials.get(key);if(tile)return tile;
  const image=this.imageSource(file);tile=document.createElement('canvas');tile.width=size*2;tile.height=size*2;const ctx=tile.getContext('2d')!;
  for(let x=0;x<2;x++)for(let y=0;y<2;y++){ctx.save();if(plain)ctx.translate(x*size,y*size);else{ctx.translate(x?size*2:0,y?size*2:0);ctx.scale(x?-1:1,y?-1:1);}ctx.drawImage(image,0,0,size,size);ctx.restore();}
  if(tint??r.tint){ctx.globalCompositeOperation='multiply';ctx.fillStyle=tint??r.tint!;ctx.fillRect(0,0,tile.width,tile.height);ctx.globalCompositeOperation='source-over';}
  if(wash){ctx.globalAlpha=wash.alpha;ctx.fillStyle=wash.color;ctx.fillRect(0,0,tile.width,tile.height);ctx.globalAlpha=1;}this.materials.set(key,tile);return tile;
 }
 private rock(map:StarseaMap){const asset=starseaAsset(coastStone(map));if(!asset)throw Error('Coast stone missing '+map.id);return this.material(asset);}
 private rect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].forEach(([px,py],i)=>{const p=project({x:px,y:py});i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();}
 private chunk(cx:number,cy:number){
  const map=this.map!,key=`ss-ground:${map.id}:${cx}:${cy}`,canvas=document.createElement('canvas');canvas.width=groundWidth;canvas.height=groundHeight;
  const ctx=canvas.getContext('2d')!,origin=project({x:cx*32,y:cy*32});ctx.translate(groundLeft-origin.x,groundTop-origin.y);
  ctx.beginPath();this.rect(ctx,cx*32-groundPadding,cy*32-groundPadding,32+groundPadding*2,32+groundPadding*2);ctx.clip();if(map.boundary.points?.length)paintCoastSkirt(ctx,map,project,map.boundary.thicknessCells*60,this.rock(map),.5);ctx.clip(islandPath(map,project));
  const ground=starseaAsset(map.groundResource);if(!ground)throw Error('Ground missing '+map.groundResource);ctx.fillStyle=ctx.createPattern(this.material(ground),'repeat')!;ctx.fillRect(-map.height*32,0,(map.width+map.height)*32,(map.width+map.height)*18);
  // Soft patches, trodden rim, roads and settlement cobblestone (world-dressing.ts); chunk overlap is painted identically on both sides.
  const started=performance.now();ctx.setTransform(1,0,0,1,0,0);
  paintGroundDressing(ctx,map,{k:1,ox:groundLeft-origin.x,oy:groundTop-origin.y,width:groundWidth,height:groundHeight,quality:4,blur:2},(resource,tint,wash,plain)=>{const asset=starseaAsset(resource);if(!asset)throw Error('Ground dressing missing '+resource);return this.material(asset,tint,wash,plain);});
  this.chunkMs.push(performance.now()-started);if(this.chunkMs.length>20)this.chunkMs.shift();
  // A plain Texture uploads the finished canvas once. CanvasTexture (including
  // addCanvas) allocates ImageData for pixel access, which ground never needs.
  ctx.setTransform(1,0,0,1,0,0);const texture=this.scene.textures.create(key,canvas,groundWidth,groundHeight);if(!texture)throw Error('Unable to register ground '+key);texture.add('__BASE',0,0,0,groundWidth,groundHeight);const image=this.scene.add.image(origin.x-groundLeft,origin.y-groundTop,key).setOrigin(0).setDepth(-10000);this.chunks.set(`${cx},${cy}`,{image,key,canvas});
 }
 draw(hero:Point,phase?:WorldPhaseView){if(!this.map||this.destroyed)return;const map=this.map,camera=this.scene.cameras.main;const origin=screenOrigin(camera);this.sky?.setPosition(origin.x,origin.y).setDisplaySize(camera.width/camera.zoom,camera.height/camera.zoom);
  const view=cameraView(camera),wanted=visibleWorldChunks(map.width,map.height,view);
  for(const [key,node] of this.chunks)if(!wanted.has(key)){node.image.destroy();this.scene.textures.remove(node.key);node.canvas.width=0;node.canvas.height=0;this.chunks.delete(key);for(const d of this.decorations.get(key)??[])d.image.destroy();this.decorations.delete(key);for(const edge of this.edges.get(key)??[])edge.destroy();this.edges.delete(key);}
  const pending=[...wanted].filter(key=>!this.chunks.has(key)).sort((a,b)=>chunkViewDistance(a,view)-chunkViewDistance(b,view));this.pendingChunks=pending.length;
  // Bound creation work per frame; closest visible ground arrives first.
  for(const key of pending.slice(0,1)){const [x,y]=key.split(',').map(Number);this.chunk(x,y);this.decorations.set(key,(this.decorationSource.get(key)??[]).map(d=>({id:d.id,phaseTable:d.phaseTable,image:this.sprite(d).setDepth(d.depthMode==='ground'?-9999:project(d).y+1),foreground:d.occlusion==='foreground'})));this.edges.set(key,(this.edgeSource.get(key)??[]).map(d=>this.sprite(d).setDepth(-11000)));this.pendingChunks--;}
  const foot=project(hero);for(const bucket of this.decorations.values())for(const node of bucket){node.image.setVisible(!node.phaseTable||Boolean(phase?.[node.phaseTable].includes(node.id)));const hidden=node.foreground&&node.image.depth>foot.y&&node.image.getBounds().contains(foot.x,foot.y-35);node.image.setAlpha(hidden?.42:1);}
 }
 get mapData(){return this.map;}
 diagnostics(){return{map:this.mapId,ready:Boolean(this.map),chunks:this.chunks.size,pendingChunks:this.pendingChunks,textureBytes:this.chunks.size*groundWidth*groundHeight*4,decorations:[...this.decorations.values()].reduce((n,b)=>n+b.length,0),totalDecorations:this.map?.decorations.length??0,boundaryModules:[...this.edges.values()].reduce((n,b)=>n+b.length,0),materials:this.materials.size,dressingMs:this.chunkMs.map(n=>Math.round(n*10)/10),errors:[...this.errors]};}
 destroy(){if(this.destroyed)return;this.destroyed=true;for(const node of this.chunks.values()){node.image.destroy();this.scene.textures.remove(node.key);node.canvas.width=0;node.canvas.height=0;}this.chunks.clear();for(const bucket of this.decorations.values())for(const node of bucket)node.image.destroy();for(const bucket of this.edges.values())for(const node of bucket)node.destroy();this.sky?.destroy();this.materials.clear();this.decorations.clear();this.edges.clear();this.decorationSource.clear();this.edgeSource.clear();}
}
