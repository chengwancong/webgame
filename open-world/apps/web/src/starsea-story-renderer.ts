import Phaser from 'phaser';
import {resolvedToken} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {StarseaNativeActor,starseaAtlasFrame,starseaAsset,starseaPropState,starseaTexture,type StarseaNativeBudget,type StarseaSceneObject} from './starsea-runtime-assets.ts';
import type {StarseaMap} from './starsea-world-renderer.ts';
import type {Point} from './starsea-assets.ts';
const project=(p:Point)=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
type Node={artId:string;image:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;native?:StarseaNativeActor;label:Phaser.GameObjects.Text;shadow:Phaser.GameObjects.Image;light:Phaser.GameObjects.Graphics;last?:Point;facing:number;movingUntil:number};
export function starseaPortObjects(map:StarseaMap|undefined):StarseaSceneObject[]{if(map?.id!=='ss-map-port')return[];return [['ss-npc-cheng','hall','港务长·澄'],['ss-npc-tongling','forge','机巧师·铜铃'],['ss-npc-milo','pier','领航员·米洛']].flatMap(([id,landmark,name])=>{const position=map.landmarks.find(l=>l.id===landmark);return position?[{id,artId:id,npcId:id,position:{x:position.x,y:position.y},name,label:'',enabled:true,action:'idle'}]:[];});}
/** All visible state is input; this renderer does not complete tasks or change NPC progress. */
export class StarseaStoryRenderer{
 private nodes=new Map<string,Node>();private objects:readonly StarseaSceneObject[]=[];private errors=new Set<string>();
 constructor(private scene:Phaser.Scene,private budget:StarseaNativeBudget){}
 private create(object:StarseaSceneObject):Node|undefined{const asset=starseaAsset(object.artId);if(!asset){this.fail('Unknown object art '+object.artId);return;}let native:StarseaNativeActor|undefined,image:Node['image'];
  if(asset.runtime.kind==='native'){native=new StarseaNativeActor(this.scene,asset);image=native.sprite;image.setInteractive(new Phaser.Geom.Rectangle(206,409.6-(asset.runtime.displayHeight??100),100,(asset.runtime.displayHeight??100)+12),Phaser.Geom.Rectangle.Contains);}else if(asset.runtime.kind==='atlas'){image=this.scene.add.sprite(0,0,asset.id,starseaAtlasFrame(asset.id,'idle',0)).setInteractive();}else{const state=starseaPropState(asset,object.state);if(!state){this.fail('Undeclared prop state '+object.artId+'/'+object.state);return;}image=this.scene.add.image(0,0,starseaTexture(state.file)).setInteractive();}
  image.setData('starsea-object-id',object.id);const label=this.scene.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),align:'center',padding:{x:6,y:4}}).setOrigin(.5,1).setInteractive().setData('starsea-object-id',object.id);
  return{artId:object.artId,image,native,label,shadow:this.scene.add.image(0,0,'unit-shadow').setAlpha(.18),light:this.scene.add.graphics(),facing:object.facing??-1,movingUntil:0};
 }
 draw(objects:readonly StarseaSceneObject[],tick:number){this.objects=objects;const used=new Set(objects.map(o=>o.id));for(const [id,node] of this.nodes)if(!used.has(id)){this.remove(node);this.nodes.delete(id);}
  const placed:Phaser.Geom.Rectangle[]=[];for(const object of objects){let node=this.nodes.get(object.id);if(node?.artId!==object.artId){if(node)this.remove(node);this.nodes.delete(object.id);node=undefined;}if(!node){node=this.create(object);if(!node)continue;this.nodes.set(object.id,node);}
   const asset=starseaAsset(object.artId)!,point=project(object.position),camera=this.scene.cameras.main.worldView,height=asset.runtime.displayHeight??100,visible=point.x>=camera.x-height&&point.x<=camera.right+height&&point.y>=camera.y&&point.y<=camera.bottom+height;
   if(node.last&&Math.hypot(point.x-node.last.x,point.y-node.last.y)>.1){node.facing=point.x>=node.last.x?1:-1;node.movingUntil=tick+6;}node.last=point;
   const action=object.action??(tick<node.movingUntil?'move':'idle'),facing=object.facing??node.facing;
   if(node.native){node.native.sync('story:'+object.id,point,action,(tick-(object.actionStartedTick??0))/30,facing,object.phase??'default',this.budget);}
   else if(asset.runtime.kind==='atlas'){const frame=starseaAtlasFrame(asset.id,action,(tick-(object.actionStartedTick??0))/30);if(frame)(node.image as Phaser.GameObjects.Sprite).setFrame(frame);node.image.setOrigin(...(asset.runtime.anchor??[.5,1])).setScale(asset.runtime.scale??1).setVisible(visible).setPosition(point.x,point.y).setDepth(point.y+1);}
   else{const state=starseaPropState(asset,object.state);if(!state){this.fail('Undeclared prop state '+object.artId+'/'+object.state);node.image.setVisible(false);continue;}node.image.setTexture(starseaTexture(state.file));const anchor=state.anchor??asset.runtime.anchor??[.5,1];node.image.setOrigin(anchor[0],anchor[1]);node.image.setScale(state.referenceScale??(state.displayHeight??height)/node.image.height);node.image.setVisible(visible&&state.visible!==false);node.image.setPosition(point.x,point.y).setDepth(point.y+1);node.image.clearTint();if(state.material?.brightness)node.image.setTint(Phaser.Display.Color.GetColor(...([0,0,0].map(()=>Math.round(state.material!.brightness*255)) as [number,number,number])));node.light.clear();if(visible&&state.light){const light=state.light,color=parseInt(resolvedToken(light.color==='energy'?'Color.Resource.Spirit':'Color.Highlight').slice(1),16),x=point.x+(light.center[0]-anchor[0])*node.image.displayWidth,y=point.y+(light.center[1]-anchor[1])*node.image.displayHeight;node.light.setDepth(point.y+2).fillStyle(color,.55+.2*Math.sin(tick/30*Math.PI*2/light.period)).fillCircle(x,y,light.radius);}}
   const shown=visible&&node.image.visible;node.shadow.setVisible(shown).setPosition(point.x,point.y+2).setDepth(point.y-1);node.label.setVisible(shown).setText([object.name??asset.name,object.label].filter(Boolean).join('\n')).setColor(resolvedToken(object.enabled===false?'Color.TextDisabled':'Color.TextPrimary')).setPosition(Math.round(point.x),Math.round(point.y-(node.native||asset.runtime.kind==='atlas'?height+10:node.image.displayHeight+10))).setDepth(point.y+5);
   if(object.enabled===false){node.image.disableInteractive();node.label.disableInteractive();}else{node.image.setInteractive();node.label.setInteractive();}
   if(shown){for(let pass=0;pass<4;pass++){const bounds=node.label.getBounds(),hit=placed.find(p=>Phaser.Geom.Intersects.RectangleToRectangle(bounds,p));if(!hit)break;node.label.setY(Math.round(hit.y-4));}placed.push(node.label.getBounds());}
  }
 }
 object(id:string){return this.objects.find(o=>o.id===id);}
 labelTop(id:string){const node=this.nodes.get(id);return node?.label.visible?node.label.getBounds().top:undefined;}
 nearest(position:Point,radius=2.8){return this.objects.filter(o=>o.enabled!==false&&Math.hypot(o.position.x-position.x,o.position.y-position.y)<=radius).sort((a,b)=>Math.hypot(a.position.x-position.x,a.position.y-position.y)-Math.hypot(b.position.x-position.x,b.position.y-position.y))[0];}
 private fail(message:string){if(!this.errors.has(message)){this.errors.add(message);console.error('[starsea-story]',message);}}
 private remove(node:Node){node.native?.destroy();node.image.destroy();node.label.destroy();node.shadow.destroy();node.light.destroy();}
 diagnostics(){return{objects:this.nodes.size,npcs:[...this.nodes.values()].filter(n=>n.native).map(n=>n.native!.diagnostics()),errors:[...this.errors]};}
 destroy(){for(const node of this.nodes.values())this.remove(node);this.nodes.clear();this.objects=[];}
}
