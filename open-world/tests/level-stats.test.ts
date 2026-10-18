import {describe,it,expect} from 'vitest';
import type {CharacterState} from '../packages/contracts/index.ts';
import {levelStatsTable,levelStatsSchema,levelStats} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import progression from '../packages/content/deep-progression.json';
const state=():CharacterState=>({id:crypto.randomUUID(),name:'规则测试',revision:0,build:1,level:1,xp:0,gold:10000,material:500,gear:[],equipment:{},skills:['cut','bolt','ward'],skillRanks:{cut:1,bolt:1,ward:1},progress:{kills:0,regions:['meadow','forest','rift','tundra','abyss','dragonbone'],bosses:[],safe:'town',tasks:[]}});
const raw=()=>structuredClone(levelStatsTable);
describe('等级属性表',()=>{
 it('从 1 级连续覆盖到突破后的最高等级，属性不随等级下降',()=>{
  const rows=levelStatsTable.levels;expect(rows[0].level).toBe(1);expect(rows.length).toBeGreaterThanOrEqual(Math.max(...progression.characterCaps));
  rows.forEach((r,n)=>{expect(r.level).toBe(n+1);if(n)for(const k of ['hp','attack','armor','speed','mana','regen'] as const)expect(r[k]).toBeGreaterThanOrEqual(rows[n-1][k]);});
 });
 it('校验拒绝断档、下降和不够高的表',()=>{
  const gap=raw();gap.levels.splice(4,1);expect(levelStatsSchema.safeParse(gap).success).toBe(false);
  const drop=raw();drop.levels[9].hp=drop.levels[8].hp-1;expect(levelStatsSchema.safeParse(drop).success).toBe(false);
  const short=raw();short.levels=short.levels.slice(0,50);expect(levelStatsSchema.safeParse(short).success).toBe(false);
  const extra=raw() as any;extra.levels[0].luck=1;expect(levelStatsSchema.safeParse(extra).success).toBe(false);
 });
 it('服务端构筑的基础属性逐项来自表（无装备、无养成）',()=>{
  for(const level of [1,10,30,50]){const s=state();s.level=level;const {stats}=resolveBuild(s),row=levelStats(level);
   expect({hp:stats.hp,attack:stats.attack,armor:stats.armor,speed:stats.speed,mana:stats.mana,regen:stats.regen}).toEqual({hp:row.hp,attack:row.attack,armor:row.armor,speed:row.speed,mana:row.mana,regen:row.regen});}
 });
 it('等级超出表的范围时取首行或末行',()=>{
  expect(levelStats(0).level).toBe(1);expect(levelStats(999).level).toBe(levelStatsTable.levels.length);
 });
});
