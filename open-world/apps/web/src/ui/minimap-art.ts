import environment from '../../../../packages/asset-manifest/environment.v2.json';
import type {StarseaMap} from '../starsea-world-renderer.ts';
import {starseaAsset} from '../starsea-runtime-assets.ts';
/** The radar paints with the average colour of the real ground and road textures, so it never disagrees with the scene. */
const averages=new Map<string,string|null>();
const toHex=(v:number)=>Math.round(v).toString(16).padStart(2,'0');
export function artColor(url?:string){
 if(!url)return;const hit=averages.get(url);if(hit!==undefined)return hit??undefined;
 averages.set(url,null);const image=new Image();
 image.onload=()=>{const c=document.createElement('canvas');c.width=c.height=8;const ctx=c.getContext('2d');if(!ctx)return;ctx.drawImage(image,0,0,8,8);
  const d=ctx.getImageData(0,0,8,8).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){const a=d[i+3]/255;if(a<.5)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++;}
  if(n)averages.set(url,'#'+toHex(r/n)+toHex(g/n)+toHex(b/n));};
 image.src=url;
}
const assetFile=(id?:string)=>{const a=id?starseaAsset(id):undefined;return a?.runtime.file??a?.runtime.variants?.[0]?.file;};
/** Ground/road texture files used by the scene for this region; undefined until known. */
export function minimapArtFiles(region:{theme:string;presentationKey?:string},map?:StarseaMap){
 if(map||region.presentationKey?.startsWith('ss-map-'))return {ground:assetFile(map?.groundResource),road:assetFile(map?.roads[0]?.resource),cliff:assetFile(map?.boundary.resourceId)};
 const kind=(environment.groundByTheme as Record<string,string>)[region.theme]??'grass',chapter=environment.chapterGround as Record<string,string>;
 return {ground:kind==='grass'?environment.textures.grass:chapter[kind],road:environment.textures.road,cliff:undefined};
}
