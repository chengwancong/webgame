import {describe,it,expect} from 'vitest';
import {ShieldFeedback,ShieldBarTracker} from '../apps/web/src/shield-feedback.ts';
import type {CombatEvent} from '../packages/simulation/index.ts';
const shield=(tick:number,patch:Partial<CombatEvent>={}):CombatEvent=>({type:'shielded',id:'hero',tick,position:{x:0,y:0},amount:100,shieldPhase:'applied',shieldRemaining:100,skill:'ward',...patch});
describe('shield presentation transitions',()=>{
 it('animates application before idle, remembers authoritative maximum and attack source',()=>{
  const s=new ShieldFeedback();s.consume(100,1,[shield(1)]);expect(s.phase).toBe('appear');expect(s.visual(100,1)).toMatchObject({alpha:0,scale:expect.closeTo(.6)});expect(s.visual(100,9).phase).toBe('idle');
  s.consume(75,10,[shield(10,{shieldPhase:'absorbed',shieldRemaining:75,amount:25,sourceId:'left'})]);expect(s.phase).toBe('hit');expect(s.max).toBe(100);expect(s.sourceId).toBe('left');expect(s.visual(75,12).scale).toBeCloseTo(1.06);expect(s.visual(75,18).phase).toBe('idle');
 });
 it('breaks on absorption that exhausts shield, including a fully absorbed zero-health hit',()=>{
  const s=new ShieldFeedback();s.consume(50,0,[]);s.visual(50,8);const result=s.consume(0,10,[shield(10,{shieldPhase:'absorbed',amount:50,shieldRemaining:0}),{type:'hit_resolved',id:'hero',tick:10,position:{x:0,y:0},amount:0}]);expect(result.broke).toBe(true);expect(s.phase).toBe('break');expect(s.hitAt).toBe(10);expect(s.visual(0,11).width).toBe(6);expect(s.visual(0,26).phase).toBe('none');
 });
 it('silently expires without an absorption on that tick; historical hits do not imply break',()=>{
  const s=new ShieldFeedback();s.consume(100,0,[]);s.visual(100,8);s.consume(0,30,[]);expect(s.phase).toBe('expire');expect(s.visual(0,36).alpha).toBeCloseTo(.275);expect(s.visual(0,42).phase).toBe('none');
  s.reset();s.consume(50,0,[]);s.consume(0,30,[shield(20,{shieldPhase:'absorbed',shieldRemaining:25})]);expect(s.phase).toBe('expire');
 });
 it('handles applied and consumed shields within one snapshot and optional historical fields',()=>{
  const s=new ShieldFeedback();s.consume(0,8,[shield(1),shield(4,{shieldPhase:'absorbed',shieldRemaining:0})]);expect(s.phase).toBe('break');expect(s.max).toBe(100);
  s.reset();s.consume(30,0,[]);expect(s.max).toBe(30);s.consume(20,10,[{type:'hit_resolved',id:'hero',tick:10,amount:0,position:{x:0,y:0}}]);expect(s.phase).toBe('hit');expect(s.visual(20,12,true).scale).toBe(1);
 });
 it('shield strip is full at its raised total and shrinks as it is absorbed',()=>{
  const bar=new ShieldBarTracker();expect(bar.ratio('a',40)).toBe(1);expect(bar.ratio('a',10)).toBeCloseTo(.25);expect(bar.ratio('a',30)).toBeCloseTo(.75);expect(bar.ratio('a',60)).toBe(1);
  expect(bar.ratio('a',0)).toBe(0);expect(bar.ratio('a',5)).toBe(1);expect(bar.ratio('b',8)).toBe(1);
 });
 it('tracks enemy-owned shields by their own id',()=>{
  const s=new ShieldFeedback('elite-1');s.consume(30,1,[shield(1,{id:'hero'})]);expect(s.phase).toBe('appear');s.consume(0,10,[shield(10,{id:'elite-1',shieldPhase:'absorbed',shieldRemaining:0,sourceId:'hero'})]);expect(s.phase).toBe('break');expect(s.sourceId).toBe('hero');
 });
});
