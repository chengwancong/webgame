import {projectFx,type FxPoint} from './skill-fx-layout.ts';
import {seededNoise} from './vfx-geometry.ts';
import type {Vec} from '../../../packages/contracts/index.ts';
export type SnowSample={ground:FxPoint;position:FxPoint;trail:FxPoint;phase:number;size:number;opacity:number};
/** Deterministic cosmetic snowfall. Landing points stay inside the real circular zone. */
export function blizzardSnow(center:Vec,radius:number,seconds:number,seed:number,count:number,reduced=false):SnowSample[]{
 return Array.from({length:count},(_,i)=>{const n=seed*173+i*97,a=seededNoise(n)*Math.PI*2,r=Math.sqrt(seededNoise(n+11))*radius*.91,ground=projectFx({x:center.x+Math.cos(a)*r,y:center.y+Math.sin(a)*r});
  const period=.45+seededNoise(n+23)*.45,phase=reduced?.5:(Math.max(0,seconds)/period+seededNoise(n+41))%1,height=120+seededNoise(n+53)*100;
  const gust=reduced?0:Math.sin(seconds*3.1+seed*.17)*.5+.5;
  const drift=reduced?0:(1-phase)*(38+seededNoise(n+67)*40+gust*35)+Math.sin(seconds*2.8+n)*10;
  const position={x:ground.x-drift,y:ground.y-height*(1-phase)},length=reduced?0:9+seededNoise(n+83)*11;
  return {ground,position,trail:{x:position.x-length*.55,y:position.y-length},phase,size:2.5+seededNoise(n+79)*3,opacity:Math.min(1,phase*7,(1-phase)*6)};
 });
}
