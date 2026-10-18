/** Group-local actor adapter; original native/atlas resources remain owned by their groups. */
const dataCache=new Map();
const fetchJson=async u=>{const r=await fetch(u);if(!r.ok)throw Error('Missing actor resource '+u);return r.json();};
const decode=async u=>{const im=new Image();im.src=u;await im.decode();return im;};
export async function loadActor(id){
 if(dataCache.has(id))return dataCache.get(id);
 const bosses=await fetchJson('/art/starsea/bosses/manifest.json'),boss=bosses.assets.find(a=>a.id===id);
 if(boss){const actor=new BossActor(boss);await actor.load();dataCache.set(id,actor);return actor;}
 const monsters=await fetchJson('/art/starsea/monsters/manifest.json'),monster=monsters.assets.find(a=>a.id===id);if(!monster)throw Error('Unknown real actor '+id);
 const actor=new AtlasActor(monster);await actor.load();dataCache.set(id,actor);return actor;
}
class AtlasActor{
 constructor(asset){this.asset=asset;this.runtime=asset.runtime;this.points={};this.last={};}
 async load(){[this.image,this.atlas,this.sockets]=await Promise.all([decode(this.runtime.image),fetchJson(this.runtime.atlas),fetchJson(this.runtime.sockets)]);}
 draw(ctx,foot,{action='skill',time=0,facing=-1}={}){
  const a=this.runtime.actions[action];if(!a)throw Error('Missing actual native-export action '+action);const local=a.loop?time%a.duration:Math.min(time,a.duration),index=Math.min(a.frames.length-1,Math.floor(local*a.fps)),key=a.frames[index],f=this.atlas.frames[key],ss=f.spriteSourceSize,fr=f.frame,scale=this.runtime.scale,frameSize=this.runtime.frameSize,[ax,ay]=this.runtime.anchor,mirror=facing!==this.runtime.nativeFacing;
  ctx.save();ctx.translate(foot.x,foot.y);ctx.scale(mirror?-1:1,1);ctx.drawImage(this.image,fr.x,fr.y,fr.w,fr.h,(ss.x-ax*frameSize)*scale,(ss.y-ay*frameSize)*scale,fr.w*scale,fr.h*scale);ctx.restore();
  const raw=this.sockets.actions[action][index];this.points=Object.fromEntries(Object.entries(raw).map(([name,p])=>[name,{x:foot.x+(p[0]-ax*frameSize)*scale*(mirror?-1:1),y:foot.y+(p[1]-ay*frameSize)*scale}]));
  this.last={id:this.asset.id,action,source:a.source,time:local,frame:index,foot,facing,points:this.points,releaseAnnotation:'No source release annotation exposed by this atlas. Native clock retained; VFX event supplies real release.'};return this.last;
 }
}
class BossActor{
 constructor(asset){this.asset=asset;this.points={};this.last={};this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=512;this.gl=this.canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true,premultipliedAlpha:true});if(!this.gl)throw Error('WebGL missing');this.renderer=new spine.SceneRenderer(this.canvas,this.gl,true);this.manager=new spine.AssetManager(this.renderer.context);}
 async load(){this.profile=await fetchJson(this.asset.runtime.profile);const p=this.profile;this.manager.loadText(p.runtime.json);this.manager.loadTextureAtlas(p.runtime.atlas);await this.manager.loadAll();this.data=new spine.SkeletonJson(new spine.AtlasAttachmentLoader(this.manager.get(p.runtime.atlas))).readSkeletonData(JSON.parse(this.manager.get(p.runtime.json)));this.skeleton=new spine.Skeleton(this.data);const skin=new spine.Skin('vfx-preview');for(const name of [...p.skinNames,...p.weapons[this.asset.id].skinNames]){const s=this.data.findSkin(name);if(!s)throw Error('Missing native skin '+name);skin.addSkin(s);}this.skeleton.setSkin(skin);this.skeleton.setToSetupPose();this.frame=-1;}
 seek(animation,time){const wanted=Math.floor(Math.min(animation.duration,Math.max(0,time))*60+1e-4);if(this.animation!==animation.name||wanted<this.frame){this.skeleton.setToSetupPose();this.skeleton.time=0;this.skeleton.physicsConstraints.forEach(c=>c.reset());animation.apply(this.skeleton,-1,0,false,[],1,spine.MixBlend.replace,spine.MixDirection.mixIn);this.skeleton.updateWorldTransform(spine.Physics.reset);this.frame=0;this.sourceTime=0;this.animation=animation.name;}
  while(this.frame<wanted){const t=Math.min(animation.duration,(this.frame+1)/60);this.skeleton.update(t-this.sourceTime);animation.apply(this.skeleton,this.sourceTime,t,false,[],1,spine.MixBlend.replace,spine.MixDirection.mixIn);this.skeleton.updateWorldTransform(spine.Physics.update);this.frame++;this.sourceTime=t;}}
 draw(ctx,foot,{action='skill',effectId,time=0,windupTicks=0,phase='default',facing=-1}={}){
  const m=action==='skill'?this.asset.actions.skills[effectId]:this.asset.actions[action];if(!m)throw Error('Missing actual source skill/action '+effectId+'/'+action);
  const name=phase==='phase-enter'?'SS_phaseEnter':phase==='phase-end'?'SS_phaseEnd':m.name+(phase==='phase-active'?'_active':''),a=this.data.findAnimation(name);if(!a)throw Error('Missing native animation '+name);
  let sourceTime=time;if(action==='skill'&&m.impactTime!==undefined){sourceTime=time*30<windupTicks?m.impactTime*time*30/Math.max(1,windupTicks):m.impactTime+time-windupTicks/30;}
  const t=m.loop?sourceTime%a.duration:Math.min(sourceTime,a.duration);this.seek(a,t);
  const scale=this.asset.runtime.displayHeight/this.profile.referenceHeight,ground=this.profile.ground,localFoot={x:256,y:384},mirror=facing!==-1,r=this.renderer;
  r.camera.viewportWidth=512/scale;r.camera.viewportHeight=512/scale;r.camera.position.x=ground[0];r.camera.position.y=ground[1]+(localFoot.y-256)/scale;this.gl.viewport(0,0,512,512);this.gl.clearColor(0,0,0,0);this.gl.clear(this.gl.COLOR_BUFFER_BIT);r.begin();r.drawSkeleton(this.skeleton,true);r.end();
  ctx.save();ctx.translate(foot.x,foot.y);if(mirror)ctx.scale(-1,1);ctx.drawImage(this.canvas,-localFoot.x,-localFoot.y);ctx.restore();
  const raw={feet:{x:ground[0],y:ground[1]},ground:{x:ground[0],y:ground[1]}};for(const[name,boneName]of Object.entries({hand:'RIGHTHAND',leftHand:'LEFTHAND',head:'head',chest:'spine2',ss_exhaust:'ss_exhaust'})){const b=this.skeleton.findBone(boneName);if(b)raw[name]={x:b.worldX,y:b.worldY};}
  const calibration=this.profile.weapons[this.asset.id].sockets.weapon,slot=this.skeleton.findSlot(calibration.slot),attachment=slot.getAttachment();
  if(attachment instanceof spine.RegionAttachment){const[w,h]=calibration.imageSize,[px,py]=calibration.pixel,x=(px/w-.5)*attachment.width*attachment.scaleX,y=(.5-py/h)*attachment.height*attachment.scaleY,angle=attachment.rotation*Math.PI/180,p=new spine.Vector2(x*Math.cos(angle)-y*Math.sin(angle)+attachment.x,x*Math.sin(angle)+y*Math.cos(angle)+attachment.y);slot.bone.localToWorld(p);raw.weapon={x:p.x,y:p.y};}else raw.weapon=raw.hand;raw.muzzle=raw.weapon;
  this.points=Object.fromEntries(Object.entries(raw).map(([name,p])=>[name,{x:foot.x+(p.x-ground[0])*scale*(mirror?-1:1),y:foot.y-(p.y-ground[1])*scale}]));
  this.last={id:this.asset.id,action,actualAnimation:name,source:m.sourceAnimation,time:this.sourceTime,frame:this.frame,foot,facing,phase,points:this.points,rawPoints:raw,releaseAnnotation:m.impactTime,referenceHeight:this.profile.referenceHeight,displayHeight:this.asset.runtime.displayHeight};return this.last;
 }
}
