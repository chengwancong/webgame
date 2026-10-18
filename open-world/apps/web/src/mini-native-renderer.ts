import {
  Animation, AssetManager, AtlasAttachmentLoader, MeshAttachment, MixBlend,
  MixDirection, Physics, RegionAttachment, SceneRenderer, Skeleton, SkeletonData,
  SkeletonJson, Skin, TextureAtlas, Vector2, type Slot,
} from '@esotericsoftware/spine-webgl';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import type {SocketName} from './effect-attachments.ts';
import {appearanceRenderKey, type WardrobeAction, type WardrobeRenderState} from './wardrobe-renderer.ts';
import {loadMiniNativeAssets} from './mini-native-loading.ts';
import {composeNativeSkin,type NativeSkinRoles} from './native-skin-composition.ts';
import {nativeStaffMotion} from './physical-actions.ts';
import {STILL,installSkillMotions,skillMotionImpact} from './skill-motions.ts';
import {skillMotionName} from './skill-motion-map.ts';
import {nativeKit} from './native-kit.ts';
import {attachExtWeapon,loadExtCatalog,type NativeWeaponExt} from './native-weapon-ext.ts';

export type MiniPoint={x:number;y:number};
export type MiniNativeBounds={minX:number;maxX:number;minY:number;maxY:number};
export type MiniNativeOptions=Partial<{height:number;footX:number;footY:number;profileUrl:string;fitBounds:boolean}>;
export type MiniNativeMotion={name:string;impactTime?:number;loop?:boolean};
export type MiniAttachmentSocket={slot:string;pixel:[number,number];imageSize:[number,number]};
export type MiniNativeWeapon={
  family:ResolvedAppearance['family'];skinNames:string[];
  actions:Record<WardrobeAction,MiniNativeMotion>;
  sockets:{weapon?:MiniAttachmentSocket;muzzle?:MiniAttachmentSocket};
  muzzlePolicy?:'hand'|'weapon-tip';
};
export type MiniNativeProfile={
  runtime:{json:string;atlas:string;pma:boolean};skinNames:string[];
  acceptedBodySets:string[];nativeFacing:'left'|'right';referenceHeight:number;
  id?:string;ground:[number,number];fps:number;weapons:Record<string,MiniNativeWeapon>;previewBounds?:MiniNativeBounds;activeBones?:string[];
  skinRoles?:NativeSkinRoles;
};
type MiniSocket=SocketName|'head'|'leftHand'|'rightHand';
type Resources={data:SkeletonData;manager:AssetManager};
type Bundle={appearance:ResolvedAppearance;profile:MiniNativeProfile;weapon:MiniNativeWeapon;resources:Resources;playback:MiniNativePlayback;key:string};
type SocketSnapshot={points:Partial<Record<MiniSocket,MiniPoint>>;sources:Partial<Record<MiniSocket,string>>};
const bodySlots=['head','body','hands','legs','feet','back'] as const;
const actions:WardrobeAction[]=['idle','move','attack','skill','projectile','hurt','death'];
const socketNames:MiniSocket[]=['feet','chest','hand','muzzle','weapon','head','leftHand','rightHand'];
const DEFAULT_PROFILE='/art/mini-hero/navy/profile.json',EXT_BASE='/art/mini-hero/extensions/';
const profiles=new Map<string,Promise<MiniNativeProfile>>();

/** Only explicitly mapped starter outfits/weapons use this rig; all others remain legacy. */
export function miniSupportsAppearance(appearance:ResolvedAppearance,profile?:MiniNativeProfile):boolean{
  // A server-resolved gear kit maps every outfit and weapon onto the native hero rig.
  if(appearance.kit&&(!profile||profile.id==='navy-traveler'))return true;
  const accepted=profile?.acceptedBodySets??['100011','100041'];
  if(!bodySlots.every(slot=>accepted.includes(appearance.parts[slot].setId)))return false;
  const weapon=profile?.weapons[appearance.parts.weapon.setId];
  if(profile)return weapon?.family===appearance.family;
  return (appearance.parts.weapon.setId==='100011'&&appearance.family==='sword')||
    (appearance.parts.weapon.setId==='300601'&&appearance.family==='sword')||
    (appearance.parts.weapon.setId==='400105'&&appearance.family==='magic');
}

/** Simulation elapsed time maps the original release pose to the server windup boundary. */
export function miniSourceTime(duration:number,motion:MiniNativeMotion,state:WardrobeRenderState):number{
  if(!(duration>0)||!Number.isFinite(duration))return 0;
  if(state.cast){
    const elapsed=Math.max(0,state.cast.elapsed),windup=Math.max(0,state.cast.windup),recovery=Math.max(0,state.cast.recovery);
    const impact=Math.max(0,Math.min(duration,motion.impactTime??0));
    if(elapsed===windup)return impact;
    return windup>0&&elapsed<windup?impact*elapsed/windup:
      impact+(duration-impact)*(recovery>0?Math.min(1,Math.max(0,(elapsed-windup)/recovery)):1);
  }
  const clock=Number.isFinite(state.clock)?Math.max(0,state.clock):0;
  return (motion.loop??(state.action==='idle'||state.action==='move'))?clock%duration:Math.min(duration,clock);
}

/** UI-only fit uses one measured union for every action/weapon, so switching never changes layout. */
export function miniDisplayScale(profile:Pick<MiniNativeProfile,'referenceHeight'|'ground'|'previewBounds'>,width:number,height:number,
  options:{height:number;footX:number;footY:number;fitBounds?:boolean}):number{
  const configured=options.height/profile.referenceHeight,bounds=profile.previewBounds;
  if(!options.fitBounds)return configured;
  if(!bounds)throw new Error('MiniFantasy preview fitting requires measured native bounds');
  const [gx,gy]=profile.ground,extentX=Math.max(Math.abs(bounds.minX-gx),Math.abs(bounds.maxX-gx));
  const above=Math.max(0,bounds.maxY-gy),below=Math.max(0,gy-bounds.minY),padding=8;
  return Math.min(configured,
    extentX>0?Math.max(1,width*Math.min(options.footX,1-options.footX)-padding)/extentX:configured,
    above>0?Math.max(1,height*options.footY-padding)/above:configured,
    below>0?Math.max(1,height*(1-options.footY)-padding)/below:configured);
}

/** Uses native constraints on a fixed source frame grid; identical battle clocks never advance physics. */
export class MiniNativePlayback{
  readonly skeleton:Skeleton;
  action='';index=-1;sourceTime=0;resetCount=0;physicsSteps=0;
  constructor(data:SkeletonData,skin:Skin){this.skeleton=new Skeleton(data);this.skeleton.setSkin(skin);}
  seek(animation:Animation,time:number,fps:number):number{
    const target=Math.max(0,Math.floor(Math.min(animation.duration,Math.max(0,time))*fps+1e-4));
    if(this.action!==animation.name||target<this.index){
      this.skeleton.setToSetupPose();this.skeleton.time=0;
      this.skeleton.physicsConstraints.forEach(constraint=>constraint.reset());
      animation.apply(this.skeleton,-1,0,false,[],1,MixBlend.replace,MixDirection.mixIn);
      this.skeleton.updateWorldTransform(Physics.reset);
      this.action=animation.name;this.index=0;this.sourceTime=0;this.resetCount++;
    }
    while(this.index<target){
      const next=Math.min(animation.duration,(this.index+1)/fps),previous=this.sourceTime;
      this.skeleton.update(next-previous);
      animation.apply(this.skeleton,previous,next,false,[],1,MixBlend.replace,MixDirection.mixIn);
      this.skeleton.updateWorldTransform(Physics.update);
      this.index++;this.sourceTime=next;this.physicsSteps++;
    }
    return this.sourceTime;
  }
}

/** Source image pixels remain in the original untrimmed attachment coordinates. */
export function miniAttachmentPoint(slot:Slot,calibration:MiniAttachmentSocket):MiniPoint|undefined{
  const attachment=slot.getAttachment(),[width,height]=calibration.imageSize,[px,py]=calibration.pixel;
  if(!attachment||!slot.bone.active||slot.color.a<=0||!(width>0&&height>0)||![px,py].every(Number.isFinite))return;
  if((attachment instanceof RegionAttachment||attachment instanceof MeshAttachment)&&attachment.color.a<=0)return;
  if(attachment instanceof RegionAttachment){
    const x=(px/width-.5)*attachment.width*attachment.scaleX;
    const y=(.5-py/height)*attachment.height*attachment.scaleY;
    const angle=attachment.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const world=slot.bone.localToWorld(new Vector2(x*c-y*s+attachment.x,x*s+y*c+attachment.y));
    return {x:world.x,y:world.y};
  }
  if(attachment instanceof MeshAttachment){
    // Interpolate current weighted world vertices using original (pre-atlas-rotation) UVs.
    const world=new Float32Array(attachment.worldVerticesLength),uvs=attachment.regionUVs;
    attachment.computeWorldVertices(slot,0,world.length,world,0,2);
    const u=px/width,v=py/height;
    for(let i=0;i<attachment.triangles.length;i+=3){
      const a=attachment.triangles[i]*2,b=attachment.triangles[i+1]*2,c=attachment.triangles[i+2]*2;
      const denominator=(uvs[b+1]-uvs[c+1])*(uvs[a]-uvs[c])+(uvs[c]-uvs[b])*(uvs[a+1]-uvs[c+1]);
      if(Math.abs(denominator)<1e-10)continue;
      const wa=((uvs[b+1]-uvs[c+1])*(u-uvs[c])+(uvs[c]-uvs[b])*(v-uvs[c+1]))/denominator;
      const wb=((uvs[c+1]-uvs[a+1])*(u-uvs[c])+(uvs[a]-uvs[c])*(v-uvs[c+1]))/denominator,wc=1-wa-wb;
      if(Math.min(wa,wb,wc)>=-1e-5)return {x:world[a]*wa+world[b]*wb+world[c]*wc,y:world[a+1]*wa+world[b+1]*wb+world[c+1]*wc};
    }
  }
}

function mergedSkin(data:SkeletonData,names:string[]):Skin{
  const skin=new Skin('mini-runtime-combination');
  for(const name of names){const source=data.findSkin(name);if(!source)throw new Error(`MiniFantasy skin missing: ${name}`);skin.addSkin(source);}
  return skin;
}
function validateProfile(profile:MiniNativeProfile){
  if(!profile.runtime?.json||!profile.runtime.atlas||typeof profile.runtime.pma!=='boolean'||
    !Array.isArray(profile.skinNames)||!Array.isArray(profile.acceptedBodySets)||
    !(profile.referenceHeight>0)||!(profile.fps>0&&profile.fps<=120)||
    profile.ground?.length!==2||!profile.ground.every(Number.isFinite)||!['left','right'].includes(profile.nativeFacing))throw new Error('MiniFantasy profile is invalid');
}
async function loadProfile(url:string):Promise<MiniNativeProfile>{
  let pending=profiles.get(url);
  if(!pending){pending=fetch(url).then(async response=>{if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);const profile=await response.json() as MiniNativeProfile;validateProfile(profile);return profile;}).catch(error=>{profiles.delete(url);throw error;});profiles.set(url,pending);}
  return pending;
}

/** One shared GPU/context and atlas, including appearance previews, portrait and the live hero. */
class SharedMiniGpu{
  readonly canvas=document.createElement('canvas');
  readonly renderer:SceneRenderer;readonly gl:WebGLRenderingContext;
  clients=0;private loading=0;private resources=new Map<string,Promise<Resources>>();private managers=new Set<AssetManager>();private disposal?:ReturnType<typeof setTimeout>;
  constructor(){
    const gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true});
    if(!gl)throw new Error('MiniFantasy requires WebGL');this.gl=gl;this.renderer=new SceneRenderer(this.canvas,gl,true);
  }
  async load(profile:MiniNativeProfile):Promise<Resources>{
    const key=JSON.stringify(profile.runtime);let pending=this.resources.get(key);
    if(!pending){
      const manager=new AssetManager(this.renderer.context);this.managers.add(manager);this.loading++;
      pending=(async()=>{
        try{
          await loadMiniNativeAssets(manager,profile.runtime);
          const atlas=manager.get(profile.runtime.atlas) as TextureAtlas;
          const data=new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(installSkillMotions(manager.get(profile.runtime.json)));
          if(!data.version?.startsWith('4.2.'))throw new Error(`MiniFantasy runtime version mismatch: ${data.version}`);
          return {data,manager};
        }catch(error){this.resources.delete(key);manager.dispose();this.managers.delete(manager);throw error;}
        finally{this.loading--;this.disposeIfUnused();}
      })();this.resources.set(key,pending);
    }
    return pending;
  }
  draw(skeleton:Skeleton,target:HTMLCanvasElement,pma:boolean,scale:number,ground:MiniPoint,footX:number,footY:number,mirror:boolean){
    const ctx=target.getContext('2d');if(!ctx)throw new Error('MiniFantasy target requires a 2D canvas');
    if(this.canvas.width!==target.width)this.canvas.width=target.width;
    if(this.canvas.height!==target.height)this.canvas.height=target.height;
    const camera=this.renderer.camera;
    camera.viewportWidth=target.width/scale;camera.viewportHeight=target.height/scale;
    camera.position.x=ground.x+(target.width/2-target.width*footX)/scale;
    camera.position.y=ground.y+(target.height*footY-target.height/2)/scale;
    this.gl.viewport(0,0,target.width,target.height);this.gl.clearColor(0,0,0,0);this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.renderer.begin();this.renderer.drawSkeleton(skeleton,pma);this.renderer.end();
    ctx.clearRect(0,0,target.width,target.height);ctx.save();
    if(mirror){ctx.translate(2*target.width*footX,0);ctx.scale(-1,1);}
    ctx.drawImage(this.canvas,0,0);ctx.restore();
  }
  release(){this.clients--;this.disposeIfUnused();}
  retain(){if(this.disposal){clearTimeout(this.disposal);this.disposal=undefined;}this.clients++;}
  private disposeIfUnused(){
    if(this.clients>0||this.loading>0)return;
    if(this.disposal)return;
    // A region swap releases the old painter before creating its replacement.
    // Keep one shared context warm briefly; final destruction still frees every resource.
    this.disposal=setTimeout(()=>{this.disposal=undefined;if(this.clients>0||this.loading>0)return;
    for(const manager of this.managers)manager.dispose();this.managers.clear();this.resources.clear();
    this.renderer.dispose();this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    if(sharedGpu===this)sharedGpu=undefined;
    },300);
  }
}
let sharedGpu:SharedMiniGpu|undefined;
function acquireGpu(){const gpu=sharedGpu??=new SharedMiniGpu();gpu.retain();return gpu;}

/** Body, held weapon and sockets for a gear kit; head and hair stay the player's own profile skins. */
async function kitWeapon(gpu:SharedMiniGpu,data:SkeletonData,profile:MiniNativeProfile,appearance:ResolvedAppearance){
  const kit=nativeKit(appearance.kit!),names=[kit.body,...profile.skinNames.filter(n=>!n.startsWith('BODY/')),kit.right,kit.left].filter(Boolean) as string[];
  const skin=mergedSkin(data,names),slot=data.findSlot('RIGHTHAND');if(!slot)throw Error('RIGHTHAND slot missing');
  let ext:NativeWeaponExt|undefined;
  if(kit.ext){ext=(await loadExtCatalog(EXT_BASE)).get(kit.ext);if(!ext)throw Error('Extension weapon missing: '+kit.ext);await attachExtWeapon(gpu.renderer.context,data,skin,ext,EXT_BASE);}
  const sockets:MiniNativeWeapon['sockets']={},held=skin.getAttachment(slot.index,'RIGHTHAND');
  if(ext)sockets.weapon={slot:'RIGHTHAND',pixel:ext.head,imageSize:ext.size};
  else if(held instanceof RegionAttachment){
    // Native weapons point along the image's +y: the tip is the top centre, a staff/scepter orb sits ~15% down.
    // A bow has no tip: its socket is the grip at the image centre.
    const w=held.width,h=held.height;sockets.weapon={slot:'RIGHTHAND',pixel:[w/2,kit.weapon==='bow'?h/2:h*.0136],imageSize:[w,h]};
    if(kit.muzzle==='orb')sockets.muzzle={slot:'RIGHTHAND',pixel:[w/2,h*.149],imageSize:[w,h]};
  }
  const weapon:MiniNativeWeapon={family:appearance.family,skinNames:names.filter(n=>!profile.skinNames.includes(n)),actions:kit.actions,sockets,muzzlePolicy:kit.muzzle==='tip'?'weapon-tip':undefined};
  return {skin,weapon};
}

export class MiniNativePreview{
  private lastMotion?:MiniNativeMotion;
  readonly errors:string[]=[];pending=false;
  private bundle?:Bundle;private gpu?:SharedMiniGpu;private generation=0;private dead=false;
  private requested='';private drawKey='';private flipped=false;private action:WardrobeAction='idle';
  private frameIndex=0;private mappedTime=0;private retryTimer?:ReturnType<typeof setTimeout>;
  private sockets:SocketSnapshot={points:{},sources:{}};private history=new Map<string,SocketSnapshot>();
  private options:{height:number;footX:number;footY:number;profileUrl:string;fitBounds:boolean};
  constructor(readonly canvas:HTMLCanvasElement,options?:MiniNativeOptions){
    this.options={height:220,footX:.5,footY:.8,profileUrl:DEFAULT_PROFILE,fitBounds:false,...options};
  }
  async setAppearance(appearance:ResolvedAppearance):Promise<boolean>{
    if(this.dead)return false;const key=appearanceRenderKey(appearance);
    if(key===this.bundle?.key){this.bundle.appearance.revision=appearance.revision;return true;}
    if(key===this.requested&&(this.pending||this.retryTimer))return false;
    this.requested=key;const generation=++this.generation;this.pending=true;
    try{
      const profile=await loadProfile(this.options.profileUrl);
      if(this.options.fitBounds&&!profile.previewBounds)throw new Error('MiniFantasy UI bounds metadata is missing');
      if(!miniSupportsAppearance(appearance,profile))throw new Error(`Unsupported MiniFantasy outfit/weapon: ${key}`);
      if(this.dead||generation!==this.generation)return false;
      const gpu=this.gpu??=acquireGpu(),resources=await gpu.load(profile);
      const kit=appearance.kit&&miniSupportsAppearance(appearance,profile)?await kitWeapon(gpu,resources.data,profile,appearance):undefined,weapon=kit?.weapon??profile.weapons[appearance.parts.weapon.setId];
      for(const action of actions){const motion=weapon.actions[action];if(!motion||!resources.data.findAnimation(motion.name))throw new Error(`MiniFantasy ${action} animation missing`);if(motion.impactTime!==undefined&&!Number.isFinite(motion.impactTime))throw new Error(`MiniFantasy ${action} impact is invalid`);}
      const skin=kit?kit.skin:profile.skinRoles?composeNativeSkin(resources.data,profile.skinRoles):mergedSkin(resources.data,[...profile.skinNames,...weapon.skinNames]);
      for(const name of profile.activeBones??[]){const bone=resources.data.findBone(name);if(!bone)throw Error('Missing active native bone '+name);if(!skin.bones.includes(bone))skin.bones.push(bone);}
      if(this.dead||generation!==this.generation)return false;
      this.bundle={appearance:structuredClone(appearance),profile,weapon,resources,playback:new MiniNativePlayback(resources.data,skin),key};
      this.pending=false;this.drawKey='';this.history.clear();return true;
    }catch(error){
      if(this.dead||generation!==this.generation)return false;
      this.pending=false;this.recordError(error);this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;},5000);return false;
    }
  }
  render(state:WardrobeRenderState):boolean{
    const bundle=this.bundle;if(!bundle||!this.gpu||this.dead)return false;
    try{
      const motion=this.motionFor(state),animation=bundle.resources.data.findAnimation(motion.name)!;
      // Frame names carry only action+index, so a new clip under the same action must not reuse cached sockets.
      if(motion.name!==this.lastMotion?.name)this.history.clear();this.lastMotion=motion;
      const mappedTime=miniSourceTime(animation.duration,motion,state),index=Math.floor(mappedTime*bundle.profile.fps+1e-4);
      const flipped=(bundle.profile.nativeFacing==='left'?-1:1)*state.facing<0;
      const key=JSON.stringify([bundle.key,motion.name,state.action,index,flipped,this.canvas.width,this.canvas.height]);
      this.action=state.action;this.frameIndex=index;this.mappedTime=mappedTime;this.flipped=flipped;
      if(key===this.drawKey)return false;
      bundle.playback.seek(animation,mappedTime,bundle.profile.fps);
      this.sockets=this.sampleSockets(bundle.playback.skeleton);this.history.set(this.frameName,this.sockets);
      if(this.history.size>180)this.history.delete(this.history.keys().next().value!);
      this.gpu.draw(bundle.playback.skeleton,this.canvas,bundle.profile.runtime.pma,this.displayScale!,
        {x:bundle.profile.ground[0],y:bundle.profile.ground[1]},this.options.footX,this.options.footY,flipped);
      this.drawKey=key;return true;
    }catch(error){this.recordError(error);return false;}
  }
  /** Authored skill motion while its cast runs (reduced motion: the in-place variant); otherwise the weapon's native clip. */
  private motionFor(state:WardrobeRenderState):MiniNativeMotion{
    const bundle=this.bundle!,authored=state.cast&&state.skill?skillMotionName(state.skill):undefined;
    if(authored){const name=state.reducedMotion?authored+STILL:authored,impact=skillMotionImpact(authored);if(impact!==undefined&&bundle.resources.data.findAnimation(name))return {name,impactTime:impact};}
    return nativeStaffMotion(bundle.weapon.actions[state.action],bundle.weapon.family,state.motionFamily,state.action,bundle.profile.weapons['300601']?.actions);
  }
  private sampleSockets(skeleton:Skeleton):SocketSnapshot{
    const bundle=this.bundle!,points:SocketSnapshot['points']={},sources:SocketSnapshot['sources']={};
    const bone=(name:string,source:string)=>{const b=skeleton.findBone(name);return b?{point:{x:b.worldX,y:b.worldY},source}:undefined;};
    const named:Partial<Record<MiniSocket,string>>={chest:'spine2',head:'head',hand:'RIGHTHAND',rightHand:'RIGHTHAND',leftHand:'LEFTHAND'};
    for(const [name,boneName] of Object.entries(named)){const p=bone(boneName!,`native-bone:${boneName}`);if(p){points[name as MiniSocket]=p.point;sources[name as MiniSocket]=p.source;}}
    points.feet={x:bundle.profile.ground[0],y:bundle.profile.ground[1]};sources.feet='native-ground';
    for(const name of ['weapon','muzzle'] as const){
      const calibration=bundle.weapon.sockets[name]??(name==='muzzle'&&bundle.weapon.muzzlePolicy==='weapon-tip'?bundle.weapon.sockets.weapon:undefined);
      if(!calibration){
        if(name==='muzzle'&&points.hand){points.muzzle=points.hand;sources.muzzle='native-bone:RIGHTHAND:hand-muzzle';}
        continue;
      }
      const slot=skeleton.findSlot(calibration.slot);
      const p=slot&&miniAttachmentPoint(slot,calibration);
      if(p){points[name]=p;sources[name]=`native-attachment:${calibration.slot}/${slot!.getAttachment()!.name}/${name}`;}
      else if(points.hand){points[name]=points.hand;sources[name]=`native-bone:RIGHTHAND:attachment-hidden:${name}`;}
    }
    return {points,sources};
  }
  releaseFrame(action:WardrobeAction){const bundle=this.bundle;if(!bundle)return;const motion=action===this.action?this.lastMotion??bundle.weapon.actions[action]:bundle.weapon.actions[action];return `mini-${action}_${Math.floor((motion.impactTime??0)*bundle.profile.fps+1e-4)}`;}
  socket(name:MiniSocket,frameName?:string):MiniPoint|undefined{
    const bundle=this.bundle;if(!bundle||this.dead)return;
    let snapshot=this.sockets;
    if(frameName&&frameName!==this.frameName){
      const cached=this.history.get(frameName);if(cached)snapshot=cached;
      else{
        const match=/^mini-(idle|move|attack|skill|projectile|hurt|death)_(\d+)$/.exec(frameName);if(!match)return;
        const motion=match[1]===this.action?this.lastMotion??bundle.weapon.actions[match[1] as WardrobeAction]:bundle.weapon.actions[match[1] as WardrobeAction],animation=bundle.resources.data.findAnimation(motion.name)!;
        const playback=new MiniNativePlayback(bundle.resources.data,bundle.playback.skeleton.skin!);
        playback.seek(animation,Number(match[2])/bundle.profile.fps,bundle.profile.fps);snapshot=this.sampleSockets(playback.skeleton);
        this.history.set(frameName,snapshot);
      }
    }
    const p=snapshot.points[name];if(!p)return;
    const scale=this.displayScale!;
    return {x:this.canvas.width*this.options.footX+(p.x-bundle.profile.ground[0])*scale*(this.flipped?-1:1),
      y:this.canvas.height*this.options.footY-(p.y-bundle.profile.ground[1])*scale};
  }
  /** Custom production bones, such as a boss exhaust valve, use the same native transform. */
  boneSocket(name:string):MiniPoint|undefined{
    const bundle=this.bundle,scale=this.displayScale;if(!bundle||!scale||this.dead)return;
    const bone=bundle.playback.skeleton.findBone(name);if(!bone?.active)return;
    return {x:this.canvas.width*this.options.footX+(bone.worldX-bundle.profile.ground[0])*scale*(this.flipped?-1:1),
      y:this.canvas.height*this.options.footY-(bone.worldY-bundle.profile.ground[1])*scale};
  }
  drawPortrait(target:HTMLCanvasElement):boolean{
    const bundle=this.bundle;if(!bundle||!this.gpu||this.dead)return false;
    const skin=mergedSkin(bundle.resources.data,bundle.profile.skinNames.filter(name=>name.startsWith('HEAD/')||name.startsWith('HAIR/')));
    const playback=new MiniNativePlayback(bundle.resources.data,skin),motion=bundle.weapon.actions.idle;
    playback.seek(bundle.resources.data.findAnimation(motion.name)!,0,bundle.profile.fps);
    const offset=new Vector2(),size=new Vector2();playback.skeleton.getBounds(offset,size,[]);
    if(!(size.x>0&&size.y>0))return false;
    const scale=Math.min(target.width/size.x,target.height/size.y)*.92;
    this.gpu.draw(playback.skeleton,target,bundle.profile.runtime.pma,scale,{x:offset.x+size.x/2,y:offset.y+size.y/2},.5,.5,false);
    return true;
  }
  /** Export the current visible native parts at the target resolution, without
   * first shrinking a full character and enlarging the cropped result. */
  drawIcon(target:HTMLCanvasElement,padding=16):boolean{
    const bundle=this.bundle;if(!bundle||!this.gpu||this.dead)return false;
    const offset=new Vector2(),size=new Vector2();bundle.playback.skeleton.getBounds(offset,size,[]);
    if(!(size.x>0&&size.y>0))return false;
    const scale=Math.min((target.width-padding*2)/size.x,(target.height-padding*2)/size.y);
    this.gpu.draw(bundle.playback.skeleton,target,bundle.profile.runtime.pma,scale,{x:offset.x+size.x/2,y:offset.y+size.y/2},.5,.5,false);
    return true;
  }
  get ready(){return Boolean(this.bundle)&&!this.dead;}
  /** Canvas transform for NPC tool art; source bone remains owned by native playback. */
  bonePose(name:'RIGHTHAND'|'LEFTHAND'):{x:number;y:number;rotation:number;mirrored:boolean}|undefined{
    const bundle=this.bundle,scale=this.displayScale;if(!bundle||!scale)return;
    const bone=bundle.playback.skeleton.findBone(name);if(!bone?.active)return;
    return {x:this.canvas.width*this.options.footX+(bone.worldX-bundle.profile.ground[0])*scale*(this.flipped?-1:1),
      y:this.canvas.height*this.options.footY-(bone.worldY-bundle.profile.ground[1])*scale,
      rotation:this.flipped?Math.atan2(bone.b,bone.a):Math.atan2(-bone.b,bone.a),mirrored:this.flipped};
  }
  get mirrored(){return this.flipped;}
  get frameName(){return `mini-${this.action}_${this.frameIndex}`;}
  get displayScale():number|undefined{
    return this.bundle?miniDisplayScale(this.bundle.profile,this.canvas.width,this.canvas.height,this.options):undefined;
  }
  actionDuration(action:WardrobeAction):number|undefined{
    const bundle=this.bundle;return bundle?.resources.data.findAnimation(bundle.weapon.actions[action].name)?.duration;
  }
  diagnostics(){
    const bundle=this.bundle;
    return {ready:this.ready,pending:this.pending,key:bundle?.key,family:bundle?.appearance.family,revision:bundle?.appearance.revision,
      frame:this.frameName,flip:this.flipped,motion:this.lastMotion?.name,kit:bundle?.appearance.kit?nativeKit(bundle.appearance.kit).key:undefined,parts:bundle?Object.fromEntries(Object.entries(bundle.appearance.parts).map(([slot,part])=>[slot,part.setId])):null,
      partCount:bundle?.playback.skeleton.drawOrder.filter(slot=>slot.getAttachment()).length??0,drawOrder:bundle?.playback.skeleton.drawOrder.map(slot=>slot.data.name),
      errors:[...this.errors],sockets:Object.fromEntries(socketNames.map(name=>[name,this.socket(name)])),socketSources:{...this.sockets.sources},
      native:bundle?{version:bundle.resources.data.version,sourceAnimation:bundle.playback.action,mappedTime:this.mappedTime,sourceTime:bundle.playback.sourceTime,
        referenceHeight:bundle.profile.referenceHeight,displayScale:this.displayScale,fitBounds:this.options.fitBounds,physics:'native-fixed-source-steps',physicsSteps:bundle.playback.physicsSteps,resets:bundle.playback.resetCount,
        skins:[...bundle.profile.skinNames,...bundle.weapon.skinNames],sharedContextCount:1,pma:bundle.profile.runtime.pma}:undefined};
  }
  private recordError(error:unknown){const message=String(error);if(this.errors.at(-1)!==message){this.errors.push(message);if(this.errors.length>8)this.errors.shift();console.error('[mini-native] Original outfit retained; resource/render error',error);}}
  destroy(){if(this.dead)return;this.dead=true;this.generation++;if(this.retryTimer)clearTimeout(this.retryTimer);this.bundle=undefined;this.pending=false;this.history.clear();this.gpu?.release();this.gpu=undefined;}
}
