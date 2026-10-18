import type Phaser from 'phaser';
import {drawMotif} from './vfx-motifs.ts';
import {islandEnemyMotif} from './island-enemy-motifs.ts';
import {arcPoints,seededNoise} from './vfx-geometry.ts';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
type P={x:number;y:number};type G=Phaser.GameObjects.Graphics;
export function line(g:G,points:P[],width:number,color:number,alpha=1,close=false){if(points.length<2)return;g.lineStyle(width,color,Math.max(0,Math.min(1,alpha))).beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);if(close)g.closePath();g.strokePath();}
export function polygon(g:G,points:P[],color:number,alpha=1){if(points.length<3)return;g.fillStyle(color,Math.max(0,Math.min(1,alpha))).beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath().fillPath();}
export function ribbon(g:G,points:P[],width:number,p:SkillVfxProfile,alpha=1){const c=vfxPalettes[p.element];line(g,points,width+3,c.dark,alpha*.7);line(g,points,width,c.main,alpha);line(g,points,Math.max(1,width*.25),c.light,alpha*.9);}
export function lightning(g:G,from:P,to:P,p:SkillVfxProfile,phase:number,seed:number,alpha=1){const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,count=Math.max(3,Math.ceil(length/24));const points=Array.from({length:count+1},(_,i)=>{const noise=i===0||i===count?0:(seededNoise(seed+i*19+Math.floor(phase/2)*37)-.5)*15;return {x:from.x+dx*i/count-dy/length*noise,y:from.y+dy*i/count+dx/length*noise};});ribbon(g,points,5,p,alpha);}
export function ring(g:G,point:P,rx:number,ry:number,p:SkillVfxProfile,alpha:number,phase=0){const c=vfxPalettes[p.element];g.fillStyle(c.dark,.09*alpha).fillEllipse(point.x,point.y,rx*2,ry*2);g.lineStyle(3,c.dark,.5*alpha).strokeEllipse(point.x,point.y,rx*2,ry*2);g.lineStyle(1.5,c.main,.9*alpha).strokeEllipse(point.x,point.y,rx*2,ry*2);const n=4+p.variant%5;for(let i=0;i<n;i++){const a=i/n*Math.PI*2+phase;line(g,arcPoints(point.x,point.y,rx*.88,ry*.88,a,a+.2,3),2,c.light,alpha*.6);}}
export function sparks(g:G,point:P,p:SkillVfxProfile,t:number,seed:number,count=7){const c=vfxPalettes[p.element];for(let i=0;i<count;i++){const angle=seededNoise(seed+i*17)*Math.PI*2,d=8+t*(15+seededNoise(seed+i*11)*35),x=point.x+Math.cos(angle)*d,y=point.y+Math.sin(angle)*d*.65-t*t*8;g.fillStyle(i%3?c.main:c.light,(1-t)*.85);g.fillTriangle(x,y-3*(1-t),x-2*(1-t),y+3*(1-t),x+3*(1-t),y+1);}}
export function sigil(g:G,point:P,p:SkillVfxProfile,size:number,t:number,alpha=1){if(drawMotif(g,point,p,size,t,alpha,vfxPalettes[p.element]))return;if(islandEnemyMotif(g,point,p,size,t,alpha))return;const c=vfxPalettes[p.element];
 if(['wings','feathers','leaves','buds'].includes(p.motif)){
  for(const side of [-1,1])for(let i=0;i<4;i++){const a=i*.19;line(g,[point,{x:point.x+side*size*(.55+a),y:point.y-size*(.25+i*.07)},{x:point.x+side*size*(.32+a),y:point.y+size*.1}],3,c.main,alpha*(.9-i*.13));}return;
 }
 if(['clock','orbit','ritual'].includes(p.motif)){
  g.lineStyle(2,c.main,alpha).strokeEllipse(point.x,point.y,size*2,size*1.12);
  if(p.motif==='clock'){line(g,[{x:point.x,y:point.y-size*.4},point,{x:point.x+size*.5,y:point.y+size*.12}],2,c.light,alpha);for(let i=0;i<12;i++){const a=i*Math.PI/6;line(g,[{x:point.x+Math.cos(a)*size*.85,y:point.y+Math.sin(a)*size*.48},{x:point.x+Math.cos(a)*size,y:point.y+Math.sin(a)*size*.56}],2,c.main,alpha);}}
  else for(let i=0;i<3;i++){const a=t+i*Math.PI*2/3;line(g,arcPoints(point.x,point.y,size*.8,size*.42,a,a+1.6),3,c.light,alpha*.65);}return;
 }
 if(['seal','hexagon','buckler','shell'].includes(p.motif)){
  const shape=[{x:point.x-size*.6,y:point.y-size*.3},{x:point.x,y:point.y-size*.52},{x:point.x+size*.6,y:point.y-size*.3},{x:point.x+size*.44,y:point.y+size*.22},{x:point.x,y:point.y+size*.55},{x:point.x-size*.44,y:point.y+size*.22}];polygon(g,shape,c.dark,alpha*.12);line(g,shape,2,c.main,alpha,true);line(g,[{x:point.x-size*.35,y:point.y}, {x:point.x+size*.35,y:point.y}],2,c.light,alpha);return;
 }
 if(['teeth','fangs','skull','thorns'].includes(p.motif)){
  for(let i=0;i<5;i++){const x=point.x+(i-2)*size*.35,y=point.y+Math.abs(i-2)*size*.08;polygon(g,[{x:x-size*.09,y:y-size*.24},{x:x+size*.09,y:y-size*.24},{x,y:y+size*(i%2?.26:.4)}],c.main,alpha*.8);}return;
 }
 if(p.motif==='vines'){
  for(let i=0;i<4;i++){const a=t*.2+i*Math.PI/2;const points=arcPoints(point.x+Math.cos(a)*size*.3,point.y+Math.sin(a)*size*.2,size*.65,size*.3,a,a+Math.PI*1.4);line(g,points,4,c.dark,alpha);line(g,points,2,c.main,alpha);const last=points.at(-1)!;g.fillStyle(c.main,alpha).fillEllipse(last.x,last.y,9,5);}return;
 }
 if(p.motif==='rays'||p.motif==='soundwaves'){
  for(let i=0;i<8;i++){const a=i*Math.PI/4;line(g,[{x:point.x+Math.cos(a)*size*.4,y:point.y+Math.sin(a)*size*.23},{x:point.x+Math.cos(a)*size,y:point.y+Math.sin(a)*size*.56}],i%2?2:4,c.main,alpha);}return;
 }
 const n=p.motif==='hexagon'?6:p.motif==='cross'?4:3+p.variant%5,phase=p.motif==='clock'?0:t*.35;const vertices=Array.from({length:n},(_,i)=>({x:point.x+Math.cos(i/n*Math.PI*2+phase)*size,y:point.y+Math.sin(i/n*Math.PI*2+phase)*size*.56}));line(g,vertices,2,c.main,alpha,true);for(let i=0;i<n;i+=2)line(g,[vertices[i],point],1,c.light,alpha*.5);}
