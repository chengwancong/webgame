import type Phaser from 'phaser';
import {arcPoints,seededNoise} from './vfx-geometry.ts';
import {line,polygon} from './vfx-drawing.ts';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
import type {EnemyFlightStyle} from './enemy-vfx-style.ts';
import {paintCircleTelegraph,paintBeamTelegraph} from './telegraph-polish.ts';
type G=Phaser.GameObjects.Graphics;type P={x:number;y:number};
export function enemyCircleWarning(g:G,center:P,radius:number,clock:number,started:number,ends:number,profile:SkillVfxProfile,reduced:boolean){
 return paintCircleTelegraph(g,center,radius,clock,started,ends,profile,reduced);
}
export function enemyBeamWarning(g:G,points:P[],clock:number,started:number,ends:number,reduced:boolean){
 paintBeamTelegraph(g,points,clock,started,ends,reduced);
}
export function taperedEnemyTrail(g:G,points:P[],width:number,profile:SkillVfxProfile){
 if(points.length<2)return;const left:P[]=[],right:P[]=[],c=vfxPalettes[profile.element];
 for(let i=0;i<points.length;i++){const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,l=Math.hypot(dx,dy)||1,w=width*(i/(points.length-1))**1.5;
  left.push({x:points[i].x-dy/l*w,y:points[i].y+dx/l*w});right.push({x:points[i].x+dy/l*w,y:points[i].y-dx/l*w});}
 polygon(g,[...left,...right.reverse()],c.dark,.4);polygon(g,[...left.map((p,i)=>({x:(p.x+points[i].x)/2,y:(p.y+points[i].y)/2})),...right.map((p,i)=>{const q=points[points.length-1-i];return {x:(p.x+q.x)/2,y:(p.y+q.y)/2};})],c.main,.55);line(g,points,1.5,c.light,.5);
}
export function enemyFlightBody(g:G,point:P,angle:number,style:EnemyFlightStyle,profile:SkillVfxProfile,clock:number,reduced:boolean){
 const base=vfxPalettes[profile.element],c=style.body==='bone'?{dark:base.dark,main:base.light,light:vfxPalettes.steel.light}:base,at=(x:number,y:number)=>({x:point.x+Math.cos(angle)*x-Math.sin(angle)*y,y:point.y+Math.sin(angle)*x+Math.cos(angle)*y}),L=style.length,W=style.width;
 if(style.body==='ice'){
  const shape=[at(0,0),at(-L*.63,-W*.5),at(-L,W*.05),at(-L*.68,W*.5)];polygon(g,shape,c.dark);line(g,shape,2,c.dark,1,true);polygon(g,[at(0,0),at(-L*.63,-W*.5),at(-L*.62,0),at(-L*.95,0)],c.light);polygon(g,[at(0,0),at(-L*.62,0),at(-L,W*.05),at(-L*.68,W*.5)],c.main);line(g,[at(-L*.85,0),at(0,0)],1.5,c.light,.9);
 }else if(style.body==='bone'){
  const shape=[at(0,0),at(-L*.2,-W*.5),at(-L*.8,-W*.3),at(-L*.88,-W*.6),at(-L,-W*.2),at(-L,W*.4),at(-L*.8,W*.5),at(-L*.72,W*.22),at(-L*.2,W*.45)];polygon(g,shape,c.dark);line(g,shape,3,c.dark,1,true);polygon(g,shape,c.main);line(g,[at(-L*.85,-W*.1),at(-L*.25,-W*.15),at(-L*.05,0)],2,c.light,.95);
 }else if(style.body==='void'){
  const center=at(-W*.5,0),r=W*.5;g.fillStyle(c.dark).fillCircle(center.x,center.y,r+2);g.fillStyle(c.main).fillCircle(center.x,center.y,r);g.fillStyle(c.dark,.85).fillCircle(center.x-2,center.y+2,r*.63);g.fillStyle(c.light,.9).fillEllipse(center.x+r*.3,center.y-r*.3,r*.55,r*.75);
  for(let i=0;i<(reduced?2:3);i++){const a=i*Math.PI*2/3+(reduced?0:clock*.14),points=arcPoints(center.x,center.y,r+5,r+3,a,a+1.2,7);line(g,points,2,c.main,.85);}
 }
 if(!reduced&&style.body!=='source')for(let i=0;i<3;i++){const phase=(clock/8+seededNoise(i*37+profile.variant))%1,p=at(-L*.4-phase*L*.6,Math.sin(i*2.1)*W*.8);g.fillStyle(c.light,(1-phase)*.7).fillCircle(p.x,p.y,1.5*(1-phase));}
}
