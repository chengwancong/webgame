import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {EventLedger,countdownState,syncClock} from '../apps/web/src/tactical/countdown.ts';
import {canCommand,initialSelection,reduceSelection} from '../apps/web/src/tactical/selection.ts';
import {FixtureServer,FixtureSource,defaultFixtureOptions,fixtureOptionsFromQuery} from '../apps/web/src/tactical/fixture-source.ts';
import type {FixtureOptions} from '../apps/web/src/tactical/fixture-source.ts';
import type {TacticalCommand,TacticalEncounterView,TacticalEvent} from '../apps/web/src/tactical/contract.ts';

const options=(patch:Partial<FixtureOptions>={}):FixtureOptions=>({...defaultFixtureOptions,latencyMs:0,skewMs:0,...patch});
let serial=0;
const command=(s:FixtureServer,body:Record<string,unknown>):TacticalCommand=>{
 const v=s.view();return {commandId:`t-${++serial}`,encounterId:s.id,expectedRevision:v.revision,actionToken:v.actionToken!,...body} as TacticalCommand;
};
const events:TacticalEvent[]=[];
function server(patch:Partial<FixtureOptions>={}){const s=new FixtureServer(options(patch),++serial);s.subscribe(p=>events.push(...p.events));return s;}

beforeEach(()=>{vi.useFakeTimers({now:1_000_000});events.length=0;});
afterEach(()=>{vi.useRealTimers();});

describe('countdown presentation',()=>{
 const view=(patch:Partial<TacticalEncounterView['control']>,phase:TacticalEncounterView['phase']='awaiting')=>({phase,
  control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:100_000,warningMs:10_000,serverNowMs:0,autoReason:null,canRequestAuto:true,canRequestManual:false,...patch}} as Pick<TacticalEncounterView,'phase'|'control'>);
 it('shows only inside the final warning window of a manual wait',()=>{
  const sync=syncClock(0,0);
  expect(countdownState(view({}),sync,80_000).visible).toBe(false);
  const near=countdownState(view({}),sync,91_200);
  expect(near).toMatchObject({visible:true,seconds:9,label:'将在9秒后托管',expired:false});
 });
 it('is hidden while resolving, during enemy phase and under auto',()=>{
  const sync=syncClock(0,0);
  expect(countdownState(view({phase:'resolving',deadlineAtMs:null},'resolving'),sync,95_000).visible).toBe(false);
  expect(countdownState(view({phase:'enemy',deadlineAtMs:null},'enemy'),sync,95_000).visible).toBe(false);
  expect(countdownState(view({mode:'auto',deadlineAtMs:null}),sync,95_000).visible).toBe(false);
 });
 it('at zero waits for the server instead of switching locally',()=>{
  const state=countdownState(view({}),syncClock(0,0),120_000);
  expect(state).toMatchObject({visible:true,expired:true,label:'等待服务端确认托管…'});
 });
 it('uses the server time base, not the local clock',()=>{
  // 服务端比本机快 4 秒：本机 86_000 时，服务端是 90_000，剩 10 秒。
  const state=countdownState(view({}),syncClock(4_000,0),86_000);
  expect(state).toMatchObject({visible:true,seconds:10});
 });
});

describe('event ledger',()=>{
 it('plays each event id once, in sequence order',()=>{
  const ledger=new EventLedger(),e=(id:string,seq:number)=>({id,seq,actionId:null,atMs:0,kind:'end-activation',unitId:'hero'} as TacticalEvent);
  expect(ledger.accept([e('b',2),e('a',1)]).map(x=>x.id)).toEqual(['a','b']);
  expect(ledger.accept([e('b',2),e('c',3)]).map(x=>x.id)).toEqual(['c']);
 });
});

describe('selection',()=>{
 it('keeps actor, inspected unit and target separate',()=>{
  const s=server(),v=s.view();let sel=initialSelection(v.units[0].cell);
  sel=reduceSelection(sel,{type:'pick-cell',cell:{x:6,y:2}},v);
  expect(sel).toMatchObject({inspectId:'enemy-a',target:null,command:'none'});
  sel=reduceSelection(sel,{type:'choose-ability',abilityId:'fx-basic'},v);
  sel=reduceSelection(sel,{type:'pick-cell',cell:{x:6,y:2}},v);
  expect(sel).toMatchObject({command:'ability',target:{x:6,y:2},previewPending:true});
  s.destroy();
 });
 it('drops stale preview responses and refuses unmigrated skills',()=>{
  const s=server(),v=s.view();let sel=initialSelection(v.units[0].cell);
  sel=reduceSelection(sel,{type:'choose-move'},v);
  sel=reduceSelection(sel,{type:'pick-cell',cell:{x:2,y:3}},v);const old=sel.previewSerial;
  sel=reduceSelection(sel,{type:'pick-cell',cell:{x:1,y:2}},v);
  sel=reduceSelection(sel,{type:'preview-result',serial:old,preview:s.preview({kind:'move',to:{x:2,y:3}})},v);
  expect(sel.preview).toBeNull();
  sel=reduceSelection(sel,{type:'choose-ability',abilityId:'legacy-fireball'},v);
  expect(sel.message).toBe('这个技能尚未迁移到回合制。');
  s.destroy();
 });
});

describe('isolated fixture source',()=>{
 it('previews are read-only and do not renew the wait',()=>{
  const s=server(),before=s.view();
  s.preview({kind:'move',to:{x:2,y:3}});s.preview({kind:'ability',abilityId:'fx-basic',target:{x:6,y:2}});
  const after=s.view();
  expect(after.revision).toBe(before.revision);
  expect(after.control.deadlineAtMs).toBe(before.control.deadlineAtMs);
  s.destroy();
 });
 it('reports blocked, occupied, corner and out-of-budget denials from the shared prototype',()=>{
  const s=server(),code=(x:number,y:number)=>{const p=s.preview({kind:'move',to:{x,y}});return p.ok?'ok':p.denial.code;};
  expect(code(3,3)).toBe('blocked');
  expect(code(6,2)).toBe('occupied');
  expect(code(3,4)).toBe('corner');
  expect(code(5,3)).toBe('out-of-budget');
  expect(code(2,3)).toBe('ok');
  s.destroy();
 });
 it('allows move and skill in either order but never splits one move',()=>{
  const a=server();
  expect(a.submit(command(a,{kind:'move',to:{x:2,y:3}})).accepted).toBe(true);
  vi.advanceTimersByTime(1_000);
  const again=a.preview({kind:'move',to:{x:1,y:3}});
  expect(again.ok?'ok':again.denial.code).toBe('used');
  expect(a.view().budget).toMatchObject({moveUsed:true,mainActionUsed:false});
  a.destroy();
  const b=server();
  // 先出手（目标不在射程 → 拒绝且不消耗），再移动。
  const far=b.submit(command(b,{kind:'ability',abilityId:'fx-basic',target:{x:6,y:2}}));
  expect(far.accepted).toBe(false);expect(b.view().budget.mainActionUsed).toBe(false);
  expect(b.submit(command(b,{kind:'move',to:{x:2,y:2}})).accepted).toBe(true);
  b.destroy();
 });
 it('returns the same receipt for a repeated command id',()=>{
  const s=server(),cmd=command(s,{kind:'move',to:{x:2,y:3}});
  const first=s.submit(cmd),revision=s.view().revision,second=s.submit(cmd);
  expect(second).toBe(first);expect(s.view().revision).toBe(revision);
  s.destroy();
 });
 it('times out to auto once, with a deterministic event id, and does not renew on reload',()=>{
  const s=server({waitMs:15_000,warningMs:10_000}),deadline=s.view().control.deadlineAtMs;
  vi.advanceTimersByTime(14_000);
  expect(s.view().control.deadlineAtMs).toBe(deadline);
  expect(s.view().control.mode).toBe('manual');
  vi.advanceTimersByTime(1_400);
  const timeouts=events.filter(e=>e.kind==='control'&&e.change==='timeout-auto');
  expect(timeouts).toHaveLength(1);expect(timeouts[0].id).toContain(':control:timeout:');
  expect(s.view().control).toMatchObject({mode:'auto',autoReason:'manual-timeout',deadlineAtMs:null});
  s.destroy();
 });
 it('keeps the deadline across a disconnect and reconnect',async()=>{
  const source=new FixtureSource(options({waitMs:30_000}));
  const handle=await source.engage({commandId:'e1',nodeName:'n',groupId:'g'});
  const first=await source.load(handle.encounterId);
  source.setOffline(true);
  await expect(source.load(handle.encounterId)).rejects.toMatchObject({code:'network'});
  vi.advanceTimersByTime(5_000);
  source.setOffline(false);
  const again=await source.load(handle.encounterId);
  expect(again.control.deadlineAtMs).toBe(first.control.deadlineAtMs);
  const rejoin=await source.engage({commandId:'e2',nodeName:'n',groupId:'g'});
  expect(rejoin).toMatchObject({encounterId:handle.encounterId,alreadyActive:true});
  source.destroy();
 });
 it('replays a lost receipt idempotently after retry',async()=>{
  const source=new FixtureSource(options());
  const handle=await source.engage({commandId:'e1',nodeName:'n',groupId:'g'}),v=await source.load(handle.encounterId);
  const cmd:TacticalCommand={commandId:'lost-1',encounterId:v.encounterId,expectedRevision:v.revision,actionToken:v.actionToken!,kind:'move',to:{x:2,y:3}};
  source.dropNextReceipt();
  await expect(source.submit(cmd)).rejects.toMatchObject({code:'network'});
  const receipt=await source.submit(cmd);
  expect(receipt.accepted).toBe(true);
  expect((await source.load(handle.encounterId)).units[0].cell).toEqual({x:2,y:3});
  source.destroy();
 });
 it('pet assists at most once per round and reports the skipped trigger',()=>{
  const s=server();
  for(let round=0;round<6&&!s.view().result;round++){
   if(s.view().phase==='awaiting'&&s.view().control.mode==='manual')s.submit(command(s,{kind:'end-activation'}));
   vi.advanceTimersByTime(8_000);
  }
  const byRound=new Map<string,number>();
  for(const e of events)if(e.kind==='pet-assist'){const r=e.rootActionId.split(':act:')[0];byRound.set(r,(byRound.get(r)??0)+1);}
  const assists=events.filter(e=>e.kind==='pet-assist'),skipped=events.filter(e=>e.kind==='pet-skipped');
  expect(assists.length).toBeGreaterThan(0);
  expect(skipped.some(e=>e.kind==='pet-skipped'&&e.reason.includes('本回合已辅助过'))).toBe(true);
  // 每个敌方回合内，辅助事件之后同回合的第二次触发必须是 skipped。
  const turnStarts=events.filter(e=>e.kind==='turn'&&e.phase==='enemy').map(e=>e.seq);
  for(const start of turnStarts){
   const next=events.find(e=>e.kind==='turn'&&e.phase==='hero'&&e.seq>start)?.seq??Infinity;
   expect(events.filter(e=>e.kind==='pet-assist'&&e.seq>start&&e.seq<next).length).toBeLessThanOrEqual(1);
  }
  s.destroy();
 });
 it('takeover requested during an auto action applies at the boundary without refunding budget',()=>{
  const s=server();
  s.control_({commandId:'auto-1',encounterId:s.id,op:'request-auto'});
  vi.advanceTimersByTime(1_050); // 托管出手：移动（尚在结算）
  expect(s.view().phase).toBe('resolving');
  s.control_({commandId:'manual-1',encounterId:s.id,op:'request-manual'});
  expect(s.view().control.pendingManual).toBe(true);
  vi.advanceTimersByTime(1_500);
  const v=s.view();
  if(v.phase==='awaiting'){
   expect(v.control.mode).toBe('manual');
   expect(v.budget.moveUsed).toBe(true);          // 不补行动
   expect(v.control.deadlineAtMs).not.toBeNull();
  }else expect(v.control.mode).toBe('manual');    // 额度用尽时进入敌方阶段，仍是手动
  expect(events.some(e=>e.kind==='control'&&e.change==='manual-applied')).toBe(true);
  s.destroy();
 });
 it('settles with a result that carries no fixture rewards',()=>{
  const s=server();
  s.control_({commandId:'auto-2',encounterId:s.id,op:'request-auto'});
  for(let i=0;i<120&&!s.view().result;i++)vi.advanceTimersByTime(1_000);
  const r=s.view().result!;
  expect(r).not.toBeNull();expect(r.rewards).toEqual([]);expect(r.nodeCompleted).toBe(r.outcome==='victory');
  expect(s.view().phase).toBe('ended');expect(canCommand(s.view(),{submitting:null})).toBe(false);
  s.destroy();
 });
 it('parses preview URL options with bounded values',()=>{
  expect(fixtureOptionsFromQuery('?scenario=timeout')).toMatchObject({scenario:'timeout',waitMs:15_000,warningMs:10_000});
  expect(fixtureOptionsFromQuery('?wait=60&warn=99&scenario=bogus')).toMatchObject({scenario:'default',waitMs:60_000,warningMs:60_000});
 });
});
