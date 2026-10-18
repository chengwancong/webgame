import type Phaser from 'phaser';
import type {CombatEvent} from '../../../packages/simulation/index.ts';
import {formatBig} from '../../../packages/content/big-number.ts';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';

export type NumberKind='hit'|'crit'|'kill'|'minor'|'taken'|'heal'|'resource'|'absorb'|'shieldGain'|'miss'|'status';
type Point={x:number;y:number};
export type NumberEntry={serial:number;kind:NumberKind;baseKind:NumberKind;event:CombatEvent;amount:number;born:number;last:number;x:number;y:number;stack:number;mergedAt?:number;label?:string};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const cubic=(v:number)=>1-(1-v)**3,quad=(v:number)=>1-(1-v)**2;
const back=(v:number)=>1+2.70158*(v-1)**3+1.70158*(v-1)**2;
export function combatHash(tick:number,id:string,serial=0){let h=(tick^serial)>>>0;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h/4294967296;}
export function numberKind(e:CombatEvent,deaths:ReadonlySet<string>=new Set()):NumberKind|undefined{
 if(e.type==='hit_resolved'&&(e.amount??0)>0){if(e.id==='hero')return 'taken';if(deaths.has(`${e.tick}:${e.id}`))return 'kill';if(e.category&&e.category!=='direct')return 'minor';return e.crit?'crit':'hit';}
 if(e.type==='healed'||e.type==='revived')return e.amount?'heal':undefined;
 if(e.type==='resource_restored')return e.amount?'resource':undefined;
 if(e.type==='shielded')return e.shieldPhase==='absorbed'?'absorb':e.shieldPhase==='applied'?'shieldGain':undefined;
 if(e.type==='missed'||e.type==='status_changed'&&e.skill==='dodge')return 'miss';
 if(e.type==='status_changed'&&e.change==='consumed'&&e.status&&e.status!=='guardian')return undefined;
 if(e.type==='status_changed'&&e.change&&['resisted','immune','cleansed','expired','consumed'].includes(e.change))return 'status';
}
export function numberStyle(n:NumberEntry){
 const kind=n.baseKind,element:Partial<Record<NonNullable<CombatEvent['damageType']>,TokenName>>={fire:'Color.Combat.Element.Fire',cold:'Color.Combat.Element.Cold',lightning:'Color.Combat.Element.Lightning',arcane:'Color.Combat.Element.Arcane',shadow:'Color.Combat.Element.Shadow',poison:'Color.Combat.Element.Poison'};
 const color:TokenName=kind==='crit'?'Color.Combat.Crit':kind==='taken'?'Color.Combat.DamageTaken':kind==='heal'?'Color.Combat.Heal':['shieldGain','absorb'].includes(kind)?'Color.Combat.Shield':kind==='miss'?'Color.Combat.Miss':['resource','status'].includes(kind)?'Color.World.Info':element[n.event.damageType!]??'Color.Combat.DamageDealt';
 const size:TokenName=kind==='crit'?'Font.Size.CombatCrit':kind==='hit'?'Font.Size.CombatHit':kind==='minor'?'Font.Size.CombatMinor':['taken','heal','shieldGain'].includes(kind)?'Font.Size.CombatTaken':'Font.Size.CombatLabel';
 return {color:resolvedToken(color),size:parseFloat(resolvedToken(size))*(n.kind==='kill'?1.15:1),star:kind==='crit'};
}
export function numberText(n:NumberEntry){const value=formatBig(n.amount);return n.kind==='taken'?'-'+value:n.kind==='heal'?(n.event.type==='revived'?'复起 +':'+')+value:n.kind==='resource'?'能量 +'+value:n.kind==='absorb'?(n.event.shieldRemaining===0?'破盾 ':'吸收 ')+value:n.kind==='shieldGain'?'护盾 +'+value:n.kind==='miss'?(n.event.id==='hero'?'闪避':'未命中'):n.kind==='status'?n.label??({resisted:'抵抗',immune:'免疫',cleansed:'净化',expired:'已结束',consumed:'守护已用'} as Record<string,string>)[n.event.change!]??'':value;}
export function numberMotion(n:NumberEntry,tick:number,reduced=false){
 const age=Math.max(0,tick-n.born),strong=n.kind==='crit'||n.kind==='kill',life=strong?42:n.kind==='minor'?24:['heal','shieldGain'].includes(n.kind)?34:['absorb','miss','status','resource'].includes(n.kind)?26:30,t=clamp(age/life),hold=strong?.7:n.kind==='minor'?.5:n.kind==='taken'?.6:['absorb','miss','status','resource'].includes(n.kind)?.6:.65;
 let scale=1,dx=0,dy=0;
 if(!reduced){
  if(strong){scale=age<3?.5+1.1*back(age/3):age<8?1.6-.4*quad((age-3)/5):1.2;dy=-36*cubic(t);}
  else if(n.kind==='hit'){scale=age<2?.6+.65*back(age/2):age<6?1.25-.25*quad((age-2)/4):1;dy=-30*cubic(t);}
  else if(n.kind==='taken'){scale=1.2-.2*quad(clamp(age/2));dx=-14*quad(t);dy=t<.35?-10*quad(t/.35):-10+16*quad((t-.35)/.65);}
  else if(['heal','shieldGain'].includes(n.kind)){scale=.8+.2*quad(clamp(age/6));dy=-26*quad(t);}
  else{scale=.9+.1*quad(clamp(age/4));dy=-(n.kind==='minor'?18:16)*quad(t);}
  if(n.mergedAt!==undefined&&tick-n.mergedAt<4){const pulse=clamp((tick-n.mergedAt)/4);scale=1+.15*Math.sin(pulse*Math.PI);}
 }
 return {scale,x:n.x+dx,y:n.y+dy,alpha:t<hold?1:1-(t-hold)/(1-hold),expired:age>=life};
}
/** Owns only presentation state; no simulation object is mutated. */
export class CombatNumbers{
 entries:NumberEntry[]=[];private sequence=0;private stacks=new Map<string,{tick:number;count:number}>();
 spawn(kind:NumberKind,event:CombatEvent,point:Point,label?:string){
  if(['hit','crit','kill','minor'].includes(kind)){const previous=this.entries.find(n=>['hit','crit','kill','minor'].includes(n.kind)&&n.event.id===event.id&&event.tick-n.last<=9&&event.tick>=n.last);if(previous){previous.amount+=event.amount??0;previous.born=event.tick;previous.last=event.tick;previous.mergedAt=event.tick;if(kind==='kill')previous.kind='kill';else if(previous.kind!=='kill'&&(kind==='crit'||previous.kind==='minor'))previous.kind=kind;if(event.crit||kind==='crit')previous.baseKind='crit';else if(previous.baseKind==='minor'&&kind!=='minor')previous.baseKind='hit';return previous;}}
  const prev=this.stacks.get(event.id),count=prev&&event.tick-prev.tick<=8?prev.count+1:0,stack=count%4;this.stacks.set(event.id,{tick:event.tick,count});
  // Periodically discard inactive layout records in long-running encounters.
  for(const [id,state] of this.stacks)if(event.tick-state.tick>8)this.stacks.delete(id);
  const serial=++this.sequence,n:NumberEntry={serial,kind,baseKind:kind==='kill'?(event.category&&event.category!=='direct'?'minor':event.crit?'crit':'hit'):kind,event:{...event},amount:event.amount??0,born:event.tick,last:event.tick,x:point.x+(combatHash(event.tick,event.id,serial)*2-1)*10,y:point.y-16-14*stack,stack,label};
  // Hero labels have different rise curves: reserve their visible line height
  // in addition to the four stack slots, so shield gain and absorption stay legible.
  if(['taken','heal','resource','absorb','shieldGain','miss','status'].includes(kind))for(const previous of this.entries){if(previous.event.id!==event.id||event.tick-previous.last>8)continue;const motion=numberMotion(previous,event.tick),gap=(numberStyle(n).size+numberStyle(previous).size*motion.scale)/2+8;n.y=Math.max(point.y-116,Math.min(n.y,motion.y-gap));}
  this.entries.push(n);if(this.entries.length>30){const victim=this.entries.find(e=>e.kind==='minor'||e.kind==='status')??this.entries.find(e=>e.kind==='hit')??this.entries[0];this.entries=this.entries.filter(e=>e!==victim);}return n;
 }
 update(tick:number){this.entries=this.entries.filter(n=>!numberMotion(n,tick).expired);}
 reset(){this.entries=[];this.stacks.clear();this.sequence=0;}
}
export class WorldNumbers extends CombatNumbers{
 private nodes=new Map<number,{text:Phaser.GameObjects.Text;star?:Phaser.GameObjects.Graphics;size:number;color:string}>();private pool:{text:Phaser.GameObjects.Text;star?:Phaser.GameObjects.Graphics;size:number;color:string}[]=[];
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean,private created:()=>void){super();}
 override spawn(kind:NumberKind,event:CombatEvent,point:Point,label?:string){const n=super.spawn(kind,event,point,label),style=numberStyle(n);let view=this.nodes.get(n.serial);if(!view){view=this.pool.pop();if(!view){const text=this.scene.add.text(n.x,n.y,numberText(n),{fontFamily:resolvedToken('Font.Family'),fontSize:style.size,fontStyle:'bold',color:style.color,stroke:resolvedToken('Color.Combat.NumberStroke'),strokeThickness:4,resolution:worldTextResolution()}).setOrigin(.5).setShadow(0,2,resolvedToken('Color.World.Ink'),0,true,true);view={text,size:style.size,color:style.color};this.created();}view.text.setVisible(true).setAlpha(1).setScale(1);this.nodes.set(n.serial,view);}
  if(view.size!==style.size){view.text.setFontSize(style.size);view.size=style.size;}if(view.color!==style.color){view.text.setColor(style.color);view.color=style.color;}
  view.text.setText(numberText(n)).setDepth(['taken','heal','absorb','shieldGain','resource'].includes(n.kind)?10000:10001).setData({'damage-number':true,born:n.born,kind:n.kind});if(style.star&&!view.star)view.star=this.createStar();view.star?.setVisible(style.star);this.reconcile();return n;
 }
 override update(tick:number){super.update(tick);this.reconcile();for(const n of this.entries){const view=this.nodes.get(n.serial)!,motion=numberMotion(n,tick,this.reduced());view.text.setPosition(motion.x,motion.y).setScale(motion.scale).setAlpha(motion.alpha);view.star?.setPosition(motion.x,motion.y).setScale(motion.scale).setAlpha(motion.alpha);}}
 private createStar(){const star=this.scene.add.graphics().setDepth(10000);star.fillStyle(parseInt(resolvedToken('Color.Combat.Crit').slice(1),16),.55);star.beginPath();star.moveTo(0,-24);for(const [x,y]of [[5,-5],[30,0],[5,5],[0,24],[-5,5],[-30,0],[-5,-5]])star.lineTo(x,y);star.closePath();star.fillPath();return star;}
 private reconcile(){const active=new Set(this.entries.map(n=>n.serial));for(const [id,view] of this.nodes)if(!active.has(id)){view.text.setVisible(false).setData('damage-number',false);view.star?.setVisible(false);if(this.pool.length<30)this.pool.push(view);else{view.text.destroy();view.star?.destroy();}this.nodes.delete(id);}}
 override reset(){super.reset();this.reconcile();for(const view of this.pool){view.text.destroy();view.star?.destroy();}this.pool=[];}
 destroy(){this.reset();}
}
