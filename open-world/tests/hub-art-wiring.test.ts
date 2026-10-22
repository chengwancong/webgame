/**
 * A1–A5 hub-fun 美术接线单元测试（纯逻辑，无 Phaser / 无浏览器）。
 */
import {describe,it,expect} from 'vitest';
import {KILL_STREAK_ART_KEY,killStreakTierFrame} from '../apps/web/src/kill-streak.ts';
import {BOSS_BANNER_ART_KEY,BOSS_BANNER_SHIELD_ART_KEY} from '../apps/web/src/boss-phase-banner.ts';
import {gradeStampHtml} from '../apps/web/src/hub/run-grade.ts';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';
import {existsSync} from 'node:fs';

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
