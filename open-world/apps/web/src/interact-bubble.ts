import {worldLabels} from './hud-avoidance.ts';
import Phaser from 'phaser';
import {resolvedToken} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
// 交互气泡：靠近可交互目标时在目标头顶显示「[E] 做什么」，按键与动作写在一起，替代角落里的小提示。
type Vec={x:number;y:number};
const project=(p:Vec)=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
export class InteractBubble{
 private box:Phaser.GameObjects.Graphics;private key:Phaser.GameObjects.Text;private text:Phaser.GameObjects.Text;
 constructor(private scene:Phaser.Scene){
  const font=resolvedToken('Font.Family');
  this.box=scene.add.graphics().setDepth(9500);
  this.key=scene.add.text(0,0,'E',{resolution:worldTextResolution(),fontFamily:font,fontSize:'18px',fontStyle:'bold',color:'#412402'}).setOrigin(.5).setDepth(9501);
  this.text=scene.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:font,fontSize:'17px',fontStyle:'bold',color:'#412402'}).setOrigin(0,.5).setDepth(9501);
 }
 /** anchorTop：目标名字标签的上沿（屏幕世界坐标）；没有标签时按目标脚下位置估算。 */
 draw(prompt:{x:number;y:number;text:string}|undefined,keyLabel:string,tick:number,anchorTop?:number){
  if(!this.box.active)return;
  const shown=Boolean(prompt);this.box.clear();this.key.setVisible(shown);this.text.setVisible(shown);if(!prompt)return;
  const foot=project(prompt),bob=Math.sin(tick/30*Math.PI*1.6)*3,bottom=(anchorTop??foot.y-90)-10+bob;
  this.key.setText(keyLabel);this.text.setText(prompt.text);
  const keySize=30,pad=10,gap=8,width=pad+Math.max(keySize,this.key.width+12)+gap+this.text.width+pad,height=keySize+pad,left=Math.round(foot.x-width/2),natural=Math.round(bottom-height);
  // 气泡优先级最高（方案 §2.3）：只在正上方让位，进入 HUD 保留区就不画；绘制推迟到本帧统一避让之后。
  this.key.setVisible(false);this.text.setVisible(false);
  worldLabels(this.scene).submit({id:'interact-bubble',bounds:{x:left,y:natural,width,height:height+9},priority:0,apply:(visible,lift)=>{if(!visible||!this.box.active)return;this.paint(foot.x,left,natural-lift,width,height,keySize,pad,gap);}});
 }
 private paint(footX:number,left:number,top:number,width:number,height:number,keySize:number,pad:number,gap:number){
  this.key.setVisible(true);this.text.setVisible(true);const foot={x:footX};
  this.box.fillStyle(0x2a1d0e,.25).fillRoundedRect(left+2,top+3,width,height,10);
  this.box.fillStyle(0xfdf8ec,1).fillRoundedRect(left,top,width,height,10).lineStyle(2,0xd9a92e,1).strokeRoundedRect(left,top,width,height,10);
  this.box.fillStyle(0xfdf8ec,1).fillTriangle(foot.x-8,top+height-1,foot.x+8,top+height-1,foot.x,top+height+9);
  this.box.lineStyle(2,0xd9a92e,1).lineBetween(foot.x-8,top+height,foot.x,top+height+9).lineBetween(foot.x+8,top+height,foot.x,top+height+9);
  const kw=Math.max(keySize,this.key.width+12),kx=left+pad,ky=top+pad/2;
  this.box.fillStyle(0xf2c94c,1).fillRoundedRect(kx,ky,kw,keySize,6).lineStyle(2,0xb98a1c,1).strokeRoundedRect(kx,ky,kw,keySize,6);
  this.key.setPosition(kx+kw/2,ky+keySize/2);this.text.setPosition(kx+kw+gap,ky+keySize/2);
 }
 destroy(){this.box.destroy();this.key.destroy();this.text.destroy();}
}
