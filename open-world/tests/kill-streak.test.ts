import {describe, it, expect, beforeEach} from 'vitest';
import {
  KillStreak,
  KILL_STREAK_CHAIN_WINDOW,
  KILL_STREAK_MIN_SHOW,
  KILL_STREAK_ART_KEY,
  killStreakTierLabel,
  killStreakTierIndex,
  killStreakTierFrame,
  KILL_STREAK_TIERS,
} from '../apps/web/src/kill-streak.ts';

describe('killStreakTierLabel', () => {
  it('N < 3 仍返回默认标签连斩', () => {
    expect(killStreakTierLabel(1)).toBe('连斩');
    expect(killStreakTierLabel(2)).toBe('连斩');
  });

  it('N 3–9 返回连斩', () => {
    for (let n = 3; n <= 9; n++) expect(killStreakTierLabel(n)).toBe('连斩');
  });

  it('N 10–24 返回连斩', () => {
    expect(killStreakTierLabel(10)).toBe('连斩');
    expect(killStreakTierLabel(24)).toBe('连斩');
  });

  it('N 25–49 返回横扫', () => {
    expect(killStreakTierLabel(25)).toBe('横扫');
    expect(killStreakTierLabel(49)).toBe('横扫');
  });

  it('N 50–99 返回无双', () => {
    expect(killStreakTierLabel(50)).toBe('无双');
    expect(killStreakTierLabel(99)).toBe('无双');
  });

  it('N ≥ 100 返回神威', () => {
    expect(killStreakTierLabel(100)).toBe('神威');
    expect(killStreakTierLabel(200)).toBe('神威');
  });
});

describe('killStreakTierIndex', () => {
  it('N < 10 返回 -1', () => {
    expect(killStreakTierIndex(3)).toBe(-1);
    expect(killStreakTierIndex(9)).toBe(-1);
  });

  it('对应各阈值', () => {
    expect(killStreakTierIndex(10)).toBe(0);
    expect(killStreakTierIndex(25)).toBe(1);
    expect(killStreakTierIndex(50)).toBe(2);
    expect(killStreakTierIndex(100)).toBe(3);
  });
});

describe('KillStreak', () => {
  let streak: KillStreak;

  beforeEach(() => {
    streak = new KillStreak();
  });

  it('初始不可见', () => {
    expect(streak.visible).toBe(false);
    expect(streak.n).toBe(0);
  });

  it('MIN_SHOW = 3', () => {
    expect(KILL_STREAK_MIN_SHOW).toBe(3);
    streak.consume('a', 0);
    streak.consume('b', 1);
    expect(streak.visible).toBe(false);
    streak.consume('c', 2);
    expect(streak.visible).toBe(true);
  });

  it('同一 id 不计两次（服务端权威去重）', () => {
    streak.consume('e1', 0);
    streak.consume('e1', 0);  // 重复
    streak.consume('e1', 1);  // 同 id 不同 tick
    expect(streak.n).toBe(1);
  });

  it('链断后重新计数', () => {
    streak.consume('a', 0);
    streak.consume('b', 1);
    streak.consume('c', 2);
    expect(streak.n).toBe(3);

    // 超过链窗口
    const brokenTick = 2 + KILL_STREAK_CHAIN_WINDOW + 1;
    streak.consume('d', brokenTick);
    expect(streak.n).toBe(1);
    expect(streak.visible).toBe(false);
  });

  it('链断后 seen 仍保留（同 id 消费无效）', () => {
    streak.consume('e', 0);
    const brokenTick = KILL_STREAK_CHAIN_WINDOW + 1;
    // e 已在 seen 集合里：即使链断了也不应再计入（早返回，不触发链断重置）
    const {rose} = streak.consume('e', brokenTick);
    expect(rose).toBe(false);
    // n 仍为 1（e 是唯一一次），链虽然逻辑上已断（idleTicks > CHAIN_WINDOW）但计数器未重置
    expect(streak.n).toBe(1);
    // 确认 idleTicks 正确反映链断
    expect(streak.idleTicks(brokenTick)).toBeGreaterThan(KILL_STREAK_CHAIN_WINDOW);
  });

  it('层级在阈值时 rose=true', () => {
    for (let i = 0; i < 9; i++) streak.consume(`x${i}`, i);
    // 此时 n=9，未到 tier 0 阈值(10)
    const {rose: rose9} = streak.consume('x9', 9);
    // n 变为 10 → 进入层级 0
    expect(streak.n).toBe(10);
    expect(rose9).toBe(true);
  });

  it('同一层级内不重复触发 rose', () => {
    for (let i = 0; i < 10; i++) streak.consume(`x${i}`, i);
    // n=10，rose=true
    const {rose: r11} = streak.consume('x10', 10);
    expect(r11).toBe(false);  // 仍在 tier 0
  });

  it('idleTicks 从未击杀时返回 Infinity', () => {
    expect(streak.idleTicks(0)).toBe(Infinity);
  });

  it('idleTicks 正确计算', () => {
    streak.consume('a', 5);
    expect(streak.idleTicks(5)).toBe(0);
    expect(streak.idleTicks(10)).toBe(5);
  });

  it('reset() 清空所有状态', () => {
    streak.consume('a', 0);
    streak.consume('b', 1);
    streak.consume('c', 2);
    streak.reset();
    expect(streak.n).toBe(0);
    expect(streak.visible).toBe(false);
    // 重置后同 id 可再计
    streak.consume('a', 3);
    expect(streak.n).toBe(1);
  });

  it('链窗口恰好不断链', () => {
    streak.consume('a', 0);
    streak.consume('b', KILL_STREAK_CHAIN_WINDOW);  // 刚好在窗口内
    expect(streak.n).toBe(2);
  });

  it('层级阈值常量数目', () => {
    expect(KILL_STREAK_TIERS.length).toBe(4);
    expect(KILL_STREAK_TIERS[0].min).toBe(10);
    expect(KILL_STREAK_TIERS[3].min).toBe(100);
  });
});

describe('killStreakTierFrame（A1 图集帧映射）', () => {
  it('KILL_STREAK_ART_KEY 已填入', () => {
    expect(KILL_STREAK_ART_KEY).toBe('kill-streak');
  });

  it('3–9 → streak-tier-1（tier-1 兜底）', () => {
    for (let n = 3; n <= 9; n++) expect(killStreakTierFrame(n)).toBe('streak-tier-1');
  });

  it('10 → streak-tier-1（阈值0 对应 tier-1）', () => {
    expect(killStreakTierFrame(10)).toBe('streak-tier-1');
  });

  it('25 → streak-tier-2', () => {
    expect(killStreakTierFrame(25)).toBe('streak-tier-2');
    expect(killStreakTierFrame(49)).toBe('streak-tier-2');
  });

  it('50 → streak-tier-3', () => {
    expect(killStreakTierFrame(50)).toBe('streak-tier-3');
    expect(killStreakTierFrame(99)).toBe('streak-tier-3');
  });

  it('100 → streak-tier-4', () => {
    expect(killStreakTierFrame(100)).toBe('streak-tier-4');
    expect(killStreakTierFrame(999)).toBe('streak-tier-4');
  });
});
