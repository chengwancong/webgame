import Phaser from 'phaser';
import type {World,CombatEvent} from '../../../packages/simulation/index.ts';
import type {RenderPose,SocketName} from './effect-attachments.ts';
import type {Skill} from '../../../packages/contracts/index.ts';
import sourceManifest from '../../../packages/asset-manifest/skill-fx.json';
import {projectFx,projectileLayout,skillSourceClip,skillProjectileClip,sourceFrame,type FxClip,type FxPoint} from './skill-fx-layout.ts';

type Manifest={schemaVersion:number;texture:{key:string;image:string;atlas:string};clips:Record<string,FxClip>};
const source=sourceManifest as unknown as Manifest;
type Segment={from:FxPoint;to:FxPoint;ground:FxPoint};
type Flash={id:number;event:CombatEvent;kind:Skill['kind']|'hit';clip:string;life:number;release?:{point:FxPoint;ground:FxPoint;facing:number};segments?:Segment[]};
type ImageState={image:Phaser.GameObjects.Image;clip:string;anchor:string;ground:FxPoint;role:string;endpoints?:{from:FxPoint;to:FxPoint}};
type Flight={from:FxPoint;to:FxPoint;born:number};
export function preloadSkillEffects(scene:Phaser.Scene){
 scene.load.atlas(source.texture.key,source.texture.image,source.texture.atlas);
 scene.load.on('loaderror',(file:Phaser.Loader.File)=>{if(file.key===source.texture.key)console.error('[skill-fx] Source atlas failed to load',file.src);});
}

/** Source art follows real events. This layer never adds damage or gameplay effects. */
export class SkillEffects{
 private flashes:Flash[]=[];private images=new Map<string,ImageState>();private flight=new Map<number,Flight>();private used=new Set<string>();private rangeHints=new Map<number,Phaser.GameObjects.Graphics>();
 private serial=0;private consumedWorld?:World;private consumedTick=-1;private lastFraction=0;private lastNow=0;private errors=new Set<string>();private dead=false;
 private totalConsumed=0;private totalCreated=0;private recentClips:string[]=[];private cancelReason='';
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean,private attachment:(id:string,name:SocketName)=>FxPoint|undefined,private heroPose:()=>RenderPose&{skill:string}|undefined){}
 private clearVisuals(){for(const state of this.images.values())state.image.destroy();for(const hint of this.rangeHints.values())hint.destroy();this.rangeHints.clear();this.images.clear();this.flight.clear();this.flashes=[];this.used.clear();}
 reset(){this.clearVisuals();this.consumedWorld=undefined;this.consumedTick=-1;this.lastFraction=0;this.lastNow=0;this.errors.clear();this.cancelReason='world-reset';}
 destroy(){this.reset();this.dead=true;this.cancelReason='destroyed';}
 consume(world:World){
  if(this.dead)return;if(this.consumedWorld===world&&this.consumedTick===world.tick)return;
  if(this.consumedWorld&&this.consumedWorld!==world)this.reset();this.consumedWorld=world;this.consumedTick=world.tick;
  for(const event of world.events){
   this.totalConsumed++;
   if(event.type==='hit_resolved'&&(event.amount??0)>0){this.flashes.push({id:++this.serial,event,life:8,kind:'hit',clip:'impact'});continue;}
   if(event.id!=='hero'||!event.skill||!['cast_started','cast_released'].includes(event.type))continue;
   const skill=world.skills.find(s=>s.id===event.skill);if(!skill)continue;
   if(event.type==='cast_released')this.flashes=this.flashes.filter(f=>!(f.event.type==='cast_started'&&f.event.skill===event.skill));
   const clip=skillSourceClip(skill),life=skill.kind==='area'||skill.kind==='zone'||skill.kind==='chain'?12:skill.kind==='dash'?10:skill.kind==='shield'?18:skill.kind==='heal'?24:8;this.flashes.push({id:++this.serial,event,kind:skill.kind,clip,life:event.type==='cast_started'?Math.max(1,event.windup??1):life});
  }
 }
 private fail(message:string){if(!this.errors.has(message)){this.errors.add(message);console.error('[skill-fx]',message);}}
 private paint(key:string,clipId:string,age:number,point:FxPoint,ground:FxPoint,size:number,alpha:number,anchor:string,options:{loop?:boolean;rotation?:number;facing?:number;depth?:number;height?:number;static?:boolean;role?:string;width?:boolean}={}){
  const clip=source.clips[clipId];if(!clip){this.fail(`Missing source clip: ${clipId}`);return;}
  if(!this.scene.textures.exists(source.texture.key)){this.fail(`Source texture unavailable: ${source.texture.key}`);return;}
  const frame=sourceFrame(clip,age,this.reduced()||Boolean(options.static),options.loop)??(options.role==='projectile'?sourceFrame(clip,0,true):undefined);if(!frame)return;
  if(!this.scene.textures.get(source.texture.key).has(frame)){this.fail(`Source frame unavailable: ${frame}`);return;}
  this.used.add(key);let state=this.images.get(key);
  if(!state){state={image:this.scene.add.image(0,0,source.texture.key,frame),clip:clipId,anchor,ground,role:options.role??'release'};this.images.set(key,state);this.totalCreated++;}
  if(!this.recentClips.includes(clipId)){this.recentClips.push(clipId);if(this.recentClips.length>32)this.recentClips.shift();}
  const image=state.image;state.clip=clipId;state.anchor=anchor;state.ground={...ground};state.role=options.role??'release';image.setFrame(frame);
  const width=image.frame.realWidth,height=image.frame.realHeight,scale=size/(options.width?width:Math.max(width,height));
  image.setOrigin(clip.origin[0],clip.origin[1]).setPosition(point.x,point.y).setScale(scale,options.height===undefined?scale:options.height/height).setAlpha(Math.max(0,Math.min(1,alpha))).setDepth(options.depth??ground.y+3).setBlendMode(clip.blend==='add'?Phaser.BlendModes.ADD:Phaser.BlendModes.NORMAL).setVisible(true);
  if(options.rotation!==undefined)image.setFlipX(false).setRotation(options.rotation+(clip.nativeFacing==='left'?Math.PI:0));
  else image.setRotation(0).setFlipX(options.facing!==undefined&&(clip.nativeFacing==='left'?options.facing>0:options.facing<0));
 }
 private beam(key:string,segment:Segment,age:number,alpha:number,clip='lightning'){
  const {from,to,ground}=segment,length=Math.hypot(to.x-from.x,to.y-from.y);if(length<1)return;
  // Lightning is a source burst, not a long beam texture. Preserve its original proportions.
  const angle=Math.atan2(to.y-from.y,to.x-from.x),point=clip==='arrow'?{x:(from.x+to.x)/2,y:(from.y+to.y)/2}:to;
  this.paint(key,clip,age,point,ground,clip==='arrow'?38:42,alpha,'released-endpoints',{rotation:clip==='arrow'?angle:undefined,role:'beam'});
  const state=this.images.get(key);if(state)state.endpoints={from:{...from},to:{...to}};
 }
 draw(world:World,fraction:number){
  if(this.dead)return;if(world.hero.hp<=0){this.clearVisuals();this.cancelReason='hero-dead';return;}this.cancelReason='';this.used.clear();
  // Freeze both effect age and projectile interpolation at the last displayed instant.
  if(!world.paused){this.lastFraction=Math.max(0,Math.min(1,fraction));this.lastNow=world.tick+this.lastFraction;}
  const interpolation=this.lastFraction,now=world.paused?(this.lastNow||world.tick):this.lastNow;
  this.flashes=this.flashes.filter(f=>world.tick-f.event.tick<f.life);
  const feet=this.attachment('hero','feet')??projectFx(world.hero.position),chest=this.attachment('hero','chest')??feet,muzzle=this.attachment('hero','muzzle')??chest,weapon=this.attachment('hero','weapon')??chest;
  for(const flash of this.flashes){
   const e=flash.event,age=Math.max(0,now-e.tick),seconds=age/flash.life*(source.clips[flash.clip]?.duration??flash.life/30),alpha=Math.max(0,1-age/flash.life),key=`flash:${flash.id}`;
   if(e.type==='cast_started'){
    const body=flash.kind==='shield'||flash.kind==='heal',ranged=flash.kind==='projectile'||['snipe','petrify'].includes(e.skill??''),point=flash.kind==='heal'?feet:body?chest:ranged?muzzle:weapon;
    this.paint(key,body?flash.clip:ranged?'arcane-projectile':flash.clip,0,point,feet,body?40:22,.35,'windup:'+(body?'chest':ranged?'muzzle':'weapon'),{static:true,facing:world.hero.facing,role:'windup'});continue;
   }
   if(flash.kind==='hit'){
    const point=this.attachment(e.id,'chest')??projectFx(e.position),ground=this.attachment(e.id,'feet')??projectFx(e.position);
    this.paint(key,'impact',seconds,point,ground,40,alpha,'target-chest',{depth:ground.y+4,role:'impact'});continue;
   }
   flash.release??={point:{...(flash.kind==='shield'||flash.kind==='heal'?chest:weapon)},ground:projectFx(e.position),facing:world.hero.facing};
   if(flash.kind==='single'&&['snipe','petrify'].includes(e.skill??'')){
    flash.segments??=[{from:{...muzzle},to:this.releaseTarget(e),ground:projectFx(e.target??e.position)}];
    for(const segment of flash.segments)this.beam(key,segment,seconds,alpha,e.skill==='snipe'?'arrow':'lightning');
   }else if(flash.kind==='chain'){
    if(!flash.segments){const hits=this.flashes.filter(f=>f.kind==='hit'&&f.event.skill===e.skill&&f.event.tick===e.tick);let from={...muzzle};flash.segments=hits.map(hit=>{const to=this.attachment(hit.event.id,'chest')??projectFx(hit.event.position),segment={from:{...from},to:{...to},ground:projectFx(hit.event.position)};from=to;return segment;});}
    flash.segments.forEach((segment,index)=>this.beam(`${key}:${index}`,segment,seconds,alpha));
   }else if(flash.kind==='shield'||flash.kind==='heal'){
    const heal=flash.kind==='heal';this.paint(key,flash.clip,seconds,heal?feet:chest,feet,heal?100:96,alpha,heal?'feet-aura':'chest',{depth:feet.y+(heal?1:3),role:'body'});
   }else if(flash.kind==='single'){
    const following=age<=8&&this.heroPose()?.skill===e.skill;
    this.paint(key,flash.clip,seconds,following?weapon:flash.release.point,following?feet:flash.release.ground,56,alpha,following?'weapon-recovery':'release-weapon',{facing:flash.release.facing,role:'weapon'});
   }else if(flash.kind==='area'||flash.kind==='dash'){
    const ground=projectFx(e.position),size=Math.max(40,(e.radius??1)*64);
    const rotating=['whirl','blade_fury','vortex_blade'].includes(e.skill??'');
    this.paint(key,flash.clip,seconds,ground,ground,size,alpha,'release-ground',{depth:ground.y+1,facing:flash.release.facing,rotation:rotating&&!this.reduced()?Math.min(1,age/8)*Math.PI*1.2:undefined,role:'ground-release'});
   }else if(flash.kind==='zone'){
    const ground=projectFx(e.target??e.position);
    this.paint(key,flash.clip,seconds,ground,ground,Math.max(48,(e.radius??1)*42),alpha*.65,'release-target-ground',{depth:ground.y+1,role:'ground-release'});
   }
  }
  for(const zone of world.zones){if(zone.enemy)continue;
   const skill=world.skills.find(s=>s.id===zone.skill),clip=skill?skillSourceClip(skill):zone.slow?'ice-crystal':'orange-fire',ground=projectFx(zone.position),age=Math.max(0,now-(zone.started??world.tick))/30,alpha=Math.min(1,zone.life/20)*.7;
   // Thin range lines communicate the true collision radius; source pieces provide the art.
   let hint=this.rangeHints.get(zone.id);if(!hint){hint=this.scene.add.graphics();this.rangeHints.set(zone.id,hint);}
   hint.clear().setDepth(ground.y-2).lineStyle(1,clip==='orange-fire'?0xe4ad72:clip==='ice-crystal'?0x95c5db:0xa59cc1,alpha*.4).strokeEllipse(ground.x,ground.y,zone.radius*90.51,zone.radius*50.91);
   const count=this.reduced()?1:5;
   for(let i=0;i<count;i++){const angle=i*Math.PI*2/4,r=i===0?0:zone.radius*.55,point=projectFx({x:zone.position.x+Math.cos(angle)*r,y:zone.position.y+Math.sin(angle)*r});this.paint(`zone:${zone.id}:${i}`,clip,age+i*.07,point,point,clip==='orange-fire'?Math.max(38,zone.radius*21):40,alpha,'zone-piece',{loop:true,depth:point.y+1,role:'zone-upright'});}
  }
  const zones=new Set(world.zones.filter(zone=>!zone.enemy).map(zone=>zone.id));for(const [id,hint]of this.rangeHints)if(!zones.has(id)){hint.destroy();this.rangeHints.delete(id);}
  const active=new Set(world.projectiles.map(p=>p.id));for(const id of this.flight.keys())if(!active.has(id))this.flight.delete(id);
  for(const projectile of world.projectiles){
   const previous=projectile.previous??projectile.position,start=projectFx(projectile.origin??previous);let flight=this.flight.get(projectile.id);
   if(!flight){const owner=projectile.owner??(projectile.enemy?world.enemies.find(e=>Math.hypot(e.position.x-previous.x,e.position.y-previous.y)<.1)?.id:'hero'),from=owner?this.attachment(owner,'muzzle'):undefined,target=projectile.targetId?this.attachment(projectile.targetId,'chest'):projectile.enemy?chest:undefined,targetFeet=projectile.targetId?this.attachment(projectile.targetId,'feet'):projectile.enemy?feet:undefined;
    flight={from:from?{x:from.x-start.x,y:from.y-start.y}:{x:0,y:chest.y-feet.y},to:target&&targetFeet?{x:target.x-targetFeet.x,y:target.y-targetFeet.y}:{x:0,y:chest.y-feet.y},born:world.tick};this.flight.set(projectile.id,flight);}
   const layout=projectileLayout(previous,projectile.position,interpolation,projectile.origin,projectile.target,flight.from,flight.to),end=projectFx(projectile.target??{x:projectile.position.x+projectile.direction.x,y:projectile.position.y+projectile.direction.y}),begin=projectFx(projectile.origin??projectile.position),rotation=Math.atan2(end.y+flight.to.y-begin.y-flight.from.y,end.x+flight.to.x-begin.x-flight.from.x),skill=world.skills.find(s=>s.id===projectile.skill),clip=projectile.enemy?'arrow':skill?skillProjectileClip(skill):'arcane-projectile';
   this.paint(`projectile:${projectile.id}`,clip,(now-flight.born)/30,layout.position,layout.ground,clip==='arrow'||clip==='flaming-arrow'?38:30,1,'projectile-muzzle-to-chest',{loop:true,rotation,depth:layout.depth,role:'projectile'});
  }
  // The source shield contains only a front arc; do not invent a source back half.
  if(world.hero.shield>0)this.paint('shield','shield',now/30,chest,feet,96,.65,'chest-front',{loop:true,depth:feet.y+3,role:'shield-front'});
  for(const [key,state]of this.images)if(!this.used.has(key)){state.image.destroy();this.images.delete(key);}
 }
 private releaseTarget(event:CombatEvent){const hit=this.flashes.find(f=>f.kind==='hit'&&f.event.skill===event.skill&&f.event.tick===event.tick);return hit?{...(this.attachment(hit.event.id,'chest')??projectFx(hit.event.position))}:projectFx(event.target??event.position);}
 diagnostics(){return {texture:source.texture.key,ready:this.scene.textures.exists(source.texture.key),errors:[...this.errors],consumeTick:this.consumedTick,totalConsumed:this.totalConsumed,totalCreated:this.totalCreated,recentClips:[...this.recentClips],cancelReason:this.cancelReason,clock:this.lastNow,interpolation:this.lastFraction,flashes:this.flashes.length,projectiles:this.flight.size,images:[...this.images.values()].map(({image,clip,anchor,ground,role,endpoints})=>({texture:image.texture.key,clip,frame:image.frame.name,role,anchor,x:image.x,y:image.y,depth:image.depth,ground:{...ground},origin:[image.originX,image.originY],scale:[image.scaleX,image.scaleY],flip:image.flipX,endpoints}))};}
}
