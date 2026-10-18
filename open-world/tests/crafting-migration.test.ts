import {describe,it,expect} from 'vitest';
import {migrateCraftMaterials} from '../packages/rules/crafting-migration.ts';
import {craftMaterials,craftRecipes,craftPatterns} from '../packages/content/crafting.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import type {CharacterState} from '../packages/contracts/index.ts';

describe('制作材料迁移',()=>{
 it('旧数量与已有新数量合并且重复迁移不增发',()=>{
  const materials={ore:42,herb:13,leather:7,wind_ore:8,omega_fragment:9};
  migrateCraftMaterials(materials);
  expect(materials).toEqual({wind_ore:50,wind_herb:13,wind_part:7,omega_fragment:9});
  const before=structuredClone(materials);migrateCraftMaterials(materials);expect(materials).toEqual(before);
 });
 it('超过新堆叠上限的历史数量完整保留',()=>{
  expect(migrateCraftMaterials({ore:12000,wind_ore:9000})).toEqual({wind_ore:21000});
 });
 it('无旧材料不补发材料',()=>{expect(migrateCraftMaterials({})).toEqual({});});
 it('六岛材料与通用终局材料定义齐全且编号唯一',()=>{
  expect(craftMaterials).toHaveLength(34);expect(new Set(craftMaterials.map(m=>m.id)).size).toBe(34);
  expect(craftMaterials.filter(m=>m.tier==='T1')).toHaveLength(18);expect(craftMaterials.filter(m=>m.tier==='T2')).toHaveLength(6);
  expect(craftMaterials.every(m=>m.sources.length>0&&m.stack===9999)).toBe(true);
 });
 it('旧专业、配方、装备与钱包完整迁移，重复读取保持稳定',()=>{
  const s={id:crypto.randomUUID(),name:'旧存档',revision:7,build:2,level:1,xp:9,gold:123,material:45,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}} as CharacterState;
  const p=ensureProgression(s);Object.assign(p,{professions:{craft:'alchemy',craftLevel:120,craftXp:77,gatherLevel:30,gatherXp:12,gatherCharges:8},materials:{ore:11,herb:5,leather:6},recipes:['attack-tonic','forge-standard-sword-t1-weapon'],collectionClaims:['craft-8']});
  const migrated=ensureProgression(s);expect(migrated.materials).toEqual({wind_ore:11,wind_herb:5,wind_part:6});expect(migrated.crafting.professions.alchemy).toEqual({level:100,xp:77});expect(migrated.crafting.legacyProfessions?.craftLevel).toBe(120);expect(migrated.recipes).toContain('attack-tonic');expect(migrated.recipes).toContain('tonic_attack');expect(migrated.crafting.patterns).toContain('standard-sword-t1-weapon');expect(migrated).not.toHaveProperty('professions');expect([s.gold,s.material,s.revision,s.xp]).toEqual([123,45,7,9]);const before=structuredClone(s);ensureProgression(s);expect(s).toEqual(before);
 });
 it('八个正式旧配方均承接；固定传奇继承威能，终局精华不从T1凭空生成',()=>{
  const s={id:crypto.randomUUID(),name:'旧配方',revision:0,build:1,level:60,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[],skillRanks:{},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]}} as CharacterState,p=ensureProgression(s);
  p.recipes=['forge-blade','forge-coat','forge-omega','forge-primal','attack-tonic','vitality-tonic','enchant-shard','enchant-legend'];ensureProgression(s);
  for(const id of ['wind-weapon','wind-armor','forge-omega','pattern-primal-blade','tonic_attack','tonic_hp','wind-essence','enchant-legend'])expect(s.progression!.recipes).toContain(id);
  expect(s.progression!.crafting.patterns).toContain('primal-blade');expect(s.progression!.crafting.patternAspects['primal-blade']).toBe('aspect-mythic-1');expect(Object.keys(craftRecipes.find(r=>r.id==='enchant-legend')!.baseCost.materials).every(id=>craftMaterials.find(m=>m.id===id)!.tier==='T3')).toBe(true);
  for(const base of ['blade','bow','coat','charm','core','shield','omega-blade','omega-bow'])expect(craftPatterns.some(p=>p.base===base)).toBe(true);
 });
});
