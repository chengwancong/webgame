import {describe,it,expect} from 'vitest';
import type {Stats} from '../packages/contracts/index.ts';
import {compareVerdict,statPowerDelta,compareResolvedStats} from '../packages/rules/stat-comparison.ts';
import {deltaChangeHtml,gearVerdictHtml} from '../apps/web/src/components/gear-metadata.ts';
const base=():Stats=>({hp:800,attack:40,armor:20,speed:5,mana:100,regen:5,effects:[],critChance:.1,critMultiplier:1.5});
const withStats=(patch:Partial<Stats>):Stats=>({...base(),...patch});
describe('换装总评由服务端给出',()=>{
 it('只涨输出属性 → 更偏输出',()=>{
  expect(compareVerdict(base(),withStats({attack:64}))).toBe('output');
 });
 it('只涨生存属性 → 更偏续航',()=>{
  expect(compareVerdict(base(),withStats({hp:1000,armor:40}))).toBe('sustain');
 });
 it('输出与生存一起涨且幅度接近 → 更强',()=>{
  expect(compareVerdict(base(),withStats({attack:52,hp:1000}))).toBe('stronger');
 });
 it('全面下降 → 较弱',()=>{
  expect(compareVerdict(base(),withStats({attack:30,hp:600,armor:10}))).toBe('weaker');
 });
 it('没有变化 → 差不多',()=>{
  expect(compareVerdict(base(),base())).toBe('even');
 });
 it('小幅变化不误导玩家',()=>{
  expect(compareVerdict(base(),withStats({attack:40.4}))).toBe('even');
 });
 it('比例类属性按百分点换算，不被数值类淹没',()=>{
  // 暴击率 +5%（比例）与攻击 +6（相对 15%）在同一把尺子上。
  expect(statPowerDelta('critChance',.1,.15)).toBeCloseTo(5,5);
  expect(statPowerDelta('attack',40,46)).toBeCloseTo(15,5);
 });
 it('比较表仍然只给出有变化的属性',()=>{
  const rows=compareResolvedStats(base(),withStats({attack:52}));
  expect(rows.attack.delta).toBe(12);
  expect(rows.hp).toBeUndefined();
 });
});
describe('对比数值用箭头 + 差值',()=>{
 it('涨用 ▲、跌用 ▼，并带上差值',()=>{
  expect(deltaChangeHtml(12,n=>String(n))).toBe('▲ 12');
  expect(deltaChangeHtml(-5,n=>String(n))).toBe('▼ -5');
 });
 it('数值待核对时不画箭头',()=>{
  expect(deltaChangeHtml(null,n=>String(n))).toBe('待核对');expect(deltaChangeHtml(0,n=>String(n))).toBe('—');
 });
 it('每个总评都有中文标签',()=>{
  for(const verdict of ['stronger','output','sustain','weaker','even'] as const){
   const html=gearVerdictHtml(verdict);
   expect(html).toMatch(/更强|更偏输出|更偏续航|较弱|差不多/);
  }
  expect(gearVerdictHtml(undefined)).toBe('');
 });
});
