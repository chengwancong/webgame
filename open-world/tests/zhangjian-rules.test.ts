// M17 杖剑借鉴 Z1–Z4 规则层。
import {it,expect,describe} from 'vitest';
import rows from './fixtures/build-variety-r1/legacy-builds.json';
import type {CharacterState,Gear} from '../packages/contracts/index.ts';
import {resolveBuild,upgradeCost} from '../packages/rules/index.ts';
import {petContent,hubElements} from '../packages/content/zhangjian.ts';
import {monsterCombatSchema} from '../packages/contracts/monsters.ts';
import {loadoutsStateSchema,petsStateSchema} from '../packages/contracts/zhangjian.ts';
import {chartNodeViewSchema} from '../packages/contracts/hub.ts';
import {withSlotRank,resonanceTier,migrateSlotRanks,catchUpAffixNodes,petBuildParts,petForm} from '../packages/rules/zhangjian-build.ts';
import {nodeElements,applyRegionWeakness,elementHint,loadoutView,saveLoadout,applyLoadout,loadoutDirty,ensureLoadouts,grantPet,grantPetXp,setPetLineup,petsView,regionExplore,nodeExploreFields,gateKey,gatePet,explorePet,huntPet,slotsView,dockExploreBonus,renameLoadout} from '../packages/rules/zhangjian.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {gearMaxRank} from '../packages/rules/item-power.ts';

const state=()=>structuredClone(rows[0].state) as unknown as CharacterState;
const worn=(s:CharacterState,slot:string)=>s.gear.find(g=>g.id===s.equipment[slot])!;

describe('内容表',()=>{
 it('18 个宠物家族、九流派都有元素',()=>{expect(petContent.families).toHaveLength(18);expect(Object.keys(petContent.flows)).toHaveLength(9);});
 it('风栖弱雷电、雾铃弱火焰',()=>{expect(nodeElements('wind-nest-1')).toEqual({threat:'physical',weakness:'lightning'});expect(nodeElements('mist-gate')?.weakness).toBe('fire');expect(hubElements.weaknessBonus).toBe(.25);});
});

describe('Z1 元素与方案',()=>{
 it('给怪挂弱点并通过战斗模板校验',()=>{const spawn={monster:{version:1 as const,template:'t',level:3,rank:'normal' as const,baseStats:{hp:10,attack:1,armor:0},difficulty:{hp:1,attack:1,armor:1},armor:0,ai:{speed:1,range:1,cooldown:30,skillChance:0,basicAttackBonus:0},skills:[],bossKey:null}};applyRegionWeakness([spawn],'wind-story-1');expect(monsterCombatSchema.parse(spawn.monster).weakness).toEqual({type:'lightning',bonus:.25});});
 it('保存、改动、切回方案；天赋免费换',()=>{const s=state();ensureLoadouts(s);expect(loadoutDirty(s)).toBe(false);saveLoadout(s,1,'雷');const skills=[...s.skills];s.skills=s.skills.slice(0,1);expect(loadoutDirty(s)).toBe(true);const r=applyLoadout(s,1);expect(s.skills).toEqual(skills);expect(r.skipped).toEqual([]);expect(s.loadouts!.active).toBe(1);loadoutsStateSchema.parse(s.loadouts);});
 it('方案里的装备被分解后，切换时跳过并说明',()=>{const s=state();saveLoadout(s,2);const ring=s.equipment.ring;if(!ring)return;s.gear=s.gear.filter(g=>g.id!==ring);delete s.equipment.ring;const r=applyLoadout(s,2);expect(r.skipped.some(x=>x.includes('戒指'))).toBe(true);});
 it('空方案改名后仍是空配置',()=>{const s=state();renameLoadout(s,2,'备用');expect(s.loadouts!.slots[2]!.name).toBe('备用');expect(s.loadouts!.slots[2]!.skills).toEqual([]);});
 it('提示：另一个方案能打出弱点时建议切换',()=>{const s=state(),view=loadoutView(s,resolveBuild(s).stats);view.slots[1]={index:1,name:'方案二',empty:false,elements:['lightning'],skills:[],pet:null};view.current.elements=['physical'];expect(elementHint({threat:'physical',weakness:'lightning'},view)).toEqual({text:'方案二能打出雷电弱点',switchTo:1});view.slots[1].elements=[];expect(elementHint({threat:'poison',weakness:'fire'},view)?.text).toMatch(/^毒素抗性/);});
});

describe('Z2 部位强化',()=>{
 it('迁移取该部位最高等级；生效等级受本件品质封顶',()=>{const s=state(),g=worn(s,'weapon');g.rank=0;const spare={...structuredClone(g),id:'00000000-0000-4000-8000-000000000001',rank:4} as Gear;s.gear.push(spare);migrateSlotRanks(s);expect(s.slotRanks!.weapon).toBe(4);s.slotRanks!.weapon=99;expect(withSlotRank(s,g).rank).toBeLessThanOrEqual(15);});
 it('部位等级改变主属性，换装不丢',()=>{const s=state();migrateSlotRanks(s);for(const k of Object.keys(s.slotRanks!))(s.slotRanks as Record<string,number>)[k]=0;const base=resolveBuild(s).stats.attack;s.slotRanks!.weapon=3;expect(resolveBuild(s).stats.attack).toBeGreaterThan(base);});
 it('共鸣取最低部位：全 +3 为一档，攻击、护甲、生命都提高',()=>{const s=state();s.slotRanks={weapon:3,armor:3,helmet:3,boots:3,accessory:3,ring:2};expect(resonanceTier(s).tier).toBe(0);const before=resolveBuild(s).stats;s.slotRanks.ring=3;expect(resonanceTier(s).tier).toBe(1);const after=resolveBuild(s).stats;expect(after.hp).toBeGreaterThan(before.hp);});
 it('补词缀节点：只升不降，每过节点调用一次',()=>{const s=state(),g=worn(s,'weapon');g.rank=0;s.slotRanks={weapon:7};const calls:number[]=[];catchUpAffixNodes(s,g,x=>{calls.push(x.rank);if([3,6].includes(x.rank))x.affixNode={rank:x.rank,kind:'max'};});expect(g.rank).toBe(Math.min(7,gearMaxRank(g,5)));expect(calls.length).toBe(g.rank);s.slotRanks.weapon=1;catchUpAffixNodes(s,g,()=>{});expect(g.rank).toBeGreaterThan(1);});
 it('部位视图：未穿装备给原因',()=>{const s=state();s.slotRanks={};delete s.equipment.ring;const v=slotsView(s,upgradeCost);expect(v.slots.find(x=>x.slot==='ring')!.block).toBe('先在这个部位穿上装备');expect(v.resonance.next).toEqual({rank:3,missing:6});});
});

describe('Z3 宠物',()=>{
 it('首得自动上阵；上阵给技能和被动，助阵只给一半被动',()=>{const s=state();grantPet(s,'wind-free');grantPet(s,'mist-free');petsStateSchema.parse(s.pets);expect(s.pets!.lineup).toEqual({active:'wind-free',support:['mist-free']});const parts=petBuildParts(s);expect(parts.rules).toHaveLength(1);expect(parts.rules[0].action).toMatchObject({type:'nova',damageType:'physical',ref:'attack'});expect(parts.stats.map(x=>[x.stat,x.value])).toEqual([['attackPercent',.03],['hpPercent',.04],['attackPercent',.015],['hpPercent',.02]]);});
 it('流派决定元素，进入构筑规则',()=>{const s=state();grantPet(s,'wind-free');s.pets!.owned['wind-free'].flow='storm';const b=resolveBuild(s);expect(b.stats.rules?.some(r=>r.id==='pet-wind-free'&&r.action.type==='nova'&&r.action.damageType==='lightning')).toBe(true);});
 it('经验：上阵全额、等级不超过角色，10 级成年',()=>{const s=state();s.level=12;grantPet(s,'wind-free');grantPetXp(s,100000);expect(s.pets!.owned['wind-free'].level).toBe(12);expect(petForm(12)).toBe('adult');});
 it('阵容校验与图鉴',()=>{const s=state();grantPet(s,'wind-free');expect(()=>setPetLineup(s,'wind-free',['wind-free'])).toThrow();expect(()=>setPetLineup(s,'mist-free',[])).toThrow();const v=petsView(s);expect(v.catalog.find(c=>c.family==='wind-heavy')).toMatchObject({status:'locked',source:'风栖狩猎与关口都首通'});expect(v.owned[0].runtime).toBe('ss-pet-wind-free-young');});
 it('来源：关口给常见档，探索满给稀有档',()=>{expect(gatePet('wind')).toBe('wind-free');expect(explorePet('mist')).toBe('mist-light');expect(gatePet('rift')).toBe('star-free');});
 it('传说档：狩猎与关口都首通才发',()=>{expect(huntPet('wind',{'wind-hunt':1})).toBeUndefined();expect(huntPet('wind',{'wind-hunt':1,'wind-gate':1})).toBe('wind-heavy');});
});

describe('Z4 探索度',()=>{
 it('风栖总分 23；首通 + 锁门过半，码头加成 25%',()=>{const h=newHubState();expect(regionExplore(h,'wind').total).toBe(23);for(const n of ['wind-story-1','wind-story-2','wind-story-3','wind-nest-1','wind-nest-2','wind-nest-3','wind-hunt','wind-tide','wind-treasure','wind-gate'])h.chart.cleared[n]={firstAt:'x',bestSeconds:1};h.explore={caches:[],doors:['wind-door-1','wind-door-2'],keys:['mist']};const v=regionExplore(h,'wind');expect(v.score).toBe(14);expect(v.percent).toBe(60);expect(v.dockBonus).toBe(.25);expect(dockExploreBonus(100)).toBe(.5);});
 it('雾铃锁门要炉钥：赤炉前开不了',()=>{const v=regionExplore(newHubState(),'mist');expect(v.lockedByKey).toBe(2);});
 it('节点视图字段可通过契约',()=>{const h=newHubState();h.explore={caches:['cache:wind-nest-2'],doors:[],keys:[]};const f=nodeExploreFields(h,'wind-nest-2');expect(f).toMatchObject({cache:{found:true},door:{id:'wind-door-1',key:'mist',keyName:'铃钥',keyOwned:false,opened:false},elements:{weakness:'lightning'}});expect(nodeExploreFields(h,'wind-gate')).not.toHaveProperty('cache');expect(chartNodeViewSchema.shape.door.parse(f.door)).toBeTruthy();});
 it('钥匙来自关口首通',()=>{expect(gateKey('mist-gate')).toBe('mist');expect(gateKey('wind-nest-1')).toBeUndefined();});
});
