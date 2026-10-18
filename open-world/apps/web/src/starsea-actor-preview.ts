import {MiniNativePreview} from './mini-native-renderer.ts';
import type {WardrobeAction} from './wardrobe-renderer.ts';
import {loadImage,loadJSON,type Asset,type Point} from './starsea-assets.ts';
type AtlasFrame={frame:{x:number;y:number;w:number;h:number};spriteSourceSize:{x:number;y:number;w:number;h:number};sourceSize:{w:number;h:number}};
export class StarseaActorPreview{
 readonly canvas=document.createElement('canvas');private native?:MiniNativePreview;private image?:HTMLImageElement;private atlas?:{frames:Record<string,AtlasFrame>};private sockets?:{actions:Record<string,Record<string,[number,number]>[]>};
 private asset?:Asset;private generation=0;private currentAction='idle';private frameIndex=0;private facing=-1;private loadedProfile='';private errors:string[]=[];
 constructor(readonly width=720,readonly height=480,readonly foot:Point={x:340,y:300}){this.canvas.width=width;this.canvas.height=height;}
 async load(asset:Asset,action='idle',phase='default'){
  const generation=++this.generation;this.asset=asset;this.errors=[];
  if(asset.runtime.kind==='native'){
   const skill=asset.actions.skills?.[action];
   const profile=action==='death'?asset.runtime.profile:phase==='phase-enter'||phase==='phase-end'?asset.states[phase]?.profile:skill?.profiles?.[phase]??skill?.profile??asset.states?.[phase]?.profile??asset.runtime.profile;
   if(this.native&&profile===this.loadedProfile)return true;
   this.native?.destroy();this.loadedProfile=profile;
   const painter=new MiniNativePreview(this.canvas,{height:asset.runtime.displayHeight,footX:this.foot.x/this.width,footY:this.foot.y/this.height,fitBounds:false,profileUrl:profile});this.native=painter;
   if(!asset.runtime.renderAppearance)throw Error('Native appearance missing: '+asset.id);
   const ready=await painter.setAppearance(asset.runtime.renderAppearance);if(generation!==this.generation)return false;if(!ready)throw Error(painter.errors.join('\n')||'Native appearance refused');return true;
  }
  this.native?.destroy();this.native=undefined;this.loadedProfile='';
  if(!asset.runtime.image||!asset.runtime.atlas||!asset.runtime.sockets)throw Error('Atlas dependencies missing: '+asset.id);
  const [image,atlas,sockets]=await Promise.all([loadImage(asset.runtime.image),loadJSON<{frames:Record<string,AtlasFrame>}>(asset.runtime.atlas),loadJSON<{actions:Record<string,Record<string,[number,number]>[]>}>(asset.runtime.sockets)]);if(generation!==this.generation)return false;this.image=image;this.atlas=atlas;this.sockets=sockets;return true;
 }
 render(action:string,clock:number,facing:number,phase='default',cast?:{elapsed:number;windup:number;recovery:number}){
  const asset=this.asset;if(!asset)return;this.facing=facing;
  if(this.native){const mapped=action==='death'?'death':phase==='phase-enter'||phase==='phase-end'?'idle':asset.actions.skills?.[action]?'skill':asset.runtime.storyAdapter?.[action]??({talk:'attack',repair:'skill',read:'skill',point:'projectile'} as Record<string,string>)[action]??action;
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
