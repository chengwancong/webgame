import {describe,expect,it} from 'vitest';
import {hexActivityNotice} from '../apps/web/src/hex-combat-summary.ts';
import {publicHexRunes} from '../packages/content/hex-runes.ts';
const rule=(rune:string,triggers:number,share:number|null=null)=>({rule:'r-'+rune,rune,triggers,share}) as any;
describe('hexActivityNotice',()=>{
 it('is empty for unavailable, empty and missing stats',()=>{
  expect(hexActivityNotice({coverage:'unavailable',rules:[rule('x',3)]} as any)).toBe('');
  expect(hexActivityNotice({coverage:'complete',rules:[]} as any)).toBe('');
  expect(hexActivityNotice(null)).toBe('');
 });
 it('lists top two rules by triggers with share',()=>{
  const id=publicHexRunes[0]!.id,name=publicHexRunes[0]!.name;
  const text=hexActivityNotice({coverage:'complete',rules:[rule('unknown-a',2),rule(id,9,0.256),rule('unknown-b',5)]} as any);
  expect(text).toBe(`词缀战绩：${name} 触发9次（直接伤害占比25.6%） · unknown-b 触发5次`);
  expect(text).not.toContain('总收益');
 });
 it('marks partial coverage',()=>{
  expect(hexActivityNotice({coverage:'partial',rules:[rule('unknown-a',4)]} as any)).toBe('词缀战绩：unknown-a 触发4次（部分统计）');
 });
});
