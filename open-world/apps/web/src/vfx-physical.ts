import type {CombatEvent,World,Projectile,Zone} from '../../../packages/simulation/index.ts';
import type {RenderPose} from './effect-attachments.ts';
import {PhysicalSkillLayers} from './vfx-physical-skills.ts';
import type {VfxPool} from './vfx-pool.ts';
import manifest from '../../../packages/asset-manifest/combat-physical-fx.json';
import {physicalSpec,physicalLimits} from './physical-vfx-spec.ts';
import {GroundImpact} from './vfx-ground.ts';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
import {groundSize} from './vfx-geometry.ts';
import {project} from './iso.ts';
import type Phaser from 'phaser';
import {WeaponSmear} from './vfx-weapon-smear.ts';
import {ShowcaseVfx,isShowcaseKey} from './vfx-showcase.ts';
type Point={x:number;y:number};
export class PhysicalVfx{
 readonly ground:GroundImpact;
 private world?:World;private tick=-1;
 private smear:WeaponSmear;private skills:PhysicalSkillLayers;readonly showcase:ShowcaseVfx;
 constructor(scene:Phaser.Scene,private pool:VfxPool,private reduced:()=>boolean,private attachment:(id:string,name:'weapon'|'feet'|'chest'|'muzzle')=>Point|undefined,private fallback:(key:string,clip:string,age:number,point:Point,ground:Point,size:number,alpha:number,tint?:number)=>Phaser.GameObjects.Image|undefined,pose:()=>RenderPose|undefined=()=>undefined){this.ground=new GroundImpact(pool,reduced);this.smear=new WeaponSmear(scene,pool);this.skills=new PhysicalSkillLayers(scene,pool,reduced,(...args)=>this.layer(...args),pose);this.showcase=new ShowcaseVfx(scene,pool,reduced,attachment);}
 consume(w:World){if(this.world&&this.world!==w&&(this.world.region.id!==w.region.id||w.tick<this.tick))this.reset();this.world=w;this.tick=w.tick;this.showcase.consume(w);for(const e of w.events){const key=e.vfxKey??(e.id==='hero'?'player/'+e.skill:undefined),spec=physicalSpec(key);if(!spec||isShowcaseKey(key)||e.type!==(spec.surface?'effect_activated':'cast_released'))continue;const skill=w.skills.find(s=>s.id===e.skill),p=vfxPalettes[spec.weapon==='axe'?'earth':'steel'];this.ground.add(e,spec,e.radius??skill?.radius??1,skill?.range??e.radius??1,spec.tint??p.light);}}
 layer(key:string,id:string,age:number,point:Point,ground:Point,width:number,height:number,alpha:number,rotation=0,tint?:number,fill=false,decor=false){
  const clip=manifest.clips[id as keyof typeof manifest.clips];if(!clip)return this.fallback(key,id,age/30,point,ground,width,alpha,tint);
  if(!this.pool.visible(point.x,point.y,Math.max(width,height)))return;
  const peak=Math.max(0,clip.frames.indexOf(clip.peak)),frame=this.reduced()?clip.peak:clip.frames[Math.min(clip.frames.length-1,Math.max(0,peak-1+Math.floor(Math.min(age,2))))];const image=this.pool.image(key,clip.key,frame,!decor);image?.setOrigin(.5).setPosition(point.x,point.y).setScale(width/clip.visibleSize[0],height/clip.visibleSize[1]).setRotation(rotation).setAlpha(alpha).setDepth(ground.y+4);if(tint!==undefined){image?.setTint(tint);if(fill)image?.setTintMode(1);}return image;
 }
 flash(w:World,e:CombatEvent,p:SkillVfxProfile,stage:string,age:number,key:string,lite=false,captured?:{point:Point;feet:Point;target?:Point}){
  const spec=physicalSpec(p.key);if(!spec)return false;if(isShowcaseKey(p.key))return true;const ground=project(e.position),owner=e.sourceId??e.id,weapon=captured?.point??(stage==='impact'?ground:this.attachment(owner,'weapon')??ground),feet=captured?.feet??(stage==='impact'?ground:this.attachment(owner,'feet')??ground),target=captured?.target??(e.target?project(e.target):e.origin?project(e.origin):{x:weapon.x+(w.hero.facing||1)*50,y:weapon.y}),angle=Math.atan2(target.y-weapon.y,target.x-weapon.x),palette=vfxPalettes[p.element];
  if(stage==='windup'){
   if(spec.form==='snipe'){const muzzle=this.attachment(owner,'muzzle')??weapon;this.pool.graphics(key+':aim',feet.y+3)?.lineStyle(2,palette.light,.5).lineBetween(muzzle.x,muzzle.y,target.x,target.y);return true;}
   if(spec.action==='projectile')return true;
   if(p.power>=2&&age>=Math.max(0,(e.windup??1)-1)&&age<(e.windup??1))this.layer(key+':start-spark','blade-streak',0,weapon,feet,24,18,.75,angle)?.setCrop(96,96,64,64);
   if(p.power===3)this.layer(key+':gather-dust','ground-dust',0,feet,feet,55,20,.18,0,0xb7a084,true)?.setDepth(feet.y-1);
   return true;
  }
  if(stage==='impact'){if(lite)return true;const chest=this.attachment(e.id,'chest')??ground,alpha=Math.max(0,1-age/9);if(spec.onHit&&spec.main)this.layer(key+':contact',spec.main,age,chest,ground,spec.form==='thrust'?48:74,spec.form==='thrust'?36:54,alpha,0,spec.tint??palette.light);for(const [i,id]of spec.hit.entries()){if(spec.onHit&&spec.form==='thrust'&&i===0)continue;const size=spec.weapon==='hidden'||spec.form==='flight'?58:p.power===3?112:84;this.layer(key+':hit:'+i,id,age,id==='ground-dust'?ground:chest,ground,id==='ground-dust'?48:size,id==='ground-dust'?24:size,alpha*(i?.55:1),0,id==='ground-dust'?0xb7a084:undefined);}return true;}
  if(this.skills.release(e,p,stage,age,key,weapon,feet,target))return true;
  if(!['release','surface'].includes(stage))return true;const alpha=age<5?1:Math.max(0,1-(age-5)/4),area=groundSize(e.radius??0),width=e.radius?area.width*.95:p.size*1.2;
  if(spec.form==='slam'){if(age<physicalLimits.whiteFlashTicks)this.layer(key+':flash','impact-heavy',0,feet,feet,20,20,.65,0,0xffffff,true);return true;}
  if(!spec.main||age>=9)return true;
  if(spec.form==='spin'){const count=e.skill==='vortex_blade'?3:1;for(let n=0;n<count;n++){const scale=(1-n*.2)*(e.skill==='vortex_blade'?Math.max(.2,1-age/14):1);this.smear.ring(key+':smear-plane:'+n,spec.main,age+(e.skill==='blade_fury'?Math.floor(age/4)*2:n*2),ground,width*scale,width*.55*scale,alpha*(n?.3:.78),spec.tint??palette.light,this.reduced());}return true;}
  const point={x:weapon.x+Math.cos(angle)*width*.2,y:weapon.y+Math.sin(angle)*width*.2},front={x:feet.x,y:Math.max(feet.y,target.y)};this.layer(key+':smear',spec.main,age,point,front,width,width*(e.skill==='staff_sweep'?.28:.55),alpha,angle+Math.PI/4,spec.tint??(p.element==='steel'?undefined:palette.light),!!spec.tint||p.element!=='steel');return true;
 }
 flight(key:string,p:Projectile,profile:SkillVfxProfile,point:Point,ground:Point,angle:number,age:number,depth:number){if(this.showcase.flight(key,p,point,angle,age,depth))return true;return this.skills.flight(key,p,profile,point,ground,angle,age,depth);}
 zone(key:string,z:Zone,profile:SkillVfxProfile,tick:number){return this.skills.zone(key,z,profile,tick);}
 drawGround(tick:number,budget:number){this.skills.prune(tick);const used=this.showcase.draw(tick,budget);return used+this.ground.draw(tick,Math.max(0,budget-used));}
 reset(){this.ground.reset();this.skills.reset();this.showcase.reset();}
}
