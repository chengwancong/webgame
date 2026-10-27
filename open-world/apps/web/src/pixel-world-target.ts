import type Phaser from 'phaser';
/** World-only 640x360 render target; text keeps the existing full-resolution camera. */
export class PixelWorldTarget{
 readonly target:Phaser.GameObjects.RenderTexture;
 private masked=new Map<Phaser.GameObjects.GameObject,number>();
 private previousRound:boolean;
 constructor(private scene:Phaser.Scene){
  this.previousRound=scene.cameras.main.roundPixels;scene.cameras.main.roundPixels=true;
  this.target=scene.add.renderTexture(0,0,640,360).setOrigin(0).setScrollFactor(0).setScale(2).setDepth(-30000);
  this.target.texture.setFilter(1);this.target.camera.setZoom(.5);this.target.camera.roundPixels=true;
 }
 render(){
  for(const [object] of this.masked)if(!object.scene)this.masked.delete(object);
  const main=this.scene.cameras.main,id=main.id,roots=this.scene.children.list.filter(o=>o!==this.target&&o.type!=='Text');
  const walk=(object:Phaser.GameObjects.GameObject)=>{
   if(!this.masked.has(object))this.masked.set(object,object.cameraFilter&id);
   if(object.type!=='Text'&&!this.masked.get(object))object.cameraFilter&=~id;else object.cameraFilter|=id;
   const children=(object as Phaser.GameObjects.Container).list;if(children)for(const child of children)walk(child);
  };
  for(const root of roots)walk(root);
  Object.assign(this.target.camera,{id});this.target.camera.setScroll(main.scrollX,main.scrollY);
  try{this.target.clear();this.target.draw(roots);}
  finally{for(const [object] of this.masked)if(object.scene)object.cameraFilter|=id;}
 }
 destroy(){
  const id=this.scene.cameras.main.id;for(const [object,old] of this.masked)if(object.scene)object.cameraFilter=(object.cameraFilter&~id)|old;
  this.masked.clear();this.target.destroy();
  this.scene.cameras.main.roundPixels=this.previousRound;
 }
}
