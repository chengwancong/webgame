import {expect,it} from 'vitest';
import {TacticalProjectionSchema} from '../packages/contracts/tactical.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';
import {applyTacticalAction,createTacticalEncounter,createTacticalPreviewState,previewTacticalEncounter,projectTacticalEncounter} from '../packages/simulation/tactical/encounter.ts';
import {hasLineOfSight,lineCells} from '../packages/simulation/tactical/geometry.ts';
import {checkOutcome} from '../packages/simulation/tactical/runtime.ts';
import {battle,enemy} from './tactical-fixtures.ts';

it('same seed and action sequence produces byte-identical states and causally attributed events',()=>{
 function run(){let s=battle([enemy('m','melee',5,4)]);const events=[];
  for(const action of [{type:'basic',target:{x:5,y:4}},{type:'end'},{type:'skill',skillId:'ward'},{type:'end'}] as const){const result=applyTacticalAction(s,action);s=result.state;events.push(...result.events);}
  return {s,events};}
 const a=run(),b=run();expect(JSON.stringify(a)).toBe(JSON.stringify(b));
 for(const e of a.events)expect(e).toMatchObject({battleId:'test-battle',round:expect.any(Number),ownerTurnId:expect.any(String),actionId:expect.any(String),resolutionId:expect.any(String),sourceId:expect.any(String),cause:expect.any(String)});
 expect(new Set(a.events.map(e=>e.resolutionId)).size).toBe(a.events.length);
 expect(a.events.find(e=>e.type==='damage'&&e.sourceId==='m')!.ownerTurnId).toBe('test-battle:m:1');
});
it('moving and main action work in both orders, and both spent budgets automatically resolve the enemy window',()=>{
 for(const reverse of [false,true]){let s=battle([enemy('m','melee',8,8)]);
  const actions=[{type:'move',to:{x:4,y:3}},{type:'skill',skillId:'ward'}] as const;
  for(const a of reverse?[...actions].reverse():actions)s=applyTacticalAction(s,a).state;
  expect(s.round).toBe(2);expect(s.budget).toEqual({moveUsed:false,mainActionUsed:false,ended:false});
 }
});
it('invalid actions leave source state, RNG, events and budgets unchanged',()=>{
 const s=battle([enemy('m','melee',8,8)]),before=structuredClone(s);
 expect(()=>applyTacticalAction(s,{type:'move',to:{x:8,y:8}})).toThrow();
 expect(()=>applyTacticalAction(s,{type:'basic',target:{x:8,y:8}})).toThrow();expect(s).toEqual(before);
});
it('public projections strictly validate and do not expose RNG cursor; expected previews ignore the cursor',()=>{
 const s=battle([enemy('m','melee',5,4)]),before=structuredClone(s),p=projectTacticalEncounter(s);
 expect(TacticalProjectionSchema.parse(p)).toEqual(p);expect(p).not.toHaveProperty('rngState');
 const action={type:'basic' as const,target:{x:5,y:4}};
 const a=previewTacticalEncounter(s,[action]);s.rngState=999999;const b=previewTacticalEncounter(s,[action]);
 expect(a).toEqual(b);expect(a.projection.intents).toEqual([]);expect(createTacticalPreviewState(p).rngState).toBe(0);
 s.rngState=before.rngState;expect(s).toEqual(before);
});
it('Bresenham sight blocks walls but not units',()=>{
 const s=battle([enemy('m','melee',5,4)]);
 expect(lineCells({x:1,y:1},{x:4,y:3})).toEqual([{x:1,y:1},{x:2,y:2},{x:3,y:2},{x:4,y:3}]);
 expect(hasLineOfSight(s.board,{x:4,y:4},{x:7,y:4})).toBe(true);
 s.board.blocked.push({x:6,y:4});expect(hasLineOfSight(s.board,{x:4,y:4},{x:7,y:4})).toBe(false);
});
it('player ambush gives a movement-only opening and enemy ambush moves before its attack announcement',()=>{
 const options={battleId:'ambush',boardId:tacticalBoards[0].id,heroId:'sword' as const,seed:1};
 const player=createTacticalEncounter({...options,ambush:'player'});expect(player.intents.every(i=>i.type==='move-only'&&i.damage===0)).toBe(true);
 const normal=createTacticalEncounter(options),ambushed=createTacticalEncounter({...options,ambush:'enemy'});
 expect(ambushed.units.filter(u=>u.side==='enemy').map(u=>u.cell)).not.toEqual(normal.units.filter(u=>u.side==='enemy').map(u=>u.cell));expect(ambushed.round).toBe(1);
});
it('last enemy death wins immediately and hero death ends enemy execution',()=>{
 let s=battle([enemy('m','melee',5,4,{hp:1,maxHp:1})]);expect(applyTacticalAction(s,{type:'basic',target:{x:5,y:4}}).state.outcome).toBe('win');
 s=battle([enemy('a','melee',5,4),enemy('z','melee',3,4)]);s.units[0].hp=1;
 const result=applyTacticalAction(s,{type:'end'});expect(result.state.outcome).toBe('loss');expect(result.events.filter(e=>e.type==='damage')).toHaveLength(1);
});
it('an atomic simultaneous defeat resolves in the player favor',()=>{
 const s=battle([enemy('m','melee',5,4)]);for(const u of s.units)u.hp=0;checkOutcome(s);expect(s.outcome).toBe('win');
});
it('an assassin hidden destination is absent from the public projection and preview state',()=>{
 const s=battle([enemy('a','assassin',8,8)]);expect(s.intents[0].destination).toBeDefined();
 const p=projectTacticalEncounter(s);expect(p.intents[0]).toMatchObject({hidden:true,type:'move-only'});expect(p.intents[0].destination).toBeUndefined();
 expect(createTacticalPreviewState(p).intents[0].destination).toBeUndefined();expect(TacticalProjectionSchema.parse(p)).toEqual(p);
});
it('a lethal reaction interrupts the path and reports only cells actually traversed',()=>{
 const s=battle([enemy('g','guard',5,4)]);s.units[0].hp=1;
 const result=applyTacticalAction(s,{type:'move',to:{x:2,y:4}});
 expect(result.state.outcome).toBe('loss');expect(result.state.units[0].cell).toEqual({x:4,y:4});
 expect(result.events.find(e=>e.type==='move')!.cells).toEqual([{x:4,y:4}]);
});
