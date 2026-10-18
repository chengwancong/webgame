import type Phaser from 'phaser';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {SocketName,RenderPose} from './effect-attachments.ts';

type Point={x:number;y:number};
export type WardrobeAction='idle'|'move'|'attack'|'skill'|'projectile'|'hurt'|'death';
export type WardrobeRenderState={action:WardrobeAction;clock:number;facing:number;motionFamily?:'spear';cast?:{elapsed:number;windup:number;recovery:number};
 /** casting skill id: the native rig plays its authored motion (skill-motion-map) */ skill?:string;
 /** player's reduced-motion setting: authored motions play in place */ reducedMotion?:boolean};
export type WardrobePart={name:string;slot:string;matrix:number[];width:number;height:number;color:number[]};
export type WardrobeFrame={parts:WardrobePart[];drawOrder:string[];sockets:Record<string,number[]|Point>};
export type WardrobeMotion={duration:number;count:number;fps:number;impactTime:number;frames:WardrobeFrame[]};
type MotionFile={actions:Record<string,WardrobeMotion>};
type WeaponSocketMetadata={weapon?:number[];muzzle?:number[];attachment?:'weapon'|'front_hand'|'back_hand';fallback?:'hand';handPolicy?:'leading-hand';backHand?:WeaponSocketMetadata};
type Manifest={schemaVersion:number;setUrlTemplate:string;shippedSets:string[];motions:Record<string,{url:string}>;referenceHeight:number;ground:number[];nativeFacing:'left'|'right';displayHeight:number;styleOverrides?:Record<string,Record<string,Record<string,string>>>;weaponSockets?:Record<string,WeaponSocketMetadata>;handSockets?:Record<string,WeaponSocketMetadata>};
type Bundle={appearance:ResolvedAppearance;motion:MotionFile;images:Map<string,HTMLImageElement>;manifest:Manifest;key:string};
const semanticParts:Record<string,string[]>={head:['face'],body:['body'],hands:['front_arm','back_arm','front_hand','back_hand'],legs:['waist','front_leg','back_leg'],feet:['front_foot','back_foot'],back:['back_parts'],weapon:['weapon','back_sield']};
const jsonCache=new Map<string,Promise<unknown>>(),imageCache=new Map<string,Promise<HTMLImageElement>>();
function json<T>(url:string):Promise<T>{let pending=jsonCache.get(url);if(!pending){pending=fetch(url).then(async response=>{if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);return response.json();}).catch(error=>{jsonCache.delete(url);throw error;});jsonCache.set(url,pending);}return pending as Promise<T>;}
function bitmap(url:string){let pending=imageCache.get(url);if(!pending){pending=new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>{image.src='';reject(new Error(`${url}: decode timeout`));},20000);image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(new Error(`${url}: image load failed`));};image.src=url;}).catch(error=>{imageCache.delete(url);throw error;});imageCache.set(url,pending);}return pending;}
export function appearanceRenderKey(appearance:ResolvedAppearance){return JSON.stringify([appearance.rig,appearance.family,appearance.styleProfile,Object.keys(semanticParts).map(slot=>(appearance.parts as Record<string,{setId:string}>)[slot]?.setId),...appearance.kit?[appearance.kit]:[]]);}
/** Maps the source impact pose exactly to the simulation release time. */
export function wardrobeFrameIndex(motion:WardrobeMotion,state:WardrobeRenderState){
 const last=Math.max(0,motion.frames.length-1),loop=state.action==='idle'||state.action==='move';
 let time=state.clock;
 if(state.cast){const c=state.cast,impact=Math.max(0,Math.min(motion.duration,motion.impactTime));time=c.elapsed<=c.windup?impact*Math.max(0,c.elapsed)/Math.max(.000001,c.windup):impact+(motion.duration-impact)*Math.min(1,(c.elapsed-c.windup)/Math.max(.000001,c.recovery));}
 else if(loop)time=((time%motion.duration)+motion.duration)%motion.duration;
 return Math.max(0,Math.min(last,Math.floor(time*motion.fps+1e-7)));
}
const point=(value:number[]|Point|undefined):Point=>Array.isArray(value)?{x:value[0],y:value[1]}:value??{x:0,y:0};
/** Source PNG pixels go through precisely the same centering, sizing and affine matrix as drawImage. */
export function wardrobePartSocket(part:WardrobePart,pixel:number[],image:{width:number;height:number}):Point|undefined{
 if(pixel.length!==2||!pixel.every(Number.isFinite)||!(image.width>0&&image.height>0))return;
 const x=pixel[0]/image.width*part.width-part.width/2,y=pixel[1]/image.height*part.height-part.height/2,m=part.matrix;
 return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};
}
function validateMotion(motion:MotionFile,url:string){
 for(const name of ['idle','move','attack','skill','projectile','hurt','death']){
  const action=motion.actions?.[name];if(!action?.frames?.length||!Number.isFinite(action.fps)||action.fps<=0||!Number.isFinite(action.duration)||action.duration<=0||!Number.isFinite(action.impactTime))throw new Error(`${url}: invalid ${name} animation`);
  for(const frame of action.frames){
   if(!Array.isArray(frame.parts)||!Array.isArray(frame.drawOrder)||!frame.sockets)throw new Error(`${url}: invalid ${name} pose`);
   for(const part of frame.parts)if(part.matrix?.length!==6||!part.matrix.every(Number.isFinite)||!(part.width>0&&part.height>0))throw new Error(`${url}: invalid ${name}/${part.name} transform`);
   for(const partName of Object.values(semanticParts).flat())if(!frame.parts.some(part=>part.name===partName)||!frame.drawOrder.includes(partName))throw new Error(`${url}: missing ${name}/${partName} part`);
   for(const socketName of ['feet','chest','hand','muzzle','weapon']){const socket=frame.sockets[socketName],p=point(socket);if(!socket||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error(`${url}: missing ${name}/${socketName} socket`);}
  }
 }
}

/** All requested parts decode before commit; stale requests can never replace a newer outfit. */
export class WardrobePreview{
 private alternateMotion?:MotionFile;private activeMotion?:MotionFile;
 protected bundle?:Bundle;private requested='';private generation=0;private dead=false;
 private frame?:WardrobeFrame;private action:WardrobeAction='idle';private index=0;private flipped=false;
 private drawKey='';private retryAfter=0;private options={height:220,footX:.5,footY:.8,hideWeapon:false};
 readonly errors:string[]=[];pending=false;
 constructor(readonly canvas:HTMLCanvasElement,options?:Partial<{height:number;footX:number;footY:number;hideWeapon:boolean}>){Object.assign(this.options,options);}
 async setAppearance(appearance:ResolvedAppearance):Promise<boolean>{
  if(this.dead)return false;const key=appearanceRenderKey(appearance);if(key===this.requested){
   if(this.bundle?.key===key){this.bundle.appearance.revision=appearance.revision;return true;}
   if(this.pending||Date.now()<this.retryAfter)return false;
  }
  appearance=structuredClone(appearance);this.requested=key;const generation=++this.generation;this.pending=true;let motionUrl:string|undefined;
  try{
   const manifest=await json<Manifest>('/art/wardrobe/manifest.json');
   motionUrl=manifest.motions[appearance.family]?.url;if(!motionUrl)throw new Error(`Unknown motion family ${appearance.family}`);
   const images=new Map<string,HTMLImageElement>();
   const [motion]=await Promise.all([json<MotionFile>(motionUrl),...Object.entries(semanticParts).flatMap(([slot,names])=>names.map(async name=>{
    const setId=(appearance.parts as Record<string,{setId:string}>)[slot]?.setId;
    if(!manifest.shippedSets.includes(setId))throw new Error(`Unshipped wardrobe set ${setId}`);
    const url=manifest.styleOverrides?.[appearance.styleProfile]?.[setId]?.[name]??manifest.setUrlTemplate.replace('{setId}',setId).replace('{part}',name);
    images.set(name,await bitmap(url));
   }))]);
   validateMotion(motion,motionUrl);
   this.alternateMotion=undefined;if(appearance.family==='magic'&&manifest.motions.spear){try{const alternate=await json<MotionFile>(manifest.motions.spear.url);validateMotion(alternate,manifest.motions.spear.url);this.alternateMotion=alternate;}catch{/* D4: retain the accepted original family; body offsets remain available. */}}
   if(this.dead||generation!==this.generation)return false;
   this.bundle={appearance,motion,images,manifest,key};this.drawKey='';this.pending=false;return true;
  }catch(error){if(generation!==this.generation||this.dead)return false;if(motionUrl)jsonCache.delete(motionUrl);this.pending=false;this.retryAfter=Date.now()+5000;this.errors.push(String(error));if(this.errors.length>8)this.errors.shift();console.error('[wardrobe] Outfit retained; resource failure',error);return false;}
 }
 render(state:WardrobeRenderState):boolean{
  const bundle=this.bundle;if(!bundle||this.dead)return false;
  const action=state.action;this.activeMotion=state.motionFamily==='spear'&&bundle.appearance.family==='magic'&&this.alternateMotion?this.alternateMotion:bundle.motion;const motion=this.activeMotion.actions[action];if(!motion?.frames.length)return false;
  const index=wardrobeFrameIndex(motion,state),flipped=(bundle.manifest.nativeFacing==='left'?-1:1)*state.facing<0;
  const key=`${bundle.key}:${state.motionFamily??'native'}:${action}:${index}:${flipped}:${this.canvas.width}:${this.canvas.height}`;
  this.action=action;this.index=index;this.flipped=flipped;this.frame=motion.frames[index];if(this.drawKey===key)return false;this.drawKey=key;
  const ctx=this.canvas.getContext('2d');if(!ctx)throw new Error('Wardrobe requires a 2D canvas');ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  const scale=this.options.height/bundle.manifest.referenceHeight,feet=point(bundle.manifest.ground);
  ctx.save();ctx.translate(this.canvas.width*this.options.footX,this.canvas.height*this.options.footY);ctx.scale(scale*(flipped?-1:1),-scale);ctx.translate(-feet.x,-feet.y);
  const parts=new Map(this.frame.parts.map(part=>[part.name,part]));
  for(const name of this.frame.drawOrder){if(this.options.hideWeapon&&['weapon','back_sield'].includes(name))continue;const part=parts.get(name),image=bundle.images.get(name);if(!part||!image)continue;
   const m=part.matrix;ctx.save();ctx.transform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.globalAlpha=part.color?.[3]??1;
   ctx.drawImage(image,-part.width/2,-part.height/2,part.width,part.height);ctx.restore();
  }
  ctx.restore();return true;
 }
 /** Points use the same source frame, origin and mirror transform as the actual render. */
 private sourceSocket(frame:WardrobeFrame,name:SocketName):{point:Point;source:string}{
  if(this.bundle&&(name==='weapon'||name==='muzzle')){
   const bundle=this.bundle,weaponSet=bundle.appearance.parts.weapon.setId,weaponMetadata=bundle.manifest.weaponSockets?.[weaponSet],attachment=weaponMetadata?.attachment??'weapon',hand=attachment!=='weapon';
   const setId=hand?bundle.appearance.parts.hands.setId:weaponSet,metadata=hand?bundle.manifest.handSockets?.[setId]:weaponMetadata;
   const candidate=(partName:string,calibration:WeaponSocketMetadata|undefined)=>{const part=frame.parts.find(part=>part.name===partName),image=bundle.images.get(partName),pixel=calibration?.[name];if(!pixel||!part||!image)return;const transformed=wardrobePartSocket(part,pixel,{width:image.naturalWidth,height:image.naturalHeight});return transformed?{point:transformed,source:`part:${partName}/${setId}/${name}`}:undefined;};
   const front=candidate(attachment,metadata);
   if(hand&&weaponMetadata?.handPolicy==='leading-hand'){
    const candidates=[front,candidate('back_hand',metadata?.backHand)].filter((item):item is {point:Point;source:string}=>Boolean(item)),forward=bundle.manifest.nativeFacing==='left'?-1:1;
    if(candidates.length)return candidates.reduce((lead,item)=>(item.point.x-lead.point.x)*forward>0?item:lead);
   }else if(front)return front;
   if(hand||weaponMetadata?.fallback==='hand')return {point:point(frame.sockets.hand),source:'source-hand:unarmed:missing-part-metadata'};
   return {point:point(frame.sockets[name]),source:`source-grip:${name}:missing-part-metadata`};
  }
  return {point:point(frame.sockets[name]),source:`source:${name}`};
 }
 socket(name:SocketName,frameName?:string):Point|undefined{
  if(!this.bundle||!this.frame)return;let frame=this.frame;
  const match=frameName&&/^(?:wardrobe-)?(\w+)_(\d+)$/.exec(frameName);
  if(match)frame=(this.activeMotion??this.bundle.motion).actions[match[1]]?.frames[Number(match[2])]??frame;
  const source=this.sourceSocket(frame,name).point,feet=point(this.bundle.manifest.ground),scale=this.options.height/this.bundle.manifest.referenceHeight;
  return {x:this.canvas.width*this.options.footX+(source.x-feet.x)*scale*(this.flipped?-1:1),y:this.canvas.height*this.options.footY-(source.y-feet.y)*scale};
 }
 get ready(){return Boolean(this.bundle);}
 get mirrored(){return this.flipped;}
 get frameName(){return `wardrobe-${this.action}_${this.index}`;}
 actionDuration(action:WardrobeAction){return this.bundle?.motion.actions[action]?.duration;}
 releaseFrame(action:WardrobeAction){const motion=(this.activeMotion??this.bundle?.motion)?.actions[action];return motion?`wardrobe-${action}_${wardrobeFrameIndex(motion,{action,clock:0,facing:1,cast:{elapsed:1,windup:1,recovery:1}})}`:undefined;}
 /** Avatar uses the selected, styled head image, cropped by actual alpha bounds. */
 drawPortrait(target:HTMLCanvasElement):boolean{
  const image=this.bundle?.images.get('face'),ctx=target.getContext('2d');if(!image||!ctx)return false;
  const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;const pixels=source.getContext('2d')!;pixels.drawImage(image,0,0);
  const rgba=pixels.getImageData(0,0,source.width,source.height).data;let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(rgba[(y*source.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  ctx.clearRect(0,0,target.width,target.height);if(right<left||bottom<top)return false;
  const width=right-left+1,height=bottom-top+1,scale=Math.min(target.width/width,target.height/height)*.92;
  ctx.drawImage(source,left,top,width,height,(target.width-width*scale)/2,(target.height-height*scale)/2,width*scale,height*scale);return true;
 }
 diagnostics(){const names=['feet','chest','hand','muzzle','weapon'] as SocketName[];return {ready:this.ready,pending:this.pending,key:this.bundle?.key,family:this.bundle?.appearance.family,revision:this.bundle?.appearance.revision,frame:this.frameName,flip:this.flipped,parts:this.bundle?Object.fromEntries(Object.entries(this.bundle.appearance.parts).map(([slot,item])=>[slot,item.setId])):null,partCount:this.bundle?.images.size??0,drawOrder:this.frame?.drawOrder,errors:[...this.errors],sockets:Object.fromEntries(names.map(name=>[name,this.socket(name)])),socketSources:Object.fromEntries(names.map(name=>[name,this.frame?this.sourceSocket(this.frame,name).source:null]))};}
 destroy(){this.dead=true;this.generation++;this.bundle=undefined;this.frame=undefined;this.pending=false;}
}

let renderSerial=0;
export class WardrobeRenderer extends WardrobePreview{
 readonly sprite:Phaser.GameObjects.Image;private texture:Phaser.Textures.CanvasTexture;private position:Point={x:0,y:0};
 constructor(private scene:Phaser.Scene){
  const key=`wardrobe-live-${++renderSerial}`,texture=scene.textures.createCanvas(key,512,512)!;
  super(texture.canvas,{height:96,footX:.5,footY:.75});this.texture=texture;
  this.sprite=scene.add.image(0,0,key).setOrigin(.5,.75).setVisible(false);
 }
 update(state:WardrobeRenderState,position:Point){this.position=position;const changed=this.render(state);if(changed)this.texture.refresh();this.sprite.setPosition(position.x,position.y).setDepth(position.y+2).setVisible(this.ready);}
 pose():RenderPose|undefined{if(!this.ready)return;return {art:'hero',frame:this.frameName,position:this.position,scale:1,flip:this.mirrored,socket:(name,frame)=>{const p=this.socket(name,frame);return p?{x:this.position.x+p.x-this.canvas.width*.5,y:this.position.y+p.y-this.canvas.height*.75}:undefined;}};}
 override destroy(){super.destroy();this.sprite.destroy();this.scene.textures.remove(this.texture.key);}
}
