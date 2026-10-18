import {it,expect} from 'vitest';
import {simulateCampaign} from '../tools/campaign-model.ts';
import {regions,regionById} from '../packages/content/index.ts';
import {rewardFor,rewards,chanceExpectation,dropProfileFor} from '../apps/api/src/economy.ts';
import {World,findPath,walkable,distance} from '../packages/simulation/index.ts';
import type {Stats} from '../packages/contracts/index.ts';
import type {BossCast,BossSkillId} from '../packages/content/chapter-combat.ts';
import {storyChapters} from '../packages/content/story-campaign.ts';
const seeds=[11,23,47,71,101];
// 旧六区主线不再是新角色路线（docs/hybrid-implementation.md H6）。ow-21 起技能伤害改为“攻击 × 系数 × 乘区”的线性公式，
// 旧区怪物曲线按旧的平方公式调过，melee/ranged 个别种子会在旧首领处超时；旧区内容改造前只保留 starter 回归。
for(const style of ['starter','melee','ranged'] as const)(style==='starter'?it:it.skip)(`${style} can earn its way through all six areas without relying on randomized gear`,()=>{
 for(const seed of seeds){const run=simulateCampaign(seed,style,true);expect(run.complete,`seed ${seed}, stopped at ${run.rows.at(-1)?.region}`).toBe(true);expect(run.rows).toHaveLength(12);for(const row of run.rows){expect(row.win).toBe(true);expect(row.gold).toBeGreaterThanOrEqual(0);expect(row.material).toBeGreaterThanOrEqual(0);expect(row.seconds).toBeLessThan(row.timeLimitSeconds);}}
},30000);
it('later full waves give nondecreasing currency, XP and upgrade material',()=>{
 let prior={gold:0,xp:0,material:0};for(const chapter of storyChapters){const area=regionById(chapter.area),sum={...rewardFor(area.id,'boss')};for(const m of area.spawns){const gain=rewardFor(area.id,m.elite?'elite':'normal');for(const key of ['gold','xp','material'] as const)sum[key]+=gain[key];}for(const key of ['gold','xp','material'] as const)expect(sum[key]).toBeGreaterThanOrEqual(prior[key]);prior=sum;}
 expect(rewardFor('meadow-boss','boss')).toEqual(rewards.boss);
 const frozen=structuredClone(rewards);frozen.regions.tundra={gold:7,xp:9,material:4};expect(rewardFor('tundra-boss','boss',frozen)).toEqual({gold:840,xp:900,material:32});expect(rewardFor('tundra-boss','boss')).toEqual({gold:360,xp:500,material:24});
});
it('statistical drop expectations distinguish averages from 95% confidence and impossible drops',()=>{
 expect(chanceExpectation(0)).toEqual({probability:0,meanKills:null,killsFor95Percent:null});expect(chanceExpectation(1).killsFor95Percent).toBe(1);
 for(const area of ['rift','tundra','abyss','dragonbone']){const p=dropProfileFor(area).boss.quality.legendary/100,r=chanceExpectation(p);expect(r.meanKills).toBeCloseTo(1/p);expect((1-p)**r.killsFor95Percent!).toBeLessThanOrEqual(.05);expect((1-p)**(r.killsFor95Percent!-1)).toBeGreaterThan(.05);}
 expect(chanceExpectation(.05).killsFor95Percent).toBe(59);expect(chanceExpectation(.3).killsFor95Percent).toBe(9);
});
const stats:Stats={hp:600,attack:0,armor:0,speed:6,mana:0,regen:0,effects:[]};
function readyCast(regionId:string,skill:BossSkillId){const region=regionById(regionId),spawn={...region.spawns[0],x:regionId==='dragonbone-boss'?50:36,y:regionId==='dragonbone-boss'?32:40};const w=new World(region,stats,[],[spawn],[],11);w.setMode('manual');const c:BossCast={id:1,owner:spawn.id,skill,position:{...w.enemies[0].position},target:{...w.hero.position},started:0,ends:1,damage:0,interrupted:false,resolved:false,expires:300,phase:4};w.bossCasts.push(c);return w;}
it('a zero-damage ice prison preserves HP rather than becoming a lethal trap',()=>{
 const w=readyCast('tundra-boss','ice_prison');w.step();expect(w.zones[0].damage).toBe(0);for(let i=0;i<160;i++)w.step();expect(w.hero.hp).toBe(600);
});
it('death mark and the real dragon actor execute finite configured damage',()=>{
 const mark=readyCast('abyss-boss','death_mark');for(let i=0;i<151;i++)mark.step();expect(mark.hero.hp).toBe(600-regionById('abyss-boss').spawns[0].attack*3);
 const beam=readyCast('dragonbone-boss','ultimate');beam.step();expect(beam.hero.hp).toBe(600-regionById('dragonbone-boss').spawns[0].attack*4);
});
it('fractional destinations near walls produce routes a real hero body can traverse',()=>{
 const r=regionById('abyss'),start={x:12,y:3.5},end={x:22,y:21},path=findPath(r,start,end);expect(path.length).toBeGreaterThan(0);expect(path.every(p=>walkable(r,p,.55))).toBe(true);
 const w=new World(r,stats,[],[]);w.hero.position=start;w.go(end);for(let i=0;i<450;i++)w.step();expect(distance(w.hero.position,end)).toBeLessThan(.3);
});
