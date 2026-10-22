/**
 * FP3 本场评价 S/A/B – 纯逻辑函数（无 Phaser / 无 DOM 导入）。
 * 用时 ≤ 下限 → S，≤ 上限 → A，其余 → B。raid 类型无评价。
 * 美术占位 A3：圆形描边 + 大字母。后换图集时只改 gradeStampHtml 里的资源获取方式。
 *
 * 时长来源：frame.definition.policy.timeLimitSeconds - frame.remainingSeconds
 * 类型来源：frame.definition.hub?.kind
 */

/** M03 §3.1 中各副本类型的目标用时范围（秒）。raid 无评价。 */
export const KIND_BOUNDS: Record<string, {s: number; a: number} | undefined> = {
  story:    {s: 240, a: 360},  // 4–6 min
  nest:     {s: 300, a: 480},  // 5–8 min
  hunt:     {s: 120, a: 240},  // 2–4 min
  tide:     {s: 240, a: 360},  // 4–6 min
  treasure: {s: 120, a: 240},  // 2–4 min
  gate:     {s: 180, a: 300},  // 3–5 min
  abyss:    {s: 120, a: 240},  // 2–4 min
  weekly:   {s: 180, a: 360},  // 3–6 min
  // raid: 无评价 → undefined
};

export type RunGrade = 'S' | 'A' | 'B';

export interface GradeResult {
  grade: RunGrade;
  /** 距 S 还差多少秒（grade=S 时为 0）。 */
  secondsToS: number;
  /** 距 A 还差多少秒（grade=A 或 S 时为 0）。 */
  secondsToA: number;
}

/**
 * 根据用时和副本类型计算评价。
 * @param elapsedSeconds 本场实际用时（秒）
 * @param kind 副本 kind（来自 frame.definition.hub?.kind）
 * @returns null = 无评价（raid / kind 缺失）
 */
export function gradeRun(elapsedSeconds: number, kind: string | undefined, partial = false): GradeResult | null {
  if (!kind) return null;
  const bounds = KIND_BOUNDS[kind];
  if (!bounds) return null;  // raid 或未知类型

  // 寻宝到时也算成功：没开满五箱只能评 B，否则 180 秒限时会白送 A。
  const grade: RunGrade =
    partial ? 'B' :
    elapsedSeconds <= bounds.s ? 'S' :
    elapsedSeconds <= bounds.a ? 'A' : 'B';

  const secondsToS = Math.max(0, Math.ceil(elapsedSeconds - bounds.s));
  const secondsToA = Math.max(0, Math.ceil(elapsedSeconds - bounds.a));

  return {grade, secondsToS, secondsToA};
}

// ─── HTML 辅助（仅字符串，无 DOM）──────────────────────────────────────────

/**
 * A3 评价章印。默认显示 128px；紧凑场合可通过 size 参数或 CSS 缩至 64px。
 * 使用 /art/hub-fun/grade-{s,a,b}.png，图片缺失时不会显示（无回退占位）。
 */
export function gradeStampHtml(grade: RunGrade, size = 128): string {
  const g = grade.toLowerCase();
  return `<span class="run-grade-stamp run-grade-${g}" aria-label="评价${grade}" style="display:inline-block;line-height:1">` +
    `<img src="/art/hub-fun/grade-${g}.png" alt="${grade}" width="${size}" height="${size}" draggable="false">` +
    `</span>`;
}

/** 生成本场评价完整 HTML 片段，注入 hub-result-right 的 extra 区。 */
export function runGradeHtml(elapsedSeconds: number, kind: string | undefined, partial = false): string {
  const result = gradeRun(elapsedSeconds, kind, partial);
  if (!result) return '';

  const {grade, secondsToS, secondsToA} = result;
  const hint =
    grade === 'S' ? '' :
    partial ? '<p class="run-grade-hint">开满五个宝箱才能评 A 以上</p>' :
    grade === 'A' ? `<p class="run-grade-hint">再快 <b>${secondsToS}</b> 秒可得 S</p>` :
    `<p class="run-grade-hint">再快 <b>${secondsToA}</b> 秒可得 A · 再快 <b>${secondsToS}</b> 秒可得 S</p>`;

  return `<div class="run-grade-block">${gradeStampHtml(grade)}<div class="run-grade-info"><span class="run-grade-label">本场评价</span>${hint}</div></div>`;
}
