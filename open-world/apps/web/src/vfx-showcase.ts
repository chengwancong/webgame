import Phaser from 'phaser';
import type {CombatEvent,World,Projectile} from '../../../packages/simulation/index.ts';
import type {VfxPool} from './vfx-pool.ts';
import manifest from '../../../packages/asset-manifest/combat-physical-fx.json';
import {project} from './iso.ts';
import {groundSize,seededNoise} from './vfx-geometry.ts';
import {vfxPalettes} from './vfx-profiles.ts';
type Point={x:number;y:number};
type Clip={key:string;frames:(string|number)[];peak:string|number;visibleSize:number[]};
type Stage='windup'|'release'|'impact';
type Instance={id:number;stage:Stage;skill:string;event:CombatEvent;owner:string;tick:number;life:number;lite:boolean;weapon?:Point;feet?:Point;chest?:Point;target?:Point;from?:Point};
/**
 * Sample skills for the physical VFX rework (cut, cleave, ground_slam, bolt).
 * Presentation only: reads real cast/hit events and projectile positions, owns its own
 * lifetimes so authored library sequences play in full instead of a two-frame peak.
 */
export const showcaseSkills=['cut','cleave','ground_slam','bolt'] as const;
export const isShowcaseKey=(key?:string)=>!!key&&key.startsWith('player/')&&(showcaseSkills as readonly string[]).includes(key.slice(7));
const clips=manifest.clips as unknown as Record<string,Clip>;
const GROUND_DEPTH=-7500;
const tex={glow:'showcase-glow',ring:'showcase-ring',trail:'showcase-trail',spark:'showcase-spark'};
/** Ticks each stage stays alive; independent from the profile's flash lifetime. */
const lifetimes:Record<string,{release:number;impact:number}>={cut:{release:16,impact:12},cleave:{release:34,impact:14},ground_slam:{release:42,impact:14},bolt:{release:9,impact:12}};
const steel=vfxPalettes.steel,earth=vfxPalettes.earth,ember=vfxPalettes.fire;
const DUST=0xeadcb8;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const easeOut=(t:number)=>1-(1-clamp(t))**3;
const FULL_IMPACTS=3;
export class ShowcaseVfx{
 private items:Instance[]=[];private serial=0;private stones=0;
 constructor(private scene:Phaser.Scene,private pool:VfxPool,private reduced:()=>boolean,private attachment:(id:string,name:'weapon'|'feet'|'chest'|'muzzle')=>Point|undefined){this.textures();}
 private textures(){
  const make=(key:string,w:number,h:number,paint:(c:CanvasRenderingContext2D)=>void)=>{if(this.scene.textures.exists(key))return;const t=this.scene.textures.createCanvas(key,w,h);if(!t)return;paint(t.context);t.refresh();};
  make(tex.glow,128,128,c=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.22,'rgba(255,255,255,.75)');g.addColorStop(.55,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});
  make(tex.ring,256,256,c=>{const g=c.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.58,'rgba(255,255,255,0)');g.addColorStop(.78,'rgba(255,255,255,.28)');g.addColorStop(.9,'rgba(255,255,255,1)');g.addColorStop(.97,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,256,256);});
  make(tex.trail,128,32,c=>{const g=c.createLinearGradient(0,0,128,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.6,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,1)');c.fillStyle=g;c.shadowColor='rgba(255,255,255,.9)';c.shadowBlur=6;c.beginPath();c.moveTo(0,16);c.lineTo(122,7);c.quadraticCurveTo(128,16,122,25);c.closePath();c.fill();});
  make(tex.spark,32,8,c=>{const g=c.createLinearGradient(0,0,32,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.7,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,.6)');c.fillStyle=g;c.beginPath();c.moveTo(0,4);c.lineTo(24,1);c.lineTo(32,4);c.lineTo(24,7);c.closePath();c.fill();});
 }
 consume(w:World){
  const hits=new Map<string,number>();
  for(const e of w.events){
   const key=e.vfxKey??(e.id==='hero'&&e.skill?'player/'+e.skill:undefined);if(!isShowcaseKey(key))continue;const skill=key!.slice(7),owner=e.sourceId??e.id;
   if(e.type==='cast_started')this.items.push({id:++this.serial,stage:'windup',skill,event:e,owner,tick:e.tick,life:Math.max(1,e.windup??1),lite:false});
   else if(e.type==='cast_released'){this.items=this.items.filter(i=>!(i.stage==='windup'&&i.owner===owner&&i.skill===skill));this.items.push({id:++this.serial,stage:'release',skill,event:e,owner,tick:e.tick,life:lifetimes[skill].release,lite:false});}
   else if(e.type==='hit_resolved'&&(e.amount??0)>0&&e.id!=='hero'){const cast=(e.castId??owner)+'@'+e.tick,n=hits.get(cast)??0;hits.set(cast,n+1);this.items.push({id:++this.serial,stage:'impact',skill,event:e,owner,tick:e.tick,life:lifetimes[skill].impact,lite:n>=FULL_IMPACTS});}
  }
  if(this.items.length>96)this.items.splice(0,this.items.length-96);
 }
 /** Returns stones used, which count toward the shared particle budget. */
 draw(now:number,budget:number){
  this.stones=0;this.items=this.items.filter(i=>now-i.tick<i.life);
  for(const i of this.items){const age=Math.max(0,now-i.tick);this.capture(i);
   if(i.stage==='windup')this.windup(i,age);else if(i.stage==='impact')this.impact(i,age);
   else if(i.skill==='cut')this.cutRelease(i,age);else if(i.skill==='cleave')this.cleaveRelease(i,age,budget);else if(i.skill==='ground_slam')this.slamRelease(i,age,budget);else this.boltRelease(i,age);}
  return this.stones;
 }
 /** Release and impact layers stay where the blow landed even if the actor walks away. */
 private capture(i:Instance){
  if(i.stage==='windup'||i.feet)return;const ground=project(i.event.position);
  if(i.stage==='impact'){i.feet=this.attachment(i.event.id,'feet')??ground;i.chest=this.attachment(i.event.id,'chest')??{x:i.feet.x,y:i.feet.y-30};const source=this.attachment(i.owner,'feet')??(i.event.origin?project(i.event.origin):{x:i.feet.x-40,y:i.feet.y});i.from=source;return;}
  i.feet=this.attachment(i.owner,'feet')??ground;i.weapon=this.attachment(i.owner,i.skill==='bolt'?'muzzle':'weapon')??this.attachment(i.owner,'weapon')??{x:i.feet.x,y:i.feet.y-34};i.chest=this.attachment(i.owner,'chest')??{x:i.feet.x,y:i.feet.y-30};
  const t=i.event.target?project(i.event.target):undefined;i.target=t&&Math.hypot(t.x-ground.x,t.y-ground.y)>2?{x:i.feet.x+t.x-ground.x,y:i.feet.y+t.y-ground.y}:{x:i.feet.x+40,y:i.feet.y};
 }
 private clipImage(key:string,id:string,index:number,point:Point,width:number,alpha:number,depth:number,o:{rotation?:number;height?:number;add?:boolean;tint?:number;fill?:boolean;decor?:boolean}={}){
  const clip=clips[id];if(!clip||alpha<=.01||!this.pool.visible(point.x,point.y,width))return;const frame=clip.frames[Math.max(0,Math.min(clip.frames.length-1,Math.floor(index)))];
  const node=this.pool.image(key,clip.key,frame,!o.decor);if(!node)return;const sx=width/clip.visibleSize[0];
  node.setOrigin(.5).setPosition(point.x,point.y).setScale(sx,o.height===undefined?sx:o.height/clip.visibleSize[1]).setRotation(o.rotation??0).setAlpha(clamp(alpha)).setDepth(depth);
  if(o.add)node.setBlendMode(Phaser.BlendModes.ADD);if(o.tint!==undefined){node.setTint(o.tint);if(o.fill)node.setTintMode(Phaser.TintModes.FILL);}return node;
 }
 private soft(key:string,texture:string,point:Point,width:number,height:number,alpha:number,depth:number,tint:number,rotation=0,decor=false,normal=false){
  if(alpha<=.01||!this.pool.visible(point.x,point.y,Math.max(width,height)))return;const node=this.pool.image(key,texture,'__BASE',!decor);if(!node)return;
  node.setOrigin(.5).setPosition(point.x,point.y).setScale(width/node.frame.realWidth,height/node.frame.realHeight).setRotation(rotation).setAlpha(clamp(alpha)).setDepth(depth).setBlendMode(normal?Phaser.BlendModes.NORMAL:Phaser.BlendModes.ADD).setTint(tint);return node;
 }
 /** Four-point glint built from additive spark images (Graphics with ADD blend does not render in this Phaser build). */
 private star(key:string,point:Point,radius:number,rotation:number,color:number,alpha:number,depth:number){
  if(alpha<=.01)return;for(const [n,k,a]of [[0,1,0],[1,.7,Math.PI/2],[2,1,Math.PI],[3,.7,Math.PI*1.5]] as const){const r=radius*k,c=Math.cos(rotation+a),s=Math.sin(rotation+a);this.soft(key+':'+n,tex.spark,{x:point.x+c*r/2,y:point.y+s*r/2},r,Math.max(3,radius*.22),alpha,depth,color,rotation+a+Math.PI);}
  this.soft(key+':core',tex.glow,point,radius*.7,radius*.7,alpha,depth,0xffffff);
 }
 /** Sparks fly away from the attacker inside a cone; skipped under reduced motion. */
 private sparks(key:string,point:Point,direction:number,count:number,age:number,life:number,reach:number,color:number,depth:number,seed:number,cone=1.7){
  if(this.reduced()||age>=life)return;const t=age/life;
  for(let n=0;n<count;n++){const a=direction+(seededNoise(seed+n*7)-.5)*cone,speed=.55+seededNoise(seed+n*13)*.45,d=easeOut(t)*reach*speed,p={x:point.x+Math.cos(a)*d,y:point.y+Math.sin(a)*d*.8+t*t*10};this.soft(key+':'+n,tex.spark,p,18*(1-t*.5),4,(1-t)*.95,depth,color,a,true);}
 }
 private angle(i:Instance){return Math.atan2(i.target!.y-i.feet!.y,i.target!.x-i.feet!.x);}
 private windup(i:Instance,age:number){
  const key='showcase:'+i.id,feet=this.attachment(i.owner,'feet')??project(i.event.position),weapon=this.attachment(i.owner,i.skill==='bolt'?'muzzle':'weapon')??this.attachment(i.owner,'weapon')??{x:feet.x,y:feet.y-34},t=clamp(age/i.life),depth=feet.y+5;
  if(i.skill==='cut'){this.soft(key+':glint',tex.glow,weapon,16+t*14,16+t*14,.5+t*.4,depth,steel.light);this.star(key+':glint-star',weapon,8+t*8,age*.4,steel.light,.7*t,depth);return;}
  if(i.skill==='bolt'){this.soft(key+':muzzle',tex.glow,weapon,14+t*18,14+t*18,.45+t*.45,depth,steel.light);for(let n=0;n<3;n++){const a=n*2.1+age*.3,d=(1-t)*22;this.soft(key+':gather:'+n,tex.spark,{x:weapon.x+Math.cos(a)*d,y:weapon.y+Math.sin(a)*d},10,3,.8*t,depth,steel.light,a+Math.PI,true);}return;}
  const area=groundSize(i.event.radius??3);
  // Heavy charge: the library's own anticipation frames (sparks gathering into a core) play across the real windup.
  if(i.skill==='cleave'){this.soft(key+':charge-glow',tex.glow,weapon,24+t*50,24+t*50,.5+t*.45,feet.y+40,ember.light);this.clipImage(key+':charge','blade-crescent-heavy',t*19.99,weapon,130,1,feet.y+41,{add:true});}
  else{this.soft(key+':charge',tex.glow,weapon,18+t*26,18+t*26,.5+t*.4,feet.y+40,ember.light);if(t>.45)this.star(key+':apex',weapon,10+18*clamp((t-.45)/.3),age*.25,ember.light,.9*(1-clamp((t-.8)/.2)*.5),feet.y+41);}
  // The real hit radius contracts toward the caster, so the area reads before release.
  const ring=1-easeOut(t)*.65;this.soft(key+':area-base',tex.ring,feet,area.width*ring,area.height*ring,.25+t*.35,GROUND_DEPTH,DUST,0,false,true);this.soft(key+':area',tex.ring,feet,area.width*ring,area.height*ring,.2+t*.4,GROUND_DEPTH+.1,ember.main);
 }
 private cutRelease(i:Instance,age:number){
  const key='showcase:'+i.id,c=i.chest!,theta=this.angle(i),side=Math.cos(theta)>=0?1:-1,depth=Math.max(i.feet!.y,i.target!.y)+40;
  // Weapon trail: a tapered additive arc that sweeps across the facing in three ticks, then fades.
  const g=this.pool.graphics(key+':arc',depth);if(g){const r=64,start=theta-1.3*side,sweep=2.4*side,head=easeOut(age/2),fade=1-clamp((age-3)/5),tail=Math.max(0,head-.75)*clamp(age/2)+clamp((age-2)/6)*.25,steps=18;
   const at=(u:number,w:number)=>{const a=start+sweep*u,ox=Math.cos(a),oy=Math.sin(a)*.6;return {x:c.x+ox*(r+w),y:c.y+oy*(r+w)};};
   for(const [scale,color,alpha] of [[1.35,ember.main,.85],[1,ember.light,1],[.45,0xffffff,1]] as const)for(let n=0;n<steps;n++){const u0=tail+(head-tail)*n/steps,u1=tail+(head-tail)*(n+1)/steps,k0=n/steps,k1=(n+1)/steps,w0=(1+11*Math.sin(Math.PI*(.12+.8*k0)))*scale,w1=(1+11*Math.sin(Math.PI*(.12+.8*k1)))*scale,a=at(u0,w0),b=at(u1,w1),d=at(u1,-w1),e=at(u0,-w0);g.fillStyle(color,alpha*Math.min(1,k1*1.6)*fade);g.fillTriangle(a.x,a.y,b.x,b.y,d.x,d.y);g.fillTriangle(a.x,a.y,d.x,d.y,e.x,e.y);}}
 }
 private cleaveRelease(i:Instance,age:number,budget:number){
  const key='showcase:'+i.id,c=i.chest!,f=i.feet!,theta=this.angle(i),area=groundSize(i.event.radius??4);
  // Front crescent: library frames 21-38 (star flash, then the sweep thinning out), untinted and additive.
  this.clipImage(key+':crescent','blade-crescent-heavy',25+age,c,area.width*.82,age<12?1:1-(age-12)/3,f.y+8,{rotation:theta,add:true});
  if(age>=2)this.clipImage(key+':crescent-back','blade-crescent-heavy',25+age-2,c,area.width*.62,(age<14?.7:.7*(1-(age-14)/3)),f.y-4,{rotation:theta+Math.PI,add:true});
  if(age<2)this.soft(key+':flash',tex.glow,c,54,54,.8*(1-age/2),f.y+9,ember.light);
  this.groundBlast(key,i,age,area,4,.62,budget,6);
 }
 private slamRelease(i:Instance,age:number,budget:number){
  const key='showcase:'+i.id,f=i.feet!,area=groundSize(i.event.radius??4);
  // Landing: white-hot core, then the shock front travels out to the real radius.
  if(age<3)this.soft(key+':core',tex.glow,f,area.width*.55,area.height*.55,.85*(1-age/3),GROUND_DEPTH+2,ember.light);
  if(age<5)this.soft(key+':pillar',tex.glow,{x:f.x,y:f.y-40},34,120*(1-age/5),.85*(1-age/5),f.y+10,earth.light);
  this.groundBlast(key,i,age,area,6,.78,budget,10);
  if(age>=3&&age<14){const t=(age-3)/11;this.soft(key+':ring2',tex.ring,f,area.width*(.4+t*.8),area.height*(.4+t*.8),(1-t)*.6,GROUND_DEPTH+1,DUST,0,false,true);}
 }
 /** Shared earth blast: shock ring to the hit radius, radial glowing cracks, dust at the ring front, stones. */
 private groundBlast(key:string,i:Instance,age:number,area:{width:number;height:number},cracks:number,crackReach:number,budget:number,stones:number){
  const f=i.feet!,origin=i.event.position,radius=i.event.radius??4,base=Math.atan2((i.event.target?.y??origin.y+1)-origin.y,(i.event.target?.x??origin.x+1)-origin.x);
  if(age<9){const t=easeOut(age/8),w=area.width*(.25+t*.8),h=area.height*(.25+t*.8),a=1-clamp((age-2)/7);this.soft(key+':ring-base',tex.ring,f,w,h,.85*a,GROUND_DEPTH+1,DUST,0,false,true);this.soft(key+':ring',tex.ring,f,w*.98,h*.98,a,GROUND_DEPTH+1.1,ember.main);}
  if(i.skill==='ground_slam')this.clipImage(key+':crater','ground-crater',0,f,area.width*.42,.55*(1-clamp((age-30)/10)),GROUND_DEPTH-1,{height:area.height*.42,tint:0x725941});
  // ground-crack is an authored cooling sequence (yellow to dark red); playing it in full is the afterglow.
  for(let n=0;n<cracks;n++){const dir=base+n*Math.PI*2/cracks+(seededNoise(i.id+n)-.5)*.5,len=radius*(crackReach+.2)*(.8+seededNoise(i.id+n*5)*.3),end=project({x:origin.x+Math.cos(dir)*len,y:origin.y+Math.sin(dir)*len}),c=project(origin),e={x:f.x+end.x-c.x,y:f.y+end.y-c.y},grow=easeOut(age/4),mid={x:f.x+(e.x-f.x)*.5*grow,y:f.y+(e.y-f.y)*.5*grow},width=Math.hypot(e.x-f.x,e.y-f.y)*grow,rot=Math.atan2(e.y-f.y,e.x-f.x),fade=1-clamp((age-30)/8),frame=age*.75;
   this.clipImage(key+':crack:'+n,'ground-crack',frame,mid,Math.max(4,width),fade,GROUND_DEPTH,{rotation:rot,height:30});
   if(age<16)this.clipImage(key+':crack-glow:'+n,'ground-crack',frame,mid,Math.max(4,width),.8*(1-age/16),GROUND_DEPTH+.5,{rotation:rot,height:36,add:true});}
  for(let n=0;n<8;n++){const a=n*Math.PI/4+seededNoise(i.id+n*3)*.4,at=2+n%3,d=.62+seededNoise(i.id+n*11)*.25;if(age<at)continue;const p={x:f.x+Math.cos(a)*area.width*.5*d,y:f.y+Math.sin(a)*area.height*.5*d};const k=clamp((age-at)/16),grow=easeOut(k);for(let m=0;m<2;m++)this.soft(key+':dust:'+n+':'+m,tex.glow,{x:p.x+(m?12:-8)*grow,y:p.y-grow*(10+m*6)},40+grow*(46+m*12),24+grow*(28+m*8),.9*(1-k),p.y+m*.01,DUST,0,false,true);}
  if(this.reduced()||age>=18)return;const count=Math.min(stones,Math.max(0,budget-this.stones));this.stones+=count;
  for(let n=0;n<count;n++){const t=age/18,a=n*Math.PI*2/stones+seededNoise(i.id+n+17)*.4,r=.15+easeOut(t)*.5*(.7+seededNoise(n+3)*.5),h=Math.sin(t*Math.PI)*(18+seededNoise(i.id+n+4)*30),p={x:f.x+Math.cos(a)*area.width*.5*r,y:f.y+Math.sin(a)*area.height*.5*r-h};this.clipImage(key+':stone:'+n,'ground-rock',0,p,7+n%4,1-clamp((t-.7)/.3),f.y+3+n*.01,{height:9+n%4,rotation:a+t*4,tint:0x9e8566,fill:true,decor:true});}
 }
 private boltRelease(i:Instance,age:number){
  const key='showcase:'+i.id,m=i.weapon!,theta=Math.atan2(i.target!.y-m.y,i.target!.x-m.x),depth=i.feet!.y+6;
  if(age<4)this.soft(key+':flash',tex.glow,m,44*(1-age/6),44*(1-age/6),1-age/4,depth,steel.light);
  if(age<3)this.star(key+':flash-star',m,22*(1-age/4),theta,steel.light,1-age/3,depth);
  this.sparks(key+':spark',m,theta,4,age,7,30,steel.light,depth,i.id,.9);
 }
 private impact(i:Instance,age:number){
  const key='showcase:'+i.id,c=i.chest!,from=i.from!,dir=Math.atan2(c.y-from.y,c.x-from.x),heavy=i.skill==='cleave'||i.skill==='ground_slam',color=heavy?earth.light:steel.light,depth=i.feet!.y+8;
  if(i.lite){if(age<4)this.soft(key+':glow',tex.glow,c,40,40,.7*(1-age/4),depth,color);return;}
  if(age<5)this.soft(key+':glow',tex.glow,c,(heavy?48:40)*(1-age/10),(heavy?48:40)*(1-age/10),.8*(1-age/5),depth,heavy?ember.light:color);
  if(age<4)this.star(key+':star',c,(heavy?34:28)*(1-age/6),dir+Math.PI/4,heavy?ember.light:color,1-age/4,depth);
  // Cut: the library slash streak plays in full across the target, perpendicular to the blow.
  if(i.skill==='cut')this.clipImage(key+':slash','blade-streak',4+age,c,124,1,depth,{rotation:dir+Math.PI/2*(Math.cos(dir)>=0?-1:1)+.56,add:true});
  else if(i.skill==='bolt'){if(age<6){const t=easeOut(age/6);this.soft(key+':pop',tex.ring,c,20+t*44,14+t*30,1-age/6,depth,ember.light);}}
  else this.clipImage(key+':spikes','impact-heavy',6+age*.6,c,96,1-clamp((age-6)/4),depth,{add:true,tint:ember.light});
  this.sparks(key+':spark',c,dir,heavy?8:6,age,9,heavy?52:40,color,depth,i.id);
 }
 /** Bolt flight: untinted bright arrow with additive taper trail and head glow. */
 flight(key:string,p:Projectile,point:Point,angle:number,age:number,depth:number){
  if(!isShowcaseKey(p.vfxKey??'player/'+(p.skill??'')))return false;if(!this.pool.visible(point.x,point.y,140))return true;
  const c=Math.cos(angle),s=Math.sin(angle),trail=Math.min(130,24+age*55);
  this.soft(key+':trail',tex.trail,{x:point.x-c*trail/2,y:point.y-s*trail/2},trail,14,.95,depth-.1,ember.light,angle);
  this.soft(key+':glow',tex.glow,point,40,40,.85,depth+.1,ember.light);
  const g=this.pool.graphics(key+':arrow',depth);if(!g)return true;const tail={x:point.x-c*44,y:point.y-s*44},nx=-s,ny=c;
  g.lineStyle(5,steel.dark,.9).lineBetween(tail.x,tail.y,point.x-c*8,point.y-s*8);g.lineStyle(2.5,0xf3e3c0,1).lineBetween(tail.x,tail.y,point.x-c*8,point.y-s*8);
  g.fillStyle(steel.dark,1).fillTriangle(point.x+c*4,point.y+s*4,point.x-c*14+nx*7.5,point.y-s*14+ny*7.5,point.x-c*14-nx*7.5,point.y-s*14-ny*7.5);
  g.fillStyle(0xffffff,1).fillTriangle(point.x+c*1,point.y+s*1,point.x-c*11+nx*4.5,point.y-s*11+ny*4.5,point.x-c*11-nx*4.5,point.y-s*11-ny*4.5);
  for(const k of [1,-1])g.fillStyle(steel.light,.95).fillTriangle(tail.x+c*12,tail.y+s*12,tail.x-c*3+nx*8*k,tail.y-s*3+ny*8*k,tail.x+c*1,tail.y+s*1);
  return true;
 }
 stats(){return {instances:this.items.length,stones:this.stones};}
 reset(){this.items=[];this.stones=0;}
}
