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
  }

  /** 收到 effect_triggered 且 ruleId 以 'pet-' 开头时调用。 */
  triggerAttack(tick: number): void {
    // 攻击动画约 1 秒（30 帧）
    this.attackUntilTick = tick + 30;
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
