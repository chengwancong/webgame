import {afterEach,describe,expect,it,vi} from 'vitest';
// The controller constructor and its rendering tree are intentionally not created.
// This mock only prevents browser-only actor renderers from entering the Node test graph.
vi.mock('../apps/web/src/tactical/actors.ts',()=>({TacticalActors:class {}}));

import {TacticalBoardController} from '../apps/web/src/tactical/controller.ts';
import {EventLedger} from '../apps/web/src/tactical/countdown.ts';
import {initialSelection} from '../apps/web/src/tactical/selection.ts';
import type {SelectionAction,SelectionState} from '../apps/web/src/tactical/selection.ts';
import type {TacticalCell,TacticalCommand,TacticalControlCommand,TacticalEncounterView,
 TacticalPreview,TacticalPreviewRequest,TacticalReceipt} from '../apps/web/src/tactical/contract.ts';

function encounter():TacticalEncounterView{
 return {
  source:'sandbox',encounterId:'command-guards',revision:11,ruleVersion:'test',protocolVersion:'test',
  node:{name:'测试棋盘',objective:'击败守卫',enemyGroup:'守卫'},round:2,phase:'awaiting',actorId:'hero',actionToken:'turn-11',
  board:{width:4,height:4,cells:[]},
  units:[
   {id:'hero',side:'hero',name:'行者',cell:{x:1,y:1},footprint:1,alive:true,hp:{current:80,max:100},shield:0,
    resource:null,statuses:[],art:{kind:'hero-native',assetId:'hero'},tier:'normal'},
   {id:'enemy',side:'enemy',name:'守卫',cell:{x:3,y:1},footprint:1,alive:true,hp:{current:50,max:50},shield:0,
    resource:null,statuses:[],art:{kind:'starsea-atlas',assetId:'guard'},tier:'normal'},
  ],
  budget:{moveUsed:false,mainActionUsed:false,ended:false,moveSteps:2},
  abilities:[{id:'sweep',slot:0,category:'skill',label:'横扫',description:'选择目标',iconSrc:null,
   migration:'supported',available:true,reason:null,cost:null,cooldown:null,rangeText:null}],
  legalMoves:[{cell:{x:2,y:1},cost:1,path:[{x:1,y:1},{x:2,y:1}]}],
  pet:null,intents:[],unsupported:[],result:null,
  control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:100_000,warningMs:10_000,serverNowMs:0,
   autoReason:null,canRequestAuto:true,canRequestManual:false},
 };
}

function source(){
 return {
  preview:vi.fn(async(_encounterId:string,request:TacticalPreviewRequest):Promise<TacticalPreview>=>request.kind==='move'
   ?{ok:true,kind:'move',destination:{...request.to},path:[{x:1,y:1},{...request.to}],steps:1,notes:[]}
   :{ok:true,kind:'ability',abilityId:request.abilityId,target:{...request.target},rangeCells:[],affectedCells:[],targets:[],known:[],uncertain:[],notes:[]}),
  submit:vi.fn(async(command:TacticalCommand):Promise<TacticalReceipt>=>({commandId:command.commandId,accepted:true,revision:12,events:[]})),
  control:vi.fn(async(command:TacticalControlCommand):Promise<TacticalReceipt>=>({commandId:command.commandId,accepted:true,revision:12,events:[]})),
 };
}

/** Exposes private methods only to exercise their real prototype implementation. */
type TestController={
 view:TacticalEncounterView;sel:SelectionState;connection:'online'|'offline'|'syncing';
 source:ReturnType<typeof source>;pendingControl:TacticalControlCommand|null;endConfirm:boolean;dead:boolean;
 ledger:EventLedger;render:ReturnType<typeof vi.fn>;play:ReturnType<typeof vi.fn>;
 confirm():void;endActivation(force:boolean):void;retreat():void;
 sendControl(op:'request-auto'|'request-manual'):Promise<void>;
 pick(cell:TacticalCell):void;requestPreview():Promise<void>;submit(command:TacticalCommand):Promise<void>;
 dispatch(action:SelectionAction):void;
};

function host(connection:TestController['connection']='online'):TestController{
 const controller=Object.create(TacticalBoardController.prototype) as TestController;
 return Object.assign(controller,{view:encounter(),sel:initialSelection({x:1,y:1}),connection,
  source:source(),pendingControl:null,endConfirm:false,dead:false,ledger:new EventLedger(),render:vi.fn(),play:vi.fn()});
}
function selectPreview(controller:TestController,kind:'move'|'ability'='move'){
 controller.sel={...initialSelection({x:1,y:1}),command:kind,abilityId:kind==='ability'?'sweep':null,
  target:kind==='move'?{x:2,y:1}:{x:3,y:1},
  preview:kind==='move'
   ?{ok:true,kind:'move',destination:{x:2,y:1},path:[{x:1,y:1},{x:2,y:1}],steps:1,notes:[]}
   :{ok:true,kind:'ability',abilityId:'sweep',target:{x:3,y:1},rangeCells:[],affectedCells:[],targets:['enemy'],known:[],uncertain:[],notes:[]},
 };
}
afterEach(()=>vi.restoreAllMocks());

describe('actual tactical controller command guards',()=>{
 it.each(['offline','syncing'] as const)('does not submit, preview or change control while %s',async connection=>{
  const controller=host(connection);selectPreview(controller);
  const before=structuredClone(controller.sel),submit=vi.spyOn(controller,'submit'),preview=vi.spyOn(controller,'requestPreview');
  controller.confirm();
  controller.endActivation(false);
  controller.endActivation(true);
  controller.retreat();
  await controller.sendControl('request-auto');
  controller.pick({x:2,y:1});
  expect(submit).not.toHaveBeenCalled();expect(preview).not.toHaveBeenCalled();
  expect(controller.source.submit).not.toHaveBeenCalled();expect(controller.source.preview).not.toHaveBeenCalled();
  expect(controller.source.control).not.toHaveBeenCalled();
  expect(controller.pendingControl).toBeNull();expect(controller.endConfirm).toBe(false);
  expect(controller.sel).toEqual(before);
 });

 it.each(['offline','syncing'] as const)('also guards a previously queued preview directly while %s',async connection=>{
  const controller=host(connection);
  controller.sel={...controller.sel,command:'move',target:{x:2,y:1},previewPending:true,previewSerial:5};
  const before=structuredClone(controller.sel);
  await controller.requestPreview();
  expect(controller.source.preview).not.toHaveBeenCalled();
  expect(controller.sel).toEqual(before);
 });

 it.each(['move','ability'] as const)('online confirmation submits the approved %s preview through the real command path',async kind=>{
  const controller=host();selectPreview(controller,kind);
  const before=structuredClone(controller.view);
  controller.confirm();
  await Promise.resolve();
  expect(controller.source.submit).toHaveBeenCalledTimes(1);
  expect(controller.source.submit).toHaveBeenCalledWith(expect.objectContaining({
   commandId:expect.any(String),encounterId:'command-guards',expectedRevision:11,actionToken:'turn-11',kind,
   ...(kind==='move'?{to:{x:2,y:1}}:{abilityId:'sweep',target:{x:3,y:1}}),
  }));
  expect(controller.sel.submitting).toBeNull();
  expect(controller.view).toEqual(before);
 });

 it('keeps end confirmation for remaining actions and submits only after explicit confirmation',async()=>{
  const controller=host();
  controller.endActivation(false);
  expect(controller.endConfirm).toBe(true);
  expect(controller.source.submit).not.toHaveBeenCalled();
  controller.endActivation(true);
  await Promise.resolve();
  expect(controller.endConfirm).toBe(false);
  expect(controller.source.submit).toHaveBeenCalledOnce();
  expect(controller.source.submit).toHaveBeenCalledWith(expect.objectContaining({kind:'end-activation',actionToken:'turn-11'}));
 });

 it('online retreat still passes through the existing authoritative submit path',async()=>{
  const controller=host();controller.sel.confirmRetreat=true;
  controller.retreat();
  await Promise.resolve();
  expect(controller.source.submit).toHaveBeenCalledOnce();
  expect(controller.source.submit).toHaveBeenCalledWith(expect.objectContaining({kind:'retreat',encounterId:'command-guards',expectedRevision:11}));
  expect(controller.sel.confirmRetreat).toBe(false);
 });

 it.each([
  {op:'request-auto' as const,flag:'canRequestAuto' as const,mode:'manual' as const},
  {op:'request-manual' as const,flag:'canRequestManual' as const,mode:'auto' as const},
 ])('uses the source permission flag for $op',async({op,flag,mode})=>{
  const controller=host();controller.view.control.mode=mode;controller.view.control[flag]=false;
  await controller.sendControl(op);
  expect(controller.source.control).not.toHaveBeenCalled();expect(controller.pendingControl).toBeNull();
  controller.view.control[flag]=true;
  await controller.sendControl(op);
  expect(controller.source.control).toHaveBeenCalledOnce();
  expect(controller.source.control).toHaveBeenCalledWith(expect.objectContaining({encounterId:'command-guards',op,commandId:expect.any(String)}));
  expect(controller.pendingControl).toBeNull();
 });

 it('does not send a second control request while the first one is pending',async()=>{
  const controller=host();
  const pending={commandId:'existing-control',encounterId:controller.view.encounterId,op:'request-auto' as const};
  controller.pendingControl=pending;
  await controller.sendControl('request-auto');
  expect(controller.source.control).not.toHaveBeenCalled();expect(controller.pendingControl).toBe(pending);
 });

 it('online picking previews once without spending an action, then confirms the same approved target',async()=>{
  const controller=host(),before=structuredClone(controller.view),preview=vi.spyOn(controller,'requestPreview');
  controller.pick({x:2,y:1});
  await Promise.resolve();
  expect(preview).toHaveBeenCalledOnce();
  expect(controller.source.preview).toHaveBeenCalledWith('command-guards',{kind:'move',to:{x:2,y:1}});
  expect(controller.source.submit).not.toHaveBeenCalled();
  expect(controller.sel.preview).toMatchObject({ok:true,kind:'move',destination:{x:2,y:1}});
  expect(controller.view).toEqual(before);
  controller.pick({x:2,y:1});
  await Promise.resolve();
  expect(preview).toHaveBeenCalledOnce();
  expect(controller.source.submit).toHaveBeenCalledOnce();
  expect(controller.source.submit).toHaveBeenCalledWith(expect.objectContaining({kind:'move',to:{x:2,y:1}}));
 });

 it('does not double-submit confirm/end/retreat during an in-flight command',()=>{
  const controller=host();selectPreview(controller);
  controller.sel.submitting={commandId:'existing-command',encounterId:controller.view.encounterId,expectedRevision:11,
   actionToken:'turn-11',kind:'end-activation'};
  controller.confirm();controller.endActivation(true);controller.retreat();
  expect(controller.source.submit).not.toHaveBeenCalled();
 });
});
