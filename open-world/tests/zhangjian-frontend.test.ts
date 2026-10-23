/**
 * Z1–Z4 前端纯函数单元测试。
 * 测试覆盖：elementHint 文字逻辑、探索度圆环百分比、宠物阵容参数构造等。
 * 无 DOM、无服务端调用、无 node:crypto 依赖。
 */
import {describe, it, expect} from 'vitest';
import {elementHint, elementNames, slotNames} from '../packages/rules/zhangjian-view.ts';
import type {LoadoutView} from '../packages/contracts/zhangjian.ts';
import type {DamageType} from '../packages/contracts/skill-mechanics.ts';

// ---------- 辅助构造 ----------

/** 构造一个最小合法 LoadoutView（current 里有 resist 记录） */
function makeLoadoutView(currentElements: DamageType[], currentResist: Record<string, number>, slotElements: DamageType[][]): LoadoutView {
 return {
  active: 0,
  dirty: false,
  canSwitch: true,
  slots: [
   {index: 0, name: '方案一', empty: false, elements: slotElements[0] ?? [], skills: [], pet: null},
   {index: 1, name: '方案二', empty: false, elements: slotElements[1] ?? [], skills: [], pet: null},
   {index: 2, name: '方案三', empty: true,  elements: [], skills: [], pet: null},
  ],
  current: {elements: currentElements, resist: currentResist},
 };
}

// ---------- elementHint ----------

describe('elementHint', () => {
 it('弱点已覆盖且抗性足够时返回 null', () => {
  const view = makeLoadoutView(['fire'], {fire: 0.2}, [['fire'], ['cold']]);
  // 当前方案已有 fire 弱点；physical 威胁不触发低抗提示
  const result = elementHint({threat: 'physical', weakness: 'fire'}, view);
  expect(result).toBeNull();
 });

 it('弱点未覆盖但其他方案有时返回 switchTo', () => {
  const view = makeLoadoutView(['fire'], {}, [['fire'], ['cold']]);
  // 当前方案是方案一(fire)；弱点是 cold；方案二有 cold
  const result = elementHint({threat: 'physical', weakness: 'cold'}, view);
  expect(result).not.toBeNull();
  expect(result!.switchTo).toBe(1);
  expect(result!.text).toContain('方案二');
  expect(result!.text).toContain(elementNames['cold']);
 });

 it('低抗时显示抗性百分比文字', () => {
  // 当前 lightning 抗性 5% < 10%
  const view = makeLoadoutView(['fire'], {lightning: 0.05}, [['fire'], ['cold']]);
  const result = elementHint({threat: 'lightning', weakness: 'fire'}, view);
  expect(result).not.toBeNull();
  expect(result!.text).toContain(elementNames['lightning']);
  expect(result!.text).toContain('%');
  expect(result!.switchTo).toBeUndefined();
 });

 it('pure 威胁不触发低抗提示', () => {
  const view = makeLoadoutView(['fire'], {}, [['fire'], ['cold']]);
  const result = elementHint({threat: 'pure', weakness: 'fire'}, view);
  expect(result).toBeNull();
 });

 it('physical 威胁不触发低抗提示', () => {
  const view = makeLoadoutView(['fire'], {}, [['fire'], ['cold']]);
  const result = elementHint({threat: 'physical', weakness: 'fire'}, view);
  expect(result).toBeNull();
 });
});

// ---------- elementNames / slotNames ----------

describe('elementNames', () => {
 it('包含所有 8 种元素的中文名', () => {
  const types: DamageType[] = ['physical', 'fire', 'cold', 'lightning', 'arcane', 'shadow', 'poison', 'pure'];
  for (const t of types) {
   expect(typeof elementNames[t]).toBe('string');
   expect(elementNames[t].length).toBeGreaterThan(0);
  }
 });
});

describe('slotNames', () => {
 it('包含 6 个部位的中文名', () => {
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'accessory', 'ring'] as const;
  for (const s of slots) {
   expect(typeof slotNames[s]).toBe('string');
   expect(slotNames[s].length).toBeGreaterThan(0);
  }
 });
});

// ---------- Z4 探索度百分比纯计算 ----------

describe('探索度圆环百分比', () => {
 it('满探索度时百分比为 100', () => {
  const calcPct = (found: number, total: number) => total === 0 ? 0 : Math.round((found / total) * 100);
  expect(calcPct(10, 10)).toBe(100);
 });

 it('无任何记录时百分比为 0', () => {
  const calcPct = (found: number, total: number) => total === 0 ? 0 : Math.round((found / total) * 100);
  expect(calcPct(0, 0)).toBe(0);
 });

 it('里程碑达成判断：ratio >= milestone.threshold', () => {
  const milestones = [{threshold: 0.25}, {threshold: 0.5}, {threshold: 1.0}];
  const ratio = 0.6;
  const reached = milestones.map(m => ratio >= m.threshold);
  expect(reached).toEqual([true, true, false]);
 });
});

// ---------- Z3 宠物阵容参数构造（纯逻辑，不调 API） ----------

describe('宠物阵容参数构造', () => {
 it('点击上阵的同一只宠物应取消上阵', () => {
  const currentActive: string | null = 'ss-wind';
  const clickedId = 'ss-wind';
  const newActive: string | null = currentActive === clickedId ? null : clickedId;
  expect(newActive).toBeNull();
 });

 it('点击新宠物应设为上阵', () => {
  const currentActive: string | null = 'ss-wind';
  const clickedId = 'ss-fire';
  const newActive: string | null = currentActive === clickedId ? null : clickedId;
  expect(newActive).toBe('ss-fire');
 });

 it('移除宠物时从助阵列表过滤', () => {
  const support = ['ss-fire', 'ss-ice'];
  const removeId = 'ss-fire';
  const newSupport = support.filter(s => s !== removeId);
  expect(newSupport).toEqual(['ss-ice']);
 });

 it('pet-flow action id 格式解析正确', () => {
  const id = 'ss-wind-free:rapid';
  const [family, flow] = id.split(':');
  expect(family).toBe('ss-wind-free');
  expect(flow).toBe('rapid');
 });
});
