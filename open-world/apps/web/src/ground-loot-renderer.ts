import {emitAudioPresentation} from './audio/presentation-events.ts';
import Phaser from 'phaser';
import type {Reward,GearQuality} from '../../../packages/contracts/index.ts';
import {groundLootArt,groundLootTexture,lootLayout} from './ground-loot.ts';
import {smallArt} from './ui-assets.ts';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
const colors:Record<GearQuality,TokenName>={common:'Color.World.Rarity.Common',magic:'Color.World.Rarity.Magic',rare:'Color.World.Rarity.Rare',legendary:'Color.World.Rarity.Legendary'};
const size=()=>parseFloat(resolvedToken('Size.GroundLootIcon'));
type Drop={id:string;landed?:boolean;node:Phaser.GameObjects.Container;image:Phaser.GameObjects.Image;label:Phaser.GameObjects.Text;key:string;quality:GearQuality;born?:number;fromX:number;fromY:number;pillar?:{image:Phaser.GameObjects.Image;start:number}};
type Ghost={node:Phaser.GameObjects.Container;start:number;fromX:number;fromY:number};
/** Presentation only (ms): pop out of the kill spot, one bounce, then a short beam for rare/legendary. Pickup flies into the hero. */
const FLIGHT=420,BOUNCE=180,PICKUP=320,ARC=46;
const pillars:Partial<Record<GearQuality,{height:number;life:number}>>={rare:{height:120,life:1500},legendary:{height:170,life:2200}};
export function preloadGroundLoot(scene:Phaser.Scene){for(const base of ['blade','bow','coat','charm','core','shield'])scene.load.image('ground-loot:'+base,smallArt('gear-'+base));}
export class GroundLootRenderer{
 private drops=new Map<string,Drop>();private requested=new Set<string>();private errors=new Set<string>();
 private region?:string;private primed=false;private ghosts:Ghost[]=[];
 constructor(private scene:Phaser.Scene,private reduced:()=>boolean=()=>false){}
 update(rewards:Reward[],region:string,hero?:{x:number;y:number}){
  const now=this.scene.time.now;
  // Drops already on the ground when a region loads (or after reconnect into it) appear in place, without replaying the pop.
  if(region!==this.region){this.clear();this.region=region;this.primed=false;}
  const visible=rewards.filter(r=>r.region===region),ids=new Set(visible.map(r=>r.id));
  for(const [id,d]of this.drops)if(!ids.has(id)){emitAudioPresentation({kind:'loot-picked',id});d.pillar?.image.destroy();this.drops.delete(id);
   if(hero&&!this.reduced()){d.node.disableInteractive();this.ghosts.push({node:d.node,start:now,fromX:d.node.x,fromY:d.node.y});}else d.node.destroy(true);}
  for(const {reward:r,x,y}of lootLayout(visible)){
   let d=this.drops.get(r.id);if(!d){const key='ground-loot:'+r.gear.base;if(!this.scene.textures.exists(key)&&!this.requested.has(key)){this.requested.add(key);try{this.scene.load.image(key,groundLootTexture(r));if(!this.scene.load.isLoading())this.scene.load.start();}catch(e){this.errors.add(String(e));}}
    const quality=r.gear.quality??'common',s=size();
    const image=this.scene.add.image(0,-s/2-7,this.scene.textures.exists(key)?key:'__WHITE').setDisplaySize(s,s).setVisible(this.scene.textures.exists(key));
    const label=this.scene.add.text(0,parseFloat(resolvedToken('Space.1')),r.gear.name.length>6?r.gear.name.slice(0,5)+'…':r.gear.name,{fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),fontStyle:resolvedToken('Font.Weight.Medium'),color:resolvedToken(colors[quality]),stroke:resolvedToken('Color.World.Ink'),strokeThickness:parseFloat(resolvedToken('Border.FocusWidth'))}).setResolution(worldTextResolution()).setOrigin(.5,0);const fullLabel=r.gear.name,shortLabel=label.text;label.setData('full-name',fullLabel);
    const node=this.scene.add.container(x,y,[image,label]).setData('ground-reward-id',r.id).setData('ground-icon',groundLootArt(r)).setData('ground-thumbnail',groundLootTexture(r));node.setInteractive(new Phaser.Geom.Rectangle(-Math.max(s/2+8,label.width/2),-s-15,Math.max(s+16,label.width),s+45),Phaser.Geom.Rectangle.Contains);node.input!.cursor='pointer';node.on('pointerover',()=>label.setText(fullLabel));node.on('pointerout',()=>label.setText(shortLabel));const animate=this.primed&&!this.reduced();d={id:r.id,node,image,label,key,quality,born:animate?now:undefined,fromX:(r.position.x-r.position.y)*32,fromY:(r.position.x+r.position.y)*18-24};if(animate)label.setAlpha(0);this.drops.set(r.id,d);if(this.primed&&!animate)emitAudioPresentation({kind:'loot-landed',id:r.id,quality});
   }this.place(d,x,y,now);if(!d.image.visible&&this.scene.textures.exists(d.key))d.image.setTexture(d.key).setDisplaySize(size(),size()).setVisible(true);
  }
  this.primed=true;
  this.ghosts=this.ghosts.filter(g=>{const t=(now-g.start)/PICKUP;if(t>=1||!hero){g.node.destroy(true);return false;}
   const e=t*t;g.node.setPosition(g.fromX+(hero.x-g.fromX)*e,g.fromY+(hero.y-40-g.fromY)*e).setScale(1-.6*e).setAlpha(1-e).setDepth(hero.y+8);return true;});
 }
 private place(d:Drop,x:number,y:number,now:number){
  const age=d.born===undefined?Infinity:now-d.born;
  if(age<FLIGHT){const p=age/FLIGHT,e=1-(1-p)**2;d.node.setPosition(d.fromX+(x-d.fromX)*e,d.fromY+(y-d.fromY)*e-4*ARC*p*(1-p)).setScale(.7+.3*p).setDepth(y+4);return;}
  if(d.born!==undefined&&!d.landed){d.landed=true;emitAudioPresentation({kind:'loot-landed',id:d.id,quality:d.quality});}
  const q=Math.min(1,(age-FLIGHT)/BOUNCE);d.node.setPosition(x,y-(q<1?10*Math.sin(Math.PI*q):0)).setScale(1).setDepth(y+4);d.label.setAlpha(q);
  const beam=pillars[d.quality];if(!beam||d.born===undefined)return;
  if(!d.pillar)d.pillar={image:this.scene.add.image(x,y-4,this.pillarTexture(resolvedToken(colors[d.quality]))).setOrigin(.5,1),start:now};
  const t=now-d.pillar.start;if(t>=beam.life){d.pillar.image.setVisible(false);return;}
  const grow=Math.min(1,t/160),fade=t<beam.life*.55?1:1-(t-beam.life*.55)/(beam.life*.45);
  d.pillar.image.setPosition(x,y-4).setDisplaySize(40,beam.height*grow).setAlpha(.9*fade).setDepth(y+3);
 }
 /** Vertical beam in the rarity colour with a pale core; drawn with normal blending so the hue survives on grass, sand or snow. */
 private pillarTexture(color:string){
  const key='ground-loot-pillar:'+color;if(this.scene.textures.exists(key))return key;
  const w=48,h=256,texture=this.scene.textures.createCanvas(key,w,h)!,c=texture.context,v=c.createLinearGradient(0,h,0,0);
  v.addColorStop(0,color);v.addColorStop(.4,color+'b0');v.addColorStop(1,color+'00');c.fillStyle=v;c.fillRect(0,0,w,h);
  const core=c.createLinearGradient(0,h,0,0);core.addColorStop(0,'rgba(255,255,255,.95)');core.addColorStop(.5,'rgba(255,255,255,.45)');core.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=core;c.fillRect(w/2-4,0,8,h);
  const m=c.createLinearGradient(0,0,w,0);m.addColorStop(0,'rgba(0,0,0,0)');m.addColorStop(.3,'rgba(0,0,0,.75)');m.addColorStop(.5,'rgba(0,0,0,1)');m.addColorStop(.7,'rgba(0,0,0,.75)');m.addColorStop(1,'rgba(0,0,0,0)');
  c.globalCompositeOperation='destination-in';c.fillStyle=m;c.fillRect(0,0,w,h);texture.refresh();return key;
 }
 clear(){for(const d of this.drops.values()){d.pillar?.image.destroy();d.node.destroy(true);}this.drops.clear();for(const g of this.ghosts)g.node.destroy(true);this.ghosts=[];}
 destroy(){this.clear();}
 diagnostics(){return {count:this.drops.size,errors:[...this.errors],items:[...this.drops].map(([id,d])=>({id,texture:d.key,loaded:d.image.visible,icon:d.node.getData('ground-icon'),thumbnail:d.node.getData('ground-thumbnail'),textureSize:[d.image.texture.source[0]?.width,d.image.texture.source[0]?.height],width:d.image.displayWidth,height:d.image.displayHeight,labelResolution:d.label.style.resolution,x:d.node.x,y:d.node.y}))};}
}
