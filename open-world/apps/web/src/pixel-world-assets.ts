import type Phaser from 'phaser';
import {loadPixelManifest,loadPixelImage,pixelAsset,pixelAssetForFrame,type PixelAsset} from './pixel-assets.ts';
import {pixelFrameIndex,pixelFrameSource,pixelObjectOrigin} from './pixel-assets.ts';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';
import {authoredActorFrame,pixelFeedbackTint} from './pixel-actor-view.ts';
import {pixelRuntime} from './pixel-texture.ts';
type Image=Phaser.GameObjects.Image;
type Original={key:string;frame:string|number;scaleX:number;scaleY:number;originX:number;originY:number;tint:number;appliedTint?:number;alpha:number;flipX:boolean;asset:PixelAsset};
const originals=new WeakMap<Phaser.Scene,Map<Image,Original>>(),loading=new WeakMap<Phaser.Scene,Set<string>>();
const managedTextures=new WeakMap<Phaser.Scene,Set<string>>(),textureDirty=new WeakSet<Phaser.Scene>();
function trackTexture(scene:Phaser.Scene,key:string){let keys=managedTextures.get(scene);if(!keys){keys=new Set();managedTextures.set(scene,keys);}if(!keys.has(key))textureDirty.add(scene);else keys.delete(key);keys.add(key);}
/** Drop unused converted GPU sheets after map changes, or when idle sheets exceed the decoded budget. */
function pruneTextures(scene:Phaser.Scene,force=false){const keys=managedTextures.get(scene);if(!keys?.size)return;const used=new Set<string>(),scenes=scene.sys?.game?.scene?.getScenes(false)??[scene];const visit=(nodes:readonly Phaser.GameObjects.GameObject[])=>{for(const node of nodes){const image=node as Image;if(image.texture?.key)used.add(image.texture.key);const children=(node as Phaser.GameObjects.Container).list;if(children)visit(children);}};for(const s of scenes)visit(s.children?.list??[]);let bytes=0;const sizes=new Map<string,number>();for(const key of keys){const t=scene.textures.get?.(key);if(t?.key!==key){keys.delete(key);continue;}const size=t.source.reduce((n,s)=>n+s.width*s.height*4,0);bytes+=size;sizes.set(key,size);}for(const key of keys)if(!used.has(key)&&(force||bytes>128*1024*1024)){scene.textures.remove(key);keys.delete(key);bytes-=sizes.get(key)??0;}textureDirty.delete(scene);}
let approvedReady=false;
export function preparePixelAssets(){return loadPixelManifest().then(()=>{approvedReady=true;});}
function retainTint(image:Image,old:Original){if(old.appliedTint===undefined||image.tintTopLeft!==old.appliedTint)old.tint=image.tintTopLeft;const tint=old.tint===0xffffff?0xffffff:pixelFeedbackTint(old.tint);image.setTint(tint);old.appliedTint=tint;}
function retainSize(image:Image,width:number,height:number,signX=1,signY=1){image.setDisplaySize(width,height);image.setScale(Math.abs(image.scaleX)*signX,Math.abs(image.scaleY)*signY);}
function sourcePath(image:Image){const key=image.texture.key;if(key.startsWith('starsea-file:'))return key.slice(13);const source=image.texture.source[0]?.image as HTMLImageElement|undefined;try{return source?.src?new URL(source.src,window.location.href).pathname:undefined;}catch{return;}}
/** Async decode retains the original object until the approved bitmap is complete. */
export function applyAuthoredWorldAsset(scene:Phaser.Scene,image:Image,onReady:()=>void):boolean{
 if(!approvedReady)return false;
 const saved=originals.get(scene)?.get(image);if(saved)return true;
 const file=sourcePath(image)??'',frameName=String(image.frame.name),owner=image.texture.key.replace(/^(plane-material|five-material):/,'');
 const actor=authoredActorFrame(image);let asset=actor?.asset??pixelAsset(image.getData('pixel-art-id'))??pixelAssetForFrame(file,frameName)??pixelAsset(image.texture.key+':'+frameName)??pixelAsset(owner)??pixelAsset(file);if(!asset||asset.kind==='tiles'||asset.kind==='actor'&&!actor)return false;
 const variant=asset.variants?.find(v=>image.displayWidth<=v.maxWidth);if(variant)asset=pixelAsset(variant.key)??asset;
 if(image.getData('pixel-preserve-size')){if(asset.small&&Math.max(image.displayWidth,image.displayHeight)<24)asset=pixelAsset(asset.small)??asset;asset={...asset,preserveDisplaySize:true,preserveTint:true};}
 const textureKey='pixel-authored:'+asset.file;
 if(!scene.textures.exists(textureKey)){
  let requests=loading.get(scene);if(!requests){requests=new Set();loading.set(scene,requests);}if(!requests.has(textureKey)){
   const approved=asset;requests.add(textureKey);void loadPixelImage(approved).then(bitmap=>{if(!scene.sys.isActive()||!pixelRuntime.cellStage)return;if(!scene.textures.exists(textureKey)){const texture=scene.textures.addImage(textureKey,bitmap);if(texture){texture.setFilter(1);for(const [name,a] of Object.entries(approved.actions??{}))for(let i=0;i<a.count;i++)texture.add(`${name}_${i}`,0,...pixelFrameSource(approved,a,i),...approved.frame);for(const [name,f] of Object.entries(approved.frames??{}))texture.add(name,0,f.x,f.y,f.w,f.h);trackTexture(scene,textureKey);}}onReady();}).catch(()=>{}).finally(()=>requests!.delete(textureKey));
  }return false;
 }
 let frame:string|undefined;
 if(asset.defaultFrame)frame=asset.defaultFrame;
 if(asset.frames?.[String(image.frame.name)])frame=String(image.frame.name);
 if(asset.kind==='actor'){
  frame=`${actor!.name}_${actor!.index}`;
 }
 const originalKey=image.texture.key,displayWidth=image.displayWidth,displayHeight=image.displayHeight,originX=image.originX,originY=image.originY;
 let map=originals.get(scene);if(!map){map=new Map();originals.set(scene,map);}map.set(image,{key:originalKey,frame:image.frame.name,scaleX:image.scaleX,scaleY:image.scaleY,originX,originY,tint:image.tintTopLeft,alpha:image.alpha,flipX:image.flipX,asset});
 trackTexture(scene,textureKey);
 const origin=asset.preserveDisplaySize?[originX+(asset.baseOrigin?asset.anchor[0]/asset.frame[0]-asset.baseOrigin[0]:0),originY+(asset.baseOrigin?asset.anchor[1]/asset.frame[1]-asset.baseOrigin[1]:0)] as [number,number]:pixelObjectOrigin(asset,[originX,originY],[displayWidth,displayHeight]);
 if(actor){image.setFlipX(actor.flip);image.setData('pixel-painted-art',actor.id);}
 const signX=Math.sign(image.scaleX)||1,signY=Math.sign(image.scaleY)||1;image.setTexture(textureKey,frame).setOrigin(...origin);if(asset.preserveDisplaySize)retainSize(image,displayWidth,displayHeight,signX,signY);else image.setScale(asset.scale);if(asset.preserveTint)retainTint(image,map.get(image)!);else if(!actor)image.clearTint();if(asset.shadow)image.setAlpha(1);return true;
}
/** Atlas animation states keep their original clock; only the displayed authored frame changes. */
export function updateAuthoredAtlasActors(scene:Phaser.Scene){
 let removed=false;
 for(const [image,old] of originals.get(scene)??[]){
  if(!image.scene){originals.get(scene)!.delete(image);removed=true;continue;}
  if(!image.texture.key.startsWith('pixel-authored:')){const actor=old.asset.kind==='actor'?authoredActorFrame(image):undefined;if(actor?.asset===old.asset&&image.texture.key===old.key){image.setScale(old.scaleX,old.scaleY).setOrigin(old.originX,old.originY);if(!actorCatalog[actor.id])image.setFlipX(old.flipX);}originals.get(scene)!.delete(image);applyAuthoredWorldAsset(scene,image,()=>{});}
  else{if(!old.asset.preserveDisplaySize)image.setScale(old.asset.scale);if(old.asset.preserveTint)retainTint(image,old);if(old.asset.shadow){if(image.alpha!==1)old.alpha=image.alpha;image.setAlpha(1);}if(old.asset.kind==='actor'){const actor=authoredActorFrame(image);if(actor)image.setFrame(`${actor.name}_${actor.index}`).setFlipX(actor.flip);image.setOrigin(old.asset.anchor[0]/old.asset.frame[0],old.asset.anchor[1]/old.asset.frame[1]);}const name=String(image.frame.name);if(old.asset.kind!=='actor'&&old.asset.frames?.[name]&&(old.asset.sourceFrames?.[name]||scene.textures.get?.(old.key)?.has?.(name)))old.frame=image.frame.name;}
 }
 const visit=(object:Phaser.GameObjects.GameObject)=>{
  const children=(object as Phaser.GameObjects.Container).list;if(children)for(const child of children)visit(child);
  if(object.type!=='Sprite'&&object.type!=='Image')return;const image=object as Image,old=originals.get(scene)?.get(image);
  const pooledEffect=image.active!==false&&Boolean(image.getData('vfx-key')||image.getData('pixel-art-id'));
  if(!old&&(pooledEffect||pixelAsset(image.getData('pixel-art-id')??image.texture?.key)?.kind==='actor')&&!image.texture.key.startsWith('pixel-native:')&&!image.texture.key.startsWith('starsea-native'))applyAuthoredWorldAsset(scene,image,()=>{});
 };for(const object of scene.children.list)visit(object);if(removed||textureDirty.has(scene))pruneTextures(scene,removed);
}
export function restoreAuthoredWorldAssets(scene:Phaser.Scene){
 for(const [image,old] of originals.get(scene)??[]){if(!image.scene)continue;const width=image.displayWidth,height=image.displayHeight,signX=Math.sign(image.scaleX)||1,signY=Math.sign(image.scaleY)||1;image.setTexture(old.key,old.frame).setOrigin(old.originX,old.originY);if(old.asset.preserveDisplaySize)retainSize(image,width,height,signX,signY);else image.setScale(old.scaleX,old.scaleY);image.setFlipX(old.flipX).setTint(old.tint).setAlpha(old.asset.shadow?old.alpha:image.alpha);image.setData('pixel-painted-art',undefined);}originals.delete(scene);pruneTextures(scene,true);managedTextures.delete(scene);
}
