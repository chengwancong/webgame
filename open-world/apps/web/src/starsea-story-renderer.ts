import {worldLabels} from './hud-avoidance.ts';
import {interactionReach,inInteractionReach} from '../../../packages/rules/world-interactions.ts';
import Phaser from 'phaser';
import {resolvedToken} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {StarseaNativeActor,starseaAtlasFrame,starseaAsset,starseaPropState,starseaTexture,type StarseaNativeBudget,type StarseaSceneObject} from './starsea-runtime-assets.ts';
import type {StarseaMap} from './starsea-world-renderer.ts';
import type {Point} from './starsea-assets.ts';
const project=(p:Point)=>({x:(p.x-p.y)*32,y:(p.x+p.y)*18});
/** Click box of a native NPC: its body silhouette (~100px tall chibi), not the 512² paint canvas, so clicks on the ground beside it still walk. */
const npcHitWidth=60;
type Node={artId:string;image:Phaser.GameObjects.Image|Phaser.GameObjects.Sprite;native?:StarseaNativeActor;label:Phaser.GameObjects.Text;shadow:Phaser.GameObjects.Image;light:Phaser.GameObjects.Graphics;last?:Point;facing:number;movingUntil:number};
/** 港口摆件：按建设等级累加显示（forge/shipyard/post 各 1–4 级） */
export function portBuildObjects(levels:Record<string,number>):StarseaSceneObject[]{
 const tiers:[string,string,{x:number;y:number}][]=[
  ['forge','ss-scene-build-forge-1',{x:18,y:18}],['forge','ss-scene-build-forge-2',{x:20,y:18}],
  ['forge','ss-scene-build-forge-3',{x:19.5,y:19.5}],['forge','ss-scene-build-forge-4',{x:20.5,y:15}],
  ['shipyard','ss-scene-build-dock-1',{x:24,y:9}],['shipyard','ss-scene-build-dock-2',{x:25.5,y:7}],
  ['shipyard','ss-scene-build-dock-3',{x:24.5,y:10}],['shipyard','ss-scene-build-dock-4',{x:26,y:8}],
  ['post','ss-scene-build-post-1',{x:5.5,y:26}],['post','ss-scene-build-post-2',{x:4.5,y:24}],
  ['post','ss-scene-build-post-3',{x:6,y:23}],['post','ss-scene-build-post-4',{x:3.5,y:25.5}],
 ];
 const result=tiers.filter(([building,,],i)=>(levels[building]??0)>=(i%4)+1).map(([,artId,position])=>({id:'prop:'+artId,artId,position,name:'',label:'',enabled:false})) as StarseaSceneObject[];
 // 工坊外观三档互斥替换（M09 D-C3）：forge>=1时按min(level,3)选档
 const forgeLevel=levels['forge']??0;
 if(forgeLevel>=1){const t=Math.min(forgeLevel,3);result.push({id:'prop:ss-scene-workshop-tier',artId:`ss-scene-workshop-tier-${t}`,position:{x:19,y:17},name:'',label:'',enabled:false});}
 // E5 ART-HE 建设等级 ≥1 时在建筑头顶显示地标标记（与建筑同脚点，抬升量见 runtime-resources 的 lift）
 if((levels['forge']??0)>=1)result.push({id:'mark:forge',artId:'ow-hub-port-marks',position:{x:19,y:17.02},state:'forge',name:'',label:'',enabled:false} as StarseaSceneObject);
 if((levels['shipyard']??0)>=1)result.push({id:'mark:pier',artId:'ow-hub-port-marks',position:{x:24,y:9.02},state:'pier',name:'',label:'',enabled:false} as StarseaSceneObject);
 if((levels['post']??0)>=1)result.push({id:'mark:post',artId:'ow-hub-port-marks',position:{x:5.5,y:26.02},state:'post',name:'',label:'',enabled:false} as StarseaSceneObject);
 return result;
}
export function starseaPortObjects(map:StarseaMap|undefined):StarseaSceneObject[]{if(map?.id!=='ss-map-port')return[];
 // 星门底图（14,18）；chart旋转/ring-lit/open动画跳过：渲染器不支持多层旋转，ring-lit需hub_ctrl生命星晶计数，open动画缺出发钩子
 // 底图 + 六颗星石呼吸叠加层（同位置，y 微偏移让叠加层排在底图上面）
 const stargate:StarseaSceneObject[]=[{id:'prop:ss-scene-stargate',artId:'ss-scene-stargate',position:{x:14,y:18},name:'',label:'',enabled:false},{id:'prop:ss-scene-stargate-glow',artId:'ss-scene-stargate',position:{x:14,y:18.01},state:'glow',name:'',label:'',enabled:false}];
 const npcs=[['ss-npc-cheng','hall','港务长·澄'],['ss-npc-tongling','forge','机巧师·铜铃'],['ss-npc-milo','pier','领航员·米洛']].flatMap(([id,landmark,name])=>{const position=map.landmarks.find(l=>l.id===landmark);return position?[{id,artId:id,npcId:id,position:{x:position.x,y:position.y},name,label:'',enabled:true,action:'idle'}]:[];});
 // ART-HC 港口补充物件（六件，name/label 为空不画标签）。摊位放在港务厅—登陆点主路南侧，避开星门与 3 格宽主路
 const extras:StarseaSceneObject[]=[
  {id:'prop:ss-scene-port-warehouse',artId:'ss-scene-port-warehouse',position:{x:8,y:27},name:'',label:'',enabled:false},
  {id:'prop:ss-scene-port-pet-yard',artId:'ss-scene-port-pet-yard',position:{x:22,y:26},name:'',label:'',enabled:false},
  {id:'prop:ss-scene-port-wardrobe',artId:'ss-scene-port-wardrobe',position:{x:3,y:16},name:'',label:'',enabled:false},
  {id:'prop:ss-scene-port-stall-xuemi',artId:'ss-scene-port-stall-xuemi',position:{x:13,y:23},name:'',label:'',enabled:false},
  {id:'prop:ss-scene-port-stall-mijia',artId:'ss-scene-port-stall-mijia',position:{x:10,y:24},name:'',label:'',enabled:false},
  {id:'prop:ss-scene-port-stall-jinyu',artId:'ss-scene-port-stall-jinyu',position:{x:7,y:25},name:'',label:'',enabled:false},
 ];
 // E5 ART-HE 港口常驻地标标记（星门、港务厅、仓库、衣橱、宠物场）
 const portMarks:StarseaSceneObject[]=[
  {id:'mark:stargate',artId:'ow-hub-port-marks',position:{x:14,y:18.02},state:'stargate',name:'',label:'',enabled:false},
  {id:'mark:warehouse',artId:'ow-hub-port-marks',position:{x:8,y:27.02},state:'warehouse',name:'',label:'',enabled:false},
  {id:'mark:wardrobe',artId:'ow-hub-port-marks',position:{x:3,y:16.02},state:'wardrobe',name:'',label:'',enabled:false},
  {id:'mark:pet-yard',artId:'ow-hub-port-marks',position:{x:22,y:26.02},state:'pet-yard',name:'',label:'',enabled:false},
  ...map.landmarks.filter(l=>l.id==='hall').map(l=>({id:'mark:hall',artId:'ow-hub-port-marks',position:{x:l.x,y:l.y+.02},state:'hall',name:'',label:'',enabled:false})),
 ];
 return [...stargate,...npcs,...extras,...portMarks];}
/** All visible state is input; this renderer does not complete tasks or change NPC progress. */
export class StarseaStoryRenderer{
 private nodes=new Map<string,Node>();private objects:readonly StarseaSceneObject[]=[];private errors=new Set<string>();
 constructor(private scene:Phaser.Scene,private budget:StarseaNativeBudget){}
 private create(object:StarseaSceneObject):Node|undefined{const asset=starseaAsset(object.artId);if(!asset){this.fail('Unknown object art '+object.artId);return;}let native:StarseaNativeActor|undefined,image:Node['image'];
  if(asset.runtime.kind==='native'){native=new StarseaNativeActor(this.scene,asset);image=native.sprite;const h=asset.runtime.displayHeight??100;image.setInteractive(new Phaser.Geom.Rectangle(native.foot.x-npcHitWidth/2,native.foot.y-h,npcHitWidth,h+6),Phaser.Geom.Rectangle.Contains);}else if(asset.runtime.kind==='atlas'){image=this.scene.add.sprite(0,0,asset.id,starseaAtlasFrame(asset.id,'idle',0)).setInteractive();}else{const state=starseaPropState(asset,object.state);if(!state){this.fail('Undeclared prop state '+object.artId+'/'+object.state);return;}
   // 图集动画 prop（如引雷桩）：用 Sprite；静态 prop：用 Image
   if(state.atlasKey&&state.frames?.length){image=this.scene.add.sprite(0,0,state.atlasKey,state.frames[0]).setInteractive();}else{image=this.scene.add.image(0,0,starseaTexture(state.file)).setInteractive();}}
  image.setData('starsea-object-id',object.id);const label=this.scene.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),align:'center',padding:{x:6,y:4}}).setOrigin(.5,1).setInteractive().setData('starsea-object-id',object.id);
  return{artId:object.artId,image,native,label,shadow:this.scene.add.image(0,0,'unit-shadow').setAlpha(.18),light:this.scene.add.graphics(),facing:object.facing??-1,movingUntil:0};
 }
 draw(objects:readonly StarseaSceneObject[],tick:number,hero?:Point){this.objects=objects;const used=new Set(objects.map(o=>o.id));for(const [id,node] of this.nodes)if(!used.has(id)){this.remove(node);this.nodes.delete(id);}
  for(const object of objects){let node=this.nodes.get(object.id);if(node?.artId!==object.artId){if(node)this.remove(node);this.nodes.delete(object.id);node=undefined;}if(!node){node=this.create(object);if(!node)continue;this.nodes.set(object.id,node);}
   const asset=starseaAsset(object.artId)!,point=project(object.position),camera=this.scene.cameras.main.worldView,height=asset.runtime.displayHeight??100,visible=point.x>=camera.x-height&&point.x<=camera.right+height&&point.y>=camera.y&&point.y<=camera.bottom+height;
   if(node.last&&Math.hypot(point.x-node.last.x,point.y-node.last.y)>.1){node.facing=point.x>=node.last.x?1:-1;node.movingUntil=tick+6;}node.last=point;
   const action=object.action??(tick<node.movingUntil?'move':'idle'),facing=object.facing??node.facing;
   if(node.native){node.native.sync('story:'+object.id,point,action,(tick-(object.actionStartedTick??0))/30,facing,object.phase??'default',this.budget);}
   else if(asset.runtime.kind==='atlas'){const frame=starseaAtlasFrame(asset.id,action,(tick-(object.actionStartedTick??0))/30);if(frame)(node.image as Phaser.GameObjects.Sprite).setFrame(frame);node.image.setOrigin(...(asset.runtime.anchor??[.5,1])).setScale(asset.runtime.scale??1).setVisible(visible).setPosition(point.x,point.y).setDepth(point.y+1);}
   else{const state=starseaPropState(asset,object.state);if(!state){this.fail('Undeclared prop state '+object.artId+'/'+object.state);node.image.setVisible(false);continue;}
    if(state.atlasKey&&state.frames?.length){
     // 图集帧动画：按 tick/fps/帧数取模选帧（10 fps → 每 3 tick 换帧）
     const fi=Math.floor(tick*(state.fps??10)/30)%state.frames.length;
     // setTexture 带帧：静态态↔图集态互切时（Image/Sprite 都适用）不会拿错纹理
     node.image.setTexture(state.atlasKey,state.frames[fi]);
    }else{node.image.setTexture(starseaTexture(state.file));}
    const anchor=state.anchor??asset.runtime.anchor??[.5,1];node.image.setOrigin(anchor[0],anchor[1]);node.image.setScale(state.referenceScale??(state.displayHeight??height)/node.image.height);node.image.setVisible(visible&&state.visible!==false);node.image.setPosition(point.x,point.y).setDepth(point.y+1);node.image.clearTint();if(state.material?.brightness)node.image.setTint(Phaser.Display.Color.GetColor(...([0,0,0].map(()=>Math.round(state.material!.brightness*255)) as [number,number,number])));node.light.clear();if(visible&&state.light){const light=state.light,color=parseInt(resolvedToken(light.color==='energy'?'Color.Resource.Spirit':'Color.Highlight').slice(1),16),x=point.x+(light.center[0]-anchor[0])*node.image.displayWidth,y=point.y+(light.center[1]-anchor[1])*node.image.displayHeight;node.light.setDepth(point.y+2).fillStyle(color,.55+.2*Math.sin(tick/30*Math.PI*2/light.period)).fillCircle(x,y,light.radius);}}
   const shown=visible&&node.image.visible,near=!hero||inInteractionReach(hero,object.position,object.reach??interactionReach.story);node.shadow.setVisible(shown).setPosition(point.x,point.y+2).setDepth(point.y-1);const text=[object.name??asset.name,near?object.label:undefined].filter(Boolean).join('\n');node.label.setVisible(shown&&text!=='').setText(text);const color=resolvedToken(object.enabled===false?'Color.TextDisabled':'Color.TextPrimary');if(node.label.style.color!==color)node.label.setColor(color);node.label.setPosition(Math.round(point.x),Math.round(point.y-(node.native||asset.runtime.kind==='atlas'?height+10:node.image.displayHeight*node.image.originY+10))).setDepth(point.y+5);
   // 可采集物脚下画一圈浅金环，和地图上同图的装饰石堆/灌木区分开（Grok：看得到却采不到）。
   if(object.id.startsWith('gather:')&&shown){const ring=parseInt(resolvedToken('Color.Highlight').slice(1),16);if(node.native||asset.runtime.kind==='atlas')node.light.clear();node.light.lineStyle(2,ring,near?.95:.6).strokeEllipse(point.x,point.y,64,32).fillStyle(ring,near?.18:.08).fillEllipse(point.x,point.y,64,32).setDepth(point.y-2);}
   if(object.enabled===false||!near){node.image.disableInteractive();node.label.disableInteractive();}else{node.image.setInteractive();node.label.setInteractive();}
   if(shown){const label=node.label;worldLabels(this.scene).submit({id:'story:'+object.id,bounds:label.getBounds(),priority:near?10:20,apply:(visible,lift)=>{label.setVisible(visible);if(visible&&lift)label.y-=lift;}});}
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
