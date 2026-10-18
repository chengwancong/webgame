import {expect,it} from 'vitest';
import {objectiveCopy} from '../apps/web/src/objective.ts';
import {resolveBossAccess} from '../packages/rules/boss-access.ts';
const access=(kills:number)=>resolveBossAccess({kills:999,regionKills:{meadow:kills},regionElites:{meadow:1},regions:['town','meadow'],bosses:[],safe:'town',tasks:[]})['meadow-boss'];

it('replaces the six-kill instruction once the boss gate is the goal',()=>{
  const line=objectiveCopy({kills:999,bosses:[],regionId:'meadow',regionBoss:false,subtitle:'开阔风原，主路通向首领结界',access:access(6)});
  expect(line.head).toBe('前往首领结界');
  expect(line.detail).not.toContain('清剿六');
  expect(line.detail).toContain('结界');
});

it('keeps the six-kill step only while that step is unfinished',()=>{
  const line=objectiveCopy({kills:999,bosses:[],regionId:'meadow',regionBoss:false,subtitle:'开阔风原，主路通向首领结界',access:access(2)});
  expect(line.progress).toBe('2/6');
  expect(line.detail).toContain('敌人 2/6');
});
