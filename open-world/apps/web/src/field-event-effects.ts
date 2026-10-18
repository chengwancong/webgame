import Phaser from 'phaser';
import {starseaAsset,starseaTexture} from './starsea-runtime-assets.ts';
import {project} from './iso.ts';
export type FieldEventEffect={id:string;resource:string;x:number;y:number;startedTick:number};
type Node={image?:Phaser.GameObjects.Image;shape:Phaser.GameObjects.Graphics};
/** Plays the accepted registered texture/procedural timeline. It consumes
 * server instance transitions and never starts or completes an activity. */
export class FieldEventEffects{
 private nodes=new Map<string,Node>();
 constructor(private scene:Phaser.Scene){}
 draw(effects:readonly FieldEventEffect[],tick:number){
  const used=new Set<string>();for(const effect of effects){const asset=starseaAsset(effect.resource);if(!asset||asset.runtime.kind!=='effect')throw Error('Unregistered field event effect '+effect.resource);const r=asset.runtime as typeof asset.runtime&{duration:number;scale:[number,number];alpha:[number,number];texture?:string;color?:string;pillar?:boolean};const age=Math.max(0,(tick-effect.startedTick)/30),t=age/r.duration;if(t>1)continue;used.add(effect.id);let node=this.nodes.get(effect.id);if(!node){node={shape:this.scene.add.graphics()};if(r.texture)node.image=this.scene.add.image(0,0,starseaTexture(r.texture));this.nodes.set(effect.id,node);}const at=project(effect),size=r.scale[0]+(r.scale[1]-r.scale[0])*t,alpha=r.alpha[0]+(r.alpha[1]-r.alpha[0])*t,color=Number.parseInt((r.color??'#3d88bd').slice(1),16);node.image?.setPosition(at.x,at.y).setDisplaySize(140*size,80*size).setAlpha(alpha).setDepth(at.y+2);node.shape.clear().setDepth(at.y+3).lineStyle(2,color,alpha).strokeEllipse(at.x,at.y,110*size,62*size);if(r.pillar)node.shape.fillStyle(color,alpha*.25).fillRect(at.x-19,at.y-140,38,140);}
  for(const [id,node]of this.nodes)if(!used.has(id)){node.image?.destroy();node.shape.destroy();this.nodes.delete(id);}
 }
 destroy(){for(const node of this.nodes.values()){node.image?.destroy();node.shape.destroy();}this.nodes.clear();}
}
