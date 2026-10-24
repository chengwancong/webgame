import type {FastifyInstance,FastifyReply,FastifyRequest} from 'fastify';
import {randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {TacticalActionSchema,TacticalOrchestrationSchema,type TacticalAction,type TacticalEvent,type TacticalProjection} from '../../../packages/contracts/tactical.ts';
import {tacticalBoards,tacticalBoardById,tacticalGraybox} from '../../../packages/content/tactical-content.ts';
import {createTacticalEncounter,applyTacticalAction,projectTacticalEncounter,createTacticalPreviewState,previewTacticalEncounter} from '../../../packages/simulation/tactical/encounter.ts';
import {chooseTacticalPlan,executeTacticalPlan} from '../../../packages/simulation/tactical/autopilot.ts';
import {newTacticalControl,beginAwait,beginResolving,completeResolving,resolveTimeout,requestManual,requestAuto,endTacticalControl,tacticalControlView,type TacticalControlState,type TacticalControlEvent} from '../../../packages/simulation/tactical/control.ts';

const lifetimeMs=60*60*1000;
const createSchema=z.object({boardId:z.string().min(1).max(120),heroId:z.enum(['sword','hidden']),seed:z.number().int().min(0).max(0xffffffff).optional(),orchestration:TacticalOrchestrationSchema.optional()}).strict();
const commandSchema=z.object({command_id:z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),action:TacticalActionSchema}).strict();
const coordinate=z.string().max(20).regex(/^\d+,\d+$/).transform(value=>{const [x,y]=value.split(',').map(Number);return {x,y};}).refine(p=>Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y),'Invalid coordinate');
const previewSchema=z.object({move:coordinate.optional(),skill:z.string().min(1).max(120).optional(),target:coordinate.optional()}).strict();
const finishedBudget={moveUsed:true,mainActionUsed:true,ended:true};
type State=ReturnType<typeof createTacticalEncounter>;
type Receipt={revision:number;events:TacticalEvent[];projection:TacticalProjection};
type Entry={state:State;control:TacticalControlState;revision:number;expiresAtMs:number;events:TacticalEvent[];commandBytes:number;schedulerSuspended:boolean;commands:Map<string,{fingerprint:string;receipt:Receipt}>};

export type TacticalSandboxOptions={
 /** The only route gate is TACTICAL_SANDBOX=1; injection permits isolated HTTP tests. */
 env?:NodeJS.ProcessEnv;
 now?:()=>number;
 makeId?:()=>string;
 makeSeed?:()=>number;
 tickMs?:number;
 maxEncounters?:number;
 maxCommandsPerEncounter?:number;
 /** Returns a disposer. Production uses one unref'ed interval, never request polling. */
 schedule?:(tick:()=>void,intervalMs:number)=>()=>void;
};
class SandboxError extends Error{constructor(readonly status:number,readonly code:string,message:string){super(message);}}
const illegal=<T>(run:()=>T):T=>{try{return run();}catch(error){throw new SandboxError(400,'TACTICAL_ILLEGAL_ACTION',error instanceof Error?error.message:'非法战棋动作');}};

/** Ephemeral developer/staging battles. No database, session, character, inventory or reward
 * dependency is accepted. Rules and automatic play have the same pure simulation owner.
 * Each callback is synchronous: command CAS, timeout and one automatic turn commit atomically
 * on the Node event loop; the scheduler yields between turns so takeover can be processed. */
export function registerTacticalSandbox(app:FastifyInstance,options:TacticalSandboxOptions={}){
 if((options.env??process.env).TACTICAL_SANDBOX!=='1')return;
 const entries=new Map<string,Entry>(),clock=options.now??Date.now,makeId=options.makeId??randomUUID,makeSeed=options.makeSeed??(()=>randomInt(0,0x100000000));
 const maxEncounters=options.maxEncounters??32,maxCommands=options.maxCommandsPerEncounter??1024,tickMs=options.tickMs??250;
 if(!Number.isSafeInteger(maxEncounters)||maxEncounters<1||!Number.isSafeInteger(maxCommands)||maxCommands<1||!Number.isSafeInteger(tickMs)||tickMs<1)throw Error('Invalid tactical sandbox limits');
 let previousNow=0,closed=false,lastScheduledId='';
 const now=()=>{const value=clock();if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid tactical sandbox clock');return previousNow=Math.max(previousNow,value);};
 const prune=(at:number)=>{for(const [id,entry] of entries)if(at>=entry.expiresAtMs)entries.delete(id);};
 const find=(id:string,at:number)=>{const entry=entries.get(id);if(!entry||at>=entry.expiresAtMs)throw new SandboxError(404,'TACTICAL_NOT_FOUND','沙盒不存在或已过期，请新建一场。');return entry;};
 const view=(entry:Entry,at:number):TacticalProjection=>({...projectTacticalEncounter(entry.state),revision:entry.revision,control:tacticalControlView(entry.control,at),events:structuredClone(entry.events)});
 const controls=(entry:Entry,events:TacticalControlEvent[]):TacticalEvent[]=>events.map(event=>({
  battleId:entry.state.battleId,round:entry.state.round,ownerTurnId:entry.state.ownerTurnId,actionId:event.id,resolutionId:event.id,sourceId:'system',
  type:'control',cause:event.kind==='timeout-auto'?'manual-timeout':event.kind,detail:event.kind,
 }));
 const commit=(entry:Entry,state:State,control:TacticalControlState,events:TacticalEvent[])=>{
  if(!Number.isSafeInteger(entry.revision+1))throw Error('Tactical sandbox revision overflow');
  entry.state=state;entry.control=control;entry.events=[...entry.events,...structuredClone(events)].slice(-256);entry.revision++;
 };
 const finishControl=(entry:Entry,next:State,actionId:string,controller:'manual'|'auto',at:number)=>{
  let control=beginResolving(entry.control,{actionId,ownerTurnId:entry.state.ownerTurnId,actor:'hero',controller},at).state;
  const completedAt=now();
  const sameTurn=next.ownerTurnId===entry.state.ownerTurnId&&!next.outcome;
  let result=completeResolving(control,actionId,sameTurn?next.budget:finishedBudget,completedAt);control=result.state;
  const events=controls(entry,result.events);
  if(next.outcome){result=endTacticalControl(control,completedAt);control=result.state;events.push(...controls(entry,result.events));}
  else if(!sameTurn){result=beginAwait(control,next.ownerTurnId,next.budget,completedAt);control=result.state;}
  return {control,events};
 };
 const timeout=(entry:Entry,at:number)=>{
  const result=resolveTimeout(entry.control,at);if(result.state===entry.control)return false;
  const next=applyTacticalAction(entry.state,{type:'set-control-mode',mode:'auto'});
  commit(entry,next.state,result.state,[...next.events,...controls(entry,result.events)]);return true;
 };
 const runAutomaticTurn=(entry:Entry,at:number)=>{
  const plan=chooseTacticalPlan(projectTacticalEncounter(entry.state));
  const result=executeTacticalPlan(entry.state,plan);
  const completed=finishControl(entry,result.state,`${entry.state.battleId}:auto:${entry.revision}`,'auto',at);
  commit(entry,result.state,completed.control,[...result.events,...completed.events]);
 };
 const suspendScheduler=(entry:Entry,error:unknown,at:number)=>{
  // A single bad encounter cannot escape the interval and terminate the API process. It
  // remains inspectable, with its last committed position and an explicit failure event.
  const id=entry.state.battleId;entry.schedulerSuspended=true;
  app.log.error({battleId:id,message:error instanceof Error?error.message:'unknown'},'Tactical sandbox scheduler failed');
  const event:TacticalEvent={battleId:id,round:entry.state.round,ownerTurnId:entry.state.ownerTurnId,actionId:`${id}:scheduler:${entry.revision}`,resolutionId:`${id}:scheduler:${entry.revision}`,sourceId:'system',type:'control',cause:'scheduler-error',detail:'托管规则异常，已暂停托管并保留当前局面，请显式接管。'};
  try{
   const manual=requestManual(entry.control,at),next=applyTacticalAction(entry.state,{type:'set-control-mode',mode:'manual'});
   commit(entry,next.state,manual.state,[...next.events,...controls(entry,manual.events),event]);
  }catch{
   // If even a mode command is rejected, keep the committed rule state verbatim. The
   // scheduler's suspended marker is application bookkeeping, never a fabricated outcome.
   commit(entry,entry.state,entry.control,[event]);
  }
 };
 const tick=()=>{
  if(closed)return;
  let at:number;try{at=now();}catch(error){app.log.error({message:error instanceof Error?error.message:'unknown'},'Tactical sandbox scheduler clock failed');return;}
  prune(at);
  for(const entry of entries.values())if(!entry.state.outcome&&!entry.schedulerSuspended){try{timeout(entry,at);}catch(error){suspendScheduler(entry,error,at);}}
  const automatic=[...entries.entries()].filter(([,entry])=>entry.control.mode==='auto'&&!entry.state.outcome&&!entry.schedulerSuspended);
  if(!automatic.length)return;
  const last=automatic.findIndex(([id])=>id===lastScheduledId),[id,entry]=automatic[(last+1)%automatic.length];lastScheduledId=id;
  try{runAutomaticTurn(entry,at);}catch(error){suspendScheduler(entry,error,at);}
 };
 const schedule=options.schedule??((callback:()=>void,interval:number)=>{const timer=setInterval(callback,interval);timer.unref();return ()=>clearInterval(timer);});
 const dispose=schedule(tick,tickMs);
 app.addHook('onClose',async()=>{closed=true;dispose();entries.clear();});
 const route=(handler:(request:FastifyRequest,reply:FastifyReply)=>unknown)=>(request:FastifyRequest,reply:FastifyReply)=>{
  reply.header('cache-control','no-store');
  try{return handler(request,reply);}catch(error){
   if(error instanceof z.ZodError)return reply.code(400).send({error:'TACTICAL_REQUEST',message:'沙盒请求格式错误。',issues:error.issues.map(issue=>({path:issue.path,message:issue.message}))});
   if(error instanceof SandboxError)return reply.code(error.status).send({error:error.code,message:error.message});
   throw error;
  }
 };
 app.get('/api/tactical/sandbox/catalog',route(()=>({
  boards:tacticalBoards,heroes:tacticalGraybox.heroes,expiresAfterMs:lifetimeMs,
  orchestration:{target:['nearest','lowest-hp','support-first'],position:['stay-close','keep-distance','behind-cover'],guard:['on','off'],defaults:tacticalGraybox.autopilot.defaults},
 })));
 app.post('/api/tactical/sandbox',route(request=>{
  const input=createSchema.parse(request.body),at=now();prune(at);
  if(!tacticalBoardById.has(input.boardId))throw new SandboxError(400,'TACTICAL_BOARD','未知测试棋盘。');
  if(entries.size>=maxEncounters)throw new SandboxError(429,'TACTICAL_CAPACITY','沙盒暂时已满，请在旧遭遇过期后重试。');
  const state=illegal(()=>createTacticalEncounter({...input,battleId:makeId(),seed:input.seed??makeSeed()}));
  if(entries.has(state.battleId))throw Error('Duplicate tactical sandbox battle ID');
  const readyAt=now(),control=beginAwait(newTacticalControl(state.battleId,readyAt),state.ownerTurnId,state.budget,readyAt).state;
  const entry:Entry={state,control,revision:0,expiresAtMs:readyAt+lifetimeMs,events:structuredClone(state.events??[]),commandBytes:0,schedulerSuspended:false,commands:new Map()};entries.set(state.battleId,entry);
  return view(entry,readyAt);
 }));
 app.get('/api/tactical/sandbox/:id',route(request=>{const at=now();return view(find((request.params as {id:string}).id,at),at);}));
 app.get('/api/tactical/sandbox/:id/preview',route(request=>{
  const input=previewSchema.parse(request.query),at=now(),entry=find((request.params as {id:string}).id,at),actions:TacticalAction[]=[];
  if(input.move)actions.push({type:'move',to:input.move});
  const basicSkill=tacticalGraybox.heroes.find(hero=>hero.id===entry.state.heroId)!.basicSkillId;
  if(input.skill===basicSkill){
   if(!input.target)throw new SandboxError(400,'TACTICAL_REQUEST','普攻预览需要目标格。');
   actions.push({type:'basic',target:input.target});
  }else if(input.skill)actions.push({type:'skill',skillId:input.skill,...(input.target?{target:input.target}:{})});
  else if(input.target)actions.push({type:'basic',target:input.target});
  // Build an expectation-only copy from public data; neither the live RNG nor the waiting
  // window/expiry are advanced by a preview, even if a manual deadline has already elapsed.
  return illegal(()=>previewTacticalEncounter(createTacticalPreviewState(projectTacticalEncounter(entry.state)),actions));
 }));
 app.post('/api/tactical/sandbox/:id/act',route((request,reply)=>{
  const input=commandSchema.parse(request.body),at=now(),entry=find((request.params as {id:string}).id,at);
  const fingerprint=JSON.stringify({revision:input.revision,action:input.action}),replay=entry.commands.get(input.command_id);
  if(replay){if(replay.fingerprint!==fingerprint)throw new SandboxError(409,'TACTICAL_COMMAND_CONFLICT','相同 command_id 不能用于不同请求。');return structuredClone(replay.receipt);}
  if(entry.revision!==input.revision)return reply.code(409).send({error:'TACTICAL_REVISION',message:'战斗状态已变化，请读取最新局面。',revision:entry.revision,projection:view(entry,at)});
  if(entry.commands.size>=maxCommands||entry.commandBytes>=4*1024*1024)throw new SandboxError(429,'TACTICAL_COMMAND_LIMIT','本场命令记录已达沙盒上限，请新建一场。');
  if(timeout(entry,at))return reply.code(409).send({error:'TACTICAL_TIMEOUT',message:'手动等待已到期，已转为托管；请读取最新局面。',revision:entry.revision,events:entry.events,projection:view(entry,at)});
  let state:State,control:TacticalControlState,events:TacticalEvent[];
  if(input.action.type==='set-control-mode'){
   const result=illegal(()=>applyTacticalAction(entry.state,input.action));state=result.state;
   const changed=input.action.mode==='manual'?requestManual(entry.control,at):requestAuto(entry.control,at);control=changed.state;events=[...result.events,...controls(entry,changed.events)];
  }else{
   if(entry.control.mode!=='manual')throw new SandboxError(409,'TACTICAL_AUTO_CONTROL','本场正在托管，请先显式接管。');
   const result=illegal(()=>applyTacticalAction(entry.state,input.action));state=result.state;
   const completed=finishControl(entry,state,`${entry.state.battleId}:cmd:${input.command_id}`,'manual',at);control=completed.control;events=[...result.events,...completed.events];
  }
  commit(entry,state,control,events);
  entry.schedulerSuspended=false;
  // Command receipts keep only their own transition's events. GET includes a bounded recent
  // history, allowing polling clients to catch timeout/background events by resolutionId.
  const receipt:Receipt={revision:entry.revision,events:structuredClone(events),projection:{...view(entry,now()),events:structuredClone(events)}};
  entry.commandBytes+=Buffer.byteLength(JSON.stringify(receipt),'utf8');
  entry.commands.set(input.command_id,{fingerprint,receipt:structuredClone(receipt)});return receipt;
 }));
}
