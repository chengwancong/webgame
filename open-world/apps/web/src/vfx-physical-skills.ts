import type Phaser from 'phaser';
import type {CombatEvent,Projectile,Zone} from '../../../packages/simulation/index.ts';
import type {RenderPose} from './effect-attachments.ts';
import type {VfxPool} from './vfx-pool.ts';
import {physicalSpec,type PhysicalSpec} from './physical-vfx-spec.ts';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
import {groundSize} from './vfx-geometry.ts';
import {project} from './iso.ts';
type Point={x:number;y:number};
type Layer=(key:string,id:string,age:number,point:Point,ground:Point,width:number,height:number,alpha:number,rotation?:number,tint?:number,fill?:boolean,decor?:boolean)=>Phaser.GameObjects.Image|undefined;
type Ghost={texture:string;point:Point;image:NonNullable<RenderPose['image']>;tick:number};
type State={point:Point;feet:Point;target:Point;ghosts:Ghost[];sample:number;tick:number};
/** Place snapshots only on the segment that simulation actually travelled. */
/** `arc` lifts the snapshots on a parabola (pixels at mid-path) for leaps. */
export function dashGhostPositions(from:Point,to:Point,count:number,arc=0){const length=Math.min(3,Math.max(0,Math.floor(count)));return Array.from({length},(_,n)=>{const t=(n+1)/(length+1);return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t-arc*4*t*(1-t)};});}
export function physicalFlightStyle(spec:PhysicalSpec,skill:string,age:number,reduced:boolean){
 const knife=spec.weapon==='hidden',needle=skill==='venom_needle',long=skill==='pierce_arrow';
 return {width:(knife?44:80)*(needle?.6:long?1.6:1),height:(knife?22:20)*(needle?.6:1),turn:knife&&!reduced?age*.7:0,tint:spec.tint??(knife?0xf1eee5:0xe7d8ac)};
}
/** Authored layers consume real releases, flights, activations and contacts. */
export class PhysicalSkillLayers{
 private states=new Map<string,State>();private serial=0;
 constructor(private scene:Phaser.Scene,private pool:VfxPool,private reduced:()=>boolean,private layer:Layer,private pose:()=>RenderPose|undefined){}
 private ghost(state:State,age:number,limit:number,from:Point,to:Point,arc=0){
  if(this.reduced()||state.sample>=0||age>=7)return;const pose=this.pose(),image=pose?.image;if(!pose||!image)return;state.sample=Math.floor(age);
  const source=this.scene.textures.get(image.texture),frame=source.get(image.frame),pixels=source.getSourceImage() as HTMLImageElement;
  for(const point of dashGhostPositions(from,to,limit,arc)){const key='physical-ghost:'+(++this.serial),texture=this.scene.textures.createCanvas(key,frame.realWidth,frame.realHeight);if(!texture)continue;
   texture.context.drawImage(pixels,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,frame.x,frame.y,frame.cutWidth,frame.cutHeight);texture.refresh();state.ghosts.push({texture:key,point,image:{...image},tick:age});}
 }
 release(e:CombatEvent,p:SkillVfxProfile,stage:string,age:number,key:string,weapon:Point,feet:Point,target:Point){
  const spec=physicalSpec(p.key)!;if(stage!=='release'&&stage!=='surface')return false;
  const ground=project(e.position),tint=spec.tint??vfxPalettes[p.element].light;
  if(stage==='surface'&&spec.surface){if(spec.form==='rain')this.rain(key,ground,e.radius??1,age);else if(spec.overlay)this.layer(key+':explosion',spec.overlay,age,ground,ground,Math.max(140,groundSize(e.radius??1).width*.8),120,Math.max(0,1-age/12));return true;}
  // The launch clip is authored pointing up: lay it along the shot instead of squashing it upright.
  if(spec.form==='flight'){if(spec.weapon==='bow'&&age<4)this.layer(key+':launch','arrow-launch',age,weapon,feet,30,52,(1-age/4)*.8,Math.atan2(target.y-weapon.y,target.x-weapon.x)+Math.PI/2);return true;}
  if(spec.form==='rain'||spec.onHit)return true;
  let s=this.states.get(key);if(!s){s={point:{...weapon},feet:{...feet},target:{...target},ghosts:[],sample:-1,tick:e.tick};this.states.set(key,s);}
  const angle=Math.atan2(s.target.y-s.point.y,s.target.x-s.point.x),alpha=age<5?1:Math.max(0,1-(age-5)/4),width=e.radius?groundSize(e.radius).width*.95:p.size*1.2;
  // Power-up and roar (2026-10-16), library layers only: rage erupts as crimson flames around the feet (hit-fire-big),
  // the roar flashes at the chest (hit-holy). Both keep their own shading under a multiply tint; ground-ring then plays
  // its own expanding frames 21→24 (the peak±1 window used elsewhere is already the faded tail).
  if(spec.form==='aura'||spec.form==='cry'){
   const cry=spec.form==='cry';
   if(cry&&age<7)this.layer(key+':roar','hit-holy',age,{x:s.feet.x,y:s.feet.y-52},s.feet,96,84,1-age/7)?.setTint(tint);
   if(!cry&&age<14)this.layer(key+':rage','hit-fire-big',age,{x:s.feet.x,y:s.feet.y-58},s.feet,150,180,age<9?.92:.92*(14-age)/5)?.setTint(tint).setDepth(s.feet.y-1); // burns behind the body so the flexing pose stays readable
   const rings=cry?3:2,span=cry?width:200,gap=cry?2:4;
   for(let n=0;n<rings;n++){const a=age-n*gap;if(a<0||a>=8)continue;const ring=this.layer(key+':ring:'+n,'ground-ring',a,s.feet,s.feet,span,span*.56,(a<5?1:(8-a)/3)*.95,0,cry?undefined:tint);ring?.setFrame(this.reduced()?'22':String(21+Math.min(3,Math.floor(a/2)))).setDepth(s.feet.y-1);}
   return true;
  }
  if(spec.form==='dash'){
   this.ghost(s,age,spec.ghosts??3,project(e.origin??e.position),ground);this.ghosts(key,s,age,tint);
   if(age<9){const from=project(e.origin??e.position),to=ground,theta=Math.atan2(to.y-from.y,to.x-from.x);for(const [i,at]of [from,to].entries())this.layer(key+':side-dust:'+i,'ground-dust',age,at,at,68,26,alpha*.4,0,e.skill==='shadow_step'?0x796492:0xb7a084,true)?.setDepth(at.y-1);
    if(spec.main)this.layer(key+':speed',spec.main,age,{x:(from.x+to.x)/2,y:(from.y+to.y)/2-16},to,Math.min(220,Math.max(72,Math.hypot(to.x-from.x,to.y-from.y))),18,alpha*.7,theta,tint,true);
    if(spec.overlay==='lightning')this.layer(key+':electric',spec.overlay,age,ground,ground,90,50,alpha*.45);
   }return true;
  }
  if(spec.form==='snipe'){if(age<7){const length=Math.hypot(s.target.x-s.point.x,s.target.y-s.point.y);this.layer(key+':tracer',spec.main!,age,{x:(s.point.x+s.target.x)/2,y:(s.point.y+s.target.y)/2},ground,Math.max(60,length),24,alpha,angle,tint,true);}return true;}
  // Leaps travel in one tick: snapshots on an arc between take-off and landing sell the jump (2026-10-16).
  if(spec.form==='slam'&&spec.ghosts&&e.origin){this.ghost(s,age,spec.ghosts,project(e.origin),ground,spec.jump*3);this.ghosts(key,s,age,tint);}
  if(spec.form==='slam'&&spec.main&&age<9){const blade=spec.main.startsWith('blade');this.layer(key+':slam',spec.main,age,blade?{x:s.point.x+Math.cos(angle)*30,y:s.point.y+8}:ground,ground,width*(blade?.7:.8),width*(blade?.75:.55),alpha,0,blade?tint:undefined);return false;}
  if(spec.form==='spin'&&e.skill==='death_lotus'){if(age<9)for(let n=0;n<8;n++){const a=n*Math.PI/4+(this.reduced()?0:age*.15),at={x:s.feet.x+Math.cos(a)*width*.35,y:s.feet.y+Math.sin(a)*width*.19-12};this.layer(key+':orbit:'+n,'knife-flight',age,at,s.feet,36,18,alpha*.75,a+Math.PI/2,tint,true);}return true;} // D6: current rules declare three melee pulses, not outgoing projectiles.
  if(spec.form==='cross'){
   for(let n=0;n<(e.part?1:spec.multi??1);n++){const a=age-n*(spec.delay??0),part=e.part?e.part-1:n;if(a<0||a>=9)continue;const fade=a<5?1:Math.max(0,1-(a-5)/4),image=this.layer(key+':cross:'+n,spec.main!,a,{x:s.point.x+Math.cos(angle)*width*.2,y:s.point.y+Math.sin(angle)*width*.2},s.feet,width,width*.55,fade*(n?.72:1),angle+(part%2?-Math.PI/4:Math.PI/4),spec.tint,!!spec.tint);
    if(e.skill==='dual_strike')image?.setCrop(part%2?128:0,0,128,256);
   }return true;
  }
  if(spec.overlay&&age<7)this.layer(key+':accent',spec.overlay,age,s.point,s.feet,44,30,alpha*.3,0,tint);
  return false;
 }
 private ghosts(key:string,s:State,age:number,tint:number){
  if(!this.reduced())for(const [n,g]of s.ghosts.entries()){const a=.35*Math.max(0,1-(age-g.tick)/8);if(a&&this.pool.visible(g.point.x,g.point.y,160))this.pool.image(key+':ghost:'+n,g.texture,'__BASE',false)?.setOrigin(g.image.originX,g.image.originY).setPosition(g.point.x,g.point.y).setScale(g.image.scaleX,g.image.scaleY).setFlip(g.image.flipX,g.image.flipY).setTint(tint).setAlpha(a).setDepth(g.point.y+1);}
 }
 flight(key:string,p:Projectile,profile:SkillVfxProfile,point:Point,ground:Point,angle:number,age:number,depth:number){
  const spec=physicalSpec(profile.key);if(!spec||!spec.main||!['flight','spin'].includes(spec.form))return false;
  const s=physicalFlightStyle(spec,p.skill??'',age,this.reduced());this.layer(key,spec.main,age,point,ground,s.width,s.height,1,angle+s.turn,s.tint,true)?.setDepth(depth);return true;
 }
 zone(key:string,z:Zone,profile:SkillVfxProfile,tick:number){
  const spec=physicalSpec(profile.key);if(!spec?.surface)return false;const center=project(z.position);
  if(z.delay>0){const size=groundSize(z.radius),alpha=.35+.12*Math.sin(z.delay*.8);if(z.skill==='explosive_kunai')this.layer(key+':waiting','knife-flight',0,center,center,30,14,alpha,-Math.PI/2);else this.pool.graphics(key+':warning',center.y-1)?.lineStyle(2,vfxPalettes[profile.element].main,.4).strokeEllipse(center.x,center.y,size.width,size.height);return true;}
  if(spec.form==='rain')this.rain(key,center,z.radius,tick-(z.started??tick));return true;
 }
 private rain(key:string,center:Point,radius:number,age:number){
  const size=groundSize(radius);for(let n=0;n<(this.reduced()?3:8);n++){const a=n*2.39996,r=Math.sqrt((n+.5)/8)*.42,at={x:center.x+Math.cos(a)*size.width*r,y:center.y+Math.sin(a)*size.height*r},phase=((age+n*2)%24+24)%24,drop=Math.max(0,1-phase/12)*90;
   this.layer(key+':arrow:'+n,'arrow-flight',age,{x:at.x,y:at.y-(this.reduced()?0:drop)},at,54,14,phase<12?1:Math.max(0,1-(phase-12)/12),Math.PI/2,0xe7d8ac,true,true);
   if(phase>=12&&phase<16)this.layer(key+':dust:'+n,'ground-dust',phase-12,at,at,24,10,(1-(phase-12)/4)*.25,0,0xb7a084,true,true)?.setDepth(at.y-1);
  }
 }
 prune(tick:number){for(const [key,s]of this.states)if(tick-s.tick>24){for(const g of s.ghosts)this.scene.textures.remove(g.texture);this.states.delete(key);}}
 reset(){for(const s of this.states.values())for(const g of s.ghosts)this.scene.textures.remove(g.texture);this.states.clear();}
}
