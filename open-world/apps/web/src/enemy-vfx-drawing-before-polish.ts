import type Phaser from 'phaser';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {groundSize,arcPoints,seededNoise} from './vfx-geometry.ts';
import {line,polygon} from './vfx-drawing.ts';
import {vfxPalettes,type SkillVfxProfile} from './vfx-profiles.ts';
import {warningPhase,type EnemyFlightStyle} from './enemy-vfx-style.ts';
type G=Phaser.GameObjects.Graphics;type P={x:number;y:number};
const color=(name:TokenName)=>parseInt(resolvedToken(name).slice(1),16);
const danger={fill:color('Color.Combat.WarningFill'),edge:color('Color.Combat.WarningEdge'),light:color('Color.Combat.WarningHighlight'),dark:color('Color.Combat.WarningOutline')};
export function enemyCircleWarning(g:G,center:P,radius:number,clock:number,started:number,ends:number,profile:SkillVfxProfile,reduced:boolean){
 const d=groundSize(radius),rx=d.width/2,ry=d.height/2,q=warningPhase(clock,started,ends),c=vfxPalettes[profile.element];
 const pulse=reduced?0:(.5+.5*Math.sin(clock*(q.urgent?.85:.22)))*(q.urgent?.22:.06);
 // The fixed outer edge is the true hit boundary from the first frame. Animation stays inside it.
 g.fillStyle(danger.dark,.2).fillEllipse(center.x,center.y,d.width,d.height);
 g.fillStyle(danger.fill,.1+q.progress*.1+pulse*.2).fillEllipse(center.x,center.y,d.width,d.height);
 const edge=arcPoints(center.x,center.y,rx,ry,-Math.PI/2,Math.PI*1.5,64);
 line(g,edge,6,danger.dark,.85,true);line(g,edge,2.5,danger.edge,.85+pulse,true);
 if(q.progress>0)line(g,arcPoints(center.x,center.y,rx*.955,ry*.955,-Math.PI/2,-Math.PI/2+q.progress*Math.PI*2,Math.max(2,Math.ceil(q.progress*64))),2.5,danger.light,.92);
 const sweep=reduced?q.progress:(clock-started)%24/24,inner=.82-(sweep*.32);
 line(g,arcPoints(center.x,center.y,rx*inner,ry*inner,0,Math.PI*2,40),1.5,danger.edge,(reduced?.28:(1-sweep)*.38)*q.opening);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=center.x+Math.cos(a)*rx*.9,y=center.y+Math.sin(a)*ry*.9;
  const tip={x:center.x+Math.cos(a)*rx*.81,y:center.y+Math.sin(a)*ry*.81},side={x:-Math.sin(a)*4,y:Math.cos(a)*2.25};
  polygon(g,[{x:x+side.x,y:y+side.y},tip,{x:x-side.x,y:y-side.y}],i/8<q.progress?danger.light:danger.edge,q.urgent?.95:.65);
 }
 // Attribute sits below the common danger code; a small emblem is readable without filling the zone.
 g.fillStyle(danger.dark,.62).fillEllipse(center.x,center.y,28,16);
 const s=9,shape=[{x:center.x,y:center.y-s*.65},{x:center.x+s*.7,y:center.y},{x:center.x,y:center.y+s*.65},{x:center.x-s*.7,y:center.y}];
 polygon(g,shape,c.main,.75);line(g,[{x:center.x,y:center.y-3},{x:center.x,y:center.y+1}],2,danger.light,.95);g.fillStyle(danger.light,.95).fillCircle(center.x,center.y+4,1.3);
}
export function enemyBeamWarning(g:G,points:P[],clock:number,started:number,ends:number,reduced:boolean){
 const q=warningPhase(clock,started,ends),origin={x:(points[0].x+points[3].x)/2,y:(points[0].y+points[3].y)/2},end={x:(points[1].x+points[2].x)/2,y:(points[1].y+points[2].y)/2};
 polygon(g,points,danger.dark,.2);polygon(g,points,danger.fill,.12+q.progress*.13);line(g,points,6,danger.dark,.85,true);line(g,points,2.5,danger.edge,.95,true);
 const left={x:points[0].x+(points[1].x-points[0].x)*q.progress,y:points[0].y+(points[1].y-points[0].y)*q.progress},right={x:points[3].x+(points[2].x-points[3].x)*q.progress,y:points[3].y+(points[2].y-points[3].y)*q.progress};
 line(g,[left,right],3,danger.light,.9);
 const count=Math.min(14,Math.max(6,Math.ceil(Math.hypot(end.x-origin.x,end.y-origin.y)/90)));
 for(let i=0;i<count;i++){const t=(i/count+(reduced?0:(clock-started)/(90*count)))%1,mid={x:origin.x+(end.x-origin.x)*t,y:origin.y+(end.y-origin.y)*t};
  const half={x:(points[3].x-points[0].x)*.28,y:(points[3].y-points[0].y)*.28},back={x:mid.x-(end.x-origin.x)*.045,y:mid.y-(end.y-origin.y)*.045};
  const arrow=[{x:back.x-half.x,y:back.y-half.y},mid,{x:back.x+half.x,y:back.y+half.y}];line(g,arrow,5,danger.dark,q.urgent?.8:.45);line(g,arrow,2.5,danger.light,q.urgent?.95:.55);
 }
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
