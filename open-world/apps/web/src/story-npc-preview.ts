import {MiniNativePreview} from './mini-native-renderer.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {WardrobeRenderState} from './wardrobe-renderer.ts';
import manifest from '../../../packages/asset-manifest/story-npcs.json';
import {PixelActorPainter} from './pixel-actor.ts';
import {pixelRuntime} from './pixel-texture.ts';

/** Reuses the hero's complete native rig; profession tools follow the actual hand bone. */
export class StoryNpcPreview {
 private native:MiniNativePreview;private tool?:HTMLImageElement;private errors:string[]=[];private toolDrawn=false;
 private nativeCanvas:HTMLCanvasElement;private pixel:PixelActorPainter;private pixelShown=false;
 constructor(readonly canvas:HTMLCanvasElement,id:string,options?:Partial<{height:number;footX:number;footY:number}>){
  const profile=manifest.npcs[id as keyof typeof manifest.npcs];if(!profile)throw Error('Unregistered NPC '+id);
  this.nativeCanvas=document.createElement('canvas');this.nativeCanvas.width=canvas.width;this.nativeCanvas.height=canvas.height;
  this.native=new MiniNativePreview(this.nativeCanvas,{height:100,footX:.5,footY:.82,...options,profileUrl:profile.profile});
  this.pixel=new PixelActorPainter(canvas,{height:100,footX:.5,footY:.82,...options});this.pixel.request('story-npc:'+id);
  if(profile.toolPath){const image=new Image();image.src=profile.toolPath;this.tool=image;void image.decode().catch(error=>this.errors.push(String(error)));}
 }
 setAppearance(appearance:ResolvedAppearance){return this.native.setAppearance(appearance);}
 render(state:WardrobeRenderState){
  if(pixelRuntime.cellStage>0&&this.pixel.supports(state.action)){if(!this.pixelShown)this.pixel.reset();this.pixelShown=true;return this.pixel.render(state);}
  const restored=this.pixelShown;this.pixelShown=false;const changed=this.native.render(state);if(!changed&&!restored)return false;
  const target=this.canvas.getContext('2d')!;target.clearRect(0,0,this.canvas.width,this.canvas.height);target.drawImage(this.nativeCanvas,0,0);
  if(this.tool?.complete&&this.tool.naturalWidth){
  const hand=this.native.bonePose('RIGHTHAND'),ctx=this.canvas.getContext('2d');if(hand&&ctx){ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(hand.rotation+Math.PI);ctx.scale(hand.mirrored?-1:1,1);const size=42;ctx.drawImage(this.tool,-size*.27,-size*.75,size,size);ctx.restore();this.toolDrawn=true;}
 }return true;}
 get ready(){return pixelRuntime.cellStage>0&&this.pixel.ready||this.native.ready&&(!this.tool||(this.tool.complete&&this.tool.naturalWidth>0));}
 get authoredPixelArt(){return this.pixelShown;}
 diagnostics(){return {...this.native.diagnostics(),ready:this.ready,tool:this.tool?{drawn:this.toolDrawn,hand:this.native.bonePose('RIGHTHAND')}:null,errors:[...this.native.errors,...this.errors]};}
 destroy(){this.pixel.destroy();this.native.destroy();this.tool=undefined;}
}
