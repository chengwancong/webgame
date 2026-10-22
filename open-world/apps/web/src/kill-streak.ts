/**
 * FP1 连斩 – 纯逻辑类（无 Phaser 导入）+ Phaser 薄渲染层。
 * 美术占位 A1：用世界文字 Token 字体 + 描边，后换图集只改 KILL_STREAK_ART_KEY。
 */
import type Phaser from 'phaser';
import {resolvedToken,type TokenName} from './ui/tokens.ts';
import {worldTextResolution} from './ui/world-text.ts';
import {screenOrigin} from './world-chunks.ts';

// ─── 美术 ─────────────────────────────────────────────────────────────────────
/** A1 连斩图集 key（对应 /art/hub-fun/kill-streak.{png,json}）。 */
export const KILL_STREAK_ART_KEY = 'kill-streak';

/** 在 scene.preload() 里调用；若 key 已存在则跳过重复加载。 */
export function preloadKillStreakArt(scene: Phaser.Scene): void {
  if (!KILL_STREAK_ART_KEY || scene.textures.exists(KILL_STREAK_ART_KEY)) return;
  scene.load.atlas(KILL_STREAK_ART_KEY, '/art/hub-fun/kill-streak.png', '/art/hub-fun/kill-streak.json');
}

/** 根据当前 n 返回对应的图集帧名（tier glyph）。 */
export function killStreakTierFrame(n: number): string {
  const idx = Math.max(0, killStreakTierIndex(n));  // -1（3–9）映射到 0 → tier-1
  return `streak-tier-${idx + 1}`;
}

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

// 图集帧高度（源图像素）→ 显示高度（px）
const TIER_DISPLAY_H = 48;   // 源96px → 显示48px
const DIGIT_DISPLAY_H = 36;  // 源72px → 显示36px

/** 在场景右侧中部渲染连斩计数（scrollFactor 0，固定屏幕位置）。 */
export class KillStreakRenderer {
  private text: Phaser.GameObjects.Text;
  private tierText: Phaser.GameObjects.Text;
  // 图集可用时替换文字
  private atlasSprites?: {tier: Phaser.GameObjects.Sprite; x: Phaser.GameObjects.Sprite; digits: Phaser.GameObjects.Sprite[]};

  constructor(private scene: Phaser.Scene, private streak: KillStreak, private motionReduced: () => boolean) {
    const x = 0, y = 0;
    const fontFamily = resolvedToken('Font.Family');
    this.text = scene.add.text(x, y, '', {
      resolution: worldTextResolution(), fontFamily, fontSize: '32px', fontStyle: 'bold',
      color: '#' + uiColor('Color.Combat.Elite').toString(16).padStart(6, '0'),
      stroke: '#' + uiColor('Color.World.Ink').toString(16).padStart(6, '0'),
      strokeThickness: 4, align: 'right',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(19500).setAlpha(0);
    this.tierText = scene.add.text(x, y - 26, '', {
      resolution: worldTextResolution(), fontFamily, fontSize: '18px', fontStyle: 'bold',
      color: '#' + uiColor('Color.World.Text').toString(16).padStart(6, '0'),
      stroke: '#' + uiColor('Color.World.Ink').toString(16).padStart(6, '0'),
      strokeThickness: 3, align: 'right',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(19500).setAlpha(0);

    if (KILL_STREAK_ART_KEY && scene.textures.exists(KILL_STREAK_ART_KEY)) {
      const k = KILL_STREAK_ART_KEY;
      const mk = (frame: string) => scene.add.sprite(0, 0, k, frame).setScrollFactor(0).setDepth(19500).setAlpha(0);
      this.atlasSprites = {
        tier: mk('streak-tier-1'),
        x: mk('streak-x'),
        digits: [mk('streak-digit-0'), mk('streak-digit-0'), mk('streak-digit-0'), mk('streak-digit-0')],
      };
    }
  }

  /**
   * 每帧调用。tick 为世界 tick（用于计算淡出）。
   * motionOk 时 rose=true 会做缩放弹动（层级升级），减少动态时直接切换。
   */
  update(tick: number, rose: boolean): void {
    const s = this.streak;
    const hideAll = () => {
      this.text.setAlpha(0); this.tierText.setAlpha(0);
      if (this.atlasSprites) {this.atlasSprites.tier.setAlpha(0); this.atlasSprites.x.setAlpha(0); for (const d of this.atlasSprites.digits) d.setAlpha(0);}
    };

    if (!s.visible) {hideAll(); return;}

    const idle = s.idleTicks(tick);
    const chainActive = idle <= KILL_STREAK_CHAIN_WINDOW;
    let alpha: number;
    if (chainActive) {alpha = 1;}
    else {const fadeT = (idle - KILL_STREAK_CHAIN_WINDOW) / FADE_WINDOW; alpha = Math.max(0, 1 - fadeT);}
    if (alpha <= 0) {hideAll(); return;}

    const cam = this.scene.cameras.main, origin = screenOrigin(cam);
    const rx = origin.x + cam.width / cam.zoom - 24;
    const cy = origin.y + cam.height / cam.zoom / 2;

    if (this.atlasSprites) {
      // ── 图集渲染路径 ──────────────────────────────────────────────────────
      this.text.setAlpha(0); this.tierText.setAlpha(0);
      const as = this.atlasSprites;

      // tier glyph（行一：48px 高）
      const tierFrame = killStreakTierFrame(s.n);
      as.tier.setFrame(tierFrame).setAlpha(alpha).setOrigin(1, 0.5);
      if (as.tier.height > 0) as.tier.setScale(TIER_DISPLAY_H / as.tier.height);
      as.tier.setPosition(rx, cy - TIER_DISPLAY_H / 2 - 4).setScrollFactor(0);

      // 数字行（行二：× + digits，右对齐，36px 高）
      const countStr = String(s.n);
      const digitCount = Math.min(countStr.length, as.digits.length);

      // 隐藏多余 digit 槽
      for (let i = digitCount; i < as.digits.length; i++) as.digits[i].setAlpha(0);

      // 设置帧后计算各 sprite 宽度，从右向左排列
      as.x.setFrame('streak-x').setAlpha(alpha).setOrigin(1, 0.5);
      if (as.x.height > 0) as.x.setScale(DIGIT_DISPLAY_H / as.x.height);
      for (let i = 0; i < digitCount; i++) {
        const d = as.digits[i];
        d.setFrame(`streak-digit-${countStr[i]}`).setAlpha(alpha).setOrigin(1, 0.5);
        if (d.height > 0) d.setScale(DIGIT_DISPLAY_H / d.height);
      }

      // 从右向左布局：最后一位数字 → 前一位 → … → "×"
      let cx = rx;
      for (let i = digitCount - 1; i >= 0; i--) {
        as.digits[i].setPosition(cx, cy + DIGIT_DISPLAY_H / 2 + 2).setScrollFactor(0);
        cx -= as.digits[i].displayWidth + 1;
      }
      as.x.setPosition(cx, cy + DIGIT_DISPLAY_H / 2 + 2).setScrollFactor(0);

      // 层级升级弹动（仅 tier sprite）
      if (rose && !this.motionReduced()) {
        const baseScale = as.tier.scaleX;
        as.tier.setScale(baseScale * 1.4);
        this.scene.tweens.add({targets: as.tier, scaleX: baseScale, scaleY: baseScale, duration: 220, ease: 'Back.Out'});
      }
      return;
    }

    // ── 文字回退路径 ──────────────────────────────────────────────────────────
    this.text.setText(`×${s.n}`).setPosition(rx, cy).setAlpha(alpha);
    this.tierText.setText(s.label).setPosition(rx, cy - 26).setAlpha(alpha);
    if (rose && !this.motionReduced()) {
      this.text.setScale(1.4); this.tierText.setScale(1.4);
      this.scene.tweens.add({targets: [this.text, this.tierText], scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.Out'});
    }
  }

  destroy(): void {
    this.text.destroy(); this.tierText.destroy();
    if (this.atlasSprites) {this.atlasSprites.tier.destroy(); this.atlasSprites.x.destroy(); for (const d of this.atlasSprites.digits) d.destroy();}
  }
}
