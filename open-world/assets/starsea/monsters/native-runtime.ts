import {AssetManager,AtlasAttachmentLoader,SkeletonJson,Skin,Skeleton,AnimationState,AnimationStateData,SceneRenderer,Physics,Vector2,RegionAttachment,TextureAtlas,Color} from '@esotericsoftware/spine-webgl';
type Config=any;
let renderer:SceneRenderer,manager:AssetManager,data:any,accessories:TextureAtlas;
const canvas=document.querySelector('canvas')! as HTMLCanvasElement;
const gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true})!;
renderer=new SceneRenderer(canvas,gl,true);manager=new AssetManager(renderer.context);
const base='/art/mini-hero/navy/';
manager.loadText(base+'Character.json');manager.loadTextureAtlas(base+'Character.atlas');
manager.loadTextureAtlas('/art/starsea/monsters/sources/accessories.atlas');
await manager.loadAll();
data=new SkeletonJson(new AtlasAttachmentLoader(manager.get(base+'Character.atlas'))).readSkeletonData(JSON.parse(manager.get(base+'Character.json')));
accessories=manager.get('/art/starsea/monsters/sources/accessories.atlas');
function setup(config:Config){
 const skin=new Skin('starsea-'+config.id);
 const headwearCalibration:any[]=[];
 for(const name of config.skins){const source=data.findSkin(name);if(!source)throw Error('Missing skin '+name);skin.addSkin(source);}
 for(const name of ['RIGHTHAND','LEFTHAND','shield_L']){const bone=data.findBone(name);if(!skin.bones.includes(bone))skin.bones.push(bone);}
 for(const overlay of config.overlays??[]){
  const slotName=overlay.slot??(overlay.bone==='head'?(overlay.asset==='engine-mask'?'head':'hair'):overlay.bone);
  const slot=data.findSlot(slotName),a=new RegionAttachment(overlay.asset,overlay.asset);
  a.region=accessories.findRegion(overlay.asset);if(!a.region)throw Error('Missing accessory '+overlay.asset);
  a.width=overlay.width;a.height=overlay.height;a.x=overlay.x+overlay.width*(.5-overlay.pivot[0]);a.y=overlay.y+overlay.height*(overlay.pivot[1]-.5);
  a.rotation=overlay.rotation??0;
  if(overlay.fitToRegion){
   const fit=overlay.fitToRegion,sourceSlot=data.findSlot(fit.slot),original=skin.getAttachment(sourceSlot.index,sourceSlot.attachmentName);
   if(!(original instanceof RegionAttachment))throw Error('Headwear needs original RegionAttachment '+fit.slot);
   const region=original.region!,[u,v]=fit.visiblePoint,[au,av]=fit.accessoryPoint;
   const px=region.offsetX+region.width*u,py=region.originalHeight-region.offsetY-region.height+region.height*v;
   const lx=(px/region.originalWidth-.5)*original.width*original.scaleX,ly=(.5-py/region.originalHeight)*original.height*original.scaleY;
   const angle=original.rotation*Math.PI/180,sourcePoint={x:original.x+lx*Math.cos(angle)-ly*Math.sin(angle),y:original.y+lx*Math.sin(angle)+ly*Math.cos(angle)};
   a.rotation=original.rotation;const r=a.rotation*Math.PI/180,ax=(au-.5)*a.width,ay=(.5-av)*a.height;
   a.x=sourcePoint.x-(ax*Math.cos(r)-ay*Math.sin(r));a.y=sourcePoint.y-(ax*Math.sin(r)+ay*Math.cos(r));
   headwearCalibration.push({slot:sourceSlot.name,attachment:original.name,region:region.name,sourceSize:[region.originalWidth,region.originalHeight],visibleTrim:{x:region.offsetX,top:region.originalHeight-region.offsetY-region.height,width:region.width,height:region.height},visiblePoint:[u,v],accessoryPoint:[au,av],sourceLocalPoint:sourcePoint,accessoryLocalCenter:{x:a.x,y:a.y},accessorySize:[a.width,a.height],rotation:a.rotation,policy:'painted horn roots overlap forehead inside original visible trim'});
  }
  a.updateRegion();skin.setAttachment(slot.index,slot.attachmentName,a);
 }
 const skeleton=new Skeleton(data);skeleton.setSkin(skin);skeleton.setSlotsToSetupPose();
 for(const overlay of config.overlays??[]){if(overlay.slot){const slot=skeleton.findSlot(overlay.slot) as any;slot.bone=skeleton.findBone(overlay.bone);}}
 const state=new AnimationState(new AnimationStateData(data));
 return {skeleton,state,headwearCalibration};
}
let actor:any,config:Config,current='',clock=0;
function seek(action:string,time:number){
 if(action!==current||time<clock){actor=setup(config);actor.state.setAnimation(0,config.actions[action],false);current=action;clock=0;
 actor.state.apply(actor.skeleton);actor.skeleton.updateWorldTransform(Physics.reset);}
 while(clock<time-1e-6){const step=Math.min(1/60,time-clock);actor.state.update(step);actor.skeleton.update(step);actor.state.apply(actor.skeleton);actor.skeleton.updateWorldTransform(Physics.update);clock+=step;}
 for(const [name,color] of Object.entries(config.tints??{})){const slot=actor.skeleton.findSlot(name);if(slot){const alpha=slot.color.a;slot.color.setFromString(color as string);slot.color.a=alpha;}}
 for(const [name,color] of Object.entries(config.darkTints??{})){const slot=actor.skeleton.findSlot(name);if(slot){slot.darkColor??=new Color();slot.darkColor.setFromString(color as string);}}
 // Native deaths detach gear. Respect those visibility changes rather than rendering overlays after the skeleton.
 for(const name of config.hide??[]){if(name==='head'&&config.overlays?.some((a:any)=>a.asset==='engine-mask'))continue;actor.skeleton.findSlot(name)?.setAttachment(null);}
 actor.skeleton.updateWorldTransform(Physics.pose);
}
function point(name:string){const b=actor.skeleton.findBone(name);return b?{x:b.worldX,y:b.worldY}:undefined;}
function attachmentPoint(slotName:string,pointRatio:[number,number]){
 const slot=actor.skeleton.findSlot(slotName),a=slot?.getAttachment();if(!(a instanceof RegionAttachment))return point(slotName);
 const x=(pointRatio[0]-.5)*a.width*a.scaleX,y=(pointRatio[1]-.5)*a.height*a.scaleY,r=a.rotation*Math.PI/180;
 const p=slot.bone.localToWorld(new Vector2(x*Math.cos(r)-y*Math.sin(r)+a.x,x*Math.sin(r)+y*Math.cos(r)+a.y));return {x:p.x,y:p.y};
}
function render(action:string,time:number,camera:any){
 seek(action,time);const {skeleton}=actor;
 const offset=new Vector2(),size=new Vector2();skeleton.getBounds(offset,size,[]);
 const bounds={minX:offset.x,minY:offset.y,maxX:offset.x+size.x,maxY:offset.y+size.y};
 if(camera){canvas.width=canvas.height=camera.cell;gl.viewport(0,0,camera.cell,camera.cell);renderer.camera.position.x=camera.cx;renderer.camera.position.y=camera.cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=camera.span;
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,true);renderer.end();}
 const toPixel=(p:any)=>p&&camera?[camera.cell*(.5+(p.x-camera.cx)/camera.span),camera.cell*(.5-(p.y-camera.cy)/camera.span)]:p;
 return {bounds,png:camera?canvas.toDataURL():undefined,headwearCalibration:actor.headwearCalibration,sockets:{feet:toPixel({x:config.ground[0],y:config.ground[1]}),chest:toPixel(point('spine2')),head:toPixel(point('head')),hand:toPixel(point('RIGHTHAND')),leftHand:toPixel(point('LEFTHAND')),weapon:toPixel(attachmentPoint('RIGHTHAND',[.5,.98])),muzzle:toPixel(attachmentPoint('RIGHTHAND',[.5,.86])),ground:toPixel({x:config.ground[0],y:config.ground[1]})}};
}
(window as any).monsterNative={
 ready:true,version:data.version,
 configure(c:Config){config=c;current='';clock=0;actor=setup(config);return Object.fromEntries(Object.entries(config.actions).map(([key,name])=>{const a=data.findAnimation(name as string);if(!a)throw Error('Missing animation '+name);return [key,{source:name,duration:a.duration,count:Math.max(2,Math.ceil(a.duration*30))}];}));},
 render,
};
