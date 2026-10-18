import type Phaser from 'phaser';
import {resolvedToken,type TokenName} from '../../ui/tokens.ts';
import {arcPoints,groundSize,seededNoise} from '../../vfx-geometry.ts';
import {line} from '../../vfx-drawing.ts';
import {warningPhase} from '../../enemy-vfx-style.ts';
import {vfxPalettes,type SkillVfxProfile} from '../../vfx-profiles.ts';
type P={x:number;y:number};type G=Phaser.GameObjects.Graphics;
const color=(name:TokenName)=>parseInt(resolvedToken(name).slice(1),16);
export const telegraphColors={edge:color('Color.Combat.WarningEdge'),fill:color('Color.Combat.WarningFill'),timer:color('Color.Combat.WarningTimer'),dark:color('Color.Combat.WarningOutline')};
export const telegraphSurfaceKey='telegraph-soft-surface';
/** UI material, not an authored spell: a cached distance gradient projected onto the real circle. */
export function ensureTelegraphSurface(scene:Phaser.Scene){
 if(scene.textures.exists(telegraphSurfaceKey))return;
 const texture=scene.textures.createCanvas(telegraphSurfaceKey,256,256)!;const c=texture.context;
 const gradient=c.createRadialGradient(128,128,0,128,128,124);
 for(const [stop,alpha]of [[0,.12],[.65,.12],[.84,.18],[.94,.44],[.98,.25],[1,0]])gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
 c.fillStyle=gradient;c.fillRect(0,0,256,256);texture.refresh();
}
export function circleTelegraphGeometry(center:P,radius:number,progress:number){
 const d=groundSize(radius),steps=Math.min(128,Math.max(48,Math.ceil(d.width/4))),rx=d.width/2,ry=d.height/2,end=-Math.PI/2+Math.max(0,Math.min(1,progress))*Math.PI*2;
 return {d,steps,rx,ry,end,tip:{x:center.x+Math.cos(end)*rx*.92,y:center.y+Math.sin(end)*ry*.92},edge:arcPoints(center.x,center.y,rx,ry,0,Math.PI*2,steps)};
}
export function paintCircleTelegraph(g:G,center:P,radius:number,clock:number,started:number,ends:number,profile:SkillVfxProfile,reduced:boolean){
 const q=warningPhase(clock,started,ends),geo=circleTelegraphGeometry(center,radius,q.progress),c=telegraphColors,element=vfxPalettes[profile.element];
 const breathe=reduced?0:(.5+.5*Math.sin(clock*.35))*(q.urgent?.12:.035);
 // Soft light supports the exact 2px rim; neither light nor decoration defines the hit radius.
 for(const [width,alpha]of [[16,.08],[10,.16],[6,.23]])line(g,geo.edge,width,c.edge,alpha+breathe*.25,true);
 line(g,geo.edge,3,c.dark,.28,true);line(g,geo.edge,2,c.edge,.96,true);
 if(q.progress>0){const segments=Math.max(1,Math.ceil(q.progress*8));for(let i=0;i<segments;i++){
  const start=-Math.PI/2+q.progress*Math.PI*2*i/segments,end=-Math.PI/2+q.progress*Math.PI*2*(i+1)/segments;
  line(g,arcPoints(center.x,center.y,geo.rx*.92,geo.ry*.92,start,end,Math.max(2,Math.ceil(geo.steps*q.progress/segments))),6,c.timer,.07);
  line(g,arcPoints(center.x,center.y,geo.rx*.92,geo.ry*.92,start,end,Math.max(2,Math.ceil(geo.steps*q.progress/segments))),4,c.timer,.3+.65*(i+1)/segments);
 }}
 // Sparse authored-looking fragments remain in the inner band, leaving the character clear.
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+profile.variant*.17,x=center.x+Math.cos(a)*geo.rx*.84,y=center.y+Math.sin(a)*geo.ry*.84;
  const drift=reduced?0:Math.sin(clock*.08+i)*2,alpha=.16+.14*q.progress;
  line(g,[{x:x-3,y:y-2+drift},{x:x+2,y:y+1+drift},{x:x+3,y:y+5+drift}],1.3,element.main,alpha);
 }
 if(!reduced)for(let i=0;i<4;i++){const t=((clock-started)/30+seededNoise(profile.variant+i*53))%1,a=i*Math.PI/2+.4,r=.7+t*.19;
  g.fillStyle(c.timer,(1-t)*.25*q.opening).fillCircle(center.x+Math.cos(a)*geo.rx*r,center.y+Math.sin(a)*geo.ry*r,1.4);
 }
 return q.progress>0&&q.progress<1?{point:geo.tip,alpha:reduced?.7:.8+breathe}:undefined;
}
export function paintBeamTelegraph(g:G,points:P[],clock:number,started:number,ends:number,reduced:boolean){
 const q=warningPhase(clock,started,ends),c=telegraphColors;
 // Same soft material and fine rim, with true beam footprint instead of a circular approximation.
 g.fillStyle(c.fill,.08+q.progress*.035).beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath().fillPath();
 for(const [width,alpha]of [[10,.035],[6,.07]])line(g,points,width,c.edge,alpha,true);
 line(g,points,3,c.dark,.28,true);line(g,points,2,c.edge,.96,true);
 const interpolate=(a:P,b:P,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 line(g,[interpolate(points[0],points[1],q.progress),interpolate(points[3],points[2],q.progress)],3,c.timer,.85);
 const origin={x:(points[0].x+points[3].x)/2,y:(points[0].y+points[3].y)/2},end={x:(points[1].x+points[2].x)/2,y:(points[1].y+points[2].y)/2};
 const length=Math.hypot(end.x-origin.x,end.y-origin.y)||1,dx=(end.x-origin.x)/length,dy=(end.y-origin.y)/length,count=Math.min(12,Math.max(4,Math.ceil(length/130)));
 for(let i=0;i<count;i++){const t=(i/count+(reduced?0:(clock-started)/(100*count)))%1,mid=interpolate(origin,end,t),half={x:(points[3].x-points[0].x)*.18,y:(points[3].y-points[0].y)*.18},back={x:mid.x-dx*16,y:mid.y-dy*16};
  line(g,[{x:back.x-half.x,y:back.y-half.y},mid,{x:back.x+half.x,y:back.y+half.y}],1.5,c.timer,q.urgent?.7:.35);
 }
}
