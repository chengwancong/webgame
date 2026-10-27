import {describe,expect,it} from 'vitest';
import type {ClientMovementReport} from '../packages/contracts/client-movement.ts';
import {fieldActivityInputSchema} from '../packages/contracts/field-activities.ts';
import {acceptClientMovement,newClientMovement} from '../packages/simulation/client-movement.ts';
import {World} from '../packages/simulation/index.ts';
import type {Region} from '../packages/content/index.ts';
import {fieldActivityView,type FieldActivity} from '../apps/api/src/field-activities.ts';

const region:Region={id:'client-movement-server-test',name:'移动',subtitle:'',theme:'meadow',width:40,height:40,safe:{x:5,y:5},portal:{x:3,y:3},landmarks:[],obstacles:[],spawns:[],boss:false,auto:false};
const report=(seq:number,position={x:5.6,y:5},extra:Partial<ClientMovementReport>={}):ClientMovementReport=>({epoch:'epoch-1',revision:0,seq,position,direction:{x:1,y:0},active:true,...extra});
const world=()=>{const w=new World(region,{hp:100,attack:10,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[],[],1);w.setMode('manual');w.configureClientMovement('epoch-1');return w;};

describe('client movement server acceptance',()=>{
 it('accepts a normal report without a correction and keeps the latest position in the view',()=>{
  const w=world();w.tick=30;expect(w.receiveClientMovement(report(1))).toBe(true);
  expect(w.hero.position).toEqual({x:5.6,y:5});expect(w.clientMovementView()).toMatchObject({epoch:'epoch-1',revision:0,ack:1,owner:'client',position:{x:5.6,y:5}});
  w.step();expect(w.hero.position.x).toBeGreaterThan(5.6);expect(w.clientMovementView()?.revision).toBe(0);
  expect(w.hero.hp).toBe(100);expect(w.hero.mana).toBe(100);expect(w.kills).toEqual([]);
 });
 it('ignores duplicate sequence, old epoch and old correction revision without changing the accepted position',()=>{
  const w=world();w.tick=30;w.receiveClientMovement(report(2));
  for(const r of [report(1,{x:8,y:5}),report(3,{x:8,y:5},{epoch:'old'}),report(3,{x:8,y:5},{revision:2})])expect(w.receiveClientMovement(r)).toBe(false);
  expect(w.hero.position).toEqual({x:5.6,y:5});expect(w.clientMovementView()?.ack).toBe(2);
 });
 it('release acknowledges the final position and hands movement back to the server without a correction revision',()=>{
  const w=world();w.tick=30;w.receiveClientMovement(report(1));w.tick=60;
  expect(w.receiveClientMovement(report(2,{x:6,y:5},{active:false,release:true,direction:{x:0,y:0}}))).toBe(true);
  expect(w.clientMovementView()).toMatchObject({owner:'server',revision:0,ack:2,position:{x:6,y:5},reason:'released'});
  const before={...w.hero.position};w.step();expect(w.hero.position).toEqual(before);
 });
 it('rejects out-of-map coordinates and controlled movement with explicit revision corrections',()=>{
  const w=world();expect(w.receiveClientMovement(report(1,{x:200,y:5}))).toBe(false);
  expect(w.clientMovementView()).toMatchObject({revision:1,ack:1,owner:'server',reason:'invalid-position',position:{x:5,y:5}});
  w.applyStatus(w.playerId,{kind:'root',duration:120,strength:1,scope:'self',cleanse:true});
  expect(w.receiveClientMovement(report(2,{x:5.2,y:5},{revision:1}))).toBe(false);
  expect(w.clientMovementView()).toMatchObject({revision:2,ack:2,reason:'controlled',position:{x:5,y:5}});
 });
 it('checks a bounded trail only on a sampled report, catching a path that crossed a wall',()=>{
  const map={...region,obstacles:[{x:9,y:2,w:1,h:20}]},state=newClientMovement('epoch-1',{x:5,y:5},0);let position={x:5,y:5};
  for(let i=1;i<=15;i++){const r=acceptClientMovement(state,report(i,{x:5+i*.4,y:5}),position,i*30,6,map,.35,false);expect(r.accepted).toBe(true);expect(r.corrected).toBe(false);position=r.position;}
  const sampled=acceptClientMovement(state,report(16,{x:11.4,y:5}),position,480,6,map,.35,false);
  expect(sampled.corrected).toBe(true);expect(sampled.accepted).toBe(false);expect(sampled.position).toEqual({x:5,y:5});expect(state.trail).toHaveLength(1);
 });
 it('sampled cumulative distance catches repeated small overspeed rather than granting tolerance per report',()=>{
  const state=newClientMovement('epoch-1',{x:5,y:5},0);let position={x:5,y:5};
  for(let i=1;i<=15;i++){const r=acceptClientMovement(state,report(i,{x:5+i,y:5}),position,i,6,region,.35,false);expect(r.accepted).toBe(true);position=r.position;}
  expect(acceptClientMovement(state,report(16,{x:21,y:5}),position,16,6,region,.35,false)).toMatchObject({accepted:false,corrected:true,position:{x:5,y:5}});
 });
 it('checkpoint restore preserves ownership and rejects an old report after a reconnect epoch reset',()=>{
  const w=world();w.tick=30;w.receiveClientMovement(report(4));const restored=World.restore(w.exportCheckpoint());
  expect(restored.clientMovementView()).toEqual(w.clientMovementView());restored.configureClientMovement('epoch-2');
  expect(restored.receiveClientMovement(report(5))).toBe(false);expect(restored.clientMovementView()).toMatchObject({epoch:'epoch-2',ack:0,revision:0,owner:'server'});
 });
 it('explicit reconfiguration clears a pending legacy walking target without resetting health or cooldowns',()=>{
  const w=world();w.hero.hp=73;w.cooldowns.example=120;w.go({x:10,y:5});w.configureClientMovement('epoch-2');
  const position={...w.hero.position};w.step();expect(w.hero.position).toEqual(position);expect(w.hero.hp).toBe(73);expect(w.cooldowns.example).toBe(120);
 });
 it('a forced authoritative position change cannot be overwritten by a stale client report',()=>{
  const w=world();w.tick=30;w.receiveClientMovement(report(1));w.hero.position={x:12,y:10};
  expect(w.receiveClientMovement(report(2,{x:6,y:5}))).toBe(false);
  expect(w.clientMovementView()).toMatchObject({revision:1,owner:'server',reason:'forced-move',position:{x:12,y:10}});
 });
 it('expires a silent ownership lease while leaving battle time running',()=>{
  const w=world();w.receiveClientMovement(report(1,{x:5,y:5},{direction:{x:0,y:0}}));w.step();expect(w.hero.action).toBe('idle');for(let i=1;i<70;i++)w.step();
  expect(w.tick).toBe(70);expect(w.clientMovementView()).toMatchObject({owner:'server',revision:1,reason:'expired'});
 });
 it('keeps each multiplayer actor ownership separate',()=>{
  const w=world();w.addPlayer('player-a',w.stats,[]);w.addPlayer('player-b',w.stats,[]);
  w.forPlayer('player-a',()=>{w.configureClientMovement('a');w.receiveClientMovement(report(1,{x:7,y:5},{epoch:'a'}));});
  w.forPlayer('player-b',()=>w.configureClientMovement('b'));
  expect(w.clientMovementView('player-a')).toMatchObject({epoch:'a',ack:1,owner:'client'});expect(w.clientMovementView('player-b')).toMatchObject({epoch:'b',ack:0,owner:'server'});
 });
 it('returns movement acknowledgement and corrected position even when the HTTP view omits battle',()=>{
  const w=world();w.tick=30;w.receiveClientMovement(report(1));const data={instance:'field-instance',target:'rare',region:region.id,kind:'rare',name:'样例',status:'running',startedAt:0,cooldownUntil:0,attempt:1,definition:{},level:1,position:{x:5,y:5},waves:1,waveCount:1,tick:30,seed:1,reason:'',settled:false,lastInputAt:0,renderEvents:[],loot:{},battle:w.exportCheckpoint()} as unknown as FieldActivity;
  const view=fieldActivityView(data,1000,false);expect(view.battle).toBeUndefined();expect(view.movement).toMatchObject({ack:1,owner:'client',position:{x:5.6,y:5}});
 });
 it('does not combine a reset handshake with movement or gameplay input',()=>{
  const base={lease_id:'00000000-0000-4000-8000-000000000001',instance:'00000000-0000-4000-8000-000000000002',clientMovementReset:true};
  expect(fieldActivityInputSchema.safeParse(base).success).toBe(true);
  expect(fieldActivityInputSchema.safeParse({...base,clientMovement:report(1)}).success).toBe(false);expect(fieldActivityInputSchema.safeParse({...base,skill:'slash'}).success).toBe(false);
 });
});
