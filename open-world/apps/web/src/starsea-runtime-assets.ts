import {openWorldRuntimeAssets} from '../../../packages/asset-manifest/open-world-assets.ts';
import Phaser from 'phaser';
import bundle from '../../../packages/asset-manifest/starsea.v1.json';
import {nativeProfileFor} from './starsea-actor-preview.ts';
import {nativeFrameCache,nativeBlankKey} from './native-frame-cache.ts';
import {mirrorSocket} from './native-frame-math.ts';
import {loadJSON,type Asset,type Point,type PropState} from './starsea-assets.ts';
import type {SocketName,RenderPose} from './effect-attachments.ts';
import {runtimeResources} from '../../../packages/asset-manifest/runtime-resources.ts';
import {registerLoadedActorAnimations} from './loaded-actor-animations.ts';
import {PixelActorPainter} from './pixel-actor.ts';
import {pixelRuntime} from './pixel-texture.ts';
import {pixelActorHeight,pixelAsset} from './pixel-assets.ts';

export type StarseaPhase='default'|'phase-enter'|'phase-active'|'phase-end';
export type StarseaSceneObject={id:string;artId:string;position:Point;reach?:number;state?:string;enabled?:boolean;label?:string;name?:string;npcId?:string;action?:string;facing?:number;phase?:StarseaPhase;actionStartedTick?:number};
export type StarseaSceneActor={id:string;artId?:string;position?:Point;state?:string;enabled?:boolean;label?:string;npcId?:string;action?:string;skillId?:string;phase?:StarseaPhase;actionStartedTick?:number;phaseStartedTick?:number;cast?:{elapsed:number;windup:number;recovery:number}};
export type StarseaSceneView={effects?:readonly import('./field-event-effects.ts').FieldEventEffect[];guide?:{x:number;y:number;label:string;arrow?:boolean};prompt?:{x:number;y:number;text:string;objectId?:string};objects?:readonly StarseaSceneObject[];actors?:readonly StarseaSceneActor[]};
export type SceneVariant={id:string;file:string;anchor?:[number,number];displayWidth?:number;mirrorX?:boolean};
export type RuntimeAsset=Asset&{runtime:Asset['runtime']&{variants?:SceneVariant[];tileSize?:number;tint?:string;wash?:{color:string;alpha:number};parallax?:number}};
const legacyRuntimeAssets=bundle.assets as unknown as RuntimeAsset[];
export const starseaAssets=runtimeResources as unknown as Map<string,RuntimeAsset>;
export const starseaAsset=(id:string)=>starseaAssets.get(id);
export const starseaTexture=(file:string)=>'starsea-file:'+file;
export const starseaAnimation=(id:string,action:string)=>id+'-'+action;
const jsonCache=new Map<string,Promise<unknown>>();
export function starseaJSON<T>(url:string):Promise<T>{let result=jsonCache.get(url);if(!result){result=loadJSON<T>(url).catch(error=>{jsonCache.delete(url);throw error;});jsonCache.set(url,result);}return result as Promise<T>;}

/** Only accepted runtime dependencies are loaded; a source PNG is never a live texture. */
export function preloadStarseaRuntimeAssets(scene:Phaser.Scene,additional:readonly string[]=[]){
 const files=new Set<string>();
 for(const asset of [...legacyRuntimeAssets,...additional.map(id=>starseaAssets.get(id)).filter((a):a is RuntimeAsset=>Boolean(a))]){
  const r=asset.runtime;
  if(r.kind==='atlas'&&asset.group==='monsters'&&!scene.textures.exists(asset.id)){scene.load.atlas(asset.id,r.image!,r.atlas!);scene.load.json(asset.id+':sockets',r.sockets!);}
  if(r.kind==='effect'&&(r as any).texture)files.add((r as any).texture);
  if(r.kind==='prop'){if(r.file)files.add(r.file);for(const variant of r.variants??[])files.add(variant.file);for(const state of Object.values(r.states??{}))if(state.file)files.add(state.file);
   // 图集动画 prop（A4 引雷桩/落石等）：预加载 atlas 纹理
   // image 字段缺省时用 file（starsea.v1.json legacy props）
   if((r as any).atlas&&!scene.textures.exists(asset.id))scene.load.atlas(asset.id,(r as any).image??r.file,(r as any).atlas);}
 }
 for(const file of files)if(!scene.textures.exists(starseaTexture(file)))scene.load.image(starseaTexture(file),file);
}
/** 与 preloadStarseaRuntimeAssets 同一口径判断还缺哪些贴图：道具的变体/状态图、特效贴图都算，避免地面只有变体时漏判、先建场景出现空地（Grok：首领房暗绿空洞）。 */
export function starseaRuntimeMissing(scene:Phaser.Scene,ids:readonly string[]){
 return ids.some(id=>{const asset=starseaAssets.get(id);if(!asset)throw Error('Unregistered region resource '+id);const r=asset.runtime;
  if(r.kind==='atlas')return !scene.textures.exists(asset.id);
  const files=r.kind==='effect'?[(r as any).texture]:r.kind==='prop'?[r.file,...(r.variants??[]).map(v=>v.file),...Object.values(r.states??{}).map(s=>s.file)]:[];
  if(r.kind==='prop'&&(r as any).atlas&&!scene.textures.exists(asset.id))return true;
  return files.some(f=>f&&!scene.textures.exists(starseaTexture(f)));});
}
export function createStarseaAnimations(scene:Phaser.Scene){registerLoadedActorAnimations(scene,starseaAssets.values());}
export function starseaAtlasFrame(id:string,action:string,clock:number){const r=starseaAsset(id)?.runtime,clip=r?.actions?.[action];if(!clip)return;const index=Math.max(0,Math.floor(clock*clip.fps));return clip.frames[clip.loop?index%clip.frames.length:Math.min(index,clip.frames.length-1)];}
export function starseaAtlasSocket(scene:Phaser.Scene,id:string,frame:string,name:SocketName,position:Point,scale:number,flip:boolean):Point|undefined{
 const asset=starseaAsset(id),match=/^(.+)_(\d+)$/.exec(frame),data=scene.cache.json.get(id+':sockets') as {actions:Record<string,Record<string,[number,number]>[]>}|undefined;
 if(!asset||!match||!data)return;const point=data.actions[match[1]]?.[Number(match[2])]?.[name];if(!point)return;
 const anchor=asset.runtime.anchor!,size=asset.runtime.frameSize!;return{x:position.x+(point[0]-anchor[0]*size)*scale*(flip?-1:1),y:position.y+(point[1]-anchor[1]*size)*scale};
}
export function starseaPropState(asset:RuntimeAsset,state?:string):PropState|undefined{const states=asset.runtime.states;if(!states)return;
 // starsea.v1.json legacy props: states 是字符串数组而非 PropState 对象；从 runtime 字段直接合成
 // 有图集时按状态名取帧：glow → 呼吸循环（叠加层），lit → 点亮环，其余 → runtime.frame 底图
 if(Array.isArray(states)){const r=asset.runtime as any;if(!r.file)return;const base={kind:'image',file:r.file,anchor:r.anchor,displayHeight:r.displayHeight??r.displayWidth,visible:true};if(!r.atlas)return base;
  const anim=state==='glow'?r.animations?.glow:undefined,frames:string[]=anim?anim.frames:state==='lit'?['stargate-ring-lit']:r.frame?[r.frame]:[];return frames.length?{...base,atlasKey:asset.id,frames,fps:anim?.fps??1}:base;}
 return state===undefined?Object.values(states)[0]:states[state];}

/** Hero and party slots are reserved before native enemies/NPCs claim a visible slot.
 *  帧已共享缓存，limit 仅为合理性上限，默认 64。 */
export class StarseaNativeBudget{
 readonly limit=64;private used=new Set<string>();private reserved=0;private denied=0;
 begin(reserved:number){this.reserved=Math.min(this.limit,Math.max(0,reserved));this.used.clear();this.denied=0;}
 claim(id:string){if(this.used.has(id))return true;if(this.used.size+this.reserved>=this.limit){this.denied++;return false;}this.used.add(id);return true;}
 diagnostics(){return{limit:this.limit,reserved:this.reserved,visible:this.used.size,total:this.used.size+this.reserved,denied:this.denied};}
}
export class StarseaNativeActor{
 private pixelPainter?:PixelActorPainter;private pixelTexture?:Phaser.Textures.CanvasTexture;private pixelShown=false;
 readonly sprite:Phaser.GameObjects.Sprite;
 private current?:{texture:string;sockets:Record<string,Point>;flipped:boolean;name:string};
 private errors:string[]=[];private rendered=0;private skipped=0;
 private point:Point={x:0,y:0};readonly foot:Point={x:256,y:409.6};
 private destroyed=false;
 constructor(private scene:Phaser.Scene,readonly asset:RuntimeAsset){
  const cache=nativeFrameCache(scene);
  this.sprite=scene.add.sprite(0,0,nativeBlankKey,'f').setOrigin(.5,.8).setVisible(false);
  cache.preload(asset);
 }
 sync(id:string,point:Point,action:string,clock:number,facing:number,phase:StarseaPhase,budget:StarseaNativeBudget,cast?:{elapsed:number;windup:number;recovery:number}){
  this.point=point;this.sprite.setPosition(point.x,point.y).setDepth(point.y+2);
  const view=this.scene.cameras.main.worldView,padding=pixelRuntime.cellStage>0?Math.max(this.asset.runtime.displayHeight??150,pixelActorHeight(this.asset.id)??0):this.asset.runtime.displayHeight??150,visible=point.x>=view.x-padding&&point.x<=view.right+padding&&point.y>=view.y&&point.y<=view.bottom+padding;
  if(!visible||!budget.claim(id)){this.sprite.setVisible(false);this.skipped++;return;}
  if(action==='death')phase='default';
  if(pixelRuntime.cellStage>0){
   if(!this.pixelPainter){const key=`pixel-native:${this.asset.id}:${this.sprite.name}:${id}`,texture=this.scene.textures.createCanvas(key,512,512)!;texture.setFilter(1);this.pixelTexture=texture;this.pixelPainter=new PixelActorPainter(texture.canvas,{height:96,footX:.5,footY:410/512});this.pixelPainter.request(this.asset.id);}
   this.pixelPainter.request(this.asset.id+(this.sprite.getData('pixel-elite')&&pixelAsset(this.asset.id+':elite')?':elite':''));
   if(this.pixelPainter.supports(action,phase)){
    if(!this.pixelShown)this.pixelPainter.reset();
    if(this.pixelPainter.render({action:action as any,clock,facing,cast,pixelPhase:phase}))this.pixelTexture!.refresh();
    this.sprite.setTexture(this.pixelTexture!.key).setOrigin(.5,410/512).setScale(1).setFlipX(false).setVisible(true);this.pixelShown=true;this.rendered++;return;
   }
  }
  if(this.pixelShown){this.sprite.setOrigin(.5,.8);this.pixelShown=false;}
  if(action==='death')phase='default';
  const profile=nativeProfileFor(this.asset,action,phase);
  const cache=nativeFrameCache(this.scene);
  const f=cache.frame(this.asset,profile,action,clock,facing,phase,cast);
  if(typeof f==='object'){
   if(this.sprite.texture.key!==f.texture)this.sprite.setTexture(f.texture,'f');
   this.sprite.setFlipX(f.flipped).setVisible(true);this.current=f;this.rendered++;
  }else{
   if(f==='error'&&this.errors.length<8){this.errors.push('frame error '+profile);console.error('[starsea-native] frame error',this.asset.id,profile);}
   // 新帧未就绪（换档加载中/本帧烘焙额度用完）：保持上一帧，不再隐藏；上一帧已被缓存回收则先隐藏
   if(this.current&&!cache.has(this.current.texture)){this.current=undefined;this.sprite.setTexture(nativeBlankKey,'f');}
   this.sprite.setVisible(Boolean(this.current));
  }
 }
 pose():RenderPose{
  if(this.pixelShown&&this.pixelPainter)return{art:this.asset.id,frame:this.pixelPainter.frameName,releaseFrame:this.pixelPainter.releasePoseFrame,position:{...this.point},scale:1,flip:false,socket:(name,frame)=>{const p=this.pixelPainter!.socket(name,frame);return p?{x:this.point.x+p.x-256,y:this.point.y+p.y-410}:undefined;}};
  const cur=this.current,foot=this.foot;
  return{art:this.asset.id,frame:cur?.name??'',position:{...this.point},scale:1,flip:false,
   socket:(name:SocketName)=>{const s=cur?.sockets[name];if(!s)return;const m=mirrorSocket(s,foot.x,cur.flipped);return{x:this.point.x+m.x-foot.x,y:this.point.y+m.y-foot.y};}};}
 duration(action:string){return nativeFrameCache(this.scene).duration(this.asset,action)??this.asset.actions[action]?.duration??1.5;}
 diagnostics(){return{id:this.asset.id,profile:nativeProfileFor(this.asset,'idle','default'),frame:this.current?.name??'',flip:this.current?.flipped??false,visible:this.sprite.visible,rendered:this.rendered,skipped:this.skipped,errors:[...this.errors],cache:nativeFrameCache(this.scene).diagnostics()};}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.pixelPainter?.destroy();if(this.pixelTexture)this.scene.textures.remove(this.pixelTexture.key);this.sprite.destroy();}
}
