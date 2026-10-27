import {worldTextResolution} from './ui/world-text.ts';
import Phaser from 'phaser';
import type {StoryObject,StoryEncounterView,ResolvedAppearance} from '../../../packages/contracts/index.ts';
import {storyNpcs} from '../../../packages/content/story-campaign.ts';
import {StoryNpcPreview} from './story-npc-preview.ts';
import {projectFx} from './skill-fx-layout.ts';
import {groundSize} from './vfx-geometry.ts';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {storyNpcAppearance} from './story-appearance.ts';
import {worldLabels} from './hud-avoidance.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';
export function preloadStoryClues(scene:Phaser.Scene){for(const [chapter,asset]of Object.entries(environment.reusedClues))scene.load.image('story-clue-'+chapter,asset.path);}
const color=(id:TokenName)=>parseInt(resolvedToken(id).slice(1),16);let serial=0;
type Node={image:Phaser.GameObjects.Image;label:Phaser.GameObjects.Text;shadow:Phaser.GameObjects.Image;texture?:Phaser.Textures.CanvasTexture;painter?:StoryNpcPreview;source:string;last?:{x:number;y:number};movingUntil?:number;facing?:number};
export class StoryRenderer{
 private nodes=new Map<string,Node>();private ground:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene){this.ground=scene.add.graphics();}
 private create(object:StoryObject,chapter:string):Node{const npc=storyNpcs.find(n=>n.id===object.npcId);let texture:Phaser.Textures.CanvasTexture|undefined,painter:StoryNpcPreview|undefined,image:Phaser.GameObjects.Image;
  if(npc){texture=this.scene.textures.createCanvas('story-npc-'+(++serial),512,512)!;painter=new StoryNpcPreview(texture.canvas,npc.id,{height:100,footX:.5,footY:.82});const appearance=storyNpcAppearance(npc.id);void painter.setAppearance(appearance);image=this.scene.add.image(0,0,texture.key).setOrigin(.5,.82).setInteractive(new Phaser.Geom.Rectangle(222,319,68,104),Phaser.Geom.Rectangle.Contains);
  }else{const lamp=object.kind==='beacon',clue=object.kind==='clue',binding=environment.reusedClues[chapter as keyof typeof environment.reusedClues];if(clue&&chapter!=='meadow'&&!binding)throw Error('Unregistered story clue '+chapter);image=this.scene.add.image(0,0,clue&&binding?'story-clue-'+chapter:'world-props',clue&&binding?undefined:lamp?'lamp':clue?'cart':'rocks').setOrigin(.5,lamp?.96:clue?.93:.9).setInteractive();image.setScale(lamp?104/image.height:(clue?chapter==='meadow'?112:72:52)/image.width);image.setData('occluder',clue);}
  image.setData('story-object-id',object.id);const shadow=this.scene.add.image(0,0,'unit-shadow').setAlpha(.2);
  const label=this.scene.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),align:'center',padding:{x:6,y:4}}).setOrigin(0,0).setInteractive().setData('story-object-id',object.id);
  return {image,label,shadow,texture,painter,source:object.npcId??(object.kind==='clue'?'clue:'+chapter:object.kind)};
 }
 draw(objects:StoryObject[],encounter:StoryEncounterView|undefined,clock:number){const used=new Set(objects.map(o=>o.id));for(const [id,n] of this.nodes)if(!used.has(id)){this.remove(n);this.nodes.delete(id);}this.ground.clear();
  for(const object of objects){const chapter=encounter?.chapter??'meadow',source=object.npcId??(object.kind==='clue'?'clue:'+chapter:object.kind);let node=this.nodes.get(object.id);if(node&&node.source!==source){this.remove(node);this.nodes.delete(object.id);node=undefined;}if(!node){node=this.create(object,chapter);this.nodes.set(object.id,node);}const point=projectFx(object.position),visible=this.scene.cameras.main.worldView.contains(point.x,point.y);node.image.setVisible(visible&&(!node.painter||node.painter.ready));node.shadow.setVisible(visible);node.label.setVisible(visible);if(!visible)continue;
   if(object.kind==='beacon')node.image.setTint((encounter?encounter.defendActive||encounter.readyForBoss:object.state==='lit')?0xffffff:0x98a4ae);
   if(node.last&&Math.hypot(point.x-node.last.x,point.y-node.last.y)>.1){node.movingUntil=clock+6;node.facing=point.x>=node.last.x?1:-1;}node.last={...point};
   if(node.painter?.render({action:clock<(node.movingUntil??0)?'move':'idle',clock:clock/30,facing:node.facing??-1})){node.texture!.refresh();}node.image.setPosition(point.x,point.y).setDepth(point.y+(node.painter?2:1));node.shadow.setPosition(point.x,point.y+2).setDepth(point.y-1);node.label.setText(object.name===object.label?object.name:object.name+'\n'+object.label);this.placeLabel(node.label,object,point.x,point.y-(node.painter?108:node.image.displayHeight+10));node.label.setDepth(point.y+4);const labelColor=resolvedToken(object.enabled?'Color.Highlight':'Color.TextDisabled');if(node.label.style.color!==labelColor)node.label.setColor(labelColor);
   if(object.kind==='beacon'){this.ground.setDepth(point.y-2);if(encounter){const d=groundSize(4);this.ground.fillStyle(color('Color.Success'),.08).fillEllipse(point.x,point.y,d.width,d.height).lineStyle(2,color(encounter.contested?'Color.Warning':'Color.Success'),.8).strokeEllipse(point.x,point.y,d.width,d.height);}}
  }
 }
 /** 整像素落位后交给世界标签仲裁（docs/hud-arbitration-plan.md §2.3）：可交互的先放，让不开或进 HUD 保留区就隐藏。 */
 private placeLabel(label:Phaser.GameObjects.Text,object:StoryObject,centerX:number,bottom:number){label.setPosition(Math.round(centerX-label.width/2),Math.round(bottom-label.height));
  worldLabels(this.scene).submit({id:'legacy-story:'+object.id,bounds:label.getBounds(),priority:object.enabled?10:20,apply:(visible,lift)=>{label.setVisible(visible);if(visible&&lift)label.y=Math.round(label.y-lift);}});}
 private remove(node:Node){node.painter?.destroy();node.image.destroy();node.shadow.destroy();node.label.destroy();if(node.texture)this.scene.textures.remove(node.texture.key);}
 destroy(){for(const node of this.nodes.values())this.remove(node);this.nodes.clear();this.ground.destroy();}
 diagnostics(){return {objects:this.nodes.size,npcs:[...this.nodes.values()].filter(n=>n.painter).map(n=>n.painter!.diagnostics())};}
}
