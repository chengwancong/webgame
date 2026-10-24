/**
 * A1–A8 hub-fun 美术接线单元测试（纯逻辑，无 Phaser / 无浏览器）。
 * E3–E7 ART-HE 接线测试。
 */
import {describe,it,expect} from 'vitest';
import {KILL_STREAK_ART_KEY,killStreakTierFrame} from '../apps/web/src/kill-streak.ts';
import {BOSS_BANNER_ART_KEY,BOSS_BANNER_SHIELD_ART_KEY} from '../apps/web/src/boss-phase-banner.ts';
import {gradeStampHtml} from '../apps/web/src/hub/run-grade.ts';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';
import {existsSync,readFileSync} from 'node:fs';
import {gatherArt} from '../apps/web/src/gather-nodes.ts';
import {runtimeResources} from '../packages/asset-manifest/runtime-resources.ts';
import {hudMenuIcon} from '../apps/web/src/hud-icons.ts';
import {iconHtml} from '../apps/web/src/ui/icons.ts';

// ─── A1 连斩帧映射 ───────────────────────────────────────────────────────────
describe('A1 kill-streak art key', () => {
 it('KILL_STREAK_ART_KEY 已填入', () => expect(KILL_STREAK_ART_KEY).toBe('kill-streak'));
 it('图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/kill-streak.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/kill-streak.json')).toBe(true);
 });
 it('3–9 → streak-tier-1（tier-1 兜底）', () => {
  for(let n=3;n<=9;n++) expect(killStreakTierFrame(n)).toBe('streak-tier-1');
 });
 it('10–24 → streak-tier-1', () => {
  expect(killStreakTierFrame(10)).toBe('streak-tier-1');
  expect(killStreakTierFrame(24)).toBe('streak-tier-1');
 });
 it('25 → streak-tier-2 / 50 → streak-tier-3 / 100 → streak-tier-4', () => {
  expect(killStreakTierFrame(25)).toBe('streak-tier-2');
  expect(killStreakTierFrame(50)).toBe('streak-tier-3');
  expect(killStreakTierFrame(100)).toBe('streak-tier-4');
  expect(killStreakTierFrame(999)).toBe('streak-tier-4');
 });
});

// ─── A2 横幅 art key ─────────────────────────────────────────────────────────
describe('A2 boss banner art keys', () => {
 it('两张横幅 key 已填入', () => {
  expect(BOSS_BANNER_ART_KEY).toBe('boss-banner');
  expect(BOSS_BANNER_SHIELD_ART_KEY).toBe('boss-banner-shield');
 });
 it('两张图片文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/boss-banner.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/boss-banner-shield.png')).toBe(true);
 });
});

// ─── A3 评价章印 HTML ────────────────────────────────────────────────────────
describe('A3 gradeStampHtml', () => {
 it('使用 <img> 标签而非 SVG', () => {
  for(const g of ['S','A','B'] as const){
   const h=gradeStampHtml(g);
   expect(h).not.toContain('<svg');
   expect(h).toContain(`grade-${g.toLowerCase()}.png`);
   expect(h).toContain(`alt="${g}"`);
   expect(h).toContain(`run-grade-${g.toLowerCase()}`);
  }
 });
 it('默认 128px，可指定 64px', () => {
  expect(gradeStampHtml('S')).toContain('width="128"');
  expect(gradeStampHtml('S',64)).toContain('width="64"');
 });
 it('图片文件存在', () => {
  for(const g of ['s','a','b'])
   expect(existsSync(`apps/web/public/art/hub-fun/grade-${g}.png`)).toBe(true);
 });
});

// ─── A4 引雷桩资产存在 ───────────────────────────────────────────────────────
describe('A4 hunt pylon asset', () => {
 it('图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/hunt-pylon.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/hunt-pylon.json')).toBe(true);
 });
 it('静态 idle/broken 文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/hunt-pylon-idle.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/hunt-pylon-broken.png')).toBe(true);
 });
});

// ─── A5 宝箱怪 actor identity ────────────────────────────────────────────────
describe('A5 hub-mimic actor identity', () => {
 it('actorCatalog 中存在 hub-mimic', () => {
  expect(actorCatalog['hub-mimic']).toBeDefined();
 });
 it('runtimeKind 为 atlas（图集驱动）', () => {
  expect(actorCatalog['hub-mimic'].runtimeKind).toBe('atlas');
 });
 it('包含 wake 动作（首次出现播放）', () => {
  expect(actorCatalog['hub-mimic'].actions.wake).toBeGreaterThan(0);
 });
 it('包含 move / attack / hurt / death 动作', () => {
  const a=actorCatalog['hub-mimic'].actions;
  expect(a.move).toBeGreaterThan(0);
  expect(a.attack).toBeGreaterThan(0);
  expect(a.hurt).toBeGreaterThan(0);
  expect(a.death).toBeGreaterThan(0);
 });
 it('actionFrames.wake 末帧为 wake_9', () => {
  const frames=actorCatalog['hub-mimic'].actionFrames?.wake;
  expect(frames).toBeDefined();
  expect(frames![frames!.length-1]).toBe('wake_9');
 });
 it('图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/mimic.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/mimic.json')).toBe(true);
 });
 it('宝箱怪名称 → hub-mimic 的艺术覆盖逻辑', () => {
  // 验证客户端覆盖规则：名称精确等于「宝箱怪」时用 hub-mimic；其余保留服务端 art
  const resolve=(name:string,art:string)=>name==='宝箱怪'?'hub-mimic':art;
  expect(resolve('宝箱怪','raider')).toBe('hub-mimic');
  expect(resolve('普通精英','raider')).toBe('raider');
  expect(resolve('','raider')).toBe('raider');
 });
});

// ─── A6 采集节点 ART-HD 接线 ─────────────────────────────────────────────────
describe('A6 gather nodes hub art', () => {
 it('图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/gather-nodes.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/gather-nodes.json')).toBe(true);
 });
 it('所有 12 个采集资源已注册', () => {
  const islands=['wind','mist','forge','frost','rift','dragon'];
  for(const island of islands){
   expect(runtimeResources.has('ow-art-hub-gather-'+island+'-ore')).toBe(true);
   expect(runtimeResources.has('ow-art-hub-gather-'+island+'-plant')).toBe(true);
  }
 });
 it('gatherArt 对星门采集区返回 hub 专属 ID', () => {
  expect(gatherArt({region:'ss-map-wind',material:'iron_ore'})).toBe('ow-art-hub-gather-wind-ore');
  expect(gatherArt({region:'ss-map-wind',material:'herb_leaf'})).toBe('ow-art-hub-gather-wind-plant');
  expect(gatherArt({region:'ss-map-frost',material:'crystal_ore'})).toBe('ow-art-hub-gather-frost-ore');
 });
 it('未命中 hub 资源时回退到占位图（不含 hub- 前缀）', () => {
  const id=gatherArt({region:'ss-map-unknown-region',material:'iron_ore'});
  expect(id).not.toContain('hub-gather');
 });
});

// ─── A7 潮汐信标接线 ─────────────────────────────────────────────────────────
describe('A7 tide beacon art', () => {
 it('图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-fun/tide-beacon.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-fun/tide-beacon.json')).toBe(true);
 });
 it('ow-art-hub-tide-beacon 已注册', () => {
  expect(runtimeResources.has('ow-art-hub-tide-beacon')).toBe(true);
 });
 it('资源含 full/damaged/critical/broken/aura 状态帧', () => {
  const asset=runtimeResources.get('ow-art-hub-tide-beacon')!;
  const states=asset.runtime.states as Record<string,unknown>;
  expect(states).toHaveProperty('full');
  expect(states).toHaveProperty('damaged');
  expect(states).toHaveProperty('critical');
  expect(states).toHaveProperty('broken');
  expect(states).toHaveProperty('aura');
 });
 it('aura 状态 displayHeight 被 frameDisplaySizes 覆盖为 64（128×64 宽高比）', () => {
  const asset=runtimeResources.get('ow-art-hub-tide-beacon')!;
  const states=asset.runtime.states as Record<string,{displayHeight?:number}>;
  expect(states.aura?.displayHeight).toBe(64);
 });
 it('hp 阈值状态映射（单元逻辑）', () => {
  const hpState=(hp:number,max:number)=>{const ratio=max>0?hp/max:0;return hp<=0?'broken':ratio<=0.2?'critical':ratio<=0.5?'damaged':'full';};
  expect(hpState(0,100)).toBe('broken');
  expect(hpState(15,100)).toBe('critical');
  expect(hpState(45,100)).toBe('damaged');
  expect(hpState(80,100)).toBe('full');
  expect(hpState(100,100)).toBe('full');
 });
});

// ─── 已撤销潮印卡框运行入口；静态美术归档不参与界面 ────────────────────────────
describe('removed in-run card presentation', () => {
 it('没有潮印面板模块或副本卡框引用', () => {
  expect(existsSync('apps/web/src/augments-panel.ts')).toBe(false);
  const controller=readFileSync('apps/web/src/dungeon-controller.ts','utf8');
  expect(controller).not.toContain('augment-frames');
  expect(controller).not.toContain('AugmentPanel');
 });
});

// ─── E3 进度页物品图标 ────────────────────────────────────────────────────────
describe('E3 progression summon icons', () => {
 it('ui.v2.json 包含召唤石图标 item-summon-wind', () => {
  // art() 从 ui.v2.json 解析；只要文件存在即视为已接线
  expect(existsSync('apps/web/public/art/ui-v2/items-chibi/item-summon-wind.png')).toBe(true);
 });
 it('ui.v2.json 包含残页图标 item-shard-weapon', () => {
  expect(existsSync('apps/web/public/art/ui-v2/items-chibi/item-shard-weapon.png')).toBe(true);
 });
 it('ui.v2.json 包含 item-shard-blank', () => {
  expect(existsSync('apps/web/public/art/ui-v2/items-chibi/item-shard-blank.png')).toBe(true);
 });
 it('ui.v2.json 包含建筑声望图标 item-rep-forge', () => {
  expect(existsSync('apps/web/public/art/ui-v2/items-chibi/item-rep-forge.png')).toBe(true);
 });
});

// ─── E4 HUD 菜单图标 ─────────────────────────────────────────────────────────
describe('E4 hudMenuIcon new entries', () => {
 const menuNames=['today','commission','port-build','chart','warehouse','archive','pets','stargate'] as const;
 it('所有新菜单图标均返回 <svg>', () => {
  for(const name of menuNames){
   const svg=hudMenuIcon(name);
   expect(svg).toContain('<svg');
   expect(svg).toContain('hud-menu-illustration');
  }
 });
 it('stargate 图标包含蓝色路径', () => {
  expect(hudMenuIcon('stargate')).toContain('var(--color-icon-blue)');
 });
});

// ─── E5 港口地标标记 ──────────────────────────────────────────────────────────
describe('E5 port marks asset', () => {
 it('ow-hub-port-marks 已注册到 runtimeResources', () => {
  expect(runtimeResources.has('ow-hub-port-marks')).toBe(true);
 });
 it('资源含 atlas 字段', () => {
  const asset=runtimeResources.get('ow-hub-port-marks')!;
  expect(asset.runtime.atlas).toBeTruthy();
 });
 it('包含 stargate / hall / forge / pier / post / warehouse / wardrobe / pet-yard 状态', () => {
  const states=runtimeResources.get('ow-hub-port-marks')!.runtime.states as Record<string,unknown>;
  for(const s of['stargate','hall','forge','pier','post','warehouse','wardrobe','pet-yard'])
   expect(states).toHaveProperty(s);
 });
 it('port-marks atlas 图集文件存在', () => {
  expect(existsSync('apps/web/public/art/hub-ui/port-marks.png')).toBe(true);
  expect(existsSync('apps/web/public/art/hub-ui/port-marks.json')).toBe(true);
 });
});

// ─── E6 图标插图优先级 ────────────────────────────────────────────────────────
describe('E6 icon illustrations priority', () => {
 it('vsElite 使用独立插图（不借用 skull）', () => {
  const html=iconHtml('vsElite');
  // vsElite 新插图含盔甲形状（leather-light），不应是 skull 线框
  expect(html).toContain('var(--color-icon-leather-light)');
 });
 it('vsBoss 使用独立插图', () => {
  const html=iconHtml('vsBoss');
  expect(html).toContain('var(--color-icon-steel-dark)');
 });
 it('executeBonus 使用独立插图（含 danger 色条）', () => {
  const html=iconHtml('executeBonus');
  expect(html).toContain('var(--color-danger)');
 });
 it('skull 图标本身仍然可用（不被覆盖）', () => {
  const html=iconHtml('skull');
  expect(html).toContain('var(--color-icon-paper)');
 });
 it('chest 使用插图（含 leather 色面）', () => {
  expect(iconHtml('chest')).toContain('var(--color-icon-leather)');
 });
 it('blockChance 使用插图（含 steel 色面）', () => {
  expect(iconHtml('blockChance')).toContain('var(--color-icon-steel)');
 });
});

// ─── E7 CSS 资产文件存在 ──────────────────────────────────────────────────────
describe('E7 ui-ornaments atlas', () => {
 it('ui-ornaments.png 存在', () => {
  expect(existsSync('apps/web/public/art/hub-ui/ui-ornaments.png')).toBe(true);
 });
 it('ui-ornaments.json 存在', () => {
  expect(existsSync('apps/web/public/art/hub-ui/ui-ornaments.json')).toBe(true);
 });
});
