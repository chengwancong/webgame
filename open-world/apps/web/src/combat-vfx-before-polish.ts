import Phaser from 'phaser';
import type {World,CombatEvent,Zone,Projectile} from '../../../packages/simulation/index.ts';
import {getBossDefinition,chapterBossSkills,monsterSkills} from '../../../packages/content/chapter-combat.ts';
import type {RenderPose,SocketName} from './effect-attachments.ts';
import sourceManifest from '../../../packages/asset-manifest/skill-fx.json';
import expandedManifest from '../../../packages/asset-manifest/vfx-v2.json';
import {projectFx,projectileLayout,sourceFrame,type FxClip,type FxPoint} from './skill-fx-layout.ts';
import {vfxProfile,vfxPalettes,vfxBudgets,type SkillVfxProfile} from './vfx-profiles.ts';
import {groundSize,beamFootprint,arcPoints,seededNoise} from './vfx-geometry.ts';
import {line,polygon,ribbon,lightning,ring,sparks,sigil} from './vfx-drawing.ts';
import {VfxPool} from './vfx-pool.ts';
import {enemyFlightStyles,enemyPresentation,castVfxGroup} from './enemy-vfx-style.ts';
import {enemyCircleWarning,enemyBeamWarning,taperedEnemyTrail,enemyFlightBody} from './enemy-vfx-drawing-before-polish.ts';
import {blizzardSnow} from './blizzard-vfx.ts';
const source=sourceManifest as unknown as {texture:{key:string;image:string;atlas:string};clips:Record<string,FxClip>};
type Extra={key:string;image:string;atlas:string;count:number;fps:number;origin:number[];cell:number;visibleHeight:number;kind:string};
export const extraClips=expandedManifest.clips as Record<string,Extra>;
type Flash={id:number;event:CombatEvent;profile:SkillVfxProfile;stage:'windup'|'release'|'impact'|'surface';life:number;point?:FxPoint;ground?:FxPoint;segments?:{from:FxPoint;to:FxPoint;depth:number}[]};
type Flight={from:FxPoint;to:FxPoint;born:number;tick:number;points:FxPoint[]};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const group=castVfxGroup;
export function preloadSkillEffects(scene:Phaser.Scene){scene.load.atlas(source.texture.key,source.texture.image,source.texture.atlas);for(const clip of Object.values(extraClips))scene.load.atlas(clip.key,clip.image,clip.atlas);}

/** Presentation-only: consumes simulation clocks, identifiers and collision results. */
export class SkillEffects{
 private pool:VfxPool;private flashes:Flash[]=[];private flights=new Map<number,Flight>();private zones=new Map<number,{started:number;delay:number}>();private errors=new Set<string>();private world?:World;private consumedTick=-1;private now=0;private serial=0;private totalConsumed=0;private shakeAt=-100;private shakePower=0;private shieldBefore=0;private shieldBreak=-100;private shieldProfile=vfxProfile('player/ward');private shieldHit=-100;private warningCount=0;private beamSegments=0;private recent=new Set<string>();private particles=0;
 private telegraphs=new Map<string,{started:number;ends:number}>();
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean,private attachment:(id:string,name:SocketName)=>FxPoint|undefined,private heroPose:()=>RenderPose&{skill:string}|undefined){this.pool=new VfxPool(scene,vfxBudgets.decorativeImages);}
 reset(){this.pool.clear();this.flashes=[];this.flights.clear();this.zones.clear();this.telegraphs.clear();this.world=undefined;this.consumedTick=-1;this.now=0;this.shakeAt=-100;this.shieldBefore=0;this.shieldBreak=-100;this.shieldHit=-100;this.errors.clear();this.recent.clear();}
 destroy(){this.reset();this.pool.destroy();}
 private profile(key:string){const p=vfxProfile(key);if(!p&&!this.errors.has(key)){this.errors.add(key);console.error('[vfx] Unregistered presentation:',key);}return p;}
 consume(w:World){
  if(this.world===w&&this.consumedTick===w.tick)return;if(this.world&&this.world!==w)this.reset();this.world=w;this.consumedTick=w.tick;
  for(const event of w.events){this.totalConsumed++;if(event.type==='hit_resolved'&&event.id==='hero'&&this.shieldBefore>w.hero.shield)this.shieldHit=event.tick;
   const impact=event.type==='hit_resolved'&&(event.amount??0)>0,cast=event.type==='cast_started'||event.type==='cast_released';const surface=event.type==='effect_activated';if(!impact&&!cast&&!surface)continue;
   const key=event.vfxKey??(!impact&&event.skill&&event.id==='hero'?'player/'+event.skill:'system/damage'),raw=this.profile(key);if(!raw)continue;const p=enemyPresentation(raw,w.enemies.find(n=>n.id===(event.sourceId??event.id)));
   const monster=monsterSkills[event.skill??''];if(event.type==='cast_started'&&key.startsWith('monster/')&&monster?.kind==='zone')this.telegraphs.set(group(event),{started:event.tick,ends:event.tick+(event.windup??monster.windup)+(monster.delay||25)-1});
   const stage=surface?'surface':impact?'impact':event.type==='cast_started'?'windup':'release';
   if(stage==='release')this.flashes=this.flashes.filter(f=>!(f.stage==='windup'&&group(f.event)===group(event)));
   this.flashes.push({id:++this.serial,event,profile:p,stage,life:stage==='windup'?Math.max(1,event.windup??1):stage==='impact'?p.impactTicks:p.releaseTicks});this.recent.add(key);
   if(impact&&event.id==='hero'&&this.shieldBefore>0)this.shieldHit=event.tick;
   if(stage==='release'&&p.family==='shield'&&event.id==='hero')this.shieldProfile=p;
   if(impact&&p.power===3&&event.tick-this.shakeAt>8){this.shakeAt=event.tick;this.shakePower=event.vfxKey?.startsWith('boss/')?3:1.5;}
  }
 }
 private point(id:string,name:SocketName,fallback:FxPoint){return this.attachment(id,name)??fallback;}
 private sprite(key:string,clipId:string,seconds:number,point:FxPoint,ground:FxPoint,size:number,alpha:number,options:{loop?:boolean;rotation?:number;facing?:number;depth?:number;decor?:boolean;normal?:boolean;origin?:[number,number]}={}){
  if(!this.pool.visible(point.x,point.y,size))return;
  const extra=extraClips[clipId],clip=source.clips[clipId];if(!extra&&!clip){this.errors.add('clip:'+clipId);return;}
  const frame=extra?String(this.reduced()?0:Math.min(extra.count-1,Math.floor(seconds*extra.fps)%(options.loop?extra.count:100000))):sourceFrame(clip,seconds,this.reduced(),options.loop);
  if(frame===undefined)return;const texture=extra?.key??source.texture.key;
  if(!this.scene.textures.exists(texture)||!this.scene.textures.get(texture).has(frame)){this.errors.add('frame:'+clipId+'/'+frame);return;}
  const image=this.pool.image(key,texture,frame,!options.decor);if(!image)return;
  const origin=options.origin??extra?.origin??clip.origin,scale=size/Math.max(image.frame.realWidth,image.frame.realHeight);
  image.setOrigin(origin[0],origin[1]).setPosition(point.x,point.y).setScale(scale).setAlpha(clamp(alpha)).setDepth(options.depth??ground.y+3);
  // Normal color-bearing bodies are legible over bright snow and grass; additive only on the source glow layer.
  if(!extra&&clip.blend==='add'&&!options.normal)image.setBlendMode(Phaser.BlendModes.ADD);
  if(options.rotation!==undefined)image.setRotation(options.rotation);else image.setFlipX(options.facing===-1);
 }
 private burstParticles(g:Phaser.GameObjects.Graphics,point:FxPoint,p:SkillVfxProfile,t:number,seed:number,count=8){const actual=Math.min(this.reduced()?2:count,Math.max(0,vfxBudgets.particles-this.particles));this.particles+=actual;sparks(g,point,p,t,seed,actual);}
 draw(w:World,fraction:number){
  if(this.world!==w){this.reset();this.world=w;}if(w.hero.hp<=0){this.pool.clear();this.flashes=[];this.flights.clear();this.telegraphs.clear();this.zones.clear();this.shakeAt=-100;return;}
  if(!w.paused||w.tick>Math.floor(this.now))this.now=w.tick+(w.paused?0:clamp(fraction));this.pool.begin();this.warningCount=0;this.beamSegments=0;this.particles=0;
  this.flashes=this.flashes.filter(f=>this.now-f.event.tick<f.life);
  for(const [key,t]of this.telegraphs)if(w.tick>t.ends+20)this.telegraphs.delete(key);
  for(const f of this.flashes)this.drawFlash(w,f);
  const activeFlights=new Set(w.projectiles.map(p=>p.id));for(const id of this.flights.keys())if(!activeFlights.has(id))this.flights.delete(id);
  for(const p of w.projectiles)this.drawProjectile(w,p);
  const activeZones=new Set(w.zones.map(z=>z.id));for(const id of this.zones.keys())if(!activeZones.has(id))this.zones.delete(id);
  for(const z of w.zones)this.drawZone(w,z);
  this.drawBosses(w);this.drawShield(w);this.pool.end();
 }
 private drawFlash(w:World,f:Flash){
  const e=f.event,p=f.profile,c=vfxPalettes[p.element],age=Math.max(0,this.now-e.tick),t=clamp(age/f.life),alpha=(1-t)**1.25,key='event:'+f.id,owner=e.sourceId??(f.stage==='impact'?e.id:e.id),ground=projectFx(e.position),facing=owner==='hero'?w.hero.facing:w.enemies.find(n=>n.id===owner)?.facing??1;
  if(f.stage==='windup'){
   if(owner!=='hero'&&!w.enemies.some(n=>n.id===owner&&n.alive))return;
   const telegraph=this.telegraphs.get(group(e));if(telegraph&&e.target)this.warning('cast:'+group(e),projectFx(e.target),monsterSkills[e.skill!].radius??2,telegraph.started,telegraph.ends,p);
   const foot=this.point(owner,'feet',ground),point=this.point(owner,p.anchor,foot),g=this.pool.graphics(key,foot.y+3,false);if(!g)return;
   const r=(7+p.power*3)*(0.5+t*.5);ring(g,point,r,r*.65,p,.65,t);if(!this.reduced())for(let i=0;i<3;i++){const a=i*Math.PI*2/3+this.now*.12,d=24*(1-t)+r;line(g,[{x:point.x+Math.cos(a)*d,y:point.y+Math.sin(a)*d*.7},point],1,c.main,.35);}
   return;
  }
  if(f.stage==='impact'){
   const targetFeet=this.point(e.id,'feet',ground),chest=this.point(e.id,'chest',ground);
   f.ground??={...targetFeet};f.point??=e.contact?{x:projectFx(e.contact).x+chest.x-targetFeet.x,y:projectFx(e.contact).y+chest.y-targetFeet.y}:{...chest};
   if(!this.pool.visible(f.point.x,f.point.y,100))return;const g=this.pool.graphics(key,f.ground.y+5)!;
   const r=(9+p.power*5)*(1+t*.9);g.fillStyle(c.dark,alpha*.5).fillCircle(f.point.x,f.point.y,r*.55);if(t<.35)g.fillStyle(c.light,(1-t/.35)*.8).fillEllipse(f.point.x,f.point.y,8+p.power*5,18+p.power*6);
   this.burstParticles(g,f.point,p,t,f.id*31,5+p.power*3);
   if(e.vfxKey?.startsWith('monster/')||e.vfxKey?.startsWith('boss/')){
    if(p.element==='ice'||p.element==='earth')for(let i=0;i<5;i++){const a=i*2.3999+f.id,r=8+t*32,point={x:f.point.x+Math.cos(a)*r,y:f.point.y+Math.sin(a)*r*.65+t*t*8};polygon(g,[{x:point.x,y:point.y-7*(1-t)},{x:point.x+4*(1-t),y:point.y+3*(1-t)},{x:point.x-3*(1-t),y:point.y+2*(1-t)}],c.main,alpha);}
    else if(p.element==='shadow')ring(g,f.point,12+t*25,9+t*18,p,alpha);
   }
   this.sprite(key+':source','impact',age/30*1.6,f.point,f.ground,48+p.power*12,alpha,{depth:f.ground.y+4});return;
  }
  f.ground??={...ground};f.point??={...this.point(owner,p.anchor,ground)};
  if(f.stage==='release'&&e.vfxKey?.startsWith('monster/')&&monsterSkills[e.skill??'']?.kind==='zone'){const g=this.pool.graphics(key,f.ground.y+3,false);if(g)sigil(g,f.point,p,20,t,alpha*.5);return;}
  if(p.family==='projectile'){
   const g=this.pool.graphics(key,f.ground.y+4,false);if(g){ring(g,f.point,14*(1+t),9*(1+t),p,alpha);this.burstParticles(g,f.point,p,t,f.id,4);}return;
  }
  if(p.family==='chain'){
   if(!f.segments){let from=this.point(owner,'muzzle',ground);f.segments=this.flashes.filter(h=>h.stage==='impact'&&group(h.event)===group(e)&&h.event.tick===e.tick).map(h=>{const to=this.point(h.event.id,'chest',projectFx(h.event.position)),segment={from:{...from},to:{...to},depth:this.point(h.event.id,'feet',projectFx(h.event.position)).y+5};from=to;return segment;});}
   for(const [i,segment]of f.segments.entries()){const g=this.pool.graphics(key+':'+i,segment.depth)!;if(p.motif==='tracer')ribbon(g,[segment.from,segment.to],3,p,alpha);else lightning(g,segment.from,segment.to,p,age,f.id+i*31,alpha);this.beamSegments++;}return;
  }
  if(p.family==='slash'){
   const foot=this.point(owner,'feet',f.ground),point=age<8?this.point(owner,'weapon',f.point):f.point,g=this.pool.graphics(key,foot.y+4)!;
   const direction=facing<0?Math.PI:0,start=direction-1.4,end=direction+.9,rx=p.size*.62,ry=p.size*.32;
   ribbon(g,arcPoints(point.x,point.y,rx,ry,start+(end-start)*t*.65,end+(end-start)*t*.15),Math.max(2,(1-t)*(5+p.power*2)),p,alpha);
   if(p.motif.includes('cross'))ribbon(g,arcPoints(point.x,point.y,rx*.8,ry*.8,direction+.8,direction-1.1),4,p,alpha*.65);
   this.sprite(key+':slash','slash',.3+age/30*.8,point,foot,p.size,alpha*.6,{facing});return;
  }
  if(p.family==='dash'){
   const from=projectFx(e.origin??e.position),to=ground,g=this.pool.graphics(key,ground.y+1)!;ribbon(g,[from,to],(p.motif==='split'?14:8)*(1-t)+1,p,alpha*.6);ring(g,to,24*(1+t),13*(1+t),p,alpha);
   this.burstParticles(g,to,p,t,f.id,8);return;
  }
  if(p.family==='heal'||p.family==='shield'){
   const foot=this.point(owner,'feet',ground),chest=this.point(owner,'chest',foot),g=this.pool.graphics(key,foot.y+2)!;
   ring(g,foot,p.size*.5*(.8+t*.2),p.size*.26,p,alpha);sigil(g,foot,p,p.size*.32,age*.1,alpha*.7);
   if(p.family==='heal')for(let i=0;i<(this.reduced()?2:7);i++){const phase=(t+i/7)%1,x=foot.x+Math.sin(i*2.4+phase*2)*p.size*.35,y=foot.y-phase*p.size;g.fillStyle(i%2?c.main:c.light,(1-phase)*alpha).fillEllipse(x,y,5,9);}
   this.sprite(key+':body',p.clip,age/30,p.family==='heal'?foot:chest,foot,p.size,alpha*.7,{decor:true});return;
  }
  const center=p.family==='zone'?projectFx(e.target??e.position):ground,radius=e.radius??1,d=groundSize(Math.max(.4,radius)),g=this.pool.graphics(key,center.y+1)!;
  const expansion=p.family==='spin'?1:Math.min(1,.8+t*.3);ring(g,center,d.width*.5*expansion,d.height*.5*expansion,p,alpha);
  if(p.family==='spin'){
   const turn=(this.reduced()?0:t*Math.PI*1.5)+p.variant;for(let i=0;i<(p.motif==='blades'?4:2);i++)ribbon(g,arcPoints(center.x,center.y,d.width*.45,d.height*.45,turn+i*Math.PI,turn+i*Math.PI+2.5),8*(1-t)+2,p,alpha);
  }else if(p.element==='ice'){
   for(let i=0;i<8;i++){const a=i*Math.PI/4,x=center.x+Math.cos(a)*d.width*.36,y=center.y+Math.sin(a)*d.height*.36;polygon(g,[{x:x-7,y},{x:x-2,y:y-22*(1-t)},{x:x+8,y:y-6}],c.main,alpha);line(g,[{x,y},{x:x-2,y:y-19*(1-t)}],2,c.light,alpha);if(p.family==='burst')this.sprite(key+':ice:'+i,'ice-crystal',.45+age/30,{x,y},{x,y},76+p.power*6,alpha*.9,{normal:true,decor:true,depth:y+1});}
  }else if(p.element==='earth'){
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7,x=center.x+Math.cos(a)*d.width*.35,y=center.y+Math.sin(a)*d.height*.35;line(g,[center,{x:(center.x+x)/2+5,y:(center.y+y)/2},{x,y}],3,c.dark,alpha);}
  }else sigil(g,center,p,d.width*.32,t,alpha);
  this.burstParticles(g,center,p,t,f.id,9);
 }
 private drawProjectile(w:World,p:Projectile){
  const raw=this.profile(p.vfxKey??(p.enemy?'monster/'+(p.skill??'basic-ranged'):'player/'+(p.skill??'bolt')));if(!raw)return;const profile=enemyPresentation(raw,w.enemies.find(n=>n.id===(p.sourceId??p.owner))),style=p.enemy?enemyFlightStyles[profile.key]:undefined;
  const previous=p.previous??p.position,start=projectFx(p.origin??previous),owner=p.sourceId??p.owner??'hero';let flight=this.flights.get(p.id);
  if(!flight){const muzzle=this.point(owner,'muzzle',start),targetFeet=this.point(p.targetId??'hero','feet',projectFx(p.target??p.position)),target=this.point(p.targetId??'hero','chest',targetFeet);flight={from:{x:muzzle.x-start.x,y:muzzle.y-start.y},to:{x:target.x-targetFeet.x,y:target.y-targetFeet.y},born:w.tick,tick:-1,points:[]};this.flights.set(p.id,flight);}
  const layout=projectileLayout(previous,p.position,this.now-w.tick,p.origin,p.target,flight.from,flight.to),point=layout.position;
  if(flight.tick!==w.tick&&!w.paused){flight.points.push({...projectileLayout(previous,previous,0,p.origin,p.target,flight.from,flight.to).position});if(flight.points.length>(style?.trail??7))flight.points.shift();flight.tick=w.tick;}
  if(!this.pool.visible(point.x,point.y,profile.size+100))return;
  const end=projectFx(p.target??{x:p.position.x+p.direction.x,y:p.position.y+p.direction.y}),angle=Math.atan2(end.y+flight.to.y-start.y-flight.from.y,end.x+flight.to.x-start.x-flight.from.x),g=this.pool.graphics('flight:'+p.id,layout.ground.y+2,false);
  if(g){const points=[...flight.points,point];if(p.enemy)taperedEnemyTrail(g,points,style?.width??5,profile);else for(let i=1;i<points.length;i++)ribbon(g,[points[i-1],points[i]],Math.max(1,i/points.length*(profile.element==='fire'?7:3)),profile,i/points.length*.5);if(profile.element==='storm')lightning(g,{x:point.x-Math.cos(angle)*45,y:point.y-Math.sin(angle)*45},point,profile,this.now,p.id);}
  if(style&&style.body!=='source'){const head=this.pool.graphics('projectile-head:'+p.id,layout.depth)!,reduced=this.reduced()||this.particles+3>vfxBudgets.particles;if(!reduced)this.particles+=3;enemyFlightBody(head,point,angle,style,profile,this.now,reduced);}
  else this.sprite('projectile:'+p.id,profile.flight,(this.now-flight.born)/30,point,layout.ground,style?.length??profile.size,1,{loop:true,rotation:angle,depth:layout.depth,normal:p.enemy,origin:style?.tipAnchor});
 }
 private warning(key:string,position:FxPoint,radius:number,started:number,ends:number,profile:SkillVfxProfile){
  const d=groundSize(radius);if(!this.pool.visible(position.x,position.y,d.width))return;this.warningCount++;const g=this.pool.graphics('warning:'+key,position.y-1)!;
  enemyCircleWarning(g,position,radius,this.now,started,ends,profile,this.reduced());
 }
 private drawZone(w:World,z:Zone){
  const raw=this.profile(z.vfxKey??(z.enemy?'monster/basic-area':'player/'+(z.skill??'ember')));if(!raw)return;const p=enemyPresentation(raw,w.enemies.find(n=>n.id===z.sourceId));
  let state=this.zones.get(z.id);if(!state){state={started:z.started??w.tick,delay:Math.max(1,z.delay)};this.zones.set(z.id,state);}
  const center=projectFx(z.position),d=groundSize(z.radius);if(z.delay>0){const telegraph=this.telegraphs.get(group(z));if(z.enemy)this.warning('zone:'+z.id,center,z.radius,telegraph?.started??state.started,w.tick+z.delay,p);else{const g=this.pool.graphics('zone:'+z.id,center.y-1)!;ring(g,center,d.width/2,d.height/2,p,.5);}return;}
  if(!this.pool.visible(center.x,center.y,d.width))return;const age=(this.now-state.started)/30,alpha=Math.min(1,z.life/15),g=this.pool.graphics('zone:'+z.id,center.y-1)!;ring(g,center,d.width/2,d.height/2,p,alpha*.6,age*.3);if(p.motif!=='blizzard')sigil(g,center,p,d.width*.27,age,alpha*.3);
  if(p.motif==='blizzard'){this.drawBlizzard(z,p,age,alpha,g);return;}
  const count=this.reduced()?3:p.power===3?11:8;
  for(let i=0;i<count;i++){const phase=seededNoise(z.id+i*37),a=i*2.39996+age*(p.motif==='spiral'?.22:0),r=Math.sqrt((i+.4)/count)*z.radius*.78,point=projectFx({x:z.position.x+Math.cos(a)*r,y:z.position.y+Math.sin(a)*r});
   const clip=p.element==='fire'?'ground-flame':p.element==='ice'?'ice-crystal':p.element==='nature'?'nature-aura-05':'arcane-projectile';
   this.sprite(`zone:${z.id}:${i}`,clip,age+phase*1.7,point,point,(p.element==='fire'?86:48)*(0.8+phase*.5),alpha*.8,{loop:true,decor:true,depth:point.y+1,normal:true});
  }
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
 private drawShield(w:World){
  if(this.shieldBefore>0&&w.hero.shield<=0)this.shieldBreak=w.tick;this.shieldBefore=w.hero.shield;
  if(w.hero.shield<=0&&this.now-this.shieldBreak>10)return;const foot=this.point('hero','feet',projectFx(w.hero.position)),chest=this.point('hero','chest',foot),p=this.shieldProfile,c=vfxPalettes[p.element],alpha=w.hero.shield>0?.62:clamp(1-(this.now-this.shieldBreak)/10)*.6;
  const g=this.pool.graphics('shield-frame',foot.y+4)!;line(g,arcPoints(chest.x,chest.y,42,58,0,Math.PI*2,32),2,c.main,alpha);if(this.now-this.shieldHit<5)line(g,arcPoints(chest.x,chest.y,44,60,-1.3,1.3),4,c.light,alpha);sigil(g,{x:chest.x+27,y:chest.y},p,12,this.now*.01,alpha);
  this.sprite('shield-source','shield',this.now/30,chest,foot,p.size,alpha*.22,{loop:true,decor:true});
 }
 cameraOffset(){if(this.reduced()||this.now-this.shakeAt>6)return {x:0,y:0};const t=(this.now-this.shakeAt)/6,p=this.shakePower*(1-t);return {x:Math.sin(t*28)*p,y:Math.cos(t*23)*p*.6};}
 diagnostics(){return {version:'vfx-v3-enemy',ready:this.scene.textures.exists(source.texture.key),errors:[...this.errors],consumeTick:this.consumedTick,totalConsumed:this.totalConsumed,clock:this.now,flashes:this.flashes.length,projectiles:this.flights.size,telegraphs:this.telegraphs.size,pool:this.pool.stats(),warningCount:this.warningCount,beamSegments:this.beamSegments,particles:this.particles,recentProfiles:[...this.recent],images:this.pool.images()};}
}
