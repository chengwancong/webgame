import type Phaser from 'phaser';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {SocketName,RenderPose} from './effect-attachments.ts';
import {WardrobePreview,appearanceRenderKey,type WardrobeRenderState,type WardrobeAction} from './wardrobe-renderer.ts';
import {MiniNativePreview,miniSupportsAppearance} from './mini-native-renderer.ts';

type Point={x:number;y:number};
type Painter=WardrobePreview|MiniNativePreview;

/** Commit a complete outfit atomically, keeping the last working outfit during loading. */
export class HeroPreview {
 private painter?:Painter;private loading?:Painter;private requested='';private generation=0;private dead=false;
 private pending=false;private errors:string[]=[];private retryAfter=0;private dirty=false;private lastState?:WardrobeRenderState;
 constructor(readonly canvas:HTMLCanvasElement,private options?:Partial<{height:number;footX:number;footY:number;fitBounds:boolean}>){ }
 async setAppearance(appearance:ResolvedAppearance):Promise<boolean>{
  if(this.dead)return false;
  const key=appearanceRenderKey(appearance);
  if(this.requested===key){
   if(this.painter?.diagnostics().key===key)return this.painter.setAppearance(appearance);
   if(this.pending||Date.now()<this.retryAfter)return false;
  }
  this.requested=key;const generation=++this.generation;this.pending=true;
  this.loading?.destroy();
  const next:Painter=miniSupportsAppearance(appearance)?new MiniNativePreview(this.canvas,this.options):new WardrobePreview(this.canvas,this.options);
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
   try{
    if(!next.render({action:'idle',clock:0,facing:this.lastState?.facing??-1})||next.diagnostics().errors.length)throw Error('First outfit frame failed to render');
    const pixels=ctx.getImageData(0,0,this.canvas.width,this.canvas.height).data;
    let visible=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>16){visible=true;break;}
    if(!visible)throw Error('First outfit frame is empty');
    if(this.lastState){next.render(this.lastState);if(next.diagnostics().errors.length)throw Error('Current outfit pose failed to render');}
   }catch(error){ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(backup,0,0);throw error;}
   this.painter?.destroy();this.painter=next;this.loading=undefined;this.pending=false;this.dirty=true;return true;
  }catch(error){
   next.destroy();if(generation!==this.generation||this.dead)return false;
   this.loading=undefined;this.pending=false;this.retryAfter=Date.now()+5000;
   this.errors.push(String(error));if(this.errors.length>8)this.errors.shift();
   console.error('[hero-appearance] Previous outfit retained',error);return false;
  }
 }
 render(state:WardrobeRenderState){this.lastState={...state,cast:state.cast?{...state.cast}:undefined};const changed=this.painter?.render(state)??false,result=changed||this.dirty;this.dirty=false;return result;}
 actionDuration(action:WardrobeAction){return this.painter?.actionDuration(action);}
 socket(name:SocketName,frame?:string){return this.painter?.socket(name,frame);}
 drawPortrait(target:HTMLCanvasElement){return this.painter?.drawPortrait(target)??false;}
 get ready(){return Boolean(this.painter?.ready);}
 get mirrored(){return this.painter?.mirrored??false;}
 get frameName(){return this.painter?.frameName??'hero-idle_0';}
 get releaseFrame(){return this.lastState?.cast?this.painter?.releaseFrame(this.lastState.action):undefined;}
 diagnostics(){const details=this.painter?.diagnostics();return {...details,key:details?.key,revision:details?.revision,ready:this.ready,pending:this.pending,errors:[...(details?.errors??[]),...this.errors]};}
 destroy(){this.dead=true;this.generation++;this.loading?.destroy();this.painter?.destroy();this.loading=undefined;this.painter=undefined;}
}

let serial=0;
export class HeroRenderer extends HeroPreview {
 readonly sprite:Phaser.GameObjects.Image;private texture:Phaser.Textures.CanvasTexture;private position:Point={x:0,y:0};
 constructor(private scene:Phaser.Scene){
  const key=`hero-live-${++serial}`,texture=scene.textures.createCanvas(key,512,512)!;
  super(texture.canvas,{height:96,footX:.5,footY:.75});this.texture=texture;
  this.sprite=scene.add.image(0,0,key).setOrigin(.5,.75).setVisible(false);
 }
 update(state:WardrobeRenderState,position:Point){this.position=position;if(this.render(state))this.texture.refresh();this.sprite.setPosition(position.x,position.y).setDepth(position.y+2).setVisible(this.ready);}
 pose():RenderPose|undefined{if(!this.ready)return;return {art:'hero',frame:this.frameName,releaseFrame:this.releaseFrame,position:this.position,scale:1,flip:this.mirrored,socket:(name,frame)=>{const p=this.socket(name,frame);return p?{x:this.position.x+p.x-this.canvas.width*.5,y:this.position.y+p.y-this.canvas.height*.75}:undefined;}};}
 override destroy(){super.destroy();this.sprite.destroy();this.scene.textures.remove(this.texture.key);}
}
