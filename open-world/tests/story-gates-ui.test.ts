import {describe,expect,it} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {visibleProgressionGroups} from '../apps/web/src/progression-panel.ts';
import {challengeOpen,featureOpen} from '../apps/web/src/story-gates.ts';

const starsea=(features:string[])=>({starsea:{features}}) as unknown as CharacterState;
const fresh=(events:Record<string,string>={})=>({story:{version:1,legacyAccess:false,events,choices:{}}}) as unknown as CharacterState;

describe('story-locked entrances',()=>{
 it('hides locked progression groups and sections for a new character',()=>{
  const groups=visibleProgressionGroups(fresh());
  expect(groups.map(g=>g.id)).toEqual(['talents','paragon','character','reputation']);
  expect(groups.find(g=>g.id==='reputation')).toMatchObject({name:'区域声望',sections:['reputation']});
 });
 it('opens sections as the shared rule unlocks them',()=>{
  const groups=visibleProgressionGroups(starsea(['forge','aspects','high']));
  expect(groups.find(g=>g.id==='grid')).toMatchObject({name:'武器成长',sections:['weapons']});
  expect(groups.some(g=>g.id==='aspects')).toBe(true);
  expect(groups.some(g=>g.id==='challenges')).toBe(true);
  expect(challengeOpen(starsea(['high']),'raid')).toBe(false);
 });
 it('keeps legacy characters and unknown snapshots unrestricted',()=>{
  const legacy={story:{version:1,legacyAccess:true,events:{},choices:{}}} as unknown as CharacterState;
  expect(visibleProgressionGroups(legacy)).toHaveLength(8);
  expect(visibleProgressionGroups()).toHaveLength(8);
  expect(featureOpen(undefined,'trial')).toBe(true);
 });
});
