import {describe,it,expect} from 'vitest';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';
import {hubFrozenCommand,frozenFieldRegion} from '../apps/api/src/hub-field-freeze.ts';

describe('HUB freeze boundaries',()=>{
 it('has nine implemented opt-in switches and rejects unknown switches',()=>{
  const flags=parseFieldFreeze();expect(Object.keys(flags)).toHaveLength(9);expect(Object.values(flags).every(v=>v===false)).toBe(true);
  expect(()=>parseFieldFreeze({typo:true})).toThrow();expect(Object.isFrozen(flags)).toBe(true);
 });
 it('blocks legacy entry and gathering without blocking settlement, hub or return',()=>{
  const flags=parseFieldFreeze({fieldEntry:true,fieldGather:true,fieldSprint:true});
  for(const body of [{operation:'plane.interact'},{operation:'location',region:'ss-map-wind'},{operation:'safe',region:'town'},{operation:'starsea.quest',op:'travel'},{operation:'starsea.quest',op:'gate'},{operation:'field.gather'},{operation:'field.sprint'}])expect(hubFrozenCommand(flags,body)).not.toBeNull();
  for(const body of [{operation:'combat.report'},{operation:'field.activity.claim'},{operation:'bounty.claim'},{operation:'prologue'},{operation:'location',region:'ss-map-port'},{operation:'hub.dock'},{operation:'hub.return-ack'}])expect(hubFrozenCommand(flags,body)).toBeNull();
 });
 it('disables automatic sprint without mutating the shared region',()=>{
  const region={id:'field-wind',sprint:true};expect(frozenFieldRegion(region,parseFieldFreeze({fieldSprint:true}))).toEqual({...region,sprint:false});expect(region.sprint).toBe(true);
  expect(frozenFieldRegion(region,parseFieldFreeze())).toBe(region);
 });
});
