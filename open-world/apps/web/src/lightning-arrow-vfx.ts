import {seededNoise} from './vfx-geometry.ts';
import type {FxPoint} from './skill-fx-layout.ts';

/** Short local discharge branches, never a target-to-caster beam or a ground strike. */
export function lightningDischarge(point:FxPoint,progress:number,seed:number,reduced:boolean){
 const t=Math.max(0,Math.min(1,progress)),count=reduced?3:7,radius=12+28*t;
 return Array.from({length:count},(_,i)=>{
  const angle=i/count*Math.PI*2+seededNoise(seed+71)*.8,length=radius*(.65+seededNoise(seed+i*13)*.35),nx=-Math.sin(angle),ny=Math.cos(angle),bend=(seededNoise(seed+i*23)-.5)*9;
  const at=(distance:number,offset=0)=>({x:point.x+Math.cos(angle)*distance+nx*offset,y:point.y+Math.sin(angle)*distance+ny*offset});
  return [at(3),at(length*.38,bend),at(length*.65,-bend*.35),at(length)];
 });
}
