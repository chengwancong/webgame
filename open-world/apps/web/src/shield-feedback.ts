import type {CombatEvent} from '../../../packages/simulation/index.ts';
export type ShieldPhase='none'|'appear'|'idle'|'hit'|'break'|'expire';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export class ShieldFeedback{
 private expireAlpha=.55;phase:ShieldPhase='none';at=-100;max=0;before=0;appliedAt=-100;hitAt=-100;sourceId?:string;skill?:string;breakTick=-100;
 constructor(private owner='hero'){}
 consume(shield:number,tick:number,events:readonly CombatEvent[]){
  let absorbedAt=-100,broke=false;const owner=this.owner;
  for(const e of events){if(e.type!=='shielded'||e.id!==owner)continue;
   if(e.shieldPhase==='applied'){this.max=e.shieldRemaining??shield;this.skill=e.skill;this.phase='appear';this.at=this.appliedAt=e.tick;}
   if(e.shieldPhase==='absorbed'){absorbedAt=e.tick;this.hitAt=e.tick;this.sourceId=e.sourceId;if(e.shieldRemaining===0){this.phase='break';this.at=this.breakTick=e.tick;broke=true;}else{this.phase='hit';this.at=e.tick;}}
  }
  if(shield>0&&this.before<=0&&this.phase!=='appear'&&this.phase!=='hit'){this.phase='appear';this.at=this.appliedAt=tick;this.max=shield;}
  if(this.before>0&&shield<=0&&this.phase!=='break'&&this.phase!=='expire'){this.expireAlpha=this.visual(this.before,tick).alpha;this.phase=absorbedAt===tick?'break':'expire';this.at=tick;if(this.phase==='break'){this.breakTick=tick;broke=true;}}
  // Optional fields absent in historical recordings: use the observed shield delta.
  if(shield>0&&shield<this.before&&absorbedAt<0&&events.some(e=>e.type==='hit_resolved'&&e.id===owner&&e.tick===tick)){this.phase='hit';this.at=this.hitAt=tick;this.sourceId=events.find(e=>e.type==='hit_resolved'&&e.id===owner)?.sourceId;}
  if(shield>0&&this.max<=0)this.max=shield;this.before=shield;this.advance(tick);return {broke,tick:this.breakTick};
 }
 advance(tick:number){const age=tick-this.at;if((this.phase==='appear'||this.phase==='hit')&&age>=8)this.phase=this.before>0?'idle':'none';if(this.phase==='break'&&age>=16||this.phase==='expire'&&age>=12)this.phase='none';}
 visual(shield:number,tick:number,reduced=false){
  this.advance(tick);const age=Math.max(0,tick-this.at),ratio=clamp(shield/Math.max(1,this.max)),appear=this.phase==='appear',expire=this.phase==='expire',broken=this.phase==='break';
  let scale=1,alpha=(reduced?.55:.55+.07*Math.sin(tick*Math.PI/30))*(.6+.4*ratio);
  if(appear){const t=clamp(age/5),back=1+2.70158*(t-1)**3+1.70158*(t-1)**2;scale=age<5?.6+.48*back:1.08-.08*clamp((age-5)/3);alpha=.62*clamp(age/8);}
  if(this.phase==='hit'&&age<4)scale=1+.06*Math.sin(age*Math.PI/4);
  if(expire){alpha=this.expireAlpha*(1-clamp(age/12));scale=1-.06*clamp(age/12);}
  if(broken)alpha=age<2?.9:0;
  return {phase:this.phase,age,ratio,scale:reduced?1:scale,alpha,width:broken?6:1.5+1.5*ratio,visible:this.phase!=='none'};
 }
 reset(){this.phase='none';this.at=this.appliedAt=this.hitAt=this.breakTick=-100;this.max=this.before=0;this.sourceId=this.skill=undefined;}
}
/** Shield bar (scheme C): a separate strip whose full width is the shield's own total
 * when it was raised, shrinking as it is absorbed. A rise above the remembered total
 * (new or stacked shield) resets the total; a refresh below it keeps the old total. */
export class ShieldBarTracker{
 private totals=new Map<string,{max:number;last:number}>();
 ratio(id:string,shield:number){if(shield<=0){this.totals.delete(id);return 0;}const t=this.totals.get(id)??{max:0,last:0};if(t.last<=0||shield>t.max)t.max=shield;t.last=shield;this.totals.set(id,t);return clamp(shield/t.max);}
 clear(){this.totals.clear();}
}
