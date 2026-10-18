import {describe,it,expect} from 'vitest';
import {HeroDeathPlayback} from '../apps/web/src/hero-death-playback.ts';
describe('post-combat death presentation',()=>{
 it('starts at frame zero, plays the whole clip, and freezes at its final frame',()=>{
  const clock=new HeroDeathPlayback();expect(clock.advance(true,100,false)).toBe(0);
  for(let i=0;i<15;i++)clock.advance(true,100,false);
  expect(clock.elapsed).toBe(1.5);expect(clock.advance(true,100,false)).toBe(1.5);
  expect(clock.advance(false,100,false)).toBe(0);expect(clock.advance(true,100,false)).toBe(0);
 });
 it('explicit pause freezes, while a single replay step advances exactly one battle frame',()=>{
  const clock=new HeroDeathPlayback();clock.advance(true,100,false);expect(clock.advance(true,200,true)).toBe(0);
  expect(clock.advance(true,200,true,1,true)).toBeCloseTo(1/30);
  expect(clock.advance(true,100,false,.25)).toBeCloseTo(1/30+.025);
 });
});
