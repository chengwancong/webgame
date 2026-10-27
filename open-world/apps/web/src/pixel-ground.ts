import {pixelAsset,loadPixelImage} from './pixel-assets.ts';
import {classifyTerrain,terrainTag,type TerrainBank} from './pixel-terrain.ts';
const decoded=new Map<string,HTMLCanvasElement>(),pending=new Set<string>(),waiters=new Map<string,Set<()=>void>>();
const native=new Map<string,{data:Uint8ClampedArray;width:number}>(),averages=new WeakMap<object,[number,number,number]>();
/** A 32-stage-pixel cell can use either a legacy 16px or fine 32px native tile. */
export function pixelGroundMaterial(file:string,onReady:()=>void):HTMLCanvasElement|undefined{
 const asset=pixelAsset(file);if(!asset||asset.kind!=='tiles')return;
 const existing=decoded.get(asset.file);if(existing)return existing;
 const callbacks=waiters.get(asset.file)??new Set<()=>void>();callbacks.add(onReady);waiters.set(asset.file,callbacks);
 if(!pending.has(asset.file)){
  pending.add(asset.file);void loadPixelImage(asset).then(image=>{
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
   const cell=asset.frame[0];ctx.drawImage(image,15*cell,0,cell,cell,0,0,32,32);decoded.set(asset.file,canvas);
   const raw=document.createElement('canvas');raw.width=image.naturalWidth;raw.height=image.naturalHeight;const r=raw.getContext('2d')!;r.drawImage(image,0,0);native.set(asset.file,{data:r.getImageData(0,0,raw.width,raw.height).data,width:raw.width});
   for(const ready of waiters.get(asset.file)??[])ready();waiters.delete(asset.file);
  }).catch(()=>{}).finally(()=>pending.delete(asset.file));
 }return;
}
export function pixelTerrainKey(file:string,key:string){const biome=/frost|tundra|snow/.test(key)?'frost':/rift|abyss/.test(key)?'rift':/forge|ember/.test(key)?'forge':/dragon/.test(key)?'dragon':/mist|forest/.test(key)?'mist':'wind',kind=/wall|rock|cliff|coast/.test(key)?'wall':/road|path|plaza/.test(key)?'cobble':/water|sea/.test(key)?'water':'grass';return pixelAsset(key)?.kind==='tiles'?key:pixelAsset(file)?.kind==='tiles'?file:`terrain:${biome}:${kind}`;}
export function pixelTerrainBank(file:string,reference:CanvasImageSource,key:string,index:number,onReady:()=>void):TerrainBank|undefined{
 const lookup=pixelTerrainKey(file,key),asset=pixelAsset(lookup);if(asset?.kind!=='tiles')return;pixelGroundMaterial(lookup,onReady);const pixels=native.get(asset.file);if(!pixels)return;
 let average=averages.get(reference as object);if(!average){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d')!;x.drawImage(reference,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>=128){r+=d[i];g+=d[i+1];b+=d[i+2];n++;}average=[r/Math.max(1,n),g/Math.max(1,n),b/Math.max(1,n)];averages.set(reference as object,average);}
 return {key,reference:average,tag:terrainTag(index),pixels:pixels.data,width:pixels.width,tileSize:asset.frame[0],ramp:(asset.terrain?.ramp??[]).map(c=>parseInt(c.slice(1),16))};
}
export function terrainTagCanvas(bank:TerrainBank){const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const x=canvas.getContext('2d')!;x.fillStyle=`rgb(${bank.tag.join(',')})`;x.fillRect(0,0,1,1);return canvas;}
export function* bakePixelGround(source:HTMLCanvasElement,banks:TerrainBank[],worldX:number,worldY:number,map:string,tags?:HTMLCanvasElement):Generator<void,{canvas:HTMLCanvasElement;x:number;y:number;scale:1|2}>{
 const input=source.getContext('2d')!.getImageData(0,0,source.width,source.height),mask=tags?.getContext('2d')!.getImageData(0,0,tags.width,tags.height).data;
 const result=yield* classifyTerrain(input,banks,{worldX,worldY,map,tags:mask,scale:1}),canvas=document.createElement('canvas');canvas.width=result.width;canvas.height=result.height;canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(result.data),result.width,result.height),0,0);return {canvas,x:result.worldX,y:result.worldY,scale:result.scale};
}
