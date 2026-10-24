/**
 * Z3 宠物跟随者：在副本/野外场景把上阵宠物渲染在玩家身后约 1.2 格。
 * 图集格式：/art/starsea/pets/v3/<family>/actor.webp + actor.json（与怪物图集同格式）。
 * 资源不存在时静默跳过，不影响战斗。
 */
import type Phaser from 'phaser';
import {project} from '../iso.ts';

const PET_OFFSET_WORLD = {dx: -0.8, dy: -0.4};  // 玩家身后（等距北偏）
type PetRuntimeArt = {image: string; atlas: string; scale: number; anchor: [number, number]};
let manifest: Promise<Map<string, PetRuntimeArt>> | undefined;
/** 宠物图集清单（每个形态的图集路径、缩放、锚点），整局只拉一次；失败返回空表。 */
function petManifest() {
  manifest ??= fetch('/art/starsea/pets/v3/manifest.json').then(r => r.json()).then((m: {assets: {id: string; runtime: PetRuntimeArt}[]}) => new Map(m.assets.map(a => [a.id, a.runtime]))).catch(() => new Map());
  return manifest;
}
const byIndex = (a: string, b: string) => Number(a.split('_').pop()) - Number(b.split('_').pop());

export type PetFollowerDeps = {
  scene: Phaser.Scene;
  /** 宠物 runtime id，如 ss-pet-wind-free-young。null 表示没有上阵宠物。 */
  runtime: string | null;
};

/** 宠物跟随者渲染单元。调用者管理生命周期（destroy 时清理 Phaser 对象）。 */
export class PetFollower {
  private sprite?: Phaser.GameObjects.Sprite;
  private shadow?: Phaser.GameObjects.Ellipse;
  private scene: Phaser.Scene;
  private runtime: string | null = null;
  private loaded = false;
  private errored = false;
  private attackUntilTick = 0;
  /** arc 连锁反馈：在这个 tick 之前保持连锁色调（蓝金）。 */
  private chainFlashUntilTick = 0;
  /** 护盾生效反馈：在这个 tick 之前保持护盾色调（浅蓝）。 */
  private shieldFlashUntilTick = 0;
  private art?: PetRuntimeArt;

  constructor(private deps: PetFollowerDeps) {
    this.scene = deps.scene;
    if (deps.runtime) this.init(deps.runtime);
  }

  /** 每帧调用：更新位置、动画。 */
  update(heroX: number, heroY: number, tick: number, newRuntime: string | null): void {
    // 如果上阵宠物变了，重建
    if (newRuntime !== this.runtime) {
      this.destroySprites();
      this.errored = false;
      this.runtime = newRuntime;
      if (newRuntime) this.init(newRuntime);
    }
    if (!this.sprite || !this.loaded || this.errored) return;

    const wx = heroX + PET_OFFSET_WORLD.dx;
    const wy = heroY + PET_OFFSET_WORLD.dy;
    const p = project({x: wx, y: wy});

    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(p.y + 1);  // 略在英雄前面的深度层（英雄 depth = p.y + 2）
    if (this.shadow) {
      this.shadow.setPosition(p.x, p.y + 2);
      this.shadow.setDepth(p.y);
    }

    // 动画：攻击 > idle
    const attacking = tick < this.attackUntilTick;
    const anim = attacking ? `${this.runtime}-attack` : `${this.runtime}-idle`;
    if (this.sprite.anims.isPlaying && this.sprite.anims.currentAnim?.key === anim) return;
    if (this.scene.anims.exists(anim)) {
      this.sprite.play(anim, true);
    }

    // 轻量色调反馈（复用 Phaser 内置 tint，不新增美术资源）
    if (tick < this.shieldFlashUntilTick) {
      // 护盾：浅蓝色调
      this.sprite.setTint(0x88ccff);
    } else if (tick < this.chainFlashUntilTick) {
      // 连锁：金色调
      this.sprite.setTint(0xffdd88);
    } else {
      this.sprite.clearTint();
    }
  }

  /** 收到宠物伤害类 / shield-cast 事件时调用，播放攻击动画（约 1 秒 = 30 帧）。 */
  triggerAttack(tick: number): void {
    this.attackUntilTick = tick + 30;
  }

  /**
   * 收到 arc 连锁事件时调用（同时也会调用 triggerAttack）。
   * 在攻击动画结束后维持约 20 帧的金色调，用于轻量的连锁视觉反馈。
   */
  triggerChain(tick: number): void {
    this.chainFlashUntilTick = tick + 50;  // 攻击 30 帧 + 连锁余韵 20 帧
  }

  /**
   * 收到宠物护盾生效事件（shielded shieldPhase==='applied'）时调用。
   * 短暂浅蓝色调，复用 Phaser tint，不新增美术资源。
   */
  triggerShieldFlash(tick: number): void {
    this.shieldFlashUntilTick = tick + 25;
  }

  destroy(): void {
    this.destroySprites();
  }

  private init(runtime: string): void {
    this.runtime = runtime;
    this.loaded = false;
    void petManifest().then(arts => {
      const art = arts.get(runtime);
      if (this.runtime !== runtime) return;  // 已被切换，放弃
      if (!art) { this.errored = true; return; }
      this.art = art;
      const key = 'pet-follower-' + art.atlas;
      if (this.scene.textures.exists(key)) { this.buildSprite(runtime, key); return; }
      this.scene.load.once(`filecomplete-atlas-${key}`, () => this.buildSprite(runtime, key));
      this.scene.load.once('loaderror', (file: {key: string}) => { if (file.key === key) this.errored = true; });  // 静默：资源不存在不影响战斗
      this.scene.load.atlas(key, art.image, art.atlas);
      this.scene.load.start();
    });
  }

  private buildSprite(runtime: string, textureKey: string): void {
    if (this.runtime !== runtime) return;
    // 注册动画（若未注册）
    if (!this.scene.sys || !this.art) return;
    const idleAnim = `${runtime}-idle`;
    const attackAnim = `${runtime}-attack`;
    if (!this.scene.anims.exists(idleAnim)) {
      const tex = this.scene.textures.get(textureKey);
      const idleFrames = tex.getFrameNames().filter(f => f.startsWith('idle_')).sort(byIndex);
      const attackFrames = tex.getFrameNames().filter(f => f.startsWith('attack_')).sort(byIndex);
      if (idleFrames.length) {
        this.scene.anims.create({key: idleAnim, frames: idleFrames.map(f => ({key: textureKey, frame: f})), frameRate: 12, repeat: -1});
      }
      if (attackFrames.length) {
        this.scene.anims.create({key: attackAnim, frames: attackFrames.map(f => ({key: textureKey, frame: f})), frameRate: 16, repeat: 0});
      }
    }

    // 阴影椭圆
    this.shadow = this.scene.add.ellipse(0, 0, 36, 12, 0x000000, 0.25);

    // 宠物 sprite
    const firstFrame = this.scene.textures.get(textureKey).getFrameNames().find(f => f.startsWith('idle_')) ?? '__BASE';
    this.sprite = this.scene.add.sprite(0, 0, textureKey, firstFrame);
    this.sprite.setScale(this.art.scale);
    this.sprite.setOrigin(this.art.anchor[0], this.art.anchor[1]);

    this.loaded = true;
  }

  private destroySprites(): void {
    this.sprite?.destroy();
    this.shadow?.destroy();
    this.sprite = undefined;
    this.shadow = undefined;
    this.loaded = false;
  }
}
