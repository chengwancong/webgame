import type Phaser from 'phaser';
import {loadPixelManifest,loadPixelImage,pixelAsset,pixelAssetForFrame,type PixelAsset} from './pixel-assets.ts';
import {pixelFrameIndex,pixelObjectOrigin} from './pixel-assets.ts';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';
import {authoredActorFrame} from './pixel-actor-view.ts';
type Image=Phaser.GameObjects.Image;
type Original={key:string;frame:string|number;scaleX:number;scaleY:number;originX:number;originY:number;tint:number;alpha:number;flipX:boolean;asset:PixelAsset};
const originals=new WeakMap<Phaser.Scene,Map<Image,Original>>(),loading=new WeakMap<Phaser.Scene,Set<string>>();
let approvedReady=false;
export function preparePixelAssets(){return loadPixelManifest().then(()=>{approvedReady=true;});}
function sourcePath(image:Image){const key=image.texture.key;if(key.startsWith('starsea-file:'))return key.slice(13);const source=image.texture.source[0]?.image as HTMLImageElement|undefined;try{return source?.src?new URL(source.src,window.location.href).pathname:undefined;}catch{return;}}
/** Async decode retains the original object until the approved bitmap is complete. */
export function applyAuthoredWorldAsset(scene:Phaser.Scene,image:Image,onReady:()=>void):boolean{
 if(!approvedReady)return false;
 const saved=originals.get(scene)?.get(image);if(saved)return true;
 const file=sourcePath(image)??'',frameName=String(image.frame.name),owner=image.texture.key.replace(/^(plane-material|five-material):/,'');
 const actor=authoredActorFrame(image);let asset=actor?.asset??pixelAsset(image.getData('pixel-art-id'))??pixelAssetForFrame(file,frameName)??pixelAsset(image.texture.key+':'+frameName)??pixelAsset(owner)??pixelAsset(file);if(!asset||asset.kind==='tiles'||asset.kind==='actor'&&!actor)return false;
 const variant=asset.variants?.find(v=>image.displayWidth<=v.maxWidth);if(variant)asset=pixelAsset(variant.key)??asset;
 const textureKey='pixel-authored:'+asset.file;
 if(!scene.textures.exists(textureKey)){
  let requests=loading.get(scene);if(!requests){requests=new Set();loading.set(scene,requests);}if(!requests.has(textureKey)){
   const approved=asset;requests.add(textureKey);void loadPixelImage(approved).then(bitmap=>{if(!scene.sys.isActive())return;if(!scene.textures.exists(textureKey)){const texture=scene.textures.addImage(textureKey,bitmap);if(texture){texture.setFilter(1);for(const [name,a] of Object.entries(approved.actions??{}))for(let i=0;i<a.count;i++)texture.add(`${name}_${i}`,0,i*approved.frame[0],a.row*approved.frame[1],...approved.frame);for(const [name,f] of Object.entries(approved.frames??{}))texture.add(name,0,f.x,f.y,f.w,f.h);}}onReady();}).catch(()=>{}).finally(()=>requests!.delete(textureKey));
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
 const origin=pixelObjectOrigin(asset,[originX,originY],[displayWidth,displayHeight]);
 if(actor){image.setFlipX(actor.flip);image.setData('pixel-painted-art',actor.id);}
 image.setTexture(textureKey,frame).setOrigin(...origin).setScale(2);if(!actor)image.clearTint();if(asset.shadow)image.setAlpha(1);return true;
}
/** Atlas animation states keep their original clock; only the displayed authored frame changes. */
export function updateAuthoredAtlasActors(scene:Phaser.Scene){
 for(const [image,old] of originals.get(scene)??[]){
  if(!image.scene){originals.get(scene)!.delete(image);continue;}
  if(!image.texture.key.startsWith('pixel-authored:')){originals.get(scene)!.delete(image);applyAuthoredWorldAsset(scene,image,()=>{});}
  else{image.setScale(2);if(old.asset.shadow){if(image.alpha!==1)old.alpha=image.alpha;image.setAlpha(1);}if(old.asset.kind==='actor'){const actor=authoredActorFrame(image);if(actor)image.setFrame(`${actor.name}_${actor.index}`).setFlipX(actor.flip);image.setOrigin(old.asset.anchor[0]/old.asset.frame[0],old.asset.anchor[1]/old.asset.frame[1]);}if(old.asset.kind!=='actor'&&old.asset.frames?.[String(image.frame.name)])old.frame=image.frame.name;}
 }
 const visit=(object:Phaser.GameObjects.GameObject)=>{
  const children=(object as Phaser.GameObjects.Container).list;if(children)for(const child of children)visit(child);
  if(object.type!=='Sprite')return;const image=object as Image,old=originals.get(scene)?.get(image);
  if(!old&&pixelAsset(image.getData('pixel-art-id')??image.texture?.key)?.kind==='actor'&&!image.texture.key.startsWith('pixel-native:')&&!image.texture.key.startsWith('starsea-native'))applyAuthoredWorldAsset(scene,image,()=>{});
 };for(const object of scene.children.list)visit(object);
}
export function restoreAuthoredWorldAssets(scene:Phaser.Scene){
 for(const [image,old] of originals.get(scene)??[]){if(!image.scene)continue;image.setTexture(old.key,old.frame).setOrigin(old.originX,old.originY).setScale(old.scaleX,old.scaleY).setFlipX(old.flipX).setTint(old.tint).setAlpha(old.asset.shadow?old.alpha:image.alpha);image.setData('pixel-painted-art',undefined);}originals.delete(scene);
}
