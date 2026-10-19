// 传送/落地点被 NPC、箱子、铁砧等实体压住时，挪到最近的可走格（Grok：岛心索、沉星弥迦落点卡进实体）。
import {walkable} from '../../../packages/simulation/navigation.ts';
import {bodyCollision,type Region} from '../../../packages/content/index.ts';
type Point={x:number;y:number};
/** 原点可走就原样返回；否则按 0.5 格一圈向外找，每圈 16 个方向，找不到返回原点。 */
export function nearestWalkable(region:Region,p:Point,maxRadius=6,pad=bodyCollision.heroRadius):Point{
 if(walkable(region,p,pad))return {...p};
 for(let r=.5;r<=maxRadius+1e-9;r+=.5)for(let i=0;i<16;i++){const a=i/16*Math.PI*2,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(walkable(region,q,pad))return q;}
 return {...p};
}
