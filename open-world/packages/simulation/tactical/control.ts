import {z} from 'zod';
import type {TacticalActionBudget} from './board.ts';

/** Isolated input-control prototype. No World, cooldown, action-budget, reward or connection mutations.
 * The server caller owns authentication, command deduplication, legal-action validation and atomic
 * persistence of the resulting state with action/timeout events. All `nowMs` values must come from
 * the same authoritative server clock. Never call newTacticalControl/beginAwait on reconnect.
 */
const integer=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identity=z.string().trim().min(1).max(200);
export const tacticalControlPolicySchema=z.object({waitMs:integer.positive(),warningMs:integer}).strict()
 .refine(p=>p.warningMs<=p.waitMs,'Warning window cannot exceed the wait window');
export type TacticalControlPolicy=z.infer<typeof tacticalControlPolicySchema>;
export const defaultTacticalControlPolicy:Readonly<TacticalControlPolicy>={waitMs:60_000,warningMs:10_000};
const modeSchema=z.enum(['manual','auto']);
const actionSchema=z.discriminatedUnion('actor',[
 z.object({actionId:identity,ownerTurnId:identity,actor:z.literal('hero'),controller:modeSchema}).strict(),
 z.object({actionId:identity,ownerTurnId:identity,actor:z.literal('enemy'),controller:z.literal('enemy')}).strict(),
]);
export type TacticalControlAction=z.infer<typeof actionSchema>;
export const tacticalControlStateSchema=z.object({
 version:z.literal(1),encounterId:identity,mode:modeSchema,
 phase:z.enum(['boundary','awaiting','resolving','enemy','ended']),ownerTurnId:identity.nullable(),
 waiting:z.object({windowId:integer.positive(),startedAtMs:integer,deadlineAtMs:integer}).strict().nullable(),
 resolving:actionSchema.nullable(),pendingManual:z.boolean(),
 sequence:integer,windowSerial:integer,timeoutCount:integer,lastTimedOutWindowId:integer.positive().nullable(),
 lastCompletedActionId:identity.nullable(),lastObservedAtMs:integer,policy:tacticalControlPolicySchema,
}).strict().superRefine((s,ctx)=>{
 const invalid=(message:string)=>ctx.addIssue({code:'custom',message});
 if(s.phase==='awaiting'){
  if(!s.ownerTurnId||s.resolving)invalid('Awaiting requires a hero turn and no resolving action');
  if(s.mode==='manual'?!s.waiting:!!s.waiting)invalid('Only manual awaiting has a deadline');
 }else if(s.waiting)invalid('No player deadline outside awaiting');
 if(s.phase==='resolving'){
  if(!s.resolving||s.resolving.ownerTurnId!==s.ownerTurnId)invalid('Resolving requires its matching turn');
 }else if(s.resolving)invalid('Action outside resolving phase');
 if(s.phase==='enemy'&&!s.ownerTurnId)invalid('Enemy phase requires a turn');
 if((s.phase==='boundary'||s.phase==='ended')&&s.ownerTurnId!==null)invalid('Boundary and ended phases have no current turn');
 if(s.pendingManual&&(s.mode!=='auto'||s.phase!=='resolving'))invalid('Manual takeover can only wait on an automatic atomic action');
 if(s.waiting&&(s.waiting.windowId!==s.windowSerial||s.waiting.startedAtMs>s.lastObservedAtMs||
  !Number.isSafeInteger(s.waiting.startedAtMs+s.policy.waitMs)||s.waiting.deadlineAtMs!==s.waiting.startedAtMs+s.policy.waitMs))invalid('Invalid persisted waiting window');
 if(s.timeoutCount>s.windowSerial||(s.timeoutCount===0)!==(s.lastTimedOutWindowId===null)||
  s.lastTimedOutWindowId!==null&&s.lastTimedOutWindowId>s.windowSerial)invalid('Invalid timeout history');
});
export type TacticalControlState=z.infer<typeof tacticalControlStateSchema>;
export type TacticalControlEvent={
 id:string;kind:'timeout-auto'|'manual-requested'|'manual-cancelled'|'manual-applied'|'auto-applied'|'ended';
 atMs:number;windowId?:number;
};
export type TacticalControlTransition={state:TacticalControlState;events:TacticalControlEvent[]};
const budgetSchema=z.object({moveUsed:z.boolean(),mainActionUsed:z.boolean(),ended:z.boolean()}).strict();

function checked(state:TacticalControlState,nowMs:number){
 tacticalControlStateSchema.parse(state);integer.parse(nowMs);
 if(nowMs<state.lastObservedAtMs)throw Error('Server clock moved backwards');
}
function hasBudget(budget:TacticalActionBudget){
 const b=budgetSchema.parse(budget);return !b.ended&&(!b.moveUsed||!b.mainActionUsed);
}
function increment(n:number){if(!Number.isSafeInteger(n+1))throw Error('Control sequence overflow');return n+1;}
function waitWindow(state:TacticalControlState,nowMs:number){
 const deadlineAtMs=nowMs+state.policy.waitMs;
 if(!Number.isSafeInteger(deadlineAtMs))throw Error('Control deadline overflow');
 return {windowId:increment(state.windowSerial),startedAtMs:nowMs,deadlineAtMs};
}
function transition(state:TacticalControlState,nowMs:number,patch:Partial<TacticalControlState>,kind?:TacticalControlEvent['kind']):TacticalControlTransition{
 const next=tacticalControlStateSchema.parse({...state,...patch,sequence:increment(state.sequence),lastObservedAtMs:nowMs});
 return {state:next,events:kind?[{id:`${state.encounterId}:control:${next.sequence}:${kind}`,kind,atMs:nowMs}]:[]};
}
const unchanged=(state:TacticalControlState):TacticalControlTransition=>({state,events:[]});

/** A new encounter only. Default timing is a root-chosen configurable prototype policy. */
export function newTacticalControl(encounterId:string,nowMs:number,policy:TacticalControlPolicy={...defaultTacticalControlPolicy}):TacticalControlState{
 return tacticalControlStateSchema.parse({version:1,encounterId,mode:'manual',phase:'boundary',ownerTurnId:null,
  waiting:null,resolving:null,pendingManual:false,sequence:0,windowSerial:0,timeoutCount:0,lastTimedOutWindowId:null,
  lastCompletedActionId:null,lastObservedAtMs:nowMs,policy});
}

/** Parse the stored checkpoint verbatim. No clock argument and no new deadline on reconnect. */
export function restoreTacticalControl(checkpoint:unknown):TacticalControlState{return tacticalControlStateSchema.parse(checkpoint);}

/** Called only when the scheduler opens a real hero decision with a legal action remaining.
 * A repeated call for the same awaiting turn preserves its original deadline, even if overdue.
 * After an action, use completeResolving rather than re-entering here to mint another wait.
 */
export function beginAwait(state:TacticalControlState,ownerTurnId:string,budget:TacticalActionBudget,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);identity.parse(ownerTurnId);
 if(!hasBudget(budget))throw Error('No remaining hero action budget');
 if(state.phase==='awaiting'&&state.ownerTurnId===ownerTurnId)return unchanged(state);
 if(state.phase!=='boundary')throw Error('Hero decision requires a safe turn boundary');
 const waiting=state.mode==='manual'?waitWindow(state,nowMs):null;
 return transition(state,nowMs,{phase:'awaiting',ownerTurnId,waiting,windowSerial:waiting?.windowId??state.windowSerial});
}

/** The caller validates and commits a legal action/cost in the same transaction. A late manual
 * action may not clear a due deadline: first persist resolveTimeout, then schedule legal auto play.
 * Invalid requests and previews must not invoke this function or renew a waiting window.
 */
export function beginResolving(state:TacticalControlState,input:TacticalControlAction,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);const action=actionSchema.parse(input);
 if(state.phase==='resolving'&&state.resolving?.actionId===action.actionId){
  if(JSON.stringify(state.resolving)!==JSON.stringify(action))throw Error('Action identity conflict');
  return unchanged(state);
 }
 if(action.actionId===state.lastCompletedActionId)throw Error('Action already completed');
 if(state.ownerTurnId!==action.ownerTurnId)throw Error('Action belongs to another turn');
 if(action.actor==='hero'){
  if(state.phase!=='awaiting'||action.controller!==state.mode)throw Error('Hero action controller or phase mismatch');
  if(state.waiting&&nowMs>=state.waiting.deadlineAtMs)throw Error('Manual deadline elapsed; resolve timeout first');
 }else if(state.phase!=='enemy')throw Error('Enemy action requires enemy phase');
 return transition(state,nowMs,{phase:'resolving',waiting:null,resolving:action});
}

/** Finishes one already committed atomic action. Only an authoritative remaining hero budget can
 * open another input window. This module never adds, refunds or consumes any action or cooldown.
 */
export function completeResolving(state:TacticalControlState,actionId:string,remainingBudget:TacticalActionBudget|null,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);identity.parse(actionId);
 if(state.phase!=='resolving'&&state.lastCompletedActionId===actionId)return unchanged(state);
 if(state.phase!=='resolving'||state.resolving?.actionId!==actionId)throw Error('No matching atomic action to complete');
 const action=state.resolving;
 if(action.actor==='hero'&&remainingBudget===null)throw Error('Hero action completion requires the authoritative remaining budget');
 if(action.actor==='enemy'&&remainingBudget!==null)throw Error('Enemy actions cannot grant a hero budget');
 const again=remainingBudget!==null&&hasBudget(remainingBudget),mode=state.pendingManual?'manual':state.mode;
 const waiting=again&&mode==='manual'?waitWindow(state,nowMs):null;
 return transition(state,nowMs,{mode,phase:again?'awaiting':'boundary',ownerTurnId:again?action.ownerTurnId:null,
  resolving:null,waiting,pendingManual:false,lastCompletedActionId:actionId,windowSerial:waiting?.windowId??state.windowSerial},
  state.pendingManual?'manual-applied':undefined);
}

export function beginEnemyTurn(state:TacticalControlState,ownerTurnId:string,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);identity.parse(ownerTurnId);
 if(state.phase==='enemy'&&state.ownerTurnId===ownerTurnId)return unchanged(state);
 if(state.phase!=='boundary')throw Error('Enemy turn requires a safe turn boundary');
 return transition(state,nowMs,{phase:'enemy',ownerTurnId});
}

/** Connection status is deliberately absent. Offline and online waits have the same deadline.
 * Persist this state and deterministic event ID atomically. Replaying the same old checkpoint
 * yields the same event ID; polling/restoring the committed result emits no second timeout.
 */
export function resolveTimeout(state:TacticalControlState,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);
 if(state.phase!=='awaiting'||state.mode!=='manual'||!state.waiting||nowMs<state.waiting.deadlineAtMs)return unchanged(state);
 const waiting=state.waiting;
 const result=transition(state,nowMs,{mode:'auto',waiting:null,pendingManual:false,timeoutCount:increment(state.timeoutCount),lastTimedOutWindowId:waiting.windowId});
 result.events.push({id:`${state.encounterId}:control:timeout:${waiting.windowId}`,kind:'timeout-auto',atMs:waiting.deadlineAtMs,windowId:waiting.windowId});
 return result;
}

/** An authenticated explicit takeover request; reconnect alone is not a takeover request. */
export function requestManual(state:TacticalControlState,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);
 if(state.phase==='ended'||state.mode==='manual'||state.pendingManual)return unchanged(state);
 if(state.phase==='resolving')return transition(state,nowMs,{pendingManual:true},'manual-requested');
 const waiting=state.phase==='awaiting'?waitWindow(state,nowMs):null;
 return transition(state,nowMs,{mode:'manual',waiting,pendingManual:false,windowSerial:waiting?.windowId??state.windowSerial},'manual-applied');
}

/** Auto controls subsequent decisions in this encounter. It never cancels the current action. */
export function requestAuto(state:TacticalControlState,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);
 if(state.phase==='ended'||state.mode==='auto'&&!state.pendingManual)return unchanged(state);
 if(state.mode==='auto')return transition(state,nowMs,{pendingManual:false},'manual-cancelled');
 return transition(state,nowMs,{mode:'auto',waiting:null,pendingManual:false},'auto-applied');
}

/** Authoritative terminal outcome only. No next encounter, reward, fresh action or timer is created. */
export function endTacticalControl(state:TacticalControlState,nowMs:number):TacticalControlTransition{
 checked(state,nowMs);if(state.phase==='ended')return unchanged(state);
 return transition(state,nowMs,{phase:'ended',ownerTurnId:null,waiting:null,resolving:null,pendingManual:false},'ended');
}

/** Read-only server-clock view; callers must still call resolveTimeout to persist mode changes. */
export function tacticalControlView(state:TacticalControlState,nowMs:number){
 checked(state,nowMs);
 const deadlineAtMs=state.waiting?.deadlineAtMs??null,remainingMs=deadlineAtMs===null?null:Math.max(0,deadlineAtMs-nowMs);
 return {encounterId:state.encounterId,serverNowMs:nowMs,mode:state.mode,phase:state.phase,pendingManual:state.pendingManual,
  deadlineAtMs,remainingMs,warning:remainingMs!==null&&remainingMs>0&&remainingMs<=state.policy.warningMs,
  timeoutDue:remainingMs===0};
}
