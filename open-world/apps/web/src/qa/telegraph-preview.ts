import Phaser from 'phaser';
import {ensureTelegraphSurface,paintCircleTelegraph,paintBeamTelegraph,telegraphFloorKey,telegraphFrontKey,telegraphColors,telegraphSurfaceKey} from '../telegraph-polish.ts';
import * as v1 from './legacy/telegraph-v1.ts';
import {groundSize,beamFootprint} from '../vfx-geometry.ts';
import {vfxProfiles} from '../vfx-profiles.ts';
// Dev-only side-by-side of telegraph v1 (top) and v2 (bottom) at fixed countdown points.
const query=new URLSearchParams(location.search),ground=query.get('ground')??'grass',live=query.has('live'),beam=query.has('beam'),radius=Number(query.get('r')??2);
const columns=[.3,.65,.95];
class Preview extends Phaser.Scene{
 graphics:Phaser.GameObjects.Graphics[]=[];images:Phaser.GameObjects.Image[]=[];
 preload(){this.load.image('ground','/art/environment/handdrawn/'+ground+'.png');this.load.atlas('hero','/art/hero.png','/art/hero.json');this.load.image('tip','/art/telegraph-reuse/tip-glow.png');}
 create(){
  ensureTelegraphSurface(this);this.add.tileSprite(400,225,800,450,'ground').setDepth(-10);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
   const g=this.add.graphics().setDepth(2);this.graphics.push(g);
   for(let i=0;i<3;i++)this.images.push(this.add.image(0,0,'__WHITE').setVisible(false).setDepth(1));
   this.add.image(133+col*266,row*225+112,'hero','idle_0').setScale(.32).setOrigin(.5,.85).setDepth(3);
  }
  this.add.text(6,4,'v1 当前',{fontSize:'13px',color:'#fff',backgroundColor:'#0008'}).setDepth(9);this.add.text(6,229,'v2 重制',{fontSize:'13px',color:'#fff',backgroundColor:'#0008'}).setDepth(9);
 }
 update(time:number){
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
   const index=row*3+col,g=this.graphics[index].clear(),[a,b,c]=this.images.slice(index*3,index*3+3),center={x:133+col*266,y:row*225+120},d=groundSize(radius);
   const clock=live?(time/33)%100:columns[col]*100,profile=vfxProfiles['monster/basic-area'];
   if(beam){const pts=beamFootprint({x:0,y:0},{x:1,y:0},.8,3.6).map(p=>({x:p.x+center.x-90,y:p.y+center.y-10}));if(row===0)v1.paintBeamTelegraph(g,pts,clock,0,100,false);else paintBeamTelegraph(g,pts,clock,0,100,false);continue;}
   if(row===0){a.setVisible(true).setTexture(telegraphSurfaceKey).setPosition(center.x,center.y).setDisplaySize(d.width,d.height).setTint(telegraphColors.fill).setAlpha(.85);
    const tip=v1.paintCircleTelegraph(g,center,radius,clock,0,100,profile,false);c.setVisible(!!tip);if(tip)c.setTexture('tip').setPosition(tip.point.x,tip.point.y).setDisplaySize(18,18).setTint(telegraphColors.timer).setTintMode(Phaser.TintModes.FILL).setAlpha(tip.alpha).setDepth(2.5);}
   else{const q=paintCircleTelegraph(g,center,radius,clock,0,100,profile,false);
    a.setVisible(true).setTexture(telegraphFloorKey).setPosition(center.x,center.y).setDisplaySize(d.width,d.height).setTint(telegraphColors.edge).setAlpha(Math.min(1,q.floor));
    b.setVisible(true).setTexture(telegraphFrontKey).setPosition(center.x,center.y).setDisplaySize(d.width*q.front,d.height*q.front).setTint(telegraphColors.edge).setAlpha(Math.min(1,q.frontAlpha)).setDepth(1.5);}
  }
 }
}
new Phaser.Game({type:Phaser.WEBGL,width:800,height:450,backgroundColor:'#222',scene:Preview});
