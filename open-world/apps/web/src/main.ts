import {placeNotification} from './hud-avoidance.ts';
import {interactionReach,reachableApproach} from '../../../packages/rules/world-interactions.ts';
import {project as audioProject} from './iso.ts';
import {receiptSound} from './audio/receipt-sounds.ts';
import {ProductionAudio} from './audio/production.ts';
import {mountUiAudio} from './ui-components.ts';
import {combatAdviceDestination} from './combat-review-view.ts';
import {FieldAutomationPreferences} from './field-automation-preferences.ts';
import {newCombatReview,observeCombatReview,currentCombatReview,type CombatReviewRecord} from '../../../packages/simulation/combat-review.ts';
import {fieldMaps as registeredFieldMaps,planeMaps} from '../../../packages/content/open-world/index.ts';
import {planeLayoutMap} from '../../../packages/content/plane-layouts.ts';
import {fieldRegionInfo} from '../../../packages/content/index.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {FieldActivities} from './field-activities.ts';
import './damage-breakdown.css';
import {seaDifficultyView} from './sea-difficulty-view.ts';
import {bountyView,nearbyOutpost,readyBounties} from './bounty-view.ts';
import {defaultPickupFilter,pickupFilterSchema,acceptsPickup,type PickupFilter} from '../../../packages/rules/pickup-filter.ts';
import {mainHandWeapon} from '../../../packages/rules/weapon-skills.ts';
import {npcs as npcRows} from '../../../packages/content/task-tables.ts';
import type {SoundDispatch} from './audio/combat-sound-events.ts';
import {CombatAudio} from './combat-audio.ts';
import {keyLabel} from './ui/settings-panel.ts';
import Phaser from 'phaser';
import {StoryController} from './story-controller.ts';
import {StarseaController} from './starsea-controller.ts';
import {PrologueController} from './prologue-controller.ts';
import {starseaHub,starseaIslands,isStarseaRegion} from '../../../packages/content/starsea/index.ts';
import {DungeonController} from './dungeon-controller.ts';
import {BattleResultController} from './battle-result-controller.ts';
import {bagFull,fullBagMessage} from './field-readiness.ts';
import {hudContext} from './hud-context.ts';
import './ui-entry.css';
import './stage.css';
import {STAGE,mountStage,onStageChange,stageLayout} from './stage.ts';
import {loadWorldFont} from './ui/world-text.ts';
import {handleUITabKey,handleUIDialogKey,setFieldFeedback,observeUITabOrientation} from './ui/interaction.ts';
import {TaskController} from './task-controller.ts';
import {AppearanceController} from './appearance-controller.ts';
import {appearanceSlots,type ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import {appearanceRenderKey} from './wardrobe-renderer.ts';
import {HeroPreview} from './hero-appearance.ts';
import {ProgressionController} from './progression-controller.ts';
import {ChallengeController} from './progression-challenges.ts';
import {visibleProgressionGroups} from './progression-panel.ts';
import {featureOpen,featureReason} from './story-gates.ts';
import {initialTravelState,travelModel,destinationCatalog,destinationReady} from './travel-browser.ts';
import {mountHud,updateHud,renderPanel,hideTip,refreshTips,dismissTip,configureEquipmentTips} from './presentation.ts';
import {invalidatePreviews} from './preview-guard.ts';
import {World,distance} from '../../../packages/simulation/index.ts';
import {regionById,regions,skillCatalog,settings,effectText,skillSchoolOf,type SkillSchool} from '../../../packages/content/index.ts';
import {skillBookTabs} from './skills-panel.ts';
import {versions,type GrowthPreview,type Snapshot,type Permit,type Receipt,type Report,type Mode,type Reward,type Gear} from '../../../packages/contracts/index.ts';
import {api,ApiFailure,Outbox} from './network.ts';
import {adoptCombatPermit} from './combat-permit.ts';
import {FieldController} from './field-controller.ts';
import {selectInteraction,type InteractionCandidate} from './interaction-candidate.ts';
import type {StarseaMap} from './starsea-world-renderer.ts';
import {nearbyLoot} from './ground-loot.ts';
import {WorldScene,type ViewBridge} from './scene.ts';
import type {GearTip,GearQuality} from '../../../packages/contracts/index.ts';
import {isGearSlotFilter,runtimeSlotForPart,type GearSlotFilter} from './equipment-slots.ts';
import {BagController} from './bag-controller.ts';
import {CraftingController} from './crafting-controller.ts';
import {GatherNodes,gatherReach} from './gather-nodes.ts';
import {materialName,materialIcon} from './crafting-model.ts';
import {hasArt} from './ui-assets.ts';
import type {SpoilItem} from './kill-spoils.ts';
import {bagCategories,bagSelection,tonicDefinitions,type BagCategory,type TonicId} from './bag-model.ts';
import type {LootPreview} from '../../../packages/contracts/index.ts';
const $=(selector:string)=>document.querySelector(selector) as HTMLElement;
import {finalReportFailure,RenewalGate} from './recovery-policy.ts';
const staleReportCodes=['EXPIRED','RULESET','PERMIT','SEQUENCE','QUEST_WAVE_EXPIRED'];
let fieldMaps:Record<string,unknown>=registeredFieldMaps;
class GameApp implements ViewBridge {
 private dungeons=new DungeonController({write:(path,body,changesBuild)=>this.write(path,body,changesBuild),snapshot:()=>this.snapshot,lease:()=>this.lease,settle:()=>this.flush(),snapshotChanged:s=>{if(!this.snapshot||s.revision>=this.snapshot.revision){this.snapshot=s;this.rewards=s.rewards;invalidatePreviews();this.renderHud();}},receipt:r=>this.applyReceipt(r),world:()=>this.world,worldChanged:w=>{this.world=w;this.permit=undefined;this.userPaused=false;},panel:()=>this.panel,open:p=>{this.panel=p;this.syncPause();},refresh:()=>{this.renderPanel();this.renderHud();},camp:(r,at)=>this.travel(r,false,at),permit:()=>this.permit?.id,notice:t=>this.notice(t)});
 private story=new StoryController({snapshot:()=>this.snapshot,world:()=>this.world,dungeons:this.dungeons,write:(path,body)=>this.write(path,body),open:p=>this.open(p),refresh:()=>{this.renderPanel();this.renderHud();},notice:t=>this.notice(t),service:id=>{if(id==='forge')this.openForge();else if(id==='nightmare'){this.dungeons.category='nightmare';this.open('dungeons');}else{this.progressionGroup=id==='professions'?'reputation':id;this.progression.ui.section=id;this.progression.ui.item='';this.open('progression');}},skill:id=>{void this.action('bag-skill',id);}});
 private starsea=new StarseaController({go:p=>this.go(p),sceneGoal:()=>this.dungeons.sceneGoal(),sceneAction:()=>{if(this.dungeons.running&&this.dungeons.instance?.checkpoint&&!this.dungeons.instance.plane){this.open('dungeons');return true;}return false;},settle:()=>this.flush(),snapshot:()=>this.snapshot,world:()=>this.world,write:(path,body)=>this.write(path,body),travel:id=>this.travel(id),open:p=>this.open(p),refresh:()=>{this.renderPanel();this.renderHud();},notice:t=>this.notice(t),lastError:()=>this.lastError,ensurePermit:()=>this.ensurePermit(),service:npc=>{const panel=npcRows.find(n=>n.id===npc)?.service_panel??'progression';if(panel==='forge')this.openForge();else this.open(panel);},panel:()=>this.panel});
 /** 星潮海角色的港口是拾星港；旧角色仍回归途营地。 */
 private get hub(){return this.snapshot?.starsea?starseaHub:'town';}
 interactKey(){return keyLabel(this.bindings.interact);}
 starSea(){if(this.prologue.active)return;const standard=this.starsea.active&&isStarseaRegion(this.world.region.id),field=fieldRegionInfo(this.world.region.id),dungeon=this.dungeons.running;if(!this.loggedIn||!standard&&!field&&!dungeon)return;const candidate=standard&&!dungeon?this.interactionCandidate():undefined;return {effects:this.activities.effects,objects:[...(standard?this.starsea.objects():[]),...(dungeon?[]:this.gather.objects()),...this.activities.objects(),...(dungeon?this.dungeons.chestObjects():[])],guide:standard||dungeon?this.field.route(this.starsea.guide()):undefined,prompt:candidate?{...candidate.position,text:candidate.text,objectId:candidate.id}:this.activities.nearest()?{...this.activities.nearest()!.position,text:this.activities.nearest()!.label??'',objectId:this.activities.nearest()!.id}:undefined};}
 starSeaInteract(id:string){if(this.loggedIn&&!this.panel){const candidate=!this.dungeons.running?this.interactionCandidate():undefined;if(candidate?.id===id){this.executeInteraction(candidate);return;}if(id.startsWith('dungeon-chest:'))this.dungeons.openChest(id.slice('dungeon-chest:'.length));else if(id.startsWith('field-'))void this.activities.interact(id);else void this.starsea.interact(id);}}
 storyObjects(){return this.loggedIn&&!this.prologue.active?this.story.objects():[];}
 storyEncounter(){return this.dungeons.running?this.story.encounter:undefined;}
 storyInteract(id:string){if(this.loggedIn&&!this.panel)this.story.interact(id);}
 selectEnemy(id:string){this.dungeons.selectEnemy(id);}
 go(point:{x:number;y:number}){this.story.cancelPending();if(this.activities.running)this.activities.go(point);else if(this.dungeons.running)this.dungeons.go(point);else{const target=reachableApproach(this.world.region,this.world.hero.position,point,interactionReach.gather);if(target)this.world.go(target);else this.notice('目标附近没有可达落点，请从道路接近。');}}
 get authoritativeWorld(){return this.dungeons.authoritative||this.activities.authoritative;}
 get authoritativeSequence(){return this.activities.authoritative?this.activities.sequence:this.dungeons.sequence;}
 appearanceForActor(id:string){return this.dungeons.instance?.actors.find(a=>a.id===(id==='hero'?this.snapshot?.id:id))?.appearance??this.resolvedAppearance;}

 private bossReview?:CombatReviewRecord;private reviewWorld?:World;
 private result=new BattleResultController({revision:()=>this.snapshot?.revision??0,review:()=>currentCombatReview(this.bossReview,this.reviewWorld,this.world),character:()=>this.snapshot?.id??'',settle:async()=>{await this.flush();if(!this.blocked)await this.flush();},blocked:()=>this.blocked,recover:async()=>{const control=await api<{lease_id:string}>('control',{takeover:false,client_id:this.clientId});this.lease=control.lease_id;await this.recover();},returnSafe:()=>this.returnCampAfterBattle(),refresh:()=>{if(this.result.context){this.panel='battle-result';this.syncPause();}this.renderPanel();this.renderHud();}});
 private tasks=new TaskController({snapshot:()=>this.snapshot,blocked:()=>this.blocked,processing:()=>this.processing,refresh:()=>{if(this.panel==='tasks')this.renderPanel();this.renderHud();},write:(path,body)=>this.write(path,body),pending:async()=>{const rows=await this.outbox.all(this.snapshot?.id??'');return rows.filter(row=>row.path==='task/claim'&&typeof row.body.task==='string').map(row=>row.body.task as string);},recover:()=>this.action('recover',''),quest:(op,task)=>this.write('quest',{op,task,region:this.world.region.id}),navigate:region=>{if(this.starsea.selectIsland(region))return;const destination=destinationCatalog().find(row=>row.region.id===region);if(!destination)return;this.travelUI={...this.travelUI,regionId:destination.area.id,destinationId:region,mode:destination.kind,filter:'all',query:'',page:0};this.open('travel');}});
 private appearance=new AppearanceController(()=>{if(this.panel==='appearance')this.renderPanel();},(path,body,build)=>this.write(path,body,build),()=>this.blocked);
 private appearanceCanvas=Object.assign(document.createElement('canvas'),{width:384,height:384,id:'appearance-canvas'});
 private appearancePainter=new HeroPreview(this.appearanceCanvas,{height:240,footX:.5,footY:.8,fitBounds:true});
 private appearanceClock=0;private appearanceLastTime=0;private appearanceAction='';
 private portraitCanvas=Object.assign(document.createElement('canvas'),{width:256,height:256});
 private portraitPainter=new HeroPreview(this.portraitCanvas,{height:180,footX:.5,footY:.8,fitBounds:true});
 private portraitKey='';private portraitURL='';private figureURL='';
 get resolvedAppearance():ResolvedAppearance|undefined{return this.snapshot?.resolvedAppearance;}
 get allowDeathPlayback(){return this.panel==='battle-result'&&this.result.context?.outcome==='failure'&&!this.userPaused&&!this.hidden&&!this.blocked&&!this.processing;}
 private progressionGroup='grid';
 private progression=new ProgressionController(()=>{if(this.panel==='progression')this.renderPanel();},(path,body,build)=>this.write(path,body,build),()=>this.blocked);
 private challenges=new ChallengeController(()=>{if(this.panel==='progression')this.renderPanel();},(path,body,build)=>this.write(path,body,build),()=>this.blocked,()=>this.snapshot?.id??'');
 private lastReceipt?:Receipt;
 private gather=new GatherNodes({world:()=>this.world,snapshot:()=>this.snapshot,ready:()=>this.loggedIn&&!this.blocked&&!this.processing,write:(path,body)=>this.write(path,body),notice:t=>this.notice(t),lastReceipt:()=>this.lastReceipt});
 private crafting=new CraftingController({snapshot:()=>this.snapshot,place:()=>({region:this.world.region.id,position:{...this.world.hero.position}}),write:(path,body,build)=>this.write(path,body,build),refresh:()=>{if(this.panel==='forge')this.renderPanel();},blocked:()=>this.blocked||this.processing,lastReceipt:()=>this.lastReceipt});
 private bag=new BagController(()=>this.snapshot,()=>{if(this.panel==='bag')this.refreshBag();},(path,body,build)=>this.write(path,body,build),()=>this.blocked||this.processing);
 private characterPart:Exclude<GearSlotFilter,''>='weapon';
 private characterChooserOpen=false;private characterDetailsOpen=false;private lastDamagePanelAt=0;private damagePanelKey="";
 private qualityFilter:GearQuality|''='';
 private activities=new FieldActivities({world:()=>this.world,snapshot:()=>this.snapshot,lease:()=>this.lease,ready:()=>this.loggedIn&&!this.blocked,write:(path,body)=>this.write(path,body),replace:world=>{if(!this.activities.authoritative)this.automation.apply(world);this.world=world;},settle:()=>this.flush(),returned:async()=>{this.permit=undefined;await this.ensurePermit();},notice:text=>this.notice(text),refresh:()=>this.renderHud(),dungeon:id=>{const row=worldTables.dungeonEntrances.find(r=>r.id===id);if(row){this.dungeons.category='normal';this.dungeons.selected=row.dungeon;this.open('dungeons');}},plane:(dungeon,gate)=>{this.dungeons.category='normal';this.dungeons.selected=dungeon;this.dungeons.gate={id:gate,dungeon};this.open('dungeons');}});
 private field=new FieldController({refresh:()=>{if(this.panel==='region-map')this.renderPanel();},world:()=>this.world,permit:()=>this.permit,snapshot:()=>this.snapshot,banner:t=>this.notice(t),lease:()=>this.lease,ready:()=>this.loggedIn&&!this.blocked&&!this.processing&&!this.reportPromise&&!this.result.context&&!this.activities.authoritative,failed:e=>this.noticeError(e)});
 /** Render data of field regions; filled only by the QA build's lazy field import. */
 worldPhase(){return this.snapshot?.worldView;}
 get worldMap(){return fieldMaps[this.world.region.id] as StarseaMap|undefined;}
 get planeMap(){const r=this.world.region;return r.layoutSeed?planeLayoutMap(r.id,r.layoutSeed):planeMaps[r.id];}
 private travelUI=initialTravelState();
 private travelDropCache=new Map<string,LootPreview>();private travelDropRequests=new Map<string,Promise<LootPreview>>();private travelDropLoading='';private travelDropError='';private travelDropGeneration=0;
 private travelDropTarget='';
 private prologue=new PrologueController({snapshot:()=>this.snapshot,setWorld:w=>{this.world=w;this.permit=undefined;this.userPaused=false;},command:body=>this.prologueCommand(body),finished:async()=>{await this.travel(this.snapshot!.progress.safe,false);},automation:()=>({...this.automation.value}),interactKey:()=>keyLabel(this.bindings.interact),motionReduced:()=>this.reduced,shake:(px,ms)=>this.scene.cameras?.main?.shake(ms,px/STAGE.width)});
 world=new World(regionById('town'),{hp:198,attack:0,armor:0,speed:6,mana:100,regen:10,effects:[]},[],[]);
 private automation=new FieldAutomationPreferences(this.world);
 confirm:''|'salvage'|'dungeon-exit'='';confirmId='';
 snapshot?:Snapshot;permit?:Permit;lease='';panel='login';loggedIn=false;rewards:Reward[]=[];scene=new WorldScene(this);
 private seaTierPick=0;
 private fieldReturnRegion='';private autoPickup=true;private pickupFilter:PickupFilter=defaultPickupFilter();private lootSeen=new Map<string,number>();private lootWorld?:World;private authConnecting=false;private authError='';private authReload=false;private compatible=false;private accountOnly=true;private loginPending=false;private activationPending=false;private clientId=sessionStorage.getItem('aw-controller')??crypto.randomUUID();private pressed=new Set<string>();private binding='';private bindingMessage='';private bindings:Record<string,string>={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',interact:'KeyE',pause:'Space',bag:'KeyB',skills:'KeyK',skill1:'Digit1',skill2:'Digit2',skill3:'Digit3',skill4:'Digit4'};private outbox=new Outbox();private reportPromise?:Promise<void>;private lastTick=0;private sequence=0;private build=1;private processing=false;private blocked=false;private userPaused=false;private hidden=false;private selected='';private feed:string[]=[];private toastTimer?:ReturnType<typeof setTimeout>;private hudTime=0;private combatAudio=new CombatAudio();private productionAudio=new ProductionAudio(this.combatAudio,position=>{const view=this.scene.cameras?.main?.worldView,p=audioProject(position);return Boolean(view?.contains(p.x,p.y));});private volume=this.productionAudio.settings.master;private pauseBeforePanel=false;private reduced=false;private bagTab:'bag'|'rewards'='bag';private slotFilter:GearSlotFilter='';private trackerOpen=false;private hudModeOpen=false;private focusKey='';private skillFocus='';private skillCategory:SkillSchool|'all'='martial';private skillTags:string[]=[];private skillOperation:''|'activate'|'upgrade'|'equip'|'unequip'='';private skillOperationId='';private skillStatus:''|'success'|'error'|'pending'='';private skillMessage='';private skillPageFocus:Partial<Record<SkillSchool|'all',string>>={};private skillQuery='';private skillFilter:'all'|'active'|'eligible'='all';private aimSkillIndex:number|undefined;private lastError='';
 constructor(){mountUiAudio(key=>this.productionAudio.play(key));document.addEventListener('pointerdown',()=>this.productionAudio.unlock(this.world.skills.map(s=>s.id)),{once:true});document.addEventListener('keydown',()=>this.productionAudio.unlock(this.world.skills.map(s=>s.id)),{once:true});sessionStorage.setItem('aw-controller',this.clientId);configureEquipmentTips(id=>api<GearTip>('gear/'+encodeURIComponent(id)+'/tip'));mountHud();
  document.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-action]');if(button)void this.action(button.dataset.action!,button.dataset.id??'');});
 document.addEventListener('change',event=>this.change(event.target as HTMLInputElement));
 document.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.id==='skill-search'){this.skillQuery=input.value;const start=input.selectionStart,end=input.selectionEnd;this.renderPanel();const next=document.querySelector<HTMLInputElement>('#skill-search');next?.focus({preventScroll:true});if(next)next.setSelectionRange(start,end);return;}if(input.id==='volume'||input.id.startsWith('audio-')){this.change(input);return;}if(input.closest('[data-ui=field]'))setFieldFeedback(input);if(this.panel==='tasks'&&this.tasks.input(input))return;if(this.panel==='bag'&&input.dataset.action==='bag-search'){this.bag.ui.page=0;this.bag.ui.query=input.value;this.bag.ui.scrollTop=0;this.refreshBag();void this.bag.previewSelected();return;}if(this.panel==='travel'&&input.dataset.action==='travel-search'){this.travelUI.query=input.value;this.travelUI.page=0;this.refreshTravel();}});
 document.addEventListener('pointerdown',event=>{if(this.panel==='tasks')this.tasks.outside(event.target);if(this.hudModeOpen&&!(event.target as HTMLElement).closest('#modebar')){this.hudModeOpen=false;this.renderHud();}});
 document.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(this.panel!=='forge'||input.id!=='craft-search')return;const start=input.selectionStart,end=input.selectionEnd;this.crafting.setQuery(input.value);this.renderPanel();const next=document.querySelector<HTMLInputElement>('#craft-search');next?.focus({preventScroll:true});if(next)next.setSelectionRange(start,end);});
 document.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(this.panel!=='progression'||input.id!=='progression-search')return;this.progression.ui.query=input.value;const start=input.selectionStart,end=input.selectionEnd;this.renderPanel();const next=document.querySelector<HTMLInputElement>('#progression-search');next?.focus({preventScroll:true});if(next)next.setSelectionRange(start,end);});
 document.addEventListener('scroll',event=>{const node=event.target;if(this.panel==='tasks')this.tasks.captureDom();if(this.panel==='bag'&&node instanceof HTMLElement&&node.dataset.bagScroll==='list')this.bag.ui.scrollTop=node.scrollTop;},{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{this.hidden=document.hidden;this.syncPause();if(this.hidden)void this.flush();else if(this.loggedIn&&this.lease){if(this.controlLost)void this.reclaimControl();else void this.heartbeat();}});
 window.addEventListener('pagehide',()=>{this.dungeons.beforeUnload();void this.flush();});
 window.addEventListener('keydown',event=>{if(this.activationPending){event.preventDefault();return;}if(this.prologue.keydown(event,this.bindings))return;if(handleUIDialogKey(event))return;if(handleUITabKey(event))return;if(this.panel==='tasks'&&this.tasks.keydown(event))return;
 if(['login','create','takeover'].includes(this.panel)&&event.key==='Enter'){event.preventDefault();if(!event.repeat)void this.action(this.panel==='create'?'create':this.panel==='takeover'?'takeover':this.compatible?'login':this.authReload?'auth-reload':'auth-retry','');return;}
 if(this.binding){
  if(event.code==='Tab'){this.binding='';this.bindingMessage='已取消修改。';this.renderPanel();}
  else{event.preventDefault();if(event.code==='Escape'){this.binding='';this.bindingMessage='已取消修改。';}else if(!event.code||event.metaKey||event.ctrlKey&&!event.code.startsWith('Control')||event.altKey&&!event.code.startsWith('Alt')||event.shiftKey&&!event.code.startsWith('Shift')){this.bindingMessage='请按一个单独按键；Tab 用于界面导航。';}else if(Object.entries(this.bindings).some(([id,code])=>id!==this.binding&&code===event.code)){this.bindingMessage='该按键已用于其他操作，请选择另一个按键。';}else{this.bindings[this.binding]=event.code;this.binding='';this.bindingMessage='按键设置已保存。';this.saveSettings();}this.renderPanel();return;}
 }
 if(event.code==='Escape'&&this.aimSkillIndex!==undefined){event.preventDefault();this.aimSkillIndex=undefined;this.notice('已取消选取施法位置。');return;}if(event.code==='Escape'&&dismissTip()){event.preventDefault();return;}
 if(event.code==='Escape'&&this.hudModeOpen){event.preventDefault();this.hudModeOpen=false;this.renderHud();return;}
 
 if(event.code==='Escape'&&this.panel==='progression'&&(this.progression.ui.summaryOpen||this.progression.ui.resetConfirm)){event.preventDefault();void this.action(this.progression.ui.summaryOpen?'progression-summary-close':'progression-reset-cancel','');return;}
 if(event.code==='Escape'&&this.panel==='augments'){event.preventDefault();void this.dungeons.handle('augment-hide','');return;}
 if(event.code==='Escape'&&this.panel==='battle-result'){event.preventDefault();return;}
 if(event.code==='Escape'&&this.panel!=='login'){if(this.confirm){this.confirm='';this.confirmId='';this.renderPanel();this.restoreInventoryFocus();return;}if(this.panel==='character'&&this.characterChooserOpen){this.closeCharacterChooser();return;}if(this.panel)this.open('');return;}
 if(this.panel==='skills'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&(event.target as HTMLElement).closest('.skill-categories')){event.preventDefault();const categories=Object.keys(skillBookTabs) as (SkillSchool|'all')[],i=categories.indexOf(this.skillCategory);const next=event.key==='Home'?0:event.key==='End'?categories.length-1:(i+(event.key==='ArrowRight'?1:-1)+categories.length)%categories.length;void this.action('skill-category',categories[next]);return;}
 if(this.panel==='progression'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)&&(event.target as HTMLElement).closest('.progression-groups')){event.preventDefault();const groups=visibleProgressionGroups(this.snapshot),i=groups.findIndex(g=>g.id===this.progressionGroup),next=event.key==='Home'?0:event.key==='End'?groups.length-1:(i+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+groups.length)%groups.length;void this.action('progression-group',groups[next].id);return;}
 if(this.panel==='appearance'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&(event.target as HTMLElement).closest('.appearance-slots')){event.preventDefault();const i=appearanceSlots.indexOf(this.appearance.ui.slot),next=event.key==='Home'?0:event.key==='End'?appearanceSlots.length-1:(i+(event.key==='ArrowRight'?1:-1)+appearanceSlots.length)%appearanceSlots.length;void this.action('appearance-slot',appearanceSlots[next]);return;}
 if(this.panel==='travel'&&['ArrowLeft','ArrowRight'].includes(event.key)&&(event.target as HTMLElement).closest('.travel-modes')){event.preventDefault();const mode=(event.target as HTMLElement).dataset.id==='explore'?'dungeon':'explore';void this.action('travel-mode',mode).then(()=>document.querySelector<HTMLElement>(`[data-action=travel-mode][data-id=${mode}]`)?.focus());return;}
 if(this.panel&&event.key==='Tab'){const focusables=Array.from(($('#modal').querySelector('.confirm-box')??$('#modal')).querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]')).filter(el=>el.tabIndex>=0);if(focusables.length){event.preventDefault();const i=focusables.indexOf(document.activeElement as HTMLElement);const next=event.shiftKey?(i<=0?focusables.length-1:i-1):(i===focusables.length-1||i<0?0:i+1);focusables[next].focus();}return;}
 if(this.panel&&!['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement).tagName)&&!event.repeat&&(event.code===this.bindings.bag||event.code===this.bindings.skills)){event.preventDefault();const destination=event.code===this.bindings.bag?'bag':'skills';this.open(destination===this.panel?'':destination);return;}
 if(this.panel||['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement).tagName))return;
 this.pressed.add(event.code);if(event.repeat)return;
 if(Object.values(this.bindings).includes(event.code))event.preventDefault();
 if(event.code===this.bindings.interact)this.interact();if(event.code===this.bindings.pause)this.pause();if(event.code===this.bindings.bag)this.open('bag');if(event.code===this.bindings.skills)this.open('skills');for(let i=0;i<4;i++)if(event.code===this.bindings['skill'+(i+1)])this.cast(i);
 });window.addEventListener('keyup',event=>this.pressed.delete(event.code));window.addEventListener('blur',()=>this.pressed.clear());
 try{const saved=JSON.parse(localStorage.getItem('aw-settings')??'{}');for(const id of Object.keys(this.bindings))if(typeof saved.bindings?.[id]==='string'&&/^[A-Za-z][A-Za-z0-9]{0,31}$/.test(saved.bindings[id]))this.bindings[id]=saved.bindings[id];if(!saved.audio&&Number.isFinite(saved.volume))this.volume=Math.max(0,Math.min(1,saved.volume));this.reduced=saved.reduced===true;this.autoPickup=saved.autoPickup!==false;const filter=pickupFilterSchema.safeParse(saved.pickupFilter??{});if(filter.success)this.pickupFilter=filter.data;this.automation.load(saved);this.automation.apply(this.world);document.documentElement.dataset.motionReduced=String(this.reduced);}catch{}
 if(import.meta.env.DEV&&import.meta.env.VITE_PACING_TOOL==='1')void import('./pacing-lab.ts').then(module=>module.mountPacingLab({snapshot:()=>this.loggedIn?this.snapshot:undefined}));
 void this.start();this.animateAppearance(performance.now());setInterval(()=>void this.heartbeat(),15000);setInterval(()=>this.renderHud(),180);
 }
 async start(){if(this.authConnecting)return;this.authConnecting=true;this.authError='';this.authReload=false;this.renderPanel();try{await this.outbox.init();const health=await api<{versions:typeof versions;auth_mode?:string}>('health');if(health.versions.protocol!==versions.protocol||health.versions.rules!==versions.rules||health.versions.assets!==versions.assets)throw new ApiFailure('VERSION','游戏已更新，请重新载入。',409);this.accountOnly=health.auth_mode==='account-only';this.compatible=true;this.snapshot=await api<Snapshot>('character');await this.activate();}catch(e){if(e instanceof ApiFailure&&e.code==='CHARACTER'){this.panel='create';this.renderPanel();return;}this.panel='login';if(!(e instanceof ApiFailure&&e.code==='AUTH')){this.authError=e instanceof Error?e.message:'暂时无法连接游戏服务。';this.authReload=e instanceof ApiFailure&&e.code==='VERSION';}}finally{this.authConnecting=false;if(this.panel==='login')this.renderPanel();}}
 private async activate(takeover=false){if(this.activationPending)return;this.activationPending=true;this.pressed.clear();this.syncPause();this.renderHud();try{const v=await api<{lease_id:string}>('control',{takeover,client_id:this.clientId});this.lease=v.lease_id;this.loggedIn=true;this.fieldReturnRegion='';await this.recover();this.panel='';if(this.prologue.start())return;if(await this.activities.restore()){this.renderPanel();this.renderHud();return;}if(await this.dungeons.restore()){this.renderPanel();this.renderHud();return;}await this.travel(this.snapshot!.dungeon?.returnRegion??this.snapshot!.lastRegion??this.snapshot!.progress.safe,false);if(this.result.restore()){this.panel='battle-result';await this.result.load(false);this.focusPanel();}}catch(e){if(e instanceof ApiFailure&&e.code==='BUSY'){this.panel='takeover';this.renderPanel();return;}if(this.panel==='login'){this.authError=e instanceof Error?e.message:'连接恢复失败';console.error('Activation recovery failed',e);}this.noticeError(e);}finally{this.activationPending=false;this.syncPause();this.renderPanel();this.renderHud();}}
 private syncPause(){if(this.panel)this.pressed.clear();this.world.paused=this.authoritativeWorld?false:this.userPaused||this.hidden||Boolean(this.panel)||this.blocked||this.processing||this.activationPending||!this.loggedIn;}
 step(){if(this.loggedIn)this.productionAudio.observe(this.world,this.rewards,this.snapshot?.level);else this.productionAudio.title();this.syncPause();if(this.activationPending)return;if(this.prologue.active){const x=this.panel||this.hidden?0:(this.pressed.has(this.bindings.right)||this.pressed.has('ArrowRight')?1:0)-(this.pressed.has(this.bindings.left)||this.pressed.has('ArrowLeft')?1:0),y=this.panel||this.hidden?0:(this.pressed.has(this.bindings.down)||this.pressed.has('ArrowDown')?1:0)-(this.pressed.has(this.bindings.up)||this.pressed.has('ArrowUp')?1:0);if(!this.world.paused)this.prologue.step({x:x+y,y:y-x});return;}this.story.step();if(this.loggedIn){if(!this.activities.authoritative){this.starsea.step();this.field.step();if(!this.dungeons.running)this.gather.step();}this.activities.step();}if(this.authoritativeWorld){const x=this.panel||this.hidden?0:(this.pressed.has(this.bindings.right)||this.pressed.has('ArrowRight')?1:0)-(this.pressed.has(this.bindings.left)||this.pressed.has('ArrowLeft')?1:0),y=this.panel||this.hidden?0:(this.pressed.has(this.bindings.down)||this.pressed.has('ArrowDown')?1:0)-(this.pressed.has(this.bindings.up)||this.pressed.has('ArrowUp')?1:0);if(x||y)this.story.cancelPending();if(this.activities.running)this.activities.move(x+y,y-x);else if(this.dungeons.running)this.dungeons.move(x+y,y-x);return;}this.world.pickups=this.autoPickup&&this.snapshot&&this.snapshot.gear.length<this.snapshot.capacity?this.rewards.filter(r=>r.region===this.world.region.id&&acceptsPickup(r.gear,this.pickupFilter,mainHandWeapon(this.snapshot!))).map(r=>r.position):[];if(this.lootWorld!==this.world){this.lootSeen.clear();this.lootWorld=this.world;}const activeLoot=new Set(this.rewards.map(r=>r.id));for(const id of this.lootSeen.keys())if(!activeLoot.has(id))this.lootSeen.delete(id);for(const r of this.rewards)if(!this.lootSeen.has(r.id))this.lootSeen.set(r.id,this.world.tick);const sx=(this.pressed.has(this.bindings.right)||this.pressed.has('ArrowRight')?1:0)-(this.pressed.has(this.bindings.left)||this.pressed.has('ArrowLeft')?1:0),sy=(this.pressed.has(this.bindings.down)||this.pressed.has('ArrowDown')?1:0)-(this.pressed.has(this.bindings.up)||this.pressed.has('ArrowUp')?1:0);this.world.control(sx+sy,sy-sx);const beforeTick=this.world.tick;this.world.step();if(this.loggedIn&&this.world.region.boss&&this.world.tick>beforeTick){if(this.reviewWorld!==this.world){this.reviewWorld=this.world;this.bossReview=newCombatReview();}observeCombatReview(this.bossReview!,this.world);}if(!this.loggedIn||this.world.paused)return;
 if(this.world.kills.length>=settings.reportKills||this.world.tick-this.lastTick>=settings.reportTicks&&this.world.kills.length)void this.flush();
 if(this.reportPromise&&(this.world.kills.length>=settings.reportKills*settings.maxPending||this.world.tick-this.reportStartedTick>=settings.reportTicks*settings.maxPending)){this.blocked=true;this.world.stop('战利品尚未确认，请等待连接恢复。');}
 if(this.autoPickup&&this.snapshot!.gear.length<this.snapshot!.capacity&&!this.processing&&!this.reportPromise){const rewards=nearbyLoot(this.rewards.filter(r=>acceptsPickup(r.gear,this.pickupFilter,mainHandWeapon(this.snapshot!))),this.world.region,this.world.hero.position).filter(r=>this.world.tick-(this.lootSeen.get(r.id)??this.world.tick)>=12);if(rewards.length)void this.pickMany(rewards.map(r=>r.id));}
 if(bagFull(this.snapshot!)&&this.world.mode==='auto'){this.sound('bag-full');this.world.stop(fullBagMessage);}
 const won=this.world.region.boss&&this.world.enemies.some(e=>e.boss)&&!this.world.enemies.some(e=>e.boss&&e.alive);
 if(this.permit&&!this.result.context&&(won||this.world.hero.hp<=0)){this.panel='battle-result';this.syncPause();void this.result.start(this.permit.id,this.world.region.id,won?'success':'failure').then(()=>this.focusPanel());}
 }
 cast(index:number){if(this.panel)return;const skill=this.world.skills[index];if(!skill){this.notice(this.snapshot?.skills[index]?'该技能当前未装配或不适用，请去技能页装配。':'该栏位没有技能。');return;}if(['ground','direction'].includes(skill.mechanics?.targeting??'')){this.aimSkillIndex=index;this.notice('点击地面选择'+skill.name+'的合法位置；Esc取消。');return;}if(this.activities.running){this.activities.cast(index);return;}if(this.dungeons.running){this.dungeons.cast(index);return;}if(!this.world.cast(skill.id))this.notice(this.castFailureText());}
 castAt(point:{x:number;y:number}){const index=this.aimSkillIndex;if(index===undefined)return false;const skill=this.world.skills[index];if(!skill){this.aimSkillIndex=undefined;return true;}if(this.activities.running){this.activities.cast(index,point);this.aimSkillIndex=undefined;}else if(this.dungeons.running){if(this.dungeons.cast(index,point))this.aimSkillIndex=undefined;}else if(this.world.cast(skill.id,undefined,point))this.aimSkillIndex=undefined;else this.notice(this.castFailureText());return true;}
 private castFailureText(){const labels:Record<string,string>={unknown:'该技能未装配，请去技能页装配。',paused:'当前已暂停，请先继续或恢复连接。',weapon:'当前主手武器不符合技能要求。',busy:'前摇或持续施法尚未结束。',controlled:'受控制，暂时不能施法。',cooldown:'技能仍在冷却。',resource:'能量不足。',range:'所选位置或目标超出施放距离。',target:'没有合法目标。',blocked:'施法路径或落点被阻挡，请重选。',unneeded:'当前没有需要恢复或净化的状态。',dead:'角色已倒下。'};return labels[this.world.lastCastFailure]??'暂时无法释放该技能。';}
 pause(){if(this.activities.running){this.notice('世界活动持续运行，不会暂停。');return;}if(this.dungeons.running){this.notice('副本持续运行，不会暂停。');return;}this.userPaused=!this.userPaused;this.syncPause();this.renderHud();}
 open(panel:string,characterChooser=false){if(this.prologue.active&&panel)return;if(panel==='travel'&&isStarseaRegion(this.world.region.id))panel='starsea-chart';if(this.panel==='story'&&panel!=='story')this.story.resetChapter();
  if(this.dungeons.instance&&['success','failed','abandoned','closed'].includes(this.dungeons.instance.status)&&panel!=='dungeon-result')return;if(this.result.context){if(!panel)void this.result.return();return;}
  if(panel){clearTimeout(this.toastTimer);$('#toast').style.opacity='0';hideTip();}
  if(this.panel!==panel){this.binding='';this.bindingMessage='';this.travelDropGeneration++;this.travelDropLoading='';this.travelDropError='';this.travelDropTarget='';if(panel==='travel')this.travelDropCache.clear();}
  if(!this.loggedIn&&panel!=='login')return;
  if(this.processing)return;
  if(panel!==this.panel&&['bag','character'].includes(this.panel))invalidatePreviews();
  if(panel&&!this.panel)this.focusKey=this.focusKeyOf(document.activeElement);
  if(panel==='character'&&this.panel!==panel)this.characterChooserOpen=characterChooser;
  const previousPanel=this.panel;this.panel=panel;this.hudModeOpen=false;this.aimSkillIndex=undefined;
  if(panel==='skills'&&previousPanel!=='skills'){if(!this.blocked){this.skillStatus='';this.skillMessage='';}if(!this.skillFocus)this.skillFocus=this.snapshot!.skills[0]??'cut';}
  if(panel==='bag'&&!this.selected)this.selected=this.snapshot!.gear[0]?.id??'';
  this.lastError='';
  this.syncPause();
  this.renderPanel();
  this.renderHud();
  if(this.panel)this.focusPanel();else this.restoreFocus();
  if(panel==='progression'){const tab=document.querySelector<HTMLElement>('.progression-groups [aria-selected=true]');tab?.focus({preventScroll:true});tab?.scrollIntoView({block:'nearest',inline:'nearest'});}
  if(panel==='dungeons')void this.dungeons.load();if(panel==='travel')void this.loadTravelDrops();
  if(panel==='progression')void (this.progressionGroup==='challenges'?this.challenges.load():this.progression.load());
  if(panel==='appearance')void this.appearance.load();
  if(panel==='bag')void this.bag.load();
  if(panel==='tasks')void this.flush().then(()=>this.tasks.load());
 }
 private setAuthPending(pending:boolean,action=''){this.loginPending=pending;document.querySelectorAll<HTMLButtonElement>('.login-panel button').forEach(button=>{button.disabled=pending;button.setAttribute('aria-busy',String(pending&&button.dataset.action===action));});document.querySelectorAll<HTMLInputElement>('.login-panel input').forEach(input=>input.disabled=pending);}
 private restoreInventoryFocus(){const target=document.querySelector<HTMLElement>('#modal [data-action=salvage-confirm]:not([disabled]),#modal .bag-item[aria-pressed=true],#modal [data-action=select][aria-pressed=true]');target?.focus({preventScroll:true});if(target)dismissTip(target);}
 private focusKeyOf(el:Element|null){const node=el instanceof HTMLElement?el.closest<HTMLElement>('[data-action]'):null;if(!node)return '';return [node.dataset.action??'',node.dataset.id??'',node.getAttribute('aria-label')??''].join('\u001f');}
 private restoreFocus(){if(!this.focusKey)return;const [action,id,label]=this.focusKey.split('\u001f');this.focusKey='';const hit=Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).find(n=>(n.dataset.action??'')===action&&(n.dataset.id??'')===id&&(n.getAttribute('aria-label')??'')===label);hit?.focus();}
 private focusPanel(){if(this.panel==='battle-result'){document.querySelector<HTMLElement>('[data-action=result-return]:not([disabled])')?.focus({preventScroll:true});return;}const modal=$('#modal').querySelector<HTMLElement>('.confirm-box')??$('#modal');const first=modal.querySelector<HTMLElement>('[data-action=cancel-confirm],input:not([disabled]),select:not([disabled]),button:not(.close):not([disabled])');const target=first??modal.querySelector<HTMLElement>('.panel');target?.focus();}
 private reportStartedTick=0;private panelBusy=false;
 async flush(){if(this.permitStale)return;if(this.prologue.active||this.activities.authoritative||this.dungeons.authoritative||!this.permit||!this.loggedIn)return;if(this.reportPromise)return this.reportPromise;
 this.reportStartedTick=this.world.tick;
 this.reportPromise=this.sendReports().catch(e=>{this.blocked=true;const stale=e instanceof ApiFailure&&staleReportCodes.includes(e.code);if(stale)this.permitStale=true;this.world.stop(stale?e.message:'连接中断，已暂停战斗。请点击恢复连接。');this.noticeError(e);}).finally(()=>{this.reportPromise=undefined;const skills=this.panel==='skills';this.syncPause();if(skills&&!this.blocked)this.renderPanel();});return this.reportPromise;}
 private async sendReports(){
 let updating=false;
 do{const end=this.world.tick;if(end===this.lastTick&&!this.world.kills.length)break;
 const kills=this.world.kills.splice(0);const report:Report={command_id:crypto.randomUUID(),revision:this.snapshot!.revision,lease_id:this.lease,permit_id:this.permit!.id,build:this.build,sequence:this.sequence+1,from_tick:this.lastTick,to_tick:end,kills,position:{...this.world.hero.position}};
 await this.outbox.put(report,this.snapshot!.id);let result:Receipt;try{result=await api<Receipt>('combat/report',report);}catch(error){if(finalReportFailure(error)){await this.outbox.reject(report,this.snapshot!.id,'combat/report',error instanceof Error?error.message:'战报已拒绝');this.permitStale=true;}throw error;}await this.outbox.remove(report.command_id);this.lastTick=end;this.sequence=report.sequence;this.applyReceipt(result);this.queueSpoils(result);
 if(result.snapshot.build!==this.build){updating=true;this.blocked=true;this.syncPause();}
 // Level changes freeze at acknowledgement, then settle the old-build tail before renewal.
 }while(updating&&this.world.tick>this.lastTick);
 if(updating)this.adoptPermit(await api<Permit>('permit',{lease_id:this.lease,region:this.world.region.id,position:{...this.world.hero.position}}));
 this.blocked=false;
 if(this.world.stopReason==='战利品尚未确认，请等待连接恢复。')this.world.stopReason='';
 }
 /** 击杀回执带回的材料（部件等）交给场景，在最近一次击杀处蹦出（docs/progression-goal-plan.md §11.4）。 */
 private spoilQueue:SpoilItem[]=[];
 private queueSpoils(r:Receipt){for(const[id,n]of Object.entries(r.delta.materials??{}))if(n>0)this.spoilQueue.push({icon:materialIcon(id,hasArt),label:`${materialName(id)} ×${n}`});}
 takeSpoils(){return this.spoilQueue.splice(0);}
 killSpoils(){return !this.prologue.active&&!this.activities.authoritative&&!this.dungeons.authoritative&&Boolean(this.permit)&&this.loggedIn;}
 private applyReceipt(r:Receipt){if(r.spawns?.length&&this.permit){const known=new Set([...this.world.enemies,...this.world.phased].map(e=>e.id)),added=r.spawns.filter(m=>!known.has(m.id));if(added.length)this.world.addSpawns(added);const authorized=new Set(this.permit.spawns.map(m=>m.id));this.permit.spawns.push(...r.spawns.filter(m=>!authorized.has(m.id)));}const oldRevision=this.snapshot?.revision,wasReady=new Set(readyBounties(this.snapshot).map(b=>b.instance));this.snapshot=r.snapshot;if(oldRevision!==undefined&&oldRevision!==r.snapshot.revision){if(r.delta.gold>0)this.sound('pickup-gold');else if(r.delta.material>0)this.sound('pickup-material');}for(const b of readyBounties(r.snapshot))if(!wasReady.has(b.instance))this.notice(`悬赏完成：${b.title}，回前哨领取`);if(this.snapshot.starsea&&starseaIslands.includes(this.world.region.id))this.world.region.sprint=this.snapshot.starsea.features.includes('sprint');this.rewards=r.snapshot.rewards;if(oldRevision!==undefined&&oldRevision!==r.snapshot.revision)invalidatePreviews();if(r.delta.gold>0||r.delta.xp>0)this.feed.unshift(`获得 ${r.delta.gold} 金币 · ${r.delta.xp} 经验`);else if(r.delta.gold<0)this.feed.unshift(`消耗 ${-r.delta.gold} 金币${r.delta.material<0?` · ${-r.delta.material} 强化石`:''}`);for(const [id,count] of Object.entries(r.delta.books??{}))if(count)this.feed.unshift(`${count>0?'获得':'使用'}${skillCatalog.find(sk=>sk.id===id)?.name??id}技能书 ×${Math.abs(count)}`);this.feed=this.feed.slice(0,3);if(['skills','bag','character','tasks'].includes(this.panel)&&oldRevision!==r.snapshot.revision)this.renderPanel();this.renderHud();}
 private async recover(){const commands=await this.outbox.all(this.snapshot!.id);for(const stored of commands){const command=stored.body;try{let receipt:Receipt;try{receipt=await api<Receipt>('receipt/'+command.command_id);}catch(e){if(e instanceof ApiFailure&&e.code==='NOT_FOUND')receipt=await api<Receipt>(stored.path,command,this.lease);else throw e;}this.applyReceipt(receipt);if(this.permit?.id===command.permit_id){this.lastTick=command.to_tick;this.sequence=command.sequence;}await this.outbox.remove(command.command_id);}catch(e){if(e instanceof ApiFailure&&e.code==='SOURCE'&&stored.path==='combat/report'&&command.kills?.length&&command.kills.every((k:{source_id:string})=>k.source_id.startsWith('activity:'))){const activities=await api<{activities:{instance:string}[]}>('field/activity');if(command.kills.every((k:{source_id:string})=>activities.activities.some(a=>k.source_id.startsWith('activity:'+a.instance+':')))){await this.outbox.reject(command,this.snapshot!.id,stored.path,'服务器活动击杀曾被错误提交到野外授权；已核对属于当前角色的持久活动实例。');this.notice('活动已恢复，可以继续战斗。');continue;}}if(e instanceof ApiFailure&&(['REVISION','BUILD','EXPIRED'].includes(e.code)||stored.path==='combat/report'&&staleReportCodes.includes(e.code))){await this.outbox.reject(command,this.snapshot!.id,stored.path,e.message);if(stored.path==='combat/report')this.permitStale=true;this.notice('未确认的本场操作未计入存档，已重新读取已保存进度。');continue;}this.blocked=true;throw e;}}
 this.snapshot=await api<Snapshot>('character');this.rewards=this.snapshot.rewards;this.blocked=false;
 }
 /** 任务开战前确保本图授权有效：对话框打开时战斗暂停、心跳不续期，授权可能已过期。 */
 private async ensurePermit(){if(this.blocked||!this.lease||this.result.context)return;const p=this.permit;if(p&&p.region===this.world.region.id&&new Date(p.expires_at).getTime()-Date.now()>30000)return;
  try{await this.flush();this.adoptPermit(await api<Permit>('permit',{lease_id:this.lease,region:this.world.region.id,position:{...this.world.hero.position}}));}catch(e){this.noticeError(e);}}
 private adoptPermit(permit:Permit){Object.assign(this,adoptCombatPermit(this.world,this.permit,permit,this.snapshot!));}
 // 后台标签页的心跳会被浏览器压慢，租约过期后切回前台自动重新获取控制权（他处在玩则走原有接管面板）。
 private controlLost=false;
 /** 战报被服务端终局拒绝（授权过期/规则更新/序号错位）：同一授权再冲刷只会重复失败，恢复时须先换授权。 */
 private permitStale=false;
 private async reclaimControl(){if(this.processing||this.activationPending)return;this.controlLost=false;await this.action('recover','');}
 private renewal=new RenewalGate();
 private async heartbeat(){if(!this.loggedIn||!this.lease||!this.renewal.begin())return;const lease=this.lease;let renewing=false;try{await api('control/renew',{lease_id:this.lease});this.renewal.success();if(!this.activities.authoritative&&!this.result.context&&this.permit&&new Date(this.permit.expires_at).getTime()-Date.now()<30000&&!this.reportPromise&&!this.processing&&!this.blocked){this.processing=true;renewing=true;this.syncPause();await this.flush();if(this.blocked)return;this.adoptPermit(await api<Permit>('permit',{lease_id:this.lease,region:this.world.region.id,position:{...this.world.hero.position}}));}}catch(e){if(this.lease!==lease)return;if(this.renewal.canRetry(e)&&!renewing)return;this.blocked=true;this.world.stop('连接或控制权已失效，请恢复连接。');this.noticeError(e);if(e instanceof ApiFailure&&e.code==='CONTROL'){this.controlLost=true;if(!document.hidden)void this.reclaimControl();}}finally{this.renewal.finish();if(renewing)this.processing=false;this.syncPause();if(this.panel&&(this.panelBusy||this.blocked))this.refreshGearPanel();}}
 /** 开场命令不走 write()：沙盒没有战报可冲刷。同一操作编号重试；版本冲突时取最新角色再发一次。 */
 private async prologueCommand(body:{weapon?:string;finish?:boolean}){let command_id=crypto.randomUUID();
  for(let attempt=0;;attempt++){try{const r=await api<Receipt>('prologue',{command_id,revision:this.snapshot!.revision,lease_id:this.lease,...body});this.snapshot=r.snapshot;this.rewards=r.snapshot.rewards;this.build=r.snapshot.build;invalidatePreviews();return;}
   catch(e){if(attempt>=2||!(e instanceof ApiFailure)||!['REVISION','NETWORK'].includes(e.code))throw e;if(e.code==='REVISION'){this.snapshot=await api<Snapshot>('character');command_id=crypto.randomUUID();}}}}
 private async write(path:string,body:object,changesBuild=false):Promise<'success'|'rejected'|'pending'|'busy'|undefined>{
  if((this.activities.running||this.dungeons.locked||this.starsea.defending)&&(changesBuild||/^(gear|skills|progression)\//.test(path)||path==='skills')){this.notice('本场已锁定，结束副本后可调整。');return 'rejected';}if(this.processing)return 'busy';
  this.processing=true;this.syncPause();if(this.panel)this.refreshGearPanel();let pendingId='',commandSent=false;
  try{
   await this.flush();
   if(this.blocked)throw new ApiFailure('NETWORK','请先恢复连接。',0);
   const payload={command_id:crypto.randomUUID(),revision:this.snapshot!.revision,lease_id:this.lease,...body};
   pendingId=payload.command_id;
   await this.outbox.put(payload,this.snapshot!.id,path);
   commandSent=true;
   const result=await api<Receipt>(path,payload);
   await this.outbox.remove(pendingId);
   this.applyReceipt(result);this.lastReceipt=result;
   const audioKey=receiptSound(path,body);if(audioKey&&result.revision>payload.revision)this.productionAudio.play(audioKey);
   if(changesBuild||this.snapshot!.build!==this.build){
    this.build=this.snapshot!.build;
    this.world.applyBuild(this.snapshot!.stats,this.snapshot!.resolvedSkills);
    if(this.permit)try{this.adoptPermit(await api<Permit>('permit',{lease_id:this.lease,region:this.world.region.id,position:{...this.world.hero.position}}));}
    catch{this.blocked=true;this.world.stop('操作已保存，请恢复连接后继续战斗。');}
   }
   return 'success';
  }catch(e){
   if(e instanceof ApiFailure&&(e.code==='NETWORK'||e.code==='SERVER'||e.code==='PROTOCOL')){
    this.blocked=true;
    this.world.stop(commandSent?'操作等待确认，请恢复连接。':'前置结算或本机记录未完成，操作尚未发出，请恢复连接后重试。');
    this.noticeError(e);
    return commandSent?'pending':'rejected';
   }else if(pendingId)try{await this.outbox.remove(pendingId);}catch{
    this.blocked=true;this.world.stop('本机操作记录未清理，请恢复连接后重试。');this.noticeError(new ApiFailure('NETWORK','本次操作未完成，本机记录清理失败，请恢复连接后核对。',0));return 'pending';
   }
   this.noticeError(e);
   if(e instanceof ApiFailure&&((path.startsWith('reward/')&&['REVISION','REWARD','CAPACITY'].includes(e.code))||(path.startsWith('skills')&&['REVISION','COST','SKILL_BOOK','SKILL_LEVEL','ALREADY_ACTIVE','MAX_RANK','SKILL_INACTIVE'].includes(e.code))||(/^(progression|challenges|raids|appearance|task)\//.test(path)||path==='crafting/action'||path==='crafting/pin'||path==='field/gather'))){
    try{const latest=await api<Snapshot>('character');this.snapshot=latest;this.rewards=latest.rewards;if(latest.build!==this.build){this.blocked=true;this.lastError='角色状态已更新，请恢复连接后继续战斗。';this.skillMessage=this.lastError;}}
    catch{this.blocked=true;this.skillMessage='操作未提交，状态暂时无法刷新，请恢复连接。';}
   }
   return 'rejected';
  }finally{
   this.processing=false;
   this.syncPause();
   if(this.panel&&this.panelBusy)this.refreshGearPanel();
  }
 }
 async pick(id:string){const reward=this.rewards.find(r=>r.id===id);if(!reward)return;const nearby=!this.panel?nearbyLoot(this.rewards,this.world.region,this.world.hero.position):[];if(!this.panel&&!nearby.some(r=>r.id===id))return;await this.pickMany(!this.panel?nearby.map(r=>r.id):[id]);}
 private async pickMany(ids:string[]){const requested=this.rewards.filter(r=>ids.includes(r.id)),owned=new Set(this.snapshot!.gear.map(g=>g.id));if(!requested.length||this.processing)return;const result=await this.write('reward/claim-many',{reward_ids:ids});if(result==='success'){const picked=requested.filter(r=>!owned.has(r.gear.id)&&this.snapshot!.gear.some(g=>g.id===r.gear.id));if(picked.length){this.feed.unshift(picked.length===1?'拾取 '+picked[0].gear.name:'拾取 '+picked.length+' 件装备');this.feed=this.feed.slice(0,3);this.renderHud();}}if(this.panel==='rewards'||this.panel==='bag')this.renderPanel();}
 private async returnCampAfterBattle(){const hub=this.hub,result=await this.write('safe',{region:hub,point:''});return result==='success'?this.travel(hub,false):false;}
 private async travel(id:string,newAttempt=true,at?:{x:number;y:number}):Promise<boolean>{
 if(this.activities.running){this.notice('请先结束当前世界活动。');return false;}if(this.processing)return false;this.processing=true;this.syncPause();if(this.panel==='travel')this.renderPanel();try{await this.flush();if(this.blocked)throw new ApiFailure('NETWORK','请先恢复连接。',0);const r=regionById(id);let permit:Permit|undefined;
 if(id!=='town'&&id!==starseaHub)permit=await api<Permit>('permit',{lease_id:this.lease,region:id,...(newAttempt?{attempt_id:crypto.randomUUID()}:{})});else{const receipt=await api<Receipt>('location',{command_id:crypto.randomUUID(),revision:this.snapshot!.revision,lease_id:this.lease,region:id});this.snapshot=receipt.snapshot;}
 this.snapshot=await api<Snapshot>('character');this.rewards=this.snapshot.rewards;this.feed=[];this.spoilQueue=[];clearTimeout(this.toastTimer);$('#toast').textContent='';$('#toast').style.opacity='0';hideTip();this.permit=permit;this.build=this.snapshot.build;const preferences=this.automation.value;this.world=new World({...r,sprint:r.sprint&&(!this.snapshot.starsea||this.snapshot.starsea.features.includes('sprint'))},this.snapshot.stats,this.snapshot.resolvedSkills,permit?.spawns??[],permit?.completed??[],permit?.seed??1);Object.assign(this.world,preferences);this.world.mode='semi';if(id===this.snapshot.progress.safe&&this.snapshot.progress.safePoint){const checkpoint=r.landmarks.find(l=>l.kind==='safe'&&l.name===this.snapshot!.progress.safePoint);if(checkpoint){this.world.hero.position={x:checkpoint.x,y:checkpoint.y};this.world.anchor={...this.world.hero.position};}}if(at){this.world.hero.position={...at};this.world.anchor={...at};}this.lastTick=permit?.from_tick??0;this.world.tick=this.lastTick;this.sequence=permit?.sequence??0;this.panel='';this.userPaused=false;this.productionAudio.play(r.rest||id==='town'?'world/camp-enter':'world/travel');this.notice(r.name);this.renderPanel();
 return true;}catch(e){this.noticeError(e);return false;}finally{this.processing=false;this.syncPause();if(this.panel==='travel')this.renderPanel();this.renderHud();}
 }
 private interactionCandidate(){
  const w=this.world,r=w.region,c:InteractionCandidate[]=[],view=this.starsea.view;
  for(const o of this.starsea.objects().filter(o=>o.enabled!==false))c.push({id:o.id,kind:'starsea',position:o.position,text:o.npcId?'和'+(o.name??'居民')+'对话':(o.label||'调查')+(o.name??''),reach:o.reach??interactionReach.story,priority:o.label?.includes('任务')?0:4});
  c.push({id:'portal:'+r.id,kind:'portal',position:r.portal,text:r.id===starseaHub?'打开航图':'回拾星港',reach:4,priority:1});
  if(r.bossPortal)c.push({id:'boss:'+r.id,kind:'boss',position:r.bossPortal,text:'进入首领战',reach:4,priority:1,value:view?.islands.find(i=>i.map===r.id)?.boss});
  const waypoint=this.field.active()?this.field.nearbyWaypoint():undefined;
  if(waypoint&&!this.field.unlocked(waypoint.id))c.push({id:'waypoint:'+waypoint.id,kind:'waypoint',position:waypoint,text:'激活'+waypoint.name,reach:4,priority:2,value:waypoint.name});
  const board=this.field.active()?nearbyOutpost(this.snapshot,r.id,w.hero.position):undefined;
  if(board)c.push({id:'board:'+board.id,kind:'board',position:board,text:'打开悬赏板',reach:4,priority:3,value:board.zone});
  const node=this.gather.nearest();if(node)c.push({id:'gather:'+node.id,kind:'gather',position:node,text:'采集'+materialName(node.material!),reach:gatherReach,priority:4});
  for(const o of this.activities.objects().filter(o=>o.enabled!==false))c.push({id:o.id,kind:'activity',position:o.position,text:o.label??o.name??'调查',reach:o.reach??interactionReach.activity,priority:4});
  const loot=nearbyLoot(this.rewards,r,w.hero.position)[0];if(loot)c.push({id:loot.id,kind:'loot',position:loot.position,text:'拾取附近装备',reach:settings.pickupRadius,priority:5});
  if(r.id===starseaHub)for(const forge of r.landmarks.filter(l=>l.kind==='forge'))c.push({id:'forge:'+forge.name,kind:'forge',position:forge,text:'打开工坊',reach:interactionReach.forge,priority:4});
  return selectInteraction(w.hero.position,c);
 }
 private executeInteraction(c:InteractionCandidate|undefined){
  if(!c){this.notice('走近任务目标、首领门或落点后交互。');return;}
  switch(c.kind){
   case 'starsea':void this.starsea.interact(c.id);break;
   case 'portal':if(this.world.region.id===starseaHub)this.open('starsea-chart');else void this.travel(starseaHub);break;
   case 'boss':if(c.value)void this.travel(c.value);else this.notice('这座岛尚未开放。');break;
   case 'forge':this.openForge();break;
   case 'waypoint':void this.unlockWaypoint(c.id.slice(9),c.value!);break;
   case 'board':void this.openBoard(c.value!);break;
   case 'loot':void this.pick(c.id);break;
   case 'activity':void this.activities.interact(c.id);break;
   case 'gather':void this.gather.gather(c.id,'manual');break;
  }
 }
 /** Upgrade and reroll only at the port workshop (2026-10-11, docs/forge-workshop.md); elsewhere point the player there. */
 /** 追踪条的目标行：不在港口也能打开制作页看还差什么，打造仍要在锻造台旁（服务端校验）。 */
 private openCraftGoal(id:string){const pinned=this.snapshot?.craftGoal,goal=pinned?.recipe===id?pinned:{recipe:id};if(this.dungeons.instance){this.notice('副本结束后回港打造');return;}this.world.cancelWalk();this.crafting.reset();this.crafting.focusGoal(goal);this.open('forge');void this.crafting.load();}
 private openForge(part?:'armor'|'weapon'){const w=this.world;if(this.dungeons.instance||!w.region.landmarks.some(l=>l.kind==='forge'&&distance(w.hero.position,l)<=interactionReach.forge)){this.notice('强化重铸请到拾星港工坊');return;}if(part)this.selected=this.snapshot?.equipment[part]??'';w.cancelWalk();this.crafting.reset();this.open('forge');void this.crafting.load();}
 private forgePlace(){return {region:this.world.region.id,position:{x:this.world.hero.position.x,y:this.world.hero.position.y}};}
 interact(){if(!this.loggedIn||this.panel)return;const w=this.world,r=w.region;if(this.activities.running)return;if(!this.dungeons.running&&this.starsea.active&&isStarseaRegion(r.id)){this.executeInteraction(this.interactionCandidate());return;}const activity=this.activities.nearest();if(activity){void this.activities.interact(activity.id);return;}if(this.dungeons.running){if(this.dungeons.nearestChest()){this.dungeons.interact();return;}if(distance(w.hero.position,r.portal)<4){void this.dungeons.handle('dungeon-leave','');return;}const object=this.story.nearest();if(object)this.story.interact(object.id);else this.dungeons.interact();return;}const waypoint=this.field.active()?this.field.nearbyWaypoint():undefined;if(waypoint&&!this.field.unlocked(waypoint.id)){void this.unlockWaypoint(waypoint.id,waypoint.name);return;}const outpost=this.field.active()?nearbyOutpost(this.snapshot,r.id,w.hero.position):undefined;if(outpost){void this.openBoard(outpost.zone);return;}const npc=this.story.nearest();if(r.id==='town'&&npc&&distance(w.hero.position,npc.position)<3){this.story.interact(npc.id);return;}if(distance(w.hero.position,r.portal)<4){if(r.id==='town')this.open('travel');else void this.travel('town');return;}
 if(r.bossPortal&&distance(w.hero.position,r.bossPortal)<4){if(!featureOpen(this.snapshot,'trial')){this.notice(featureReason(this.snapshot,'trial'));return;}void this.flush().then(()=>{if(!this.blocked)this.open('boss');});return;}
 const loot=nearbyLoot(this.rewards,r,w.hero.position)[0];if(loot){void this.pick(loot.id);return;}
 const checkpoint=r.landmarks.find(l=>l.kind==='safe'&&distance(w.hero.position,l)<3);if(checkpoint){void this.write('safe',{region:r.id,point:checkpoint.name}).then(result=>{if(result)this.notice('据点已记录，失败后可在这里继续。');});return;}
 const next=r.landmarks.find(l=>l.kind==='next');if(next&&distance(w.hero.position,next)<4&&r.next){void this.travel(r.next);return;}
 const forge=r.landmarks.find(l=>l.kind==='forge'&&distance(w.hero.position,l)<=interactionReach.forge);
 if(forge)this.openForge();else this.notice('走近目标，再按交互键。');
 }
 /** Activate the waypoint the hero stands beside; the server checks the distance. */
 private async unlockWaypoint(id:string,name:string){if(await this.write('quest',{op:'waypoint',region:this.world.region.id,target:id,position:{...this.world.hero.position}})==='success')this.notice('航标已激活：'+name);}
 /** Outpost bounty board: the server fills this zone's slots, then the panel shows them. */
 private boardZone='';
 private async openBoard(zone:string){this.boardZone=zone;if(await this.write('bounty/board',{region:this.world.region.id,position:{...this.world.hero.position}})==='success')this.open('bounty');}
 /** Free travel between unlocked waypoints of this map (server: not in dungeons or quest waves; full bag allowed). */
 private async travelWaypoint(id:string){if(this.field.inCombat()){this.notice('战斗中不能传送。');return;}const permit=this.permit;if(!permit||permit.region!==this.world.region.id)return;
  if(await this.write('travel/waypoint',{permit_id:permit.id,waypoint:id})!=='success')return;this.field.arrive(id);this.panel='';this.syncPause();this.renderPanel();const name=this.field.mapView()?.waypoints.find(w=>w.id===id)?.name;if(name)this.notice('已传送到 '+name);}
 private async action(action:string,id:string){if(this.activationPending)return;this.lastError='';if(action==='combat-advice'){const to=combatAdviceDestination(id);if(!to)return;if(this.result.context){await this.result.return();if(this.result.context)return;}else if(this.dungeons.instance){if(this.dungeons.running)return;await this.dungeons.handle('dungeon-return','');if(this.dungeons.instance)return;}if(to.action==='advice-forge')this.openForge(to.id as 'armor'|'weapon');else await this.action(to.action,to.id);return;}if(action.startsWith('bounty-')){const op=action.slice(7);if(['accept','claim','abandon'].includes(op)&&await this.write('bounty/'+op,{instance:id})==='success'){if(op==='claim')this.notice('悬赏奖励已领取，这一栏 10 分钟后刷新。');this.renderPanel();}return;}if(action==='replay-goto'){const target=this.field.mapView()?.replay;if(target&&!target.done){this.open('');this.go({x:target.x,y:target.y});}return;}if(action==='waypoint-travel'){await this.travelWaypoint(id);return;}if(action==='world-tier'){const name=this.snapshot?.worldTierChoices?.find(t=>t.tier===Number(id))?.name;if(await this.write('world/tier',{tier:Number(id),region:this.world.region.id,position:{...this.world.hero.position}})==='success'){this.seaTierPick=Number(id);this.notice('已切换到'+(name??'所选海域')+'，出海后生效');this.renderPanel();}return;}if(action==='sea-tier-pick'){this.seaTierPick=Number(id);this.renderPanel();return;}if(action.startsWith('story-')){await this.story.handle(action,id);return;}if(action==='starsea-chart'){this.open('starsea-chart');return;}if(action.startsWith('starsea-')){await this.starsea.handle(action,id);return;}
 if(['challenge-run','challenge-create','challenge-start','challenge-join','challenge-ready'].includes(action)){this.dungeons.category=action==='challenge-run'?(id==='nightmare'?'nightmare':'high'):'raid';this.dungeons.selected=action==='challenge-run'?id:id+'-live';this.open('dungeons');await this.dungeons.load();return;}
 if(action==='goal-craft'){this.openCraftGoal(id);return;}
 if(action.startsWith('craft-')){await this.crafting.handle(action,id);return;}if(this.panel==='forge'&&(action==='stage-key-preview'||action==='stage-key-craft')){await this.crafting.handle(action==='stage-key-preview'?'craft-key-preview':'craft-key-make',id);return;}
 if(action==='stage-key-preview'||action==='stage-key-craft'||action.startsWith('dungeon-')||action.startsWith('augment-')){await this.dungeons.handle(action,id);return;}
 if(action==='panel'&&id==='dungeons'){this.open('dungeons');return;}
 if(this.dungeons.running){if(action==='mode'){if(this.panel)return;this.hudModeOpen=false;this.dungeons.input({kind:'mode',mode:id as Mode});this.renderHud();document.querySelector<HTMLElement>('[data-action=hud-mode-toggle]')?.focus({preventScroll:true});return;}if(action==='travel'||action==='boss'){await this.dungeons.handle('dungeon-leave','');return;}if(action==='guide'){const target=id==='boss'?this.world.region.bossPortal:this.world.region.portal;if(target)this.dungeons.go(target);return;}if(action==='recover'){await this.dungeons.handle('dungeon-reconnect','');return;}if(action==='logout'){await this.dungeons.handle('dungeon-leave','');}}

 if(this.result.context&&action!=='recover'){if(action==='result-return'||action==='close')await this.result.return();if(action==='result-retry'){const region=this.result.context.region;await this.result.return();if(!this.result.context)await this.travel(region);}return;}
 if(action==='bind'&&Object.hasOwn(this.bindings,id)){this.binding=id;this.bindingMessage='请按新键，Esc 取消。';this.renderPanel();return;}
 if(action==='close'){this.open('');return;}
 if(action==='auth-retry'){await this.start();return;}
 if(action==='auth-reload'){location.reload();return;}
 if(action==='login'||action==='register'){if(!this.compatible){this.notice('暂时连不上游戏服务，请稍后刷新重试。');return;}if(this.loginPending)return;const username=($('#username') as HTMLInputElement).value.trim();if(!/^[a-zA-Z0-9_]{3,32}$/.test(username)){const input=$('#username') as HTMLInputElement;setFieldFeedback(input,'账号请输入 3–32 位字母、数字或下划线。');input.focus({preventScroll:true});return;}this.setAuthPending(true,action);try{await api('session/'+action,this.accountOnly?{username}:{username,password:($('#password') as HTMLInputElement).value});try{this.snapshot=await api<Snapshot>('character');await this.activate();}catch(e){if(e instanceof ApiFailure&&e.code==='CHARACTER'){this.panel='create';this.renderPanel();const field=$('#hero-name') as HTMLInputElement;field.focus({preventScroll:true});field.select();}else throw e;}}catch(e){this.noticeError(e);}finally{this.setAuthPending(false);}return;}
 if(action==='create'){if(this.loginPending)return;const input=$('#hero-name') as HTMLInputElement,name=input.value.trim();if(!name){setFieldFeedback(input,'请输入角色名称。');input.focus({preventScroll:true});return;}this.setAuthPending(true,'create');try{this.snapshot=await api<Snapshot>('character',{name});await this.activate();}catch(e){if(e instanceof ApiFailure&&e.code==='AUTH'){this.authError='登录已过期，请重新登录。';this.panel='login';this.renderPanel();}else if(e instanceof ApiFailure&&['NETWORK','SERVER','PROTOCOL'].includes(e.code)){try{this.snapshot=await api<Snapshot>('character');await this.activate();}catch{this.noticeError(new Error('连接中断，点击“进入营地”重试，已有角色会自动恢复。'));}}else this.noticeError(e);}finally{this.setAuthPending(false);}return;}
 if(action==='takeover'){if(this.loginPending)return;this.setAuthPending(true,'takeover');try{await this.activate(true);}finally{this.setAuthPending(false);}return;}
 if(!this.loggedIn)return;
 if(action.startsWith('quest-')&&this.panel==='tasks'){await this.tasks.handle(action,id);return;}
 if(action.startsWith('appearance-')){if(action==='appearance-motion'){this.appearanceClock=0;this.appearanceLastTime=performance.now();}await this.appearance.handle(action,id);if(action==='appearance-slot'){const tab=document.querySelector<HTMLElement>(`.appearance-slots [data-id="${id}"]`);tab?.focus({preventScroll:true});tab?.scrollIntoView({block:'nearest',inline:'nearest'});}return;}
 if(this.panel==='progression'&&(action.startsWith('progression-')||action.startsWith('challenge-'))){
  if(action==='progression-group'){const group=visibleProgressionGroups(this.snapshot).find(g=>g.id===id);if(!group)return;this.progressionGroup=id;if(id==='challenges'){this.renderPanel();await this.challenges.load();}else{if(!this.progression.ui.view)await this.progression.load();const section=this.progression.ui.view?.sections.find(s=>group.sections.includes(s.id));if(section)await this.progression.handle('progression-section',section.id);}const target=document.querySelector<HTMLElement>(`[data-action=progression-group][data-id="${id}"]`);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});return;}
  if(action.startsWith('challenge-'))await this.challenges.handle(action,id);else {const returnId=this.progression.ui.resetConfirm?.id;await this.progression.handle(action,id);if(['progression-summary','progression-run'].includes(action)&&document.querySelector('.confirm-box'))document.querySelector<HTMLElement>('.confirm-box button')?.focus({preventScroll:true});if(action==='progression-summary-close')document.querySelector<HTMLElement>('[data-action=progression-summary]')?.focus({preventScroll:true});if(action==='progression-reset-cancel')document.querySelector<HTMLElement>(`[data-action=progression-run][data-id="${returnId}"]`)?.focus({preventScroll:true});}return;
 }
 if(action.startsWith('travel-')&&this.panel==='travel'){
  const model=travelModel(this.travelUI,this.snapshot!);
  if(action==='travel-drop-retry'){void this.loadTravelDrops(true);return;}
  if(action==='travel-region'&&model.areas.some(area=>area.id===id)){this.travelUI.regionId=id;this.travelUI.destinationId=id;this.travelUI.query='';this.travelUI.page=0;}
  else if(action==='travel-select'){const selected=model.catalog.find(d=>d.region.id===id);if(selected){this.travelUI.destinationId=id;this.travelUI.regionId=selected.area.id;}}
  else if(action==='travel-mode'&&(id==='explore'||id==='dungeon')){this.travelUI.mode=id;this.travelUI.page=0;}
  else if(action==='travel-filter'&&(id==='all'||id==='available')){this.travelUI.filter=id;this.travelUI.page=0;}
  else if(action==='travel-page'){const page=Number(id);if(Number.isInteger(page))this.travelUI.page=Math.max(0,Math.min(page,model.pages-1));}
  else if(action==='travel-reset'){this.travelUI.query='';this.travelUI.filter='all';this.travelUI.page=0;}
  else if(action==='travel-depart'){
   const destination=destinationCatalog().find(d=>d.region.id===id);if(!destination||!destinationReady(destination,this.snapshot!))return;
   if(destination.kind==='explore')await this.travel(id);
   else {this.open('dungeons');this.dungeons.selected='trial-'+destination.area.id;this.dungeons.category='trial';await this.dungeons.load();}
   return;
  }
  this.refreshTravel();return;
 }
 if(action==='hud-mode-toggle'){if(this.panel||!this.dungeons.running)return;this.hudModeOpen=!this.hudModeOpen;this.renderHud();document.querySelector<HTMLElement>(this.hudModeOpen?'#hud-mode-options [data-action=mode]:not([disabled])':'[data-action=hud-mode-toggle]')?.focus({preventScroll:true});return;}
 if(action==='hud-task-open'){const row=this.tasks.data?.current.find(row=>row.id===id);if(!row)return;this.tasks.ui.mode='current';Object.assign(this.tasks.ui.views.current,{type:'all',query:'',status:'all',selected:row.id});this.open('tasks');return;}
 if(action==='hud-dungeon-exit'){const frame=this.dungeons.instance;if(!this.dungeons.running||!frame)return;this.confirm='dungeon-exit';this.confirmId=frame.id;this.renderPanel();this.focusPanel();return;}
 if(action==='hud-dungeon-exit-cancel'){this.confirm='';this.confirmId='';this.renderPanel();document.querySelector<HTMLElement>('[data-action=hud-dungeon-exit]')?.focus();return;}
 if(action==='hud-dungeon-exit-confirm'){if(this.confirm!=='dungeon-exit'||this.confirmId!==id||this.dungeons.instance?.id!==id||!this.dungeons.running||this.dungeons.busy)return;await this.dungeons.handle('dungeon-leave','');this.confirm='';this.confirmId='';this.renderPanel();this.renderHud();return;}
 // Field and town are fixed semi-auto (skills auto-cast, player moves); the mode switch is dungeon-only (handled above).
 if(action==='cast'){this.cast(Number(id));return;}
 if(action==='panel'){if(id==='bag')this.bagTab='bag';if(id==='rewards'){this.bagTab='rewards';this.open('bag');return;}this.open(id);return;}
 if(action==='camp-sort'){const from=this.world.region.id,hub=this.hub;if(await this.travel(hub,false)){if(from!==hub&&!regionById(from).boss)this.fieldReturnRegion=from;this.bagTab='bag';this.open('bag');}return;}
 if(action==='field-resume'){if(this.fieldReturnRegion)await this.travel(this.fieldReturnRegion,false);return;}
 if(action==='travel'){await this.travel(id);return;}
 if(action==='pause'){this.pause();return;}
 if(action==='boss'){if(!featureOpen(this.snapshot,'trial'))return;this.dungeons.selected='trial-'+this.world.region.id;this.dungeons.category='trial';this.open('dungeons');await this.dungeons.load();return;}
 if(action==='guide'){
   this.open('');
   if(id==='boss'&&this.world.region.bossPortal){
     this.world.go(this.world.region.bossPortal);
   }else if(id==='portal'&&this.world.region.portal){
     this.world.go(this.world.region.portal);
   }
   return;
 }
 if(action==='stage-key-open'){await this.dungeons.load();const entry=this.dungeons.entries.find(e=>e.definition.numericStage===this.snapshot?.world?.activeKeyStage);if(entry)this.dungeons.selected=entry.definition.id;await this.dungeons.loadKeys();this.open('dungeons');return;}
 if(action==='bag-warehouse'){if(!['town','ss-map-port'].includes(this.world.region.id)){this.notice('请到港口或前哨仓库整理。');return;}this.bag.ui.warehouseOpen=true;this.bag.ui.page=0;this.bag.ui.warehousePage=0;this.renderPanel();return;}
 if(action==='warehouse-close'){this.bag.ui.warehouseOpen=false;this.renderPanel();return;}
 if(action==='warehouse-page'){const page=Number(id);if(Number.isInteger(page)&&page>=0)this.bag.ui.warehousePage=page;this.renderPanel();return;}
 if(action==='warehouse-store'||action==='warehouse-withdraw'){if(this.processing||this.blocked)return;await this.write('warehouse/'+(action==='warehouse-store'?'store':'withdraw'),{gear_id:id});this.renderPanel();return;}
 if(action==='bag-page'){const page=Number(id);if(Number.isInteger(page)&&page>=0){this.bag.ui.page=page;this.bag.ui.selected='';this.refreshBag();}return;}
 if(action==='bag-category'){if(!Object.hasOwn(bagCategories,id))return;this.bag.ui.page=0;this.bag.ui.category=id as BagCategory;this.bag.ui.selected='';this.bag.ui.query='';this.bag.ui.scrollTop=0;if(this.bag.ui.status!=='pending')this.bag.ui.message='';this.bag.ui.error='';this.qualityFilter='';this.slotFilter='';this.refreshBag();await this.bag.previewSelected();return;}
 if(action==='bag-select'){this.bag.ui.scrollTop=document.querySelector<HTMLElement>('[data-bag-scroll=list]')?.scrollTop??this.bag.ui.scrollTop;const suppressTip=()=>{if(this.panel!=='bag')return;const target=Array.from(document.querySelectorAll<HTMLElement>('[data-action=bag-select]')).find(node=>node.dataset.id===id);if(target)dismissTip(target);};suppressTip();this.bag.ui.selected=id;this.refreshBag();suppressTip();await this.bag.select(this.bag.ui.selected);if(this.bag.ui.selected===id)suppressTip();return;}
 if(action==='bag-use-tonic'){if(tonicDefinitions.some(def=>def.id===id))await this.bag.use(id as TonicId);return;}
 if(action==='bag-refresh-quote'){await this.bag.previewSelected();return;}
 if(action==='bag-refresh'){await this.bag.load();return;}
 if(action==='bag-skill'){const skill=skillCatalog.find(skill=>skill.id===id);if(!skill)return;this.skillCategory=skillSchoolOf(skill.category);this.skillTags=[];this.skillFocus=id;this.skillPageFocus[this.skillCategory]=id;this.open('skills');return;}
 if(action==='bag-workshop'){this.openForge();return;}
 if(action==='bag-progression'){const [section,item]=id.split(':');const group=visibleProgressionGroups(this.snapshot).find(group=>group.sections.includes(section));if(!group){this.notice('该养成功能尚未解锁。');return;}this.progressionGroup=group.id;this.progression.ui.section=section;this.progression.ui.item=item??'';this.progression.ui.operation='';this.progression.ui.preview=undefined;this.open('progression');return;}
 if(action==='bag-character'){if(this.processing)return;const gear=this.snapshot?.gear.find(gear=>gear.id===id);if(gear){this.characterPart=gear.slot==='accessory'?'necklace':gear.slot;this.selected=gear.id;}this.open('character',Boolean(gear));if(gear)this.focusCharacterChooser();return;}
 if(action==='character-chooser-close'){this.closeCharacterChooser();return;}
 if(action==='character-details'){this.characterDetailsOpen=!this.characterDetailsOpen;this.refreshGearPanel();return;}
 if(action==='bag-return'){this.bagTab='bag';this.open('bag');Array.from(document.querySelectorAll<HTMLElement>('[data-action=bag-select]')).find(node=>node.dataset.id===this.bag.ui.selected)?.focus({preventScroll:true});return;}
 if(action==='gear-quality'){if(['','common','magic','rare','legendary'].includes(id)){this.qualityFilter=id as GearQuality|'';this.refreshGearPanel();}return;}
 if(action==='gear-slot'){if(isGearSlotFilter(id)){this.slotFilter=id;this.refreshGearPanel();}return;}
 if(action==='gear-filter-reset'){this.qualityFilter='';this.slotFilter='';this.refreshGearPanel();return;}
 if(action==='equip'&&['bag','character'].includes(this.panel)){if(this.processing||!this.snapshot?.gear.some(item=>item.id===id))return;const pending=this.write('gear/equip',{gear_id:id},true);this.renderPanel();await pending;this.renderPanel();return;}
 if(action==='select'){this.selected=id;dismissTip(document.querySelector<HTMLElement>(`[data-action=select][data-id="${id}"]`)??undefined);this.renderPanel();const target=document.querySelector<HTMLElement>(`[data-action=select][data-id="${id}"]`);target?.focus({preventScroll:true});if(target)dismissTip(target);return;}
 if(action==='tracker-toggle'){this.trackerOpen=!this.trackerOpen;this.renderHud();return;}
 if(action==='bag-tab'){this.bagTab=id==='rewards'?'rewards':'bag';this.renderPanel();if(this.bagTab==='bag')await this.bag.load();return;}
 if(action==='filter-slot'){if(this.panel!=='character'||!isGearSlotFilter(id)||!id)return;this.characterPart=id;this.characterChooserOpen=true;const slot=runtimeSlotForPart(id);this.selected=slot?(this.snapshot?.equipment[slot]??this.snapshot?.gear.find(gear=>gear.slot===slot)?.id??''):'';hideTip();this.renderPanel();this.focusCharacterChooser();return;}
 if(action==='skill-tag'){if(this.processing)return;this.skillTags=!id?[]:this.skillTags.includes(id)?this.skillTags.filter(t=>t!==id):[...this.skillTags,id];this.renderPanel();document.querySelector<HTMLElement>(id?`[data-action=skill-tag][data-id="${id}"]`:'[data-action=skill-tag]')?.focus({preventScroll:true});return;}
 if(action==='skill-category'){if(this.processing)return;if(!(id in skillBookTabs))return;this.skillCategory=id as SkillSchool|'all';this.skillTags=[];this.skillFocus=this.skillPageFocus[this.skillCategory]??skillCatalog.find(sk=>this.skillCategory==='all'||skillSchoolOf(sk.category)===this.skillCategory)!.id;this.renderPanel();document.querySelector<HTMLElement>(`[data-action=skill-category][data-id="${id}"]`)?.focus({preventScroll:true});return;}
 if(action==='skill-focus'){if(!skillCatalog.some(sk=>sk.id===id))return;this.skillFocus=id;this.skillPageFocus[this.skillCategory]=id;this.renderPanel();document.querySelector<HTMLElement>(`[data-action=skill-focus][data-id="${id}"]`)?.focus({preventScroll:true});return;}
 if(action==='skill-locate'){const skill=skillCatalog.find(sk=>sk.id===id);if(!skill)return;this.skillCategory=skillSchoolOf(skill.category);this.skillTags=[];this.skillFocus=id;this.skillPageFocus[this.skillCategory]=id;this.skillQuery='';this.skillFilter='all';this.renderPanel();const card=document.querySelector<HTMLElement>(`.lib-pick[data-id="${id}"]`);card?.scrollIntoView({block:'nearest'});document.querySelector<HTMLElement>(`.loadout [data-id="${id}"]`)?.focus({preventScroll:true});return;}
 if(action==='bag-batch-preview'){if(this.world.region.id!==this.hub){this.notice('请回归途营地整理装备。');return;}await this.flush();if(this.blocked)return;await this.bag.previewBatch();this.focusPanel();return;}
 if(action==='bag-batch-cancel'){this.bag.cancelBatch();return;}
 if(action==='bag-batch-salvage'){if(this.world.region.id===this.hub)await this.bag.salvageBatch();return;}
 if(action==='salvage-confirm'){hideTip();this.confirm='salvage';this.confirmId=id;this.renderPanel();this.focusPanel();return;}
 if(action==='cancel-confirm'){if(this.processing)return;this.confirm='';this.confirmId='';this.renderPanel();this.restoreInventoryFocus();return;}
 if(action==='salvage'){if(this.confirm!=='salvage'||this.confirmId!==id)return;await this.write('gear/salvage',{gear_id:id},false);this.confirm='';this.confirmId='';this.renderPanel();this.restoreInventoryFocus();return;}
 if(action==='reroll'){const select=document.querySelector<HTMLSelectElement>('#reroll-affix-slot');if(!select?.value){this.notice('请选择一条可反复重铸的副属性。');return;}const pending=this.write('gear/reroll',{gear_id:id,affix_slot:Number(select.value),...this.forgePlace()},true);this.renderPanel();await pending;this.renderPanel();return;}
 if(['equip','unequip','lock','upgrade'].includes(action)){const pending=this.write('gear/'+action,{gear_id:id,...(action==='upgrade'?this.forgePlace():{})},['equip','unequip','upgrade'].includes(action));this.renderPanel();await pending;this.renderPanel();return;}
 if(action==='claim'){await this.pick(id);return;}
 if(action==='skill-equip'||action==='skill-unequip'){
  if(this.blocked||this.processing||this.dungeons.locked)return;
  const snapshot=this.snapshot!,equipped=snapshot.skills.includes(id),operation=action==='skill-equip'?'equip':'unequip';
  if(operation==='equip'&&!snapshot.skillAccess.some(sk=>sk.id===id&&sk.activated)||equipped===(operation==='equip'))return;
  if(operation==='equip'&&snapshot.skills.length>=(snapshot.skillRecovery?.slots??4)){this.notice('技能位已满，请先卸下一个技能。');return;}
  if(operation==='unequip'&&snapshot.skills.length===1){this.notice('至少保留一个已装配技能。');return;}
  const skills=operation==='equip'?[...snapshot.skills,id]:snapshot.skills.filter(sk=>sk!==id);
  this.skillOperation=operation;this.skillOperationId=id;this.skillStatus='';this.skillMessage='';
  const pending=this.write('skills',{skills},true);this.renderPanel();const result=await pending;
  this.skillOperation='';this.skillStatus=result==='success'?'success':result==='pending'?'pending':'error';
  this.skillMessage=result==='success'?(this.blocked?'技能已装配，请恢复连接后继续战斗。':operation==='equip'?'技能已装配。':'技能已卸下。'):result==='pending'?'操作结果待确认，请恢复连接。':this.lastError;
  this.renderPanel();document.querySelector<HTMLElement>(`[data-action=skill-${this.snapshot!.skills.includes(id)?'unequip':'equip'}][data-id="${id}"]`)?.focus({preventScroll:true});return;
 }
 if(action==='skill-activate'||action==='skill-upgrade'){
  if(this.blocked||this.processing||this.dungeons.locked)return;
  const quote=this.snapshot!.skillAccess.find(sk=>sk.id===id),operation=action==='skill-activate'?'activate':'upgrade';
  if(!quote||quote.action!==operation||!quote.affordable)return;
  this.skillOperation=operation;this.skillOperationId=id;this.skillStatus='';this.skillMessage='';
  const pending=this.write('skills/'+operation,{skill_id:id},true);this.renderPanel();const result=await pending;
  this.skillOperation='';this.skillStatus=result==='success'?'success':result==='pending'?'pending':'error';
  this.skillMessage=result==='success'?(this.blocked?'操作已保存，请恢复连接后继续战斗。':operation==='activate'?'激活成功，可以装配使用。':'技能升级成功。'):result==='pending'?'操作结果待确认，请恢复连接后继续。':this.lastError;
  this.renderPanel();document.querySelector<HTMLElement>(`[data-action=skill-focus][data-id="${id}"]`)?.focus({preventScroll:true});return;
 }
 if(action==='recover'){if(this.processing)return;const retainedInventory=['bag','character'].includes(this.panel)?this.panel:'';const retainedProgression=this.panel==='progression';const retainedAppearance=this.panel==='appearance';const retainedTasks=this.panel==='tasks';const retainedSkills=this.panel==='skills';try{this.processing=true;this.syncPause();if(retainedInventory)this.renderPanel();const control=await api<{lease_id:string}>('control',{takeover:false,client_id:this.clientId});this.lease=control.lease_id;await this.recover();if(this.permitStale){this.permit=undefined;this.permitStale=false;}this.processing=false;await this.travel(this.world.region.id,false);if(retainedSkills){this.open('skills');this.skillStatus='';this.skillMessage='连接已恢复，技能装配已读取。';this.renderPanel();}if(retainedProgression){this.open('progression');this.progression.ui.status='';this.progression.ui.message='连接已恢复，已读取操作结果。';}if(retainedAppearance){this.open('appearance');this.appearance.ui.status='';this.appearance.ui.message='连接已恢复，外观已读取。';}if(retainedTasks)this.open('tasks');if(retainedInventory){this.bag.ui.status='';this.bag.ui.error='';this.bag.ui.message='连接已恢复，行囊已读取。';this.open(retainedInventory,this.characterChooserOpen);}this.notice('连接已恢复，已确认的进度保留；本场未确认的生命、位置与冷却已重新初始化。');}catch(e){this.noticeError(e);if(e instanceof ApiFailure&&e.code==='BUSY'){this.panel='takeover';this.renderPanel();}}finally{this.processing=false;this.syncPause();}return;}
 if(action==='logout'){await this.flush();if(this.blocked)return;await api('logout',{});this.productionAudio.stop();this.loggedIn=false;this.panel='login';this.renderPanel();this.renderHud();return;}
 }
 private change(input:HTMLInputElement){if(this.productionAudio.change(input)){this.volume=this.productionAudio.settings.master;return;}if(input.id==='skill-filter'){if(['all','active','eligible'].includes(input.value))this.skillFilter=input.value as typeof this.skillFilter;this.renderPanel();document.querySelector<HTMLElement>('#skill-filter')?.focus({preventScroll:true});return;}if(input.hasAttribute('data-dungeon-role')){this.dungeons.role=input.value;return;}if(input.hasAttribute('data-dungeon-tier')){this.dungeons.tier=Number(input.value);return;}if(this.panel==='tasks'&&this.tasks.input(input))return;if(input.dataset.bagFilter){if(input.dataset.bagFilter==='quality'&&['','common','magic','rare','legendary'].includes(input.value))this.qualityFilter=input.value as GearQuality|'';if(input.dataset.bagFilter==='slot'&&isGearSlotFilter(input.value))this.slotFilter=input.value;if(input.dataset.bagFilter==='zero')this.bag.ui.showZero=input.checked;if(input.dataset.bagFilter==='island'){this.bag.ui.island=input.value;this.bag.ui.page=0;}this.bag.ui.scrollTop=0;this.refreshBag();void this.bag.previewSelected();return;}if(input.hasAttribute('data-progression-operation')){void this.progression.handle('progression-operation',input.value);return;}if(input.dataset.challengeTier){this.challenges.ui.tiers[input.dataset.challengeTier]=input.value;return;}if(input.dataset.challengeRole){this.challenges.ui.roles[input.dataset.challengeRole]=input.value as import('../../../packages/contracts/progression-challenges.ts').RaidRole;return;}
 if(input.id==='radius'){const radius=Number(input.value);if(input.value.trim()===''||!Number.isFinite(radius)||radius<3||radius>20||!Number.isInteger(radius)){setFieldFeedback(input,'请输入 3–20 之间的整数。');return;}this.automation.setRadius(radius);setFieldFeedback(input);}
 if(input.id==='pickup-quality'){const parsed=pickupFilterSchema.safeParse({...this.pickupFilter,minimumQuality:input.value});if(parsed.success)this.pickupFilter=parsed.data;}if(input.id==='pickup-own-weapon')this.pickupFilter.ownWeaponOnly=input.checked;if(input.id.startsWith('pickup-slot-')){const slot=input.id.slice(12);const parsed=pickupFilterSchema.safeParse({...this.pickupFilter,excludedSlots:input.checked?this.pickupFilter.excludedSlots.filter(s=>s!==slot):[...new Set([...this.pickupFilter.excludedSlots,slot])]});if(parsed.success)this.pickupFilter=parsed.data;}
 if(input.id==='elite')this.automation.update({avoidElite:!input.checked});if(input.id==='priority')this.automation.update({targetPriority:input.value as 'near'|'ranged'});if(input.id==='auto-skills')this.automation.update({autoSkills:input.checked});if(input.id==='volume'){const volume=Number(input.value);if(!Number.isFinite(volume))return;this.volume=Math.max(0,Math.min(1,volume));const output=document.querySelector('#volume-output');if(output)output.textContent=Math.round(this.volume*100)+'%';}if(input.id==='motion')this.reduced=input.checked;if(input.id==='auto-pickup')this.autoPickup=input.checked;
 if(!this.authoritativeWorld)this.automation.apply(this.world);this.saveSettings();
 }
 get motionReduced(){return this.reduced;}
 private saveSettings(){document.documentElement.dataset.motionReduced=String(this.reduced);localStorage.setItem('aw-settings',JSON.stringify({...this.automation.value,audio:this.productionAudio.settings,volume:this.volume,reduced:this.reduced,autoPickup:this.autoPickup,pickupFilter:this.pickupFilter,bindings:this.bindings}));}
 notice(message:string){$('#toast').textContent=message;$('#toast').style.opacity='1';placeNotification($('#toast'));clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>$('#toast').style.opacity='0',3500);}
 private noticeError(e:unknown){this.productionAudio.play('ui/error');const message=e instanceof Error?e.message:'操作未完成，请重试。';this.lastError=message;const error=document.querySelector('.error');if(error)error.textContent=message;else this.notice(message);}
 skillSound(cue:SoundDispatch,pan:number,visible:boolean){if(!this.loggedIn||this.volume<=0||document.hidden&&this.productionAudio.settings.muteBackground)return;this.combatAudio.skill(cue.key,cue.stage,cue.tick,this.volume,{pan,visible,monster:cue.monster,thickness:cue.thickness,boss:cue.boss});}
 sound(kind:string){if(!this.loggedIn||this.volume<=0||document.hidden&&this.productionAudio.settings.muteBackground)return;this.combatAudio.play(kind,this.world.tick,this.volume);}
 private fieldMapView(){const field=this.field.mapView();return field?{...field,activities:this.activities.markers(field)}:undefined;}
 private view(){return {audio:this.productionAudio.settings,autoPreferences:this.automation.value,bounty:this.panel==='bounty'?bountyView(this.snapshot,this.boardZone):undefined,fieldMap:this.fieldMapView(),seaDifficulty:seaDifficultyView(this.snapshot,this.world.region.id,this.world.hero.position),seaTierPick:this.seaTierPick,hudModeOpen:this.hudModeOpen,story:this.snapshot?.starsea?undefined:this.story.data,taskData:this.tasks.data,dungeonId:this.dungeons.instance?.id,dungeonBusy:this.dungeons.busy,allyTarget:this.dungeons.selectedAlly,accountOnly:this.accountOnly,authReady:this.compatible,authConnecting:this.authConnecting,authError:this.authError,authReload:this.authReload,portraitURL:this.portraitURL,figureURL:this.figureURL,appearance:this.appearance.ui,appearanceDirty:this.appearance.dirty,world:this.world,snapshot:this.snapshot,loggedIn:this.loggedIn,panel:this.panel,confirm:this.confirm,confirmId:this.confirmId,feed:this.feed,blocked:this.blocked,userPaused:this.userPaused,processing:this.processing||this.activationPending,selected:this.selected,skillFocus:this.skillFocus,skillCategory:this.skillCategory,skillTags:this.skillTags,skillQuery:this.skillQuery,skillFilter:this.skillFilter,skillLocked:this.dungeons.locked,frozenSkills:this.dungeons.instance?.self?.frozen?.skills,skillOperation:this.skillOperation,skillOperationId:this.skillOperationId,skillStatus:this.skillStatus,skillMessage:this.skillMessage,lastError:this.lastError,binding:this.binding,bindingMessage:this.bindingMessage,volume:this.volume,reduced:this.reduced,autoPickup:this.autoPickup,pickupFilter:this.pickupFilter,fieldReturnRegion:this.fieldReturnRegion,dungeonRunning:this.dungeons.running,dungeonConnected:this.dungeons.inputReady,bagTab:this.bagTab,bag:this.bag.ui,characterPart:this.characterPart,characterChooserOpen:this.characterChooserOpen,characterDetailsOpen:this.characterDetailsOpen,slotFilter:this.slotFilter,qualityFilter:this.qualityFilter,trackerOpen:this.trackerOpen,bindings:this.bindings,onSelect:(id:string)=>this.selected=id,previewGear:(id:string)=>api<GrowthPreview>('gear/'+id+'/preview'),previewGearTip:(id:string)=>api<GearTip>('gear/'+id+'/tip'),noticeError:(e:unknown)=>this.noticeError(e),onConfirm:(action:string,id:string)=>{if(action==='salvage'){this.confirm='salvage';this.confirmId=id;this.renderPanel();}},onCancelConfirm:()=>{this.confirm='';this.confirmId='';this.renderPanel();}};}

 private animateAppearance(time:number){
  const delta=Math.min(.1,Math.max(0,(time-this.appearanceLastTime)/1000));this.appearanceLastTime=time;
  if(this.panel==='appearance'&&this.appearanceCanvas.isConnected){
   if(this.appearanceAction!==this.appearance.ui.action){this.appearanceAction=this.appearance.ui.action;this.appearanceClock=0;}
   if(this.appearance.ui.playing&&!document.hidden)this.appearanceClock+=delta;
   const duration=this.appearancePainter.actionDuration(this.appearance.ui.action);
   this.appearancePainter.render({action:this.appearance.ui.action,clock:duration?this.appearanceClock%duration:this.appearanceClock,facing:this.appearance.ui.facing});
   const state=this.appearancePainter.diagnostics(),expected=this.appearance.ui.preview?.resolvedAppearance??this.appearance.ui.view?.resolvedAppearance;
   const current=Boolean(expected&&state.ready&&state.key===appearanceRenderKey(expected)&&!state.pending);
   if(expected&&!current&&!this.appearance.ui.previewLoading&&!state.pending)void this.appearancePainter.setAppearance(expected);
   const status=document.querySelector<HTMLElement>('#appearance-render-status');if(status){const text=this.appearance.ui.previewLoading?'正在生成预览…':state.pending?'正在加载外观…':state.errors.length&&!current?'新外观加载失败，暂时显示上一套，请稍后重试。':current?'预览就绪':'正在加载角色部件…';if(status.textContent!==text)status.textContent=text;}
   const save=document.querySelector<HTMLButtonElement>('[data-action=appearance-save]');if(save)save.disabled=this.appearance.ui.busy||this.appearance.ui.loading||this.appearance.ui.previewLoading||this.blocked||!this.appearance.dirty||!this.appearance.ui.preview||!current;
  }
  requestAnimationFrame(next=>this.animateAppearance(next));
 }
 private async syncAppearancePortrait(){
  const appearance=this.snapshot?.resolvedAppearance;if(!appearance)return;const key=appearanceRenderKey(appearance);if(key===this.portraitKey)return;this.portraitKey=key;
  if(!await this.portraitPainter.setAppearance(appearance)||this.portraitKey!==key){if(this.portraitKey===key)this.portraitKey='';return;}
  this.portraitPainter.render({action:'idle',clock:.1,facing:-1});
  const head=Object.assign(document.createElement('canvas'),{width:96,height:96});this.portraitPainter.drawPortrait(head);this.portraitURL=head.toDataURL('image/png');this.figureURL=this.portraitCanvas.toDataURL('image/png');
  document.querySelectorAll<HTMLImageElement>('.who img').forEach(image=>image.src=this.portraitURL);document.querySelectorAll<HTMLImageElement>('.doll-hero').forEach(image=>image.src=this.figureURL);
 }
 renderHud(){if(this.loggedIn)this.productionAudio.state(this.snapshot,this.progression.ui.view,this.dungeons.instance);if(this.result.phase==='ready'&&this.result.data)this.productionAudio.result(this.result.data.permit_id,this.result.data.success);const frame=this.dungeons.instance;if(frame?.outcome)this.productionAudio.result(frame.id,frame.outcome==='success');if(this.panel==='character'&&this.characterDetailsOpen&&performance.now()-this.lastDamagePanelAt>=500){this.lastDamagePanelAt=performance.now();const key=JSON.stringify([this.world.stats,this.world.skills,this.world.effectStats]);if(key!==this.damagePanelKey){this.damagePanelKey=key;this.refreshGearPanel();}}if(this.confirm==='dungeon-exit'&&!this.dungeons.running){this.confirm='';this.confirmId='';this.renderPanel();}if(this.loggedIn)this.tasks.sync();updateHud(this.view());this.dungeons.renderHud();if(this.loggedIn)this.story.sync();this.story.renderHud(this.loggedIn);this.starsea.renderHud(this.loggedIn);this.activities.renderHud();void this.syncAppearancePortrait();}
 renderPanel(){
  this.panelBusy=this.processing||this.activationPending;
  if(this.panel==='story'){hideTip();this.story.render($('#modal'));return;}
  if(this.panel==='starsea-route'){hideTip();this.starsea.renderRoute($('#modal'));return;}
  if(this.panel==='starsea-talk'){hideTip();this.starsea.renderTalk($('#modal'));return;}
  if(this.panel==='starsea-chart'){hideTip();this.starsea.renderChart($('#modal'));return;}
  if(this.panel==='battle-result'&&this.result.context){hideTip();this.result.render($('#modal'),regionById(this.hub).name);refreshTips();return;}
  if(this.panel==='augments'){this.dungeons.renderAugments($('#modal'));refreshTips();return;}
  if(['dungeons','dungeon-result'].includes(this.panel)){this.dungeons.render($('#modal'));refreshTips();return;}this.tasks.captureDom();
  if(this.panel==='tasks'&&this.snapshot){this.tasks.render($('#modal'));hideTip();return;}
  if(this.panel==='bag'&&this.bagTab==='bag'&&this.snapshot){const selection=bagSelection(this.snapshot,this.bag.ui,this.qualityFilter,this.slotFilter,this.bag.ui.metadata);this.bag.ui.selected=selection.selected?.key??'';}
  const selected=this.snapshot?travelModel(this.travelUI,this.snapshot).selected?.region.id:undefined;
  renderPanel({...this.view(),crafting:this.crafting.ui,progression:this.progression.ui,challenges:this.challenges.ui,progressionGroup:this.progressionGroup,travel:this.travelUI,travelDrops:{preview:selected?this.travelDropCache.get(selected):undefined,loading:this.travelDropLoading===selected,error:selected===this.travelDropTarget?this.travelDropError:''}});
  if(this.panel==='appearance'){const placeholder=document.querySelector<HTMLCanvasElement>('#appearance-canvas');if(placeholder&&placeholder!==this.appearanceCanvas)placeholder.replaceWith(this.appearanceCanvas);const preview=this.appearance.ui.preview?.resolvedAppearance??this.appearance.ui.view?.resolvedAppearance;if(preview)void this.appearancePainter.setAppearance(preview);}
  refreshTips();
 }
 private refreshBag(){const active=document.activeElement as HTMLInputElement|null,action=active?.dataset?.action,id=active?.dataset?.id,filter=active?.dataset?.bagFilter,caret=active?.type==='search'?active.selectionStart:null;this.renderPanel();const target=filter?document.querySelector<HTMLElement>(`[data-bag-filter="${filter}"]`):Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).find(node=>node.dataset.action===action&&node.dataset.id===id);target?.focus({preventScroll:true});if(caret!==null&&target instanceof HTMLInputElement)target.setSelectionRange(caret,caret);}
 private refreshGearPanel(){const key=this.focusKeyOf(document.activeElement);this.renderPanel();Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).find(el=>this.focusKeyOf(el)===key)?.focus({preventScroll:true});}
 private focusCharacterChooser(){const target=document.querySelector<HTMLElement>('.character-chooser [data-action=select][aria-pressed=true],.character-chooser [data-action=select]')??document.querySelector<HTMLElement>('[data-action=character-chooser-close]');target?.focus({preventScroll:true});if(target)dismissTip(target);}
 private closeCharacterChooser(){if(this.panel!=='character')return;this.characterChooserOpen=false;invalidatePreviews();hideTip();this.renderPanel();const target=document.querySelector<HTMLElement>(`#modal [data-action=filter-slot][data-id="${this.characterPart}"]`);target?.focus({preventScroll:true});if(target)dismissTip(target);}
 private async loadTravelDrops(force=false){
  if(this.panel!=='travel'||!this.snapshot)return;
  const id=travelModel(this.travelUI,this.snapshot).selected?.region.id;
  if((id??'')!==this.travelDropTarget){this.travelDropGeneration++;this.travelDropTarget=id??'';this.travelDropLoading='';this.travelDropError='';}
  if(!id||this.travelDropLoading===id||!force&&this.travelDropCache.has(id))return;
  const generation=++this.travelDropGeneration;this.travelDropLoading=id;this.travelDropError='';this.refreshTravel(false);
  let request=this.travelDropRequests.get(id);if(!request){request=api<LootPreview>('travel/'+encodeURIComponent(id)+'/drops');this.travelDropRequests.set(id,request);}
  try{const preview=await request;if(preview.region!==id)throw new ApiFailure('PROTOCOL','掉落信息与目的地不一致，请重试。',409);if(generation===this.travelDropGeneration)this.travelDropCache.set(id,preview);}
  catch(error){if(generation===this.travelDropGeneration)this.travelDropError=error instanceof Error?error.message:'掉落信息读取失败，请重试。';}
  finally{if(this.travelDropRequests.get(id)===request)this.travelDropRequests.delete(id);if(generation===this.travelDropGeneration){this.travelDropLoading='';if(this.panel==='travel')this.refreshTravel(false);}}
 }
 private refreshTravel(loadDrops=true){
  const active=document.activeElement as HTMLInputElement,key=this.focusKeyOf(active),caret=active?.dataset?.action==='travel-search'?active.selectionStart:null;
  this.renderPanel();
  const target=Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).find(el=>this.focusKeyOf(el)===key);
  target?.focus({preventScroll:true});if(caret!==null&&target instanceof HTMLInputElement&&['text','search'].includes(target.type))target.setSelectionRange(caret,caret);
  if(loadDrops)void this.loadTravelDrops();
 }
 /** QA builds only: enter a QA field region through the normal permit path (server must opt in with AW_FIELD_QA). */
 async enterQaField(id:string){return this.travel(id);}
 /** QA builds only: walk (normal pathing, no teleport) so probes can reach map points. */
 qaGo(x:number,y:number){this.world.setMode('semi');this.world.go({x,y});}
 stateForQA(){return {prologue:this.prologue.inspect(),field:this.field.inspect(),permitId:this.permit?.id,castIntent:this.world.castIntent?{...this.world.castIntent}:null,enemyState:this.world.enemies.map(e=>({id:e.id,alive:e.alive,hp:e.hp,maxHp:e.maxHp,position:{...e.position},level:e.monster?.level,kind:e.kind,boss:e.boss})),loggedIn:this.loggedIn,processing:this.processing||this.activationPending,panel:this.panel,lastError:this.lastError,dungeon:this.dungeons.instance,dungeonDebug:this.dungeons.diagnostics,battleResult:this.result.context?{phase:this.result.phase,data:this.result.data}:null,region:this.world.region.id,bossPortal:this.world.region.bossPortal,defense:this.world.defense,hero:{...this.world.hero},mode:this.world.mode,tick:this.world.tick,enemies:this.world.enemies.filter(e=>e.alive).length,snapshot:this.snapshot,blocked:this.blocked,attachments:this.scene.attachmentDiagnostics(),appearancePreview:this.appearancePainter.diagnostics(),metrics:this.scene.metrics(),combatBodies:this.world.bodyDiagnostics()};}
}
observeUITabOrientation(document.querySelector<HTMLElement>('#modal')!);
mountStage();
const app=new GameApp();
// The canvas is always 1280×720 stage pixels; its backing store follows the stage render scale so scaled-up windows stay sharp.
// Whole 16:9 steps keep width and height exactly proportional, so the canvas CSS box stays 1280×720.
const stageBacking=(render:number)=>{const step=Math.max(1,Math.round(STAGE.width/16*render));return {width:step*16,height:step*9};};
void loadWorldFont().then(()=>{
 const backing=stageBacking(stageLayout().render);
 const game=new Phaser.Game({type:Phaser.WEBGL,parent:'game',backgroundColor:'#bdcda6',...backing,scale:{mode:Phaser.Scale.NONE,zoom:STAGE.width/backing.width},scene:[app.scene],render:{antialias:true,roundPixels:false},audio:{noAudio:true}});
 onStageChange(layout=>{if(!game.isBooted)return;const next=stageBacking(layout.render);if(next.width!==game.scale.width){game.scale.zoom=STAGE.width/next.width;game.scale.resize(next.width,next.height);}game.scale.refresh();});
});
// Read-only diagnostics, deliberately no mutation, rewards or test bypass in player entry.
Object.defineProperty(window,'awInspect',{value:()=>app.stateForQA(),writable:false});
// QA builds only: the field geometry stays out of the player bundle and is fetched on demand.
if(import.meta.env.DEV||import.meta.env.MODE==='qa'){Object.defineProperty(window,'awQaField',{value:async(id:string)=>{const field=await import('../../../packages/content/open-world/index.ts');fieldMaps=field.fieldMaps;return app.enterQaField(id);},writable:false});Object.defineProperty(window,'awQaGo',{value:(x:number,y:number)=>app.qaGo(x,y),writable:false});}

document.addEventListener('change',event=>{const select=event.target;if(!(select instanceof HTMLSelectElement)||select.id!=='reroll-affix-slot')return;const button=document.querySelector<HTMLButtonElement>('[data-action=reroll]');if(button)button.disabled=!select.value||button.dataset.reforgeAllowed!=='true';});
