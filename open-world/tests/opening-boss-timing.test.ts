import {it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {prologueConfig,prologueFamilies} from '../packages/content/starsea/prologue.ts';
import {playPrologue} from '../apps/web/src/prologue-battle.ts';
// 验收 D1（progression-goal-20261017）：开场星潮巨兽从出现到倒下的实际秒数，目标 20–25 秒。
// 跑的是客户端开场控制器实际驱动的那一场（apps/web/src/prologue-battle.ts），用 prologue.json 冻结的血量和回响爆发。
// 玩家策略：身边 6 格内有敌人就站着打（技能自动放），没有就朝最近的敌人走。
// eager（潮能一满就按，字幕提示的做法）必须在 20–25 秒内，且与推导工具写下的冻结值一致；hold（爆发留到巨兽战）只记录。
it('opening boss dies 20–25 seconds after it appears, for every starter weapon',async()=>{
 const rows=(['eager','hold'] as const).flatMap(policy=>prologueFamilies.map(family=>({...playPrologue(family,policy),frozenBossSeconds:prologueConfig.families[family].measured.bossSeconds})));
 console.table(rows);
 const dir=resolve(import.meta.dirname,'../.runtime/acceptance-g3');await mkdir(dir,{recursive:true});
 await writeFile(resolve(dir,'D1-opening-boss.json'),JSON.stringify({item:'D1',source:'tests/opening-boss-timing.test.ts',rules:'PrologueBattle + prologue.json',rows},null,1));
 for(const r of rows){expect(r.finished,r.family+' '+r.policy+' 卡在 '+r.stalledIn).toBe(true);if(r.policy==='hold')continue;
  expect(r.bossSeconds!,r.family).toBeGreaterThanOrEqual(20);expect(r.bossSeconds!,r.family).toBeLessThanOrEqual(25);expect(r.bossSeconds,r.family+' 与冻结值一致').toBe(r.frozenBossSeconds);}
},120_000);

// 刷怪点只放在英雄走得到的位置：英雄全程站着不动（只靠技能自动放），三波杂兵也必须能自己找上门、全部打完。
it('every wave reaches a hero who never moves',async()=>{
 const {PrologueBattle}=await import('../apps/web/src/prologue-battle.ts');
 for(const family of prologueFamilies){const b=new PrologueBattle(family);
  for(let tick=0;tick<30*240&&b.phase!=='boss'&&b.phase!=='fade'&&b.phase!=='done';tick++)b.step({x:0,y:0});
  expect(b.phase,family+' 站桩时卡在第 '+(b.wave+1)+' 波').not.toBe('waves');}
},120_000);
