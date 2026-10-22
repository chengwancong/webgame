import Phaser from 'phaser';
import {StarseaActorPreview,nativeProfileFor} from './starsea-actor-preview.ts';
import {FrameBudget,FrameLru} from './native-frame-math.ts';
import type {Point} from './native-frame-math.ts';
import {materialCanvas} from './open-world-five-art-data.ts';
import type {ThemeMaterial} from './open-world-five-art-data.ts';
import type {RuntimeAsset,StarseaPhase} from './starsea-runtime-assets.ts';

type PainterEntry={preview:StarseaActorPreview;ready:boolean;failed?:string;failedAt?:number;touched:number;pending:Promise<boolean>};
type FrameEntry={texture:string;sockets:Record<string,Point>;bytes:number};
export interface NativeFrameResult{texture:string;flipped:boolean;sockets:Record<string,Point>;name:string}
const BAKES_PER_FRAME=4,MAX_BYTES=96*1024*1024,MIN_IDLE_MS=3000;
export const nativeBlankKey='starsea-native-blank';
let texSerial=0;
const sceneCache=new WeakMap<Phaser.Scene,NativeFrameCache>();

export class NativeFrameCache{
 private painters=new Map<string,PainterEntry>();
 private lru=new FrameLru<FrameEntry>();
 private budget=new FrameBudget(BAKES_PER_FRAME);
 private bakes=0;private budgetDenied=0;private lastSweep=0;
 constructor(private scene:Phaser.Scene){
  if(!scene.textures.exists(nativeBlankKey)){
   const bc=document.createElement('canvas');bc.width=bc.height=1;
   const bt=scene.textures.addCanvas(nativeBlankKey,bc)!;
   bt.add('f',0,0,0,1,1)!.setTrim(512,512,0,0,1,1);
  }
 }
 private pKey(assetId:string,profile:string){return `${assetId}|${profile}`;}
 painter(asset:RuntimeAsset,profile:string):PainterEntry{
  const k=this.pKey(asset.id,profile);const existing=this.painters.get(k);if(existing)return existing;
  const preview=new StarseaActorPreview(512,512,{x:256,y:409.6});
  const e:PainterEntry={preview,ready:false,touched:Date.now(),pending:Promise.resolve(false)};
  e.pending=preview.loadProfile(asset,profile).then(ok=>{e.ready=ok;if(!ok){e.failed='native profile refused: '+profile;e.failedAt=Date.now();}return ok;}).catch(err=>{e.failed=String(err);e.failedAt=Date.now();return false;});
  this.painters.set(k,e);return e;
 }
 preload(asset:RuntimeAsset){
  const profiles=new Set<string>();
  if(asset.runtime.profile)profiles.add(asset.runtime.profile);
  for(const skill of Object.values(asset.actions.skills??{})){
   const s=skill as any;if(s.profile)profiles.add(s.profile);
   for(const p of Object.values(s.profiles??{}))if(p)profiles.add(p as string);
  }
  for(const state of Object.values(asset.states??{})){const s=state as any;if(s.profile)profiles.add(s.profile);}
  for(const p of profiles)if(p)this.painter(asset,p);
 }
 frame(asset:RuntimeAsset,profile:string,action:string,clock:number,facing:number,phase:StarseaPhase,cast?:{elapsed:number;windup:number;recovery:number}):NativeFrameResult|'pending'|'error'{
  const now=Date.now();
  if(now-this.lastSweep>1000){
   this.lastSweep=now;
   for(const [k,e] of [...this.painters]){
    if(now-e.touched>60000){e.preview.destroy();this.painters.delete(k);this.lru.deleteWhere(fk=>fk.startsWith(k+'|'),(_fk,v)=>{try{this.scene.textures.remove(v.texture);}catch{}});}
   }
  }
  let e=this.painter(asset,profile);
  // 加载失败 5 秒后丢弃重建，避免一次网络错误让该档位永久不可见
  if(e.failed&&now-(e.failedAt??0)>5000){e.preview.destroy();this.painters.delete(this.pKey(asset.id,profile));e=this.painter(asset,profile);}
  e.touched=now;
  if(e.failed)return 'error';
  if(!e.ready)return 'pending';
  const r=e.preview.resolveNative(action,clock,facing,phase,cast);
  if(!r)return 'pending';
  const mapped=e.preview.nativeMotion(action,phase);
  const key=`${asset.id}|${profile}|${r.motion}|${r.index}`;
  const cached=this.lru.get(key,now);
  if(cached)return{texture:cached.texture,flipped:r.flipped,sockets:cached.sockets,name:`mini-${mapped}_${r.index}`};
  if(!this.budget.take(this.scene.game.loop.frame)){this.budgetDenied++;return 'pending';}
  const baked=e.preview.bakeNative(action,clock,phase,cast);
  if(!baked)return 'pending';
  const material=(asset.runtime as RuntimeAsset['runtime']&{material?:ThemeMaterial}).material;
  const srcCanvas=(material?.tint||material?.wash)?materialCanvas(e.preview.canvas,512,512,material):e.preview.canvas;
  const bounds=baked.bounds??{x:0,y:0,w:1,h:1};
  const {x,y,w,h}=bounds;
  const dc=document.createElement('canvas');dc.width=w;dc.height=h;
  dc.getContext('2d')!.drawImage(srcCanvas,x,y,w,h,0,0,w,h);
  const texKey='starsea-native-frame-'+(++texSerial);
  const tex=this.scene.textures.addCanvas(texKey,dc)!;
  tex.add('f',0,0,0,w,h)!.setTrim(512,512,x,y,w,h);
  const bytes=w*h*4;
  this.lru.set(key,{texture:texKey,sockets:baked.sockets,bytes},bytes,now);
  this.bakes++;
  this.lru.evict(MAX_BYTES,now,MIN_IDLE_MS,(_fk,v)=>{try{this.scene.textures.remove(v.texture);}catch{}});
  return{texture:texKey,flipped:r.flipped,sockets:baked.sockets,name:`mini-${mapped}_${r.index}`};
 }
 duration(asset:RuntimeAsset,action:string):number|undefined{
  const profile=asset.runtime.profile;if(!profile)return;
  const e=this.painters.get(this.pKey(asset.id,profile));
  if(!e||!e.ready)return;
  return e.preview.actionDuration(action);
 }
 /** 回收后的贴图不能再挂在精灵上。 */
 has(texture:string){return this.scene.textures.exists(texture);}
 diagnostics(){return{painters:this.painters.size,frames:this.lru.size,bytes:this.lru.bytes,bakes:this.bakes,budgetDenied:this.budgetDenied};}
 destroy(){
  for(const e of this.painters.values())e.preview.destroy();
  this.painters.clear();
  this.lru.clear((_k,v)=>{try{this.scene.textures.remove(v.texture);}catch{}});
 }
}

export function nativeFrameCache(scene:Phaser.Scene):NativeFrameCache{
 let c=sceneCache.get(scene);
 if(!c){
  c=new NativeFrameCache(scene);sceneCache.set(scene,c);
  const cleanup=()=>{c!.destroy();sceneCache.delete(scene);};
  scene.events.once('shutdown',cleanup);scene.events.once('destroy',cleanup);
 }
 return c;
}
