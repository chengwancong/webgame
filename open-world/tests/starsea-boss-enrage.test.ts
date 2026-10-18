import {describe,expect,it} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {starseaBossMaps} from '../packages/content/starsea/index.ts';

// 星潮海首领战狂暴计时：首领进入警戒距离开始计时，到时首领攻击翻倍，不判负。
describe('starsea boss enrage clock',()=>{
 const region=regionById(starseaBossMaps[0]),boss=region.spawns.find(s=>s.boss)!;
 const make=()=>new World(region,{hp:1e9,attack:0,armor:0,speed:6,mana:100,regen:10,effects:[]},[],[boss]);
 it('starts on engagement and doubles boss attack after the limit',()=>{
  const w=make(),rule=w.rules.encounterBalance.starseaBossEnrage;
  w.hero.position={x:boss.x+1,y:boss.y};w.step();
  expect(w.bossClock).toMatchObject({enraged:false,limit:rule.seconds*30});
  const e=w.enemies[0],base=(w as any).enemyAttack(e);
  for(let i=0;i<rule.seconds*30;i++)w.step();
  expect(w.bossClock?.enraged).toBe(true);
  expect((w as any).enemyAttack(e)).toBe(Math.round(base*rule.attackMultiplier));
  expect(w.hero.hp).toBeGreaterThan(0);
 });
 it('does not run outside starsea boss maps or before engagement',()=>{
  const far=make();far.hero.position={...region.safe};
  if(Math.hypot(region.safe.x-boss.x,region.safe.y-boss.y)>far.rules.aiRules.activeRadius){far.step();expect(far.bossClock).toBeNull();}
  const field=new World(regionById('meadow-boss'),{hp:1e9,attack:0,armor:0,speed:6,mana:100,regen:10,effects:[]},[],regionById('meadow-boss').spawns);
  for(let i=0;i<30;i++)field.step();expect(field.bossClock).toBeNull();
 });
 it('survives checkpoint restore',()=>{
  const w=make();w.hero.position={x:boss.x+1,y:boss.y};w.step();
  expect(World.restore(w.exportCheckpoint()).bossClock).toEqual(w.bossClock);
 });
});
