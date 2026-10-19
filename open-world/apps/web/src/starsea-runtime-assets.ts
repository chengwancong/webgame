import {materialCanvas,type ThemeMaterial} from './open-world-five-art-data.ts';
import {openWorldRuntimeAssets} from '../../../packages/asset-manifest/open-world-assets.ts';
import Phaser from 'phaser';
import bundle from '../../../packages/asset-manifest/starsea.v1.json';
import {StarseaActorPreview} from './starsea-actor-preview.ts';
import {loadJSON,type Asset,type Point,type PropState} from './starsea-assets.ts';
import type {SocketName,RenderPose} from './effect-attachments.ts';
import {runtimeResources} from '../../../packages/asset-manifest/runtime-resources.ts';
import {registerLoadedActorAnimations} from './loaded-actor-animations.ts';

export type StarseaPhase='default'|'phase-enter'|'phase-active'|'phase-end';
export type StarseaSceneObject={id:string;artId:string;position:Point;reach?:number;state?:string;enabled?:boolean;label?:string;name?:string;npcId?:string;action?:string;facing?:number;phase?:StarseaPhase;actionStartedTick?:number};
export type StarseaSceneActor={id:string;artId?:string;position?:Point;state?:string;enabled?:boolean;label?:string;npcId?:string;action?:string;skillId?:string;phase?:StarseaPhase;actionStartedTick?:number;phaseStartedTick?:number;cast?:{elapsed:number;windup:number;recovery:number}};
export type StarseaSceneView={effects?:readonly import('./field-event-effects.ts').FieldEventEffect[];guide?:{x:number;y:number;label:string};prompt?:{x:number;y:number;text:string;objectId?:string};objects?:readonly StarseaSceneObject[];actors?:readonly StarseaSceneActor[]};
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
  if(r.kind==='prop'){if(r.file)files.add(r.file);for(const variant of r.variants??[])files.add(variant.file);for(const state of Object.values(r.states??{}))if(state.file)files.add(state.file);}
 }
 for(const file of files)if(!scene.textures.exists(starseaTexture(file)))scene.load.image(starseaTexture(file),file);
}
export function createStarseaAnimations(scene:Phaser.Scene){registerLoadedActorAnimations(scene,starseaAssets.values());}
export function starseaAtlasFrame(id:string,action:string,clock:number){const r=starseaAsset(id)?.runtime,clip=r?.actions?.[action];if(!clip)return;const index=Math.max(0,Math.floor(clock*clip.fps));return clip.frames[clip.loop?index%clip.frames.length:Math.min(index,clip.frames.length-1)];}
export function starseaAtlasSocket(scene:Phaser.Scene,id:string,frame:string,name:SocketName,position:Point,scale:number,flip:boolean):Point|undefined{
 const asset=starseaAsset(id),match=/^(.+)_(\d+)$/.exec(frame),data=scene.cache.json.get(id+':sockets') as {actions:Record<string,Record<string,[number,number]>[]>}|undefined;
 if(!asset||!match||!data)return;const point=data.actions[match[1]]?.[Number(match[2])]?.[name];if(!point)return;
 const anchor=asset.runtime.anchor!,size=asset.runtime.frameSize!;return{x:position.x+(point[0]-anchor[0]*size)*scale*(flip?-1:1),y:position.y+(point[1]-anchor[1]*size)*scale};
}
export function starseaPropState(asset:RuntimeAsset,state?:string):PropState|undefined{const states=asset.runtime.states;if(!states)return;return state===undefined?Object.values(states)[0]:states[state];}

/** Hero and party slots are reserved before native enemies/NPCs claim a visible slot. */
export class StarseaNativeBudget{
 readonly limit=8;private used=new Set<string>();private reserved=0;private denied=0;
 begin(reserved:number){this.reserved=Math.min(this.limit,Math.max(0,reserved));this.used.clear();this.denied=0;}
 claim(id:string){if(this.used.has(id))return true;if(this.used.size+this.reserved>=this.limit){this.denied++;return false;}this.used.add(id);return true;}
 diagnostics(){return{limit:this.limit,reserved:this.reserved,visible:this.used.size,total:this.used.size+this.reserved,denied:this.denied};}
}
let serial=0;
export class StarseaNativeActor{
 readonly sprite:Phaser.GameObjects.Sprite;private texture:Phaser.Textures.CanvasTexture;private painter:StarseaActorPreview;
 private request='';private loaded=false;private destroyed=false;private generation=0;private lastDraw='';private errors:string[]=[];private rendered=0;private skipped=0;
 private point:Point={x:0,y:0};readonly foot:Point={x:256,y:409.6};
 constructor(private scene:Phaser.Scene,readonly asset:RuntimeAsset){this.texture=scene.textures.createCanvas('starsea-native-live-'+(++serial),512,512)!;this.painter=new StarseaActorPreview(512,512,this.foot);this.sprite=scene.add.sprite(0,0,this.texture.key).setOrigin(.5,.8).setVisible(false);}
 sync(id:string,point:Point,action:string,clock:number,facing:number,phase:StarseaPhase,budget:StarseaNativeBudget,cast?:{elapsed:number;windup:number;recovery:number}){
  this.point=point;this.sprite.setPosition(point.x,point.y).setDepth(point.y+2);
  const view=this.scene.cameras.main.worldView,padding=this.asset.runtime.displayHeight??150,visible=point.x>=view.x-padding&&point.x<=view.right+padding&&point.y>=view.y&&point.y<=view.bottom+padding;
  if(!visible||!budget.claim(id)){this.sprite.setVisible(false);this.skipped++;return;}
  if(action==='death')phase='default';
  const skill=this.asset.actions.skills?.[action],profile=action==='death'?this.asset.runtime.profile:phase==='phase-enter'||phase==='phase-end'?this.asset.states[phase]?.profile:skill?.profiles?.[phase]??skill?.profile??this.asset.states?.[phase]?.profile??this.asset.runtime.profile;
  if(this.request!==profile){this.request=profile;this.loaded=false;const generation=++this.generation;void this.painter.load(this.asset,action,phase).then(ready=>{if(!this.destroyed&&generation===this.generation){this.loaded=ready;this.lastDraw='';}}).catch(error=>{if(!this.destroyed&&generation===this.generation){this.errors.push(String(error));console.error('[starsea-native]',error);}});}
  this.sprite.setVisible(this.loaded);if(!this.loaded)return;
  const drawKey=JSON.stringify([profile,action,phase,facing,Math.floor(clock*60),cast&&[cast.elapsed,cast.windup,cast.recovery]]);if(drawKey===this.lastDraw){this.skipped++;return;}
  try{if(this.painter.render(action,clock,facing,phase,cast)){const context=this.texture.context;context.clearRect(0,0,512,512);context.drawImage(materialCanvas(this.painter.canvas,this.painter.canvas.width,this.painter.canvas.height,(this.asset.runtime as typeof this.asset.runtime&{material?:ThemeMaterial}).material),0,0);this.texture.refresh();this.rendered++;}this.lastDraw=drawKey;}catch(error){this.errors.push(String(error));console.error('[starsea-native]',error);}
 }
 pose():RenderPose{return{art:this.asset.id,frame:String(this.painter.diagnostics().native?.frame??''),position:{...this.point},scale:1,flip:false,socket:name=>{const socket=this.painter.socket(name);return socket?{x:this.point.x+socket.x-this.foot.x,y:this.point.y+socket.y-this.foot.y}:undefined;}};}
 duration(action:string){return this.painter.actionDuration(action)??this.asset.actions[action]?.duration??1.5;}
 diagnostics(){return{...this.painter.diagnostics(),visible:this.sprite.visible,rendered:this.rendered,skipped:this.skipped,errors:[...this.errors,...this.painter.diagnostics().errors]};}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.generation++;this.painter.destroy();this.sprite.destroy();this.scene.textures.remove(this.texture.key);}
}
