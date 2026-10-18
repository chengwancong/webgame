import type {Vec} from '../../../packages/contracts/index.ts';

/** Presentation only: blend received positions, never advance combat or invent hits.
 * Catch up within one snapshot interval and stop extrapolating the animation clock
 * when updates stall. Teleports and new actors are shown at their real positions. */
export class AuthoritativeMotion {
 private poses=new Map<string,{from:Vec;to:Vec}>();
 private receivedAt=0;private duration=100;private tick=-1;
 reset(){this.poses.clear();this.tick=-1;}
 accept(tick:number,positions:Iterable<[string,Vec]>,now:number){
  if(tick===this.tick)return;
  if(tick<this.tick)this.reset();
  const duration=this.tick<0?100:Math.max(1000/30,Math.min(200,(tick-this.tick)*1000/30));
  const poses=new Map<string,{from:Vec;to:Vec}>();
  for(const [id,to] of positions){const from=this.position(id,to,now);poses.set(id,{from:Math.hypot(from.x-to.x,from.y-to.y)>8?{...to}:from,to:{...to}});}
  this.poses=poses;this.receivedAt=now;this.duration=duration;this.tick=tick;
 }
 position(id:string,fallback:Vec,now:number):Vec{
  const pose=this.poses.get(id);if(!pose)return {...fallback};
  const a=Math.max(0,Math.min(1,(now-this.receivedAt)/this.duration));
  return {x:pose.from.x+(pose.to.x-pose.from.x)*a,y:pose.from.y+(pose.to.y-pose.from.y)*a};
 }
 fraction(now:number){return Math.max(0,Math.min(this.duration,now-this.receivedAt))*30/1000;}
}
