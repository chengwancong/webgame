import Phaser from 'phaser';
export class VfxPool{
 private nodes=new Map<string,Phaser.GameObjects.Image|Phaser.GameObjects.Graphics>();private freeImages:Phaser.GameObjects.Image[]=[];private freeGraphics:Phaser.GameObjects.Graphics[]=[];private used=new Set<string>();private decor=0;private peakActive=0;private peakDropped=0;created=0;culled=0;dropped=0;
 constructor(private scene:Phaser.Scene,private budget=96){}
 begin(){this.used.clear();this.decor=0;this.culled=0;this.dropped=0;}
 visible(x:number,y:number,pad=300){const r=this.scene.cameras.main.worldView;const yes=x>=r.x-pad&&x<=r.right+pad&&y>=r.y-pad&&y<=r.bottom+pad;if(!yes)this.culled++;return yes;}
 image(key:string,texture:string,frame:string|number,critical=true){if(!critical&&this.decor++>=this.budget){this.dropped++;return undefined;}let node=this.nodes.get(key) as Phaser.GameObjects.Image|undefined;if(!node){node=this.freeImages.pop()??this.makeImage();this.nodes.set(key,node);}this.used.add(key);return node.setTexture(texture,frame).setCrop().setVisible(true).setActive(true).setAlpha(1).clearTint().setFlip(false,false).setRotation(0).setBlendMode(Phaser.BlendModes.NORMAL).setData('vfx-key',key);}
 graphics(key:string,depth:number,critical=true){if(!critical&&this.decor++>=this.budget){this.dropped++;return undefined;}let node=this.nodes.get(key) as Phaser.GameObjects.Graphics|undefined;if(!node){node=this.freeGraphics.pop()??this.makeGraphics();this.nodes.set(key,node);}this.used.add(key);return node.clear().setVisible(true).setActive(true).setDepth(depth).setAlpha(1).setPosition(0,0).setRotation(0).setBlendMode(Phaser.BlendModes.NORMAL).setData('vfx-key',key);}
 private makeImage(){this.created++;return this.scene.add.image(0,0,'__WHITE');}
 private makeGraphics(){this.created++;return this.scene.add.graphics();}
 end(){for(const [key,node]of this.nodes)if(!this.used.has(key)){node.setVisible(false).setActive(false);this.nodes.delete(key);if(node instanceof Phaser.GameObjects.Image)this.freeImages.push(node);else this.freeGraphics.push(node);}this.peakActive=Math.max(this.peakActive,this.nodes.size);this.peakDropped=Math.max(this.peakDropped,this.dropped);}
 clear(){this.used.clear();this.end();}
 destroy(){for(const node of [...this.nodes.values(),...this.freeImages,...this.freeGraphics])node.destroy();this.nodes.clear();this.freeImages=[];this.freeGraphics=[];}
 stats(){return {active:this.nodes.size,allocated:this.created,pooled:this.freeImages.length+this.freeGraphics.length,culled:this.culled,dropped:this.dropped,peakActive:this.peakActive,peakDropped:this.peakDropped};}
 images(){return [...this.nodes.values()].filter(n=>n instanceof Phaser.GameObjects.Image).map(n=>{const a=n as Phaser.GameObjects.Image;return {key:a.getData('vfx-key'),texture:a.texture.key,frame:a.frame.name,x:a.x,y:a.y,depth:a.depth,scale:[a.scaleX,a.scaleY]};});}
}
