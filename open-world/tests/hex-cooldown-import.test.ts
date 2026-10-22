import {describe,expect,it,vi} from 'vitest';
import {importSnapshotHexCooldowns,stampHexCooldownView} from '../apps/web/src/hex-cooldown-import.ts';

const mk=(tick=100)=>({comboReady:{} as Record<string,number>,tick});
describe('hex cooldown import',()=>{
 it('does nothing without a view',()=>{const w=mk();importSnapshotHexCooldowns(w,{});importSnapshotHexCooldowns(w,undefined);expect(w.comboReady).toEqual({});});
 it('writes remaining time as ticks',()=>{const w=mk(),view={observedAt:1000,readyAt:{'hex:a':3000}};importSnapshotHexCooldowns(w,{hexCooldowns:view},()=>0);expect(w.comboReady['hex:a']).toBe(100+60);});
 it('skips expired entries',()=>{const w=mk();importSnapshotHexCooldowns(w,{hexCooldowns:{observedAt:5000,readyAt:{'hex:a':5000,'hex:b':4000}}},()=>0);expect(w.comboReady).toEqual({});});
 it('advances with monotonic time since receipt',()=>{
  let t=1000;const view={observedAt:1000,readyAt:{'hex:a':3000,'hex:b':1500}},holder={hexCooldowns:view};
  stampHexCooldownView(holder,()=>t);t=1500;
  const w=mk();importSnapshotHexCooldowns(w,holder,()=>t);
  expect(w.comboReady['hex:a']).toBe(100+Math.ceil(1500*30/1000));expect(w.comboReady['hex:b']).toBeUndefined();
 });
 it('keeps a longer existing cooldown',()=>{const w=mk();w.comboReady['hex:a']=9999;importSnapshotHexCooldowns(w,{hexCooldowns:{observedAt:0,readyAt:{'hex:a':1000}}},()=>0);expect(w.comboReady['hex:a']).toBe(9999);});
 it('stale replayed receipt does not resurrect an expired cooldown',()=>{
  const view={observedAt:1000,readyAt:{'hex:a':31000}},holder={hexCooldowns:view};
  stampHexCooldownView(holder,()=>500,1000+60000);
  const w=mk();importSnapshotHexCooldowns(w,holder,()=>500);
  expect(w.comboReady).toEqual({});
 });
 it('fresh receipt keeps remaining time',()=>{
  const view={observedAt:1000,readyAt:{'hex:a':31000}},holder={hexCooldowns:view};
  stampHexCooldownView(holder,()=>500,1000);
  const w=mk();importSnapshotHexCooldowns(w,holder,()=>500);
  expect(w.comboReady['hex:a']).toBe(100+900);
 });
 it('partially aged receipt subtracts server-side age plus monotonic time',()=>{
  const view={observedAt:1000,readyAt:{'hex:a':31000}},holder={hexCooldowns:view};let t=0;
  stampHexCooldownView(holder,()=>t,1000+10000);t=5000;
  const w=mk();importSnapshotHexCooldowns(w,holder,()=>t);
  expect(w.comboReady['hex:a']).toBe(100+Math.ceil(15000*30/1000));
 });
 it('degrades to old behaviour without server-now header',()=>{
  const view={observedAt:1000,readyAt:{'hex:a':31000}},holder={hexCooldowns:view};
  stampHexCooldownView(holder,()=>0,undefined);stampHexCooldownView({hexCooldowns:{observedAt:1,readyAt:{}}},()=>0,Number.NaN);
  const w=mk();importSnapshotHexCooldowns(w,holder,()=>0);
  expect(w.comboReady['hex:a']).toBe(100+900);
 });
 it('does not depend on browser wall clock',()=>{
  const view={observedAt:1000,readyAt:{'hex:a':31000}},holder={hexCooldowns:view};
  const spy=vi.spyOn(Date,'now').mockReturnValue(9e15);
  try{stampHexCooldownView(holder,()=>0,1000+10000);const w=mk();importSnapshotHexCooldowns(w,holder,()=>0);expect(w.comboReady['hex:a']).toBe(100+600);expect(spy).not.toHaveBeenCalled();}finally{spy.mockRestore();}
 });
});
