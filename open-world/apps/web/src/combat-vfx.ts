import {ShieldFeedback} from './shield-feedback.ts';
import {combatHash} from './world-numbers.ts';
import {CameraShake,combatShakeTier,combatShakeDirection,hitDirection,actorPosition} from './hit-feedback.ts';
import Phaser from 'phaser';
import type {World,CombatEvent,Zone,Projectile} from '../../../packages/simulation/index.ts';
import {getBossDefinition,chapterBossSkills,monsterSkills} from '../../../packages/content/chapter-combat.ts';
import type {RenderPose,SocketName} from './effect-attachments.ts';
import sourceManifest from '../../../packages/asset-manifest/skill-fx.json';
import physicalManifest from '../../../packages/asset-manifest/combat-physical-fx.json';
import {PhysicalVfx} from './vfx-physical.ts';
import {physicalSpec} from './physical-vfx-spec.ts';
import {isShowcaseKey} from './vfx-showcase.ts';
import expandedManifest from '../../../packages/asset-manifest/vfx-v2.json';
import libraryManifest from '../../../packages/asset-manifest/combat-layer-fx.json';
import metricsManifest from '../../../packages/asset-manifest/combat-fx-metrics.json';
import hitManifest from '../../../packages/asset-manifest/combat-hit-fx.json';
import cookedManifest from '../../../packages/asset-manifest/combat-cooked-fx.json';
import {hitLayer,critLayer,areaLayer,freezeLayer,iceStatusLayer,buffLayer,statusMarkerKind,statusMarkerLayers,type StatusMarkerKind} from './vfx-hit-style.ts';
import {vfxPresence,visibleFxScale,stageOpacity} from './vfx-presence.ts';
import {projectFx,projectileLayout,sourceFrame,type FxClip,type FxPoint} from './skill-fx-layout.ts';
import {vfxProfile,vfxPalettes,vfxBudgets,type SkillVfxProfile} from './vfx-profiles.ts';
import {groundSize,beamFootprint,arcPoints,seededNoise} from './vfx-geometry.ts';
import {line,polygon,ribbon,lightning,ring,sparks,sigil} from './vfx-drawing.ts';
import {VfxPool} from './vfx-pool.ts';
import {enemyFlightStyles,enemyPresentation,castVfxGroup} from './enemy-vfx-style.ts';
import {enemyCircleWarning,enemyBeamWarning,taperedEnemyTrail,enemyFlightBody} from './enemy-vfx-drawing.ts';
import {blizzardSnow} from './blizzard-vfx.ts';
import {groundZoneGeometry,groundZoneStyle} from './ground-zone-vfx.ts';
import {lightningDischarge} from './lightning-arrow-vfx.ts';
import {drawIceCrystal,drawIceMissile} from './ice-vfx.ts';
import telegraphReuse from '../../../packages/asset-manifest/telegraph-reuse.json';
import {ensureTelegraphSurface,telegraphSurfaceKey,telegraphFloorKey,telegraphFrontKey,telegraphColors} from './telegraph-polish.ts';
const source=sourceManifest as unknown as {texture:{key:string;image:string;atlas:string};clips:Record<string,FxClip>};
type Extra={key:string;image:string;atlas:string;count?:number;frames?:string[];peak?:string;duration?:number;fps:number;origin:number[];cell:number;visibleHeight:number;visibleSize?:number[];rotationOffset?:number;blend?:string;kind:string;loop?:boolean};
export const extraClips={...expandedManifest.clips,...libraryManifest.clips,...hitManifest.clips,...cookedManifest.clips} as unknown as Record<string,Extra>;
const renderMetrics=metricsManifest as Record<string,{visibleSize:number[];duration:number;sustainFrames?:string[]}>;
Object.assign(extraClips,physicalManifest.clips);
type Flash={id:number;event:CombatEvent;profile:SkillVfxProfile;stage:'windup'|'release'|'impact'|'surface';life:number;lite?:boolean;point?:FxPoint;ground?:FxPoint;segments?:{from:FxPoint;to:FxPoint;depth:number}[]};
type Flight={from:FxPoint;to:FxPoint;launch:FxPoint;emitter:SocketName;frame?:string;born:number;tick:number;points:FxPoint[]};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const group=castVfxGroup;
/** Windup telegraph radius: current skill def, else radius recorded when the telegraph was built, else 2. Never throws on skills missing from monsterSkills. */
export const telegraphRadius=(skill:string|undefined,recorded?:number):number=>monsterSkills[skill??'']?.radius??recorded??2;
/** Noise caps (presentation only): full impact bursts per cast per tick, and hit-spark sets per tick. */
const FULL_IMPACTS_PER_CAST=3,HIT_SPARK_SETS=6,HIT_SPARK_TICKS=7,STATUS_MARKER_CAP=10;
export function preloadSkillEffects(scene:Phaser.Scene){scene.load.atlas(source.texture.key,source.texture.image,source.texture.atlas);scene.load.image(telegraphReuse.key,telegraphReuse.image);for(const clip of Object.values(extraClips))scene.load.atlas(clip.key,clip.image,clip.atlas);}

/** Presentation-only: consumes simulation clocks, identifiers and collision results. */
export class SkillEffects{
 private physicalVfx?:PhysicalVfx;
 private physical(){return this.physicalVfx??=new PhysicalVfx(this.scene,this.pool,this.reduced,(id,name)=>this.attachment(id,name),(key,id,age,point,ground,size,alpha,tint)=>this.sprite(key,id,age,point,ground,size,alpha,{normal:true,tint,tintFill:tint!==undefined}),this.heroPose);}
 private pool:VfxPool;private flashes:Flash[]=[];private flights=new Map<number,Flight>();private zones=new Map<number,{started:number;delay:number}>();private errors=new Set<string>();private world?:World;private consumedTick=-1;private now=0;private serial=0;private totalConsumed=0;private shake=new CameraShake();private shield=new ShieldFeedback();private shieldAngle=0;private enemyShields=new Map<string,{fb:ShieldFeedback;angle:number}>();private enemyShieldProfile=vfxProfile('player/barrier');private shieldProfile=vfxProfile('player/ward');private heroShieldSpan=45;private warningCount=0;private beamSegments=0;private recent=new Set<string>();private particles=0;private statusMarkerCount=0;
 private hitSparks:{id:number;event:CombatEvent;direction:FxPoint;point?:FxPoint}[]=[];
 private telegraphs=new Map<string,{started:number;ends:number;radius?:number}>();
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean,private attachment:(id:string,name:SocketName,release?:boolean)=>FxPoint|undefined,private heroPose:()=>RenderPose&{skill:string}|undefined,private sound:(kind:string)=>void=()=>{}){this.pool=new VfxPool(scene,vfxBudgets.decorativeImages);ensureTelegraphSurface(scene);}
 reset(){this.physicalVfx?.reset();this.hitSparks=[];this.pool.clear();this.flashes=[];this.flights.clear();this.zones.clear();this.telegraphs.clear();this.world=undefined;this.consumedTick=-1;this.now=0;this.shake.reset();this.shield.reset();this.enemyShields.clear();this.shieldAngle=0;this.errors.clear();this.recent.clear();}
 destroy(){this.reset();this.pool.destroy();}
 private profile(key:string){const p=vfxProfile(key);if(!p&&!this.errors.has(key)){this.errors.add(key);}return p;}
 consume(w:World){
  if(this.world===w&&this.consumedTick===w.tick)return;if(this.world&&this.world!==w&&(this.world.region.id!==w.region.id||w.tick<this.consumedTick))this.reset();this.world=w;this.consumedTick=w.tick;
  this.physical().consume(w);
  const shield=this.shield.consume(w.hero.shield,w.tick,w.events);if(this.shield.skill)this.shieldProfile=vfxProfile('player/'+this.shield.skill)??this.shieldProfile;
  const attacker=actorPosition(w,this.shield.sourceId);if(attacker&&this.shield.sourceId){const a=projectFx(attacker),h=projectFx(w.hero.position);this.shieldAngle=Math.atan2(a.y-h.y,a.x-h.x);}
  if(shield.broke){const hurt=w.events.some(e=>e.type==='hit_resolved'&&e.id==='hero'&&e.tick===shield.tick&&(e.amount??0)>0);this.shake.trigger(hurt?3:2,shield.tick);this.sound('shield-break');}
  this.consumeEnemyShields(w);
  const deaths=new Set(w.events.filter(e=>e.type==='entity_died').map(e=>`${e.tick}:${e.id}`)),impactsByCast=new Map<string,number>();let sparkSets=0;
  for(const event of w.events){if(event.type==='hit_resolved'&&event.id!=='hero'&&(event.amount??0)>0&&!isShowcaseKey(event.vfxKey)&&sparkSets++<HIT_SPARK_SETS)this.hitSparks.push({id:++this.serial,event,direction:hitDirection(w,event)});this.shake.trigger(combatShakeTier(w,event,deaths),event.tick,combatShakeDirection(w,event));this.totalConsumed++;
   // These casts already own their main and contact layers. Status labels and
   // persistent markers remain; a generic status slash would obscure the weapon.
   if(event.type==='status_changed'&&physicalSpec('player/'+event.skill))continue;
   const impact=event.type==='hit_resolved'&&(event.amount??0)>0,cast=event.type==='cast_started'||event.type==='cast_released'||event.type==='effect_triggered'&&!!(event.vfxKey?.startsWith('combo/')||event.vfxKey?.startsWith('hex/'))||event.type==='status_changed'&&event.change==='applied'||event.type==='healed'&&!!event.amount||event.type==='revived';const surface=event.type==='effect_activated';if(!impact&&!cast&&!surface)continue;
   const key=event.vfxKey??(!impact&&event.skill&&event.id==='hero'?'player/'+event.skill:'system/damage'),raw=this.profile(key);if(!raw)continue;const p=enemyPresentation(raw,w.enemies.find(n=>n.id===(event.sourceId??event.id)));
   const monster=monsterSkills[event.skill??''];if(event.type==='cast_started'&&key.startsWith('monster/')&&monster?.kind==='zone')this.telegraphs.set(group(event),{started:event.tick,ends:event.tick+(event.windup??monster.windup)+(monster.delay||25)-1,radius:monster.radius});
   const stage=surface?'surface':impact?'impact':event.type==='cast_started'?'windup':'release';
   if(stage==='release')this.flashes=this.flashes.filter(f=>!(f.stage==='windup'&&group(f.event)===group(event)));
   // Area hits: only the first few targets of one cast get the full impact burst; the rest keep tint and sparks, so big pulls stay readable.
   const castKey=stage==='impact'?group(event)+'@'+event.tick:'',impactIndex=castKey?impactsByCast.get(castKey)??0:0;if(castKey)impactsByCast.set(castKey,impactIndex+1);
   this.flashes.push({id:++this.serial,lite:impactIndex>=FULL_IMPACTS_PER_CAST,event,profile:p,stage,life:stage==='windup'?Math.max(1,event.windup??1):stage==='impact'?p.impactTicks+6:p.releaseTicks});this.recent.add(key);
   if(stage==='release'&&p.family==='shield'&&event.id==='hero')this.shieldProfile=p;
  }
 }
 private point(id:string,name:SocketName,fallback:FxPoint,release=false){return this.attachment(id,name,release)??fallback;}
 private releasePoint(id:string,name:SocketName,ground:FxPoint){const point=this.point(id,name,ground,true),feet=this.point(id,'feet',ground);return {x:ground.x+point.x-feet.x,y:ground.y+point.y-feet.y};}
 private sprite(key:string,clipId:string,seconds:number,point:FxPoint,ground:FxPoint,size:number,alpha:number,options:{loop?:boolean;rotation?:number;facing?:number;depth?:number;decor?:boolean;normal?:boolean;origin?:[number,number];progress?:number;tint?:number;tintFill?:boolean}={}){
  if(!this.pool.visible(point.x,point.y,size))return undefined;
  const extra=extraClips[clipId],clip=source.clips[clipId];if(!extra&&!clip){this.errors.add('clip:'+clipId);return;}
  const frames=extra&&(options.loop&&extra.kind==='flight'?renderMetrics[clipId]?.sustainFrames??extra.frames:extra.frames),time=options.progress===undefined?seconds:clamp(options.progress)*.999*(extra?.duration??renderMetrics[clipId]?.duration??clip?.duration??0);
  const frame=extra?(frames?.length?this.reduced()?extra.peak??frames[Math.floor(frames.length*.45)]:frames[options.progress===undefined?options.loop?Math.floor(time*extra.fps)%frames.length:Math.min(frames.length-1,Math.floor(time*extra.fps)):Math.min(frames.length-1,Math.floor(clamp(options.progress)*frames.length))]:String(this.reduced()?0:Math.min((extra.count??1)-1,Math.floor(time*extra.fps)%(options.loop?extra.count??1:100000)))):sourceFrame(clip,time,this.reduced(),options.loop);
  if(frame===undefined)return;const texture=extra?.key??source.texture.key;
  if(!this.scene.textures.exists(texture)||!this.scene.textures.get(texture).has(frame)){this.errors.add('frame:'+clipId+'/'+frame);return;}
  const image=this.pool.image(key,texture,frame,!options.decor);if(!image)return;
  const origin=options.origin??extra?.origin??clip.origin,scale=visibleFxScale(size,extra?.visibleSize??renderMetrics[clipId]?.visibleSize,[image.frame.realWidth,image.frame.realHeight]);
  image.setOrigin(origin[0],origin[1]).setPosition(point.x,point.y).setScale(scale).setAlpha(clamp(alpha)).setDepth(options.depth??ground.y+3);
  // Normal color-bearing bodies are legible over bright snow and grass; additive only on the source glow layer.
  if((extra?.blend==='add'||!extra&&clip.blend==='add')&&!options.normal)image.setBlendMode(Phaser.BlendModes.ADD);
  if(options.tint!==undefined){image.setTint(options.tint);if(options.tintFill)image.setTintMode(Phaser.TintModes.FILL);}
  if(options.rotation!==undefined)image.setRotation(options.rotation+(extra?.rotationOffset??clip?.rotationOffset??0));else image.setFlipX(options.facing===-1);
  return image;
 }
 private burstParticles(g:Phaser.GameObjects.Graphics,point:FxPoint,p:SkillVfxProfile,t:number,seed:number,count=8){const actual=Math.min(this.reduced()?2:count,Math.max(0,vfxBudgets.particles-this.particles));this.particles+=actual;sparks(g,point,p,t,seed,actual);}
 draw(w:World,fraction:number){
  if(this.world!==w){if(this.world&&(this.world.region.id!==w.region.id||w.tick<this.consumedTick))this.reset();this.world=w;}if(w.hero.hp<=0){this.pool.clear();this.flashes=[];this.flights.clear();this.telegraphs.clear();this.zones.clear();this.shake.reset();return;}
  if(!w.paused||w.tick>Math.floor(this.now))this.now=w.tick+(w.paused?0:clamp(fraction));this.pool.begin();this.warningCount=0;this.beamSegments=0;this.particles=0;
  this.flashes=this.flashes.filter(f=>this.now-f.event.tick<f.life);
  for(const [key,t]of this.telegraphs)if(w.tick>t.ends+20)this.telegraphs.delete(key);
  for(const f of this.flashes)this.drawFlash(w,f);
  const activeFlights=new Set(w.projectiles.map(p=>p.id));for(const id of this.flights.keys())if(!activeFlights.has(id))this.flights.delete(id);
  for(const p of w.projectiles)this.drawProjectile(w,p);
  const activeZones=new Set(w.zones.map(z=>z.id));for(const id of this.zones.keys())if(!activeZones.has(id))this.zones.delete(id);
  for(const z of w.zones)this.drawZone(w,z);
  for(const sequence of w.sequences)if(sequence.skill.mechanics?.schedule?.followCaster){const actor=w.players.get(sequence.sourceId)?.hero??w.hero,p=this.profile(sequence.vfxKey??'player/'+sequence.skill.id);if(!p||physicalSpec(p.key))continue;const center=projectFx(actor.position),size=groundSize(sequence.skill.radius),g=this.pool.graphics('channel:'+sequence.castId,center.y+3)!;ring(g,center,size.width/2,size.height/2,p,.55);const turn=(this.now-sequence.started)*.15;for(let i=0;i<3;i++)ribbon(g,arcPoints(center.x,center.y,size.width*.44,size.height*.44,turn+i*Math.PI*2/3,turn+i*Math.PI*2/3+1.8),5,p,.7);}
  this.drawStatusMarkers(w);this.drawBosses(w);this.drawShield(w);this.drawHitSparks();this.particles+=this.physical().drawGround(this.now,Math.max(0,vfxBudgets.particles-this.particles));this.pool.end();
 }
 private drawStatusMarkers(w:World){
  this.statusMarkerCount=0;const seen=new Set<string>(),markers=new Map<string,{freeze:boolean;kinds:Set<StatusMarkerKind>}>();
  for(const status of w.statuses){if(status.ends<=w.tick)continue;const kind=status.effect.kind,freeze=kind==='freeze',marker=statusMarkerKind(kind);if(!freeze&&!marker)continue;
   const entry=markers.get(status.targetId)??{freeze:false,kinds:new Set<StatusMarkerKind>()};if(freeze)entry.freeze=true;else entry.kinds.add(marker!);markers.set(status.targetId,entry);}
  for(const [targetId,entry] of markers){
   if(this.statusMarkerCount>=STATUS_MARKER_CAP)break;
   const enemy=w.enemies.find(e=>e.id===targetId),player=w.players.get(targetId)?.hero??(targetId===w.playerId?w.hero:undefined),actor=enemy?.alive?enemy:player;if(!actor||actor.hp<=0)continue;
   const ground=projectFx(actor.position);if(!this.pool.visible(ground.x,ground.y))continue;const foot=this.point(targetId,'feet',ground),chest=this.point(targetId,'chest',{x:foot.x,y:foot.y-32});this.statusMarkerCount++;
   if(entry.freeze)this.sprite('status-layer:'+targetId+':freeze',freezeLayer.clip,0,{x:foot.x,y:foot.y-freezeLayer.size*.32},foot,freezeLayer.size,.92,{progress:freezeLayer.hold,normal:true,depth:foot.y+12});
   // Cooked FX status layers, looping on the battle clock; at most two categories per actor, in statusMarkerLayers order.
   const shown=(Object.keys(statusMarkerLayers) as StatusMarkerKind[]).filter(k=>entry.kinds.has(k)).slice(0,2);
   shown.forEach((kind,i)=>{const layer=statusMarkerLayers[kind],key='status:'+targetId+':'+kind;if(seen.has(key))return;seen.add(key);
    const x=chest.x+(shown.length>1?(i?14:-14):0),y=kind==='control'?chest.y-layer.lift:chest.y-layer.lift*.5;
    this.sprite(key,layer.clip,this.now/30,{x,y},foot,layer.size,kind==='control'?.95:.85,{loop:true,normal:true,depth:foot.y+(kind==='control'?14:11),decor:true});});
  }
 }
 private drawFlash(w:World,f:Flash){
  if(physicalSpec(f.profile.key)){
   const ground=projectFx(f.event.position),owner=f.event.sourceId??f.event.id;
   if(f.stage==='release'){
    f.ground??={...ground};f.point??=this.releasePoint(owner,f.profile.anchor,ground);
    if(f.profile.key==='player/snipe'&&!f.segments){const hit=this.flashes.find(h=>h.stage==='impact'&&group(h.event)===group(f.event)&&h.event.tick===f.event.tick);const to=hit?this.point(hit.event.id,'chest',projectFx(hit.event.position)):f.event.target?projectFx(f.event.target):{x:f.point.x+w.hero.facing*80,y:f.point.y};f.segments=[{from:{...f.point},to:{...to},depth:ground.y+4}];}
    if(f.segments)this.beamSegments+=f.segments.length;
   }
   if(this.physical().flash(w,f.event,f.profile,f.stage,Math.max(0,this.now-f.event.tick),'event:'+f.id,f.lite,f.point&&f.ground?{point:f.point,feet:f.ground,target:f.segments?.[0]?.to}:undefined))return;
  }
  const e=f.event,p=f.profile,presence=vfxPresence(p),c=vfxPalettes[p.element],age=Math.max(0,this.now-e.tick),t=clamp(age/f.life),alpha=stageOpacity(t),key='event:'+f.id,owner=e.type==='status_changed'?e.id:['healed','revived'].includes(e.type)?e.targetId??e.id:e.sourceId??e.id,ground=projectFx(e.position),facing=owner==='hero'?w.hero.facing:w.enemies.find(n=>n.id===owner)?.facing??1;
  if(f.stage==='windup'){
   if(owner!=='hero'&&!w.enemies.some(n=>n.id===owner&&n.alive))return;
   const telegraph=this.telegraphs.get(group(e));if(telegraph&&e.target)this.warning('cast:'+group(e),projectFx(e.target),telegraphRadius(e.skill,telegraph.radius),telegraph.started,telegraph.ends,p);
   const foot=this.point(owner,'feet',ground),point=this.point(owner,p.anchor,foot),g=this.pool.graphics(key,foot.y+3,false);if(!g)return;
   if(p.key==='player/lightning_bolt'){this.sprite(key+':charge','lightning-charge',0,point,foot,9+t*15,.3+t*.45,{depth:foot.y+4});for(const path of lightningDischarge(point,t*.16,this.reduced()?f.id:Math.floor(this.now/2),this.reduced()).slice(0,3))ribbon(g,[...path].reverse(),1.2,p,.25+t*.55);return;}
   this.sprite(key+':charge-body',['arcane','shadow'].includes(p.element)?'library-void-charge':'library-warm-burst',0,point,foot,presence.chargeSize*(.65+t*.35),.4+t*.5,{progress:.4+t*.2,depth:foot.y+4,normal:true});
   return;
  }
  if(f.stage==='impact'){
   const targetFeet=this.point(e.id,'feet',ground),chest=this.point(e.id,'chest',ground);
   f.ground??={...targetFeet};f.point??=e.contact?{x:projectFx(e.contact).x+chest.x-targetFeet.x,y:projectFx(e.contact).y+chest.y-targetFeet.y}:{...chest};
   if(f.lite||!this.pool.visible(f.point.x,f.point.y,100))return;
   if(p.key==='player/lightning_bolt'){const g=this.pool.graphics(key,f.ground.y+5)!;for(const path of lightningDischarge(f.point,t,f.id,this.reduced()))ribbon(g,path,Math.max(1,4*(1-t)),p,alpha);this.sprite(key+':electric-hit','lightning-arrow-hit',age/30,f.point,f.ground,presence.impactSize*(1+t*.2),alpha,{depth:f.ground.y+5,normal:true,progress:t});this.sprite(key+':core','lightning-charge',0,f.point,f.ground,18+30*t,alpha*.6,{depth:f.ground.y+6});return;}
   const hit=hitLayer(p);this.sprite(key+':hit',hit.clip,0,f.point,f.ground,hit.size,1,{progress:t,depth:f.ground.y+5,normal:true,facing});if(e.crit)this.sprite(key+':crit',critLayer.clip,0,f.point,f.ground,critLayer.size,1,{progress:Math.min(1,t*1.4),depth:f.ground.y+6,normal:true});return;
  }
  f.ground??={...ground};f.point??=f.stage==='release'?this.releasePoint(owner,p.anchor,ground):{...this.point(owner,p.anchor,ground)};
  if(f.stage==='release'&&e.vfxKey?.startsWith('monster/')&&monsterSkills[e.skill??'']?.kind==='zone')return;
  if(f.stage==='surface'&&p.family==='projectile'&&e.radius){const center=projectFx(e.position),size=groundSize(e.radius),area=areaLayer(p)??{clip:hitLayer(p).clip,scale:.8};this.sprite(key+':explosion',area.clip,0,center,center,Math.max(160,size.width*area.scale),1,{progress:t,normal:true,depth:center.y+2});return;}
  if(p.family==='projectile'){
   if(p.key==='player/lightning_bolt'){if(age<5)this.sprite(key+':discharge','lightning-charge',0,f.point,f.ground,24-age*3,(1-age/5)*.75,{depth:f.ground.y+4});return;}
   if(age<6)this.sprite(key+':launch','library-warm-burst',0,f.point,f.ground,presence.chargeSize+8,(1-age/6)*.9,{progress:age/6,depth:f.ground.y+4,normal:true});return;
  }
  if(p.family==='chain'){
   if(!f.segments){let from=f.point;f.segments=this.flashes.filter(h=>h.stage==='impact'&&group(h.event)===group(e)&&h.event.tick===e.tick).map(h=>{const to=this.point(h.event.id,'chest',projectFx(h.event.position)),segment={from:{...from},to:{...to},depth:this.point(h.event.id,'feet',projectFx(h.event.position)).y+5};from=to;return segment;});}
   for(const [i,segment]of f.segments.entries()){const g=this.pool.graphics(key+':'+i,segment.depth)!;if(p.motif==='tracer')ribbon(g,[segment.from,segment.to],3,p,alpha);else lightning(g,segment.from,segment.to,p,age,f.id+i*31,alpha);this.beamSegments++;}return;
  }
  if(p.family==='slash'){
   const foot=this.point(owner,'feet',f.ground),point=age<8?this.point(owner,'weapon',f.point):f.point,g=this.pool.graphics(key,foot.y+4)!;
   const direction=facing<0?Math.PI:0,start=direction-1.4,end=direction+.9,rx=presence.size*.5,ry=presence.size*.28;
   ribbon(g,arcPoints(point.x,point.y,rx,ry,start+(end-start)*t*.65,end+(end-start)*t*.15),Math.max(2,(1-t)*(5+p.power*2)),p,alpha);
   if(p.motif.includes('cross'))ribbon(g,arcPoints(point.x,point.y,rx*.8,ry*.8,direction+.8,direction-1.1),4,p,alpha*.65);
   this.sprite(key+':slash',presence.release,0,point,foot,presence.size,alpha*.95,{facing,progress:t,normal:true,...(['ice','shadow'].includes(p.element)?{tint:c.light,tintFill:true}:{})});if(p.motif.includes('cross'))this.sprite(key+':cross',presence.release,0,point,foot,presence.size*.82,alpha*.8,{progress:Math.min(1,t+.2),rotation:(facing<0?Math.PI:0)+.55,normal:true,decor:true});return;
  }
  if(p.family==='dash'){
   const from=projectFx(e.origin??e.position),to=ground,g=this.pool.graphics(key,ground.y+1)!;ribbon(g,[from,to],10*(1-t)+2,p,alpha*.55); // a streak, not a slabthis.sprite(key+':arrival',presence.release,0,to,to,presence.size,alpha,{progress:t,normal:true,depth:to.y+3,...(p.element==='storm'?{tint:c.light,tintFill:true}:{})});
   this.burstParticles(g,to,p,t,f.id,8);return;
  }
  if(p.family==='heal'||p.family==='shield'){
   const foot=this.point(owner,'feet',ground),chest=this.point(owner,'chest',foot),g=this.pool.graphics(key,foot.y+2)!;
   
   if(p.family==='heal')for(let i=0;i<(this.reduced()?2:7);i++){const phase=(t+i/7)%1,x=foot.x+Math.sin(i*2.4+phase*2)*p.size*.35,y=foot.y-phase*p.size;g.fillStyle(i%2?c.main:c.light,(1-phase)*alpha).fillEllipse(x,y,5,9);}
   // Solid tint fills turned the soft halos into boxes; shields flash the vivid element layer and the glyph keeps its shading under a multiply tint (2026-10-16).
   if(p.family==='shield'){const buff=buffLayer(p);this.sprite(key+':body',buff.clip,0,chest,foot,buff.size,alpha*.95,{progress:.2+t*.8,normal:true,depth:foot.y+3,...(['steel','earth','blood'].includes(p.element)?{tint:c.light}:{})});}
   else this.sprite(key+':body',presence.release,0,foot,foot,presence.size,alpha*.9,{progress:t,normal:true});
   if(!this.reduced())this.sprite(key+':aura','library-summon',0,foot,foot,presence.size*.65,alpha*.5,{progress:t,depth:foot.y+1,decor:true,...(p.family==='shield'?{tint:c.light}:{})});return;
  }
  if(e.type==='status_changed'&&p.element==='ice'){const foot=this.point(owner,'feet',ground);this.sprite(key+':status',iceStatusLayer.clip,0,foot,foot,iceStatusLayer.size,alpha*.85,{progress:t,normal:true,depth:foot.y+4});return;}
  if(p.family==='burst'){const center=ground,d=groundSize(Math.max(.4,e.radius??1)),area=areaLayer(p),size=Math.max(140,d.width*(area?.scale??.9));this.sprite(key+':body',area?.clip??presence.release,0,center,center,area?size:size*.8,area?1:alpha*.7,{progress:t,normal:true,depth:center.y-1});return;}
  const center=p.family==='zone'?projectFx(e.target??e.position):ground,radius=e.radius??1,d=groundSize(Math.max(.4,radius)),g=this.pool.graphics(key,center.y+1)!;
  if(p.family==='spin'){
   const turn=(this.reduced()?0:t*Math.PI*1.5)+p.variant;for(let i=0;i<(p.motif==='blades'?4:2);i++)ribbon(g,arcPoints(center.x,center.y,d.width*.45,d.height*.45,turn+i*Math.PI,turn+i*Math.PI+2.5),8*(1-t)+2,p,alpha);
   const count=this.reduced()?1:p.motif==='blades'?3:2;for(let i=0;i<count;i++){const a=turn+i*Math.PI*2/count,point={x:center.x+Math.cos(a)*d.width*.16,y:center.y+Math.sin(a)*d.height*.16};this.sprite(key+':blade:'+i,'library-slash',0,point,point,Math.min(presence.size,d.width*.8),alpha,{progress:t,rotation:a,depth:point.y+3,normal:true,decor:i>0});}
  }
  if(p.family==='zone'&&f.stage==='surface'||p.family==='mark'||p.family==='summon')this.sprite(key+':body',p.motif==='meteor'?'library-fire-rain':presence.release,0,center,center,Math.min(presence.size,Math.max(96,d.width*.85)),alpha*(p.element==='ice'?.65:.95),{progress:t,normal:true,depth:center.y-1,tint:['blood','poison'].includes(p.element)?c.main:['earth','holy'].includes(p.element)?c.light:undefined,tintFill:p.element==='poison'});
  this.burstParticles(g,center,p,t,f.id,12+p.power*3);
 }
 private drawProjectile(w:World,p:Projectile){
  const raw=this.profile(p.vfxKey??(p.enemy?'monster/'+(p.skill??'basic-ranged'):'player/'+(p.skill??'bolt')));if(!raw)return;const profile=enemyPresentation(raw,w.enemies.find(n=>n.id===(p.sourceId??p.owner))),style=p.enemy?enemyFlightStyles[profile.key]:undefined,electric=profile.key==='player/lightning_bolt',presence=vfxPresence(profile);
  const previous=p.previous??p.position,start=projectFx(p.origin??previous),owner=p.sourceId??p.owner??'hero';let flight=this.flights.get(p.id);
  if(!flight){const launch=this.releasePoint(owner,profile.anchor,start),targetFeet=this.point(p.targetId??'hero','feet',projectFx(p.target??p.position)),target=this.point(p.targetId??'hero','chest',targetFeet),pose=owner==='hero'?this.heroPose():undefined;flight={from:{x:launch.x-start.x,y:launch.y-start.y},to:{x:target.x-targetFeet.x,y:target.y-targetFeet.y},launch:{...launch},emitter:profile.anchor,frame:pose?.releaseFrame??pose?.frame,born:w.tick,tick:-1,points:[]};this.flights.set(p.id,flight);}
  const layout=projectileLayout(previous,p.position,this.now-w.tick,p.origin,p.target,flight.from,flight.to),point=layout.position;
  if(flight.tick!==w.tick&&!w.paused){flight.points.push({...projectileLayout(previous,previous,0,p.origin,p.target,flight.from,flight.to).position});if(flight.points.length>(style?.trail??(electric?3:7)))flight.points.shift();flight.tick=w.tick;}
  if(!this.pool.visible(point.x,point.y,profile.size+100))return;
  const next={x:p.position.x+p.direction.x*.01,y:p.position.y+p.direction.y*.01},current=projectileLayout(p.position,p.position,0,p.origin,p.target,flight.from,flight.to).position,forward=projectileLayout(p.position,next,1,p.origin,p.target,flight.from,flight.to).position,angle=Math.atan2(forward.y-current.y,forward.x-current.x);
  if(!p.enemy&&this.physical().flight('physical-flight:'+p.id,p,profile,point,layout.ground,angle,this.now-flight.born,layout.depth))return;
  const g=this.pool.graphics('flight:'+p.id,layout.ground.y+2,false);
  if(g){const points=[...flight.points,point];if(p.enemy)taperedEnemyTrail(g,points,style?.width??5,profile);else for(let i=1;i<points.length;i++)ribbon(g,[points[i-1],points[i]],Math.max(1,i/points.length*(profile.element==='fire'?7:electric?2:3)),profile,i/points.length*(electric?.3:.5));if(profile.element==='storm'&&!electric)lightning(g,{x:point.x-Math.cos(angle)*45,y:point.y-Math.sin(angle)*45},point,profile,this.now,p.id);if(electric)g.fillStyle(vfxPalettes.storm.light,.95).fillCircle(point.x,point.y,2);}
  if(profile.element==='ice'){const core=this.pool.graphics('ice-core:'+p.id,this.now-flight.born<2?layout.ground.y-1:layout.depth+1);if(core)drawIceMissile(core,point,angle,profile.power===3?100:78,profile.power===3?32:26);}
  if(style&&style.body!=='source'){const head=this.pool.graphics('projectile-head:'+p.id,layout.depth)!,reduced=this.reduced()||this.particles+3>vfxBudgets.particles;if(!reduced)this.particles+=3;enemyFlightBody(head,point,angle,{...style,length:Math.max(style.length,presence.size*.85),width:style.width*(profile.power===3?1.45:1.2)},profile,this.now,reduced);}
  else this.sprite('projectile:'+p.id,presence.flight??profile.flight,(this.now-flight.born)/30,point,layout.ground,Math.max(style?.length??0,presence.size)*(electric&&!this.reduced()?.35+.65*clamp((this.now-flight.born)/2):1),1,{loop:true,rotation:angle,depth:this.now-flight.born<2?layout.ground.y-1:layout.depth,normal:true,origin:style?.tipAnchor,tint:profile.element==='poison'?vfxPalettes.poison.light:undefined});
 }
 private warning(key:string,position:FxPoint,radius:number,started:number,ends:number,profile:SkillVfxProfile){
  const d=groundSize(radius);if(!this.pool.visible(position.x,position.y,d.width))return;this.warningCount++;const g=this.pool.graphics('warning:'+key,position.y-1)!;
  const q=enemyCircleWarning(g,position,radius,this.now,started,ends,profile,this.reduced());
  // Telegraph layers are critical: the decorative budget may never hide a real hit area or its countdown.
  this.pool.image('warning-floor:'+key,telegraphFloorKey,'__BASE')?.setOrigin(.5).setPosition(position.x,position.y).setDisplaySize(d.width,d.height).setTint(telegraphColors.edge).setAlpha(Math.min(1,q.floor)).setDepth(position.y-2);
  this.pool.image('warning-front:'+key,telegraphFrontKey,'__BASE')?.setOrigin(.5).setPosition(position.x,position.y).setDisplaySize(d.width*q.front,d.height*q.front).setTint(telegraphColors.edge).setAlpha(Math.min(1,q.frontAlpha)).setDepth(position.y-1.5);
 }
 private drawZone(w:World,z:Zone){
  const raw=this.profile(z.vfxKey??(z.enemy?'monster/basic-area':'player/'+(z.skill??'ember')));if(!raw)return;const p=enemyPresentation(raw,w.enemies.find(n=>n.id===z.sourceId));
  if(!z.enemy&&this.physical().zone('physical-zone:'+z.id,z,p,this.now))return;
  let state=this.zones.get(z.id);if(!state){state={started:z.started??w.tick,delay:Math.max(1,z.delay)};this.zones.set(z.id,state);}
  const center=projectFx(z.position),d=groundSize(z.radius);if(z.delay>0){const telegraph=this.telegraphs.get(group(z));if(z.enemy)this.warning('zone:'+z.id,center,z.radius,telegraph?.started??state.started,w.tick+z.delay,p);else{const g=this.pool.graphics('zone:'+z.id,center.y-1)!;ring(g,center,d.width/2,d.height/2,p,.65);}if(p.motif==='meteor'){const remaining=Math.max(0,(z.delay-1)/state.delay),point={x:center.x-55*remaining,y:center.y-(150+z.radius*35)*remaining};this.sprite('zone-incoming:'+z.id,'fireball-flight',(this.now-state.started)/30,point,center,Math.min(190,d.width*.55),1,{loop:true,normal:true,depth:center.y+4,rotation:Math.PI/2});}return;}
  if(!this.pool.visible(center.x,center.y,d.width))return;const age=(this.now-state.started)/30,alpha=Math.min(1,z.life/15),g=this.pool.graphics('zone:'+z.id,center.y-1)!;ring(g,center,d.width/2,d.height/2,p,alpha*.85,age*.3);
  if(p.motif==='blizzard'){this.drawBlizzard(z,p,age,alpha,g);return;}
  if(p.element==='ice'){g.fillStyle(vfxPalettes.ice.dark,alpha*.3).fillEllipse(center.x,center.y,d.width*.96,d.height*.96);this.sprite('zone-ice-wave:'+z.id,'library-ice-wave',age,center,center,d.width*.9,alpha*.7,{loop:true,normal:true,depth:center.y-1});return;}
  const presence=vfxPresence(p);if(presence.surface&&p.element!=='fire')this.sprite('zone-body:'+z.id,presence.surface,age,center,center,Math.min(d.width*.78,presence.size*1.35),alpha*.75,{loop:true,normal:true,depth:center.y-1,...(p.element==='poison'?{tint:vfxPalettes.poison.main,tintFill:true}:{})});if(p.motif==='meteor')this.sprite('zone-meteor:'+z.id,'library-fire-rain',age,center,center,Math.min(420,d.width*.9),alpha,{loop:true,normal:true,depth:center.y+2});
  if(!['fire','ice','nature'].includes(p.element)){this.drawGroundZone(z,p,age,alpha,g);return;}
  const count=this.reduced()?3:p.power===3?11:8;
  for(let i=0;i<count;i++){const phase=seededNoise(z.id+i*37),a=i*2.39996+age*(p.motif==='spiral'?.22:0),r=Math.sqrt((i+.4)/count)*z.radius*.78,point=projectFx({x:z.position.x+Math.cos(a)*r,y:z.position.y+Math.sin(a)*r});
   const clip=p.element==='fire'?'ground-flame':'nature-aura-05';
   this.sprite(`zone:${z.id}:${i}`,clip,age+phase*1.7,point,point,(p.element==='fire'?112:72)*(0.8+phase*.5),alpha*.9,{loop:true,decor:true,depth:point.y+1,normal:true});
  }
 }
 private drawGroundZone(z:Zone,p:SkillVfxProfile,age:number,alpha:number,g:Phaser.GameObjects.Graphics){
  const center=projectFx(z.position),size=groundSize(z.radius),palette=vfxPalettes[p.element],style=groundZoneStyle(p.motif),geometry=groundZoneGeometry(z.position,z.radius,age,z.id,style,this.reduced());
  // Reuse the registered ground surface; horizontal missile artwork belongs to flights.
  // Starfall drops are arcane orbs (library-void-flight), not grey blade shards (2026-10-16).
  const material=this.pool.image('zone-surface:'+z.id,telegraphSurfaceKey,'__BASE',false);
  material?.setOrigin(.5).setPosition(center.x,center.y).setDisplaySize(size.width,size.height).setTint(palette.dark).setAlpha(alpha*.48).setDepth(center.y-2);
  for(const strand of geometry.strands){line(g,strand,13,palette.dark,alpha*.35);line(g,strand,6,palette.main,alpha*.8);line(g,strand,2,palette.light,alpha*.65);}
  for(const pulse of geometry.pulses)g.lineStyle(3,palette.main,Math.min(1,pulse.alpha*2.3)*alpha).strokeEllipse(center.x,center.y,size.width*pulse.radius,size.height*pulse.radius);
  for(const [i,drop]of geometry.drops.entries()){const trail=style==='arrows'?28:22;line(g,[{x:drop.position.x,y:drop.position.y-trail},drop.position],style==='arrows'?2:4,palette.main,drop.alpha*alpha);this.sprite('zone-drop:'+z.id+':'+i,style==='arrows'?'arrow':'library-void-flight',age+i*.08,drop.position,drop.ground,style==='arrows'?64:58,Math.min(1,drop.alpha*1.4)*alpha,{loop:true,rotation:Math.PI/2,normal:true,depth:drop.ground.y+3,decor:true});}
  // Storm fields crackle: library storm hits flicker at seeded spots inside the real radius (2026-10-16).
  if(p.element==='storm')for(let i=0;i<(this.reduced()?1:4);i++){const cycle=.6,t=age+seededNoise(z.id+i*53)*cycle,round=Math.floor(t/cycle),a=seededNoise(z.id+i*11+round*7)*Math.PI*2,r=Math.sqrt(seededNoise(z.id+i*29+round*13))*z.radius*.7,point=projectFx({x:z.position.x+Math.cos(a)*r,y:z.position.y+Math.sin(a)*r});
   this.sprite('zone-crackle:'+z.id+':'+i,'hit-storm',0,point,point,Math.min(110,size.width*.3),alpha*.95,{progress:(t%cycle)/cycle,normal:true,depth:point.y+2,decor:true});}
 }
 private drawBlizzard(z:Zone,p:SkillVfxProfile,age:number,alpha:number,ground:Phaser.GameObjects.Graphics){
  const center=projectFx(z.position),d=groundSize(z.radius),c=vfxPalettes.ice,reduced=this.reduced();ground.fillStyle(c.dark,.18*alpha).fillEllipse(center.x,center.y,d.width,d.height);ground.fillStyle(c.main,.09*alpha).fillEllipse(center.x,center.y,d.width*.94,d.height*.94);
  if(!reduced)for(let i=0;i<5;i++){const a=age*1.65+i*Math.PI*2/5,pressure=.5+.5*Math.sin(age*3.1+i*.7);ribbon(ground,arcPoints(center.x,center.y,d.width*(.33+i*.018),d.height*(.32+i*.016),a,a+1.8,18),3+pressure*3,p,alpha*(.25+pressure*.2));}
  const count=Math.min(reduced?8:108,Math.max(0,vfxBudgets.particles-this.particles));this.particles+=count;
  const bands=new Map<number,Phaser.GameObjects.Graphics>();
  for(const snow of blizzardSnow(z.position,z.radius,age,z.id,count,reduced)){
   const band=Math.max(0,Math.min(5,Math.floor((snow.ground.y-center.y+d.height/2)/d.height*6)));let g=bands.get(band);if(!g){g=this.pool.graphics('blizzard:'+z.id+':snow:'+band,center.y-d.height/2+(band+1)*d.height/6+4,false);if(!g)continue;bands.set(band,g);}
   const {x,y}=snow.position,s=snow.size,opacity=snow.opacity*alpha;
   if(!reduced)line(g,[snow.trail,snow.position],1.3,c.light,opacity*.35);
   if(s>4){for(let arm=0;arm<3;arm++){const a=arm*Math.PI/3,dx=Math.cos(a)*s,dy=Math.sin(a)*s,points=[{x:x-dx,y:y-dy},{x:x+dx,y:y+dy}];line(g,points,2.2,c.dark,opacity*.65);line(g,points,1.1,c.light,opacity);}g.fillStyle(c.light,opacity).fillCircle(x,y,1.4);}
   else{g.fillStyle(c.dark,opacity*.5).fillCircle(x,y,s*.47+1);g.fillStyle(c.light,opacity).fillCircle(x,y,s*.47);}
   if(snow.phase>.86&&!reduced){const t=(snow.phase-.86)/.14;g.lineStyle(1,c.main,(1-t)*alpha*.35).strokeEllipse(snow.ground.x,snow.ground.y,4+t*9,2+t*5);}
  }
 }
 private drawBosses(w:World){
  for(const cast of w.bossCasts){const owner=w.enemies.find(e=>e.id===cast.owner);if(!owner?.alive&&!cast.interrupted)continue;const p=this.profile('boss/'+cast.skill),def=owner?getBossDefinition(owner.art)?.skills.find(s=>s.id===cast.skill):undefined;if(!p||!def)continue;
   const center=projectFx(cast.position),target=projectFx(cast.target),age=this.now-cast.started,progress=clamp(age/(cast.ends-cast.started)),charging=!cast.resolved,post=Math.max(0,this.now-cast.ends),radius='radius' in def?def.radius??0:0;
   if(charging&&!cast.interrupted&&(def.kind==='zone'||def.kind==='trap')){const delay=def.kind==='trap'?('delay' in def?def.delay:150):('delay' in def?def.delay??0:0),ends=cast.ends+Math.max(0,delay-1);this.telegraphs.set(group({id:cast.owner,sourceId:cast.owner,castId:cast.id,vfxKey:'boss/'+cast.skill}),{started:cast.started,ends});this.warning('cast:'+cast.id,target,radius||3,cast.started,ends,p);}
   const g=this.pool.graphics('boss:'+cast.id,center.y+1)!;
   if(p.family==='beam'){
    const geometry=chapterBossSkills.ancient_dragon_king,points=beamFootprint(cast.position,cast.target,geometry.halfWidth,geometry.reach);
    if(charging&&!cast.interrupted){this.warningCount++;enemyBeamWarning(g,points,this.now,cast.started,cast.ends,this.reduced());const mouth=this.point(cast.owner,'muzzle',center);ring(g,mouth,18+progress*22,14+progress*16,p,.75,age*.07);sigil(g,mouth,p,18+progress*18,age*.08,.7);}
    else if(!cast.interrupted&&post<22){const alpha=(1-post/22)**1.6;polygon(g,points,0xc17131,alpha*.65);const from=this.point(cast.owner,'muzzle',center),length=Math.hypot(cast.target.x-cast.position.x,cast.target.y-cast.position.y)||1,to=projectFx({x:cast.position.x+(cast.target.x-cast.position.x)/length*geometry.reach,y:cast.position.y+(cast.target.y-cast.position.y)/length*geometry.reach});ribbon(g,[from,to],44*(1-post/30),p,alpha);this.burstParticles(g,from,p,post/22,cast.id,14);}
   }else if(p.family==='summon'){
    const alpha=cast.interrupted?clamp((cast.expires-this.now)/20):charging?.55+progress*.35:clamp(1-post/24);ring(g,center,96,54,p,alpha,age*.02);sigil(g,center,p,78,age*.018,alpha);
    for(let i=0;i<6;i++){const a=i*Math.PI/3+age*.009,point={x:center.x+Math.cos(a)*76,y:center.y+Math.sin(a)*42};ring(g,point,12+progress*6,7+progress*3,p,alpha);}
    if(cast.interrupted||!charging)this.burstParticles(g,center,p,cast.interrupted?clamp(1-(cast.expires-this.now)/20):post/24,cast.id,16);
   }else if(charging&&p.family==='mark'){sigil(g,{x:target.x,y:target.y-55},p,30,age*.05,.9);}else if(charging){/* The cast sheet already contains its authored local charge layer. */}
   else if(!cast.interrupted&&post<16&&p.family==='burst'){ring(g,target,groundSize(radius||3).width/2,groundSize(radius||3).height/2,p,1-post/16);this.burstParticles(g,target,p,post/16,cast.id,14);}
   else if(p.family==='mark'&&charging){sigil(g,target,p,30,age*.05,.9);}
  }
 }
 private drawHitSparks(){
  this.hitSparks=this.hitSparks.filter(s=>this.now-s.event.tick<HIT_SPARK_TICKS).slice(-96);
  for(const s of this.hitSparks){const age=Math.max(0,this.now-s.event.tick),t=age/HIT_SPARK_TICKS,e=s.event,p=vfxProfile(e.vfxKey??'system/damage')??vfxProfile('system/damage'),c=vfxPalettes[p.element];s.point??=this.point(e.id,'chest',projectFx(e.position));const point=s.point;if(!this.pool.visible(point.x,point.y,40))continue;const g=this.pool.graphics('hit-sparks:'+s.id,point.y+5,false);if(!g)continue;
   const heavy=!!e.crit||p.power===3,count=heavy?8:5,theta=Math.atan2(s.direction.y,s.direction.x);
   // Contact flare: a short four-point star at the contact point for the first two ticks.
   if(age<2){const k=1-age/2,r=(heavy?24:15)*(.7+.3*k),n=r*.18;g.fillStyle(c.light,.9*k);g.fillTriangle(point.x-r,point.y,point.x,point.y-n,point.x,point.y+n);g.fillTriangle(point.x+r,point.y,point.x,point.y-n,point.x,point.y+n);g.fillTriangle(point.x,point.y-r*.7,point.x-n,point.y,point.x+n,point.y);g.fillTriangle(point.x,point.y+r*.7,point.x-n,point.y,point.x+n,point.y);g.fillStyle(0xffffff,.85*k).fillCircle(point.x,point.y,n*1.4);}
   // Streaks fly away from the attacker inside a 100-degree cone.
   for(let i=0;i<count&&this.particles<vfxBudgets.particles;i++){this.particles++;const seed=combatHash(e.tick,e.id,i),angle=theta+((i+.5)/count-.5)*Math.PI*100/180,length=(heavy?12:9)+9*seed,r=this.reduced()?0:age*(3+2*seed),dx=Math.cos(angle),dy=Math.sin(angle),a={x:point.x+dx*r,y:point.y+dy*r},b={x:a.x+dx*length*(1-t*.5),y:a.y+dy*length*(1-t*.5)};line(g,[a,b],3,c.main,.75*(1-t));line(g,[a,{x:a.x+dx*length*.55,y:a.y+dy*length*.55}],1.5,c.light,.9*(1-t));}
  }
 }
 private drawShield(w:World){
  if(w.hero.shield<=0&&this.shield.phase==='none'&&this.enemyShields.size===0)return;
  const foot=this.point('hero','feet',projectFx(w.hero.position)),chest=this.point('hero','chest',foot);this.heroShieldSpan=foot.y-chest.y>8?foot.y-chest.y:this.heroShieldSpan;
  this.drawShieldOf('','hero',this.shield,w.hero.shield,w.hero.position,this.shieldProfile,this.shieldAngle,1,true);
  for(const [id,t] of this.enemyShields){const e=w.enemies.find(n=>n.id===id);if(!e)continue;const f=this.point(id,'feet',projectFx(e.position)),c=this.point(id,'chest',f);this.drawShieldOf(id+':',id,t.fb,e.alive?e.shield??0:0,e.position,this.enemyShieldProfile,t.angle,Math.max(.8,Math.min(1.8,(f.y-c.y)/this.heroShieldSpan)),false);}
 }
 /** Enemy shields (护盾 affix) reuse the hero bubble: appear, hit ripple, break shards. */
 private consumeEnemyShields(w:World){
  const alive=new Set<string>();for(const e of w.enemies){const value=e.alive?e.shield??0:0;let t=this.enemyShields.get(e.id);if(!t&&value<=0)continue;alive.add(e.id);t??={fb:new ShieldFeedback(e.id),angle:0};this.enemyShields.set(e.id,t);
   const result=t.fb.consume(value,w.tick,w.events),source=actorPosition(w,t.fb.sourceId);if(source&&t.fb.sourceId){const a=projectFx(source),h=projectFx(e.position);t.angle=Math.atan2(a.y-h.y,a.x-h.x);}if(result.broke)this.sound('shield-break');}
  for(const [id,t] of this.enemyShields)if(!alive.has(id)||t.fb.phase==='none'&&!(w.enemies.find(e=>e.id===id)?.shield))this.enemyShields.delete(id);
 }
 private drawShieldOf(key:string,id:string,fb:ShieldFeedback,shield:number,position:{x:number;y:number},p:SkillVfxProfile,angle:number,k:number,crystals:boolean){
  const state=fb.visual(shield,this.now,this.reduced());if(!state.visible)return;
  const foot=this.point(id,'feet',projectFx(position)),chest=this.point(id,'chest',foot),c=vfxPalettes[p.element],rx=42*k*state.scale,ry=58*k*state.scale;
  const rear=this.pool.graphics(key+'shield-rear',foot.y-1)!,front=this.pool.graphics(key+'shield-front',foot.y+4)!;
  // Split the upper and lower ellipses around the actor's actual display depth.
  for(const [g,start,opacity] of [[rear,Math.PI,.6],[front,0,1]] as const){line(g,arcPoints(chest.x,chest.y,rx,ry,start,start+Math.PI,24),state.width,state.phase==='break'?c.light:c.main,state.alpha*opacity);
   if(p.element==='ice'){const hex=Array.from({length:4},(_,i)=>({x:chest.x+Math.cos(start+i*Math.PI/3)*52*k*state.scale,y:chest.y+Math.sin(start+i*Math.PI/3)*70*k*state.scale}));line(g,hex,4,c.main,state.alpha*opacity);line(g,hex,1.5,c.light,state.alpha*opacity);}
  }
  if(crystals&&p.element==='ice')for(const side of [-1,1])drawIceCrystal(front,{x:foot.x+side*48,y:foot.y+3},62,20,side*8,state.alpha*.8);
  if(state.phase!=='break')sigil(front,{x:chest.x+27*k*state.scale,y:chest.y},p,12*k*state.scale,this.reduced()?0:this.now*.01,state.alpha);
  if(state.ratio<.3&&shield>0)for(let i=0;i<3;i++){const a=.4+i*.95,x=chest.x+Math.cos(a)*rx,y=chest.y+Math.sin(a)*ry;line(front,[{x:x-3,y:y-7},{x:x+1,y:y-2},{x:x-2,y:y+2},{x:x+3,y:y+7}],1.5,c.light,.7*state.alpha/.62);}
  const appearAge=this.now-fb.appliedAt;if(appearAge>=0&&appearAge<10){const t=appearAge/10,halo=this.pool.graphics(key+'shield-appear-halo',foot.y-2)!;line(halo,arcPoints(chest.x,chest.y,(this.reduced()?42:42+28*t)*k,(this.reduced()?58:58+30*t)*k,0,Math.PI*2,40),4-3*t,c.light,.45*(1-t));}
  const hitAge=this.now-fb.hitAt;if(hitAge>=0&&hitAge<8){const g=Math.sin(angle)<0?rear:front;line(g,arcPoints(chest.x,chest.y,rx+2,ry+2,angle-.7,angle+.7,16),5,c.light,.9*(1-hitAge/8));if(hitAge<6){const t=hitAge/6,ripple=this.pool.graphics(key+'shield-hit-ripple',Math.sin(angle)<0?foot.y-1:foot.y+5)!;ripple.lineStyle(2,c.light,.65*(1-t)).strokeCircle(chest.x+Math.cos(angle)*rx,chest.y+Math.sin(angle)*ry,this.reduced()?4:4+18*t);}}
  if(state.phase==='break'){
   const age=state.age,t=age/16;
   for(let i=0;i<14&&this.particles<vfxBudgets.particles;i++){this.particles++;const a=i*Math.PI*2/14,seed=combatHash(fb.breakTick,'shield',i),speed=2.5+1.5*seed,travel=this.reduced()?0:speed*age,x=chest.x+Math.cos(a)*(42*k+travel),y=chest.y+Math.sin(a)*(58*k+travel)+(this.reduced()?0:.125*age*age),g=this.pool.graphics(key+'shield-fragment:'+i,Math.sin(a)<0?foot.y-1:foot.y+5,false);if(!g)continue;const size=6+6*seed,rotation=a+(this.reduced()?0:age*(seed-.5)*.3),points=Array.from({length:3},(_,k)=>({x:x+Math.cos(rotation+k*Math.PI*2/3)*size*.58,y:y+Math.sin(rotation+k*Math.PI*2/3)*size*.58}));polygon(g,points,c.main,.72*(1-t));line(g,points,1.5,c.light,.7*(1-t),true);}
  }else if(state.phase==='expire'){
   const t=state.age/12;for(let i=0;i<6;i++){const a=i*Math.PI*2/6,g=Math.sin(a)<0?rear:front;g.fillStyle(c.light,.6*(1-t)).fillCircle(chest.x+Math.cos(a)*rx,chest.y+Math.sin(a)*ry-(this.reduced()?0:18*t),2);}
  }
  if(state.phase!=='break')this.sprite(key+'shield-source','shield',this.now/30,chest,foot,vfxPresence(p).size*state.scale,state.alpha*.6,{loop:true,depth:foot.y-1,tint:c.light}); // additive glow, not a filled box
 }
 cameraOffset(){return this.shake.offset(this.now,this.reduced());}
 diagnostics(){return {statusMarkers:this.statusMarkerCount,version:'vfx-v3-enemy',texture:source.texture.key,totalCreated:this.pool.created,cancelReason:this.world&&this.world.hero.hp<=0?'hero-dead':null,beams:this.flashes.flatMap(f=>(f.segments??[]).map((segment,i)=>({key:f.id+':'+i,...segment}))),shield:{phase:this.shield.phase,max:this.shield.max,hitAt:this.shield.hitAt,angle:this.shieldAngle},shake:{tier:this.shake.tier,at:this.shake.at},ready:this.scene.textures.exists(source.texture.key),errors:[...this.errors],consumeTick:this.consumedTick,totalConsumed:this.totalConsumed,clock:this.now,flashes:this.flashes.length,projectiles:this.flights.size,flights:[...this.flights].map(([id,f])=>({id,emitter:f.emitter,launch:f.launch,offset:f.from,frame:f.frame,born:f.born})),telegraphs:this.telegraphs.size,pool:this.pool.stats(),warningCount:this.warningCount,beamSegments:this.beamSegments,particles:this.particles,recentProfiles:[...this.recent],images:this.pool.images(),showcase:this.physicalVfx?.showcase.stats()};}
}
