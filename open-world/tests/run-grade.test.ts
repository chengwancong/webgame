import {describe, it, expect} from 'vitest';
import {gradeRun, runGradeHtml, KIND_BOUNDS} from '../apps/web/src/hub/run-grade.ts';

describe('gradeRun', () => {
  it('kind 缺失返回 null', () => {
    expect(gradeRun(200, undefined)).toBeNull();
    expect(gradeRun(200, '')).toBeNull();
  });

  it('raid 无评价', () => {
    expect(gradeRun(200, 'raid')).toBeNull();
  });

  it('未知类型返回 null', () => {
    expect(gradeRun(200, 'unknown-kind')).toBeNull();
  });

  describe('story（240–360s）', () => {
    it('≤ 240s → S', () => {
      const r = gradeRun(240, 'story')!;
      expect(r.grade).toBe('S');
      expect(r.secondsToS).toBe(0);
      expect(r.secondsToA).toBe(0);
    });

    it('241s → A', () => {
      const r = gradeRun(241, 'story')!;
      expect(r.grade).toBe('A');
      expect(r.secondsToS).toBe(1);
      expect(r.secondsToA).toBe(0);
    });

    it('≤ 360s → A', () => {
      const r = gradeRun(360, 'story')!;
      expect(r.grade).toBe('A');
    });

    it('361s → B', () => {
      const r = gradeRun(361, 'story')!;
      expect(r.grade).toBe('B');
      expect(r.secondsToA).toBe(1);
      expect(r.secondsToS).toBeGreaterThan(1);
    });
  });

  describe('hunt（120–240s）', () => {
    it('120s → S', () => expect(gradeRun(120, 'hunt')!.grade).toBe('S'));
    it('121s → A', () => expect(gradeRun(121, 'hunt')!.grade).toBe('A'));
    it('240s → A', () => expect(gradeRun(240, 'hunt')!.grade).toBe('A'));
    it('241s → B', () => expect(gradeRun(241, 'hunt')!.grade).toBe('B'));
  });

  describe('abyss（120–240s）', () => {
    it('100s → S（比下限快）', () => {
      const r = gradeRun(100, 'abyss')!;
      expect(r.grade).toBe('S');
      expect(r.secondsToS).toBe(0);
    });
  });

  describe('weekly（180–360s）', () => {
    it('180s → S', () => expect(gradeRun(180, 'weekly')!.grade).toBe('S'));
    it('360s → A', () => expect(gradeRun(360, 'weekly')!.grade).toBe('A'));
    it('361s → B', () => expect(gradeRun(361, 'weekly')!.grade).toBe('B'));
  });

  it('secondsToS 向上取整', () => {
    const r = gradeRun(241.3, 'story')!;  // 超 240s 1.3s
    expect(r.secondsToS).toBe(2);  // Math.ceil(1.3)
  });

  it('KIND_BOUNDS 覆盖 8 种可评类型', () => {
    const gradeable = Object.entries(KIND_BOUNDS).filter(([, v]) => v !== undefined);
    expect(gradeable.length).toBe(8);
  });
});

describe('runGradeHtml', () => {
  it('无评价（raid）返回空串', () => {
    expect(runGradeHtml(200, 'raid')).toBe('');
    expect(runGradeHtml(200, undefined)).toBe('');
  });

  it('S 评价包含 run-grade-s 与 grade-s.png img', () => {
    const html = runGradeHtml(100, 'abyss');
    expect(html).toContain('run-grade-s');
    expect(html).toContain('grade-s.png');
    expect(html).toContain('alt="S"');
  });

  it('A 评价包含「距 S 还差」提示与 grade-a.png', () => {
    const html = runGradeHtml(200, 'hunt');  // 超 120s（S线）80s → A
    expect(html).toContain('可得 S');
    expect(html).toContain('run-grade-a');
    expect(html).toContain('grade-a.png');
  });

  it('B 评价包含「可得 A」和「可得 S」双提示与 grade-b.png', () => {
    const html = runGradeHtml(300, 'hunt');  // 超 240s → B
    expect(html).toContain('可得 A');
    expect(html).toContain('可得 S');
    expect(html).toContain('grade-b.png');
  });
});

describe('寻宝未开满', () => {
  it('到时成功但没开满五箱只能评 B，并提示开满', () => {
    expect(gradeRun(60, 'treasure', true)?.grade).toBe('B');
    expect(gradeRun(60, 'treasure')?.grade).toBe('S');
    expect(runGradeHtml(180, 'treasure', true)).toContain('开满五个宝箱');
  });
});
