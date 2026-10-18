/** A finished battle can play its final clip without advancing simulation or reward time. */
export class HeroDeathPlayback {
 private dead=false;elapsed=0;
 advance(dead:boolean,deltaMs:number,paused:boolean,playbackRate=1,singleStep=false,duration=1.5){
  if(!dead){this.dead=false;this.elapsed=0;return 0;}
  if(!this.dead){this.dead=true;this.elapsed=0;return 0;}
  const delta=singleStep?1/30:paused?0:Math.min(100,Math.max(0,deltaMs))/1000*Math.max(0,playbackRate);
  this.elapsed=Math.min(Math.max(0,duration),this.elapsed+delta);return this.elapsed;
 }
 reset(){this.dead=false;this.elapsed=0;}
}
