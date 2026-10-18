import type {CombatEvent} from '../../../packages/simulation/index.ts';
import type {VfxPool} from './vfx-pool.ts';
import {project} from './iso.ts';
import {groundSize,seededNoise} from './vfx-geometry.ts';
import manifest from '../../../packages/asset-manifest/combat-physical-fx.json';
import {physicalLimits,type PhysicalSpec} from './physical-vfx-spec.ts';
type Point={x:number;y:number};type Impact={id:string;event:CombatEvent;spec:PhysicalSpec;center:Point;radius:number;length:number;tint:number};
export const groundFragment=(kind:string)=>kind==='crater'?'ground-crater':kind==='ring'?'ground-ring':kind==='crack'?'ground-crack':kind==='stones'?'ground-rock':'ground-dust';
/** Receives real releases/activations. Decals have an independent bounded lifetime. */
export class GroundImpact{
 private impacts:Impact[]=[];private decals:string[]=[];private serial=0;private stones=0;
 constructor(private pool:VfxPool,private reduced:()=>boolean){}
 add(event:CombatEvent,spec:PhysicalSpec,radius:number,length:number,tint:number){
  if(!spec.ground.length)return;const id='ground-physical:'+(++this.serial);this.impacts.push({id,event,spec,center:project(event.position),radius:Math.max(.3,radius),length,tint});
  if(spec.ground.includes('crater')){this.decals.push(id);if(this.decals.length>physicalLimits.decals)this.decals.shift();}
  if(this.impacts.length>128)this.impacts.shift();
 }
 private image(key:string,id:string,point:Point,width:number,height:number,alpha:number,depth:number,tint:number,rotation=0,decor=false,frame?:string){
  if(!this.pool.visible(point.x,point.y,width))return;const clip=manifest.clips[id as keyof typeof manifest.clips];if(!clip)return;
  const node=this.pool.image(key,clip.key,frame??clip.peak,!decor);node?.setOrigin(.5).setPosition(point.x,point.y).setScale(width/clip.visibleSize[0],height/clip.visibleSize[1]).setTint(tint).setTintMode(id==='ground-crater'||id==='ground-crack'?0:1).setAlpha(Math.max(0,Math.min(1,alpha))).setRotation(rotation).setDepth(depth);return node;
 }
 draw(tick:number,budget:number){
  this.stones=0;this.impacts=this.impacts.filter(i=>tick-i.event.tick<physicalLimits.craterHoldTicks+physicalLimits.craterFadeTicks);this.decals=this.decals.filter(id=>this.impacts.some(i=>i.id===id));
  for(const i of this.impacts){const age=Math.max(0,tick-i.event.tick),size=groundSize(i.radius),{x,y}=i.center,alpha=Math.max(0,1-Math.max(0,age-physicalLimits.craterHoldTicks)/physicalLimits.craterFadeTicks),a=i.event.target?project(i.event.target):i.event.origin?project(i.event.origin):{x:x+1,y},angle=Math.atan2(a.y-y,a.x-x),k=i.id;
   if(i.spec.ground.includes('crater')&&this.decals.includes(k)){const pit=Math.min(1,230/(size.width*.85));this.image(k+':crater','ground-crater',i.center,size.width*.85*pit,size.height*.85*pit,alpha*.8,y-2,0x725941);} // a pit, not the whole area: wide areas read through cracks and rings
   if(i.spec.ground.includes('ring')&&age<physicalLimits.ringTicks){const expand=age/physicalLimits.ringTicks;this.image(k+':ring','ground-ring',i.center,size.width*expand,size.height*expand,(1-expand)*.72,y-1,i.tint);}
   if(i.spec.ground.includes('crack')&&age<21){const count=i.event.skill==='seismic_staff'?5:1,origin=i.event.position,target=i.event.target??{x:origin.x+1,y:origin.y},base=Math.atan2(target.y-origin.y,target.x-origin.x);for(let n=0;n<count;n++){const direction=base+n*Math.PI*2/count,end=project({x:origin.x+Math.cos(direction)*i.length,y:origin.y+Math.sin(direction)*i.length}),mid={x:(x+end.x)/2,y:(y+end.y)/2},rotation=Math.atan2(end.y-y,end.x-x);this.image(k+':crack:'+n,'ground-crack',mid,Math.hypot(end.x-x,end.y-y),12,(1-age/21)*.65,Math.max(y,end.y)-1,i.tint,rotation);}}
   if(i.spec.ground.includes('dust')&&age<9)this.image(k+':dust','ground-dust',i.center,size.width*.85,size.height*.6,(1-age/9)*.35,y-.5,0xb7a084,angle,false,manifest.clips['ground-dust'].frames[Math.min(manifest.clips['ground-dust'].frames.length-1,Math.floor(age))]);
   if(!this.reduced()&&i.spec.stones&&age<physicalLimits.stoneTicks){const count=Math.min(i.spec.stones,Math.max(0,budget-this.stones));this.stones+=count;for(let n=0;n<count;n++){const theta=n*Math.PI*2/i.spec.stones+seededNoise(n+17)*.2,t=age/physicalLimits.stoneTicks,r=(.18+t*.55),point={x:x+Math.cos(theta)*size.width*r*.5,y:y+Math.sin(theta)*size.height*r*.5-Math.sin(t*Math.PI)*(12+seededNoise(n+4)*14)};this.image(k+':stone:'+n,'ground-rock',point,7+n%4,9+n%4,1-t,y+2+n*.01,0x9e8566,theta+t*3,true);}}
  }return this.stones;
 }
 stats(){return {impacts:this.impacts.length,decals:this.decals.length,stones:this.reduced()?0:this.stones,particleBudget:physicalLimits.particles};}
 reset(){this.impacts=[];this.decals=[];this.stones=0;}
}
