import {interactionReach} from '../../../packages/rules/world-interactions.ts';
import {hudGoalLabel} from './hud-context.ts';
// 星潮海主线客户端：把服务端 starseaView 变成场景对象、任务追踪、对话和航图。进度只由服务端回执改变。
import {automaticQuestDialogues} from './automatic-quest-dialogue.ts';
import {growthCards,growthMark,trackerGoals,type GrowthMark} from './growth-cards.ts';
import type {Snapshot,Spawn,StarseaView,StarseaPoint} from '../../../packages/contracts/index.ts';
import {starseaHub,starseaIslands,isStarseaRegion,bossLevels,hardmodeBossLevels,lifeCrystalHp,tideNightKills} from '../../../packages/content/starsea/index.ts';
import {distance,type World} from '../../../packages/simulation/index.ts';
import {engineDefense} from '../../../packages/content/starsea/defense.ts';
import type {StarseaSceneObject} from './starsea-runtime-assets.ts';
import {buttonHtml,panelHeaderHtml,sealEmblem,helpHtml,esc,statusBar,statusBadgeHtml} from './ui-components.ts';
import {questHudHeader,questHudButton} from './ui/quest-tracker.ts';
import {starseaPropVerbs,starseaPropNames,starseaPropHintVerbs,starseaSpeaker} from '../../../packages/rules/starsea.ts';
import {npcs as npcRows,taskById,triggers as triggerRows,dialogueLines} from '../../../packages/content/task-tables.ts';
import {steps as stepRows} from '../../../packages/content/task-tables.ts';
import {objectivePhase,objectivePhaseCopy,type ObjectivePhase} from './objective-phase.ts';
/** 进入该距离（格）即视为近身：不画头顶箭头、追踪条不给距离。 */
const objectiveEngageRadius=6;
import type {QuestOp} from '../../../packages/rules/starsea.ts';
import type {TriggerRow} from '../../../packages/contracts/task-tables.ts';
/** 一句台词；说话人为空时按旁白显示。 */
const spoken=(l:{speaker:string;text:string})=>`<div class="story-spoken">${l.speaker?`<strong>${esc(l.speaker)}</strong>`:''}<p>${esc(l.text)}</p></div>`;
import {starseaMap} from '../../../packages/content/starsea/index.ts';
import {worldZoneAt} from '../../../packages/content/world-tables.ts';
// 到达：进新分区或靠近地标立即上报（发现分区、到达接取靠这两项）；只是换格子时仅为记录位置，限频。
// 每次写操作都会先补报一轮战斗并换新版本号，逐格上报会把战斗上报和任务/主线/营地刷新都放大。
const arriveLocationMs=15000;
/** 任务道具在场景与任务栏里的名字（只影响文字，不影响任务判定）。 */
const propNames=starseaPropNames;
const verbOverride=starseaPropHintVerbs;
const thing=(p?:StarseaPoint)=>p?.prop&&propNames[p.prop]?propNames[p.prop]:p?.label??'目标';
const verb=(p?:StarseaPoint)=>p?.prop?verbOverride[p.prop]??starseaPropVerbs[p.prop]??'调查':'调查';
/** 表里没写 hint 的交互步骤（支线、世界目标）：步骤名本身就是一句动作，如“找回渡船铃”。场景名、按 E 提示和引导都用它，不再套道具名——否则带难民也会显示成“打开封印货箱”。 */
/** 世界目标步骤（清营地、点航标、开宝箱、完成事件、通关地城等，服务端 fact≠gate）：靠在世界里完成目标推进，按 E 会被服务端拒绝；场景里只留引导与步骤名，不出按 E 提示。 */
const worldGoal=(step?:{op:string;fact?:string})=>step?.op==='interact'&&!!step.fact&&step.fact!=='gate';
const authored=(step?:{op:string;hint?:string;label:string;fact?:string})=>step?.op==='interact'&&(!step.hint||worldGoal(step))?step.label:undefined;
type SceneGoal={x:number;y:number;label:string};
type Dependencies={go?:(p:{x:number;y:number})=>void;sceneGoal?:()=>SceneGoal|undefined;sceneAction?:()=>boolean;settle:()=>Promise<unknown>;snapshot:()=>Snapshot|undefined;world:()=>World;write:(path:string,body:object)=>Promise<string|undefined>;travel:(region:string)=>Promise<boolean>;open:(panel:string)=>void;refresh:()=>void;notice:(message:string)=>void;card?:(text:string)=>void;lastError:()=>string;ensurePermit:()=>Promise<void>;service:(npc:string)=>void;panel:()=>string};
/** 港口 NPC 的服务按钮（NPC.xlsx 服务按钮 / 服务功能 / 服务面板）。 */
const serviceNpcs=new Map(npcRows.filter(n=>n.campaign==='starsea'&&n.service_panel).map(n=>[n.id,n]));
const services:Record<string,string>=Object.fromEntries([...serviceNpcs.values()].map(n=>[n.id,n.service_label??n.name]));
const interactRadius=2.8,waveRadius=4.5,phaseRadius=14;


export class StarseaController{
 /** 对话面板当前的 NPC 与台词序号。 */
 talkNpc='';line=0;busy=false;
 /** 选路失败的原因：对话框打开时战斗暂停、提示条被隐藏，必须在框内说明。 */
 private routeError='';private lastResult='';
 /** 每位 NPC 被搭话的次数，用来轮换闲聊台词。 */
 private chats=new Map<string,number>();private hudMarkup='';
 private paintHud(host:HTMLElement,markup:string){if(this.hudMarkup===markup)return;this.hudMarkup=markup;host.innerHTML=markup;}
 private ending=false;private retryAt=0;
 /** 引擎守护在本地世界里进行（不再逐帧问服务端）；服务端只在结束时抽查守护时长与击杀。 */
 private get waveStep(){return this.view?.quests.find(q=>q.id===this.deps.snapshot()?.starsea?.wave?.task)?.step;}
 get defending(){return this.waveStep?.defense===true&&this.waveStep.map===this.region;}
 private lastCompletion:string|undefined;private completionOwner:string|undefined;private growth?:{id:string;mark:GrowthMark|undefined};private promptedRoute='';private openingPrompted=false;
 // —— 演出：完成弹窗、到达接取、触发对白。只影响表现，不改进度；"已播放"按角色记在本机。 ——
 private popups:{title:string;lines:{speaker:string;text:string}[]}[]=[];private popupShown=false;
 private lastStarted='';private lastRegion='';private lastStep='';private lastHalf='';
 private seenCache?:{key:string;set:Set<string>};
 private seenKey(){return 'aw-starsea-seen:'+(this.deps.snapshot()?.id??'');}
 private seen(){const key=this.seenKey();if(this.seenCache?.key!==key){let list:string[]=[];try{list=JSON.parse(localStorage.getItem(key)??'[]');}catch{list=[];}this.seenCache={key,set:new Set(list)};}return this.seenCache.set;}
 private mark(id:string){const s=this.seen();s.add(id);try{localStorage.setItem(this.seenKey(),JSON.stringify([...s]));}catch{/* 本机存储不可用时只在本次会话内去重 */}}
 private linesOf(group:string){return dialogueLines(group,{player:this.deps.snapshot()?.name??'你',conditions:this.view?.conditions}).map(l=>({speaker:starseaSpeaker(l.speaker),text:l.text}));}
 /** 找回、开槽、登岛、升级新招式的卡片，排在任务完成对白之后。 */
 private growthStep(){const s=this.deps.snapshot();if(!s||s.starsea?.prologue?.done===false)return;if(this.growth?.id!==s.id){this.growth={id:s.id,mark:growthMark(s)};return;}const cards=growthCards(this.growth.mark,s);for(const card of cards){const text=card.title+'：'+card.lines.map(l=>l.text).join(' ');if(this.deps.card)this.deps.card(text);else this.deps.notice(text);}this.growth.mark=growthMark(s);}
 private popup(title:string,lines:{speaker:string;text:string}[]){if(!lines.length)return;this.popups.push({title,lines});if(this.popups.length===1){this.line=0;this.deps.open('starsea-talk');}}
 /** 弹窗被关闭（右上角、Esc 或切到别的面板）时丢掉当前这条，面板空闲后继续播下一条。 */
 private popupClosed(){if(!this.popups.length)return;const panel=this.deps.panel();if(this.popupShown&&panel!=='starsea-talk'){this.popupShown=false;this.popups.shift();this.line=0;}if(this.popups.length&&!panel){this.line=0;this.deps.open('starsea-talk');}}
 private fire(task:string,event:TriggerRow['event'],match:(t:TriggerRow)=>boolean=()=>true){
  for(const t of triggerRows){if(t.task!==task||t.event!==event||!match(t)||t.once&&this.seen().has('trigger:'+t.id))continue;if(t.once)this.mark('trigger:'+t.id);
   const lines=this.linesOf(t.group);if(t.mode==='popup')this.popup(taskById.get(task)?.title??'',lines);else for(const l of lines)this.deps.notice(l.speaker?l.speaker+'：'+l.text:l.text);}
 }
 /** 任务开始、到达接取地图（任务表 接取方式=arrive/none，自动接取的任务也要播接取对白）、进入地图、步骤开始、击倒过半（对话表「触发」）。 */
 private events(v:StarseaView){
  for(const quest of automaticQuestDialogues(v.quests,this.region,id=>taskById.get(id)?.accept_mode,this.seen())){this.mark('accept:'+quest.id);this.popup(quest.title,quest.accept);}
  const task=v.task,step=v.step;if(!task)return;
  if(this.lastStarted!==task.id){this.lastStarted=task.id;this.fire(task.id,'task_start');}
  if(this.lastRegion!==this.region){this.lastRegion=this.region;this.fire(task.id,'map_enter',t=>t.map===this.region);}
  const seq=step?.seq;if(!step||seq===undefined||step.map!==this.region)return;const key=task.id+':'+seq;
  if(this.lastStep!==key){this.lastStep=key;this.fire(task.id,'step_start',t=>t.step===seq);}
  if(step.op==='wave'&&step.need>=2&&step.count*2>=step.need&&step.count<step.need&&this.lastHalf!==key){this.lastHalf=key;this.fire(task.id,'wave_half',t=>t.step===seq);}
 }

 private visitKey='';private visitCell='';private visitAt=0;
 private lastTask='';private lastNight='';private lastFeatures=-1;private lastWave='';private starting='';
 constructor(private deps:Dependencies){}
 get view():StarseaView|undefined{return this.deps.snapshot()?.starseaView;}
 get active(){return Boolean(this.view);}
 get hub(){return starseaHub;}
 selectIsland(region:string){if(region===starseaHub){this.chartPick=region;this.deps.open('starsea-chart');return true;}const island=this.view?.islands.find(i=>i.map===region||i.boss===region);if(!island)return false;this.chartPick=island.map;this.deps.open('starsea-chart');this.deps.refresh();return true;}
 private get region(){return this.deps.world().region.id;}

 /** 场景里要画的 NPC、任务道具和路线牌。 */
 objects():StarseaSceneObject[]{
  const v=this.view,region=this.region;if(!v||!isStarseaRegion(region))return [];
  const out:StarseaSceneObject[]=v.markers.filter(m=>m.map===region&&m.kind!=='rumor').map(m=>({id:m.id,artId:m.prop??'ss-prop-sign',position:{x:m.x,y:m.y},name:'？',label:m.label,enabled:true})),step=v.step,here=step?.map===region;
  for(const a of v.available.filter(a=>a.map===region&&a.accept_mode==='talk'&&a.npc)){if(!out.some(o=>o.id==='npc:'+a.npc))out.push({id:'npc:'+a.npc,artId:a.npc!,npcId:a.npc,position:{x:a.x,y:a.y},name:a.label,label:'？',enabled:true});}
  if(region===starseaHub)for(const n of v.port){const target=here&&step?.op==='talk'&&step.points[0]?.npc===n.npc;out.push({id:'npc:'+n.npc,artId:n.npc,npcId:n.npc,position:{x:n.x,y:n.y},name:n.name,reach:serviceNpcs.get(n.npc)?.service_panel==='forge'?interactionReach.forge:interactionReach.story,label:target?'！任务':services[n.npc]&&this.serviceOpen(n.npc)?services[n.npc]:'',enabled:true});}
  for(const p of v.props)if(here&&!step?.points.some(q=>q.prop===p.prop&&q.x===p.x&&q.y===p.y))out.push(this.pointObject(p,false));
  for(const r of v.relics??[])if(r.map===region)out.push({id:r.id,artId:r.prop!,position:{x:r.x,y:r.y},state:r.state,name:r.label,label:r.done?'':'收取'+r.label,enabled:!r.done});
  if(here&&step?.defense===true&&this.deps.world().defense?.failed){out.push({...this.pointObject(step.points[0],true,'interact'),id:'engine-retry',state:'damaged',label:'按 E 修复',enabled:true});return out;}
  if(here&&step)for(const p of step.points){
   if(step.op==='talk'){if(region!==starseaHub)out.push({id:p.id,artId:p.npc!,npcId:p.npc,position:{x:p.x,y:p.y},name:p.label,label:'！任务',enabled:true});continue;}
   if(step.op==='wave'&&!p.prop)continue;
   if(worldGoal(step)){out.push({...this.pointObject(p,true,step.op,authored(step)),enabled:false});continue;}
   out.push(this.pointObject(p,true,step.op,authored(step)));
  }
  const phase=this.deps.snapshot()?.worldView;
  for(const row of [...(phase?.outposts??[]),...(phase?.objects??[]).filter(row=>row.kind!=='gather')])if(row.region===region)out.push({id:'world:'+row.id,artId:row.resource,position:{x:row.x,y:row.y},name:row.name,label:'',enabled:false});
  for(const row of phase?.merchants??[])if(row.region===region)out.push({id:'npc:'+row.npc,npcId:row.npc,artId:row.resource,position:{x:row.x,y:row.y},name:row.name,label:row.service,enabled:true});
  // 任务表 接取后留在原地=是 的 NPC 站位由服务端 npcPositions 给出（优先于港口站位）。
  for(const n of v.npcPositions.filter(n=>n.map===region))out.push({id:'npc:'+n.npc,npcId:n.npc,artId:n.npc,position:{x:n.x,y:n.y},name:starseaSpeaker(n.npc),label:'交谈',enabled:true});const unique=new Map<string,StarseaSceneObject>();for(const o of out){const loc=o.npcId?v.npcPositions.find(n=>n.npc===o.npcId):undefined;if(loc&&loc.map!==region)continue;const key=o.npcId?'npc:'+o.npcId:o.id,existing=unique.get(key);unique.set(key,existing&&o.label==='交谈'?{...o,id:existing.id,label:existing.label}:o);}return [...unique.values()];
 }
 private pointObject(p:StarseaPoint,live:boolean,op?:string,action?:string):StarseaSceneObject{
  if(live&&action)return {id:p.id,artId:p.prop??'ss-prop-sign',position:{x:p.x,y:p.y},state:p.prop?p.state:'default',name:action,label:'',enabled:true};
  const label=!live?'':op==='choose'?'选择此路':op==='wave'?(p.prop==='ss-prop-engine'?'守护中':'在这里战斗'):verb(p);
  return {id:p.id,artId:p.prop??'ss-prop-sign',position:{x:p.x,y:p.y},state:p.prop==='ss-prop-engine'&&op==='wave'?'running':p.prop?p.state:'default',name:op==='choose'?p.label:thing(p),label,enabled:live&&op!=='wave'};
 }
 private serviceOpen(npc:string){const n=serviceNpcs.get(npc);return Boolean(n&&(!n.service_feature||(this.view?.features??[]).includes(n.service_feature)));}
 nearest(){const p=this.deps.world().hero.position;return this.objects().filter(o=>o.enabled!==false&&distance(o.position,p)<=(o.reach??interactRadius)).sort((a,b)=>distance(a.position,p)-distance(b.position,p))[0];}

 async interact(id:string){
  const v=this.view,step=v?.step;if(!v||this.busy)return;
  if(id.startsWith('waypoint:')){await this.send({op:'waypoint',target:id.slice(9)});return;}
  if(id.startsWith('gate:')){await this.send({op:'gate',gate:id.slice(5)});return;}
  if(id.startsWith('discover:')){const row=taskById.get(id.slice(9));if(row)await this.send({op:row.accept_mode==='arrive'?'arrive':'discover',target:row.discover_landmark});return;}
  if(id.startsWith('npc:')){this.talkNpc=id.slice(4);this.line=0;const n=this.chats.get(this.talkNpc);this.chats.set(this.talkNpc,n===undefined?0:n+1);this.deps.open('starsea-talk');return;}
  if(id.startsWith('relic:')){const r=v.relics?.find(x=>x.id===id);if(await this.send({op:'relic',target:id.slice(6)})&&r)this.deps.notice(r.kind==='core'?'星核共鸣：全部伤害 [×]1.1':'生命星晶：最大生命 +'+Math.round(lifeCrystalHp*100)+'%');return;}
  if(!step||step.map!==this.region)return;
  if(id.startsWith('route:')||id==='route-fork'){(this.routeError='',this.deps.open('starsea-route'));return;}
  if(id==='engine-retry'){if(await this.send({op:'start',retry:true}))this.deps.notice('引擎修复，重新守护。');return;}
  if(id.startsWith('object:')){await this.send({op:'interact',target:id});return;}
 }
 private async send(body:{op:QuestOp;task?:string|null;gate?:string;retry?:boolean;target?:string;choice?:'a'|'b'}){
  if(this.busy)return false;this.busy=true;
  try{if(body.op==='start'||body.op==='gate'||body.op==='interact')await this.deps.ensurePermit();
   const result=await this.deps.write('quest',{task:this.view?.tracked,...body,region:this.region,position:{...this.deps.world().hero.position}});this.lastResult=result??'';if(result!=='success')return false;if(body.op==='start'||body.op==='gate'||body.op==='interact')this.syncWave();return true;}
  finally{this.busy=false;this.deps.refresh();}
 }
 /** 把服务端已追加进授权的任务波次放进本地世界。 */
 syncWave(){
  const s=this.deps.snapshot(),w=this.deps.world(),waves=[s?.starsea?.wave,s?.starsea?.night].filter(x=>x&&x.region===w.region.id);const allowed=new Set(waves.flatMap(wave=>wave!.spawns.map(m=>m.id)));w.enemies=w.enemies.filter(e=>!(/^(q:|gate:)/.test(e.id))||allowed.has(e.id));if(!waves.length)return;
  const known=new Set(w.enemies.map(e=>e.id)),missing=waves.flatMap(wave=>wave!.spawns.filter(m=>!known.has(m.id)&&!wave!.killed.includes(m.id))) as Spawn[];
  if(missing.length){w.addSpawns(missing);this.deps.notice('敌人出现：'+missing.map(m=>m.name).filter((x,i,a)=>a.indexOf(x)===i).join('、'));}
 }
 /** 每帧：靠近战斗点自动开战；检测任务推进并提示。 */
 step(){
  const v=this.view;if(!v)return;this.syncWave();
  this.popupClosed();const done=v.completion?.id??'',owner=this.deps.snapshot()?.id;if(owner!==this.completionOwner){this.completionOwner=owner;this.lastCompletion=undefined;}if(this.lastCompletion===undefined)this.lastCompletion=done;else if(done&&done!==this.lastCompletion){this.lastCompletion=done;const c=v.completion!;this.popup(c.title,c.lines?.length?c.lines:[{speaker:c.speaker,text:c.text}]);}
  this.growthStep();
  if(v.opening&&v.step?.map===this.region&&!this.openingPrompted&&!this.popups.length){this.openingPrompted=true;this.talkNpc=v.step.points[0]?.npc??'';this.line=0;this.deps.open('starsea-talk');}
  if(!this.popups.length&&v.routeFork&&distance(this.deps.world().hero.position,v.routeFork)<=2.8&&this.promptedRoute!==v.task?.id){this.promptedRoute=v.task?.id??'';(this.routeError='',this.deps.open('starsea-route'));}
  if(!this.busy&&!this.deps.world().paused&&isStarseaRegion(this.region)){const at=starseaMap(this.region).landmarks.find(l=>distance(l,this.deps.world().hero.position)<=2.8);const hero=this.deps.world().hero.position,cell=Math.floor(hero.x/8)+':'+Math.floor(hero.y/8),visit=this.region+':'+(worldZoneAt(this.region,hero)?.id??'')+':'+(at?.id??''),now=Date.now();if(visit!==this.visitKey||cell!==this.visitCell&&now-this.visitAt>=arriveLocationMs){this.visitKey=visit;this.visitCell=cell;this.visitAt=now;void this.send({op:'arrive',target:at?.id});}}
  const key=v.task?.id??'done';
  if(this.lastTask&&key!==this.lastTask){const done=this.lastTask;if(v.task)this.deps.notice('已追踪：'+v.task.title);void done;}
  this.lastTask=key;this.events(v);
  if(this.lastFeatures>=0&&v.features.length>this.lastFeatures)this.deps.notice('港口有新的居民入住，新的系统已开放');
  this.lastFeatures=v.features.length;
  // 星潮夜：服务端在击杀结算时追加入侵怪，这里把它们放进本地世界。
  const night=this.deps.snapshot()?.starsea?.night,nightKey=night&&night.region===this.region?night.region+':'+night.step:'';
  if(nightKey&&nightKey!==this.lastNight){this.deps.notice('星潮夜来了！登陆的精英必掉稀有装备');this.syncWave();}
  if(!nightKey&&this.lastNight)this.deps.notice('星潮退去：入侵已被击退');
  this.lastNight=nightKey;
  const step=v.step,w=this.deps.world();this.phase(w);if(w.paused)return;if(this.defending)this.defend(w);if(!step||step.map!==w.region.id)return;
  const waveKey=v.task!.id+':'+step.label;
  if(step.op==='wave'){
   const point=step.points[0],wave=this.deps.snapshot()?.starsea?.wave;
   if(wave&&this.lastWave!==waveKey){this.lastWave=waveKey;this.syncWave();}
   if(!wave&&point&&!this.busy&&this.starting!==waveKey&&distance(w.hero.position,point)<=waveRadius){this.starting=waveKey;void this.send({op:'start'}).then(ok=>{if(!ok)this.starting='';});}
  }
 }

 /** 原地分层：本岛有剧情战斗时，战斗点附近的野怪暂时离开这一层，打完放回原处。 */
 private phase(w:World){
  const st=this.deps.snapshot()?.starsea,wave=st?.wave,center=this.waveStep?.points[0]??wave?.spawns[0];
  if(!wave||wave.region!==w.region.id||!center||wave.killed.length>=wave.spawns.length&&!this.defending){w.phaseIn();return;}
  const keep=new Set([...wave.spawns,...(st?.night?.spawns??[])].map(m=>m.id));w.phaseOut(center,phaseRadius,e=>keep.has(e.id)||[...keep].some(id=>e.id.startsWith(id+'-')));
 }
 /** 本地引擎守护：开战即立起引擎；守满时间且袭击者全倒后先结算击杀，再请服务端确认完成。 */
 private defend(w:World){
  const wave=this.deps.snapshot()!.starsea!.wave!,p=this.waveStep!.points[0];
  // 修复重来后服务端换了一批袭击者：按新的一批重新立起引擎。
  if(w.defense&&w.defense.enemyIds.join()!==wave.spawns.map(m=>m.id).join())w.defense=null;
  if(!w.defense&&wave.killed.length<wave.spawns.length){this.syncWave();w.defense={position:{x:p.x,y:p.y},hp:wave.defense?.hp??engineDefense.hp,maxHp:wave.defense?.hp??engineDefense.hp,radius:wave.defense?.radius??engineDefense.radius,requiredTicks:wave.defense?.holdTicks??engineDefense.holdTicks,heldTicks:0,enemyIds:wave.spawns.map(m=>m.id),failed:false,complete:false};}
  // 袭击者已全倒但本地没有守护（刷新、换图后丢失）：服务端只核对击杀，直接确认完成，避免卡在「开始守护」。
  const d=w.defense,cleared=wave.killed.length>=wave.spawns.length;if(!d?.complete&&!(cleared&&(!d||!d.failed&&d.heldTicks>=d.requiredTicks))||this.ending||Date.now()<this.retryAt)return;
  this.ending=true;void this.deps.settle().then(()=>this.send({op:'defense-finish',task:wave.task})).then(ok=>{if(ok)this.deps.world().defense=null;else this.retryAt=Date.now()+2000;}).finally(()=>{this.ending=false;});
 }

 // —— 对话 ——
 private dialogue(npc:string){
  const v=this.view!,active=v.quests.find(q=>q.step.op==='talk'&&q.step.points[0]?.npc===npc&&q.step.map===this.region),step=active?.step??v.step,task=active?{...active,player:[],speaker:npc}:v.task,main=Boolean(active);
  const configured=npcRows.find(n=>n.id===npc),name=v.port.find(n=>n.npc===npc)?.name??configured?.name??step?.points.find(p=>p.npc===npc)?.label??npc,idle=v.port.find(n=>n.npc===npc)?.idle??(configured?.idle?this.linesOf(configured.idle).map(l=>l.text):[]);
  const chat=idle.length?idle[(this.chats.get(npc)??0)%idle.length]:'星潮还在涨。等你把下一座岛的事办完，我们再细谈。';
  // 接取对白只放接取与玩家回应；完成对白在服务端确认后由完成弹窗播放。找委托人时优先播进行中对白。
  const openingSeen=!!task&&this.seen().has('accept:'+task.id),progress=task&&task.speaker===npc&&(!main||openingSeen)?this.linesOf(taskById.get(task.id)?.dialog_progress??''):[];
  const fallbackKey='join-fallback:'+npc,fallback=!(v.conditions??[]).includes(configured?.join_guide_condition??'')&&this.region===starseaHub&&configured?.dialog_join_fallback&&!this.seen().has(fallbackKey)?this.linesOf(configured.dialog_join_fallback):[];if(fallback.length)this.mark(fallbackKey);
  const lines=main?(openingSeen&&progress.length?progress:[...task!.accept,...task!.player]):progress.length?progress:fallback.length?fallback:[{speaker:name,text:chat}];if(!lines.length)lines.push({speaker:name,text:chat});
  return {main,name,lines,task:active?.id,title:active?.title};
 }
 renderTalk(host:HTMLElement){
  const v=this.view;if(!v){host.innerHTML='';return;}
  const pop=this.popups[0];if(pop){this.popupShown=true;const i=Math.min(this.line,pop.lines.length-1),end=i>=pop.lines.length-1;host.classList.add('open');host.innerHTML=`<section class="panel story-dialogue" role="dialog" aria-modal="true" aria-label="${esc(pop.title)}">${panelHeaderHtml(pop.title,{emblemHtml:sealEmblem('book')})}${spoken(pop.lines[i])}${pop.lines.length>1?`<p class="ui-caption">${i+1} / ${pop.lines.length}</p>`:''}<div class="story-dialogue-actions">${end?buttonHtml('继续',{action:'starsea-complete',variant:'primary'}):buttonHtml('继续',{action:'starsea-line',variant:'primary'})+buttonHtml('跳过',{action:'starsea-complete'})}</div></section>`;return;}
  const d=this.dialogue(this.talkNpc),line=d.lines[Math.min(this.line,d.lines.length-1)],last=this.line>=d.lines.length-1;
  const offers=v.available.filter(a=>a.npc===this.talkNpc&&a.map===this.region&&a.accept_mode==='talk').map(a=>buttonHtml('接取：'+a.title,{action:'starsea-accept',id:a.task,disabled:this.busy})).join('');
  const forge=npcRows.find(n=>n.id===this.talkNpc)?.service_feature==='forge'&&this.serviceOpen(this.talkNpc);const service=(services[this.talkNpc]&&this.serviceOpen(this.talkNpc)?buttonHtml(services[this.talkNpc],{action:'starsea-service',id:this.talkNpc}):'')+(forge?buttonHtml('地城钥匙',{action:'stage-key-open',variant:'secondary'}):'');
  const actions=!last?buttonHtml('继续',{action:'starsea-line',variant:'primary'})+(v.opening?'':buttonHtml('跳过',{action:'starsea-skip'})):d.main?buttonHtml('完成对话',{action:'starsea-talk',id:d.task,variant:'primary',busy:this.busy}):buttonHtml('再见',{action:'close'});
  host.classList.add('open');
  host.innerHTML=`<section class="panel story-dialogue" role="dialog" aria-modal="true" aria-label="${esc(d.name)}的交谈">${panelHeaderHtml(d.name,{emblemHtml:sealEmblem('people')})}${d.main?`<p class="story-chapter-title">${esc(d.title)}</p>`:''}${spoken(line)}${d.lines.length>1?`<p class="ui-caption">${Math.min(this.line+1,d.lines.length)} / ${d.lines.length}</p>`:''}<div class="story-dialogue-actions">${actions}${offers}${service}</div></section>`;
 }
 // —— 航图 ——
 /** 航图选中的岛：默认追踪或阶段目标所在岛，其次当前所在岛，再次最远已解锁岛。 */
 private chartPick='';
 renderChart(host:HTMLElement){
  const v=this.view;if(!v){host.innerHTML='';return;}
  const target=v.step?.map??v.recommend?.map,open=new Map(v.islands.filter(i=>i.open).map(i=>[i.map,i])),targetIsland=v.islands.find(i=>i.map===target||i.boss===target);
  const hereIsland=v.islands.find(i=>i.map===this.region||i.boss===this.region);
  if(this.chartPick!==starseaHub&&!v.islands.some(i=>i.map===this.chartPick))this.chartPick=targetIsland?.map??(target===starseaHub?starseaHub:hereIsland?.map??[...open.values()].at(-1)?.map??starseaHub);
  const node=(id:string,label:string,state:{here?:boolean;target?:boolean;cleared?:boolean;locked?:boolean;open?:boolean})=>{
   const cls=['starsea-node',state.here?'is-here':'',state.target?'is-target':'',state.cleared?'is-cleared':'',state.locked?'is-locked':'',this.chartPick===id?'is-picked':''].filter(Boolean).join(' ');
   const need=v.islands.find(i=>i.map===id)?.requiredLevel,note=state.locked?(need?'等级 '+need+' 解锁':'尚未解锁'):state.target?(v.task?'追踪目标':'当前目标'):state.here?'你在这里':state.cleared?(v.hardmode?'裂星潮已完成':'普通已平定'):state.open?'可远航':'';
   return `<li class="starsea-route-stop">${state.locked?`<span class="${cls}" aria-label="${esc((label||'未知海域')+'，'+note)}"><span class="starsea-node-mark" aria-hidden="true">?</span></span>`:`<button type="button" class="${cls}" data-action="starsea-chart-pick" data-id="${esc(id)}" aria-pressed="${this.chartPick===id}" aria-label="${esc(label)}"><span class="starsea-node-mark" aria-hidden="true"></span></button>`}<span class="starsea-node-name">${esc(label)}</span><span class="starsea-node-note">${esc(note)}</span></li>`;
  };
  const stops=[node(starseaHub,'拾星港',{here:this.region===starseaHub,target:target===starseaHub}),...starseaIslands.map(map=>{const i=open.get(map);return i?node(map,i.name,{here:this.region===i.map||this.region===i.boss,target:i===targetIsland,cleared:v.hardmode?i.hardmodeBossCleared:i.bossCleared,open:true}):node(map,v.islands.find(i=>i.map===map)?.name??'',{locked:true});})].join('');
  let card:string;
  if(this.chartPick===starseaHub)card=`<article class="starsea-island-card"><header><h3>拾星港</h3>${statusBadgeHtml('安全港','success')}</header><p class="ui-caption">补给、锻造与回港报告都在这里。</p><div class="starsea-island-actions">${buttonHtml(this.region===starseaHub?'已在港口':'返回拾星港',{action:'starsea-sail',id:starseaHub,variant:target===starseaHub?'primary':'secondary',disabled:this.region===starseaHub})}</div></article>`;
  else if(!open.has(this.chartPick)){const i=v.islands.find(i=>i.map===this.chartPick)!;card=`<article class="starsea-island-card"><h3>${esc(i.name)}</h3><p>达到 ${i.requiredLevel} 级或击败前一岛首领后可远航。</p></article>`;}
  else{const i=open.get(this.chartPick)!,mine=v.relics.filter(r=>r.map===i.map),got=mine.filter(r=>r.done).length,here=this.region===i.map;
   const loot=i.loot?i.loot.split(/[、,，]/).filter(Boolean).map(x=>statusBadgeHtml(x.replace(/系$/,'')+'系','info')).join(''):'';
   const pips=mine.length?`<div class="starsea-island-line"><span class="ui-caption">星晶</span>${helpHtml('星晶是岛上的永久强化道具：生命星晶增加生命，星核增强伤害。每颗收取即生效，集齐可获得本岛全部加成。')}<span class="starsea-pips" aria-label="星晶 ${got}/${mine.length}">${mine.map(r=>`<span class="starsea-pip${r.done?' is-done':''}"></span>`).join('')}</span><span class="ui-caption">${got}/${mine.length}</span></div>`:'';
   const boss=`<div class="starsea-island-line"><span class="ui-caption">${v.hardmode?'裂星潮首领':'普通首领'}</span><strong>${esc(i.bossName)}</strong>${(v.hardmode?i.hardmodeBossCleared:i.bossCleared)?statusBadgeHtml('已完成','success'):i.bossOpen?statusBadgeHtml('待挑战','warning'):statusBadgeHtml('所在岛开放后可挑战','neutral')}</div>${v.hardmode?`<p class="ui-caption">普通首领：${i.bossCleared?'已平定':'未平定'}</p>`:''}`;
   card=`<article class="starsea-island-card${i===targetIsland?' is-target':''}"><header><h3>${esc(i.name)}</h3>${statusBadgeHtml('Lv '+i.levels,'neutral')}</header>${loot?`<div class="starsea-island-line"><span class="ui-caption">多掉</span>${loot}</div>`:''}${pips}${boss}<div class="starsea-island-actions">${buttonHtml(here?'已在岛上':'出航',{action:'starsea-sail',id:i.map,variant:target===i.map||!i.bossOpen?'primary':'secondary',disabled:here})}${i.bossOpen?buttonHtml(((v.hardmode?i.hardmodeBossCleared:i.bossCleared)?'再战首领':'挑战首领'),{action:'starsea-sail',id:i.boss,variant:target===i.boss?'primary':'secondary',disabled:this.region===i.boss}):''}</div></article>`;}
  host.classList.add('open');
  host.innerHTML=`<section class="panel story-dialogue starsea-chart" role="dialog" aria-modal="true" aria-label="星潮海航图">${panelHeaderHtml('星潮海航图',{emblemHtml:sealEmblem('compass'),actionsHtml:buttonHtml('海域难度',{action:'panel',id:'sea-difficulty',variant:'secondary',size:'compact'})})}<ol class="starsea-route" aria-label="航线">${stops}</ol>${card}<p class="ui-caption starsea-chart-hint">${v.hardmode?`裂星潮 ${v.tideProgress?.completed??'—'}/${v.tideProgress?.total??'—'} · 怪物更强，掉落更好`:'达到航图标注的等级，或击败前一岛首领，即可远航。'}</p></section>`;
 }
 async handle(action:string,id:string){
  if(action==='starsea-accept'){if(await this.send({op:'accept',task:id})){const q=this.view?.quests.find(q=>q.id===id),lines=q?.accept??[];if(q?.step.op==='talk')await this.send({op:'talk',task:id,target:q.step.points[0]?.id});this.deps.open('');if(lines.length){this.mark('accept:'+id);this.popup(q!.title,lines);}}return;}
  if(action==='starsea-retry'){await this.send({op:'start',retry:true});return;}
  if(action==='starsea-complete'){this.popups.shift();this.popupShown=false;this.line=0;if(this.popups.length)this.deps.refresh();else this.deps.open('');return;}
  if(action==='starsea-route-pick'){this.routeError='';if(await this.send({op:'start',choice:id as 'a'|'b'})){this.deps.open('');return;}
   this.routeError=this.lastResult==='pending'?'连接中断，选择还没有保存。请恢复连接后再选。':this.lastResult==='busy'?'上一步操作还在处理，请稍后再选。':this.deps.lastError()||'没有选成功，请再试一次。';this.deps.refresh();return;}
  if(action==='starsea-line'){this.line++;this.deps.refresh();return;}
  if(action==='starsea-skip'){this.line=99;this.deps.refresh();return;}
  if(action==='starsea-talk'){const npc=this.talkNpc;if(await this.send({op:'talk',task:id||undefined,target:'npc:'+npc})){if(this.popups.length){this.line=0;this.deps.refresh();}else this.deps.open('');}return;}
  if(action==='starsea-service'){this.deps.service(id);return;}
  if(action==='starsea-chart-pick'){this.chartPick=id;this.deps.refresh();return;}
  if(action==='starsea-sail'){this.deps.open('');await this.deps.travel(id);return;}
  if(action==='starsea-group'){this.toggleGroup(id);return;}
  if(action==='starsea-relic-goto'){const r=this.nearestRelic();if(r)this.go({x:r.x,y:r.y});return;}
  if(action==='starsea-goto'){if(this.deps.sceneAction?.())return;const destination=this.waveStep?.map??this.view?.step?.map??this.view?.recommend?.map;const island=this.view?.islands.find(i=>i.boss===destination);if(destination&&destination!==this.region&&island?.map!==this.region&&this.selectIsland(destination))return;const goal=!this.waveStep&&!this.view?.step?this.view?.recommend:undefined;if(goal?.action&&this.region===starseaHub){this.deps.open(goal.action==='dungeons'?'dungeons':'sea-difficulty');return;}const p=this.guide()??this.target();if(p)this.go({x:p.x,y:p.y});return;}
 }
/** 任务栏“下一步”：一句短话，路线交给场景里的光点和箭头。 */
 private nextAction(step:NonNullable<StarseaView['step']>,here:boolean){
  const p=step.points[0];
  // 跨岛只写“出航 · 前往X”（方案 §2.4），到岛后再给具体做什么。
  const voyage=(island:string,name:string)=>objectivePhaseCopy('voyage',{name:'',island,islandName:name,currentIsland:this.region,distance:0,engageRadius:0,fighting:false,defeated:false}).line;
  if(step.op==='boss'){if(here)return step.label;const island=this.view?.islands.find(i=>i.boss===step.map);if(island&&island.map!==this.region)return voyage(island.map,island.name);return '到首领门挑战'+step.label.replace(/^击败/,'');}
  if(!here)return voyage(step.map,step.map===starseaHub?'拾星港':step.mapName);
  return this.doText(step,p);
 }
 /** 一句话写清「去哪、做什么、做几次」。 */
 private doText(step:NonNullable<StarseaView['step']>,p?:StarseaPoint){
  if(step.defense){const d=this.defending?this.deps.world().defense:null;
   if(!d)return step.need&&step.count>=step.need?'袭击者已全部打倒，正在确认…':`走到${thing(p)}旁，开始守护`;
   if(d.failed)return d.downed?`你倒下了，守护失败：在${thing(p)}旁按 E 重新开始`:`${thing(p)}被打坏了：走到它旁边按 E 修复，重新开始`;
   return `别让${thing(p)}被打坏，打倒 ${step.need} 个袭击者（${step.count}/${step.need}）`;}
  return step.hint??step.label;
 }
 /** 当前步骤在本地图上的目标点。 */
 renderRoute(host:HTMLElement){const v=this.view;if(!v?.routes)return;host.classList.add('open');host.innerHTML=`<section class="panel story-dialogue starsea-chart" role="dialog" aria-modal="true" aria-label="选择突击路线">${panelHeaderHtml('两条进港路',{emblemHtml:sealEmblem('compass')})}<p>选择后本章路线锁定，回港会记录你的选择。</p>${this.routeError?`<p class="ui-warning" role="alert">${esc(this.routeError)}</p>${this.lastResult==='pending'?buttonHtml('恢复连接',{action:'recover',variant:'secondary',size:'compact'}):''}`:''}<div class="starsea-chart-list">${v.routes.map(r=>`<section class="starsea-chart-row"><div><h3>${esc(r.name)}</h3><p>敌人：${esc(r.enemies.join('、'))}</p><p>${esc(r.risk)}</p></div>${buttonHtml('选择'+r.name,{action:'starsea-route-pick',id:r.id,variant:'primary',busy:this.busy})}</section>`).join('')}</div></section>`;}
 /** 场景引路目标：本图任务点；不在任务地图时指向首领门、码头或回港飞艇。 */
 private go(p:{x:number;y:number}){if(this.deps.go)this.deps.go(p);else this.deps.world().go(p);}
 private sceneGuide(){const w=this.deps.world(),boss=w.region.boss?w.enemies.find(e=>e.alive&&e.boss):undefined;if(boss){const p=this.phaseOf(boss.position,boss.name??'首领',Boolean(boss.engaged)||boss.hp<boss.maxHp,'defeat');return {...boss.position,label:p.line,arrow:p.arrow,distance:p.distance};}return this.deps.sceneGoal?.();}
 private phaseKey='';private phaseState?:ObjectivePhase;
 /** 同岛目标阶段（docs/hud-arbitration-plan.md §2.4）：前往→近身/交战；回滞避免文案闪。 */
 private phaseOf(at:{x:number;y:number},name:string,fighting=false,verb:'defeat'|'reach'='reach'){
  const w=this.deps.world(),key=w.region.id+':'+name;if(key!==this.phaseKey){this.phaseKey=key;this.phaseState=undefined;}
  const input={name,island:w.region.id,islandName:'',currentIsland:w.region.id,distance:distance(at,w.hero.position),engageRadius:objectiveEngageRadius,fighting,defeated:false,verb};
  this.phaseState=objectivePhase(input,this.phaseState);return objectivePhaseCopy(this.phaseState,input);
 }
 /** 世界引路：跨岛不给目标（只在追踪条写出航）；近身后不画箭头；距离数字只给追踪条。 */
 guide(){const g:{x:number;y:number;label:string;arrow?:boolean;distance?:number}|undefined=this.rawGuide();if(!g||g.arrow!==undefined)return g;const p=this.phaseOf(g,g.label);return {...g,arrow:p.arrow,distance:p.distance};}
 private rawGuide(){
  const scene=this.sceneGuide();if(scene)return scene;
  const v=this.view,step=this.waveStep??v?.step,r=this.deps.world().region;if(!v||!isStarseaRegion(r.id))return undefined;
  // 港口/HUB 模式：不返回任务驱动目标，避免把任务箭头保留在拾星港场景
  if(r.id===starseaHub)return undefined;
  if(!step){const near=v.recommend;if(!near)return;return near.map===r.id&&near.point?{...near.point,label:near.label}:undefined;}
  if(step.map===r.id){const p=step===this.waveStep?step.points[0]:this.target();if(!p)return undefined;const d=step.defense&&this.defending?this.deps.world().defense:null;
   if(d&&!d.failed&&d.heldTicks>=d.requiredTicks){const w=this.deps.world(),foe=w.enemies.filter(e=>e.alive&&d.enemyIds.includes(e.id)).sort((a,b)=>distance(a.position,w.hero.position)-distance(b.position,w.hero.position))[0];if(foe)return {x:Math.round(foe.position.x),y:Math.round(foe.position.y),label:'袭击者'};}
   const label=step.op==='choose'?'分岔口 · 选路':step.op==='talk'?p.label:step.op==='wave'?(step.defense?thing(p):'战斗区域'):step.op==='boss'?step.label:authored(step)??verb(p)+thing(p);return {x:p.x,y:p.y,label};}
  const island=v.islands.find(i=>i.boss===step.map);
  if(island?.map===r.id&&r.bossPortal)return {x:r.bossPortal.x,y:r.bossPortal.y,label:'首领门 · 按 E'};
  return undefined;
 }
 /** 靠近可交互目标时，在目标头顶冒出的按键气泡；优先级与 E 键实际行为一致。 */
 prompt(){
  const v=this.view,w=this.deps.world(),r=w.region;if(!v||!isStarseaRegion(r.id))return undefined;
  const o=this.nearest();
  if(o){const text=o.id.startsWith('npc:')?'和'+(o.name??'居民')+'对话':o.id.startsWith('relic:')?'收取'+(o.name??''):o.id.startsWith('route')?'选择路线':o.id==='engine-retry'?'修复引擎，重新开始':(o.label||'调查')+(o.name??'');return {x:o.position.x,y:o.position.y,text,objectId:o.id};}
  const near=(p:{x:number;y:number}|null|undefined)=>p&&distance(w.hero.position,p)<4;
  if(r.id===starseaHub){if(near(r.portal))return {x:r.portal.x,y:r.portal.y,text:'打开航图'};const forge=r.landmarks.find(l=>l.kind==='forge'&&near(l));if(forge)return {x:forge.x,y:forge.y,text:'打开工坊'};return undefined;}
  if(near(r.bossPortal)){const island=v.islands.find(i=>i.map===r.id);return {x:r.bossPortal!.x,y:r.bossPortal!.y,text:island?.bossOpen?'进入首领战':'首领门（未开启）'};}
  if(near(r.portal))return {x:r.portal.x,y:r.portal.y,text:'回拾星港'};
  return undefined;
 }
 target():StarseaPoint|undefined{const v=this.view,step=v?.step;if(!step){const r=v?.recommend;return r?.map===this.region&&r.point?{...r.point,id:'recommend',label:r.label,done:false}:undefined;}if(step.map!==this.region)return undefined;return step.op==='choose'?v?.routeFork??step.points[0]:step.points[0];}
 /** 不在任务地图时，任务栏直接给出“去那里”的按钮。首领战不直传：先到所在岛，再寻路到首领门按 E 进入。 */
 private travelButton(step:NonNullable<StarseaView['step']>){
  if(step.map===starseaHub)return questHudButton('返回拾星港',{action:'starsea-sail',id:starseaHub});
  const island=this.view?.islands.find(i=>i.boss===step.map);
  if(island)return this.region===island.map?questHudButton('前往首领门',{action:'starsea-goto'}):questHudButton('出航到'+island.name,{action:'starsea-sail',id:island.map});
  return questHudButton('出航到'+step.mapName,{action:'starsea-sail',id:step.map});
 }
 /** 任务追踪按「主线 / 支线」分组，组可折叠（记在本机）；组内本地图任务排前。 */
 private collapsed=new Set<string>((()=>{try{return JSON.parse(localStorage.getItem('aw-starsea-groups')??'[]') as string[];}catch{return [];}})());
 private toggleGroup(id:string){if(this.collapsed.has(id))this.collapsed.delete(id);else this.collapsed.add(id);localStorage.setItem('aw-starsea-groups',JSON.stringify([...this.collapsed]));this.hudMarkup='';this.deps.refresh();}
 private group(id:string,label:string,cards:{html:string;here:boolean}[]){
  if(!cards.length)return '';const open=!this.collapsed.has(id);
  return `<section class="starsea-group" data-group="${id}"><button type="button" class="starsea-group-head" data-action="starsea-group" data-id="${id}" aria-expanded="${open}"><span>${open?'▾':'▸'} ${label}</span><span>${cards.length}</span></button>${open?[...cards].sort((a,b)=>Number(b.here)-Number(a.here)).map(c=>`<article class="starsea-card${c.here?' is-here':''}">${c.html}</article>`).join(''):''}</section>`;
 }
 /** 支线（可选）：本岛星潮来袭；各岛未收取的星晶。 */
 private sideCards(){
  const v=this.view,st=this.deps.snapshot()?.starsea,region=this.region,out:{html:string;here:boolean}[]=[];if(!v)return out;
  if(st&&starseaIslands.includes(region)){
   const night=st.night?.region===region?st.night:undefined,tide=st.tide?.[region]??0;
   out.push({here:true,html:night?`<h3>精英来袭</h3><p>击败全部精英，每只必掉稀有装备</p>${statusBar('neutral',night.killed.length/night.spawns.length,`${night.killed.length} / ${night.spawns.length}`)}`
    :`<h3>星潮来袭</h3><p>击败岛上的怪物，攒满后精英来袭</p>${statusBar('neutral',tide/tideNightKills,`${tide} / ${tideNightKills}`)}`});
  }
  for(const map of [...new Set((v.relics??[]).map(r=>r.map))]){
   const all=(v.relics??[]).filter(r=>r.map===map),left=all.filter(r=>!r.done).length;if(!left)continue;
   const here=map===region,name=v.islands.find(i=>i.map===map)?.name??map;
   out.push({here,html:`<h3>星晶收集${here?'':' · '+esc(name)}</h3><p>${here?`本岛还有 ${left} 颗，靠近按 E 收取`:`去${esc(name)}收取`}</p>${statusBar('neutral',(all.length-left)/all.length,`${all.length-left} / ${all.length}`)}${here?`<div class="story-hud-actions">${questHudButton('前往最近星晶',{action:'starsea-relic-goto'})}</div>`:''}`});
  }
  return out;
 }
 private nearestRelic(){const w=this.deps.world(),p=w.hero.position;return (this.view?.relics??[]).filter(r=>r.map===w.region.id&&!r.done).sort((a,b)=>distance(a,p)-distance(b,p))[0];}
 /** 首领战狂暴计时卡：只在首领图且首领存活时显示。 */
 private bossCard(){
  const w=this.deps.world(),rule=w.rules.encounterBalance.starseaBossEnrage,boss=w.enemies.find(e=>e.boss&&e.alive);
  if(!rule||!w.region.id.startsWith(rule.regionPrefix)||!boss)return [];
  const name=this.view?.islands.find(i=>i.boss===w.region.id)?.bossName??'首领',c=w.bossClock,limit=rule.seconds*30,clock=(t:number)=>{const s=Math.max(0,Math.ceil(t/30));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  const body=c?.enraged?`<p class="starsea-hud-level is-low">首领狂暴，快躲开</p>`
   :c?statusBar('hp',1-(w.tick-c.started)/c.limit,`狂暴倒计时 ${clock(c.limit-(w.tick-c.started))}`)
   :`<p>靠近后开始计时<br>限时 ${clock(limit)}</p>`;
  return [{here:true,html:`<h3>${esc(name)}</h3>${body}`}];
 }
 /** 无任务步骤时的推荐目标：不在目标岛写“出航”，已在目标岛就别再写“前往X岛”，改写首领门的前往/到达。 */
 private recommendLine(rec:StarseaView['recommend']){
  if(!rec)return '';const island=rec.kind==='stage'&&rec.map!==starseaHub?this.view?.islands.find(i=>i.map===rec.map):undefined;
  if(!island)return rec.label;
  if(island.map!==this.region&&island.boss!==this.region)return objectivePhaseCopy('voyage',{name:'',island:island.map,islandName:island.name,currentIsland:this.region,distance:0,engageRadius:0,fighting:false,defeated:false}).line;
  return rec.point?this.phaseOf(rec.point,'首领门').line:rec.label;
 }
 renderHud(loggedIn:boolean){
  let hud=document.getElementById('starsea-hud');if(!hud){hud=document.createElement('aside');hud.id='starsea-hud';hud.setAttribute('aria-label','星潮海任务');document.body.append(hud);}const v=this.view;hud.hidden=!loggedIn||!v;document.body.dataset.starseaActive=String(!hud.hidden);if(!v||hud.hidden)return;
  const scene=this.sceneGuide(),step=this.waveStep??v.step,dist=this.guide()?.distance,distanceLabel=dist?`<em class="quest-track-distance num">${dist} 格</em>`:'';const label=scene?.label??(step?this.nextAction(step,step.map===this.region):this.recommendLine(v.recommend));this.paintHud(hud,(label?`<div class="quest-track-line"><small>${scene?'当前场景':v.task?'任务':v.recommend?.kind==='stage'?'当前目标':'附近'}</small><span title="${esc(label)}">${esc(hudGoalLabel(label))}</span>${distanceLabel}${questHudButton('→',{action:'starsea-goto'})}</div>`:'')+this.goalLines(scene));
 }
 /** 任务行下面最多两行养成目标（钉选装备 / 换代 / 找回），与 #tracker 同源；场景演出时不出（docs/progression-goal-plan.md §3）。 */
 private goalLines(scene:unknown){const s=this.deps.snapshot();if(scene||!s)return '';return trackerGoals(s).slice(0,2).map(g=>`<div class="quest-track-line is-goal"><small>${esc(g.kind)}</small><span title="${esc(g.goal)}"><b>${esc(g.title)}</b><em>${esc(g.goal)}</em></span>${questHudButton('→',{action:g.action,id:g.id})}</div>`).join('');}
}
