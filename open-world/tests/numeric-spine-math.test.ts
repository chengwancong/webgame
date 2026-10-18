import {describe,it,expect} from 'vitest';
import {eliteSeconds,mapBench,scenarioParameters,normalizeToBand,officialRatios,powerIndex,spineScenes} from '../tools/spine/math.ts';
import {resolveTargets,type SpineTarget} from '../tools/spine/targets.ts';
const anchor={D1:100,DN:600,B3:200,EHP:4000,AV:.4,r50:50};
describe('数值主干独立公式',()=>{
 it('锚点映射为全1；精英跨越3秒边界连续',()=>{
  expect(Object.values(mapBench(anchor,anchor))).toEqual([1,1,1,1,1]);
  expect(eliteSeconds(100,200,600)).toBe(3);expect(eliteSeconds(100,200,601)).toBeCloseTo(3.01);
  expect(eliteSeconds(100,200,599)).toBeCloseTo(2.995);
 });
 it('五场景生命来自固定锚点；生存压力线性增长',()=>{
  const p=scenarioParameters(anchor);expect(p.single.hp).toBe(4500);expect(p.clear.hpEach).toBe(600);
  expect(p.elite.hp).toBe(1500);expect(p.survival.rawDps(0)).toBe(50);expect(p.survival.rawDps(30)).toBe(150);
 });
 it('安全轴计入承伤比例且完全规避时有限',()=>{
  expect(mapBench({...anchor,AV:.8},anchor).safety).toBeCloseTo(.62/.22);
  expect(mapBench({...anchor,AV:1},anchor).safety).toBe(31);
  expect(()=>mapBench({...anchor,AV:NaN},anchor)).toThrow();
 });
 it('归一回带边缘，不拉到中位数；零弹性不能伪造',()=>{
  const high=normalizeToBand(2,200,100,.1,1,.01);expect(high.value).toBe(1.1);expect(high.edge).toBeCloseTo(110);expect(high.changed).toBe(true);
  expect(normalizeToBand(1,105,100,.1,1,.01).changed).toBe(false);
  expect(()=>normalizeToBand(1,200,100,.1,0,.01)).toThrow('实测弹性');
 });
 it('力量指数读取用户权重，拒绝缺失或负权重',()=>{
  const w={single:.2,clear:.3,elite:.15,survival:.1,safety:.25};
  expect(powerIndex(mapBench(anchor,anchor),w)).toBe(0);
  expect(()=>powerIndex(mapBench(anchor,anchor),{...w,safety:-.25})).toThrow();
 });
 it('官方比值必须完整120格，失败和重复不静默忽略',()=>{
  const builds=Array.from({length:8},(_,i)=>String(i)),seeds=[41,42,43];
  const rows=builds.flatMap(build=>seeds.flatMap(seed=>spineScenes.map(scene=>({build,seed,scene,score:(Number(build)+1)*seed}))));
  expect(officialRatios(rows,builds,seeds)[0].ratios.single).toBeCloseTo(1/4.5);
  expect(()=>officialRatios(rows.slice(1),builds,seeds)).toThrow('完整');
  expect(()=>officialRatios([{...rows[0],score:null},...rows.slice(1)],builds,seeds)).toThrow('失败样本');
  expect(()=>officialRatios([rows[1],...rows.slice(1)],builds,seeds)).toThrow('重复');
 });
});
describe('目标来源与冲突',()=>{
 const target:SpineTarget={key:'L50',levels:'50',value:240,unit:'分钟',source:'用户',reference:'节奏目标.xlsx',locked:true,date:'2026-10-10'};
 it('锁定用户值优先；不同锁定值硬阻塞',()=>{
  expect(resolveTargets([target,{...target,value:300,source:'文档',locked:false,date:'2026-10-13'}]).selected).toEqual([target]);
  expect(()=>resolveTargets([target,{...target,value:300}])).toThrow('硬阻塞1');
 });
 it('新文档优先于旧文档和实测，保留冲突',()=>{
  const a={...target,source:'文档' as const,locked:false};
  const r=resolveTargets([a,{...a,value:250,date:'2026-10-13'},{...a,source:'实测',value:200,date:'2026-10-14'}]);
  expect(r.selected[0].value).toBe(250);expect(r.conflicts).toHaveLength(1);
 });
 it('相同数字不同单位不能被当作一致目标',()=>{
  expect(()=>resolveTargets([target,{...target,unit:'秒'}])).toThrow('单位冲突');
 });
});

import {ttdReduction} from '../tools/spine/math.ts';
it('删失寿命不冒充零危险度，真实降低比例保留正负号',()=>{expect(ttdReduction({ttd:120,censored:true},{ttd:120,censored:true})).toMatchObject({observed:null,functional:false});expect(ttdReduction({ttd:100,censored:false},{ttd:150,censored:false}).observed).toBe(-.5);expect(ttdReduction({ttd:100,censored:true},{ttd:50,censored:false})).toMatchObject({observed:null,functional:false,lowerBound:.5});});
