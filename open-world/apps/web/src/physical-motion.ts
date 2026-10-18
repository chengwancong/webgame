import {physicalSpecs} from './physical-vfx-spec.ts';
/** Pixel offsets only: never receives or writes a World/actor position. */
export function physicalBodyMotion(skill:string,age:number,windup:number,direction:{x:number;y:number},reduced:boolean){
 const spec=physicalSpecs[skill];if(reduced||!spec)return {x:0,y:0,groundY:0};
 const jump=spec.jump&&age>=0&&age<windup?Math.sin(Math.PI*age/Math.max(1,windup))*spec.jump:0;
 const lunge=spec.form==='dash'?0:age>=windup&&age<windup+6?spec.lunge*(1-(age-windup)/6)**2:0;
 const d=Math.hypot(direction.x,direction.y)||1,x=direction.x/d*lunge,groundY=direction.y/d*lunge;return {x,y:groundY-jump,groundY};
}
