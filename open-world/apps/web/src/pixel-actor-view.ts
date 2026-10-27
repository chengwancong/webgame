import type Phaser from 'phaser';
import type {RenderPose} from './effect-attachments.ts';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';
import {pixelAsset,pixelFrameIndex} from './pixel-assets.ts';
import master from '../../../packages/asset-manifest/pixel-palette.json';
const colors=Object.values(master.ramps).flat().map(c=>parseInt(c.slice(1),16)),tints=new Map<number,number>();
export function pixelFeedbackTint(color:number){
 const cached=tints.get(color);if(cached!==undefined)return cached;
 const delta=(c:number)=>((c>>16)-(color>>16))**2+((c>>8&255)-(color>>8&255))**2+((c&255)-(color&255))**2;
 const result=colors.reduce((a,b)=>delta(a)<=delta(b)?a:b);tints.set(color,result);return result;
}
export function authoredActorFrame(image:Phaser.GameObjects.Image,art?:string){
 const id=art??image.getData('pixel-art-id')??image.texture.key,elite=Boolean(image.getData('pixel-elite'));
 const asset=(elite&&pixelAsset(id+':elite'))||pixelAsset(id);if(asset?.kind!=='actor')return;
 const cast=image.getData('pixel-cast') as {action:string;elapsed:number;windup:number;recovery:number}|undefined,match=/^(.*)_(\d+)$/.exec(String(image.frame.name));
 const name=cast?.action??match?.[1],clip=name&&asset.actions?.[name];if(!name||!clip)return;
 const authored=image.texture.key.startsWith('pixel-authored:'),clock=Number(match?.[2]??0)/(actorCatalog[id]?.fps??30),live=image.getData('pixel-clock') as {action:string;seconds:number}|undefined,playing=(image as Phaser.GameObjects.Sprite).anims?.isPlaying;
 const index=cast?pixelFrameIndex(clip,0,false,cast):live?.action===name&&playing?pixelFrameIndex(clip,live.seconds,clip.loop??(name==='idle'||name==='move')):authored?Math.min(clip.count-1,Number(match![2])):pixelFrameIndex(clip,clock,clip.loop??(name==='idle'||name==='move'));
 const facing=image.getData('pixel-facing');return{id,asset,name,clip,index,flip:typeof facing==='number'?facing<0:authored?image.flipX:actorCatalog[id]?.nativeFacing===-1?!image.flipX:image.flipX};
}
export function authoredActorPose(image:Phaser.GameObjects.Image,art:string):RenderPose|undefined{
 const frame=authoredActorFrame(image,art);if(!frame)return;
 const {id,asset,name,clip,index,flip}=frame,position={x:image.x,y:image.y};
 return{art,frame:`pixel-${id}#${name}_${index}`,releaseFrame:`pixel-${id}#${name}_${clip.impactFrame}`,position,scale:asset.scale??2,flip,
  socket:(socket,requested)=>{const match=/#([^#]+)_(\d+)$/.exec(requested),action=match?asset.actions?.[match[1]]:clip,n=match?Number(match[2]):index,p=action?.sockets[n]?.[socket];return p?{x:position.x+(p[0]-asset.anchor[0])*(asset.scale??2)*(flip?-1:1),y:position.y+(p[1]-asset.anchor[1])*(asset.scale??2)}:undefined;}};
}
