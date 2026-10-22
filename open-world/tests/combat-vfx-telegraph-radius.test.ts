import {describe,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{BlendModes:{ADD:1,NORMAL:0}}}));
import {telegraphRadius} from '../apps/web/src/combat-vfx.ts';

describe('combat-vfx telegraphRadius (P27-VFX-R01)',()=>{
 it('uses the monster skill radius when defined',()=>{expect(telegraphRadius('frost_stomp',9)).toBe(3);});
 it('does not throw for skills missing from monsterSkills and falls back to the recorded radius',()=>{
  expect(()=>telegraphRadius('no_such_chapter_boss_skill',4.5)).not.toThrow();
  expect(telegraphRadius('no_such_chapter_boss_skill',4.5)).toBe(4.5);
 });
 it('falls back to 2 with undefined skill and no recorded radius',()=>{expect(telegraphRadius(undefined)).toBe(2);});
});
