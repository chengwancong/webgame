import type {Vec} from '../../../packages/contracts/index.ts';
const TICK_MS=1000/30;
/** Presentation only: blend received positions, never advance combat or invent hits.
 * Snapshots are buffered on the server tick timeline and shown a little more than one
 * snapshot interval late, so uneven arrival times no longer turn into speed changes.
 * The buffer never extrapolates past the newest snapshot; the animation clock stops a
 * short way past it when updates stall. Teleports snap and new actors start at their
 * real positions. Added delay over the old blend is only the measured jitter margin. */
export class AuthoritativeMotion {
 private snapshots:{tick:number;poses:Map<string,Vec>}[]=[];
 /** Local receive time minus server time (ms), smoothed. */
 private offset=0;private interval=100;private jitter=0;
 private shown=-Infinity;private shownAt=Number.NaN;private clock=-Infinity;
 reset(){this.snapshots=[];this.interval=100;this.jitter=0;this.shown=-Infinity;this.shownAt=Number.NaN;this.clock=-Infinity;}
 accept(tick:number,positions:Iterable<[string,Vec]>,now:number){
  let last=this.snapshots.at(-1);
  if(last&&tick===last.tick)return;
  if(last&&tick<last.tick){this.reset();last=undefined;}
  const sample=now-tick*TICK_MS;
  if(!last)this.offset=sample;
  else{
   this.interval+=(Math.min(250,(tick-last.tick)*TICK_MS)-this.interval)*.2;
   const error=sample-this.offset;
   // Server pause/resume or a long hitch: re-anchor instead of drifting for seconds.
   if(Math.abs(error)>250)this.offset=sample;else{this.offset+=error*.1;this.jitter+=(Math.abs(error)-this.jitter)*.2;}
  }
  const poses=new Map<string,Vec>();for(const [id,p] of positions){
   poses.set(id,{x:p.x,y:p.y});const before=last?.poses.get(id);
   // A teleport shows at once: rewrite the buffered history instead of replaying the old path.
   if(before&&Math.hypot(before.x-p.x,before.y-p.y)>8)for(const s of this.snapshots)if(s.poses.has(id))s.poses.set(id,{x:p.x,y:p.y});
  }
  this.snapshots.push({tick,poses});if(this.snapshots.length>64)this.snapshots.shift();
 }
 private delay(){return Math.max(TICK_MS,Math.min(250,this.interval+Math.max(15,this.jitter*2)));}
 /** Shown server time (ms); monotonic so re-anchoring never plays motion backwards. */
 private renderTime(now:number){
  if(now===this.shownAt)return this.shown;
  this.shown=Math.max(this.shown,now-this.offset-this.delay());this.shownAt=now;
  while(this.snapshots.length>2&&this.snapshots[1].tick*TICK_MS<=this.shown)this.snapshots.shift();
  return this.shown;
 }
 position(id:string,fallback:Vec,now:number):Vec{
  if(!this.snapshots.length)return {...fallback};
  const t=this.renderTime(now),list=this.snapshots;
  let i=list.length-1;while(i>0&&list[i].tick*TICK_MS>t)i--;
  const a=list[i],b=list[i+1],from=a.poses.get(id);
  if(!b||a.tick*TICK_MS>t){const pose=from??list.find(s=>s.poses.has(id))?.poses.get(id)??fallback;return {...pose};}
  const to=b.poses.get(id);
  if(!from||!to){const pose=from??to??list.slice(i+2).find(s=>s.poses.has(id))?.poses.get(id)??fallback;return {...pose};}
  const k=Math.max(0,Math.min(1,(t-a.tick*TICK_MS)/((b.tick-a.tick)*TICK_MS)));
  return {x:from.x+(to.x-from.x)*k,y:from.y+(to.y-from.y)*k};
 }
 /** Animation clock in ticks past the newest snapshot: follows the estimated server
  * clock, never runs backwards, and stops shortly after updates stall. */
 fraction(now:number){
  const latest=this.snapshots.at(-1);if(!latest)return 0;
  const ahead=Math.max(1,Math.min(6,(this.interval+2*this.jitter)/TICK_MS));
  this.clock=Math.max(this.clock,latest.tick,Math.min(latest.tick+ahead,(now-this.offset)/TICK_MS));
  return this.clock-latest.tick;
 }
}
