import type Phaser from 'phaser';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {SocketName,RenderPose} from './effect-attachments.ts';
import {WardrobePreview,appearanceRenderKey,type WardrobeRenderState,type WardrobeAction} from './wardrobe-renderer.ts';
import {MiniNativePreview,miniSupportsAppearance} from './mini-native-renderer.ts';
import {pixelRuntime} from './pixel-texture.ts';
import {PixelActorPainter,pixelHeroKey} from './pixel-actor.ts';

type Point={x:number;y:number};
type Painter=WardrobePreview|MiniNativePreview;
const MAX_VALIDATED_FRAMES=2048;
/** Read pixels once for a resource/frame generation, rather than on every loop. */
function visibleFrame(painter:Painter,canvas:HTMLCanvasElement,state:WardrobeRenderState,validated:Set<string>){
 const key=painter.validationFrameKey||`${state.action}:${state.motionFamily??''}:${state.skill??''}:${Boolean(state.reducedMotion)}:${painter.frameName}:${painter.mirrored}:${canvas.width}:${canvas.height}`;
 if(validated.has(key))return true;
 const pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]>16){if(validated.size>=MAX_VALIDATED_FRAMES)validated.delete(validated.values().next().value!);validated.add(key);return true;}
 return false;
}

/** Commit a complete outfit atomically, keeping the last working outfit during loading. */
export class HeroPreview {
 private pixelPainter:PixelActorPainter;private pixelShown=false;private pixelKey='';
 private painter?:Painter;private painterCanvas?:HTMLCanvasElement;private loading?:Painter;private requested='';private generation=0;private dead=false;
 private pending=false;private errors:string[]=[];private retryAfter=0;private dirty=false;private lastState?:WardrobeRenderState;
 private activeKey='';private validated=new Set<string>();private validationRevision=0;
 constructor(readonly canvas:HTMLCanvasElement,private options?:Partial<{height:number;footX:number;footY:number;fitBounds:boolean}>){this.pixelPainter=new PixelActorPainter(canvas,{height:options?.height??220,footX:options?.footX??.5,footY:options?.footY??.8});}
 async setAppearance(appearance:ResolvedAppearance):Promise<boolean>{
  if(this.dead)return false;
  const key=appearanceRenderKey(appearance);
  if(this.requested===key){
   if(this.painter&&this.activeKey===key)return this.painter.setAppearance(appearance);
   if(this.pending||Date.now()<this.retryAfter)return false;
  }
  this.requested=key;const generation=++this.generation;this.pending=true;
  this.loading?.destroy();
  const nextCanvas=document.createElement('canvas');nextCanvas.width=this.canvas.width;nextCanvas.height=this.canvas.height;
  const next:Painter=miniSupportsAppearance(appearance)?new MiniNativePreview(nextCanvas,this.options):new WardrobePreview(nextCanvas,this.options);
  this.loading=next;
  try{
   const loaded=await next.setAppearance(appearance);
   if(this.dead||generation!==this.generation){next.destroy();return false;}
   if(!loaded||!next.ready)throw Error(`Outfit not ready: ${key}`);
   // Decode success alone is insufficient: a broken shader/socket/profile must never
   // hide the last working character. Validate the first frame and roll back pixels
   // synchronously before committing renderer ownership.
   const ctx=this.canvas.getContext('2d');if(!ctx)throw Error('Hero appearance requires a 2D canvas');
   const backup=document.createElement('canvas');backup.width=this.canvas.width;backup.height=this.canvas.height;
   backup.getContext('2d')!.drawImage(this.canvas,0,0);
   const validated=new Set<string>();
   try{
    const idle:WardrobeRenderState={action:'idle',clock:0,facing:this.lastState?.facing??-1};
    if(!next.render(idle)||next.diagnostics().errors.length)throw Error('First outfit frame failed to render');
    if(!visibleFrame(next,nextCanvas,idle,validated))throw Error('First outfit frame is empty');
    if(this.lastState){next.render(this.lastState);if(next.diagnostics().errors.length||!visibleFrame(next,nextCanvas,this.lastState,validated))throw Error('Current outfit pose failed to render');}
   }catch(error){ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(backup,0,0);throw error;}
   ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(nextCanvas,0,0);
   this.painter?.destroy();this.painter=next;this.painterCanvas=nextCanvas;this.activeKey=key;this.validated=validated;this.validationRevision=next.validationRevision??0;this.loading=undefined;this.pending=false;this.dirty=true;
   this.pixelKey=pixelHeroKey(appearance,miniSupportsAppearance(appearance)?'native':'wardrobe');this.pixelPainter.request(this.pixelKey,appearance);return true;
  }catch(error){
   next.destroy();if(generation!==this.generation||this.dead)return false;
   this.loading=undefined;this.pending=false;this.retryAfter=Date.now()+5000;
   this.errors.push(String(error));if(this.errors.length>8)this.errors.shift();
   console.error('[hero-appearance] Previous outfit retained',error);return false;
  }
 }
 render(state:WardrobeRenderState){
  this.lastState={...state,cast:state.cast?{...state.cast}:undefined};const painter=this.painter;
  try{
   if(pixelRuntime.cellStage>0&&this.pixelPainter.supports(state.action)){if(!this.pixelShown)this.pixelPainter.reset();const changed=this.pixelPainter.render(state);this.pixelShown=true;return changed;}
   const restorePixel=this.pixelShown;this.pixelShown=false;
   const changed=painter?.render(state)??false,revision=painter?.validationRevision??0;
   if(revision!==this.validationRevision){this.validated.clear();this.validationRevision=revision;}
   if(painter?.renderValid===false)return false;
   if((changed||restorePixel)&&painter&&this.painterCanvas){
    if(!visibleFrame(painter,this.painterCanvas,state,this.validated))return false;
    const ctx=this.canvas.getContext('2d')!;ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(this.painterCanvas,0,0);
   }
   const result=changed||this.dirty||restorePixel;this.dirty=false;return result;
  }catch(error){this.validated.clear();const message=String(error);if(this.errors.at(-1)!==message){this.errors.push(message);if(this.errors.length>8)this.errors.shift();console.error('[hero-appearance] Previous frame retained',error);}return false;}
 }
 actionDuration(action:WardrobeAction){return this.painter?.actionDuration(action);}
 socket(name:SocketName,frame?:string){return this.pixelShown?this.pixelPainter.socket(name,frame):this.painter?.socket(name,frame);}
 drawPortrait(target:HTMLCanvasElement){return this.painter?.drawPortrait(target)??false;}
 get ready(){return Boolean(this.painter?.ready);}
 get mirrored(){return this.pixelShown?this.pixelPainter.mirrored:this.painter?.mirrored??false;}
 get frameName(){return this.pixelShown?this.pixelPainter.frameName:this.painter?.frameName??'hero-idle_0';}
 get authoredPixelArt(){return this.pixelShown;}
 get releaseFrame(){return this.lastState?.cast?(this.pixelShown?this.pixelPainter.releaseFrame(this.lastState.action):this.painter?.releaseFrame(this.lastState.action)):undefined;}
 diagnostics(){const details=this.painter?.diagnostics();return {...details,key:details?.key,revision:details?.revision,ready:this.ready,pending:this.pending,errors:[...(details?.errors??[]),...this.errors]};}
 destroy(){this.dead=true;this.generation++;this.pixelPainter.destroy();this.loading?.destroy();this.painter?.destroy();this.loading=undefined;this.painter=undefined;this.activeKey='';this.validated.clear();}
}

let serial=0;
export class HeroRenderer extends HeroPreview {
 readonly sprite:Phaser.GameObjects.Image;private texture:Phaser.Textures.CanvasTexture;private position:Point={x:0,y:0};
 constructor(private scene:Phaser.Scene){
  const key=`hero-live-${++serial}`,texture=scene.textures.createCanvas(key,512,512)!;
  super(texture.canvas,{height:96,footX:.5,footY:.75});this.texture=texture;
  this.sprite=scene.add.image(0,0,key).setOrigin(.5,.75).setVisible(false);
 }
 update(state:WardrobeRenderState,position:Point){this.position=position;if(this.render(state)){this.texture.refresh();}this.sprite.setPosition(position.x,position.y).setDepth(position.y+2).setVisible(this.ready);}
 pose():RenderPose|undefined{if(!this.ready)return;return {art:'hero',frame:this.frameName,releaseFrame:this.releaseFrame,position:this.position,scale:1,flip:this.mirrored,socket:(name,frame)=>{const p=this.socket(name,frame);return p?{x:this.position.x+p.x-this.canvas.width*.5,y:this.position.y+p.y-this.canvas.height*.75}:undefined;}};}
 override destroy(){super.destroy();this.sprite.destroy();this.scene.textures.remove(this.texture.key);}
}
