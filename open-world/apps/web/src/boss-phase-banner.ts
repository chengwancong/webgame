/**
 * FP2 首领阶段横幅 – 纯逻辑类（无 Phaser 导入）+ Phaser 薄渲染层。
 * 美术占位 A2：纯色半透明横条 + 文字。后换底图只改 BOSS_BANNER_ART_KEY。
 */
import type Phaser from 'phaser';
import {resolvedToken, type TokenName} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {STAGE} from './stage.ts';
import {screenOrigin} from './world-chunks.ts';

// ─── 美术占位 ───────────────────────────────────────────────────────────────
/** 后换底图 PNG（1200×160）时只改此常量；'' = 纯色占位。 */
export const BOSS_BANNER_ART_KEY = '';

const BANNER_DURATION = 66;  // ~2.2s × 30 Hz
const FADE_IN = 9;
const FADE_OUT = 12;

// ─── 纯逻辑 ─────────────────────────────────────────────────────────────────

/**
 * 纯逻辑首领阶段横幅控制器。不导入 Phaser。
 * 每局记录已展示过的 (enemyId, phase) 组合，避免重复触发。
 */
export class BossPhaseBanner {
  private shown = new Set<string>();
  /** 上次触发的信息（null = 当前无展示）。 */
  private current: {bossName: string; phase: number; startTick: number; text?: string} | null = null;

  /**
   * 登记一次 phase_changed 事件。
   * @param enemyId 首领 id
   * @param bossName 首领显示名称
   * @param phase 新阶段编号（≥2）
   * @param tick 当前 tick
   * @returns triggered - 是否实际触发横幅
   */
  consume(enemyId: string, bossName: string, phase: number, tick: number): {triggered: boolean} {
    if (phase < 2) return {triggered: false};
    const key = `${enemyId}:${phase}`;
    if (this.shown.has(key)) return {triggered: false};
    this.shown.add(key);
    this.current = {bossName, phase, startTick: tick};
    return {triggered: true};
  }

  /** 非阶段的场地提示（例如 FP4 引雷桩全碎「护盾破碎」）共用同一横幅；同一 key 一局只提示一次。 */
  announce(key: string, text: string, tick: number): {triggered: boolean} {
    if (this.shown.has(key)) return {triggered: false};
    this.shown.add(key);
    this.current = {bossName: '', phase: 0, startTick: tick, text};
    return {triggered: true};
  }

  /** 返回当前横幅展示进度 0–1，超出展示窗口后返回 null（已结束）。 */
  progress(tick: number): number | null {
    if (!this.current) return null;
    const age = tick - this.current.startTick;
    if (age >= BANNER_DURATION) {this.current = null; return null;}
    return age / BANNER_DURATION;
  }

  get currentInfo(): {bossName: string; phase: number; text?: string} | null {
    return this.current ? {bossName: this.current.bossName, phase: this.current.phase, text: this.current.text} : null;
  }

  /** 计算 alpha：淡入 + 持续 + 淡出；结束时清空 current。 */
  alpha(tick: number): number {
    if (!this.current) return 0;
    const age = tick - this.current.startTick;
    if (age < 0) return 0;
    if (age >= BANNER_DURATION) {this.current = null; return 0;}
    if (age < FADE_IN) return age / FADE_IN;
    if (age >= BANNER_DURATION - FADE_OUT) return (BANNER_DURATION - age) / FADE_OUT;
    return 1;
  }

  /** 重置（切区/重开副本）。 */
  reset(): void {
    this.shown.clear();
    this.current = null;
  }
}

// ─── Phaser 渲染层 ───────────────────────────────────────────────────────────
const uiColor = (name: TokenName) => Number.parseInt(resolvedToken(name).slice(1), 16);
const BANNER_H = 80;
const VIGNETTE_ALPHA = 0.18;

export class BossPhaseBannerRenderer {
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private vignette: Phaser.GameObjects.Graphics | undefined;

  constructor(
    private scene: Phaser.Scene,
    private banner: BossPhaseBanner,
    vignetteRef: () => Phaser.GameObjects.Graphics | undefined,
  ) {
    const fontFamily = resolvedToken('Font.Family');

    this.bar = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(19600)
      .setAlpha(0);

    this.label = scene.add.text(
      STAGE.width / 2,
      72,
      '',
      {
        resolution: worldTextResolution(),
        fontFamily,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#' + uiColor('Color.World.Text').toString(16).padStart(6, '0'),
        stroke: '#' + uiColor('Color.World.Ink').toString(16).padStart(6, '0'),
        strokeThickness: 4,
        align: 'center',
      },
    ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(19601).setAlpha(0);

    // 暂存 vignette 引用获取函数
    this._vignetteRef = vignetteRef;
  }

  private _vignetteRef: () => Phaser.GameObjects.Graphics | undefined;

  update(tick: number): void {
    const info = this.banner.currentInfo;
    const alpha = this.banner.alpha(tick);

    if (!info || alpha <= 0) {
      this.bar.setAlpha(0);
      this.label.setAlpha(0);
      return;
    }

    // 横幅底图（占位：纯色半透明条）
    const camera = this.scene.cameras.main;
    const origin = screenOrigin(camera);
    const bw = camera.width / camera.zoom;
    // 横幅放在屏幕上部约 22% 处，避开顶部首领血条。
    const top = Math.round(camera.height / camera.zoom * 0.22) - BANNER_H / 2;

    this.bar.clear()
      .setPosition(origin.x, origin.y)
      .setAlpha(alpha);
    // 中段实色，左右各 8 条由透明渐到实色（简单渐隐）
    const w = 40;
    this.bar.fillStyle(0x000000, 0.55);
    this.bar.fillRect(8 * w, top, bw - 16 * w, BANNER_H);
    for (let i = 0; i < 8; i++) {
      this.bar.fillStyle(0x000000, (i + 1) / 8 * 0.55);
      this.bar.fillRect(i * w, top, w, BANNER_H);
      this.bar.fillRect(bw - (i + 1) * w, top, w, BANNER_H);
    }

    const phaseLabel = info.text ?? (info.phase === 2
      ? `${info.bossName} · 狂暴`
      : `${info.bossName} · 第${info.phase}阶段`);

    this.label
      .setText(phaseLabel)
      .setPosition(origin.x + bw / 2, origin.y + top + BANNER_H / 2)
      .setAlpha(alpha);

    // 短暂暗角加深
    const vig = this._vignetteRef();
    if (vig) {
      vig.setPosition(origin.x, origin.y);
      const w = camera.width / camera.zoom;
      const h = camera.height / camera.zoom;
      const vigAlpha = alpha * VIGNETTE_ALPHA;
      for (let i = 0; i < 6; i++) {
        const inset = i * 8;
        vig.fillStyle(0x000000, vigAlpha * (1 - i / 6) ** 2);
        vig.fillRect(inset, inset, 6, h - inset * 2);
        vig.fillRect(w - inset - 6, inset, 6, h - inset * 2);
        vig.fillRect(inset, inset, w - inset * 2, 6);
        vig.fillRect(inset, h - inset - 6, w - inset * 2, 6);
      }
    }
  }

  destroy(): void {
    this.bar.destroy();
    this.label.destroy();
  }
}
