import type Phaser from 'phaser';

/** World-only 640x360 render target; text keeps the existing full-resolution camera. */
export class PixelWorldTarget{
 target:Phaser.GameObjects.RenderTexture;
 private masked=new Map<Phaser.GameObjects.GameObject,number>();
 private previousRound:boolean;
 private main:Phaser.Cameras.Scene2D.Camera;
 private restoreMasks=()=>{
  const id=this.main.id;
  for(const [object,old] of this.masked)if(object.scene)object.cameraFilter=(object.cameraFilter&~id)|old;
  this.masked.clear();
 };
 constructor(private scene:Phaser.Scene){
  this.main=scene.cameras.main;this.previousRound=this.main.roundPixels;scene.cameras.main.roundPixels=true;
  this.target=this.createTarget();
  // Camera filters also gate input: keep the world masked only during rendering.
  scene.events.on('render',this.restoreMasks);
 }
 private createTarget(){
  const target=this.scene.add.renderTexture(0,0,640,360).setOrigin(0).setScrollFactor(0).setScale(2).setDepth(-30000).setData('pixel-authored',true);
  target.texture.setFilter(1);target.camera.setZoom(.5);target.camera.roundPixels=true;return target;
 }
 render(){
  this.restoreMasks();
  // Region rebuilds destroy the scene display list, including this compositor.
  if(!this.target.scene||!this.target.camera)this.target=this.createTarget();
  const main=this.main,id=main.id,roots=this.scene.children.list.filter(o=>o!==this.target&&o.type!=='Text');
  const walk=(object:Phaser.GameObjects.GameObject)=>{
   if(!this.masked.has(object))this.masked.set(object,object.cameraFilter&id);
   if(object.type!=='Text'&&!this.masked.get(object))object.cameraFilter&=~id;else object.cameraFilter|=id;
   const children=(object as Phaser.GameObjects.Container).list;if(children)for(const child of children)walk(child);
  };
  for(const root of roots)walk(root);
  const capture=this.target.camera as Phaser.Cameras.Scene2D.Camera,zoomX=main.zoomX,zoomY=main.zoomY;
  Object.assign(capture,{id});capture.setScroll(main.scrollX,main.scrollY);
  // Match the main camera's zoom pivot, including scrollFactor=0 backgrounds/HUD.
  // The main backing resolution changes with the window; this target stays 640x360.
  capture.setOrigin(main.width*main.originX*(1-zoomX)/(640*zoomX),main.height*main.originY*(1-zoomY)/(360*zoomY));
  this.target.setPosition(main.width*main.originX*(1-1/zoomX),main.height*main.originY*(1-1/zoomY));
  let rendered=false;
  try{
   this.target.clear();this.target.draw(roots.filter(object=>object.willRender(capture)));
   // Phaser 4 draw() only enqueues. The default RenderTexture mode does not flush.
   // Flush now, while nested world objects are unmasked and Text remains excluded.
   this.target.render();rendered=true;

  }
  finally{if(rendered){for(const [object] of this.masked)if(object.scene)object.cameraFilter|=id;}else this.restoreMasks();}
 }
 destroy(){
  this.scene.events.off('render',this.restoreMasks);this.restoreMasks();this.target.destroy();
  this.main.roundPixels=this.previousRound;
 }
}
