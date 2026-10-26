/**
 * 棋盘回合制前端控制器：遇敌 → 载入 → 等待 → 预览/确认 → 结算 → 敌方行动 → 托管/接管 → 断线恢复 → 胜利返场。
 * 只消费 TacticalSource（当前只有隔离 fixture）。界面不判定合法性、不计时切托管、不计算伤害或奖励：
 * 所有结果来自投影、预览与已提交事件；按钮禁用只是把投影里的「已用/不可用」显示出来。
 * HUD 版本（2026-10-25）：棋盘为主体，状态贴在单位上，顶栏+底栏轻量布局。
 */
import {buttonHtml,confirmationHtml,esc,iconHtml,meterHtml,statusBadgeHtml} from '../ui-components.ts';
import {TacticalSourceError,sameCell} from './contract.ts';
import type {TacticalCell,TacticalCommand,TacticalControlCommand,TacticalEncounterHandle,TacticalEncounterView,TacticalEvent,
 TacticalPush,TacticalSource,TacticalUnitView} from './contract.ts';
import {EventLedger,countdownState,syncClock} from './countdown.ts';
import type {ClockSync,CountdownState} from './countdown.ts';
import {canCommand,commandFromPreview,initialSelection,reduceSelection} from './selection.ts';
import type {SelectionAction,SelectionState} from './selection.ts';
import {pixelSkin,pixelTile} from './pixel-skin.ts';
import {GROUND_ART,boardCellsHtml,boardOverlay,boardSvg,fitCell} from './board-view.ts';
import {TacticalActors} from './actors.ts';
import {tacticalEncounterHtml,tacticalResultHtml} from './presentation.ts';
import {fitSceneBoard} from './board-layout.ts';
import {seaBackdropHtml,tacticalSceneHtml} from './scene-art.ts';
import {unitLabelsHtml} from './unit-labels.ts';
import {unitPortraitHtml,hydrateUnitPortraits} from './unit-portrait.ts';
import {componentArtHtml} from '../ui/component-art.ts';
import {hydratePetPortraits} from '../hub/pet-portrait.ts';
import {compactStatusHtml,compactStatusDetailHtml,isCompactHudDetail} from './compact-status.ts';
import type {CompactHudDetail} from './compact-status.ts';
import {hudAbilitySlotsHtml,hudAbilityShortcut,hudAbilityInfoHtml,hudAbilityContext,hudActorId,idleMoveSelection,shouldPreviewIdleMove} from './hud.ts';
import {ModalFocusLayer} from './focus-layer.ts';
import {RegionRenderer} from './region-render.ts';

type Screen='encounter'|'loading'|'error'|'empty'|'board'|'returning'|'returned';
type LogRow={id:string;text:string;tone:'hero'|'enemy'|'pet'|'system'};
type Connection='online'|'offline'|'syncing';
type HudDetail=CompactHudDetail|`ability:${string}`;
export type ControllerOptions={reducedMotion?:boolean;encounterName?:string;
 /** Static review only: select a source-provided ability without issuing a command. */
 reviewAbilityId?:string};

let commandSerial=0;
export const newCommandId=(prefix='cmd')=>`${prefix}-${Date.now().toString(36)}-${(++commandSerial).toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export class TacticalBoardController{
 private screen:Screen='encounter';private error:TacticalSourceError|null=null;
 private handle:TacticalEncounterHandle|null=null;private view:TacticalEncounterView|null=null;
 private sel:SelectionState=initialSelection({x:0,y:0});private connection:Connection='online';
 private sync:ClockSync={offsetMs:0};private ledger=new EventLedger();private log:LogRow[]=[];
 private notice:{text:string;tone:'info'|'warning'|'success'|'danger';until:number}|null=null;
 private petFeedback:{text:string;tone:'success'|'neutral'}|null=null;
 private pendingControl:TacticalControlCommand|null=null;private endConfirm=false;private returnMessage='';private returnCommand:string|null=null;
 private countdown:CountdownState={visible:false,remainingMs:null};private cell=74;private rowHeight=74;private sceneMarkup='';
 private unsub:(()=>void)|null=null;private ticker:ReturnType<typeof setInterval>;private reconnectTimer:ReturnType<typeof setTimeout>|null=null;
 private timers=new Set<ReturnType<typeof setTimeout>>();private dead=false;private reduced:boolean;
 private actors:TacticalActors;private regions:Record<string,HTMLElement>={};
 private intent:{commandId:string;nodeName:string;groupId:string}|null=null;
 private logOpen=false;
 private hudDetail:HudDetail|null=null;private detailPinned=false;
 private readonly regionRenderer=new RegionRenderer();private focusLayer:ModalFocusLayer;
 private suppressDetailFocus=false;
 private detailHovered=false;
 private detailCloseTimer:ReturnType<typeof setTimeout>|null=null;

 constructor(private readonly root:HTMLElement,private readonly source:TacticalSource,private readonly options:ControllerOptions={}){
  this.reduced=options.reducedMotion??matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML=`<div class="tb-root tb-scene-mode" data-screen="encounter" data-motion-reduced="${this.reduced}">
${pixelSkin?'':seaBackdropHtml()}
<header class="tb-hud-top" data-region="top" aria-label="战场信息"></header>
<main class="tb-main">
 <div class="tb-board-frame"><div class="tb-board" data-region="board" style="--ground:url('${pixelSkin?pixelTile(48):GROUND_ART}')">
  <div class="tb-scene-ground" data-region="ground" aria-hidden="true"></div>
  <div class="tb-grid" data-region="grid" role="grid" aria-label="战场棋盘"></div>
  <div class="tb-svg" data-region="svg"></div>
  <div class="tb-units" data-region="units"></div>
  <div class="tb-fx" data-region="fx" aria-hidden="true"></div>
  <div class="tb-tags" data-region="tags" aria-label="单位状态"></div>
 </div></div>
</main>
<footer class="tb-hud-bottom" data-region="bottom" aria-label="行动指令"></footer>
<div class="tb-layer" data-region="overlay"></div>
</div>`;
  for(const el of root.querySelectorAll<HTMLElement>('[data-region]'))this.regions[el.dataset.region!]=el;
  this.focusLayer=new ModalFocusLayer(root);
  this.actors=new TacticalActors(this.regions.units,this.regions.fx);this.actors.setReducedMotion(this.reduced);
  root.addEventListener('click',this.onClick);root.addEventListener('pointerover',this.onHover);root.addEventListener('pointerleave',this.onLeave,true);
  root.addEventListener('pointerout',this.onDetailOut);root.addEventListener('focusin',this.onDetailFocus);root.addEventListener('focusout',this.onDetailOut);
  document.addEventListener('keydown',this.onKey);
  this.ticker=setInterval(()=>this.tick(),250);
  this.render();
 }
 destroy(){
  this.dead=true;clearInterval(this.ticker);if(this.reconnectTimer)clearTimeout(this.reconnectTimer);for(const t of this.timers)clearTimeout(t);
  this.unsub?.();this.actors.destroy();this.focusLayer.destroy();document.removeEventListener('keydown',this.onKey);
  this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('pointerover',this.onHover);this.root.removeEventListener('pointerleave',this.onLeave,true);
  this.root.removeEventListener('pointerout',this.onDetailOut);this.root.removeEventListener('focusin',this.onDetailFocus);this.root.removeEventListener('focusout',this.onDetailOut);
  if(this.detailCloseTimer)clearTimeout(this.detailCloseTimer);
  this.root.replaceChildren();
 }
 setReducedMotion(value:boolean){this.reduced=value;this.actors.setReducedMotion(value);(this.root.firstElementChild as HTMLElement).dataset.motionReduced=String(value);}
 private later(fn:()=>void,ms:number){if(ms<=0||this.reduced){fn();return;}const t=setTimeout(()=>{this.timers.delete(t);if(!this.dead)fn();},ms);this.timers.add(t);}

 // ── 生命周期 ───────────────────────────────────────────────
 async start(intent={commandId:newCommandId('engage'),nodeName:this.options.encounterName??'样例遭遇',groupId:'fx-group'}){
  this.intent=intent;this.screen='encounter';this.error=null;this.view=null;this.log=[];this.petFeedback=null;this.hudDetail=null;this.detailPinned=false;this.render();
  const shownAt=performance.now();
  try{this.handle=await this.source.engage(intent);}
  catch(error){this.fail(error);return;}
  if(this.dead)return;this.render();
  const minimum=this.reduced?200:1100,wait=minimum-(performance.now()-shownAt);
  if(wait>0)await new Promise(r=>setTimeout(r,wait));
  if(this.dead)return;
  await this.loadEncounter(true);
 }
 private async loadEncounter(first:boolean){
  if(!this.handle)return;
  if(first){this.screen='loading';this.render();}
  try{
   const view=await this.source.load(this.handle.encounterId);if(this.dead)return;
   this.subscribe();this.screen=view.result&&this.screen==='returned'?'returned':'board';
   if(first){this.sel=initialSelection(view.units.find(u=>u.side==='hero')?.cell??{x:0,y:0});this.addLog({id:'sys:start',text:this.handle.alreadyActive?'已恢复进行中的战场。':'战场已展开。',tone:'system'});}
   this.applyView(view,true);
   if(first&&this.options.reviewAbilityId){this.dispatch({type:'choose-ability',abilityId:this.options.reviewAbilityId});}
   if(first&&!view.result)this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);
  }catch(error){if(first)this.fail(error);else this.lostConnection();}
 }
 private subscribe(){this.unsub?.();if(this.handle)this.unsub=this.source.subscribe(this.handle.encounterId,push=>this.onPush(push));}
 private fail(error:unknown){
  const e=error instanceof TacticalSourceError?error:new TacticalSourceError('load-failed','暂时没能载入战场');
  this.error=e;this.screen=e.code==='empty'?'empty':'error';this.render();this.focus(this.findFocus('state-primary')?'state-primary':'state-panel');
 }

 // ── 投影与事件 ─────────────────────────────────────────────
 private onPush(push:TacticalPush){if(this.dead)return;const fresh=this.ledger.accept(push.events);this.play(fresh);this.applyView(push.view);}
 private applyView(view:TacticalEncounterView,force=false){
  if(!force&&this.view&&view.encounterId===this.view.encounterId&&view.revision<this.view.revision)return;
  const prev=this.view;this.view=view;this.sync=syncClock(view.control.serverNowMs,Date.now());
  this.sel=reduceSelection(this.sel,{type:'view',view},view);
  if(this.endConfirm&&!canCommand(view,this.sel))this.endConfirm=false;
  if(prev&&prev.phase!=='ended'&&view.phase==='ended')this.later(()=>this.focus('result-return'),0);
  if(prev?.control.mode==='auto'&&view.control.mode==='manual'&&view.phase==='awaiting')this.later(()=>this.focus('hud-detail-move'),0);
  this.render();
 }
 private unitName(id:string){return this.view?.units.find(u=>u.id===id)?.name??(id==='pet'?this.view?.pet?.name??'宠物':id);}
 private addLog(row:LogRow){if(this.log.some(r=>r.id===row.id))return;this.log.push(row);if(this.log.length>40)this.log.shift();}
 private flash(text:string,tone:'info'|'warning'|'success'|'danger'='info',ms=2600){this.notice={text,tone,until:Date.now()+ms};this.later(()=>this.renderOverlay(),ms+30);}
 /** 只播放事件：先行走，再出手、受击与飘字；同一批次内按顺序排开。 */
 private play(events:TacticalEvent[]){
  let t=0;const hero=this.view?.units.find(u=>u.side==='hero')?.id??'hero';
  for(const e of events){
   const side=(id:string)=>id===hero?'hero':'enemy';
   switch(e.kind){
    case 'move':{
     const dur=this.actors.walk(e.unitId,e.path,220);
     this.addLog({id:e.id,text:`${this.unitName(e.unitId)} 移动 ${e.path.length-1} 步`,tone:side(e.unitId)});t+=dur;break;
    }
    case 'ability':{
     const at=t;this.later(()=>this.actors.act(e.unitId,'attack',e.target),at);t+=260;
     this.addLog({id:e.id,text:`${this.unitName(e.unitId)} 使用 ${e.label}`,tone:side(e.unitId)});break;
    }
    case 'damage':{
     const at=t,taken=e.amount-e.absorbed;
     this.later(()=>{this.actors.act(e.unitId,'hurt');this.actors.float(e.unitId,`-${taken}`,e.unitId===hero?'damage-taken':'damage-dealt');
      if(e.absorbed)this.actors.float(e.unitId,`护盾 -${e.absorbed}`,'shield');},at);
     this.addLog({id:e.id,text:`${this.unitName(e.unitId)} 受到 ${taken} 点伤害${e.absorbed?`（护盾吸收 ${e.absorbed}）`:''}`,tone:side(e.sourceId)});break;
    }
    case 'shield':{const at=t+120;this.later(()=>this.actors.float(e.unitId,`护盾 +${e.added}`,'shield'),at);break;}
    case 'defeated':this.addLog({id:e.id,text:`${this.unitName(e.unitId)} 倒下`,tone:side(e.unitId)==='hero'?'enemy':'hero'});break;
    case 'pet-assist':{
     const at=t+80;this.later(()=>this.actors.pulsePet(),at);
     this.petFeedback={text:`刚刚：${e.label}，${e.effect}`,tone:'success'};
     this.addLog({id:e.id,text:`${this.view?.pet?.name??'宠物'} 条件辅助：${e.label}，${e.effect}`,tone:'pet'});break;
    }
    case 'pet-skipped':
     this.petFeedback={text:`未触发：${e.reason}`,tone:'neutral'};
     this.addLog({id:e.id,text:`${this.view?.pet?.name??'宠物'} 未辅助：${e.reason}`,tone:'pet'});break;
    case 'turn':
     this.addLog({id:e.id,text:`第${e.round}回合 · ${e.phase==='hero'?'我方行动':'敌方行动'}`,tone:'system'});
     if(e.phase==='enemy')this.flash('敌方行动','warning',1400);
     break;
    case 'end-activation':this.addLog({id:e.id,text:`${this.unitName(e.unitId)} 结束行动`,tone:side(e.unitId)});break;
    case 'control':{
     const text={'timeout-auto':'等待超时，已转为托管','auto-applied':'已开启托管','manual-requested':'当前动作结束后接管',
      'manual-applied':'已接管，轮到你操作','manual-cancelled':'已取消接管请求','ended':'战斗结束'}[e.change];
     this.addLog({id:e.id,text,tone:'system'});
     if(e.change!=='ended')this.flash(text,e.change==='timeout-auto'?'warning':e.change==='manual-applied'?'success':'info');
     break;
    }
    case 'note':this.addLog({id:e.id,text:e.text,tone:e.unitId?side(e.unitId):'system'});break;
    case 'result':this.addLog({id:e.id,text:{victory:'战斗胜利',defeat:'战斗结束',retreat:'已撤退','system-abort':'战斗中止'}[e.outcome],tone:'system'});break;
   }
  }
 }

 // ── 指令（重试时复用同一 commandId） ─────────────────────────
 private dispatch(action:SelectionAction){
  if(this.connection!=='online'&&(action.type==='choose-move'||action.type==='choose-ability'))return;
  const before=this.sel;this.sel=reduceSelection(this.sel,action,this.view);if(before!==this.sel)this.render();
 }
 private async requestPreview(){
  const view=this.view,s=this.sel;if(this.connection!=='online'||!view||!s.target||!s.previewPending)return;
  const serial=s.previewSerial,request=s.command==='move'?{kind:'move' as const,to:s.target}:{kind:'ability' as const,abilityId:s.abilityId!,target:s.target};
  try{const preview=await this.source.preview(view.encounterId,request);this.dispatch({type:'preview-result',serial,preview});}
  catch(error){this.dispatch({type:'preview-failed',serial,message:this.errorText(error)});if(this.isNetwork(error))this.lostConnection();}
 }
 private confirm(){
  const view=this.view;if(this.connection!=='online'||!view||!canCommand(view,this.sel))return;
  const command=commandFromPreview(view,this.sel,newCommandId());if(!command)return;
  void this.submit(command);
 }
 private endActivation(force:boolean){
  const view=this.view;if(this.connection!=='online'||!view||!canCommand(view,this.sel)||!view.actionToken)return;
  if(!force&&(!view.budget.moveUsed||!view.budget.mainActionUsed)){this.endConfirm=true;this.render();return;}
  this.endConfirm=false;
  void this.submit({commandId:newCommandId(),encounterId:view.encounterId,expectedRevision:view.revision,actionToken:view.actionToken,kind:'end-activation'});
 }
 private retreat(){
  const view=this.view;if(this.connection!=='online'||!view||!canCommand(view,this.sel)||!view.actionToken)return;
  this.dispatch({type:'retreat-cancel'});
  void this.submit({commandId:newCommandId(),encounterId:view.encounterId,expectedRevision:view.revision,actionToken:view.actionToken,kind:'retreat'});
 }
 private async submit(command:TacticalCommand){
  this.dispatch({type:'submit-start',command});
  try{
   const receipt=await this.source.submit(command);if(this.dead)return;
   this.play(this.ledger.accept(receipt.events));
   if(!receipt.accepted){this.dispatch({type:'submit-failed',message:receipt.denial?.message??'无法执行这个行动。',keep:false});return;}
   this.dispatch({type:'submit-done'});
  }catch(error){
   if(this.dead)return;
   if(this.isNetwork(error)){this.dispatch({type:'submit-failed',message:'连接中断，恢复后会自动重发同一指令。',keep:true});this.lostConnection();return;}
   const e=error as TacticalSourceError;
   this.dispatch({type:'submit-failed',message:this.errorText(e),keep:false});
   if(e.code==='stale-revision')void this.resync();
  }
 }
 private async sendControl(op:'request-auto'|'request-manual'){
  const view=this.view;if(this.connection!=='online'||!view||this.pendingControl||!(op==='request-auto'?view.control.canRequestAuto:view.control.canRequestManual))return;
  const command={commandId:newCommandId('ctl'),encounterId:view.encounterId,op};
  this.pendingControl=command;this.render();await this.flushControl();
 }
 private async flushControl(){
  const command=this.pendingControl;if(!command)return;
  try{const receipt=await this.source.control(command);if(this.dead)return;this.pendingControl=null;this.play(this.ledger.accept(receipt.events));this.render();}
  catch(error){
   if(this.isNetwork(error)){this.lostConnection();return;}
   this.pendingControl=null;this.flash(this.errorText(error),'danger');this.render();
  }
 }
 private async returnToExplore(){
  const view=this.view;if(!view?.result)return;
  this.returnCommand??=newCommandId('return');this.screen='returning';this.render();
  try{const r=await this.source.returnToExplore(view.encounterId,this.returnCommand);if(this.dead)return;this.returnMessage=r.message;this.screen='returned';this.unsub?.();this.unsub=null;}
  catch(error){this.screen='board';this.flash(this.errorText(error),'danger');if(this.isNetwork(error))this.lostConnection();}
  this.render();
 }

 // ── 连接 ───────────────────────────────────────────────────
 private isNetwork(error:unknown){return error instanceof TacticalSourceError&&error.code==='network';}
 private errorText(error:unknown){return error instanceof TacticalSourceError?error.message:'暂时没能完成操作。';}
 /** 推送通道断开（fixture 由工具条模拟）。倒计时按上次的服务端截止时刻继续显示，不重置。 */
 lostConnection(){
  if(this.dead||this.screen==='returned')return;
  if(this.connection!=='offline'){this.connection='offline';this.render();}
  if(!this.reconnectTimer)this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;void this.reconnect();},1500);
 }
 private async reconnect(){
  if(this.dead||!this.handle)return;
  try{
   this.connection='syncing';this.render();
   const view=await this.source.load(this.handle.encounterId);if(this.dead)return;
   this.subscribe();this.connection='online';this.applyView(view,true);
   this.addLog({id:`sys:resync:${view.revision}`,text:'连接已恢复，战场已同步。',tone:'system'});
   if(this.sel.submitting)void this.submit(this.sel.submitting);
   if(this.pendingControl)void this.flushControl();
   this.render();
  }catch(error){this.connection='offline';this.render();if(this.isNetwork(error)||(error instanceof TacticalSourceError&&error.retryable))this.lostConnection();}
 }
 private async resync(){
  if(!this.handle)return;
  try{const view=await this.source.load(this.handle.encounterId);this.applyView(view,true);}catch(error){if(this.isNetwork(error))this.lostConnection();}
 }
 private tick(){
  if(!this.view||this.screen!=='board')return;
  const next=countdownState(this.view,this.sync,Date.now());
  const changed=next.visible!==this.countdown.visible||(next.visible&&this.countdown.visible&&(next.seconds!==this.countdown.seconds||next.expired!==this.countdown.expired));
  this.countdown=next;
  if(changed)this.renderOverlay();
  if(this.notice&&Date.now()>this.notice.until){this.notice=null;this.renderOverlay();}
 }

 // ── 输入 ───────────────────────────────────────────────────
 private cellOf(el:Element|null):TacticalCell|null{const b=el?.closest<HTMLElement>('[data-action=cell]');return b?{x:Number(b.dataset.x),y:Number(b.dataset.y)}:null;}
 private onHover=(event:Event)=>{
  this.onDetailFocus(event);
  const cell=this.cellOf(event.target as Element);if(!cell||sameCell(cell,this.sel.hover))return;
  this.sel={...this.sel,hover:cell};if((this.sel.command==='move'||this.sel.command==='none')&&!this.sel.target)this.renderBoard();
 };
 private setHudDetail(kind:HudDetail|null,pinned=false){
  if(this.detailCloseTimer){clearTimeout(this.detailCloseTimer);this.detailCloseTimer=null;}
  if(kind===null)this.detailHovered=false;
  if(this.hudDetail===kind&&this.detailPinned===pinned)return;
  this.hudDetail=kind;this.detailPinned=pinned;this.renderOverlay();
  this.root.querySelectorAll<HTMLElement>('[data-action="hud-detail"],[data-action="ability-info"]').forEach(el=>{
   const open=el.dataset.action==='hud-detail'?el.dataset.detail===kind:!!kind&&kind===`ability:${el.dataset.id}`;el.setAttribute('aria-expanded',String(open));
   if(open){el.setAttribute('aria-describedby','tb-hud-detail');el.setAttribute('aria-controls','tb-hud-detail');}
   else{el.removeAttribute('aria-describedby');el.removeAttribute('aria-controls');}
  });
 }
 private detailFocusKey(kind:HudDetail){return kind.startsWith('ability:')?`cmd-ability-${kind.slice(8)}`:`hud-detail-${kind}`;}
 private abilityInfo(id:string){
  if(!this.view?.abilities.some(a=>a.id===id))return;
  this.logOpen=false;this.sel=reduceSelection(this.sel,{type:'inspect',unitId:null},this.view);
  this.setHudDetail(`ability:${id}`,true);this.renderTop();this.renderBottom();this.focus('hud-detail-panel');
 }
 private onDetailFocus=(event:Event)=>{
  if(event.type==='focusin'&&this.suppressDetailFocus){this.suppressDetailFocus=false;return;}
  const target=event.target as Element,entry=target.closest<HTMLElement>('[data-action="hud-detail"]');
  if(event.type==='pointerover'&&(entry||target.closest('.tb-hud-detail')))this.detailHovered=true;
  if(target.closest('.tb-hud-detail')&&this.detailCloseTimer){clearTimeout(this.detailCloseTimer);this.detailCloseTimer=null;}
  if(!this.detailPinned&&entry&&isCompactHudDetail(entry.dataset.detail))this.setHudDetail(entry.dataset.detail);
 };
 private onDetailOut=(event:Event)=>{
  if(!(event.target as Element).closest('[data-action="hud-detail"],.tb-hud-detail'))return;
  const next=(event as MouseEvent|FocusEvent).relatedTarget;
  if(next instanceof Element&&next.closest('[data-action="hud-detail"],.tb-hud-detail'))return;
  if(event.type==='pointerout')this.detailHovered=false;
  if(this.detailPinned||!this.hudDetail)return;
  if(this.detailCloseTimer)clearTimeout(this.detailCloseTimer);
  this.detailCloseTimer=setTimeout(()=>{
   this.detailCloseTimer=null;
   const focused=document.activeElement instanceof Element&&document.activeElement.closest('[data-action="hud-detail"],.tb-hud-detail');
   if(!this.dead&&!this.detailPinned&&!this.detailHovered&&!focused)this.setHudDetail(null);
  },120);
 };
 private onLeave=(event:Event)=>{if((event.target as Element)?.classList?.contains('tb-board')){this.sel={...this.sel,hover:null};this.renderBoard();}};
 private pick(cell:TacticalCell){
  if(this.connection!=='online')return;
  if(this.view&&shouldPreviewIdleMove(this.view,this.sel,cell,this.connection==='online'))this.dispatch({type:'choose-move'});
  const s=this.sel;
  if(s.command!=='none'&&sameCell(s.target,cell)&&s.preview?.ok){this.confirm();return;}
  this.dispatch({type:'pick-cell',cell});
  if(this.sel.previewPending)void this.requestPreview();
 }
 private onClick=(event:MouseEvent)=>{
  if(!this.focusLayer.allowsTarget(event.target))return;
  const el=(event.target as Element).closest<HTMLElement>('[data-action]');if(!el||!this.root.contains(el)||(el as HTMLButtonElement).disabled)return;
  const id=el.dataset.id;
  if(el.dataset.action!=='hud-detail'&&el.dataset.action!=='hud-detail-close')this.setHudDetail(null);
  switch(el.dataset.action){
   case 'hud-detail':if(isCompactHudDetail(el.dataset.detail)){if(this.detailPinned&&this.hudDetail===el.dataset.detail)this.setHudDetail(null);else this.setHudDetail(el.dataset.detail,true);}break;
   case 'hud-detail-close':{const previous=this.hudDetail;this.setHudDetail(null);this.renderBottom();if(previous){this.suppressDetailFocus=true;this.focus(this.detailFocusKey(previous));}break;}
   case 'ability-info':if(id)this.abilityInfo(id);break;
   case 'cell':this.pick({x:Number(el.dataset.x),y:Number(el.dataset.y)});break;
   case 'move':this.dispatch({type:'choose-move'});break;
   case 'ability':if(id)this.dispatch({type:'choose-ability',abilityId:id});break;
   case 'confirm':this.confirm();break;
   case 'cancel':this.dispatch({type:'cancel'});break;
   case 'end':this.endActivation(false);break;
   case 'end-confirm':this.endActivation(true);break;
   case 'end-cancel':this.endConfirm=false;this.render();this.focus('cmd-end');break;
   case 'auto':void this.sendControl('request-auto');break;
   case 'manual':void this.sendControl('request-manual');break;
   case 'retreat':this.dispatch({type:'retreat-ask'});break;
   case 'retreat-confirm':this.retreat();break;
   case 'retreat-cancel':this.dispatch({type:'retreat-cancel'});this.focus('cmd-retreat');break;
   case 'inspect-close':this.dispatch({type:'inspect',unitId:null});this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);break;
   case 'inspect':this.logOpen=false;this.dispatch({type:'inspect',unitId:id??null});this.focus('inspect-panel');break;
   case 'return':void this.returnToExplore();break;
   case 'retry':void this.start(this.intent??undefined);break;
   case 'toggle-log':this.logOpen=!this.logOpen;this.sel=reduceSelection(this.sel,{type:'inspect',unitId:null},this.view);this.render();this.focus(this.logOpen?'log-panel':'cmd-log');break;
   case 'restart':
    if(this.view?.source==='sandbox'){
     (window as any).__sandboxRestart?.();
    }else{
     this.returnCommand=null;this.ledger=new EventLedger();void this.start();
    }
    break;
  }
 };
 private modalKind():'result'|'settling'|'retreat'|'end'|null{
  if(!this.view||(this.screen!=='board'&&this.screen!=='returning'))return null;
  if(this.view.result)return 'result';
  if(this.view.phase==='settling')return 'settling';
  if(this.sel.confirmRetreat)return 'retreat';
  return this.endConfirm?'end':null;
 }
 private findFocus(key:string,scope:ParentNode=this.root):HTMLElement|null{
  return [...scope.querySelectorAll<HTMLElement>('[data-focus]')].find(el=>el.dataset.focus===key)??null;
 }
 private onKey=(event:KeyboardEvent)=>{
  if(this.dead)return;
  const target=event.target as HTMLElement;
  if(target&&target!==document.body&&!this.root.contains(target))return;
  if(this.focusLayer.handleKey(event))return;
  if(this.screen!=='board'||!this.view||event.ctrlKey||event.metaKey||event.altKey)return;
  const modal=this.modalKind();
  if(event.key==='Escape'){
   if(modal==='end'){this.endConfirm=false;this.render();}
   else if(modal==='retreat'){this.dispatch({type:'retreat-cancel'});}
   else if(modal){/* A committed result/settlement cannot be cancelled. */}
   else if(this.hudDetail){const previous=this.hudDetail;this.setHudDetail(null);this.renderBottom();if(target.closest('.tb-hud-detail')){this.suppressDetailFocus=true;this.focus(this.detailFocusKey(previous));}}
   else if(this.logOpen){this.logOpen=false;this.render();this.focus('cmd-log');}
   else if(this.sel.inspectId){this.dispatch({type:'inspect',unitId:null});this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);}
   else this.dispatch({type:'cancel'});
   event.preventDefault();return;
  }
  if(modal||!this.focusLayer.allowsTarget(target)||target.closest('input,textarea,select,[contenteditable="true"],.tb-hud-detail,.tb-hud-inspect,.tb-hud-log-drawer'))return;
  const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[event.key]){
   const skills=target.closest('.tb-hud-skills');
   if(skills){
    const buttons=[...skills.querySelectorAll<HTMLButtonElement>('button[data-focus]')].filter(el=>!el.disabled);
    const index=buttons.indexOf(target.closest('button') as HTMLButtonElement);
    if(event.key==='ArrowUp')this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);
    else if(event.key==='ArrowDown')this.focus(this.sel.target?'confirm':'cmd-end');
    else if(buttons.length)buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length].focus();
    event.preventDefault();return;
   }
   // Arrows inside a HUD control must not silently move the board cursor.
   if(target!==document.body&&!target.closest('[data-action="cell"]'))return;
   const [dx,dy]=directions[event.key],c=this.sel.cursor,next={x:Math.max(0,Math.min(this.view.board.width-1,c.x+dx)),y:Math.max(0,Math.min(this.view.board.height-1,c.y+dy))};
   this.sel={...this.sel,cursor:next,hover:next};this.renderBoard();this.focus(`cell-${next.x}-${next.y}`);event.preventDefault();return;
  }
  if(event.repeat)return;
  const key=event.key.toLowerCase();
  if(key==='m'){this.dispatch({type:'choose-move'});this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);event.preventDefault();}
  else if(key==='b'||/^[1-4]$/.test(key)){
   const ability=hudAbilityShortcut(this.view,key);
   if(ability){
    if(canCommand(this.view,this.sel)&&this.connection==='online'&&!this.view.budget.mainActionUsed&&ability.available&&ability.migration==='supported'){
     this.dispatch({type:'choose-ability',abilityId:ability.id});this.focus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`);
    }else this.abilityInfo(ability.id);
   }
   event.preventDefault();
  }
  else if(key==='e'){this.endActivation(false);event.preventDefault();}
  else if(key==='a'){void this.sendControl(this.view.control.mode==='manual'?'request-auto':'request-manual');event.preventDefault();}
 };
 private focus(key:string){requestAnimationFrame(()=>{const el=this.findFocus(key);if(el&&!el.closest('[inert]')&&this.focusLayer.allowsTarget(el))el.focus({preventScroll:true});});}
 private writeRegion(name:string,html:string){
  return this.regionRenderer.render(this.regions[name],html,el=>this.focusLayer.allowsTarget(el));
 }

 // ── 渲染 ───────────────────────────────────────────────────
 private render(){
  if(this.dead)return;
  const active=document.activeElement as HTMLElement|null,focusKey=active&&this.root.contains(active)?active.dataset.focus:undefined;
  (this.root.firstElementChild as HTMLElement).dataset.screen=this.screen;
  if(this.view&&(this.screen==='board'||this.screen==='returning')){
   this.renderTop();this.renderBoard();this.renderBoardTags();this.renderBottom();
  }
  this.renderOverlay();
  if(focusKey){const el=this.findFocus(focusKey);if(el&&el!==document.activeElement&&!el.closest('[inert]')&&this.focusLayer.allowsTarget(el))el.focus({preventScroll:true});}
 }
 private hero(){return this.view?.units.find(u=>u.side==='hero')??null;}
 /** 顶部 HUD 条 */
 private renderTop(){
  const v=this.view!,actorId=hudActorId(v);
  const title=`<div class="tb-battle-title ui-card">${componentArtHtml('panel')}${iconHtml('compass',{size:24})}<strong>${esc(v.node.name)}</strong></div>`;
  const objective=`<div class="tb-battle-objective ui-card">${componentArtHtml('panel')}${iconHtml('swords',{size:20})}<span>${esc(v.source==='sandbox'?v.node.objective.replace('（战棋沙盒 · 不发奖）','').trim():v.node.objective)}</span></div>`;
  // The present source publishes round/intent order, not speed-gauge progress.
  const enemies=v.units.filter(u=>u.alive&&u.side==='enemy');
  const hasOrder=!v.unsupported.includes('行动顺序')&&enemies.every(u=>v.intents.some(i=>i.unitId===u.id));
  const units=v.units.filter(u=>u.alive).slice().sort((a,b)=>a.side==='hero'?-1:b.side==='hero'?1:
   hasOrder?(v.intents.find(i=>i.unitId===a.id)?.order??0)-(v.intents.find(i=>i.unitId===b.id)?.order??0):0);
  const rows=units.map(u=>{
   const isNow=u.id===actorId;
   const name=esc(u.name);
   return `<li><button type="button" class="tb-turn${u.side==='hero'?' is-ally':''}${isNow?' is-now':''}" data-action="inspect" data-id="${esc(u.id)}" data-focus="face-${esc(u.id)}" aria-label="${name}，生命 ${u.hp.current}/${u.hp.max}${isNow?'，当前行动者':''}" title="${name}${isNow?' · 当前行动者':''}"><span class="tb-face">${unitPortraitHtml(u)}</span></button></li>`;
  }).join('');
  const left=`${title}${objective}<div class="tb-hud-order ui-card">${componentArtHtml('panel')}<span class="tb-order-label">${hasOrder?'行动顺序':'战场单位'}<small>${v.round===null?'备战':`第 ${v.round} 回合`}</small></span><ol class="tb-hud-turns" data-scroll-key="turn-order" aria-label="${hasOrder?'已公开行动顺序':'战场单位'}">${rows}</ol><span class="tb-order-current">${actorId?`当前：${esc(this.unitName(actorId))}`:v.phase==='enemy'?'敌方行动':v.phase==='resolving'?'正在结算':'等待行动'}</span></div>`;
  // 右侧：状态芯片
  let chips='';
  // 连接芯片（只在非在线时显示）
  if(this.connection!=='online'){
   chips+=this.connection==='syncing'
    ?`<span class="tb-hud-chip tb-hud-chip--warning">${iconHtml('refresh',{size:16})}正在同步</span>`
    :`<span class="tb-hud-chip tb-hud-chip--danger">${iconHtml('alert',{size:16})}连接中断</span>`;
  }
  // 数据源芯片
  // 样例数据只在预览工具条标注，不进战斗 HUD
  // Source and no-reward notices remain in the review toolbar, not in the combat HUD.
  const ctl=v.control,auto=ctl.mode==='auto';
  const controlDisabled=!(auto?ctl.canRequestManual:ctl.canRequestAuto)||!!this.pendingControl||this.connection!=='online';
  chips+=buttonHtml(auto?(ctl.pendingManual?'接管中…':'托管中'):'托管',{action:auto?'manual':'auto',variant:'secondary',size:'compact',iconHtml:iconHtml('auto'),disabled:controlDisabled,attributes:{'data-focus':auto?'cmd-manual':'cmd-auto','aria-pressed':auto,title:auto?'点击请求接管（A）':'开启托管（A）'}});
  const canCmd=canCommand(v,this.sel)&&this.connection==='online';
  chips+=buttonHtml('撤离',{action:'retreat',variant:'secondary',size:'compact',disabled:!canCmd,attributes:{'data-focus':'cmd-retreat'}});
  chips+=buttonHtml('记录',{action:'toggle-log',variant:'secondary',size:'compact',iconHtml:iconHtml('book'),attributes:{'aria-expanded':this.logOpen,'data-focus':'cmd-log'}});
  const right=`<div class="tb-hud-chips">${chips}</div>`;
  if(this.writeRegion('top',left+right))hydrateUnitPortraits(this.regions.top);
 }

 /** 棋盘 */
 private renderBoard(){
  const v=this.view;if(!v)return;
  const frame=this.regions.board.parentElement!,w=frame.clientWidth||1000,h=frame.clientHeight||352;
  const layout=pixelSkin?(()=>{const cell=fitCell(v,w,h);return {cell,rowHeight:cell,width:v.board.width*cell,height:v.board.height*cell};})():fitSceneBoard(v,w,h);
  const {cell,rowHeight}=layout;this.cell=cell;this.rowHeight=rowHeight;
  const o=boardOverlay(v,idleMoveSelection(v,this.sel,this.connection==='online'));
  this.regions.board.style.cssText=`--ground:url('${pixelSkin?pixelTile(48):GROUND_ART}');--cell:${cell}px;--row:${rowHeight}px;width:${layout.width}px;height:${layout.height}px`;
  this.regions.board.dataset.command=this.sel.command;
  const ground=pixelSkin?'':tacticalSceneHtml(v,cell,rowHeight);
  if(ground!==this.sceneMarkup){this.sceneMarkup=ground;this.regions.ground.innerHTML=ground;}
  this.regions.grid.style.gridTemplateColumns=`repeat(${v.board.width},${cell}px)`;
  this.writeRegion('grid',boardCellsHtml({...v,actorId:hudActorId(v)},this.sel,o,cell));
  this.writeRegion('svg',boardSvg(v,o,cell,rowHeight));
  this.actors.sync(v.units,v.pet,cell,hudActorId(v),rowHeight);

 }

 /** 棋盘标签层：意图、预览伤害、护盾 */
 private renderBoardTags(){
  const v=this.view;
  this.writeRegion('tags',v?unitLabelsHtml({...v,actorId:hudActorId(v)},this.sel,{cell:this.cell,rowHeight:this.rowHeight,width:v.board.width*this.cell,height:v.board.height*this.rowHeight}):'');
 }

 /** 底部 HUD 条 */
 private renderBottom(){
  const v=this.view!,s=this.sel,can=canCommand(v,s)&&this.connection==='online',b=v.budget;
  const phaseLabel=this.connection!=='online'?'同步中':v.phase==='enemy'?'敌方行动':v.phase==='resolving'?'正在行动':v.control.mode==='auto'?'托管中':b.ended?'等待行动':'你的行动';
  const blocked=this.connection!=='online'||!!s.submitting;
  const status=`<div class="tb-hud-status-strip ui-card">${componentArtHtml('panel')}<span class="tb-hud-phase">${iconHtml('swords')}<b>${phaseLabel}</b></span>${compactStatusHtml(v,{activeDetail:isCompactHudDetail(this.hudDetail)?this.hudDetail:null,detailId:'tb-hud-detail',blocked})}</div>`;
  const center=`<div class="tb-hud-skills ui-card" aria-label="普攻与四个技能">${componentArtHtml('panel')}${hudAbilitySlotsHtml(v,s,can,this.hudDetail?.startsWith('ability:')?this.hudDetail.slice(8):null)}</div>`;

  // ── 右侧：状态文字 + 按钮 ──
  const DENIAL_CODE:Record<string,string>={unreachable:'无法到达',blocked:'路径受阻',occupied:'目标格被占用',corner:'斜向拐角',
   'out-of-budget':'移动额度已用','out-of-range':'超出射程',sight:'视线受阻','invalid-target':'无效目标',
   used:'本回合已出手',unsupported:'尚未迁移','not-your-turn':'尚未轮到你'};
  let caption='';
  const auto=v.control.mode==='auto';
  const pending=!!s.submitting;
  if(this.connection!=='online'){caption=this.connection==='syncing'?'正在同步战场…':'连接中断，正在恢复战场。';}
  else if(s.message){caption=esc(s.message);}
  else if(s.preview&&!s.preview.ok&&s.target){const denial=s.preview.denial;caption=esc(denial.message||DENIAL_CODE[denial.code]||"无法执行这个行动");}
  else if(v.phase==='enemy'){const id=hudActorId(v),a=id?this.unitName(id):null;caption=esc(a?`敌方行动 · ${a}正在行动`:'敌方行动');}
  else if(v.phase==='resolving'||pending){caption='行动已提交，正在结算。';}
  else if(auto){caption=v.control.pendingManual?'接管中…':'托管中';}
  else if(s.command==='move'&&!s.target){caption='选择亮出的格子';}
  else if(s.command==='ability'&&!s.target){caption='选择目标';}
  else if(s.command!=='none'&&s.target&&s.preview?.ok){caption='再次点选目标或确认行动';}
  else if(can){caption=b.mainActionUsed?(b.moveUsed?'可结束行动':'还可移动，或结束行动'):b.moveUsed?'选择普攻或技能':'点选亮格移动，或选择技能';}

  const targetSelected=s.command!=='none'&&s.target!==null;
  const previewOk=s.preview?.ok===true&&!s.previewPending;
  const endPrimary=!auto&&!targetSelected&&!this.endConfirm&&!s.confirmRetreat&&!v.result;
  let buttons='';
  if(targetSelected){
   buttons=buttonHtml('取消',{action:'cancel',variant:'secondary',disabled:pending,attributes:{'data-focus':'cancel'}});
   buttons+=buttonHtml('确认行动',{action:'confirm',variant:this.modalKind()?'secondary':'primary',disabled:!!this.modalKind()||!can||!previewOk||pending,busy:pending,busyLabel:'正在提交…',attributes:{'data-focus':'confirm'}});
  }else{
   const endLabel=auto?'托管中':'结束行动';
   buttons=`${buttonHtml(endLabel,{action:'end',variant:endPrimary?'primary':'secondary',disabled:!can||auto,attributes:{'data-focus':'cmd-end',title:'结束行动（E）'}})}`;
  }
  const context=hudAbilityContext(v,s);
  const info=context&&s.abilityId?buttonHtml('详情',{action:'ability-info',variant:'secondary',size:'compact',attributes:{'data-id':s.abilityId,'data-focus':'skill-context-info'}}):'';
  const hint=caption||context?`<div class="tb-hud-hint"><div class="tb-hud-caption" role="status">${context?`<strong>${esc(context)}</strong>`:''}${caption?`<span>${caption}</span>`:''}</div>${info}</div>`:'';
  const right=`<div class="tb-hud-right">${hint}<div class="tb-hud-btns">${buttons}</div></div>`;
  if(this.writeRegion('bottom',`<div class="tb-hud-dock"><div class="tb-hud-player">${status}${center}</div>${right}</div>`))hydratePetPortraits(this.regions.bottom);

 }

 /** 单位详情卡（浮动 inspect 用）*/
 private unitCard(u:TacticalUnitView){
  return `<div class="tb-compact-detail-content"><h3 class="tb-card-title">${iconHtml(u.side==='hero'?'people':'skull',{size:24})}${esc(u.name)} ${statusBadgeHtml(u.side==='hero'?'我方':'敌方',u.side==='hero'?'info':'danger',{variant:'inline'})}</h3>
<div class="tb-compact-detail-scroll" tabindex="0" data-focus="inspect-scroll" data-scroll-key="unit:${esc(u.id)}" aria-label="单位详情内容">${meterHtml({value:u.hp.current,max:u.hp.max,label:'生命',tone:'hp',valueText:'end'})}
${u.shield?`<p class="tb-line">护盾 <b>${u.shield}</b></p>`:''}
<p class="tb-line"><span class="tb-dim">位置</span> 第${u.cell.x+1}列第${u.cell.y+1}行</p>
${u.statuses.length?`<p class="tb-statuses">${u.statuses.map(st=>statusBadgeHtml(st.label,'neutral',{variant:'inline'})).join('')}</p>`:''}
${u.side==='enemy'?this.intentCardHtml(u.id):''}</div></div>`;
 }
 private intentCardHtml(unitId:string):string{
  const intents=(this.view?.intents??[]).filter(i=>i.unitId===unitId);
  if(!intents.length)return this.view?.unsupported.includes('敌方意图')?'<p class="tb-note">敌方意图：尚未接入</p>':'';
  return intents.map(i=>{
   if(i.hidden)return `<p class="tb-line tb-intent-row"><span class="tb-intent-badge">❢${i.order}</span>?（意图未明）</p>`;
   const dmg=i.damage?(i.damage.kind==='amount'?`${i.damage.value}`:`${{'light':'轻','heavy':'重','lethal':'致命'}[i.damage.tier]}`):null;
   const fizzle=i.fizzled?'<span class="tb-dim"> · 落空</span>':'';
   const typeLabel={'grid':'格子型','chase':'追击型','lock':'锁定型','buff':'增益','summon':'召唤','charge-windup':'蓄力','move-only':'仅移动'}[i.type]??i.type;
   return `<p class="tb-line tb-intent-row"><span class="tb-intent-badge">❢${i.order}</span>${esc(typeLabel)}${dmg?` · <b>${dmg}</b>`:''}${fizzle}</p>`;
  }).join('');
 }

 /** 覆盖层：弹窗、倒计时、通知、结果、inspect 卡 */
 private renderOverlay(){
  const parts:string[]=[],v=this.view;
  if(this.screen==='encounter'){
   const node=this.handle?.node;
   parts.push(tacticalEncounterHtml(node?.enemyGroup??'未知敌群',node?.name??this.intent?.nodeName??''));
  }else if(this.screen==='loading')parts.push(`<div class="tb-cover">${this.stateBlock('loading','正在展开战场…','正在读取战场布置与单位。')}</div>`);
  else if(this.screen==='error'){
   const e=this.error;
   parts.push(`<div class="tb-cover">${this.stateBlock('error',e?.code==='version-mismatch'?'战场版本不一致':'暂时没能载入战场',e?.message??'',
    e?.retryable===false?undefined:'重试','retry')}${e?.retryable===false?'<p class="tb-note">fixture 不提供返回港口路由；正式版此处返回拾星港。</p>':''}</div>`);
  }else if(this.screen==='empty')parts.push(`<div class="tb-cover">${this.stateBlock('empty','没有可进入的遭遇',this.error?.message??'')}</div>`);
  else if(this.screen==='returned')parts.push(`<div class="tb-cover">${this.stateBlock('success','已返回探索',this.returnMessage,
   this.view?.source==='fixture'?'再来一场（fixture）':this.view?.source==='sandbox'?'再来一局':undefined,
   this.view?.source==='fixture'||this.view?.source==='sandbox'?'restart':undefined)}</div>`);
  if(v&&(this.screen==='board'||this.screen==='returning')){
   const modal=this.modalKind();
   if(this.hudDetail&&!modal){
    const abilityId=this.hudDetail.startsWith('ability:')?this.hudDetail.slice(8):null;
    const detail=abilityId?hudAbilityInfoHtml(v,abilityId,canCommand(v,this.sel)&&this.connection==='online')
     :isCompactHudDetail(this.hudDetail)?compactStatusDetailHtml(v,this.hudDetail,{blocked:this.connection!=='online'||!!this.sel.submitting,feedback:this.hudDetail==='pet'?this.petFeedback?.text:undefined}):'';
    if(detail)parts.push(`<section class="tb-hud-detail ui-card" id="tb-hud-detail" data-focus="hud-detail-panel" tabindex="-1" role="${this.detailPinned?'region':'tooltip'}" aria-label="${abilityId?'技能详情':'状态详情'}">${componentArtHtml('panel')}${detail}${this.detailPinned?buttonHtml('关闭',{action:'hud-detail-close',variant:'secondary',size:'compact',attributes:{'data-focus':'hud-detail-close'}}):''}</section>`);
   }
   if(this.sel.inspectId&&!modal){
    const unit=v.units.find(x=>x.id===this.sel.inspectId);
    if(unit)parts.push(`<div class="tb-hud-inspect tb-card" role="complementary" data-focus="inspect-panel" tabindex="-1" aria-label="查看单位">${this.unitCard(unit)}<div class="tb-actions">${buttonHtml('关闭',{action:'inspect-close',variant:'secondary',size:'compact',attributes:{'data-focus':'inspect-close'}})}</div></div>`);
   }
   if(this.countdown.visible){
    const c=this.countdown,pct=Math.max(0,Math.min(100,c.remainingMs/Math.max(1,v.control.warningMs)*100));
    parts.push(`<div class="tb-countdown${c.expired?' is-expired':''}" role="timer" aria-live="${c.seconds<=3?'assertive':'polite'}" aria-label="${esc(c.label)}">${iconHtml('hourglass',{size:20})}<span>${esc(c.label)}</span><i style="width:${pct}%"></i></div>`);
   }
   if(this.notice)parts.push(`<div class="tb-notice tb-notice--${this.notice.tone}" role="status">${esc(this.notice.text)}</div>`);
   if(modal==='end')parts.push(confirmationHtml({title:'结束行动',description:'还有可用行动，可继续操作或结束。',confirmLabel:'结束行动',confirmAction:'end-confirm',cancelAction:'end-cancel',cancelLabel:'继续操作'}).replace('aria-modal="true"','aria-modal="true" data-focus-layer="end"').replace('data-action="end-confirm"','data-action="end-confirm" data-focus="end-confirm"'));
   else if(modal==='retreat')parts.push(confirmationHtml({title:'撤退',description:'确认离开这场战斗？本场尚未完成的目标将结束。',confirmLabel:'确认撤退',confirmAction:'retreat-confirm',cancelAction:'retreat-cancel',danger:true}).replace('aria-modal="true"','aria-modal="true" data-focus-layer="retreat"').replace('data-action="retreat-confirm"','data-action="retreat-confirm" data-focus="retreat-confirm"'));
   else if(modal==='result'&&v.result)parts.push(tacticalResultHtml(v.result,this.screen==='returning').replace('aria-modal="true"','aria-modal="true" data-focus-layer="result"'));
   else if(modal==='settling')parts.push(`<div class="tb-cover tb-cover--soft" role="dialog" aria-modal="true" data-focus-layer="settling" aria-label="战斗结算">${this.stateBlock('loading','正在确认战斗结果…','等待结算回执。')}</div>`);
   // 日志抽屉
   if(this.logOpen&&!modal){
    const allLog=this.log.slice().reverse().map(r=>`<li class="tb-log-${r.tone}">${esc(r.text)}</li>`).join('');
    parts.push(`<div class="tb-hud-log-drawer" data-focus="log-panel" tabindex="-1" role="complementary" aria-label="完整战斗记录" aria-live="polite"><p class="tb-eyebrow">战斗记录</p><ol class="tb-log-list" tabindex="0" data-focus="log-scroll" data-scroll-key="battle-log">${allLog}</ol><div class="tb-actions">${buttonHtml('关闭',{action:'toggle-log',variant:'secondary',size:'compact',attributes:{'data-focus':'log-close'}})}</div></div>`);
   }
  }
  this.writeRegion('overlay',parts.join(''));
  this.focusLayer.sync(this.regions.overlay.querySelector<HTMLElement>('[aria-modal="true"]'),[this.regions.top,this.regions.board.parentElement!.parentElement!,this.regions.bottom],()=>this.findFocus(`cell-${this.sel.cursor.x}-${this.sel.cursor.y}`));
 }
 /** 简化的状态块内容（不包含 tb-cover 外层，由调用方包裹） */
 private stateBlock(kind:'loading'|'error'|'empty'|'success',title:string,message:string,actionLabel?:string,actionAction?:string){
  const icons={loading:'hourglass',error:'alert',empty:'info',success:'check'} as const;
  const focusAttr=actionAction?' data-focus="state-primary"':'';
  const action=actionLabel&&actionAction?`<div class="tb-actions" style="justify-content:center">${buttonHtml(actionLabel,{action:actionAction,variant:'primary',attributes:{...(focusAttr?{'data-focus':'state-primary'}:{})}})}</div>`:'';
  return `<div class="ui-state ui-state--${kind}" tabindex="-1" data-focus="state-panel" style="max-width:440px;background:var(--color-panel);border:1px solid var(--color-border);border-radius:var(--radius-panel);padding:var(--space-6)">${iconHtml(icons[kind],{size:32})}<h3>${esc(title)}</h3><p>${esc(message)}</p>${action}</div>`;
 }
 /** 预览页诊断用：当前状态快照（不暴露给游戏）。 */
 snapshot(){return {screen:this.screen,connection:this.connection,phase:this.view?.phase,mode:this.view?.control.mode,revision:this.view?.revision,
  countdown:this.countdown,selection:{command:this.sel.command,target:this.sel.target,submitting:this.sel.submitting?.commandId??null},actors:this.actors.statuses()};}
}
