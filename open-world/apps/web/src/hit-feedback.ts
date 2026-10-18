import type {World,CombatEvent} from '../../../packages/simulation/index.ts';
import {vfxProfile,vfxPalettes,vfxBudgets,type VfxElement} from './vfx-profiles.ts';
import {physicalSpec} from './physical-vfx-spec.ts';
import {resolvedToken} from './ui/tokens.ts';
import {project} from './iso.ts';
type Point={x:number;y:number};
type Hit={tick:number;element:VfxElement;hero:boolean;strong:boolean;boss:boolean;distance:number;lift:number;direction:Point};
type Trail={hp:number;value:number;from:number;at:number};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function actorPosition(w:World,id?:string){return !id||id==='hero'||id===w.playerId?w.hero.position:w.enemies.find(e=>e.id===id)?.position??w.players.get(id)?.hero.position;}
export function hitDirection(w:World,event:CombatEvent):Point{
 const source=project(actorPosition(w,event.sourceId)??w.hero.position),target=project(event.position),d=Math.hypot(target.x-source.x,target.y-source.y)||1;return {x:(target.x-source.x)/d,y:(target.y-source.y)/d};
}
export class HitFeedback{
 private hits=new Map<string,Hit>();private stops=new Map<string,{start:number;end:number}[]>();private lastStop=-100;private trails=new Map<string,Trail>();heavyAt=-100;
 constructor(private reduced:()=>boolean){}
 consume(w:World){
  const deaths=new Set(w.events.filter(e=>e.type==='entity_died').map(e=>`${e.tick}:${e.id}`));
  for(const e of w.events){if(e.type!=='hit_resolved'||!(e.amount!>0))continue;
   const hero=e.id==='hero',actor=w.enemies.find(n=>n.id===e.id),p=vfxProfile(e.vfxKey??'system/damage'),strong=!!e.crit||deaths.has(`${e.tick}:${e.id}`),distance=actor?.boss?0:((p?.power??1)===3?16:(p?.power??1)===2?10:6)*(actor?.elite?.6:1),spec=physicalSpec(p?.key),lift=actor?.boss?0:spec?.form==='slam'&&spec.stones>=8?6*(actor?.elite?.6:1):0;
   this.hits.set(e.id,{tick:e.tick,hero,strong,boss:!!actor?.boss,element:p?.element??'steel',distance,lift,direction:hitDirection(w,e)});
   if(hero&&e.amount!>=w.stats.hp*.12)this.heavyAt=e.tick;
   const direct=!e.category||e.category==='direct',owned=e.sourceId==='hero'||e.sourceId===w.playerId||!e.sourceId&&!hero;
   // Light melee hits get a one-tick stop so every swing lands; heavier hits, crits and kills hold longer.
   const melee=['slash','spin','dash','burst'].includes(p?.family??'');
   if(!this.reduced()&&!hero&&owned&&direct&&(strong||melee||(p?.power??1)>=2)&&e.tick-this.lastStop>=6){const duration=deaths.has(`${e.tick}:${e.id}`)?5:p?.power===3?4:e.crit?3:(p?.power??1)>=2?2:1;this.lastStop=e.tick;for(const id of ['hero',e.id]){const stops=this.stops.get(id)??[];stops.push({start:e.tick,end:e.tick+duration});this.stops.set(id,stops.slice(-32));}}
  }
 }
 state(id:string,tick:number){const h=this.hits.get(id),age=h?Math.max(0,tick-h.tick):100,reduced=this.reduced();
  let tint:number|undefined,fill=false;if(h&&age<(h.hero?2:4)){fill=h.hero||age<2;tint=h.hero?parseInt(resolvedToken('Color.Combat.DamageTaken').slice(1),16):age<2?parseInt(resolvedToken('Color.World.Text').slice(1),16):vfxPalettes[h.element].main;}
  const squeeze=h?.boss?.03:h?.strong?.12:.08,amount=reduced||age>=6?0:age<=2?1:(1-clamp((age-2)/4))**2,offset=h&&!reduced?age<1?age:age<7?(1-(age-1)/6)**3:0:0;
  const lift=!reduced&&age<8?Math.sin(age/8*Math.PI)*(h?.lift??0):0;
  return {tint,fill,scaleX:1+squeeze*amount,scaleY:1-squeeze*amount,x:(h?.direction.x??0)*(h?.distance??0)*offset,y:(h?.direction.y??0)*(h?.distance??0)*offset-lift,paused:!reduced&&(this.stops.get(id)??[]).some(s=>tick>=s.start&&tick<s.end)};
 }
 animationAge(id:string,started:number,now:number){return Math.max(0,now-started-(this.reduced()?0:(this.stops.get(id)??[]).reduce((sum,s)=>sum+Math.max(0,Math.min(now,s.end)-Math.max(started,s.start)),0)));}
 trailHp(id:string,hp:number,tick:number){let t=this.trails.get(id);if(!t){this.trails.set(id,{hp,value:hp,from:hp,at:tick});return hp;}if(hp>t.hp){t={hp,value:hp,from:hp,at:tick};this.trails.set(id,t);}else if(hp<t.hp){t.from=Math.max(t.value,t.hp);t.hp=hp;t.at=tick;}t.value=t.hp+(t.from-t.hp)*(1-clamp((tick-t.at-10)/12));return t.value;}
 vignette(tick:number){return .35*(1-clamp((tick-this.heavyAt)/14))*(this.reduced()?.5:1);}
 reset(){this.hits.clear();this.stops.clear();this.trails.clear();this.lastStop=-100;this.heavyAt=-100;}
 forget(id:string){this.hits.delete(id);this.stops.delete(id);this.trails.delete(id);}
}
export class CameraShake{
 tier=0;at=-100;private direction:Point={x:0,y:0};private lastByTier=new Map<number,number>();
 trigger(tier:number,tick:number,direction:Point={x:0,y:0}){if(!tier)return false;const active=tick-this.at<this.duration();if(active&&tier<this.tier||tick-(this.lastByTier.get(tier)??-100)<8)return false;this.tier=tier;this.at=tick;this.direction=direction;this.lastByTier.set(tier,tick);return true;}
 private duration(){return [0,4,6,8,8][this.tier]??0;}
 offset(tick:number,reduced=false){const age=Math.max(0,tick-this.at),duration=this.duration();if(reduced||!duration||age>=duration)return {x:0,y:0};const t=age/duration,a=[0,1.5,3,5,6][this.tier]*(1-t)**2,directed=!!(this.direction.x||this.direction.y),x=(directed?this.direction.x||.12:1)*Math.sin(t*28+.7)*a,y=(directed?this.direction.y||.12:.6)*Math.cos(t*23)*a,cap=Math.min(1,vfxBudgets.cameraShakePixels/(Math.hypot(x,y)||1));return {x:x*cap,y:y*cap};}
 reset(){this.tier=0;this.at=-100;this.lastByTier.clear();this.direction={x:0,y:0};}
}
export function combatShakeTier(w:World,e:CombatEvent,deaths:ReadonlySet<string>){
 if(e.type==='entity_died'){const target=w.enemies.find(n=>n.id===e.id);return target?.boss?4:target?.elite?2:0;}
 if(e.type!=='hit_resolved'||!(e.amount!>0))return 0;
 if(e.id==='hero'&&(e.vfxKey?.startsWith('boss/')||w.enemies.find(n=>n.id===e.sourceId)?.boss))return 3;
 if(e.id==='hero'&&e.amount!>=w.stats.hp*.12)return 2;
 const p=vfxProfile(e.vfxKey??'system/damage'),spec=physicalSpec(p?.key);return spec?spec.shake:p?.power===3?2:e.crit||p?.power===2?1:0;
}
export function combatShakeDirection(w:World,e:CombatEvent):Point{const spec=physicalSpec(e.vfxKey);return spec?.ground.some(kind=>kind==='crater'||kind==='crack')?{x:.12,y:1}:hitDirection(w,e);}
