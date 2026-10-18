import type Phaser from 'phaser';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {arcPoints,groundSize} from './vfx-geometry.ts';
import {line,polygon} from './vfx-drawing.ts';
import {warningPhase} from './enemy-vfx-style.ts';
import type {SkillVfxProfile} from './vfx-profiles.ts';
type P={x:number;y:number};type G=Phaser.GameObjects.Graphics;
const color=(name:TokenName)=>parseInt(resolvedToken(name).slice(1),16);
export const telegraphColors={edge:color('Color.Combat.WarningEdge'),fill:color('Color.Combat.WarningFill'),timer:color('Color.Combat.WarningTimer'),light:color('Color.Combat.WarningHighlight'),dark:color('Color.Combat.WarningOutline')};
export const telegraphSurfaceKey='telegraph-soft-surface';
export const telegraphFloorKey='telegraph-v2-floor';
export const telegraphFrontKey='telegraph-v2-front';
const radial=(scene:Phaser.Scene,key:string,size:number,stops:[number,number][])=>{
 if(scene.textures.exists(key))return;const texture=scene.textures.createCanvas(key,size,size)!,c=texture.context,h=size/2;
 const gradient=c.createRadialGradient(h,h,0,h,h,h-2);for(const [stop,alpha]of stops)gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
 c.fillStyle=gradient;c.fillRect(0,0,size,size);texture.refresh();
};
/** UI materials, not authored spells: cached distance gradients projected onto the real circle. */
export function ensureTelegraphSurface(scene:Phaser.Scene){
 radial(scene,telegraphSurfaceKey,256,[[0,.12],[.65,.12],[.84,.18],[.94,.44],[.98,.25],[1,0]]);
 // Floor: nearly clear centre so the character stays readable, light gathering toward the rim.
 radial(scene,telegraphFloorKey,512,[[0,.06],[.55,.09],[.8,.18],[.92,.38],[.975,.6],[1,0]]);
 // Countdown front: soft body with a bright leading edge; scaled by real remaining ticks.
 radial(scene,telegraphFrontKey,512,[[0,.45],[.6,.5],[.85,.62],[.94,.85],[.985,1],[1,0]]);
}
export function circleTelegraphGeometry(center:P,radius:number,progress:number){
 const d=groundSize(radius),steps=Math.min(128,Math.max(48,Math.ceil(d.width/4))),rx=d.width/2,ry=d.height/2,end=-Math.PI/2+Math.max(0,Math.min(1,progress))*Math.PI*2;
 return {d,steps,rx,ry,end,tip:{x:center.x+Math.cos(end)*rx*.92,y:center.y+Math.sin(end)*ry*.92},edge:arcPoints(center.x,center.y,rx,ry,0,Math.PI*2,steps)};
}
/** Shared timing for every telegraph layer: fade in, steady build, then a short urgent blink before impact. */
export function telegraphPulse(clock:number,started:number,ends:number,reduced:boolean){
 const q=warningPhase(clock,started,ends),blink=q.urgent&&!reduced?.5+.5*Math.cos(clock*1.3):q.urgent?1:0;
 return {...q,blink,floor:q.opening*(.7+.3*q.progress)+blink*.15,front:Math.max(.04,q.progress),frontAlpha:q.opening*(.75+.25*q.progress)+blink*.2};
}
export function paintCircleTelegraph(g:G,center:P,radius:number,clock:number,started:number,ends:number,_profile:SkillVfxProfile,reduced:boolean){
 const q=telegraphPulse(clock,started,ends,reduced),geo=circleTelegraphGeometry(center,radius,q.progress),c=telegraphColors,o=q.opening;
 // Exact boundary is fully visible from the first tick: outer bloom, dark hairline for snow/light ground, crisp rim, and a white blink before impact.
 for(const [width,alpha]of [[14,.07],[8,.14]])line(g,geo.edge,width,c.edge,(alpha+q.blink*.08)*o,true);
 line(g,geo.edge,4,c.dark,.32,true);line(g,geo.edge,2.5,c.edge,1,true);if(q.blink>0)line(g,geo.edge,1.2,c.light,q.blink*.9,true);
 // Inner dashed ring turns slowly; it decorates the inside and never extends the hit area.
 const dashes=Math.max(12,Math.min(28,Math.round(geo.rx/9))),spin=reduced?0:(clock-started)*.012;
 for(let i=0;i<dashes;i++){const a=spin+i*Math.PI*2/dashes;line(g,arcPoints(center.x,center.y,geo.rx*.88,geo.ry*.88,a,a+Math.PI*2/dashes*.55,4),1.6,c.edge,(.3+.3*q.progress)*o);}
 // Wavefront: reaches the rim on the impact tick.
 if(q.progress>.02){const wave=arcPoints(center.x,center.y,geo.rx*q.progress,geo.ry*q.progress,0,Math.PI*2,Math.max(24,Math.ceil(geo.steps*q.progress)));
  line(g,wave,7,c.edge,.22*o,true);line(g,wave,2,c.light,(.55+.4*q.progress)*o,true);}
 return q;
}
export function paintBeamTelegraph(g:G,points:P[],clock:number,started:number,ends:number,reduced:boolean){
 const q=telegraphPulse(clock,started,ends,reduced),c=telegraphColors,o=q.opening,lerp=(a:P,b:P,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 // Floor of the true footprint, then the countdown fill sweeping from the mouth to the far end.
 polygon(g,points,c.edge,(.1+q.blink*.06)*o);
 const a=lerp(points[0],points[1],q.progress),b=lerp(points[3],points[2],q.progress);
 polygon(g,[points[0],a,b,points[3]],c.edge,(.16+.12*q.progress+q.blink*.08)*o);
 for(const [width,alpha]of [[12,.06],[7,.12]])line(g,points,width,c.edge,alpha*o,true);
 line(g,points,4,c.dark,.32,true);line(g,points,2.5,c.edge,1,true);if(q.blink>0)line(g,points,1.2,c.light,q.blink*.9,true);
 if(q.progress>.02){line(g,[a,b],7,c.edge,.25*o);line(g,[a,b],2,c.light,(.55+.4*q.progress)*o);}
 // Arrows flow toward the far end inside the footprint only.
 const origin=lerp(points[0],points[3],.5),end=lerp(points[1],points[2],.5),length=Math.hypot(end.x-origin.x,end.y-origin.y)||1,dx=(end.x-origin.x)/length,dy=(end.y-origin.y)/length,count=Math.min(12,Math.max(4,Math.ceil(length/120)));
 const half={x:(points[3].x-points[0].x)*.16,y:(points[3].y-points[0].y)*.16};
 for(let i=0;i<count;i++){const t=(i/count+(reduced?0:(clock-started)/(90*count)))%1,mid=lerp(origin,end,t),back={x:mid.x-dx*14,y:mid.y-dy*14},fade=Math.min(1,t*6,(1-t)*6);
  line(g,[{x:back.x-half.x,y:back.y-half.y},mid,{x:back.x+half.x,y:back.y+half.y}],2,t<q.progress?c.light:c.timer,(q.urgent?.75:.45)*fade*o);
 }
 return q;
}
