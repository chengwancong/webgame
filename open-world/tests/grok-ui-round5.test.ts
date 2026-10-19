import {describe,it,expect} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import {starseaHub} from '../packages/content/starsea/index.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {nearestWalkable} from '../apps/web/src/landing-nudge.ts';
import {minimapExposureShade} from '../apps/web/src/ui/minimap.ts';
import {hudGoalLabel} from '../apps/web/src/hud-context.ts';

describe('Grok 第五轮 UI',()=>{
 it('落点被实体压住时挪到最近可走格，可走就不动',()=>{
  const r=regionById('meadow'),p={...r.portal};expect(walkable(r,p,.55)).toBe(true);
  expect(nearestWalkable(r,p)).toEqual(p);
  const boxed={...r,dynamicObstacles:[{x:p.x-1,y:p.y-1,w:2,h:2}]};expect(walkable(boxed,p,.55)).toBe(false);
  const q=nearestWalkable(boxed,p);expect(walkable(boxed,q,.55)).toBe(true);expect(Math.hypot(q.x-p.x,q.y-p.y)).toBeLessThanOrEqual(2.5);
 });
 it('港口工坊旁的落点可走，且仍在打开工坊的 5 格内',()=>{
  const hub=regionById(starseaHub),forge=hub.landmarks.find(l=>l.kind==='forge')!;expect(forge).toBeTruthy();
  const q=nearestWalkable(hub,{x:forge.x,y:forge.y+2});expect(walkable(hub,q,.55)).toBe(true);expect(Math.hypot(q.x-forge.x,q.y-forge.y)).toBeLessThanOrEqual(5);
 });
 it('亮底岛小地图压暗，暗底岛不动',()=>{
  expect(minimapExposureShade('#e8d8b8')).toBeGreaterThan(.2);expect(minimapExposureShade('#e8d8b8')).toBeLessThanOrEqual(.45);
  expect(minimapExposureShade('#4a6a3a')).toBe(0);expect(minimapExposureShade(undefined)).toBe(0);
 });
 it('追踪条截到第一个分句，不再整句换成查看下一步',()=>{
  expect(hudGoalLabel('去霜镜湖畔，击败冰喉的守卫并带回碎片')).toBe('去霜镜湖畔…');expect(hudGoalLabel('击败格铎')).toBe('击败格铎');
 });
});
