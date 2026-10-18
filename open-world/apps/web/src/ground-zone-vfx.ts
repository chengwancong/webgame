import type {Vec} from '../../../packages/contracts/index.ts';
import {projectFx,type FxPoint} from './skill-fx-layout.ts';
import {seededNoise} from './vfx-geometry.ts';
import type Phaser from 'phaser';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
import {drawMotif} from './vfx-motifs.ts';

export function drawGroundMotif(g:Phaser.GameObjects.Graphics,center:FxPoint,p:SkillVfxProfile,width:number,age:number,alpha:number,reduced:boolean){return drawMotif(g,center,p,width*.32,age,alpha,vfxPalettes[p.element],reduced);}

export type GroundZoneStyle='vortex'|'starfall'|'arrows'|'pulse';
export function groundZoneStyle(motif:string):GroundZoneStyle{
 if(['spiral','orbit'].includes(motif))return 'vortex';
 if(motif==='starfall')return 'starfall';
 if(motif==='falling-arrows')return 'arrows';
 return 'pulse';
}
/** Ground geometry only: no projectile clips, damage, random draws or actor anchors. */
export function groundZoneGeometry(center:Vec,radius:number,age:number,seed:number,style:GroundZoneStyle,reduced=false){
 const time=reduced?0:Math.max(0,age),point=(r:number,a:number)=>projectFx({x:center.x+Math.cos(a)*r*radius,y:center.y+Math.sin(a)*r*radius});
 const strands:FxPoint[][]=[];
 if(style==='vortex')for(let arm=0;arm<3;arm++)strands.push(Array.from({length:28},(_,i)=>{const u=i/27;return point(.12+.74*u,arm*Math.PI*2/3-time*.8+u*Math.PI*1.35);}));
 const pulses=Array.from({length:reduced?1:2},(_,i)=>{const phase=(time*.35+i*.5)%1;return {radius:style==='vortex'?.82-.68*phase:.18+.64*phase,alpha:Math.sin(Math.PI*phase)*.3+.06};});
 const drops=style==='starfall'||style==='arrows'?Array.from({length:reduced?3:9},(_,i)=>{
  const phase=(time*.8+seededNoise(seed+i*37))%1,ground=point(Math.sqrt(seededNoise(seed+i*19))*.78,i*2.39996);
  return {ground,position:{x:ground.x,y:ground.y-(1-phase)*Math.max(100,radius*42)},alpha:Math.sin(Math.PI*phase)*.8};
 }):[];
 return {strands,pulses,drops};
}
