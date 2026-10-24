/**
 * 沙盒数据源：实现 TacticalSource，对接 TAC-B1 冻结的 /api/tactical/sandbox/* 接口（apps/api/src/tactical-sandbox.ts）。
 * 界面标"战棋沙盒 · 不发奖"，不宣称正式战斗已接通。接口未开启（TACTICAL_SANDBOX）时返回 404。
 *
 * 沙盒没有推送通道：act 回执与 409 携带的投影立即推给订阅者；托管 / 敌方结算 / 等待已过期时低频轮询 GET。
 * GET 返回最近 256 条历史事件，按 resolutionId 去重，只推送没见过的。
 */
import {TacticalSourceError} from './contract.ts';
import type {
 TacticalCommand,TacticalControlCommand,TacticalEncounterHandle,TacticalEncounterIntent,
 TacticalEncounterView,TacticalOrchestration,TacticalPreview,TacticalPreviewRequest,
 TacticalPush,TacticalReceipt,TacticalSource,
} from './contract.ts';
import type {TacticalAction,TacticalEvent as WireEvent,TacticalProjection} from '../../../../packages/contracts/tactical.ts';
import type {SandboxCatalogWire,SandboxMeta,SandboxPreviewWire,SandboxReceiptWire} from './sandbox-wire.ts';
import {commandToAction,controlToAction,denialFromMessage,eventsToView,fallbackMeta,metaFromCatalog,namesOf,previewToView,projectionToView} from './sandbox-wire.ts';

const BASE='/api/tactical/sandbox';
/** 托管/敌方结算时的轮询间隔；服务端每 250ms 跑一个托管回合，1 秒一取足够看清。 */
const POLL_ACTIVE_MS=1000;
const POLL_IDLE_MS=2500;

/** 400：服务端拒绝了这条行动（非法目标、额度已用等），不是断线。 */
class SandboxRejected extends Error{constructor(message:string){super(message);}}
/** 409：带最新投影（超时转托管、修订号过期等），先推投影再报错。 */
class SandboxConflict extends Error{constructor(readonly code:string,message:string,readonly projection:TacticalProjection|null){super(message);}}

/** 沙盒开局设置（由开局面板传入 create）。 */
export type SandboxCreateOptions={boardId:string;heroId:'sword'|'hidden';seed?:number;orchestration?:TacticalOrchestration};

type PollEntry={unsub:()=>void;listener:(push:TacticalPush)=>void;lastRevision:number};

/** command_id 只允许 [A-Za-z0-9_-]，其余字符替换成 '-'。 */
export const wireCommandId=(id:string)=>id.replace(/[^A-Za-z0-9_-]/g,'-').slice(0,120)||'cmd';

export class SandboxSource implements TacticalSource{
 readonly kind='sandbox' as const;
 private meta:SandboxMeta=fallbackMeta();
 private lastEncounterId:string|null=null;
 private lastView:TacticalEncounterView|null=null;private lastViewAt=0;
 private polls=new Map<string,PollEntry>();
 private inflight=new Map<string,Promise<TacticalReceipt>>();
 /** 每场遭遇已播放过的 resolutionId；首次 load/create 时把历史全部记为已见，不重播。 */
 private seen=new Map<string,Set<string>>();
 private heroOf=new Map<string,string>();

 // ── 目录与创建 ─────────────────────────────────────────────

 async loadCatalog():Promise<SandboxCatalogWire>{
  const c=await this.get('/catalog') as SandboxCatalogWire;
  this.meta=metaFromCatalog(c);
  return c;
 }

 async create(opts:SandboxCreateOptions):Promise<TacticalEncounterView>{
  const body:{boardId:string;heroId:string;seed?:number;orchestration?:Record<string,unknown>}={boardId:opts.boardId,heroId:opts.heroId};
  if(opts.seed!=null&&Number.isInteger(opts.seed))body.seed=opts.seed;
  if(opts.orchestration){
   const o=opts.orchestration,orch:Record<string,unknown>={priority:o.priority,guard:o.guard?'on':'off'};
   if(o.target)orch.target=o.target;if(o.position)orch.position=o.position;
   body.orchestration=orch;
  }
  const raw=await this.post('',body) as TacticalProjection;
  this.lastEncounterId=raw.battleId;
  return this.absorb(raw,true);
 }

 // ── TacticalSource 实现 ─────────────────────────────────────

 async engage(_intent:TacticalEncounterIntent):Promise<TacticalEncounterHandle>{
  if(!this.lastEncounterId)throw new TacticalSourceError('not-found','请先通过开局面板创建沙盒遭遇。',false);
  const view=await this.load(this.lastEncounterId);
  return {encounterId:view.encounterId,node:view.node,alreadyActive:view.revision>0};
 }

 async load(encounterId:string):Promise<TacticalEncounterView>{
  const raw=await this.get(`/${encodeURIComponent(encounterId)}`) as TacticalProjection;
  return this.absorb(raw,!this.seen.has(raw.battleId));
 }

 /** 收下一份投影；markAllSeen 为真时把其中历史事件全部记为已见（首次加载不重播）。 */
 private absorb(raw:TacticalProjection,markAllSeen=false):TacticalEncounterView{
  this.heroOf.set(raw.battleId,raw.heroId);
  if(markAllSeen)this.markSeen(raw.battleId,raw.events??[]);
  const view=projectionToView(raw,this.meta);
  this.lastView=view;this.lastViewAt=Date.now();
  return view;
 }
 private markSeen(battleId:string,events:readonly WireEvent[]){
  let s=this.seen.get(battleId);if(!s)this.seen.set(battleId,s=new Set());
  for(const e of events)s.add(e.resolutionId);
 }
 /** 过滤出未见过的事件并记为已见。 */
 private fresh(battleId:string,events:readonly WireEvent[]):WireEvent[]{
  let s=this.seen.get(battleId);if(!s)this.seen.set(battleId,s=new Set());
  const out=events.filter(e=>!s!.has(e.resolutionId));
  for(const e of out)s.add(e.resolutionId);
  return out;
 }
 /** 推给订阅者（act 回执已把本次事件交给调用方，这里只推投影；轮询时带上新事件）。 */
 private push(raw:TacticalProjection,events:readonly WireEvent[]=[]){
  const view=this.absorb(raw);
  const entry=this.polls.get(raw.battleId);
  if(!entry)return view;
  if(view.revision!==entry.lastRevision||events.length){
   entry.lastRevision=view.revision;
   entry.listener({events:eventsToView(events,namesOf(view)),view});
  }
  return view;
 }
 /** 手动等待且未过截止时刻时，服务端状态不会自己变化，不轮询。 */
 private pollMode():'off'|'active'|'idle'{
  const v=this.lastView;if(!v)return 'idle';
  if(v.result||v.phase==='ended')return 'off';
  if(v.control.mode==='auto'||v.phase!=='awaiting'||v.control.pendingManual)return 'active';
  const deadline=v.control.deadlineAtMs;if(deadline==null)return 'off';
  return v.control.serverNowMs+(Date.now()-this.lastViewAt)>=deadline?'active':'off';
 }

 async preview(encounterId:string,request:TacticalPreviewRequest):Promise<TacticalPreview>{
  const qs=request.kind==='move'
   ?`move=${request.to.x},${request.to.y}`
   :`skill=${encodeURIComponent(request.abilityId)}&target=${request.target.x},${request.target.y}`;
  const current=this.lastView;
  try{
   const raw=await this.get(`/${encodeURIComponent(encounterId)}/preview?${qs}`) as SandboxPreviewWire;
   return previewToView(raw,request,current??projectionToView(raw.projection,this.meta));
  }catch(e){
   if(e instanceof SandboxRejected)return {ok:false,denial:denialFromMessage(e.message)};
   if(e instanceof SandboxConflict){if(e.projection)this.push(e.projection);return {ok:false,denial:{code:'not-your-turn',message:e.message}};}
   throw e;
  }
 }

 submit(command:TacticalCommand):Promise<TacticalReceipt>{
  if(command.kind==='retreat')return Promise.resolve({commandId:command.commandId,accepted:false,revision:command.expectedRevision,events:[],
   denial:{code:'unsupported',message:'沙盒不支持撤退。'}});
  const basic=this.meta.basic.get(this.heroOf.get(command.encounterId)??'');
  return this.once(command.commandId,()=>this.act(command.encounterId,command.commandId,command.expectedRevision,commandToAction(command,basic)));
 }

 control(command:TacticalControlCommand):Promise<TacticalReceipt>{
  return this.once(command.commandId,async()=>{
   const encounterId=command.encounterId||this.lastEncounterId;
   if(!encounterId)throw new TacticalSourceError('not-found','没有活跃的沙盒遭遇。',false);
   const view=this.lastView?.encounterId===encounterId?this.lastView:await this.load(encounterId);
   return this.act(encounterId,command.commandId,view.revision,controlToAction(command));
  });
 }

 /** 重发同一指令复用同一 promise；失败后允许重试。 */
 private once(commandId:string,run:()=>Promise<TacticalReceipt>):Promise<TacticalReceipt>{
  const existing=this.inflight.get(commandId);if(existing)return existing;
  const p=run();this.inflight.set(commandId,p);
  p.catch(()=>this.inflight.delete(commandId));
  return p;
 }

 private async act(encounterId:string,commandId:string,revision:number,action:TacticalAction):Promise<TacticalReceipt>{
  const body={command_id:wireCommandId(commandId),revision,action};
  let raw:SandboxReceiptWire;
  try{raw=await this.post(`/${encodeURIComponent(encounterId)}/act`,body) as SandboxReceiptWire;}
  catch(e){
   if(e instanceof SandboxRejected)return {commandId,accepted:false,revision,events:[],denial:denialFromMessage(e.message)};
   if(e instanceof SandboxConflict){
    if(e.projection)this.push(e.projection,this.fresh(encounterId,e.projection.events??[]));
    if(e.code==='TACTICAL_REVISION')throw new TacticalSourceError('stale-revision','局面已变化，已同步到最新状态。');
    if(e.code==='TACTICAL_COMMAND_CONFLICT')throw new TacticalSourceError('control-conflict','指令编号冲突，请重新操作。',false);
    return {commandId,accepted:false,revision:e.projection?.revision??revision,events:[],
     denial:{code:'not-your-turn',message:e.code==='TACTICAL_TIMEOUT'?'等待已超时，已转为托管。':e.code==='TACTICAL_AUTO_CONTROL'?'当前为托管，请先切回手动。':e.message}};
   }
   throw e;
  }
  const events=this.fresh(encounterId,raw.events);
  const view=this.push(raw.projection);
  return {commandId,accepted:true,revision:raw.revision,events:eventsToView(events,namesOf(view))};
 }

 subscribe(encounterId:string,listener:(push:TacticalPush)=>void):()=>void{
  this.polls.get(encounterId)?.unsub();
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,busy=false;
  const entry:PollEntry={unsub:()=>{},listener,lastRevision:this.lastView?.encounterId===encounterId?this.lastView.revision:-1};
  const poll=async()=>{
   if(stopped||busy)return;
   const mode=this.pollMode();
   if(!document.hidden&&mode!=='off'){
    busy=true;
    try{
     const raw=await this.get(`/${encodeURIComponent(encounterId)}`) as TacticalProjection;
     if(!stopped)this.push(raw,this.fresh(encounterId,raw.events??[]));
    }catch{/* 网络错误忽略，由 reconnect 处理 */}
    finally{busy=false;}
   }
   if(!stopped)timer=setTimeout(poll,this.pollMode()==='active'?POLL_ACTIVE_MS:POLL_IDLE_MS);
  };
  timer=setTimeout(poll,POLL_IDLE_MS);
  const onVisibility=()=>{if(!document.hidden){clearTimeout(timer);void poll();}};
  document.addEventListener('visibilitychange',onVisibility);
  entry.unsub=()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',onVisibility);};
  this.polls.set(encounterId,entry);
  return ()=>{entry.unsub();if(this.polls.get(encounterId)===entry)this.polls.delete(encounterId);};
 }

 async returnToExplore(_encounterId:string,_commandId:string):Promise<{message:string}>{
  return {message:'战棋沙盒已结束（不存档、不发奖），可以再开一局。'};
 }

 destroy(){
  for(const entry of this.polls.values())entry.unsub();
  this.polls.clear();this.inflight.clear();
 }

 // ── HTTP 辅助 ─────────────────────────────────────────────

 private async get(path:string):Promise<unknown>{
  let res:Response;
  try{res=await fetch(BASE+path,{credentials:'same-origin'});}
  catch{throw new TacticalSourceError('network','网络请求失败，请检查连接。');}
  return this.check(res);
 }

 private async post(path:string,body:unknown):Promise<unknown>{
  let res:Response;
  try{res=await fetch(BASE+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
  catch{throw new TacticalSourceError('network','网络请求失败，请检查连接。');}
  return this.check(res);
 }

 private async check(res:Response):Promise<unknown>{
  if(res.ok){try{return await res.json();}catch{throw new TacticalSourceError('network','响应解析失败。');}}
  const body=await res.json().catch(()=>null) as {error?:string;message?:string;projection?:TacticalProjection}|null;
  const message=body?.message??'';
  if(res.status===400)throw new SandboxRejected(message);
  if(res.status===409)throw new SandboxConflict(body?.error??'',message||'局面已变化。',body?.projection??null);
  if(res.status===404)throw new TacticalSourceError('not-found',message||'沙盒遭遇已关闭或过期（遭遇 1 小时过期），请重新开一局。',false);
  if(res.status===429)throw new TacticalSourceError('load-failed',message||'沙盒暂时已满，请稍后再开。',false);
  throw new TacticalSourceError('network',`服务端错误 ${res.status}，稍后重试。`);
 }
}
