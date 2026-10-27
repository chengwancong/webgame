import {describe,expect,it} from 'vitest';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {ClientMovementDriver} from '../apps/web/src/client-movement-driver.ts';
import {clientMovementContext,clientMovementAvailability,clientMovementPresentation} from '../apps/web/src/client-movement-context.ts';
import {clientMovementTiming} from '../packages/contracts/client-movement.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';

function harness(file:string,className:string,names:string[]){
 const source=ts.createSourceFile(file,readFileSync(new URL('../apps/web/src/'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true),owner=source.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===className) as ts.ClassDeclaration;
 const code=names.map(name=>owner.members.find(m=>m.name?.getText(source)===name)!.getText(source)).join('\n');
 const output=ts.transpileModule('class Harness {'+code+'}\nreturn Harness;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function('clientMovementContext','clientMovementAvailability','clientMovementPresentation','clientMovementTiming','WebSocket','performance',output)(clientMovementContext,clientMovementAvailability,clientMovementPresentation,clientMovementTiming,{OPEN:1},{now:()=>10000});
}
const view={epoch:'test',revision:0,ack:0,owner:'server' as const,position:{x:10,y:10}};
function world(){return new World({...regionById('town'),safe:{x:10,y:10},obstacles:[]},{hp:100,attack:1,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[],[],1);}
describe('client movement stale connection display',()=>{
 it('uses the snapshot rather than zero while a dungeon reconnect resets its driver',()=>{
  const Harness=harness('dungeon-controller.ts','DungeonController',['inputReady','clientMovementFrame']),host=new Harness(),w=world();
  Object.assign(host,{instance:{movement:view,self:{connected:true}},running:true,socket:{readyState:0},clientMove:new ClientMovementDriver(),movementSeenAt:0,deps:{world:()=>w}});
  expect(host.clientMovementFrame(10000)).toMatchObject({position:view.position,active:false});
 });
 it('freezes the local pose after an open socket stops delivering snapshots instead of continuing or pulling back',()=>{
  const Harness=harness('dungeon-controller.ts','DungeonController',['inputReady','clientMovementFrame']),host=new Harness(),w=world(),driver=new ClientMovementDriver();
  driver.sync(view,view.position,0,clientMovementAvailability(w,true));driver.direction({x:1,y:0},0);driver.advance(100,clientMovementContext(w));const last=driver.position;
  Object.assign(host,{instance:{movement:view,self:{connected:true}},running:true,socket:{readyState:1},clientMove:driver,movementSeenAt:0,deps:{world:()=>w}});
  expect(host.inputReady).toBe(false);expect(host.clientMovementFrame(10000)).toMatchObject({position:last,active:false});
  expect(host.clientMovementFrame(10016).position).toEqual(last);
 });
 it('keeps field reconnects at the known snapshot until movement state is ready',()=>{
  const Harness=harness('field-activities.ts','FieldActivities',['clientMovementFrame']),host=new Harness(),w=world();
  Object.assign(host,{current:{movement:view},running:true,motionConnected:false,movementSeenAt:0,clientMove:new ClientMovementDriver(),deps:{world:()=>w}});
  expect(host.clientMovementFrame(10000)).toMatchObject({position:view.position,active:false});
 });
});
