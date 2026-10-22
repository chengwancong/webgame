/**
 * FP1 连斩 – 纯逻辑类（无 Phaser 导入）+ Phaser 薄渲染层。
 * 美术占位 A1：用世界文字 Token 字体 + 描边，后换图集只改 KILL_STREAK_ART_KEY。
 */
import type Phaser from 'phaser';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {screenOrigin} from './world-chunks.ts';

// ─── 美术占位 ───────────────────────────────────────────────────────────────
/** 后换图集时只改此常量；目前为文字占位。 */
export const KILL_STREAK_ART_KEY = '';  // '' = 文字占位；填入 atlas key 后换图

// ─── 纯逻辑 ─────────────────────────────────────────────────────────────────
export const KILL_STREAK_CHAIN_WINDOW = 90;  // 3 秒 × 30 Hz
export const KILL_STREAK_MIN_SHOW = 3;

/** threshold → tier label。四档依次对应连斩/横扫/无双/神威。 */
export const KILL_STREAK_TIERS: ReadonlyArray<{min: number; label: string}> = [
  {min: 10, label: '连斩'},
  {min: 25, label: '横扫'},
  {min: 50, label: '无双'},
  {min: 100, label: '神威'},
] as const;

/** 根据当前 N 返回对应的层级标签，N < 10 时返回默认标签「连斩」。 */
export function killStreakTierLabel(n: number): string {
  for (let i = KILL_STREAK_TIERS.length - 1; i >= 0; i--) {
    if (n >= KILL_STREAK_TIERS[i].min) return KILL_STREAK_TIERS[i].label;
  }
  return '连斩';  // 3–9 默认
}

/** 返回 n 对应的层级索引（-1 = 未到任何层级阈值）。 */
export function killStreakTierIndex(n: number): number {
  for (let i = KILL_STREAK_TIERS.length - 1; i >= 0; i--) {
    if (n >= KILL_STREAK_TIERS[i].min) return i;
  }
  return -1;
}

/**
 * 纯逻辑连斩计数器。不导入 Phaser。
 * 在服务端权威世界里，同一 id 的 entity_died 可能在连续快照里重复出现，
 * 必须用 seen 集合去重（每局开始时或切区时调用 reset()）。
 */
export class KillStreak {
  private count = 0;
  private lastKillTick = -Infinity;
  private seen = new Set<string>();
  private prevTierIndex = -1;

  /**
   * 登记一次击杀。
   * @returns rose - 是否触发层级升级（需要播放弹动特效）
   */
  consume(enemyId: string, tick: number): {rose: boolean} {
    if (this.seen.has(enemyId)) return {rose: false};
    this.seen.add(enemyId);

    const chainBroke = this.count > 0 && (tick - this.lastKillTick) > KILL_STREAK_CHAIN_WINDOW;
    if (chainBroke) {
      this.count = 0;
      this.prevTierIndex = -1;
    }

    this.count++;
    this.lastKillTick = tick;

    const ti = killStreakTierIndex(this.count);
    const rose = ti >= 0 && ti > this.prevTierIndex;
    if (ti > this.prevTierIndex) this.prevTierIndex = ti;
    return {rose};
  }

  get n(): number {return this.count;}
  get visible(): boolean {return this.count >= KILL_STREAK_MIN_SHOW;}
  get label(): string {return killStreakTierLabel(this.count);}

  /** 距上次击杀的空闲 tick 数；从未击杀时返回 Infinity。 */
  idleTicks(currentTick: number): number {
    return Number.isFinite(this.lastKillTick) ? currentTick - this.lastKillTick : Infinity;
  }

  /** 重置整局（切区、重开副本）。 */
  reset(): void {
    this.count = 0;
    this.lastKillTick = -Infinity;
    this.seen.clear();
    this.prevTierIndex = -1;
  }
}

// ─── Phaser 渲染层 ───────────────────────────────────────────────────────────
const FADE_WINDOW = 30;  // 链断后 1 秒（30 tick）淡出

const uiColor = (name: TokenName) => Number.parseInt(resolvedToken(name).slice(1), 16);

/** 在场景右侧中部渲染连斩计数（scrollFactor 0，固定屏幕位置）。 */
export class KillStreakRenderer {
  private text: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private streak: KillStreak, private motionReduced: () => boolean) {
    const x = 0, y = 0;  // 每帧按相机换算到屏幕右侧中部

    const fontFamily = resolvedToken('Font.Family');

    this.text = scene.add.text(x, y, '', {
      resolution: worldTextResolution(),
      fontFamily,
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#' + uiColor('Color.Combat.Elite').toString(16).padStart(6, '0'),
      stroke: '#' + uiColor('Color.World.Ink').toString(16).padStart(6, '0'),
      strokeThickness: 4,
      align: 'right',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(19500).setAlpha(0);

    this.tierText = scene.add.text(x, y - 26, '', {
      resolution: worldTextResolution(),
      fontFamily,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#' + uiColor('Color.World.Text').toString(16).padStart(6, '0'),
      stroke: '#' + uiColor('Color.World.Ink').toString(16).padStart(6, '0'),
      strokeThickness: 3,
      align: 'right',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(19500).setAlpha(0);
  }

  /**
   * 每帧调用。tick 为世界 tick（用于计算淡出）。
   * motionOk 时 rose=true 会做缩放弹动，否则直接切换。
   */
  update(tick: number, rose: boolean): void {
    const s = this.streak;

    if (!s.visible) {
      this.text.setAlpha(0);
      this.tierText.setAlpha(0);
      return;
    }

    const idle = s.idleTicks(tick);
    const chainActive = idle <= KILL_STREAK_CHAIN_WINDOW;

    // 淡出：链断后 FADE_WINDOW 内线性淡出
    let alpha: number;
    if (chainActive) {
      alpha = 1;
    } else {
      const fadeT = (idle - KILL_STREAK_CHAIN_WINDOW) / FADE_WINDOW;
      alpha = Math.max(0, 1 - fadeT);
    }

    if (alpha <= 0) {
      this.text.setAlpha(0);
      this.tierText.setAlpha(0);
      return;
    }

    // 相机有缩放：scrollFactor 0 的对象也要按 screenOrigin 换算，否则会偏出屏幕。
    const cam = this.scene.cameras.main, origin = screenOrigin(cam);
    const x = origin.x + cam.width / cam.zoom - 24, y = origin.y + cam.height / cam.zoom / 2;
    this.text.setText(`×${s.n}`).setPosition(x, y).setAlpha(alpha);
    this.tierText.setText(s.label).setPosition(x, y - 26).setAlpha(alpha);

    if (rose && !this.motionReduced()) {
      // 短暂缩放弹动（层级升级提示）
      this.text.setScale(1.4);
      this.tierText.setScale(1.4);
      this.scene.tweens.add({
        targets: [this.text, this.tierText],
        scaleX: 1, scaleY: 1,
        duration: 220,
        ease: 'Back.Out',
      });
    }
  }

  destroy(): void {
    this.text.destroy();
    this.tierText.destroy();
  }
}
