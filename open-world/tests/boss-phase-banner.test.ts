import {describe, it, expect, beforeEach} from 'vitest';
import {BossPhaseBanner} from '../apps/web/src/boss-phase-banner.ts';

describe('BossPhaseBanner', () => {
  let banner: BossPhaseBanner;

  beforeEach(() => {
    banner = new BossPhaseBanner();
  });

  it('phase < 2 不触发', () => {
    const {triggered} = banner.consume('boss1', '黑翼魔龙', 1, 0);
    expect(triggered).toBe(false);
    expect(banner.currentInfo).toBeNull();
  });

  it('phase 2 触发「狂暴」', () => {
    const {triggered} = banner.consume('boss1', '黑翼魔龙', 2, 0);
    expect(triggered).toBe(true);
    expect(banner.currentInfo?.phase).toBe(2);
    expect(banner.currentInfo?.bossName).toBe('黑翼魔龙');
  });

  it('同一 (id, phase) 只触发一次', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    const {triggered} = banner.consume('boss1', '黑翼魔龙', 2, 5);
    expect(triggered).toBe(false);
  });

  it('同 id 不同 phase 各触发一次', () => {
    const {triggered: t2} = banner.consume('boss1', '黑翼魔龙', 2, 0);
    const {triggered: t3} = banner.consume('boss1', '黑翼魔龙', 3, 10);
    expect(t2).toBe(true);
    expect(t3).toBe(true);
  });

  it('不同 id 相同 phase 各自触发', () => {
    const {triggered: ta} = banner.consume('boss1', '黑翼魔龙', 2, 0);
    const {triggered: tb} = banner.consume('boss2', '冰霜女王', 2, 5);
    expect(ta).toBe(true);
    expect(tb).toBe(true);
  });

  it('alpha 淡入', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    expect(banner.alpha(0)).toBeCloseTo(0);
    expect(banner.alpha(5)).toBeGreaterThan(0);
    expect(banner.alpha(5)).toBeLessThan(1);
  });

  it('alpha 中段为 1', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    // 淡入 9 帧后到稳定
    expect(banner.alpha(9)).toBe(1);
    expect(banner.alpha(30)).toBe(1);
  });

  it('alpha 淡出', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    expect(banner.alpha(55)).toBeGreaterThan(0);
    expect(banner.alpha(55)).toBeLessThan(1);
    expect(banner.alpha(66)).toBe(0);
  });

  it('alpha 结束后 currentInfo 清空', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    banner.alpha(66);  // 触发清空
    expect(banner.currentInfo).toBeNull();
  });

  it('progress 返回 0–1 范围', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    expect(banner.progress(0)).toBeCloseTo(0);
    expect(banner.progress(33)).toBeCloseTo(0.5);
  });

  it('reset() 后同 (id, phase) 可再次触发', () => {
    banner.consume('boss1', '黑翼魔龙', 2, 0);
    banner.reset();
    const {triggered} = banner.consume('boss1', '黑翼魔龙', 2, 10);
    expect(triggered).toBe(true);
  });

  it('phase ≥ 3 触发「第N阶段」信息', () => {
    const {triggered} = banner.consume('boss1', '黑翼魔龙', 3, 0);
    expect(triggered).toBe(true);
    expect(banner.currentInfo?.phase).toBe(3);
  });
});

describe('BossPhaseBanner.announce (FP4 引雷桩破盾)', () => {
  it('shows custom text once per key and shares the banner timing', () => {
    const banner = new BossPhaseBanner();
    expect(banner.announce('rare:pylon-shield', '稀有精英 · 护盾破碎', 100).triggered).toBe(true);
    expect(banner.currentInfo?.text).toBe('稀有精英 · 护盾破碎');
    expect(banner.alpha(120)).toBe(1);
    expect(banner.announce('rare:pylon-shield', '稀有精英 · 护盾破碎', 130).triggered).toBe(false);
    banner.reset();
    expect(banner.announce('rare:pylon-shield', '稀有精英 · 护盾破碎', 200).triggered).toBe(true);
  });
  it('phase banners keep their own label (no text)', () => {
    const banner = new BossPhaseBanner();
    banner.consume('boss', '沉星', 2, 10);
    expect(banner.currentInfo?.text).toBeUndefined();
  });
});
