import type Phaser from 'phaser';
/** Split leaves between cameras; a Container must stay traversable so its Text children can render. */
export class PixelCameraMasks{
 private saved=new Map<Phaser.GameObjects.GameObject,number>();
 constructor(private main:Phaser.Cameras.Scene2D.Camera,private text:Phaser.Cameras.Scene2D.Camera){}
 apply(objects:Iterable<Phaser.GameObjects.GameObject>){
  const bits=this.main.id|this.text.id;
  const visit=(object:Phaser.GameObjects.GameObject)=>{if(!this.saved.has(object))this.saved.set(object,object.cameraFilter&bits);const old=this.saved.get(object)!,children=(object as Phaser.GameObjects.Container).list;
   if(children){object.cameraFilter=old&this.main.id?object.cameraFilter|this.text.id:object.cameraFilter&~this.text.id;for(const child of children)visit(child);}
   else if(object.type==='Text'){object.cameraFilter|=this.main.id;object.cameraFilter=old&this.main.id?object.cameraFilter|this.text.id:object.cameraFilter&~this.text.id;}
   else object.cameraFilter|=this.text.id;
  };for(const object of objects)visit(object);
 }
 restore(){const bits=this.main.id|this.text.id;for(const[object,old]of this.saved)if(object.scene)object.cameraFilter=(object.cameraFilter&~bits)|old;this.saved.clear();}
}
