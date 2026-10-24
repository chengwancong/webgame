import {describe,it,expect} from 'vitest';
import {freshTacticalBudget,spendTacticalAction} from '../packages/simulation/tactical/board.ts';
import {newTacticalControl,restoreTacticalControl,beginAwait,beginResolving,completeResolving,beginEnemyTurn,
 resolveTimeout,requestManual,requestAuto,endTacticalControl,tacticalControlView,type TacticalControlState} from '../packages/simulation/tactical/control.ts';

const START=1_000;
const initial=()=>newTacticalControl('encounter-a',START);
const waiting=()=>beginAwait(initial(),'hero-1',freshTacticalBudget(),START).state;
const heroAction=(id='action-1',controller:'manual'|'auto'='manual')=>({actionId:id,ownerTurnId:'hero-1',actor:'hero' as const,controller});
const roundTrip=(s:TacticalControlState)=>restoreTacticalControl(JSON.parse(JSON.stringify(s)));

describe('isolated tactical input control',()=>{
 it('opens one configurable server deadline only when a hero decision actually begins',()=>{
  const s=initial(),budget=freshTacticalBudget(),copy=structuredClone({s,budget});
  expect(tacticalControlView(s,START)).toMatchObject({remainingMs:null,deadlineAtMs:null,timeoutDue:false});
  const opened=beginAwait(s,'hero-1',budget,START);
  expect(opened.state).toMatchObject({mode:'manual',phase:'awaiting',windowSerial:1,waiting:{windowId:1,startedAtMs:START,deadlineAtMs:61_000}});
  expect({s,budget}).toEqual(copy);
  const custom=beginAwait(newTacticalControl('encounter-b',START,{waitMs:30_000,warningMs:5_000}),'hero-1',budget,START).state;
  expect(custom.waiting?.deadlineAtMs).toBe(31_000);
 });

 it('warns only during the final ten seconds and expires exactly at the deadline',()=>{
  const s=waiting();
  expect(tacticalControlView(s,50_999)).toMatchObject({remainingMs:10_001,warning:false,timeoutDue:false});
  expect(tacticalControlView(s,51_000)).toMatchObject({remainingMs:10_000,warning:true,timeoutDue:false});
  expect(tacticalControlView(s,60_999)).toMatchObject({remainingMs:1,warning:true,timeoutDue:false});
  expect(resolveTimeout(s,60_999).events).toEqual([]);
  expect(tacticalControlView(s,61_000)).toMatchObject({remainingMs:0,warning:false,timeoutDue:true});
  expect(resolveTimeout(s,61_000).state.mode).toBe('auto');
 });

 it('previews, repeated awaiting calls and reconnect restore never renew an existing deadline',()=>{
  const s=waiting(),before=structuredClone(s);
  tacticalControlView(s,10_000);tacticalControlView(s,59_000);
  expect(s).toEqual(before);expect(roundTrip(s)).toEqual(s);
  expect(beginAwait(s,'hero-1',freshTacticalBudget(),60_000).state).toBe(s);
  expect(beginAwait(roundTrip(s),'hero-1',freshTacticalBudget(),90_000).state.waiting?.deadlineAtMs).toBe(61_000);
  expect(requestManual(s,60_000).state).toBe(s);
 });

 it('a long offline gap switches once without adding actions, and restored polls do not replay timeout',()=>{
  const s=roundTrip(waiting()),budget=freshTacticalBudget(),offlineNow=START+86_400_000;
  const timedOut=resolveTimeout(s,offlineNow);
  expect(timedOut.state).toMatchObject({mode:'auto',phase:'awaiting',waiting:null,timeoutCount:1,lastTimedOutWindowId:1});
  expect(timedOut.events).toEqual([{id:'encounter-a:control:timeout:1',kind:'timeout-auto',atMs:61_000,windowId:1}]);
  expect(resolveTimeout(timedOut.state,offlineNow).events).toEqual([]);
  expect(resolveTimeout(roundTrip(timedOut.state),offlineNow+100_000).events).toEqual([]);
  expect(resolveTimeout(s,offlineNow+100_000).events[0].id).toBe(timedOut.events[0].id);
  expect(budget).toEqual(freshTacticalBudget());
 });

 it('rejects invalid clocks, rollback and unsafe deadline arithmetic',()=>{
  const s=waiting();
  for(const now of [-1,NaN,Infinity,1.5,START-1]){
   expect(()=>tacticalControlView(s,now)).toThrow();expect(()=>resolveTimeout(s,now)).toThrow();
  }
  expect(()=>newTacticalControl('x',-1)).toThrow();
  expect(()=>newTacticalControl('x',0,{waitMs:0,warningMs:0})).toThrow();
  expect(()=>newTacticalControl('x',0,{waitMs:10,warningMs:11})).toThrow();
  const huge=newTacticalControl('x',Number.MAX_SAFE_INTEGER-10);
  expect(()=>beginAwait(huge,'hero-1',freshTacticalBudget(),Number.MAX_SAFE_INTEGER-10)).toThrow('deadline overflow');
  const changed=requestAuto(s,20_000).state;expect(()=>requestManual(changed,19_999)).toThrow('backwards');
 });

 it('an accepted action removes the timer; completing it renews only if real budget remains',()=>{
  const s=waiting(),budget=spendTacticalAction(freshTacticalBudget(),'move');
  const resolving=beginResolving(s,heroAction(),10_000).state;
  expect(tacticalControlView(resolving,900_000)).toMatchObject({deadlineAtMs:null,remainingMs:null,timeoutDue:false});
  expect(resolveTimeout(resolving,900_000).events).toEqual([]);
  const complete=completeResolving(resolving,'action-1',budget,900_000).state;
  expect(complete).toMatchObject({phase:'awaiting',mode:'manual',windowSerial:2,waiting:{startedAtMs:900_000,deadlineAtMs:960_000}});
  expect(budget).toEqual({moveUsed:true,mainActionUsed:false,ended:false});
  expect(completeResolving(complete,'action-1',budget,950_000).state).toBe(complete);
  expect(()=>beginResolving(complete,heroAction(),950_000)).toThrow('already completed');
 });

 it('exhausted or explicitly ended action budgets close the decision without another wait',()=>{
  const both=spendTacticalAction(spendTacticalAction(freshTacticalBudget(),'move'),'skill');
  const ended=spendTacticalAction(freshTacticalBudget(),'end');
  for(const budget of [both,ended]){
   const resolving=beginResolving(waiting(),heroAction(),5_000).state;
   const completed=completeResolving(resolving,'action-1',budget,8_000).state;
   expect(completed).toMatchObject({phase:'boundary',waiting:null,ownerTurnId:null,windowSerial:1});
   expect(()=>beginAwait(completed,'hero-2',budget,9_000)).toThrow('No remaining');
  }
 });

 it('does not let a late manual action or mismatched controller erase the timeout',()=>{
  const s=waiting(),before=structuredClone(s);
  expect(()=>beginResolving(s,heroAction(),61_000)).toThrow('deadline elapsed');
  expect(()=>beginResolving(s,heroAction('action-1','auto'),50_000)).toThrow('controller or phase');
  expect(s).toEqual(before);
  const auto=resolveTimeout(s,61_000).state;
  expect(()=>beginResolving(auto,heroAction(),61_000)).toThrow('controller or phase');
  expect(beginResolving(auto,heroAction('auto-1','auto'),61_000).state.phase).toBe('resolving');
 });

 it('enemy turns and their atomic resolution never get a player deadline',()=>{
  const enemy=beginEnemyTurn(initial(),'enemy-1',2_000).state;
  expect(tacticalControlView(enemy,500_000)).toMatchObject({deadlineAtMs:null,remainingMs:null});
  const resolving=beginResolving(enemy,{actionId:'enemy-hit',ownerTurnId:'enemy-1',actor:'enemy',controller:'enemy'},500_000).state;
  expect(resolveTimeout(resolving,900_000).events).toEqual([]);
  expect(()=>completeResolving(resolving,'enemy-hit',freshTacticalBudget(),900_000)).toThrow('cannot grant');
  expect(completeResolving(resolving,'enemy-hit',null,900_000).state).toMatchObject({phase:'boundary',waiting:null});
 });

 it('automatic control persists across remaining actions, enemy turns and the next hero turn',()=>{
  const auto=resolveTimeout(waiting(),61_000).state;
  const action=beginResolving(auto,heroAction('auto-1','auto'),62_000).state;
  const remain=completeResolving(action,'auto-1',spendTacticalAction(freshTacticalBudget(),'move'),63_000).state;
  expect(remain).toMatchObject({mode:'auto',phase:'awaiting',waiting:null});
  const next=beginResolving(remain,heroAction('auto-2','auto'),64_000).state;
  const end=completeResolving(next,'auto-2',{moveUsed:true,mainActionUsed:true,ended:false},65_000).state;
  const enemy=beginEnemyTurn(end,'enemy-1',66_000).state;
  const enemyAction=beginResolving(enemy,{actionId:'enemy-hit',ownerTurnId:'enemy-1',actor:'enemy',controller:'enemy'},67_000).state;
  const boundary=completeResolving(enemyAction,'enemy-hit',null,68_000).state;
  expect(beginAwait(boundary,'hero-2',freshTacticalBudget(),69_000).state).toMatchObject({mode:'auto',waiting:null,timeoutCount:1});
 });

 it('queues a takeover during an automatic action and applies it only after that atomic action',()=>{
  const auto=requestAuto(waiting(),2_000).state;
  const resolving=beginResolving(auto,heroAction('auto-1','auto'),3_000).state;
  const requested=requestManual(resolving,4_000);
  expect(requested.state).toMatchObject({mode:'auto',phase:'resolving',pendingManual:true,waiting:null});
  expect(requested.events[0].kind).toBe('manual-requested');
  expect(requestManual(requested.state,5_000).events).toEqual([]);
  const budget=spendTacticalAction(freshTacticalBudget(),'skill'),completed=completeResolving(roundTrip(requested.state),'auto-1',budget,6_000);
  expect(completed.state).toMatchObject({mode:'manual',pendingManual:false,phase:'awaiting',waiting:{deadlineAtMs:66_000}});
  expect(completed.events[0].kind).toBe('manual-applied');expect(budget).toEqual({moveUsed:false,mainActionUsed:true,ended:false});
 });

 it('a takeover after the last action cannot create another action window',()=>{
  const auto=requestAuto(waiting(),2_000).state,resolving=beginResolving(auto,heroAction('auto-1','auto'),3_000).state;
  const pending=requestManual(resolving,4_000).state;
  expect(completeResolving(pending,'auto-1',{moveUsed:true,mainActionUsed:true,ended:false},5_000).state)
   .toMatchObject({mode:'manual',phase:'boundary',waiting:null,ownerTurnId:null,pendingManual:false});
 });

 it('takeover at an existing decision is immediate but a repeated manual request cannot extend it',()=>{
  const auto=resolveTimeout(waiting(),61_000).state;
  const manual=requestManual(auto,80_000).state;
  expect(manual).toMatchObject({mode:'manual',phase:'awaiting',waiting:{startedAtMs:80_000,deadlineAtMs:140_000}});
  expect(requestManual(manual,139_000).state).toBe(manual);
  const timeout=resolveTimeout(manual,140_000);expect(timeout.state.timeoutCount).toBe(2);
  expect(timeout.events[0].id).toBe('encounter-a:control:timeout:2');
 });

 it('can cancel a queued manual takeover without changing the in-flight action or its budget',()=>{
  const auto=requestAuto(waiting(),2_000).state,resolving=beginResolving(auto,heroAction('auto-1','auto'),3_000).state;
  const pending=requestManual(resolving,4_000).state,cancelled=requestAuto(pending,5_000);
  expect(cancelled.state).toMatchObject({mode:'auto',phase:'resolving',pendingManual:false,resolving:heroAction('auto-1','auto')});
  expect(cancelled.events[0].kind).toBe('manual-cancelled');
  expect(requestAuto(cancelled.state,6_000).events).toEqual([]);
 });

 it('deduplicates an in-flight action but rejects identity conflicts and wrong turn completion',()=>{
  const resolving=beginResolving(waiting(),heroAction(),2_000).state;
  expect(beginResolving(resolving,heroAction(),3_000).state).toBe(resolving);
  expect(()=>beginResolving(resolving,{...heroAction(),ownerTurnId:'other'},3_000)).toThrow('identity conflict');
  expect(()=>completeResolving(resolving,'wrong',freshTacticalBudget(),3_000)).toThrow('matching');
  expect(()=>completeResolving(resolving,'action-1',null,3_000)).toThrow('remaining budget');
  expect(()=>beginAwait(resolving,'hero-2',freshTacticalBudget(),3_000)).toThrow('safe turn boundary');
 });

 it('terminal state clears all waiting and pending control and never opens another encounter',()=>{
  const states=[waiting(),requestManual(beginResolving(requestAuto(waiting(),2_000).state,heroAction('auto-1','auto'),3_000).state,4_000).state];
  for(const s of states){
   const ended=endTacticalControl(s,5_000);
   expect(ended.state).toMatchObject({encounterId:'encounter-a',phase:'ended',waiting:null,resolving:null,pendingManual:false,ownerTurnId:null});
   expect(endTacticalControl(roundTrip(ended.state),900_000).events).toEqual([]);
   expect(resolveTimeout(ended.state,900_000).events).toEqual([]);
   expect(requestManual(ended.state,900_000).events).toEqual([]);expect(requestAuto(ended.state,900_000).events).toEqual([]);
   expect(()=>beginAwait(ended.state,'hero-next',freshTacticalBudget(),900_000)).toThrow('safe turn boundary');
   expect(()=>beginEnemyTurn(ended.state,'enemy-next',900_000)).toThrow('safe turn boundary');
  }
 });

 it('rejects a malformed checkpoint instead of minting a new deadline on restore',()=>{
  const s=waiting();
  expect(()=>restoreTacticalControl({...s,waiting:{...s.waiting,deadlineAtMs:999_999}})).toThrow();
  expect(()=>restoreTacticalControl({...s,phase:'enemy'})).toThrow();
  expect(()=>restoreTacticalControl({...s,mode:'auto'})).toThrow();
  expect(()=>restoreTacticalControl({...s,pendingManual:true})).toThrow();
  expect(()=>restoreTacticalControl({...s,untrustedClientTime:123})).toThrow();
 });
});
