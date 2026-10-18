import type Phaser from 'phaser';
import type {SkillVfxProfile} from './vfx-profiles.ts';
import {vfxPalettes} from './vfx-profiles.ts';
/** New island skills use their literal geometry, including a static keyframe. */
export function islandEnemyMotif(g:Phaser.GameObjects.Graphics,q:{x:number;y:number},p:SkillVfxProfile,r:number,t:number,a:number){
 if(!p.key.includes('/island_'))return false;
 const c=vfxPalettes[p.element],path=(pts:number[][],w=2)=>{g.lineStyle(w,c.main,a).beginPath().moveTo(q.x+pts[0][0]*r,q.y+pts[0][1]*r);for(const [x,y]of pts.slice(1))g.lineTo(q.x+x*r,q.y+y*r);g.strokePath();},circle=(x:number,y:number,s:number)=>g.lineStyle(2,c.light,a).strokeCircle(q.x+x*r,q.y+y*r,s*r);
 switch(p.motif){
 case 'streak':for(let i=0;i<3;i++)path([[-1+i*.35,.12*i],[.4+i*.35,.12*i]],3-i);break;
 case 'spear':case 'ember-arrow':path([[-1,0],[1,0],[.65,-.2],[1,0],[.65,.2]],3);break;
 case 'forks':case 'forked-arrow':path([[-1,0],[0,0],[.8,-.45]]);path([[0,0],[.8,.45]]);break;
 case 'sweep':circle(0,0,1);path([[-.8,.3],[0,.5],[.8,.3]]);break;
 case 'wings':case 'landing':for(const k of [-1,1])path([[0,0],[k*.4,-.7],[k,-.3],[k*.3,.2]]);circle(0,.3,.4);break;
 case 'rune':circle(0,0,1);path([[-.4,-.4],[.4,-.4],[0,.5],[-.4,-.4]]);break;
 case 'buds':for(let i=0;i<4;i++)circle((i-1.5)*.4,Math.sin(i)*.2,.2);break;
 case 'vines':for(const k of [-1,1])path([[k,-.2],[k*.6,.3],[k*.2,-.3],[0,.4]]);break;
 case 'miasma-cloud':case 'toxic-cloud':for(let i=0;i<4;i++)g.lineStyle(3,c.main,a*.65).strokeEllipse(q.x+(i-1.5)*r*.4+Math.sin(t+i)*r*.08,q.y,r*.85,r*.4);break;
 case 'buckler':path([[-.65,-.5],[.65,-.5],[.5,.4],[0,.8],[-.5,.4],[-.65,-.5]],3);break;
 case 'lattice':case 'static-lattice':for(let i=-1;i<=1;i++){path([[-1,i*.4],[1,i*.4]]);path([[i*.4,-.6],[i*.4,.6]]);}break;
 case 'magma-crater':circle(0,0,1);for(let i=-1;i<=1;i++)path([[i*.4,.2],[i*.4+.1,-.5],[i*.4+.2,.2]],3);break;
 case 'flames':for(let i=-1;i<=1;i++)path([[i*.45-.2,.3],[i*.45,-.6-Math.sin(t+i)*.15],[i*.45+.2,.3]],3);break;
 case 'orb':circle(0,0,.65);circle(.2,0,.3);break;
 case 'corroded-cross':case 'heavy-cross':path([[-.7,-.5],[.7,.5]],5);path([[.7,-.5],[-.7,.5]],5);break;
 case 'fangs':case 'spikes':for(let i=-1;i<=1;i++)path([[i*.5-.2,-.5],[i*.5,.5],[i*.5+.2,-.5]],3);break;
 case 'crystal':path([[0,-.8],[.45,0],[0,.8],[-.45,0],[0,-.8],[0,.8]]);break;
 case 'frozen-fissure':case 'staff-fissure':for(let i=0;i<3;i++){const z=i*Math.PI*2/3;path([[0,0],[Math.cos(z)*.5,Math.sin(z)*.3],[Math.cos(z+.2),Math.sin(z+.2)*.6]],3);}break;
 case 'ice-ring':circle(0,0,.6);circle(0,0,1);break;
 case 'needle-triple':for(let i=-1;i<=1;i++)path([[-.8,i*.25],[.8,i*.25]],1.5);break;
 default:throw Error('Unpainted island motif '+p.motif);
 }return true;
}
