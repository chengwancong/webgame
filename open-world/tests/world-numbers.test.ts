import {describe,it,expect} from 'vitest';
import {CombatNumbers,numberKind,numberMotion,numberStyle,numberText} from '../apps/web/src/world-numbers.ts';
import type {CombatEvent} from '../packages/simulation/index.ts';
const event=(patch:Partial<CombatEvent>={}):CombatEvent=>({type:'hit_resolved',id:'target',position:{x:0,y:0},amount:20,tick:10,category:'direct',damageType:'physical',...patch});
const point={x:100,y:100};
describe('world combat numbers',()=>{
 it('classifies authoritative facts including green hero heal and zero health damage absorption',()=>{
  expect(numberKind(event())).toBe('hit');expect(numberKind(event({crit:true}))).toBe('crit');expect(numberKind(event(),new Set(['10:target']))).toBe('kill');
  expect(numberKind(event({category:'periodic'}))).toBe('minor');expect(numberKind(event({category:'periodic'}),new Set(['10:target']))).toBe('kill');expect(numberKind(event({id:'hero'}))).toBe('taken');expect(numberKind(event({id:'hero',amount:0}))).toBeUndefined();
  const model=new CombatNumbers(),heal=model.spawn('heal',event({id:'hero',type:'healed'}),point);expect(numberStyle(heal).color).toBe('#9fe39a');expect(numberText(heal)).toBe('+20');
  expect(numberKind(event({type:'shielded',id:'hero',shieldPhase:'absorbed',amount:50}))).toBe('absorb');expect(numberKind(event({type:'shielded'}))).toBeUndefined();
  expect(numberKind(event({type:'status_changed',skill:'dodge'}))).toBe('miss');expect(numberKind(event({type:'missed'}))).toBe('miss');
 });
 it('starts a new target number after the merge window and has deterministic layout',()=>{
  const model=new CombatNumbers(),first=model.spawn('hit',event({tick:10}),point);expect(model.spawn('hit',event({tick:19}),point)).toBe(first);const next=model.spawn('hit',event({tick:29}),point);expect(next).not.toBe(first);expect(next.stack).toBe(0);expect(next.y).toBe(84);
  const replay=new CombatNumbers(),a=new CombatNumbers();expect(replay.spawn('hit',event(),point).x).toBe(a.spawn('hit',event(),point).x);
 });
 it('merges target damage for 0.3 seconds and promotes critical and killing hits',()=>{
  const model=new CombatNumbers(),first=model.spawn('minor',event({category:'periodic',damageType:'fire'}),point),second=model.spawn('minor',event({category:'periodic',damageType:'fire',tick:19,amount:15}),point);
  expect(second).toBe(first);expect(second.amount).toBe(35);expect(second.born).toBe(19);expect(numberMotion(second,21).scale).toBeCloseTo(1.15);
  const crit=model.spawn('crit',event({crit:true,damageType:'poison',tick:21}),point);expect(crit).toBe(first);expect(numberStyle(crit).star).toBe(true);const kill=model.spawn('kill',event({tick:22}),point);expect(kill).toBe(first);expect(kill.kind).toBe('kill');expect(kill.baseKind).toBe('crit');model.spawn('minor',event({id:'other',tick:21}),point);model.spawn('minor',event({tick:32}),point);expect(model.entries).toHaveLength(3);
 });
 it('keeps shield gain and absorption labels apart after their rise curves advance',()=>{const model=new CombatNumbers(),gain=model.spawn('shieldGain',event({id:'hero',tick:3}),point),absorb=model.spawn('absorb',event({id:'hero',tick:10}),point);expect(numberMotion(gain,11).y-numberMotion(absorb,11).y).toBeGreaterThan(20);});
 it('caps nodes at 30 and evicts low priority feedback first',()=>{
  const model=new CombatNumbers(),minor=model.spawn('minor',event({id:'dot'}),point),status=model.spawn('status',event({id:'label'}),point);
  for(let i=0;i<29;i++)model.spawn('crit',event({id:'enemy'+i}),point);expect(model.entries).toHaveLength(30);expect(model.entries).not.toContain(minor);
  model.spawn('kill',event(),point);expect(model.entries).not.toContain(status);expect(model.entries).toHaveLength(30);
  for(let i=0;i<40;i++)model.spawn('heal',event({tick:12}),point);expect(model.entries).toHaveLength(30);
 });
 it('holds opacity before fading; reduced motion preserves layout without scale or displacement',()=>{
  const model=new CombatNumbers();for(const kind of ['hit','crit','kill','minor','taken','heal','resource','absorb','shieldGain','miss','status'] as const){const n=model.spawn(kind,event(),point);expect(numberMotion(n,11,true)).toMatchObject({x:n.x,y:n.y,scale:1,alpha:1});expect(numberMotion(n,20,true).scale).toBe(1);}
  const hit=new CombatNumbers().spawn('hit',event(),point);expect(numberMotion(hit,28).alpha).toBe(1);expect(numberMotion(hit,38).alpha).toBeLessThan(1);expect(numberMotion(hit,40).expired).toBe(true);
  const kill=model.spawn('kill',event({crit:true}),point);expect(numberStyle(kill)).toMatchObject({star:true,color:'#ffd36b',size:34.5});model.reset();expect(model.entries).toHaveLength(0);
 });
});

it("does not label consumed status stacks as guardian charges",()=>{expect(numberKind(event({type:"status_changed",change:"consumed",status:"slow"}))).toBeUndefined();expect(numberKind(event({type:"status_changed",change:"consumed",status:"burn"}))).toBeUndefined();expect(numberKind(event({type:"status_changed",change:"consumed",status:"guardian"}))).toBe("status");});
