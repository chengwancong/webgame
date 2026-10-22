import {MiniNativePreview} from './mini-native-renderer.ts';
import type {WardrobeAction} from './wardrobe-renderer.ts';
import {loadImage,loadJSON,type Asset,type Point} from './starsea-assets.ts';
type AtlasFrame={frame:{x:number;y:number;w:number;h:number};spriteSourceSize:{x:number;y:number;w:number;h:number};sourceSize:{w:number;h:number}};
/** 计算 native 资源在给定 action/phase 下应加载的 profile URL */
export function nativeProfileFor(asset:Asset,action:string,phase:string):string{
 const skill=asset.actions.skills?.[action];
 return ((action==='death'?asset.runtime.profile:phase==='phase-enter'||phase==='phase-end'?asset.states[phase]?.profile:skill?.profiles?.[phase]??skill?.profile??asset.states?.[phase]?.profile??asset.runtime.profile)??'') as string;
}
export class StarseaActorPreview{
 readonly canvas=document.createElement('canvas');private native?:MiniNativePreview;private image?:HTMLImageElement;private atlas?:{frames:Record<string,AtlasFrame>};private sockets?:{actions:Record<string,Record<string,[number,number]>[]>};
 private asset?:Asset;private generation=0;private currentAction='idle';private frameIndex=0;private facing=-1;private loadedProfile='';private errors:string[]=[];
 constructor(readonly width=720,readonly height=480,readonly foot:Point={x:340,y:300}){this.canvas.width=width;this.canvas.height=height;}
 /** action → WardrobeAction 映射（与 render() 逻辑一致） */
 nativeMotion(action:string,phase:string):string{
  const asset=this.asset;if(!asset)return action;
  return action==='death'?'death':phase==='phase-enter'||phase==='phase-end'?'idle':asset.actions.skills?.[action]?'skill':asset.runtime.storyAdapter?.[action]??({talk:'attack',repair:'skill',read:'skill',point:'projectile'} as Record<string,string>)[action]??action;
 }
 /** 仅加载指定 profile，不依赖 action/phase 推导（供帧缓存使用） */
 async loadProfile(asset:Asset,profile:string):Promise<boolean>{
  this.asset=asset;
  if(this.native&&profile===this.loadedProfile)return true;
  this.native?.destroy();this.loadedProfile=profile;
  const painter=new MiniNativePreview(this.canvas,{height:asset.runtime.displayHeight,footX:this.foot.x/this.width,footY:this.foot.y/this.height,fitBounds:false,profileUrl:profile});this.native=painter;
  if(!asset.runtime.renderAppearance)throw Error('Native appearance missing: '+asset.id);
  return painter.setAppearance(asset.runtime.renderAppearance);
 }
 async load(asset:Asset,action='idle',phase='default'){
  const generation=++this.generation;this.asset=asset;this.errors=[];
  if(asset.runtime.kind==='native'){
   const profile=nativeProfileFor(asset,action,phase);
   if(this.native&&profile===this.loadedProfile)return true;
   const ready=await this.loadProfile(asset,profile);if(generation!==this.generation)return false;if(!ready)throw Error(this.native!.errors.join('\n')||'Native appearance refused');return true;
  }
  this.native?.destroy();this.native=undefined;this.loadedProfile='';
  if(!asset.runtime.image||!asset.runtime.atlas||!asset.runtime.sockets)throw Error('Atlas dependencies missing: '+asset.id);
  const [image,atlas,sockets]=await Promise.all([loadImage(asset.runtime.image),loadJSON<{frames:Record<string,AtlasFrame>}>(asset.runtime.atlas),loadJSON<{actions:Record<string,Record<string,[number,number]>[]>}>(asset.runtime.sockets)]);if(generation!==this.generation)return false;this.image=image;this.atlas=atlas;this.sockets=sockets;return true;
 }
 /** 解析帧元数据，不绘制 */
 resolveNative(action:string,clock:number,facing:number,phase:string,cast?:{elapsed:number;windup:number;recovery:number}):{motion:string;index:number;flipped:boolean}|undefined{
  if(!this.native||!this.asset)return;
  const mapped=this.nativeMotion(action,phase);
  return this.native.resolveFrame({action:mapped as WardrobeAction,clock,facing,...(cast?{cast}:{})});
 }
 /** 以未翻转朝向绘制当前帧，返回边界和挂点（供帧缓存烘焙） */
 bakeNative(action:string,clock:number,phase:string,cast?:{elapsed:number;windup:number;recovery:number}):{bounds:{x:number;y:number;w:number;h:number}|undefined;sockets:Record<string,Point>}|undefined{
  if(!this.native||!this.asset)return;
  const mapped=this.nativeMotion(action,phase);
  const facing=this.native.unflippedFacing??1;
  if(!this.native.drawFrame({action:mapped as WardrobeAction,clock,facing,...(cast?{cast}:{})}))return;
  const bounds=this.native.frameBounds();
  const result:Record<string,Point>={};
  for(const name of ['feet','chest','hand','weapon','muzzle','head','rightHand','leftHand'] as const){const p=this.native.socket(name as Parameters<typeof this.native.socket>[0]);if(p)result[name]=p;}
  Object.assign(result,this.native.boneSockets('ss_'));
  return{bounds,sockets:result};
 }
 render(action:string,clock:number,facing:number,phase='default',cast?:{elapsed:number;windup:number;recovery:number}){
  const asset=this.asset;if(!asset)return;this.facing=facing;
  if(this.native){const mapped=this.nativeMotion(action,phase);
   this.currentAction=mapped;return this.native.render({action:mapped as WardrobeAction,clock,facing,...(cast?{cast}:{})});
  }
  const ctx=this.canvas.getContext('2d')!;ctx.clearRect(0,0,this.width,this.height);const def=asset.runtime.actions?.[action];if(!def||!this.image||!this.atlas)return;
  const index=def.loop?Math.floor(clock*def.fps)%def.frames.length:Math.min(def.frames.length-1,Math.floor(clock*def.fps));this.currentAction=action;this.frameIndex=index;
  const key=def.frames[index],f=this.atlas.frames[key];if(!f)throw Error('Missing exact actor frame '+key);
  const anchor=asset.runtime.anchor!,scale=asset.runtime.scale!,frameSize=asset.runtime.frameSize!,r=f.frame,s=f.spriteSourceSize,mirror=(asset.runtime.nativeFacing??-1)*facing;
  ctx.save();ctx.translate(this.foot.x,this.foot.y);ctx.scale(mirror<0?-1:1,1);ctx.drawImage(this.image,r.x,r.y,r.w,r.h,(s.x-anchor[0]*frameSize)*scale,(s.y-anchor[1]*frameSize)*scale,r.w*scale,r.h*scale);ctx.restore();return true;
 }
 actionDuration(action:string){return this.native?.actionDuration(action as WardrobeAction)??this.asset?.runtime.actions?.[action]?.duration;}
 socket(name:string):Point|undefined{
  if(this.native)return (name.startsWith('ss_')?this.native.boneSocket(name):this.native.socket(name as Parameters<MiniNativePreview['socket']>[0]));
  const a=this.asset,p=this.sockets?.actions[this.currentAction]?.[this.frameIndex]?.[name];if(!a||!p)return;
  const size=a.runtime.frameSize!,scale=a.runtime.scale!,anchor=a.runtime.anchor!,mirror=(a.runtime.nativeFacing??-1)*this.facing<0?-1:1;
  return {x:this.foot.x+(p[0]-anchor[0]*size)*scale*mirror,y:this.foot.y+(p[1]-anchor[1]*size)*scale};
 }
 diagnostics(){return {id:this.asset?.id,profile:this.loadedProfile,action:this.currentAction,frameIndex:this.frameIndex,facing:this.facing,displayHeight:this.asset?.runtime.displayHeight,ready:this.native?.ready??Boolean(this.image&&this.atlas),errors:this.native?.errors??this.errors,native:this.native?.diagnostics(),sockets:Object.fromEntries(['feet','chest','hand','weapon','muzzle','ss_exhaust'].map(name=>[name,this.socket(name)]))};}
 destroy(){this.generation++;this.native?.destroy();this.native=undefined;}
}
