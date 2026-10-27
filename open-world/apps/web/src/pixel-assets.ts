/** Authored native-resolution art. No source-image conversion belongs in this module. */
export type PixelPoint=[number,number];
export type PixelAction={row:number;count:number;duration:number;sourceDuration?:number;impactTime:number;impactFrame:number;frameTimes:number[];sockets:Record<string,PixelPoint>[];poses?:number[];overlayRow?:number;loop?:boolean};
export type PixelAsset={file:string;original:string[];batch:string;kind:'image'|'actor'|'tiles';frame:[number,number];anchor:PixelPoint;scale:2;small?:string;shadow?:boolean;role?:'ordinary'|'elite'|'boss';bodyHeight?:number;displayHeight?:number;baseOrigin?:PixelPoint;defaultFrame?:string;imageSize?:[number,number];sourceFrames?:Record<string,{x:number;y:number;w:number;h:number}>;terrain?:{kind:string;ramp:string[]};actions?:Record<string,PixelAction>;frames?:Record<string,{x:number;y:number;w:number;h:number}>;layers?:string[];variants?:{maxWidth:number;key:string}[];sockets?:Record<string,PixelPoint>;provenance:{method:'authored-pixels'|'adapted-pixels';upstream?:{package:string;author:string;license:'CC0-1.0';url:string;file:string;sourceSha256:string;archiveSha256:string;modifications:string[]};recipe:string;reviewed:boolean};sha256:string};
export type PixelOutfit={cloth:string[];hair:string[];overlay?:string};
export type PixelManifest={schemaVersion:1;stage:[1280,720];canvas:[640,360];palette:string;assets:Record<string,PixelAsset>;appearances?:Record<string,PixelOutfit>;metadataFiles?:string[]};
let manifest:PixelManifest|undefined,pending:Promise<PixelManifest>|undefined;
const images=new Map<string,Promise<HTMLImageElement>>();
const byOriginal=new Map<string,PixelAsset>();
const byFrame=new Map<string,PixelAsset>();
export function pixelAsset(key:string){return manifest?.assets[key]??byOriginal.get(key);}
export function pixelAssetForFrame(source:string,frame:string){return byFrame.get(source+'#'+frame);}
export function pixelOutfit(key:string){return manifest?.appearances?.[key];}
export function pixelActorHeight(key:string,elite=false){const a=(elite&&pixelAsset(key+':elite'))||pixelAsset(key);return a?.displayHeight;}
export async function loadPixelManifest(){
 if(manifest)return manifest;
 if(!pending)pending=fetch('/art-pixel/manifest.json').then(async r=>{if(!r.ok)throw Error(`Pixel manifest HTTP ${r.status}`);const value=await r.json() as PixelManifest;if(value.schemaVersion!==1||value.canvas?.[0]!==640||value.canvas?.[1]!==360||!value.assets)throw Error('Invalid pixel manifest');manifest=value;for(const asset of Object.values(value.assets))for(const source of asset.original){if(!byOriginal.has(source))byOriginal.set(source,asset);if(source.includes('#'))byFrame.set(source,asset);for(const frame of Object.keys(asset.frames??{}))if(!byFrame.has(source+'#'+frame))byFrame.set(source+'#'+frame,asset);}return value;}).catch(e=>{pending=undefined;throw e;});
 return pending;
}
export function loadPixelImage(asset:PixelAsset){
 let pending=images.get(asset.file);if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error(`Pixel art decode failed: ${asset.file}`));image.src=asset.file;}).catch(e=>{images.delete(asset.file);throw e;});images.set(asset.file,pending);}return pending;
}
/** Map cast release exactly onto authored impact time, without changing simulation time. */
export function pixelFrameIndex(action:PixelAction,clock:number,loop:boolean,cast?:{elapsed:number;windup:number;recovery:number}){
 let time=clock;
 if(cast)time=cast.elapsed<=cast.windup?action.impactTime*Math.max(0,cast.elapsed)/Math.max(.000001,cast.windup):action.impactTime+(action.duration-action.impactTime)*Math.min(1,(cast.elapsed-cast.windup)/Math.max(.000001,cast.recovery));
 else if(loop)time=((time%action.duration)+action.duration)%action.duration;
 let index=0;while(index+1<action.count&&action.frameTimes[index+1]<=time+1e-7)index++;return index;
}
export function pixelSocket(point:PixelPoint,anchor:PixelPoint,foot:PixelPoint,scale:number,mirror:boolean):PixelPoint{
 return [foot[0]+(point[0]-anchor[0])*scale*(mirror?-1:1),foot[1]+(point[1]-anchor[1])*scale];
}
/** Preserve a state's explicit lift (port signs use origins greater than 1). */
export function pixelObjectOrigin(asset:PixelAsset,origin:PixelPoint,display:PixelPoint):PixelPoint{
 return asset.anchor.map((a,i)=>a/asset.frame[i]+(asset.baseOrigin?(origin[i]-asset.baseOrigin[i])*display[i]/(asset.frame[i]*2):0)) as PixelPoint;
}
