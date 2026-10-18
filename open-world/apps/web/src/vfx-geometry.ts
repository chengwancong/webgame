import type {Vec} from '../../../packages/contracts/index.ts';
import {projectFx} from './skill-fx-layout.ts';
export const groundSize=(radius:number)=>({width:radius*Math.SQRT2*64,height:radius*Math.SQRT2*36});
export function beamFootprint(origin:Vec,target:Vec,halfWidth:number,reach:number){const d=Math.hypot(target.x-origin.x,target.y-origin.y)||1,dx=(target.x-origin.x)/d,dy=(target.y-origin.y)/d;return [[-dy*halfWidth,dx*halfWidth],[dx*reach-dy*halfWidth,dy*reach+dx*halfWidth],[dx*reach+dy*halfWidth,dy*reach-dx*halfWidth],[dy*halfWidth,-dx*halfWidth]].map(([x,y])=>projectFx({x:origin.x+x,y:origin.y+y}));}
export function seededNoise(seed:number){let n=Math.imul(seed^0x45d9f3b,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
export function arcPoints(x:number,y:number,rx:number,ry:number,start:number,end:number,steps=20){return Array.from({length:steps+1},(_,i)=>{const a=start+(end-start)*i/steps;return {x:x+Math.cos(a)*rx,y:y+Math.sin(a)*ry};});}
