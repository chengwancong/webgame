import type Phaser from 'phaser';
import type {VfxPool} from './vfx-pool.ts';
import manifest from '../../../packages/asset-manifest/combat-physical-fx.json';
/** Compose only registered source pixels. Rotation happens in the ground plane,
 * then the whole plane is compressed, so a horizontal spin never becomes a fan. The plane lies on the ground
 * under the hero (2026-10-16): drawn over him it hid the authored spin at its contact frame. */
export class WeaponSmear{
 constructor(private scene:Phaser.Scene,private pool:VfxPool){}
 ring(key:string,id:string,age:number,center:{x:number;y:number},width:number,height:number,alpha:number,tint:number,reduced:boolean){
  const clip=manifest.clips[id as keyof typeof manifest.clips];if(!clip||!this.pool.visible(center.x,center.y,width))return;
  const phase=reduced?0:Math.min(7,Math.floor(age)),textureKey='physical-smear-plane:'+id+':'+phase;
  if(!this.scene.textures.exists(textureKey)){
   const source=this.scene.textures.get(clip.key),frame=source.get(clip.peak),image=source.getSourceImage() as HTMLImageElement,texture=this.scene.textures.createCanvas(textureKey,512,512)!;const g=texture.context;
   for(let i=0;i<3;i++){g.save();g.translate(256,256);g.rotate(phase/7*Math.PI*2+i*Math.PI*2/3);g.drawImage(image,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,-160,-240,320,320);g.restore();}texture.refresh();
  }
  return this.pool.image(key,textureKey,'__BASE')?.setPosition(center.x,center.y).setOrigin(.5).setDisplaySize(width,height).setAlpha(alpha).setTint(tint).setDepth(center.y-1);
 }
}
