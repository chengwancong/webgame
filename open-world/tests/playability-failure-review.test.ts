import {dungeonDiagnosticHtml} from '../apps/web/src/dungeon-diagnostic-view.ts';
import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {newDungeonMeasurement,observeDungeonTick,dungeonDiagnostic} from '../apps/api/src/dungeon-diagnostics.ts';
import {newCombatReview,observeCombatReview,resolveCombatReview,currentCombatReview} from '../packages/simulation/combat-review.ts';
import {dungeonDiagnosticSchema} from '../packages/contracts/dungeons.ts';
it('front-room defeat records actual injury, keeps one record per tick across restore and offers actionable sources',()=>{
 const r={...regionById('meadow'),obstacles:[],safe:{x:10,y:10},spawns:[]},spawn={...regionById('meadow').spawns[0],id:'front-elite',name:'前段精英',x:11,y:10,elite:true,attack:100};let w=new World(r,{hp:10000,attack:1,armor:0,speed:6,mana:30,regen:0,effects:[]},[],[spawn],[],41),m=newDungeonMeasurement(0);w.setMode('manual');
 for(let n=0;n<150;n++){w.step();observeDungeonTick(m,w);const once=JSON.stringify(m);observeDungeonTick(m,w);expect(JSON.stringify(m)).toBe(once);if(n===74){w=World.restore(w.exportCheckpoint());m=JSON.parse(JSON.stringify(m));}}
 expect(m.taken[w.playerId]).toBeGreaterThan(0);expect(m.bossDamage).toBe(0);const d=dungeonDiagnostic(m,w.playerId,10000,30,240,{stage:13,materials:3,required:10,obtained:false});dungeonDiagnosticSchema.parse(d);
 // 失败页只讲致命一击与下一步，不再输出任何测量数字。
 expect(d.fatal?.enemy).toBe('前段精英');expect(d.fatal?.damage).toBeGreaterThan(0);expect(d.fatal?.hint.length).toBeGreaterThan(0);
 expect(d.advice.length).toBeGreaterThan(0);expect(d.advice.length).toBeLessThanOrEqual(3);expect(d.dpsGap).toBeNull();
 const html=dungeonDiagnosticHtml(d,'锻造回廊');
 expect(html).toContain('前段精英');expect(html).toContain('沉星密仓钥匙碎片');expect(html).toContain('3 / 10');expect(html).toContain('沉星密仓里的精英、稀有敌人和宝箱会掉');
 for(const word of ['输出秒数','事件记录','占比','秒伤','DPS'])expect(html).not.toContain(word);
});
it('the local island executor records real source names and missing history remains explicit',()=>{
 const r=regionById('ss-map-boss-1'),w=new World({...r,safe:{x:r.spawns[0].x-1,y:r.spawns[0].y}}, {hp:100000,attack:1,armor:0,speed:6,mana:30,regen:0,effects:[]},[],r.spawns),m=newCombatReview();w.setMode('manual');for(let n=0;n<300;n++){w.step();observeCombatReview(m,w);}const review=resolveCombatReview(m,w.playerId);
 expect(review.recent.length).toBeGreaterThan(0);expect(review.recent.join('')).not.toContain('来源未记录');
 expect(review.fatal?.enemy).toBeTruthy();expect(review.fatal?.hint).toBeTruthy();
 expect(resolveCombatReview(undefined,'hero').fatal).toBeNull();
});

it('a new executor cannot display the previous world or character injury record',()=>{const r=regionById('ss-map-boss-1'),a=new World(r,{hp:100,attack:1,armor:0,speed:6,mana:30,regen:0,effects:[]},[],r.spawns),b=new World(r,a.stats,[],r.spawns),m=newCombatReview();a.step();observeCombatReview(m,a);expect(currentCombatReview(m,a,a)).toBeDefined();expect(currentCombatReview(m,a,b)).toBeUndefined();expect(currentCombatReview(m,undefined,b)).toBeUndefined();});

it('a living timed-out player receives output advice without a false killing blow',()=>{
 const d=dungeonDiagnostic(newDungeonMeasurement(1),'hero',100,30,240,null,false),html=dungeonDiagnosticHtml(d);
 expect(d.fatal).toBeNull();expect(d.advice.map(a=>a.label)).toContain('强化武器');
 expect(html).toContain('这一趟没闯过');expect(html).not.toContain('你倒在了这里');expect(html).not.toContain('review-fatal');
});
