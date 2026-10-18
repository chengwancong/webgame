import Phaser from 'phaser';
import {resolvedToken} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {hasArt,smallArt,art} from './ui-assets.ts';

/** 击杀战利品演出（docs/progression-goal-plan.md §11.4）：只画服务端本来就会发的东西，不改结算。
 * - 每只有奖励的怪倒下，尸体处蹦出金币和强化石，随后飞进角色（这两样每次击杀都发）。
 * - 部件、材料等回执回来后，在最近一次击杀的位置蹦出图标并飘名字。 */
export type SpoilItem={icon:string;label?:string};
type Spoil={node:Phaser.GameObjects.Container;born:number;fromX:number;fromY:number;toX:number;toY:number;hold:number;top:boolean};
/** 部件、材料画在角色和尸体之上（伤害数字之下），不会被倒在地上的怪挡住；金币和强化石按地面排序。 */
const POP=360,FLY=300,ARC=34,COIN='spoil:coin',STONE='spoil:stone',TOP_DEPTH=9990;
export class KillSpoils{
 private items:Spoil[]=[];private last?:{x:number;y:number};private requested=new Set<string>();private counts={kills:0,materials:0};
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean=()=>false){this.makeTextures();}
 /** 尸体处蹦出金币和强化石。 */
 kill(at:{x:number;y:number}){this.last={...at};this.counts.kills++;if(this.reduced())return;this.burst(at,[{icon:COIN},{icon:STONE}],0);}
 /** 回执里的材料：在最近一次击杀处蹦出，并飘名字。 */
 materials(list:SpoilItem[]){if(!list.length||!this.last)return;this.counts.materials+=list.length;this.burst(this.last,list,this.reduced()?0:420,true);}
 update(hero:{x:number;y:number}){
  const now=this.scene.time.now;
  this.items=this.items.filter(s=>{const age=now-s.born;
   if(age<POP){const p=age/POP,e=1-(1-p)**2;s.node.setPosition(s.fromX+(s.toX-s.fromX)*e,s.fromY+(s.toY-s.fromY)*e-4*ARC*p*(1-p)).setScale(.6+.4*p).setDepth(s.top?TOP_DEPTH:s.toY+6);return true;}
   if(age<POP+s.hold){s.node.setPosition(s.toX,s.toY).setScale(1);return true;}
   const t=(age-POP-s.hold)/FLY;if(t>=1){s.node.destroy(true);return false;}
   const e=t*t;s.node.setPosition(s.toX+(hero.x-s.toX)*e,s.toY+(hero.y-40-s.toY)*e).setScale(1-.5*e).setAlpha(1-.7*e).setDepth(s.top?TOP_DEPTH:hero.y+8);return true;});
 }
 clear(){for(const s of this.items)s.node.destroy(true);this.items=[];this.last=undefined;}
 destroy(){this.clear();}
 diagnostics(){return {active:this.items.length,...this.counts};}
 private burst(at:{x:number;y:number},list:SpoilItem[],hold:number,named=false){
  const now=this.scene.time.now,size=named?26:18;
  list.forEach((item,i)=>{
   const key=this.texture(item.icon),angle=-Math.PI/2+(i-(list.length-1)/2)*.9,dist=named?30:22;
   const ready=this.scene.textures.exists(key),image=this.scene.add.image(0,0,ready?key:COIN).setDisplaySize(size,size);
   // 第一次用到的图标还在加载：先用金币占位，加载完立刻换成正式图标。
   if(!ready&&key!==COIN)this.scene.load.once('filecomplete-image-'+key,()=>{if(image.active)image.setTexture(key).setDisplaySize(size,size);});
   const parts:Phaser.GameObjects.GameObject[]=[image];
   if(named&&item.label)parts.push(this.scene.add.text(0,size/2+4,item.label,{fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),fontStyle:resolvedToken('Font.Weight.Medium'),color:resolvedToken('Color.Resource.GoldLight'),stroke:resolvedToken('Color.World.Ink'),strokeThickness:3,resolution:worldTextResolution()}).setOrigin(.5,0));
   const node=this.scene.add.container(at.x,at.y-10,parts);
   this.items.push({node,born:now+i*40,fromX:at.x,fromY:at.y-10,toX:at.x+Math.cos(angle)*dist+(i%2?6:-6),toY:at.y+Math.sin(angle)*dist*.4+12,hold:hold+(named?600:120),top:named});
  });
 }
 /** 材料图标按需加载；没有正式图时用金币占位，不报错。 */
 private texture(icon:string){
  if(icon===COIN||icon===STONE)return icon;
  const key='spoil:'+icon;if(this.scene.textures.exists(key)||this.requested.has(key))return key;
  this.requested.add(key);if(!hasArt(icon))return COIN;
  try{let path:string;try{path=smallArt(icon);}catch{path=art(icon);}this.scene.load.image(key,path);if(!this.scene.load.isLoading())this.scene.load.start();}catch{}
  return key;
 }
 /** 金币与强化石的小图标，形状与界面货币图标一致（圆币、菱形石）。 */
 private makeTextures(){
  const g=this.scene.make.graphics({x:0,y:0},false),hex=(n:Parameters<typeof resolvedToken>[0])=>Phaser.Display.Color.HexStringToColor(resolvedToken(n)).color;
  if(!this.scene.textures.exists(COIN)){g.clear();g.fillStyle(hex('Color.Resource.GoldShade'),1).fillCircle(16,16,15);g.fillStyle(hex('Color.Resource.GoldIcon'),1).fillCircle(16,16,12);g.fillStyle(hex('Color.Resource.GoldLight'),1).fillCircle(12,11,4);g.generateTexture(COIN,32,32);}
  if(!this.scene.textures.exists(STONE)){g.clear();const c=hex('Color.Resource.Spirit');g.fillStyle(c,1).fillPoints([{x:16,y:2},{x:28,y:15},{x:24,y:29},{x:16,y:26},{x:8,y:29},{x:4,y:15}] as any,true);g.fillStyle(0xffffff,.5).fillPoints([{x:16,y:2},{x:11,y:18},{x:16,y:26},{x:21,y:18}] as any,true);g.generateTexture(STONE,32,32);}
  g.destroy();
 }
}
