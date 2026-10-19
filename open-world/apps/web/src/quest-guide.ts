import {placeHudRect,screenReservations} from './hud-avoidance.ts';
import Phaser from 'phaser';
import type {World} from '../../../packages/simulation/index.ts';
import {resolvedToken} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {screenOrigin} from './world-chunks.ts';
import {guideLabelPosition} from './guide-label-layout.ts';
// 主线引路：只给方向，不画路线。目标头顶跳动箭头与光圈，目标在屏幕外时屏幕边缘显示方向箭头；距离数字只在追踪条（docs/hud-arbitration-plan.md §2.4）。
// arrow:false（近身/交战阶段）时不画头顶箭头。
export type QuestGuideTarget={x:number;y:number;label:string;arrow?:boolean};
type Vec={x:number;y:number};
const project=(p:Vec)=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
const edge=56;
export class QuestGuide{
 private beacon:Phaser.GameObjects.Graphics;private pointer:Phaser.GameObjects.Graphics;private text:Phaser.GameObjects.Text;private wrapWidth=0;
 constructor(private scene:Phaser.Scene){
  this.beacon=scene.add.graphics().setDepth(9400);
  this.pointer=scene.add.graphics().setScrollFactor(0).setDepth(9600);
  this.text=scene.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),padding:{x:6,y:3},align:'center'}).setOrigin(.5).setScrollFactor(0).setDepth(9601);
 }
 draw(world:World,target:QuestGuideTarget|undefined,hideArrow=false){
  if(!this.text.active||!this.beacon.active)return;
  const b=this.beacon,ptr=this.pointer;b.clear();ptr.clear();this.text.setVisible(false);
  if(!target)return;
  const tick=world.tick,color=0xffd23f;
  // 目标处：脉动光圈 + 头顶跳动箭头。
  const at=project(target),pulse=(tick%45)/45,bob=Math.sin(tick/30*Math.PI*2)*6;
  b.lineStyle(3,color,.9-pulse*.7).strokeEllipse(at.x,at.y,60+pulse*50,22+pulse*18);
  b.lineStyle(2,color,.8).strokeEllipse(at.x,at.y,52,18);
  const ay=at.y-190+bob;if(!hideArrow&&target.arrow!==false){b.fillStyle(color,1).lineStyle(3,0x2a1d0e,.9);
  b.beginPath();b.moveTo(at.x-16,ay-18);b.lineTo(at.x+16,ay-18);b.lineTo(at.x,ay+6);b.closePath();b.fillPath();b.strokePath();}
  // 屏幕外：屏幕边缘方向箭头。
  const cam=this.scene.cameras.main,view=cam.worldView,inside=at.x>view.x+20&&at.x<view.right-20&&at.y-60>view.y&&at.y<view.bottom-20;
  if(inside)return;
  const origin=screenOrigin(cam),width=cam.width/cam.zoom,height=cam.height/cam.zoom,cx=width/2,cy=height/2,dx=at.x-(view.x+view.width/2),dy=at.y-(view.y+view.height/2),k=Math.min((cx-edge)/Math.max(1e-6,Math.abs(dx)),(cy-edge)/Math.max(1e-6,Math.abs(dy))),ex=cx+dx*k,ey=Phaser.Math.Clamp(cy+dy*k,200,height-150),angle=Math.atan2(dy,dx);
  const tip={x:ex+Math.cos(angle)*30,y:ey+Math.sin(angle)*30},l={x:ex+Math.cos(angle+2.5)*26,y:ey+Math.sin(angle+2.5)*26},r={x:ex+Math.cos(angle-2.5)*26,y:ey+Math.sin(angle-2.5)*26};
  ptr.setPosition(origin.x,origin.y).fillStyle(color,1).lineStyle(4,0x2a1d0e,.9);ptr.beginPath();ptr.moveTo(tip.x,tip.y);ptr.lineTo(l.x,l.y);ptr.lineTo(r.x,r.y);ptr.closePath();ptr.fillPath();ptr.strokePath();
  const inset=Number.parseFloat(resolvedToken('Space.4'));
  const wrapWidth=Math.max(1,width-inset*2-(this.text.padding.left??0)-(this.text.padding.right??0));
  if(this.wrapWidth!==wrapWidth){this.wrapWidth=wrapWidth;this.text.setWordWrapWidth(this.wrapWidth,true);}
  this.text.setText(target.label);
  const label=guideLabelPosition({x:ex-Math.cos(angle)*110,y:ey-Math.sin(angle)*44,width,height,labelWidth:this.text.width,labelHeight:this.text.height,inset});
  const free=placeHudRect({x:label.x-this.text.width/2,y:label.y-this.text.height/2,width:this.text.width,height:this.text.height},screenReservations(this.scene).map(r=>({x:r.x/cam.zoom,y:r.y/cam.zoom,width:r.width/cam.zoom,height:r.height/cam.zoom})),{x:0,y:0,width,height},inset);if(free)this.text.setPosition(origin.x+free.x+this.text.width/2,origin.y+free.y+this.text.height/2).setVisible(true);
 }
 destroy(){this.beacon.destroy();this.pointer.destroy();this.text.destroy();}
}
