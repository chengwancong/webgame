/**
 * 棋盘回合制前端控制器：遇敌 → 载入 → 等待 → 预览/确认 → 结算 → 敌方行动 → 托管/接管 → 断线恢复 → 胜利返场。
 * 只消费 TacticalSource（当前只有隔离 fixture）。界面不判定合法性、不计时切托管、不计算伤害或奖励：
 * 所有结果来自投影、预览与已提交事件；按钮禁用只是把投影里的「已用/不可用」显示出来。
 */
import {buttonHtml,confirmationHtml,esc,iconHtml,meterHtml,stateBlockHtml,statusBadgeHtml} from '../ui-components.ts';
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

type Screen='encounter'|'loading'|'error'|'empty'|'board'|'returning'|'returned';
type LogRow={id:string;text:string;tone:'hero'|'enemy'|'pet'|'system'};
type Connection='online'|'offline'|'syncing';
export type ControllerOptions={reducedMotion?:boolean;encounterName?:string};

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
 private countdown:CountdownState={visible:false,remainingMs:null};private cell=74;
 private unsub:(()=>void)|null=null;private ticker:ReturnType<typeof setInterval>;private reconnectTimer:ReturnType<typeof setTimeout>|null=null;
 private timers=new Set<ReturnType<typeof setTimeout>>();private dead=false;private reduced:boolean;
 private actors:TacticalActors;private regions:Record<string,HTMLElement>={};private petPortrait:HTMLCanvasElement;
 private intent:{commandId:string;nodeName:string;groupId:string}|null=null;

 constructor(private readonly root:HTMLElement,private readonly source:TacticalSource,private readonly options:ControllerOptions={}){
  this.reduced=options.reducedMotion??matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML=`<div class="tb-root" data-screen="encounter" data-motion-reduced="${this.reduced}">
<header class="tb-top" data-region="top"></header>
<aside class="tb-left" aria-label="我方信息">
 <section class="tb-card tb-hero-card" data-region="hero"></section>
 <section class="tb-card tb-budget-card" data-region="budget" aria-label="本回合额度"></section>
 <section class="tb-card tb-pet-card" aria-label="宠物条件辅助"><canvas class="tb-pet-portrait" width="64" height="64" aria-hidden="true"></canvas><div data-region="pet"></div></section>
</aside>
<main class="tb-main">
 <div class="tb-banner" data-region="banner" role="status" aria-live="polite"></div>
 <div class="tb-board-frame"><div class="tb-board" data-region="board" style="--ground:url('${pixelSkin?pixelTile(48):GROUND_ART}')">
  <div class="tb-grid" data-region="grid" role="grid" aria-label="战场棋盘"></div>
  <div class="tb-svg" data-region="svg"></div>
  <div class="tb-units" data-region="units"></div>
  <div class="tb-fx" data-region="fx" aria-hidden="true"></div>
 </div></div>
</main>
<aside class="tb-right" data-region="right" aria-label="选择与记录"></aside>
<footer class="tb-commands" data-region="commands" aria-label="行动指令"></footer>
<div class="tb-layer" data-region="overlay"></div>
</div>`;
  for(const el of root.querySelectorAll<HTMLElement>('[data-region]'))this.regions[el.dataset.region!]=el;
  this.petPortrait=root.querySelector('.tb-pet-portrait')!;
  this.actors=new TacticalActors(this.regions.units,this.regions.fx);this.actors.setReducedMotion(this.reduced);
  root.addEventListener('click',this.onClick);root.addEventListener('pointerover',this.onHover);root.addEventListener('pointerleave',this.onLeave,true);
  document.addEventListener('keydown',this.onKey);
  this.ticker=setInterval(()=>this.tick(),250);
  this.render();
 }
 destroy(){
  this.dead=true;clearInterval(this.ticker);if(this.reconnectTimer)clearTimeout(this.reconnectTimer);for(const t of this.timers)clearTimeout(t);
  this.unsub?.();this.actors.destroy();document.removeEventListener('keydown',this.onKey);
  this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('pointerover',this.onHover);this.root.removeEventListener('pointerleave',this.onLeave,true);
  this.root.replaceChildren();
 }
 setReducedMotion(value:boolean){this.reduced=value;this.actors.setReducedMotion(value);(this.root.firstElementChild as HTMLElement).dataset.motionReduced=String(value);}
 private later(fn:()=>void,ms:number){if(ms<=0||this.reduced){fn();return;}const t=setTimeout(()=>{this.timers.delete(t);if(!this.dead)fn();},ms);this.timers.add(t);}

 // ── 生命周期 ───────────────────────────────────────────────
 async start(intent={commandId:newCommandId('engage'),nodeName:this.options.encounterName??'样例遭遇',groupId:'fx-group'}){
  this.intent=intent;this.screen='encounter';this.error=null;this.view=null;this.log=[];this.petFeedback=null;this.render();
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
  }catch(error){if(first)this.fail(error);else this.lostConnection();}
 }
 private subscribe(){this.unsub?.();if(this.handle)this.unsub=this.source.subscribe(this.handle.encounterId,push=>this.onPush(push));}
 private fail(error:unknown){
  const e=error instanceof TacticalSourceError?error:new TacticalSourceError('load-failed','暂时没能载入战场');
  this.error=e;this.screen=e.code==='empty'?'empty':'error';this.render();
 }

 // ── 投影与事件 ─────────────────────────────────────────────
 private onPush(push:TacticalPush){if(this.dead)return;const fresh=this.ledger.accept(push.events);this.play(fresh);this.applyView(push.view);}
 private applyView(view:TacticalEncounterView,force=false){
  if(!force&&this.view&&view.encounterId===this.view.encounterId&&view.revision<this.view.revision)return;
  const prev=this.view;this.view=view;this.sync=syncClock(view.control.serverNowMs,Date.now());
  this.sel=reduceSelection(this.sel,{type:'view',view},view);
  if(this.endConfirm&&!canCommand(view,this.sel))this.endConfirm=false;
  if(prev&&prev.phase!=='ended'&&view.phase==='ended')this.later(()=>this.focus('result-return'),0);
  if(prev?.control.mode==='auto'&&view.control.mode==='manual'&&view.phase==='awaiting')this.later(()=>this.focus('cmd-move'),0);
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
 private dispatch(action:SelectionAction){const before=this.sel;this.sel=reduceSelection(this.sel,action,this.view);if(before!==this.sel)this.render();}
 private async requestPreview(){
  const view=this.view,s=this.sel;if(!view||!s.target||!s.previewPending)return;
  const serial=s.previewSerial,request=s.command==='move'?{kind:'move' as const,to:s.target}:{kind:'ability' as const,abilityId:s.abilityId!,target:s.target};
  try{const preview=await this.source.preview(view.encounterId,request);this.dispatch({type:'preview-result',serial,preview});}
  catch(error){this.dispatch({type:'preview-failed',serial,message:this.errorText(error)});if(this.isNetwork(error))this.lostConnection();}
 }
 private confirm(){
  const view=this.view;if(!view||!canCommand(view,this.sel))return;
  const command=commandFromPreview(view,this.sel,newCommandId());if(!command)return;
  void this.submit(command);
 }
 private endActivation(force:boolean){
  const view=this.view;if(!view||!canCommand(view,this.sel)||!view.actionToken)return;
  if(!force&&(!view.budget.moveUsed||!view.budget.mainActionUsed)){this.endConfirm=true;this.render();this.focus('end-confirm');return;}
  this.endConfirm=false;
  void this.submit({commandId:newCommandId(),encounterId:view.encounterId,expectedRevision:view.revision,actionToken:view.actionToken,kind:'end-activation'});
 }
 private retreat(){
  const view=this.view;if(!view||!canCommand(view,{submitting:null})||!view.actionToken)return;
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
  const view=this.view;if(!view||this.pendingControl)return;
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
 private cellOf(el:Element|null):TacticalCell|null{const b=el?.closest<HTMLElement>('.tb-cell');return b?{x:Number(b.dataset.x),y:Number(b.dataset.y)}:null;}
 private onHover=(event:Event)=>{const cell=this.cellOf(event.target as Element);if(!cell||sameCell(cell,this.sel.hover))return;this.sel={...this.sel,hover:cell};if(this.sel.command==='move'&&!this.sel.target)this.renderBoard();};
 private onLeave=(event:Event)=>{if((event.target as Element)?.classList?.contains('tb-board')){this.sel={...this.sel,hover:null};this.renderBoard();}};
 private pick(cell:TacticalCell){
  const s=this.sel;
  if(s.command!=='none'&&sameCell(s.target,cell)&&s.preview?.ok){this.confirm();return;}
  this.dispatch({type:'pick-cell',cell});
  if(this.sel.previewPending)void this.requestPreview();
 }
 private onClick=(event:MouseEvent)=>{
  const el=(event.target as Element).closest<HTMLElement>('[data-action]');if(!el||!this.root.contains(el)||(el as HTMLButtonElement).disabled)return;
  const id=el.dataset.id;
  switch(el.dataset.action){
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
   case 'retreat':this.dispatch({type:'retreat-ask'});this.focus('retreat-confirm');break;
   case 'retreat-confirm':this.retreat();break;
   case 'retreat-cancel':this.dispatch({type:'retreat-cancel'});this.focus('cmd-retreat');break;
   case 'inspect':this.dispatch({type:'inspect',unitId:id??null});break;
   case 'return':void this.returnToExplore();break;
   case 'retry':void this.start(this.intent??undefined);break;
   case 'restart':
    if(this.view?.source==='sandbox'){
     // 沙盒：回到开局面板（由 tactical-board.ts 暴露的钩子处理）
     (window as any).__sandboxRestart?.();
    }else{
     this.returnCommand=null;this.ledger=new EventLedger();void this.start();
    }
    break;
  }
 };
 private onKey=(event:KeyboardEvent)=>{
  if(this.dead||this.screen!=='board'||!this.view)return;
  const target=event.target as HTMLElement;
  if(target&&target!==document.body&&!this.root.contains(target))return;
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  const modal=this.endConfirm||this.sel.confirmRetreat||!!this.view.result;
  if(event.key==='Escape'){
   if(this.endConfirm){this.endConfirm=false;this.render();this.focus('cmd-end');}else this.dispatch({type:'cancel'});
   event.preventDefault();return;
  }
  if(modal)return;
  const d:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(d[event.key]){
   const [dx,dy]=d[event.key],c=this.sel.cursor,next={x:Math.max(0,Math.min(this.view.board.width-1,c.x+dx)),y:Math.max(0,Math.min(this.view.board.height-1,c.y+dy))};
   this.sel={...this.sel,cursor:next,hover:next};this.renderBoard();this.focus(`cell-${next.x}-${next.y}`);event.preventDefault();return;
  }
  const key=event.key.toLowerCase();
  if(key==='m'){this.dispatch({type:'choose-move'});event.preventDefault();}
  else if(/^[1-4]$/.test(key)){const a=this.view.abilities.find(x=>x.slot===Number(key)-1);if(a)this.dispatch({type:'choose-ability',abilityId:a.id});event.preventDefault();}
  else if(key==='e'){this.endActivation(false);event.preventDefault();}
  else if(key==='a'){void this.sendControl(this.view.control.mode==='manual'?'request-auto':'request-manual');event.preventDefault();}
 };
 private focus(key:string){requestAnimationFrame(()=>this.root.querySelector<HTMLElement>(`[data-focus="${key}"]`)?.focus());}

 // ── 渲染 ───────────────────────────────────────────────────
 private render(){
  if(this.dead)return;
  const active=document.activeElement as HTMLElement|null,focusKey=active&&this.root.contains(active)?active.dataset.focus:undefined;
  (this.root.firstElementChild as HTMLElement).dataset.screen=this.screen;
  if(this.view&&(this.screen==='board'||this.screen==='returning')){
   this.renderTop();this.renderHero();this.renderBudget();this.renderPet();this.renderBanner();this.renderBoard();this.renderRight();this.renderCommands();
  }
  this.renderOverlay();
  if(focusKey){const el=this.root.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`);if(el&&el!==document.activeElement)el.focus({preventScroll:true});}
 }
 private hero(){return this.view?.units.find(u=>u.side==='hero')??null;}
 private phaseText(v:TacticalEncounterView){
  return v.phase==='awaiting'?(v.control.mode==='auto'?'我方行动 · 托管':'我方行动'):v.phase==='resolving'?'正在结算':v.phase==='enemy'?'敌方行动':v.phase==='settling'?'正在确认战斗结果…':'战斗结束';
 }
 private renderTop(){
  const v=this.view!;
  const conn=this.connection==='online'?statusBadgeHtml('已连接','success',{iconHtml:iconHtml('link',{size:16})}):
   this.connection==='syncing'?statusBadgeHtml('正在同步','info',{iconHtml:iconHtml('refresh',{size:16})}):statusBadgeHtml('连接中断','danger',{iconHtml:iconHtml('alert',{size:16})});
  this.regions.top.innerHTML=`<div class="tb-node"><strong>${esc(v.node.name)}</strong><span>${esc(v.node.objective)}</span></div>
<div class="tb-round" aria-label="回合">${v.round!==null?`第${v.round}回合`:''}</div>
<div class="tb-badges">${statusBadgeHtml(this.phaseText(v),v.phase==='enemy'?'warning':v.phase==='awaiting'?'info':'neutral')}
${statusBadgeHtml(v.control.mode==='auto'?'托管':'手动',v.control.mode==='auto'?'warning':'neutral',{iconHtml:iconHtml(v.control.mode==='auto'?'auto':'play',{size:16})})}
${conn}${v.source==='fixture'?statusBadgeHtml('隔离 fixture · 非正式数据','warning',{title:'本页数据来自浏览器内样例，不接服务端、存档或奖励'}):
  v.source==='sandbox'?statusBadgeHtml('战棋沙盒 · 不发奖','info',{title:'沙盒模式：数据来自服务端沙盒接口，不写入角色存档，不发放正式奖励'}):''}</div>`;
 }
 private renderHero(){
  const h=this.hero();if(!h){this.regions.hero.innerHTML='';return;}
  this.regions.hero.innerHTML=`<h3 class="tb-card-title">${esc(h.name)}${h.id===this.view!.actorId?statusBadgeHtml('当前行动','info',{variant:'inline'}):''}</h3>
${meterHtml({value:h.hp.current,max:h.hp.max,label:'生命',tone:'hp',valueText:'end'})}
${h.shield?`<p class="tb-line">${iconHtml('diamond',{size:16})}护盾 <b>${h.shield}</b></p>`:''}
${h.statuses.length?`<p class="tb-statuses">${h.statuses.map(s=>statusBadgeHtml(s.label+(s.remaining?` · ${s.remaining}`:''),s.tone==='buff'?'success':s.tone==='debuff'?'danger':'neutral',{variant:'inline'})).join('')}</p>`:''}`;
 }
 private renderBudget(){
  const v=this.view!,b=v.budget,heroTurn=v.phase==='awaiting'||v.phase==='resolving';
  const row=(label:string,used:boolean,icon:'speed'|'star',extra:string)=>`<li class="tb-budget-row ${used?'is-used':'is-open'}"><span class="tb-budget-mark" aria-hidden="true">${used?'◇':'◆'}</span>${iconHtml(icon,{size:20})}<span>${label}：<b>${used?'已用':'可用'}</b></span>${extra}</li>`;
  this.regions.budget.innerHTML=`<h3 class="tb-card-title">本回合额度${heroTurn?'':statusBadgeHtml('敌方行动中','warning',{variant:'inline'})}</h3>
<ul class="tb-budget">${row('移动',b.moveUsed,'speed',b.moveSteps!==null?`<small>移动步数：${b.moveSteps}${v.source==='fixture'?'（样例）':''}</small>`:'')}${row('技能',b.mainActionUsed,'star','<small>普攻也占用</small>')}</ul>
<p class="tb-note">移动与技能各一次，先后自选。</p>
${b.ended?'<p class="tb-note">本回合已结束行动。</p>':''}`;
 }
 private renderPet(){
  const p=this.view!.pet;
  if(!p){this.regions.pet.innerHTML='<p class="tb-note">未携带宠物。</p>';return;}
  void this.paintPortrait(p.runtimeId);
  const status=p.status==='ready'?statusBadgeHtml(p.statusText,'success',{variant:'inline',iconHtml:iconHtml('check',{size:16})}):
   p.status==='spent'?statusBadgeHtml(p.statusText,'neutral',{variant:'inline',iconHtml:iconHtml('hourglass',{size:16})}):
   p.status==='not-met'?statusBadgeHtml('辅助条件未满足','neutral',{variant:'inline'}):statusBadgeHtml('辅助未配置','warning',{variant:'inline'});
  this.regions.pet.innerHTML=`<h3 class="tb-card-title">${esc(p.name)} ${statusBadgeHtml('条件辅助','info',{variant:'inline'})}</h3>
<p class="tb-line"><span class="tb-dim">辅助条件</span> ${esc(p.conditionText??'尚未配置')}</p>
<p class="tb-line">${status}${p.remainingInWindow!==null?`<small class="tb-dim">本回合剩余 ${p.remainingInWindow} 次</small>`:''}</p>
${this.petFeedback?`<p class="tb-pet-feedback tb-pet-feedback--${this.petFeedback.tone}">${esc(this.petFeedback.text)}</p>`:''}
<p class="tb-note">宠物不占棋格，满足条件时自动辅助。</p>`;
 }
 private portraitFor='';
 private async paintPortrait(runtimeId:string){
  if(this.portraitFor===runtimeId)return;this.portraitFor=runtimeId;
  try{
   const manifest=await (await fetch('/art/starsea/pets/v3/manifest.json')).json() as {assets:{id:string;image:string;atlas:string;anchor:[number,number];frameSize:number}[]};
   const row=manifest.assets.find(a=>a.id===runtimeId);if(!row)throw Error('missing');
   const [atlas,image]=await Promise.all([(await fetch(row.atlas)).json() as Promise<{frames:Record<string,{frame:{x:number;y:number;w:number;h:number}}>}>,
    new Promise<HTMLImageElement>((ok,bad)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=bad;i.src=row.image;})]);
   const f=atlas.frames.idle_0?.frame;if(!f)throw Error('frame');
   const ctx=this.petPortrait.getContext('2d')!,s=Math.min(64/f.w,64/f.h);ctx.clearRect(0,0,64,64);
   ctx.drawImage(image,f.x,f.y,f.w,f.h,(64-f.w*s)/2,(64-f.h*s)/2,f.w*s,f.h*s);
  }catch{this.petPortrait.classList.add('is-placeholder');}
 }
 private renderBanner(){
  const v=this.view!,s=this.sel;let text='',tone='info',action='';
  if(this.connection!=='online'){text=this.connection==='syncing'?'正在同步战场…':'连接中断，正在恢复战场。';tone='danger';}
  else if(v.phase==='settling'){text='正在确认战斗结果…';}
  else if(v.phase==='ended'){text='战斗结束';}
  else if(v.control.mode==='auto'){
   text=v.control.pendingManual?'当前动作结束后接管':`托管中 · ${v.control.autoReason==='manual-timeout'?'等待超时，已转为托管':'已开启托管'}`;tone='warning';
   if(v.control.canRequestManual&&!this.pendingControl)action=buttonHtml('请求接管',{action:'manual',variant:'primary',size:'compact',attributes:{'data-focus':'banner-manual'}});
  }
  else if(v.phase==='enemy'){const a=v.actorId?this.unitName(v.actorId):null;text=a?`敌方行动 · ${a}正在行动`:'敌方行动';tone='warning';}
  else if(v.phase==='resolving'||s.submitting){text='行动已提交，正在结算。';}
  else if(s.command==='move')text=s.target?'这是移动预览，尚未执行。再次点击目标格或「确认行动」执行。':'选择目的地：只能沿亮出的格子走，斜向两侧须可通行，不能穿过夹角。';
  else if(s.command==='ability')text=s.target?'行动预览：确认后执行。':'选择目标格。';
  else if(v.budget.moveUsed!==v.budget.mainActionUsed)text='还有可用行动，可继续操作或结束。';
  else text='轮到你行动：移动与技能各一次，先后自选。';
  this.regions.banner.dataset.tone=tone;
  this.regions.banner.innerHTML=`<span>${esc(text)}</span>${action}`;
 }
 private renderBoard(){
  const v=this.view;if(!v)return;
  const frame=this.regions.board.parentElement!,w=frame.clientWidth||740,h=frame.clientHeight||520,cell=fitCell(v,w,h);
  this.cell=cell;
  const o=boardOverlay(v,this.sel);
  this.regions.board.style.cssText=`--ground:url('${pixelSkin?pixelTile(48):GROUND_ART}');--cell:${cell}px;width:${v.board.width*cell}px;height:${v.board.height*cell}px`;
  this.regions.board.dataset.command=this.sel.command;
  this.regions.grid.style.gridTemplateColumns=`repeat(${v.board.width},${cell}px)`;
  this.regions.grid.innerHTML=boardCellsHtml(v,this.sel,o,cell);
  this.regions.svg.innerHTML=boardSvg(v,o,cell);
  this.actors.sync(v.units,v.pet,cell,v.actorId);
 }
 private unitCard(u:TacticalUnitView){
  return `<h3 class="tb-card-title">${esc(u.name)} ${statusBadgeHtml(u.side==='hero'?'我方':'敌方',u.side==='hero'?'info':'danger',{variant:'inline'})}</h3>
${meterHtml({value:u.hp.current,max:u.hp.max,label:'生命',tone:'hp',valueText:'end'})}
${u.shield?`<p class="tb-line">护盾 <b>${u.shield}</b></p>`:''}
<p class="tb-line"><span class="tb-dim">位置</span> 第${u.cell.x+1}列第${u.cell.y+1}行</p>
${u.statuses.length?`<p class="tb-statuses">${u.statuses.map(s=>statusBadgeHtml(s.label,'neutral',{variant:'inline'})).join('')}</p>`:''}
${u.side==='enemy'?this.intentCardHtml(u.id):''}`;
 }
 private intentCardHtml(unitId:string):string{
  const intents=(this.view?.intents??[]).filter(i=>i.unitId===unitId);
  if(!intents.length)return this.view?.unsupported.includes('敌方意图')?'<p class="tb-note">敌方意图：尚未接入</p>':'';
  return intents.map(i=>{
   if(i.hidden)return `<p class="tb-line tb-intent-row" role="button" tabindex="0" data-action="inspect-intent" data-intent-unitid="${esc(unitId)}" style="cursor:default"><span class="tb-intent-badge">❢${i.order}</span>?（意图未明）</p>`;
   const dmg=i.damage?(i.damage.kind==='amount'?`${i.damage.value}`:`${{'light':'轻','heavy':'重','lethal':'致命'}[i.damage.tier]}`):null;
   const fizzle=i.fizzled?'<span class="tb-dim"> · 落空</span>':'';
   const hidden=i.hidden?'<span class="tb-dim"> · ?</span>':'';
   const typeLabel={'grid':'格子型','chase':'追击型','lock':'锁定型','buff':'增益','summon':'召唤','charge-windup':'蓄力','move-only':'仅移动'}[i.type]??i.type;
   return `<p class="tb-line tb-intent-row" role="button" tabindex="0" data-action="inspect-intent" data-intent-unitid="${esc(unitId)}" style="cursor:default">
<span class="tb-intent-badge">❢${i.order}</span>${esc(typeLabel)}${dmg?` · <b>${dmg}</b>`:''}${fizzle}${hidden}</p>`;
  }).join('');
 }
 private renderRight(){
  const v=this.view!,s=this.sel,parts:string[]=[];
  if(s.target&&s.command!=='none'){
   const p=s.preview,busy=!!s.submitting;
   let body='';
   if(s.previewPending||!p)body=`<p class="tb-line">${iconHtml('hourglass',{size:16})}正在预览…</p>`;
   else if(!p.ok)body=`<p class="tb-denial" role="alert">${iconHtml('lock',{size:16})}${esc(p.denial.message)}</p>`;
   else if(p.kind==='move'){
    const fc=p.forecast;
    body=`<dl class="tb-facts"><dt>目的地</dt><dd>第${p.destination.x+1}列第${p.destination.y+1}行</dd><dt>移动步数</dt><dd>${p.steps}</dd></dl>${p.notes.map(n=>`<p class="tb-note">${esc(n)}</p>`).join('')}`;
    if(fc?.heroHpAfterIntents!==null&&fc?.heroHpAfterIntents!==undefined){
     const pct=Math.round(fc.heroHpAfterIntents/Math.max(1,fc.heroMaxHp)*100);
     const warn=pct<30?' tb-forecast--danger':'';
     body+=`<p class="tb-forecast${warn}" role="status">敌方行动后剩余生命 <b>${fc.heroHpAfterIntents}</b> / ${fc.heroMaxHp}</p>`;
    }
   }else{
    const a=v.abilities.find(x=>x.id===p.abilityId);
    const fc=p.forecast;
    body=`<p class="tb-line"><b>${esc(a?.label??p.abilityId)}</b></p><dl class="tb-facts">${p.known.map(k=>`<dt>${esc(k.label)}</dt><dd>${esc(k.value)}</dd>`).join('')}</dl>
${p.uncertain.map(n=>`<p class="tb-note tb-uncertain">${iconHtml('info',{size:16})}${esc(n)}</p>`).join('')}${p.notes.map(n=>`<p class="tb-note">${esc(n)}</p>`).join('')}`;
    if(fc?.heroHpAfterIntents!==null&&fc?.heroHpAfterIntents!==undefined){
     const pct=Math.round(fc.heroHpAfterIntents/Math.max(1,fc.heroMaxHp)*100);
     const warn=pct<30?' tb-forecast--danger':'';
     body+=`<p class="tb-forecast${warn}" role="status">敌方行动后剩余生命 <b>${fc.heroHpAfterIntents}</b> / ${fc.heroMaxHp}</p>`;
    }
   }
   parts.push(`<section class="tb-card tb-preview"><h3 class="tb-card-title">行动预览</h3>${body}
<div class="tb-actions">${buttonHtml('确认行动',{action:'confirm',variant:'primary',disabled:!p?.ok||busy,busy,busyLabel:'正在提交…',attributes:{'data-focus':'confirm'}})}${buttonHtml('取消选择',{action:'cancel',variant:'secondary',disabled:busy,attributes:{'data-focus':'cancel'}})}</div></section>`);
  }else if(s.inspectId){
   const u=v.units.find(x=>x.id===s.inspectId);
   if(u)parts.push(`<section class="tb-card tb-inspect" aria-label="查看单位"><p class="tb-eyebrow">查看单位</p>${this.unitCard(u)}<div class="tb-actions">${buttonHtml('关闭',{action:'cancel',variant:'quiet',size:'compact'})}</div></section>`);
  }else{
   const a=v.actorId?v.units.find(u=>u.id===v.actorId):null;
   parts.push(`<section class="tb-card"><p class="tb-eyebrow">当前行动</p><p class="tb-line">${a?`<b>${esc(a.name)}</b>正在行动`:v.phase==='settling'?'正在确认战斗结果…':'—'}</p>
${s.message?`<p class="tb-denial" role="alert">${esc(s.message)}</p>`:''}<p class="tb-note">点击单位可查看详情；选择「移动」或技能后再点目标格预览。</p></section>`);
  }
  if(s.message&&s.target)parts.push(`<p class="tb-denial" role="alert">${esc(s.message)}</p>`);
  // 敌方意图侧栏（按 order 排序）
  const intents=v.intents??[];
  if(intents.length){
   const rows=intents.slice().sort((a,b)=>a.order-b.order).map(i=>{
    const unit=v.units.find(u=>u.id===i.unitId);
    const name=unit?.name??i.unitId;
    const typeLabel={'grid':'格子型','chase':'追击型','lock':'锁定型','buff':'增益','summon':'召唤','charge-windup':'蓄力','move-only':'仅移动'}[i.type]??i.type;
    const dmg=i.hidden?'?':i.damage?(i.damage.kind==='amount'?String(i.damage.value):{'light':'轻','heavy':'重','lethal':'致命'}[i.damage.tier]??''):null;
    const fizzle=i.fizzled?'<span class="tb-dim"> · 落空</span>':'';
    return `<li><button type="button" class="tb-unit-chip${i.fizzled?' is-fizzled':''}" data-action="inspect" data-id="${esc(i.unitId)}" data-focus="chip-intent-${i.order}" title="${esc(name)}${i.fizzled?' · 落空':''}">
<span style="font-weight:700;color:var(--color-highlight)">❢${i.order}</span> ${esc(name.slice(0,4))} · ${esc(i.hidden?'?':typeLabel)}${dmg!==null?` · ${esc(dmg)}`:''}${fizzle}</button></li>`;
   }).join('');
   parts.push(`<section class="tb-card tb-intents"><p class="tb-eyebrow">敌方意图</p><ol class="tb-order-list">${rows}</ol></section>`);
  }
  parts.push(`<section class="tb-card tb-order"><p class="tb-eyebrow">行动顺序</p><ol class="tb-order-list">${v.units.filter(u=>u.alive).map(u=>`<li><button type="button" class="tb-unit-chip${u.id===v.actorId?' is-actor':''}" data-action="inspect" data-id="${esc(u.id)}" data-focus="chip-${esc(u.id)}">${esc(u.name)}</button></li>`).join('')}</ol>
<p class="tb-note">${v.unsupported.includes('行动顺序')?'后续顺序尚未确定（列表只是在场单位）':''}</p></section>`);
  parts.push(`<section class="tb-card tb-log"><p class="tb-eyebrow">战斗记录</p><ol class="tb-log-list" aria-live="polite">${this.log.slice(-9).map(r=>`<li class="tb-log-${r.tone}">${esc(r.text)}</li>`).join('')}</ol></section>`);
  this.regions.right.innerHTML=parts.join('');
 }
 private renderCommands(){
  const v=this.view!,s=this.sel,can=canCommand(v,s)&&this.connection==='online',b=v.budget;
  const keyHint=(k:string)=>`<kbd>${k}</kbd>`;
  const move=`<button type="button" class="tb-cmd${s.command==='move'?' is-on':''}${b.moveUsed?' is-used':''}" data-action="move" data-focus="cmd-move" aria-pressed="${s.command==='move'}" ${!can||b.moveUsed?'disabled':''}>
${iconHtml('speed',{size:24})}<span class="tb-cmd-label">移动</span><span class="tb-cmd-state">${b.moveUsed?'已用':'可用'}</span>${keyHint('M')}</button>`;
  const skills=v.abilities.slice(0,4).map(a=>{
   const on=s.command==='ability'&&s.abilityId===a.id,disabled=!can||!a.available;
   const state=a.migration!=='supported'?'尚未迁移':b.mainActionUsed?'已用':!a.available?(a.reason??'不可用'):a.category==='basic'?'普攻':(a.cooldown??'可用');
   return `<button type="button" class="tb-cmd tb-skill${on?' is-on':''}${a.migration!=='supported'?' is-unsupported':''}" data-action="ability" data-id="${esc(a.id)}" data-focus="cmd-ability-${esc(a.id)}" aria-pressed="${on}" ${disabled?'disabled':''} title="${esc([a.description,a.rangeText,a.cost].filter(Boolean).join(' · '))}">
${a.iconSrc?`<img src="${a.iconSrc}" alt="" draggable="false">`:iconHtml('star',{size:24})}<span class="tb-cmd-label">${esc(a.label)}</span><span class="tb-cmd-state">${esc(state)}</span>${keyHint(String(a.slot+1))}</button>`;
  }).join('');
  const end=`<button type="button" class="tb-cmd tb-cmd-end" data-action="end" data-focus="cmd-end" ${!can?'disabled':''}>${iconHtml('check',{size:24})}<span class="tb-cmd-label">结束行动</span>${keyHint('E')}</button>`;
  const control=v.control.mode==='manual'
   ?`<button type="button" class="tb-cmd tb-cmd-auto" data-action="auto" data-focus="cmd-auto" ${!v.control.canRequestAuto||this.pendingControl||this.connection!=='online'?'disabled':''}>${iconHtml('auto',{size:24})}<span class="tb-cmd-label">开启托管</span><span class="tb-cmd-state">持续本场</span>${keyHint('A')}</button>`
   :`<button type="button" class="tb-cmd tb-cmd-manual" data-action="manual" data-focus="cmd-manual" ${!v.control.canRequestManual||this.pendingControl||this.connection!=='online'?'disabled':''}>${iconHtml('play',{size:24})}<span class="tb-cmd-label">${v.control.pendingManual?'当前动作结束后接管':'请求接管'}</span><span class="tb-cmd-state">安全边界生效</span>${keyHint('A')}</button>`;
  const retreat=`<button type="button" class="tb-cmd tb-cmd-retreat" data-action="retreat" data-focus="cmd-retreat" ${!can?'disabled':''}>${iconHtml('chevron-left',{size:24})}<span class="tb-cmd-label">撤退</span></button>`;
  this.regions.commands.innerHTML=`<div class="tb-cmd-group">${move}${skills}</div><div class="tb-cmd-group">${end}${control}${retreat}</div>`;
 }
 private renderOverlay(){
  const parts:string[]=[],v=this.view;
  if(this.screen==='encounter'){
   const node=this.handle?.node;
   parts.push(`<div class="tb-cover tb-encounter" role="status" aria-live="assertive"><div class="tb-encounter-card"><p class="tb-eyebrow">遭遇敌人</p>
<h2>${esc(node?.enemyGroup??'未知敌群')}</h2><p>${esc(node?.name??this.intent?.nodeName??'')}</p><p class="tb-dim">正在展开战场…</p></div></div>`);
  }else if(this.screen==='loading')parts.push(`<div class="tb-cover">${stateBlockHtml({kind:'loading',title:'正在展开战场…',message:'正在读取战场布置与单位。'})}</div>`);
  else if(this.screen==='error'){
   const e=this.error;
   parts.push(`<div class="tb-cover">${stateBlockHtml({kind:'error',title:e?.code==='version-mismatch'?'战场版本不一致':'暂时没能载入战场',message:e?.message??'',
    action:e?.retryable===false?undefined:{label:'重试',action:'retry'}})}${e?.retryable===false?'<p class="tb-note">fixture 不提供返回港口路由；正式版此处返回拾星港。</p>':''}</div>`);
  }else if(this.screen==='empty')parts.push(`<div class="tb-cover">${stateBlockHtml({kind:'empty',title:'没有可进入的遭遇',message:this.error?.message??''})}</div>`);
  else if(this.screen==='returned')parts.push(`<div class="tb-cover">${stateBlockHtml({kind:'success',title:'已返回探索',message:this.returnMessage,action:this.view?.source==='fixture'?{label:'再来一场（fixture）',action:'restart'}:this.view?.source==='sandbox'?{label:'再来一局',action:'restart'}:undefined})}</div>`);
  if(v&&(this.screen==='board'||this.screen==='returning')){
   if(this.countdown.visible){
    const c=this.countdown,pct=Math.max(0,Math.min(100,c.remainingMs/Math.max(1,v.control.warningMs)*100));
    parts.push(`<div class="tb-countdown${c.expired?' is-expired':''}" role="timer" aria-live="${c.seconds<=3?'assertive':'polite'}" aria-label="${esc(c.label)}">${iconHtml('hourglass',{size:20})}<span>${esc(c.label)}</span><i style="width:${pct}%"></i></div>`);
   }
   if(this.notice)parts.push(`<div class="tb-notice tb-notice--${this.notice.tone}" role="status">${esc(this.notice.text)}</div>`);
   if(this.endConfirm)parts.push(confirmationHtml({title:'结束行动',description:'还有可用行动，可继续操作或结束。',confirmLabel:'结束行动',confirmAction:'end-confirm',cancelAction:'end-cancel',cancelLabel:'继续操作'}).replace('data-action="end-confirm"','data-action="end-confirm" data-focus="end-confirm"'));
   if(this.sel.confirmRetreat)parts.push(confirmationHtml({title:'撤退',description:'确认离开这场战斗？撤退后果由服务端决定（fixture 只结束本场，不扣除任何东西）。',confirmLabel:'确认撤退',confirmAction:'retreat-confirm',cancelAction:'retreat-cancel',danger:true}).replace('data-action="retreat-confirm"','data-action="retreat-confirm" data-focus="retreat-confirm"'));
   if(v.result){
    const r=v.result,title={victory:'战斗胜利',defeat:'战斗结束',retreat:'已撤退','system-abort':'战斗中止'}[r.outcome];
    parts.push(`<div class="tb-cover tb-result" role="dialog" aria-modal="true" aria-label="${title}"><section class="tb-result-card tb-result--${r.outcome}">
<p class="tb-eyebrow">${r.outcome==='victory'?'节点目标已完成':'本场结束'}</p><h2>${title}</h2>
${r.rewards.length?`<p>已获得：${r.rewards.map(x=>esc(`${x.label} ×${x.amount}`)).join('、')}</p>`:`<p class="tb-dim">${esc(r.rewardsNote)}</p>`}
<div class="tb-actions">${buttonHtml(this.screen==='returning'?'正在返回…':r.returnLabel,{action:'return',variant:'primary',busy:this.screen==='returning',busyLabel:'正在返回…',attributes:{'data-focus':'result-return'}})}</div></section></div>`);
   }else if(v.phase==='settling')parts.push(`<div class="tb-cover tb-cover--soft">${stateBlockHtml({kind:'loading',title:'正在确认战斗结果…',message:'等待服务端结算回执。'})}</div>`);
  }
  this.regions.overlay.innerHTML=parts.join('');
 }
 /** 预览页诊断用：当前状态快照（不暴露给游戏）。 */
 snapshot(){return {screen:this.screen,connection:this.connection,phase:this.view?.phase,mode:this.view?.control.mode,revision:this.view?.revision,
  countdown:this.countdown,selection:{command:this.sel.command,target:this.sel.target,submitting:this.sel.submitting?.commandId??null},actors:this.actors.statuses()};}
}
