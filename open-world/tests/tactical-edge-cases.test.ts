import {it,expect} from 'vitest';
import {battle,enemy,resolution} from './tactical-fixtures.ts';
import {executeEnemyIntent,planEnemyIntent,revealEnemyIntents} from '../packages/simulation/tactical/enemy-ai.ts';
import {applyTacticalAction,createTacticalEncounter} from '../packages/simulation/tactical/encounter.ts';
import {heroOf} from '../packages/simulation/tactical/runtime.ts';
import {tacticalBoardById,tacticalBoards} from '../packages/content/tactical-content.ts';

it('teleport uses the farthest legal cell when a small room cannot satisfy minimum range',()=>{
 const s=battle([enemy('t','melee',2,1,{eliteAffixes:['teleport']})]);
 s.board={width:4,height:4,blocked:[]};heroOf(s).cell={x:1,y:1};
 const intent=planEnemyIntent(s,s.units[1],0);expect(intent.effect).toBe('teleport');expect(intent.destination).not.toEqual({x:2,y:1});
 executeEnemyIntent(resolution(s),intent);expect(intent.fizzled).not.toBe(true);expect(s.units[1].cell).toEqual(intent.destination);
});
it('an immediately adjacent wall stuns a charging enemy even though its ray has zero free cells',()=>{
 const s=battle([enemy('c','charger',2,2)]);heroOf(s).cell={x:5,y:2};s.board.blocked=[{x:3,y:2}];
 const windup=planEnemyIntent(s,s.units[1],0);expect(windup.type).toBe('charge-windup');expect(windup.line).toEqual([]);
 executeEnemyIntent(resolution(s),windup);s.round=2;
 executeEnemyIntent(resolution(s),planEnemyIntent(s,s.units[1],0));
 expect(s.units[1].cell).toEqual({x:2,y:2});s.round=3;
 expect(planEnemyIntent(s,s.units[1],0)).toMatchObject({type:'move-only',effect:'stun',move:0});
});
it('fire entry damage points at the enemy and the root action that laid the trail',()=>{
 const s=battle([enemy('f','melee',8,8)]);s.intents=[];
 s.zones=[{id:'fire',kind:'fire',sourceId:'f',rootActionId:'enemy-fire-root',cells:[{x:3,y:4}],damage:4,remaining:2,activeFromRound:1}];
 const result=applyTacticalAction(s,{type:'move',to:{x:3,y:4}});
 expect(result.events.find(e=>e.type==='damage'&&e.cause==='fire-trail')).toMatchObject({sourceId:'f',rootActionId:'enemy-fire-root',targetId:'hero',amount:4});
});
it('creation preserves the initial lethal-guard event instead of only mutating its intent',()=>{
 const board=structuredClone(tacticalBoards[0]);board.id='test-overwhelm';board.width=10;board.height=10;board.blocked=[];board.heroSpawn={x:5,y:5};
 board.enemies=Array.from({length:15},(_,i)=>({id:`r-${i}`,kind:'ranged' as const,cell:{x:i%10,y:Math.floor(i/10)},eliteAffixes:[]}));
 tacticalBoardById.set(board.id,board);
 try{
  const s=createTacticalEncounter({battleId:'initial-guard',boardId:board.id,heroId:'sword',seed:1});
  expect(s.intents.some(i=>i.reason==='lethal-guard')).toBe(true);
  expect(s.events?.some(e=>e.cause==='lethal-guard'&&e.type==='intent-downgraded')).toBe(true);
 }finally{tacticalBoardById.delete(board.id);}
});
