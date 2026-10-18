import {describe,it,expect} from 'vitest';
import {worldTables,loadWorldTables} from '../packages/content/world-tables.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {conditionMet} from '../packages/rules/quest-conditions.ts';
import {planeGateState,resolvePlaneGates,discoverPlaneGates,interactPlaneGate,assertPlaneGateEnterable,recordPlaneClear,planeProgress,PlaneGateError} from '../packages/rules/plane-gates.ts';
import {resolveWorldPhase} from '../packages/rules/world-phase.ts';
import source from '../config/json/world.json';
import {worldSchemas,type WorldTables} from '../packages/contracts/open-world.ts';
type Gate=WorldTables['planeGates'][number];
const base=worldTables.planeGates[0];
const char=(level=1)=>({level,starsea:newStarseaState(),world:undefined as any});
const code=(fn:()=>unknown)=>{try{fn();}catch(e){if(e instanceof PlaneGateError)return e.code;throw e;}return 'ok';};
/** A level condition that is false at 1 and true at 40 (checked, not assumed). */
const levelGate=['island:ss-map-dragon','island:ss-map-rift','island:ss-map-frost'].find(id=>!conditionMet(char(1),id)&&conditionMet(char(40),id))!;
function tables(...gates:Partial<Gate>[]):WorldTables{const t=structuredClone(worldTables);t.planeGates=gates.map((g,i)=>({...base,id:'test-gate-'+i,_row:900+i,...g}) as Gate);return t;}

describe('plane gates (plane-world F1 / F8)',()=>{
 it('ships the wind seed gates and exposes them through the world phase view',()=>{
  expect(worldTables.planeGates.filter(g=>g.region==='ss-map-wind'&&g.kind==='nest').map(g=>g.style).sort()).toEqual(['cave','crypt','maze']);
  expect(levelGate).toBeTruthy();
  const view=resolveWorldPhase(char(),worldTables,0);expect(view.planeGates.length).toBe(worldTables.planeGates.length);expect(view.planeGates.every(g=>g.state==='hidden'&&g.clears===0)).toBe(true);
 });
 it('proximity discovery only within discoverRadius, persists once and survives a reload',()=>{
  const t=tables({}),c=char();
  expect(discoverPlaneGates(c,base.region,{x:base.x+base.discoverRadius+.5,y:base.y},10,t)).toEqual([]);expect(c.world).toBeUndefined();
  expect(discoverPlaneGates(c,base.region,{x:base.x+base.discoverRadius-.5,y:base.y},10,t)).toEqual(['test-gate-0']);
  expect(discoverPlaneGates(c,base.region,{x:base.x,y:base.y},20,t)).toEqual([]);
  expect(planeProgress(JSON.parse(JSON.stringify(c)))['test-gate-0']).toMatchObject({found:true,foundAt:10,clears:0});
  expect(discoverPlaneGates(char(),'ss-map-mist',{x:base.x,y:base.y},10,t)).toEqual([]);
  expect(planeGateState(c,t.planeGates[0],30).state).toBe('open');
 });
 it('interact gates ignore proximity and need the observer within interactRadius',()=>{
  const t=tables({discover:'interact'}),c=char();
  expect(discoverPlaneGates(c,base.region,{x:base.x,y:base.y},1,t)).toEqual([]);
  expect(code(()=>interactPlaneGate(c,'test-gate-0',base.region,{x:base.x+base.interactRadius+.1,y:base.y},1,t))).toBe('PLANE_GATE_FAR');
  expect(code(()=>interactPlaneGate(c,'missing',base.region,{x:base.x,y:base.y},1,t))).toBe('PLANE_GATE');
  expect(interactPlaneGate(c,'test-gate-0',base.region,{x:base.x,y:base.y},1,t).fresh).toBe(true);
  expect(interactPlaneGate(c,'test-gate-0',base.region,{x:base.x,y:base.y},2,t).fresh).toBe(false);
  expect(planeGateState(c,t.planeGates[0],3).state).toBe('open');
 });
 it('fact gates light up from the world-fact condition, wherever the character stands',()=>{
  const t=tables({discover:'fact',fact:levelGate});
  expect(planeGateState(char(1),t.planeGates[0],0).state).toBe('hidden');
  expect(code(()=>interactPlaneGate(char(1),'test-gate-0',base.region,{x:base.x,y:base.y},1,t))).toBe('PLANE_GATE_SEALED');
  const high=char(40);expect(planeGateState(high,t.planeGates[0],0).state).toBe('open');
  expect(discoverPlaneGates(high,base.region,{x:Infinity,y:Infinity},5,t)).toEqual(['test-gate-0']);
 });
 it('states: locked by requires, cooldown after a clear, cleared when not repeatable; entry validation follows the state',()=>{
  const t=tables({requires:levelGate},{repeatable:true,cooldownSeconds:600,x:base.x,y:base.y},{repeatable:false}),[locked,rift,vault]=t.planeGates;
  const c=char(1),at={x:base.x,y:base.y};
  expect(code(()=>assertPlaneGateEnterable(c,rift.id,base.region,at,0,t))).toBe('PLANE_GATE_HIDDEN');
  for(const g of t.planeGates)interactPlaneGate(c,g.id,base.region,at,0,t);
  expect(planeGateState(c,locked,0).state).toBe('locked');expect(code(()=>assertPlaneGateEnterable(c,locked.id,base.region,at,0,t))).toBe('PLANE_GATE_LOCKED');
  expect(planeGateState({...c,level:40},locked,0).state).toBe('open');
  expect(code(()=>assertPlaneGateEnterable(c,rift.id,base.region,{x:at.x+9,y:at.y},0,t))).toBe('PLANE_GATE_FAR');
  expect(assertPlaneGateEnterable(c,rift.id,base.region,at,0,t)).toBe(rift);
  recordPlaneClear(c,rift,1000,t);expect(planeGateState(c,rift,1000+599_000)).toEqual({id:rift.id,state:'cooldown',clears:1,cooldownUntil:601_000});
  expect(code(()=>assertPlaneGateEnterable(c,rift.id,base.region,at,2000,t))).toBe('PLANE_GATE_COOLDOWN');
  expect(planeGateState(c,rift,601_000).state).toBe('open');recordPlaneClear(c,rift,700_000,t);expect(planeProgress(c)[rift.id]).toMatchObject({clears:2,firstClearAt:1000});
  recordPlaneClear(c,vault,5,t);expect(planeGateState(c,vault,10**12).state).toBe('cleared');expect(code(()=>assertPlaneGateEnterable(c,vault.id,base.region,at,10,t))).toBe('PLANE_GATE_CLEARED');
  expect(resolvePlaneGates(c,0,t).map(g=>g.state)).toEqual(['locked','cooldown','cleared']);
 });
 it('phase-hidden gates are neither listed nor discoverable',()=>{
  const t=tables({when:levelGate}),c=char(1);
  expect(resolvePlaneGates(c,0,t)).toEqual([]);expect(discoverPlaneGates(c,base.region,{x:base.x,y:base.y},0,t)).toEqual([]);
  expect(code(()=>interactPlaneGate(c,'test-gate-0',base.region,{x:base.x,y:base.y},0,t))).toBe('PLANE_GATE');
 });
 it('the table rejects inconsistent rows',()=>{
  const bad=(g:Partial<Gate>)=>expect(worldSchemas.planeGates.safeParse({...base,...g}).success).toBe(false);
  bad({discover:'fact'});bad({fact:'x'});bad({interactRadius:20,discoverRadius:10});bad({returnX:base.x+30});bad({kind:'dungeon' as any});
  expect(worldSchemas.planeGates.safeParse({...base,kind:'link',returnX:base.x+200}).success).toBe(true);
  const raw=()=>structuredClone(source) as any;expect(()=>loadWorldTables(raw())).not.toThrow();
  const dup=raw();dup.planeGates.push({...dup.planeGates[0]});expect(()=>loadWorldTables(dup)).toThrow(/重复 ID/);
  const zone=raw();zone.planeGates[0].zone='ow-mist-z1';expect(()=>loadWorldTables(zone)).toThrow(/分区引用/);
 });
});
