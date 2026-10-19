import {CombatSoundEvents,type SoundDispatch} from './audio/combat-sound-events.ts';
import {dressingResources} from './world-dressing.ts';
import {FieldEventEffects} from './field-event-effects.ts';
import {AuthoritativeMotion} from './authoritative-motion.ts';
import {fieldRegionInfo} from '../../../packages/content/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import type {WorldPhaseView} from '../../../packages/contracts/open-world.ts';
import {ShieldBarTracker} from './shield-feedback.ts';
import {eliteAffixes} from '../../../packages/content/elite-affixes.ts';
import {HitFeedback} from './hit-feedback.ts';
import {physicalBodyMotion} from './physical-motion.ts';
import {physicalAction,physicalMotionFamily} from './physical-actions.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {WorldNumbers,numberKind} from './world-numbers.ts';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
const uiColor=(name:TokenName)=>Number.parseInt(resolvedToken(name).slice(1),16);
const affixTokens:Record<string,TokenName>={swift:'Color.Combat.Affix.Swift',shielded:'Color.Combat.Affix.Shielded',frost_nova:'Color.Combat.Affix.FrostNova',fire_trail:'Color.Combat.Affix.FireTrail',summon_minions:'Color.Combat.Affix.Summon',teleport:'Color.Combat.Affix.Teleport'};
const affixColor=(affix:string):TokenName=>affixTokens[affix]??'Color.Combat.Elite';
import Phaser from 'phaser';
import {skillEmitter} from './projectile-emitter.ts';
import {distance,type World,type Entity} from '../../../packages/simulation/index.ts';
import type {Vec,Reward} from '../../../packages/contracts/index.ts';
import type {Region} from '../../../packages/content/index.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';
import {groundTexture} from './world-art.ts';
import {actorCatalog} from '../../../packages/asset-manifest/actors.ts';
import {ChapterEffects,preloadChapterArt} from './chapter-effects.ts';
import {SkillEffects,preloadSkillEffects,extraClips} from './combat-vfx.ts';

import {effectAttachment,heroAnimationFrame,type SocketName,type RenderPose} from './effect-attachments.ts';
import {WarningUI} from './warning-ui.ts';
import {StoryRenderer,preloadStoryClues} from './story-renderer.ts';
import type {StoryObject,StoryEncounterView} from '../../../packages/contracts/story.ts';
import {type WardrobeRenderState} from './wardrobe-renderer.ts';
import {HeroRenderer as WardrobeRenderer} from './hero-appearance.ts';
import {HeroDeathPlayback} from './hero-death-playback.ts';
import {GroundLootRenderer,preloadGroundLoot} from './ground-loot-renderer.ts';
import {KillSpoils,type SpoilItem} from './kill-spoils.ts';
import {settings} from '../../../packages/content/index.ts';
import {lineOfSight} from '../../../packages/simulation/navigation.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import {preloadStarseaRuntimeAssets,createStarseaAnimations,StarseaNativeActor,StarseaNativeBudget,starseaAsset,starseaAtlasFrame,starseaAtlasSocket,type StarseaSceneView,type StarseaPhase} from './starsea-runtime-assets.ts';
import {gatherArt} from './gather-nodes.ts';
import {edgeResources} from './island-edge.ts';
import {PlaneSceneRenderer} from './plane-scene-renderer.ts';
import type {PlaneMap} from '../../../packages/content/plane-scenes.ts';
import {StarseaWorldRenderer,type StarseaMap} from './starsea-world-renderer.ts';
import {inWorldViewport,cameraView,screenOrigin} from './world-chunks.ts';
import {STAGE,setStageBackdrop} from './stage.ts';
import {StarseaStoryRenderer,starseaPortObjects} from './starsea-story-renderer.ts';
import {QuestGuide} from './quest-guide.ts';
import {InteractBubble} from './interact-bubble.ts';
import {project,unproject} from './iso.ts';
export type {StarseaSceneView,StarseaSceneObject,StarseaSceneActor} from './starsea-runtime-assets.ts';
const catalog={actors:actorCatalog};
export type EffectPresenter={consume(w:World):void;draw(w:World,fraction:number):void;reset():void;destroy():void;diagnostics():any;cameraOffset?:()=>{x:number;y:number}};
export interface ViewBridge{skillSound?:(cue:SoundDispatch,pan:number,visible:boolean)=>void;worldPhase?:()=>WorldPhaseView|undefined;worldMap?:StarseaMap;planeMap?:PlaneMap;interactKey?:()=>string;starSea?:()=>StarseaSceneView|undefined;starSeaInteract?:(id:string)=>void;storyObjects?:()=>StoryObject[];storyEncounter?:()=>StoryEncounterView|undefined;storyInteract?:(id:string)=>void;authoritativeWorld?:boolean;authoritativeSequence?:number;appearanceForActor?:(id:string)=>ResolvedAppearance|undefined;go?:(point:Vec)=>void;selectEnemy?:(id:string)=>void;allowDeathPlayback?:boolean;playbackRate?:number;stepFrames?:number;effectFactory?:(scene:Phaser.Scene,attachment:(id:string,name:SocketName)=>{x:number;y:number}|undefined,pose:()=>RenderPose&{skill:string}|undefined)=>EffectPresenter;/** 野外击杀此刻是否由服务端发奖（开场沙盒、地城结算时为 false），决定要不要蹦金币和强化石。 */killSpoils?:()=>boolean;/** 回执带回的材料，场景取走后在最近一次击杀处蹦出。 */takeSpoils?:()=>SpoilItem[];world:World;rewards:Reward[];panel:string;loggedIn:boolean;resolvedAppearance?:ResolvedAppearance;step():void;interact():void;cast(index:number):void;castAt?:(point:Vec)=>boolean;pause():void;open(panel:string):void;pick(id:string):void;sound(kind:string):void;motionReduced:boolean;}
export {project,unproject} from './iso.ts';
type ActorView={sprite:Phaser.GameObjects.Sprite;shadow:Phaser.GameObjects.Image;hp:Phaser.GameObjects.Graphics;name?:Phaser.GameObjects.Text;status?:Phaser.GameObjects.Text;rim?:Phaser.GameObjects.Sprite[];tags?:Phaser.GameObjects.Text[];tagKey?:string;action:string;facing:number;art:string;deathAt?:number;actionUntil?:number;actionStarted:number;wardrobe?:WardrobeRenderer;native?:StarseaNativeActor};
export class WorldScene extends Phaser.Scene {
 private soundEvents=new CombatSoundEvents();private chapterEffects?:ChapterEffects;private skillEffects?:EffectPresenter;private effectFactory?:ViewBridge['effectFactory'];private vignette?:Phaser.GameObjects.Graphics;private feedback=new HitFeedback(()=>this.bridge.motionReduced);
 private heroCast?:{skill:string;action:'attack'|'skill';started:number;windup:number;end:number;target?:Vec};
 private warningUI?:WarningUI;private storyRenderer?:StoryRenderer;
 private fieldEventEffects?:FieldEventEffects;private loadingRegion=false;private regionGeneration=0;
 private starSeaWorld?:StarseaWorldRenderer;private planeScene?:PlaneSceneRenderer;private starSeaStory?:StarseaStoryRenderer;private starSeaView?:StarseaSceneView;private questGuide?:QuestGuide;private interactBubble?:InteractBubble;private nativeBudget=new StarseaNativeBudget();
 private enemyCasts=new Map<string,{skill:string;started:number;windup:number;end:number}>();
 private pendingInteraction?:{world:World;point:Vec;range:number;valid:()=>boolean;action:()=>void};
 private groundLoot?:GroundLootRenderer;private spoils?:KillSpoils;
 private networkSequence=-1;private partyCasts=new Map<string,{skill:string;action:'attack'|'skill';started:number;windup:number;end:number}>();
 private networkMotion=new AuthoritativeMotion();private renderNow=0;
 private previousWorld?:World;private previous=new Map<string,Vec>();
 private numbers?:WorldNumbers;private damageNumbersCreated=0;private backdropFrames=0;private heroDeathPlayback=new HeroDeathPlayback();
 private chunkDecorations=new Map<string,Phaser.GameObjects.GameObject[]>();private actors=new Map<string,ActorView>();private chunks=new Map<string,Phaser.GameObjects.Container>();private health?:Phaser.GameObjects.Graphics;private groundMarks?:Phaser.GameObjects.Graphics;private shieldBars=new ShieldBarTracker();private logicTimes:number[]=[];private renderTimes:number[]=[];private transient?:Phaser.GameObjects.Graphics;private keys:Record<string,Phaser.Input.Keyboard.Key>={};private regionId='';private accumulator=0;private debugFrame=0;private frames:number[]=[];
 constructor(private bridge:ViewBridge){super('world');}
 private makeEffects(){this.effectFactory=this.bridge.effectFactory;return this.effectFactory?this.effectFactory(this,(id,name)=>this.effectPoint(id,name),()=>this.heroEffectPose()):new SkillEffects(this,()=>this.bridge.motionReduced,(id,name,release)=>this.effectPoint(id,name,release),()=>this.heroEffectPose(),kind=>this.bridge.sound(kind));}
 preload(){
  preloadStoryClues(this);
  preloadGroundLoot(this);
  preloadStarseaRuntimeAssets(this);
  preloadSkillEffects(this);
  this.load.atlas('hero-native-fx','/art/hero-native-fx.png','/art/hero-native-fx.json');
  for(const texture of new Set(Object.entries(catalog.actors).filter(([,a])=>a.source!=='starsea').map(([id,a])=>a.texture??id)))this.load.atlas(texture,'/art/'+texture+'.png','/art/'+texture+'.json');
  preloadChapterArt(this);
  this.load.image('road-ground',environment.textures.road);
  this.load.image('meadow-ground',environment.textures.grass);
  this.load.image('world-props',environment.textures.props);
 }
 create(){
 this.vignette=this.add.graphics().setScrollFactor(0).setDepth(20000);
 this.numbers=new WorldNumbers(this,()=>this.bridge.motionReduced,()=>this.damageNumbersCreated++);
 this.groundLoot=new GroundLootRenderer(this,()=>Boolean(this.bridge.motionReduced));this.spoils=new KillSpoils(this,()=>Boolean(this.bridge.motionReduced));
 this.chapterEffects=new ChapterEffects(this,()=>this.bridge.motionReduced);
 this.skillEffects=this.makeEffects();
 // 初始化预警UI系统
 const gameCanvas=this.game.canvas.parentElement!;
 this.warningUI=new WarningUI(gameCanvas);
 const atlas=this.textures.get('world-props');const frames=environment.frames;for(const [id,[x,y,w,h]] of Object.entries(frames))atlas.add(id,0,x,y,w,h);
 const stamp=this.add.graphics();stamp.fillStyle(0xffffff);stamp.fillEllipse(20,8,40,16);stamp.generateTexture('unit-shadow',40,16);stamp.destroy();this.health=this.add.graphics();this.groundMarks=this.add.graphics();
 for(const [name,a] of Object.entries(catalog.actors))if(a.source!=='starsea')for(const [action,count] of Object.entries(a.actions))this.anims.create({key:name+'-'+action,frames:Array.from({length:count},(_,i)=>({key:a.texture??name,frame:action+'_'+i})),frameRate:a.fps,repeat:['idle','move'].includes(action)?-1:0});
 createStarseaAnimations(this);
 for(const key of ['W','A','S','D','UP','DOWN','LEFT','RIGHT','E','SPACE','ONE','TWO','THREE','FOUR','B','K','ESC'])this.keys[key]=this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes[key as keyof typeof Phaser.Input.Keyboard.KeyCodes]);
 this.input.on('pointerdown',(pointer:Phaser.Input.Pointer,over:Phaser.GameObjects.GameObject[])=>{
   if(this.bridge.panel||!this.bridge.loggedIn)return;
   this.pendingInteraction=undefined;
   const starId=over?.find(o=>o.getData('starsea-object-id'))?.getData('starsea-object-id');if(starId){const object=this.starSeaStory?.object(starId);if(object&&object.enabled!==false&&this.bridge.starSeaInteract)this.walkToInteraction(object.position,2.8,()=>this.starSeaStory?.object(starId)?.enabled!==false,()=>this.bridge.starSeaInteract?.(starId));return;}
   const storyTarget=over?.find(o=>o.getData('story-object-id'))?.getData('story-object-id');if(storyTarget){this.bridge.storyInteract?.(storyTarget);return;}
   const point=unproject({x:pointer.worldX,y:pointer.worldY});if(this.bridge.castAt?.(point))return;if(this.bridge.authoritativeWorld){const portal=this.bridge.world.region.portal;if(portal&&Math.hypot(portal.x-point.x,portal.y-point.y)<4){this.walkToInteraction(portal,4);return;}const enemy=this.bridge.world.enemies.find(e=>e.alive&&Math.hypot(e.position.x-point.x,e.position.y-point.y)<1.2);if(enemy){this.bridge.selectEnemy?.(enemy.id);this.bridge.cast(0);}else this.bridge.go?.(point);return;}
   const w=this.bridge.world;
   const clickedId=over?.find(o=>o.getData('ground-reward-id'))?.getData('ground-reward-id');
   const clickedLoot=this.bridge.rewards.find(r=>r.id===clickedId&&r.region===w.region.id);
   if(clickedLoot){this.walkToInteraction(clickedLoot.position,settings.pickupRadius,()=>this.bridge.rewards.some(r=>r.id===clickedLoot.id),()=>this.bridge.pick(clickedLoot.id));return;}
   
   // 检查是否点击敌人
   const e=w.enemies.find(e=>e.alive&&Math.hypot(e.position.x-point.x,e.position.y-point.y)<1.2);
   if(e){w.targetId=e.id;this.bridge.cast(0);return;}
   
   // 检查是否点击可交互对象
   const interactRange=4;
   const lootRange=settings.pickupRadius;
   const safeRange=3;
   
   // 传送门
   if(w.region.portal&&Math.hypot(w.region.portal.x-point.x,w.region.portal.y-point.y)<interactRange){
     this.walkToInteraction(w.region.portal,interactRange);
     return;
   }
   
   // 首领结界
   if(w.region.bossPortal&&Math.hypot(w.region.bossPortal.x-point.x,w.region.bossPortal.y-point.y)<interactRange){
     this.walkToInteraction(w.region.bossPortal,interactRange);
     return;
   }
   
   // 战利品
   const loot=this.bridge.rewards.find(item=>item.region===w.region.id&&Math.hypot(item.position.x-point.x,item.position.y-point.y)<lootRange);
   if(loot){
     this.walkToInteraction(loot.position,lootRange,()=>this.bridge.rewards.some(r=>r.id===loot.id&&r.region===w.region.id),()=>this.bridge.pick(loot.id));
     return;
   }
   
   // 安全点
   const checkpoint=w.region.landmarks.find(l=>l.kind==='safe'&&Math.hypot(l.x-point.x,l.y-point.y)<safeRange);
   if(checkpoint){
     this.walkToInteraction(checkpoint,safeRange);
     return;
   }

   const forge=w.region.landmarks.find(l=>l.kind==='forge'&&distance(l,point)<interactRange);
   if(forge){this.walkToInteraction(forge,5);return;}
   
   // 默认寻路
   w.go(point);
 });
 this.transient=this.add.graphics();
 // Backing pixels per stage pixel: the camera always shows the same 1280×720 world area.
 const fitZoom=()=>this.cameras.main.setZoom(this.scale.width/STAGE.width);fitZoom();this.scale.on('resize',fitZoom);this.events.once('shutdown',()=>this.scale.off('resize',fitZoom));
 this.events.once('shutdown',()=>{this.spoils?.destroy();this.vignette?.destroy();this.numbers?.destroy();this.questGuide?.destroy();this.interactBubble?.destroy();this.storyRenderer?.destroy();this.starSeaStory?.destroy();this.starSeaWorld?.destroy();this.planeScene?.destroy();this.groundLoot?.destroy();this.skillEffects?.destroy();this.warningUI?.destroy();this.chapterEffects?.destroy();for(const actor of this.actors.values())this.destroyActor(actor);});
 }
 private walkToInteraction(point:Vec,range:number,valid=()=>true,action=()=>this.bridge.interact()){
 const world=this.bridge.world;if(this.bridge.authoritativeWorld)this.bridge.go?.(point);else world.go(point);this.pendingInteraction={world,point,range,valid,action};
 }
 private checkInteraction(){
 const pending=this.pendingInteraction;if(!pending)return;
 const world=this.bridge.world;
 if(pending.world!==world||this.bridge.panel||!this.bridge.loggedIn||!pending.valid()||!this.bridge.authoritativeWorld&&!world.isWalkingTo(pending.point)){this.pendingInteraction=undefined;return;}
 if(world.paused)return;
 if(distance(world.hero.position,pending.point)<pending.range&&lineOfSight(world.region,world.hero.position,pending.point)){this.pendingInteraction=undefined;if(this.bridge.authoritativeWorld)this.bridge.go?.({...world.hero.position});else world.cancelWalk();pending.action();}
 }
 private actor(id:string,hero:boolean,art='raider'):ActorView{
 const pos=project(this.bridge.world.hero.position);const a=(catalog.actors as any)[hero?'hero':art];
 const shadow=this.add.image(pos.x,pos.y,'unit-shadow').setTint(0x284737).setAlpha(.23).setScale(hero?.9:.75);
 const asset=!hero?starseaAsset(art):undefined,native=asset?.runtime.kind==='native'?new StarseaNativeActor(this,asset):undefined;
 const sprite=native?.sprite??this.add.sprite(pos.x,pos.y,a.texture??(hero?'hero':art),a.actionFrames?.idle?.[0]??'idle_0').setOrigin(a.anchor[0],a.anchor[1]).setScale(a.scale);
 const hp=this.health!;const v:ActorView={sprite,shadow,hp,action:'',facing:1,art:hero?'hero':art,actionStarted:this.bridge.world.tick,wardrobe:hero?new WardrobeRenderer(this):undefined,native};this.actors.set(id,v);return v;
 }
 private destroyActor(actor:ActorView){actor.native?.destroy();actor.wardrobe?.destroy();actor.sprite.destroy();actor.shadow.destroy();actor.status?.destroy();actor.name?.destroy();for(const o of [...actor.rim??[],...actor.tags??[]])o.destroy();}
 private drawChunk(r:Region,cx:number,cy:number){
 const items:Phaser.GameObjects.GameObject[]=[];
 const origin=project({x:cx*32,y:cy*32}),key=groundTexture(this,r,cx,cy);
 const ground=this.add.image(origin.x-1281,origin.y-145,key).setOrigin(0).setDepth(-10000);ground.once('destroy',()=>this.textures.remove(key));items.push(ground);
 const chapter=['tundra','abyss','dragonbone'].includes(r.theme);
 const propAt=(x:number,y:number,frame:string,width:number)=>{const p=project({x,y}),theme=environment.themedProps[r.theme as keyof typeof environment.themedProps],mapped=theme&&frame==='oak'?theme.wall:frame;const anchor=environment.anchors[mapped as keyof typeof environment.anchors]??[.5,.91];const image=this.add.image(p.x,p.y+10,'world-props',mapped).setOrigin(anchor[0],anchor[1]);if(theme)image.setTint(theme.tint);image.setScale(width/image.width).setDepth(p.y+1);image.setData('occluder',true);items.push(image);return image;};
 for(const o of r.obstacles){if(Math.floor(o.x/32)!==cx||Math.floor(o.y/32)!==cy)continue;
 if(r.id==='town'){propAt(o.x+o.w/2,o.y+o.h/2,'lodge',(o.w+o.h)*32);}
 else{for(let y=o.y+.8;y<o.y+o.h;y+=2.7)for(let x=o.x+.8;x<o.x+o.w;x+=2.7)propAt(x,y,(Math.floor(x+y)%3===0)?'rocks':'oak',Math.floor(x+y)%3===0?150:240);}
 }
 // Frame the playable boundary; tall decoration never introduces invisible interior blockers.
 for(let n=0;n<r.width;n+=4){for(const y of [-1,r.height+1])if(Math.floor(n/32)===cx&&cy===(y<0?0:Math.ceil(r.height/32)-1))propAt(n,y,n%8?'rocks':'oak',n%8?180:285);}
 for(let n=2;n<r.height;n+=4){for(const x of [-1,r.width+1])if(Math.floor(n/32)===cy&&cx===(x<0?0:Math.ceil(r.width/32)-1))propAt(x,n,n%8===2?'oak':'rocks',n%8===2?275:170);}
 for(const l of r.landmarks){if(Math.floor(l.x/32)!==cx||Math.floor(l.y/32)!==cy)continue;const p=project(l),prop=this.add.graphics();
 if(l.kind==='boss'||l.kind==='portal'){propAt(l.x,l.y,'portal',170).setTint(l.kind==='boss'?0xddaaff:0xffffff);} else if(l.kind==='bridge'){propAt(l.x,l.y,'bridge',140).setDepth(p.y-1).setData('occluder',false);}
 else if(l.kind==='forge'){
 propAt(l.x,l.y,'forge',132);
 }else{
 propAt(l.x,l.y,'sign',66);
 }
 prop.setDepth(p.y);const text=this.add.text(p.x,p.y+18,l.name,{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Body'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),padding:{x:8,y:4}}).setOrigin(0,0).setDepth(p.y+1).setData('world-label',true);text.setPosition(Math.round(p.x-text.width/2),Math.round(p.y+18));items.push(prop,text);
 }
 const container=this.add.container(0,0,items);container.setDepth(-9000); // props promoted below to independent depth sorting
 for(const item of items.slice(1)){container.remove(item);}
 this.chunkDecorations.set(`${cx},${cy}`,items.slice(1));this.chunks.set(`${cx},${cy}`,container); // props are retained per region, terrain chunks can unload independently
 }
 private resetRegion(){this.spoils?.clear();this.networkMotion.reset();this.networkSequence=-1;this.fieldEventEffects?.destroy();this.fieldEventEffects=undefined;this.feedback.reset();this.numbers?.reset();this.questGuide?.destroy();this.questGuide=undefined;this.interactBubble?.destroy();this.interactBubble=undefined;this.storyRenderer?.destroy();this.storyRenderer=undefined;this.starSeaStory?.destroy();this.starSeaStory=undefined;this.starSeaWorld?.destroy();this.starSeaWorld=undefined;this.planeScene?.destroy();this.planeScene=undefined;for(const a of this.actors.values())this.destroyActor(a);this.actors.clear();for(const c of this.chunks.values())c.destroy(true);this.chunks.clear();this.chunkDecorations.clear();this.groundLoot?.clear();
 // Region decoration nodes are tagged separately through their depths.
 this.skillEffects?.destroy();
 for(const child of [...(this.children?.list??[])])child.destroy();
 this.heroCast=undefined;this.chapterEffects=new ChapterEffects(this,()=>this.bridge.motionReduced);this.skillEffects=this.makeEffects();
 this.previous.clear();this.enemyCasts.clear();
 this.vignette=this.add.graphics().setScrollFactor(0).setDepth(20000);this.health=this.add.graphics();this.groundMarks=this.add.graphics();this.shieldBars.clear();this.transient=this.add.graphics();this.regionId=this.bridge.world.region.presentationKey??this.bridge.world.region.id;this.accumulator=0;this.backdropFrames=45;this.cameras.main.setBackgroundColor(environment.themes[this.bridge.world.region.theme as keyof typeof environment.themes]?.background??0x27443b);
 if(this.bridge.planeMap||this.bridge.worldMap||this.regionId.startsWith('ss-map-'))this.loadRegionLayers();
 }
 private loadRegionLayers(){
  const generation=++this.regionGeneration,plane=this.bridge.planeMap,map=plane?undefined:this.bridge.worldMap,region=this.bridge.world.region.id,resources=new Set<string>(plane?plane.resources:map?[map.groundResource,map.backdropResource,map.boundary.resourceId,...edgeResources(map),...map.roads.map(r=>r.resource),...map.decorations.map(d=>d.resourceId),...dressingResources(map)]:[]);
  for(const [key,rows]of Object.entries(worldTables))if(key!=='source')for(const row of rows as any[])if(row.region===region){for(const id of [row.kind==='gather'?gatherArt(row):row.resource,row.openResource,row.activeResource,row.cooldownResource,row.startEffect,row.successEffect,row.failureEffect,row.prop])if(id)resources.add(id);const templates=[...(row.pack??[]),...(row.guards??[]),...(row.waves?.flat()??[]),...(row.template?[{template:row.template}]:[])];for(const spec of templates){const art=this.bridge.world.rules.monsters.templates.find(t=>t.id===spec.template)?.art;if(art)resources.add(art);}}
  for(const spawn of this.bridge.world.region.spawns)if(spawn.art)resources.add(spawn.art);
  for(const enemy of this.bridge.world.enemies)if(enemy.art)resources.add(enemy.art);
  for(const chest of this.bridge.world.region.keyChests??[]){resources.add(chest.resource);resources.add(chest.openResource);}
  for(const object of this.bridge.starSea?.()?.objects??[])resources.add(object.artId);
  const missing=[...resources].some(id=>{const asset=starseaAsset(id);if(!asset)throw Error('Unregistered region resource '+id);const r=asset.runtime;return r.kind==='atlas'?!this.textures.exists(asset.id):r.kind==='prop'&&r.file?!this.textures.exists('starsea-file:'+r.file):r.kind==='effect'&&(r as any).texture?!this.textures.exists('starsea-file:'+(r as any).texture):false;});
  const create=()=>{if(generation!==this.regionGeneration)return;createStarseaAnimations(this);if(plane)this.planeScene=new PlaneSceneRenderer(this,plane);else this.starSeaWorld=new StarseaWorldRenderer(this,region,map);if(!map||!fieldRegionInfo(region)?.qa)this.starSeaStory=new StarseaStoryRenderer(this,this.nativeBudget);this.loadingRegion=false;};
  if(!missing){create();return;}this.loadingRegion=true;
  const status=this.add.text(this.scale.width/2,this.scale.height/2,'正在载入场景 · 0%',{fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Body'),color:resolvedToken('Color.TextPrimary'),backgroundColor:resolvedToken('Color.PanelInset'),padding:{x:12,y:8}}).setOrigin(.5).setScrollFactor(0).setDepth(30000);
  let preview:Phaser.GameObjects.Image|undefined;
  const progress=(n:number)=>{if(generation===this.regionGeneration&&status.active)status.setText('正在载入场景 · '+Math.round(n*100)+'%');};
  const finish=()=>{this.load.off(Phaser.Loader.Events.PROGRESS,progress);status.destroy();preview?.destroy();create();};
  const remaining=()=>{if(generation!==this.regionGeneration){status.destroy();return;}const ground=map&&starseaAsset(map.groundResource);const file=ground?.runtime.file,key=file?'starsea-file:'+file:'';if(key&&this.textures.exists(key))preview=this.add.image(this.scale.width/2,this.scale.height/2,key).setDisplaySize(this.scale.width,this.scale.height).setScrollFactor(0).setDepth(-10000);
   preloadStarseaRuntimeAssets(this,[...resources]);this.load.on(Phaser.Loader.Events.PROGRESS,progress);this.load.once(Phaser.Loader.Events.COMPLETE,finish);this.load.start();};
  if(map){preloadStarseaRuntimeAssets(this,[map.groundResource,map.backdropResource]);this.load.once(Phaser.Loader.Events.COMPLETE,()=>{setTimeout(remaining,0);});this.load.start();}else remaining();
 }
 update(_time:number,delta:number){
 this.renderNow=performance.now();
 const world=this.bridge.world;this.starSeaView=this.bridge.starSea?.();if(this.regionId!==(world.region.presentationKey??world.region.id))this.resetRegion();if(this.loadingRegion)return;
 if(this.previousWorld!==world&&!(this.bridge.authoritativeWorld&&this.previousWorld?.region.id===world.region.id&&world.tick>=this.previousWorld.tick)){this.skillEffects?.reset();this.feedback.reset();this.numbers?.reset();this.heroCast=undefined;this.enemyCasts.clear();this.heroDeathPlayback.reset();this.previous.clear();this.accumulator=0;for(const actor of this.actors.values())this.destroyActor(actor);this.actors.clear();for(const node of [...this.children.list])if(node.getData('damage-number'))node.destroy();this.previousWorld=world;}
 this.previousWorld=world;
 if(this.effectFactory!==this.bridge.effectFactory){this.skillEffects?.destroy();this.skillEffects=this.makeEffects();}
 const panel=Boolean(this.bridge.panel),focus=document.activeElement?.tagName;const inputBlocked=panel||focus==='INPUT'||focus==='SELECT'||!this.bridge.loggedIn;
 const logicStart=performance.now(),retainedFraction=this.accumulator,singleStep=(this.bridge.stepFrames??0)>0;
 if(this.bridge.authoritativeWorld){this.bridge.step();if(this.networkSequence!==this.bridge.authoritativeSequence){this.networkSequence=this.bridge.authoritativeSequence??0;const positions:[string,Vec][]=[['hero',world.hero.position],...world.enemies.map(e=>[e.id,e.position] as [string,Vec]),...[...world.players.values()].filter(p=>p.id!==world.playerId).map(p=>[p.id,p.hero.position] as [string,Vec])];this.networkMotion.accept(world.tick,positions,this.renderNow);this.consume(world);}this.accumulator=this.networkMotion.fraction(this.renderNow)*(1000/30);this.checkInteraction();}
 else if(this.networkSequence!==-1){this.networkMotion.reset();this.networkSequence=-1;this.accumulator=0;this.previous.clear();}
 if(singleStep&&!this.bridge.authoritativeWorld){this.bridge.stepFrames!--;world.paused=false;this.accumulator=1000/30;}
 if(!this.bridge.authoritativeWorld&&!singleStep&&!world.paused&&world.hero.hp>0)this.accumulator=Math.min(100,this.accumulator+delta*(this.bridge.playbackRate??1));
 while(!this.bridge.authoritativeWorld&&this.accumulator>=1000/30){
  const previous=new Map<string,Vec>([['hero',{...world.hero.position}]]);for(const e of world.enemies)previous.set(e.id,{...e.position});
  const tick=world.tick;this.bridge.step();
  if(world.tick===tick){this.accumulator=retainedFraction;break;}
  this.previous=previous;this.checkInteraction();this.consume(world);this.accumulator-=1000/30;
 }
 if(singleStep)world.paused=true;
 this.heroDeathPlayback.advance(world.hero.hp<=0,delta,world.paused&&!this.bridge.allowDeathPlayback,this.bridge.playbackRate??1,singleStep,this.actors.get('hero')?.wardrobe?.actionDuration('death')??1.5);
 this.logicTimes.push(performance.now()-logicStart);if(this.logicTimes.length>600)this.logicTimes.shift();const renderStart=performance.now();
 const p=project(this.interpolate('hero',world.hero.position));const shake=this.skillEffects?.cameraOffset?.()??{x:0,y:0};this.cameras.main.centerOn(p.x+shake.x,p.y-15+shake.y);
 // Letterbox backdrop: one capture per map once its chunks have streamed in, never per frame.
 if(this.backdropFrames>0&&--this.backdropFrames===0)this.game.events.once(Phaser.Core.Events.POST_RENDER,()=>setStageBackdrop(this.game.canvas));
 const cx=Math.floor(world.hero.position.x/32),cy=Math.floor(world.hero.position.y/32);
 this.nativeBudget.begin(1+[...world.players.values()].filter(player=>player.id!==world.playerId&&world.isActive(player.id)).length);
 if(this.planeScene)this.planeScene.draw(world.hero.position);else if(this.starSeaWorld)this.starSeaWorld.draw(world.hero.position,this.bridge.worldPhase?.());else{
 for(let y=Math.max(0,cy-1);y<=Math.min(Math.ceil(world.region.height/32)-1,cy+1);y++)for(let x=Math.max(0,cx-1);x<=Math.min(Math.ceil(world.region.width/32)-1,cx+1);x++)if(!this.chunks.has(`${x},${y}`))this.drawChunk(world.region,x,y);
 for(const [key,c] of this.chunks){const [x,y]=key.split(',').map(Number);if(Math.abs(x-cx)>1||Math.abs(y-cy)>1){c.destroy(true);for(const decoration of this.chunkDecorations.get(key)??[])decoration.destroy();this.chunkDecorations.delete(key);this.chunks.delete(key);}}
 }
 this.health!.clear().setDepth(9000);this.groundMarks?.clear().setDepth(-8000);this.syncActor('hero',world.hero.position,world.hero.hp<=0?'death':world.hero.action,world.hero.facing,world.hero.hp,world.stats.hp,true,false,false,'hero',world.hero.actionUntil);
 const partyIds=new Set<string>();for(const player of world.players.values())if(player.id!==world.playerId&&world.isActive(player.id)){partyIds.add(player.id);this.syncActor(player.id,player.hero.position,player.hero.hp<=0?'death':player.hero.action,player.hero.facing,player.hero.hp,player.stats.hp,true,false,false,'hero',player.hero.actionUntil);}
 for(const [id,actor] of this.actors)if(id!=='hero'&&actor.art==='hero'&&!partyIds.has(id)){this.destroyActor(actor);this.actors.delete(id);this.partyCasts.delete(id);}
 for(const e of world.enemies){
 if(world.region.activationRadius&&!inWorldViewport(e.position,cameraView(this.cameras.main))){const old=this.actors.get(e.id);if(old){this.destroyActor(old);this.actors.delete(e.id);}continue;}
 const view=this.actors.get(e.id),profile=(catalog.actors as any)[e.art];
 if(!e.alive){if(!view)continue;view.deathAt??=world.tick;
  if(world.tick-view.deathAt>=Math.ceil((view.native?.duration('death')??profile.actions.death/profile.fps)*30)+6){this.destroyActor(view);this.actors.delete(e.id);continue;}}
 this.syncActor(e.id,e.position,e.alive?e.action:'death',e.facing,e.hp,e.maxHp,false,e.elite,e.boss,e.art,e.actionUntil,e.currentPhase??1,e.shield??0,e.monster?.affixes??[]);
 }
 for(const child of (this.children?.list??[])){if(child instanceof Phaser.GameObjects.Image&&child.getData('occluder')){const b=child.getBounds();const hidden=b.contains(p.x,p.y-35)&&child.depth>p.y;child.setAlpha(hidden?.42:1);}}
 this.fieldEventEffects??=new FieldEventEffects(this);this.fieldEventEffects.draw(this.starSeaView?.effects??[],world.tick);
 if(this.starSeaStory)this.starSeaStory.draw(this.starSeaView?.objects??starseaPortObjects(this.starSeaWorld?.mapData),world.tick,world.hero.position);else if(this.bridge.storyObjects){this.storyRenderer??=new StoryRenderer(this);this.storyRenderer.draw(this.bridge.storyObjects(),this.bridge.storyEncounter?.(),world.tick);}
 if(this.starSeaView?.guide||this.questGuide){this.questGuide??=new QuestGuide(this);const guide=this.starSeaView?.guide,near=this.starSeaView?.prompt;this.questGuide.draw(world,guide,Boolean(guide&&near&&Math.hypot(guide.x-near.x,guide.y-near.y)<1.5));}
 const prompt=this.starSeaView?.prompt;if(prompt||this.interactBubble){this.interactBubble??=new InteractBubble(this);this.interactBubble.draw(prompt,this.bridge.interactKey?.()??'E',world.tick,prompt?.objectId?this.starSeaStory?.labelTop(prompt.objectId):undefined);}
 this.drawEffects(world);
 // 渲染预警UI
 if(this.warningUI){
   this.warningUI.render(world);
 }
 this.syncLoot();this.renderTimes.push(performance.now()-renderStart);if(this.renderTimes.length>600)this.renderTimes.shift();this.frames.push(delta);if(this.frames.length>600)this.frames.shift();this.debugFrame++;
 if(import.meta.env.DEV&&this.debugFrame%60===0)this.game.canvas.dataset.artDiagnostics=JSON.stringify({region:world.region.id,hero:{position:world.hero.position,frame:this.actors.get('hero')?.wardrobe?.frameName},environment:environment.version,story:this.storyRenderer?.diagnostics(),spoils:this.spoils?.diagnostics(),metrics:this.metrics()});
 }
 private interpolate(id:string,pos:Vec){if(this.bridge.authoritativeWorld)return this.networkMotion.position(id,pos,this.renderNow);const previous=this.previous.get(id);if(!previous)return pos;const a=this.accumulator/(1000/30);return {x:previous.x+(pos.x-previous.x)*a,y:previous.y+(pos.y-previous.y)*a};}
 private syncActor(id:string,pos:Vec,action:string,facing:number,hp:number,max:number,hero=false,elite=false,boss=false,art='raider',actionUntil=0,phase=1,shield=0,affixes:readonly string[]=[]){const a=this.actors.get(id)??this.actor(id,hero,art),p=project(this.interpolate(id,pos));a.sprite.setPosition(p.x,p.y).setDepth(p.y+2);a.shadow.setPosition(p.x,p.y+2).setDepth(p.y-1);
// 星潮海首领等原生骨骼角色由原生绘制器画进自己的画布：不能换成图集贴图、翻转或播放图集动画。
 const profile=(catalog.actors as any)[a.art],sizeFactor=elite&&!boss?1.15:1;if(!a.native){if(a.sprite.texture.key!==(profile.texture??a.art)){a.sprite.setTexture(profile.texture??a.art,'idle_0');a.action='';}const flip=profile.nativeFacing===-1?facing>0:facing<0;a.sprite.setFlipX(flip);a.sprite.setOrigin(flip?1-profile.anchor[0]:profile.anchor[0],profile.anchor[1]);a.sprite.setScale(profile.scale*sizeFactor);}a.sprite.clearTint();a.shadow.setScale(hero?.9:boss?1.35:elite?1:.75);
 if(hp>0&&boss){a.hp.lineStyle(3,uiColor('Color.Combat.Boss'),.85);a.hp.strokeEllipse(p.x,p.y+2,84,28);}
 if(hp>0&&elite&&!boss)this.drawEliteRing(p,Math.max(.9,Math.min(1.6,(profile.displayHeight??80)/80)));
 if(!hero&&hp>0&&['attack','hurt','skill'].includes(action)&&actionUntil<this.bridge.world.tick)action='idle';
 if(a.action!==action||(['attack','hurt','skill'].includes(action)&&a.actionUntil!==actionUntil)){a.action=action;a.actionStarted=this.bridge.world.tick;a.actionUntil=actionUntil;if(!a.native){a.sprite.play(a.art+'-'+action,false);a.sprite.anims.timeScale=['attack','hurt','skill'].includes(action)?(profile.actions[action]/profile.fps)/Math.max(1/30,(actionUntil-this.bridge.world.tick)/30):1;}}
 if(a.native)a.native.sync(id,p,action,this.feedback.animationAge(id,a.actionStarted,this.bridge.world.tick+this.accumulator/(1000/30))/30,facing,phase>=2&&action!=='death'?'phase-active':'default',this.nativeBudget);
 const activeCast=id==='hero'?this.heroCast:this.partyCasts.get(id);
 const castTarget=id==='hero'?this.heroCast?.target:undefined;
 const motion=hero&&activeCast?physicalBodyMotion(activeCast.skill,this.bridge.world.tick+this.accumulator/(1000/30)-activeCast.started,activeCast.windup,castTarget?{x:project(castTarget).x-p.x,y:project(castTarget).y-p.y}:{x:facing,y:0},this.bridge.motionReduced):{x:0,y:0,groundY:0};
 if(hero)a.shadow.setPosition(p.x+motion.x,p.y+motion.groundY+2);
 if(hero&&activeCast&&this.bridge.world.tick<=activeCast.end){
  const cast=activeCast,elapsed=this.feedback.animationAge(id,cast.started,this.bridge.world.tick+this.accumulator/(1000/30));
  a.sprite.anims.stop();const castFrame=cast.action+'_'+heroAnimationFrame(cast.action,elapsed,cast.windup,8);if(a.sprite.texture.has(castFrame))a.sprite.setFrame(castFrame);a.action=cast.action;
 }else if(this.bridge.world.paused||this.feedback.state(id,this.bridge.world.tick).paused)a.sprite.anims.pause();else a.sprite.anims.resume();
 if(hero&&a.wardrobe){
  const appearance=this.bridge.appearanceForActor?.(id)??this.bridge.resolvedAppearance;
  if(appearance){
   void a.wardrobe.setAppearance(appearance);
   const now=this.bridge.world.tick+this.accumulator/(1000/30);
   const state:WardrobeRenderState={action:action as WardrobeRenderState['action'],clock:hp<=0?this.heroDeathPlayback.elapsed:this.feedback.animationAge(id,a.actionStarted,now)/30,facing};
   if(activeCast&&now<=activeCast.end&&hp>0&&action!=='hurt'){
    const cast=activeCast;
    state.action=physicalAction(cast.skill,skillEmitter(cast.skill)?.action??cast.action);
    state.motionFamily=physicalMotionFamily(cast.skill,appearance.family);
    state.skill=cast.skill;state.reducedMotion=this.bridge.motionReduced;
    state.cast={elapsed:Math.max(0,now-cast.started)/30,windup:cast.windup/30,recovery:8/30};
   }
   a.wardrobe.update(state,{x:p.x+motion.x,y:p.y+motion.y});a.sprite.setVisible(!a.wardrobe.ready);
  }else{a.wardrobe.sprite.setVisible(false);a.sprite.setVisible(true);}
 }
 if(!hero&&boss&&hp>0)this.applyBossCast(a,id,art,profile.displayHeight??256);
 const feedback=this.feedback.state(id,this.bridge.world.tick+this.accumulator/(1000/30));
 if(a.native)a.sprite.setScale(1);a.sprite.setPosition(p.x+feedback.x+motion.x,p.y+feedback.y+motion.y).setScale(a.sprite.scaleX*feedback.scaleX,a.sprite.scaleY*feedback.scaleY);
 if(a.wardrobe)a.wardrobe.sprite.setPosition(p.x+feedback.x+motion.x,p.y+feedback.y+motion.y).setScale(feedback.scaleX,feedback.scaleY);
 for(const sprite of [a.sprite,a.wardrobe?.sprite])if(sprite){if(feedback.tint!==undefined)sprite.setTint(feedback.tint).setTintMode(feedback.fill?Phaser.TintModes.FILL:Phaser.TintModes.MULTIPLY);else sprite.clearTint();}
 this.syncEliteRim(a,elite&&!boss&&hp>0&&!a.native&&a.sprite.visible);
 const sourceId=id==='hero'?this.bridge.world.playerId:id,labels:Record<string,string>={burn:'燃烧',poison:'中毒',slow:'减速',stun:'眩晕',silence:'沉默',petrify:'石化',fear:'恐惧',root:'束缚',blind:'致盲',time_stop:'停滞',attack_up:'攻击↑',speed_up:'移速↑',armor_down:'护甲↓',counter:'反击',immunity:'物免',guardian:'守护',regen:'再生',bleed:'流血',freeze:'冰冻',vulnerable:'易伤',shock:'感电'},statuses=this.bridge.world.statuses.filter(s=>s.targetId===sourceId&&s.ends>this.bridge.world.tick);
 if(statuses.length&&hp>0){const kinds=[...new Set(statuses.map(s=>s.effect.kind))],text=kinds.map(kind=>labels[kind]+(statuses.filter(s=>s.effect.kind===kind).length>1?' ×'+statuses.filter(s=>s.effect.kind===kind).length:'')+' '+(Math.max(...statuses.filter(s=>s.effect.kind===kind).map(s=>s.ends-this.bridge.world.tick))/30).toFixed(1)+'秒').join(' · ');a.status??=this.add.text(0,0,'',{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Caption'),color:resolvedToken('Color.World.Text'),stroke:resolvedToken('Color.World.Ink'),strokeThickness:2}).setOrigin(.5);a.status.setText(text).setPosition(p.x,p.y-(hero?122:profile.displayHeight*sizeFactor+22+(elite&&!boss?(affixes.length?18:4):0)+(shield>0?6:0))).setDepth(p.y+5).setVisible(true);}else a.status?.setVisible(false);

 const plate=elite&&!boss;
 if(hp>0){const y=p.y-(hero?104:profile.displayHeight*sizeFactor+10),width=boss?76:plate?58:42,height=plate?7:5,inner=height-2,x0=p.x-width/2;
  a.hp.fillStyle(uiColor('Color.PanelInset'),.9);a.hp.fillRoundedRect(x0,y,width,height,2);if(plate)a.hp.lineStyle(1.5,uiColor('Color.Combat.EliteFrame'),1).strokeRoundedRect(x0-.5,y-.5,width+1,height+1,2.5);
  const trail=this.feedback.trailHp(id,hp,this.bridge.world.tick);a.hp.fillStyle(uiColor('Color.Combat.HealthTrail'),.85);a.hp.fillRoundedRect(x0+1,y+1,(width-2)*Math.min(1,trail/max),inner,1);a.hp.fillStyle(uiColor(hero?'Color.Vital.Health':elite&&!plate?'Color.Combat.Elite':'Color.Combat.EnemyHealth'));a.hp.fillRoundedRect(x0+1,y+1,(width-2)*hp/max,inner,1);
  // Scheme C: the shield is its own strip above the HP bar, full at its raised total.
  const ratio=this.shieldBars.ratio(id,id==='hero'?this.bridge.world.hero.shield:shield);let top=y;
  if(ratio>0){top=y-6;a.hp.fillStyle(uiColor('Color.PanelInset'),.9).fillRoundedRect(x0,top,width,5,2);a.hp.fillStyle(uiColor('Color.Combat.Shield'),1).fillRect(x0+1,top+1,(width-2)*ratio,3);a.hp.fillStyle(uiColor('Color.World.Text'),.95).fillRect(x0+(width-2)*ratio,top,2,5);}
  if(plate){this.drawCrown(x0-10,y+height/2);this.syncAffixTags(a,affixes,p.x,top-3,p.y);}
 }else for(const tag of a.tags??[])tag.setVisible(false);
 }
 private drawCrown(x:number,y:number){const g=this.health!;g.fillStyle(uiColor('Color.Combat.EliteFrame'),1).lineStyle(1,uiColor('Color.World.Ink'),.9);const pts=[{x:x-6,y:y+4},{x:x-6,y:y-3},{x:x-3,y},{x,y:y-6},{x:x+3,y},{x:x+6,y:y-3},{x:x+6,y:y+4}].map(q=>new Phaser.Math.Vector2(q.x,q.y));g.fillPoints(pts,true);g.strokePoints(pts,true);}
 /** Elite ground mark: soft gold disc, solid outer ring, rotating dashed inner ring and four studs. */
 private drawEliteRing(p:{x:number;y:number},s:number){const g=this.groundMarks;if(!g)return;const t=this.bridge.motionReduced?0:this.bridge.world.tick+this.accumulator/(1000/30),gold=uiColor('Color.Combat.Elite'),frame=uiColor('Color.Combat.EliteFrame'),cx=p.x,cy=p.y+2,rx=36*s,ry=12*s;
  g.fillStyle(gold,.16+.05*Math.sin(t*.1)).fillEllipse(cx,cy,rx*2,ry*2);g.lineStyle(2.5,gold,.9).strokeEllipse(cx,cy,rx*2,ry*2);
  g.lineStyle(1.2,gold,.75);for(let i=0;i<12;i++){const a0=i*Math.PI/6+t*.02;g.beginPath();for(let k=0;k<=4;k++){const a=a0+k*Math.PI/24,x=cx+Math.cos(a)*rx*.8,y=cy+Math.sin(a)*ry*.8;if(k)g.lineTo(x,y);else g.moveTo(x,y);}g.strokePath();}
  g.fillStyle(frame,1).lineStyle(1,uiColor('Color.World.Text'),.9);for(let i=0;i<4;i++){const a=i*Math.PI/2+.4-t*.012,x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry,pts=[{x,y:y-4},{x:x+3,y},{x,y:y+4},{x:x-3,y}].map(q=>new Phaser.Math.Vector2(q.x,q.y));g.fillPoints(pts,true);g.strokePoints(pts,true);}}
 /** Gold rim light: four tint-filled copies of the current frame offset around the sprite. */
 private syncEliteRim(a:ActorView,on:boolean){if(!on){for(const r of a.rim??[])r.setVisible(false);return;}
  const src=a.sprite,t=this.bridge.motionReduced?0:this.bridge.world.tick,alpha=.5+.12*Math.sin(t*.12);a.rim??=[[-2,0],[2,0],[0,-2],[0,2]].map(([dx,dy])=>this.add.sprite(0,0,src.texture.key).setData('rim',[dx,dy]));
  for(const r of a.rim){const [dx,dy]=r.getData('rim') as number[];r.setTexture(src.texture.key,src.frame.name).setOrigin(src.originX,src.originY).setFlipX(src.flipX).setScale(src.scaleX,src.scaleY).setPosition(src.x+dx,src.y+dy).setDepth(src.depth-.01).setTint(uiColor('Color.Combat.Elite')).setTintMode(Phaser.TintModes.FILL).setAlpha(alpha).setVisible(true);}}
 /** Affix tags: one tinted pill per affix, centred above the bar (bottom edge at `bottom`). */
 private syncAffixTags(a:ActorView,affixes:readonly string[],x:number,bottom:number,depthY:number){
  const key=affixes.join('|');if(a.tagKey!==key){for(const tag of a.tags??[])tag.destroy();a.tagKey=key;a.tags=affixes.map(affix=>this.add.text(0,0,(eliteAffixes as Record<string,{name:string}>)[affix]?.name??affix,{resolution:worldTextResolution(),fontFamily:resolvedToken('Font.Family'),fontSize:resolvedToken('Font.Size.Micro'),fontStyle:'bold',color:resolvedToken('Color.World.Ink')}).setOrigin(.5,1).setData('affix',affix));}
  const tags=a.tags??[];if(!tags.length)return;const pad=5,gap=3,widths=tags.map(t=>t.width+pad*2),total=widths.reduce((n,w)=>n+w,0)+gap*(tags.length-1);let left=x-total/2;
  for(const [i,tag] of tags.entries()){const w=widths[i],h=tag.height+2,cx=left+w/2;this.health!.fillStyle(uiColor(affixColor(tag.getData('affix'))),.95).fillRoundedRect(left,bottom-h,w,h,h/2);this.health!.lineStyle(1,uiColor('Color.World.Ink'),.55).strokeRoundedRect(left,bottom-h,w,h,h/2);tag.setPosition(Math.round(cx),Math.round(bottom-1)).setDepth(9001+depthY*1e-6).setVisible(true);left+=w+gap;}
 }
 private consume(world:World){for(const event of world.events)if(event.type==='cast_started'&&event.id!=='hero'&&world.players.has(event.id)&&event.skill)this.partyCasts.set(event.id,{skill:event.skill,action:skillEmitter(event.skill)?.action==='projectile'||event.skill==='cut'?'attack':'skill',started:event.tick,windup:event.windup??1,end:event.tick+(event.windup??1)+8});for(const event of world.events)if(event.type==='cast_started'&&event.id==='hero'&&event.skill){const skill=world.skills.find(s=>s.id===event.skill)!,emitter=skillEmitter(skill.id);const attack=emitter?emitter.action==='projectile':['single','area','dash'].includes(skill.kind)&&!['cleave','ground_slam','nova'].includes(skill.id);this.heroCast={skill:event.skill,action:attack?'attack':'skill',started:event.tick,windup:event.windup??1,end:event.tick+(event.windup??1)+8,target:event.target};}
 this.feedback.consume(world);
 this.skillEffects?.consume(world);
 for(const cue of this.soundEvents.consume(world)){const point=project(cue.position),camera=this.cameras.main,view=camera.worldView;this.bridge.skillSound?.(cue,(point.x-view.x)/view.width*1.2-.6,view.contains(point.x,point.y));}
 const deaths=new Set(world.events.filter(e=>e.type==='entity_died').map(e=>`${e.tick}:${e.id}`));
 for(const e of world.events){
  const kind=numberKind(e,deaths);if(kind){const p=this.effectPoint(e.id,'chest')??project(e.position);this.numbers?.spawn(kind,e,p);}
  if(e.type==='hit_resolved'&&(e.amount??0)>0){if(e.id==='hero')this.bridge.sound('hurt');else if((e.sourceId==='hero'||e.sourceId===world.playerId||!e.sourceId)&&!deaths.has(`${e.tick}:${e.id}`))this.bridge.sound(e.crit?'crit':'hit');}
  if(e.type==='shielded'&&e.id==='hero'&&e.shieldPhase)this.bridge.sound(e.shieldPhase==='applied'?'shield-up':'shield-hit');
  if(e.type==='missed'||e.type==='status_changed'&&e.skill==='dodge')this.bridge.sound('miss');
  if(e.type==='entity_died'&&this.bridge.killSpoils?.()&&world.enemies.some(n=>n.id===e.id&&n.reward))this.spoils?.kill(project(e.position));
  if(e.type==='danger_started'&&!this.bridge.skillSound)this.bridge.sound('danger');if(e.type==='cast_started'&&e.id==='hero'&&!this.bridge.skillSound)this.bridge.sound('cast');if(e.type==='entity_died')this.bridge.sound('kill');
 }
 }
 private applyBossCast(a:ActorView,id:string,art:string,height:number){
  const key=art==='frost_queen'?'frost-queen-cast':art==='abyss_lord'?'abyss-lord-cast':['dragon_king','ancient_dragon_king'].includes(art)?'dragon-king-cast':'';
  const clip=extraClips[key],cast=this.bridge.world.bossCasts.filter(c=>c.owner===id&&!c.interrupted&&this.bridge.world.tick<c.ends+32).at(-1);if(!clip||!cast)return;
  const now=this.bridge.world.tick+this.accumulator/(1000/30),elapsed=now-cast.started,windup=cast.ends-cast.started;
  const physical=['claw_swipe','tail_slam','dive_bomb','dragon_roar'].includes(cast.skill);
  const frame=physical?(now<cast.ends?Math.min(5,Math.floor(elapsed/Math.max(1,windup/6))):16+Math.min(7,Math.floor((now-cast.ends)/3))):now<cast.ends?Math.min(7,Math.floor(elapsed/Math.max(1,Math.min(2,windup/8)))):8+Math.min(15,Math.floor((now-cast.ends)/2));
  a.sprite.anims.stop();a.sprite.setTexture(clip.key,String(frame)).setOrigin(clip.origin[0],clip.origin[1]).setScale(height/clip.visibleHeight);
 }
 private actorPose(id:string):RenderPose|undefined{const view=this.actors.get(id);if(!view)return;const castClip=Object.values(extraClips).find(c=>c.kind==='boss'&&c.key===view.sprite.texture.key);if(castClip){const sprite=view.sprite,index=Number(sprite.frame.name),released=index>=8&&index<16,dragon=sprite.texture.key.includes('dragon'),pose:RenderPose={art:view.art,frame:String(sprite.frame.name),position:{x:sprite.x,y:sprite.y},scale:sprite.scaleX,flip:sprite.flipX};pose.socket=name=>{if(name==='feet')return pose.position;const uv=name==='chest'?[.5,.61]:name==='muzzle'?dragon?[.87,[.75,.71,.60,.49,.42,.39,.43,.47,.53,.55,.56,.55,.54,.53,.49,.47,.46,.49,.54,.60,.66,.71,.76,.79][index]??.5]:[released?.78:.69,released?.55:.36]:name==='weapon'?[.74,released?.56:.28]:[.61,.61];return {x:sprite.x+(uv[0]-sprite.originX)*castClip.cell*sprite.scaleX*(sprite.flipX?-1:1),y:sprite.y+(uv[1]-sprite.originY)*castClip.cell*sprite.scaleY};};return pose;}if(view.wardrobe?.sprite.visible){const pose=view.wardrobe.pose();if(pose)return pose;}return {art:view.art,frame:String(view.sprite.frame.name),position:{x:view.sprite.x,y:view.sprite.y},scale:view.sprite.scaleX,flip:view.sprite.flipX};}
 private effectPoint(id:string,name:SocketName,release=false){const pose=this.actorPose(id);if(!pose)return;const cast=id==='hero'?this.heroCast:this.partyCasts.get(id),frame=release?(pose.releaseFrame??(!pose.socket&&cast&&this.bridge.world.tick<=cast.end?cast.action+'_'+heroAnimationFrame(cast.action,cast.windup,cast.windup,8):pose.frame)):pose.frame;return effectAttachment({...pose,frame},name);}
 private heroEffectPose(){const pose=this.actorPose('hero'),cast=this.heroCast,view=this.actors.get('hero'),sprite=view?.wardrobe?.sprite.visible?view.wardrobe.sprite:view?.sprite;return pose?{...pose,image:sprite?{texture:sprite.texture.key,frame:sprite.frame.name,originX:sprite.originX,originY:sprite.originY,scaleX:sprite.scaleX,scaleY:sprite.scaleY,flipX:sprite.flipX,flipY:sprite.flipY}:undefined,releaseFrame:pose.releaseFrame??(!pose.socket&&cast&&this.bridge.world.tick<=cast.end?cast.action+'_'+heroAnimationFrame(cast.action,cast.windup,cast.windup,8):undefined),skill:cast?.skill??''}:undefined;}
 private drawEffects(w:World){const g=this.transient!;g.clear().setDepth(8000);
 this.chapterEffects?.draw(w);this.skillEffects?.draw(w,this.accumulator/(1000/30));
 const overlay=this.vignette?.clear(),alpha=this.feedback.vignette(w.tick),camera=this.cameras.main;if(overlay&&alpha>0){const width=camera.width/camera.zoom,height=camera.height/camera.zoom,origin=screenOrigin(camera);overlay.setPosition(origin.x,origin.y);for(let i=0;i<12;i++){const inset=i*5;overlay.fillStyle(uiColor('Color.Combat.DamageTaken'),alpha*(1-i/12)**2);overlay.fillRect(inset,inset,5,height-inset*2);overlay.fillRect(width-inset-5,inset,5,height-inset*2);overlay.fillRect(inset,inset,width-inset*2,5);overlay.fillRect(inset,height-inset-5,width-inset*2,5);}}
 this.numbers?.update(w.tick+(w.paused?0:this.accumulator/(1000/30)));
 if(w.mode==='auto'){const p=project(w.anchor);g.lineStyle(2,0x598879,.35);g.strokeEllipse(p.x,p.y,w.radius*85,w.radius*48);}
 }
 private syncLoot(){const hero=project(this.bridge.world.hero.position);this.groundLoot?.update(this.bridge.rewards,this.regionId,hero);const got=this.bridge.takeSpoils?.();if(got?.length)this.spoils?.materials(got);this.spoils?.update(hero);}

 /** Stage pixels (1280×720 space). */
 screen(p:Vec){const q=project(p),v=cameraView(this.cameras.main);return {x:q.x-v.x,y:q.y-v.y};}
 attachmentDiagnostics(){const pose=this.actorPose('hero');return {pose,cast:this.heroCast,effects:this.skillEffects?.diagnostics(),damageNumbers:{totalCreated:this.damageNumbersCreated,active:(this.children?.list??[]).filter(child=>child.getData('damage-number')).length},wardrobe:this.actors.get('hero')?.wardrobe?.diagnostics(),points:pose?Object.fromEntries((['feet','chest','hand','muzzle','weapon'] as SocketName[]).map(name=>[name,effectAttachment(pose,name)])):null,native:(this.children?.list??[]).filter(child=>child instanceof Phaser.GameObjects.Image&&child.texture.key==='hero-native-fx').map(child=>{const image=child as Phaser.GameObjects.Image;return {visible:image.visible,frame:image.frame.name,x:image.x,y:image.y,depth:image.depth,width:image.width,height:image.height,scale:image.scaleX,origin:[image.displayOriginX,image.displayOriginY],trim:{real:[image.frame.realWidth,image.frame.realHeight],sprite:[image.frame.x,image.frame.y,image.frame.width,image.frame.height]}};})};}
 metrics(){const sorted=[...this.frames].sort((a,b)=>a-b);return {frames:this.frames.length,p95:sorted[Math.floor(sorted.length*.95)]??0,logic_p95:[...this.logicTimes].sort((a,b)=>a-b)[Math.floor(this.logicTimes.length*.95)]??0,scene_p95:[...this.renderTimes].sort((a,b)=>a-b)[Math.floor(this.renderTimes.length*.95)]??0,actors:this.actors.size,terrain:this.starSeaWorld?.diagnostics(),simulation:this.bridge.world.simulationDiagnostics(),loot:this.groundLoot?.diagnostics(),chunks:this.chunks.size,children:this.children?.length??0};}
}
