import {expect,it} from 'vitest';
import {applyTacticalAction,previewTacticalEncounter} from '../packages/simulation/tactical/encounter.ts';
import {heroOf} from '../packages/simulation/tactical/runtime.ts';
import {battle,enemy} from './tactical-fixtures.ts';

it('cut is adjacent single-target, whirl covers eight neighbors, and basic shares the main budget',()=>{
 const s=battle([enemy('a','melee',5,4),enemy('b','melee',5,5),enemy('c','melee',6,4)]);
 const cut=applyTacticalAction(s,{type:'basic',target:{x:5,y:4}});expect(cut.events.filter(e=>e.type==='damage').map(e=>e.targetId)).toEqual(['a']);
 expect(()=>applyTacticalAction(cut.state,{type:'skill',skillId:'whirl'})).toThrow('Main action');
 const whirl=applyTacticalAction(s,{type:'skill',skillId:'whirl'});expect(whirl.events.filter(e=>e.type==='damage').map(e=>e.targetId)).toEqual(['a','b']);
});
it('ward protects the full enemy window then expires; cooldown 2 is ready on owner turn k+2',()=>{
 let s=battle([enemy('m','melee',5,4)]);s=applyTacticalAction(s,{type:'skill',skillId:'ward'}).state;expect(heroOf(s).shield).toBe(25);
 s=applyTacticalAction(s,{type:'end'}).state;expect(heroOf(s).hp).toBe(100);expect(heroOf(s).shield).toBe(0);
 let a=battle([enemy('m','melee',5,4)]);a=applyTacticalAction(a,{type:'skill',skillId:'whirl'}).state;a=applyTacticalAction(a,{type:'end'}).state;
 expect(()=>applyTacticalAction(a,{type:'skill',skillId:'whirl'})).toThrow('cooling');a=applyTacticalAction(a,{type:'end'}).state;
 expect(()=>applyTacticalAction(a,{type:'skill',skillId:'whirl'})).not.toThrow();
});
it('vortex pulls nearest first only into empty adjacent cells; shield affix prevents control while shield remains',()=>{
 const s=battle([enemy('a','melee',6,4),enemy('b','melee',4,6,{eliteAffixes:['shielded'],shield:20})]);
 const after=applyTacticalAction(s,{type:'skill',skillId:'vortex_blade'}).state;
 expect(after.units.find(u=>u.id==='a')!.cell).toEqual({x:5,y:3});expect(after.units.find(u=>u.id==='b')!.cell).toEqual({x:4,y:6});
 expect(after.units.find(u=>u.id==='b')!.shield).toBeLessThan(20);
});
it('throwing knife hits the first unit on its ray and rejects obstructed targets',()=>{
 const s=battle([enemy('a','melee',5,4),enemy('b','melee',7,4)],{heroId:'hidden'});
 const result=applyTacticalAction(s,{type:'basic',target:{x:7,y:4}});expect(result.events.filter(e=>e.type==='damage').map(e=>e.targetId)).toEqual(['a']);
 s.board.blocked.push({x:6,y:4});expect(()=>applyTacticalAction(s,{type:'basic',target:{x:7,y:4}})).toThrow('sight');
});
it('fan casts three rays and each ray stops at its first unit',()=>{
 const s=battle([enemy('a','melee',5,4),enemy('b','melee',6,4),enemy('c','melee',5,3),enemy('d','melee',5,5)],{heroId:'hidden'});
 const result=applyTacticalAction(s,{type:'skill',skillId:'fan_of_knives',target:{x:7,y:4}});expect(result.events.filter(e=>e.type==='damage').map(e=>e.targetId).sort()).toEqual(['a','c','d']);
});
it('venom pierces and poison ticks exactly once at each of two round ends',()=>{
 let s=battle([enemy('a','melee',5,4),enemy('b','melee',6,4)],{heroId:'hidden'});
 const start=applyTacticalAction(s,{type:'skill',skillId:'venom_needle',target:{x:7,y:4}});expect(start.events.filter(e=>e.type==='damage')).toHaveLength(2);s=start.state;
 const all=[];for(let i=0;i<3;i++){const result=applyTacticalAction(s,{type:'end'});s=result.state;all.push(...result.events);}
 expect(all.filter(e=>e.type==='damage'&&e.cause==='poison')).toHaveLength(4);expect(s.units.filter(u=>u.side==='enemy').every(u=>!u.statuses.some(t=>t.id==='poison'))).toBe(true);
 expect(all.filter(e=>e.cause==='poison').every(e=>e.rootActionId===start.events.find(e=>e.type==='skill')!.actionId)).toBe(true);
});
it('toxic bomb creates a two-round zone and expected preview does not mutate it',()=>{
 const s=battle([enemy('m','guard',5,4)],{heroId:'hidden'});s.intents=[];
 const action={type:'skill' as const,skillId:'toxic_bomb',target:{x:5,y:4}};const before=structuredClone(s);previewTacticalEncounter(s,[action]);expect(s).toEqual(before);
 let a=applyTacticalAction(s,action).state;expect(a.zones[0].remaining).toBe(2);a=applyTacticalAction(a,{type:'end'}).state;expect(a.zones[0].remaining).toBe(1);a=applyTacticalAction(a,{type:'end'}).state;expect(a.zones).toHaveLength(0);
});
