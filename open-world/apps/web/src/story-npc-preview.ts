import {MiniNativePreview} from './mini-native-renderer.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {WardrobeRenderState} from './wardrobe-renderer.ts';
import manifest from '../../../packages/asset-manifest/story-npcs.json';

/** Reuses the hero's complete native rig; profession tools follow the actual hand bone. */
export class StoryNpcPreview {
 private native:MiniNativePreview;private tool?:HTMLImageElement;private errors:string[]=[];private toolDrawn=false;
 constructor(readonly canvas:HTMLCanvasElement,id:string,options?:Partial<{height:number;footX:number;footY:number}>){
  const profile=manifest.npcs[id as keyof typeof manifest.npcs];if(!profile)throw Error('Unregistered NPC '+id);
  this.native=new MiniNativePreview(canvas,{height:100,footX:.5,footY:.82,...options,profileUrl:profile.profile});
  if(profile.toolPath){const image=new Image();image.src=profile.toolPath;this.tool=image;void image.decode().catch(error=>this.errors.push(String(error)));}
 }
 setAppearance(appearance:ResolvedAppearance){return this.native.setAppearance(appearance);}
 render(state:WardrobeRenderState){const changed=this.native.render(state);if(changed&&this.tool?.complete&&this.tool.naturalWidth){
  const hand=this.native.bonePose('RIGHTHAND'),ctx=this.canvas.getContext('2d');if(hand&&ctx){ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(hand.rotation+Math.PI);ctx.scale(hand.mirrored?-1:1,1);const size=42;ctx.drawImage(this.tool,-size*.27,-size*.75,size,size);ctx.restore();this.toolDrawn=true;}
 }return changed;}
 get ready(){return this.native.ready&&(!this.tool||(this.tool.complete&&this.tool.naturalWidth>0));}
 diagnostics(){return {...this.native.diagnostics(),ready:this.ready,tool:this.tool?{drawn:this.toolDrawn,hand:this.native.bonePose('RIGHTHAND')}:null,errors:[...this.native.errors,...this.errors]};}
 destroy(){this.native.destroy();this.tool=undefined;}
}
