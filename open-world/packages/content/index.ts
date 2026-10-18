import type {Skill,Spawn,Vec,Behavior} from '../contracts/index.ts';
export * from './gear-sets.ts';
export * from './level-stats.ts';
export * from './equipment-catalog.ts';
// Units: distance = navigation cells, durations = 30 Hz ticks; cost = integer mana.
export const settings={tickRate:30,chunkSize:32,autoRadius:12,pickupRadius:6,reportTicks:60,reportKills:20,maxPending:2,capacity:60,permitSeconds:300,refreshSeconds:25,leaseSeconds:45};
export const skillCategories={melee:'近战武技',ranged:'远程武技',spell:'法术',support:'辅助'} as const;
export type SkillCategory=keyof typeof skillCategories;
/** 技能册一级页签：武技（近战＋远程，需对应主手）／法术（任意主手）／辅助。 */
export const skillSchools={martial:'武技',spell:'法术',support:'辅助'} as const;
export type SkillSchool=keyof typeof skillSchools;
export const skillSchoolOf=(category:SkillCategory):SkillSchool=>category==='melee'||category==='ranged'?'martial':category;
export type SkillDefinition=Skill & {category:SkillCategory;unlockLevel:number;activation?:{type:'book';quantity:number}};
export const skillBookRewards=[{boss:'meadow-boss',skill:'ember',quantity:1},{boss:'forest-boss',skill:'chain',quantity:1}];
export const starterSkills=['cut','ward','whirl'];
// 导入扩展的技能列表（55个技能）
import {expandedSkills} from './skills-expanded.ts';
export const skillCatalog:SkillDefinition[]=expandedSkills;
export type Region={keyChests?:import('../contracts/dungeon-chests.ts').DungeonChest[];id:string;/** 箱庭位面随机布局的种子；有值时客户端按它重建本场画面（plane-layouts.ts）。 */layoutSeed?:number;/** Opt-in out-of-combat sprint; legacy encounters omit this. */sprint?:boolean;presentationKey?:string;name:string;subtitle:string;width:number;height:number;theme:string;safe:Vec;portal:Vec;bossPortal?:Vec;next?:string;requireBoss?:string;boss:boolean;auto:boolean;/** 休整地图：主城之外的港口等，回复生命且不自动施法。 */rest?:boolean;/** 脱战后每秒回复的生命比例（4 秒未受伤后生效）。 */calmRegen?:number;/** 怪物察觉距离；未声明时沿用全局活动半径。 */aggroRadius?:number;/** 全自动巡猎：附近无怪也无掉落时，自动转向最近的怪群（岛屿刷图）。 */roam?:boolean;/** Immutable static terrain; invalidateNavigation after an in-place geometry edit. */obstacles:{x:number;y:number;w:number;h:number}[];/** Temporary body/summon blockers, separate from the cached terrain. */dynamicObstacles?:{x:number;y:number;w:number;h:number}[];/** Explicit open-world simulation activation radius; omitted legacy encounters keep their rules. */activationRadius?:number;spawns:Spawn[];landmarks:{name:string;x:number;y:number;kind:string}[]};
import townMap from './maps/town.json';
import meadowMap from './maps/meadow.json';
import meadowBossMap from './maps/meadow-boss.json';
import forestMap from './maps/forest.json';
import forestBossMap from './maps/forest-boss.json';
import riftMap from './maps/rift.json';
import riftBossMap from './maps/rift-boss.json';
import tundraMap from './maps/tundra.tiled.json';
import tundraBossMap from './maps/tundra-boss.tiled.json';
import abyssMap from './maps/abyss.tiled.json';
import abyssBossMap from './maps/abyss-boss.tiled.json';
import dragonboneMap from './maps/dragonbone.tiled.json';
import dragonboneBossMap from './maps/dragonbone-boss.tiled.json';
import {parseMap} from './tiled.ts';
import {starseaRegions} from './starsea/index.ts';
export const regions:Region[]=[...[townMap,meadowMap,meadowBossMap,forestMap,forestBossMap,riftMap,riftBossMap,tundraMap,tundraBossMap,abyssMap,abyssBossMap,dragonboneMap,dragonboneBossMap].map(parseMap),...starseaRegions];
/** 512 open-world regions are registered lazily (server at startup, QA client on
 * demand) so their large geometry never enters the shared production bundle.
 * `island` maps the region to the starsea island economy and access rules. */
export type FieldRegionInfo={island:string;qa:boolean;chunkCells:number};
const fieldRegions=new Map<string,{region:Region;info:FieldRegionInfo}>();
const dungeonParents=new WeakMap<Region,string>();
/** Authored fixed encounters retain their spawns while sharing the parent
 * island economy. They are distinct from camp-streaming field regions. */
export function registerDungeonRegion(region:Region,island:string){if(regions.some(r=>r.id===region.id)||!regions.some(r=>r.id===island)&&!fieldRegions.has(island))throw Error('Invalid dungeon region/parent '+region.id);dungeonParents.set(region,island);regions.push(region);}
export function dungeonRegionInfo(id:string){const region=regions.find(r=>r.id===id);return region?dungeonParents.get(region):undefined;}
export function registerFieldRegion(region:Region,info:FieldRegionInfo,replaceIsland=false){
 const prior=regions.find(r=>r.id===region.id);
 if(prior){if(!replaceIsland||info.qa||region.id!==info.island||prior.boss||prior.rest)throw Error('Field region shadows a static region '+region.id);regions[regions.indexOf(prior)]=region;}
 if(!Number.isInteger(info.chunkCells)||info.chunkCells<8||region.spawns.length)throw Error('Invalid field region '+region.id);
 const old=fieldRegions.get(region.id);if(old&&old.region!==region)throw Error('Duplicate field region '+region.id);
 fieldRegions.set(region.id,{region,info});
}
export function fieldRegionInfo(id:string){return fieldRegions.get(id)?.info;}
/** Economy/access region: the island a field region stands in for, else itself. */
export function economyRegionOf(id:string){let current=id;for(let n=0;n<10;n++){const r=regions.find(r=>r.id===current),next=fieldRegions.get(current)?.info.island??(r?dungeonParents.get(r):undefined);if(!next||next===current)return current;current=next;}throw Error('Cyclic region economy parents '+id);}
export function regionById(id:string){const r=regions.find(r=>r.id===id)??fieldRegions.get(id)?.region;if(!r)throw new Error('Unknown region');return r;}
export const fieldNotes={distance:'float; navigation cells; >=0; core navigation/collision/skills',cooldown:'integer; 30 Hz ticks; >=1; simulation skill scheduler',gold:'integer; units; >=0; API wallet only',skillRanks:'integer; 1..5; missing means inactive; server resolves activation, prices and skills',effects:'enum; executor required; no unknown fallbacks'};
export const effects={chainRatio:.3,burnDamage:8,burnTicks:90,wardAmount:15,wardTicks:90};
export const effectText={none:'无特殊效果',pierce:'飞行物穿透敌人',chain:`命中向附近敌人传导 ${effects.chainRatio*100}% 伤害`,ward:`命中获得 ${effects.wardAmount} 护盾，每 ${effects.wardTicks/30} 秒一次`,burn:`命中使敌人燃烧 ${effects.burnTicks/30} 秒`};
// projectileHitRadius: world navigation units, > 0; shared by hero hit detection and automatic defensive prediction.
export const bodyCollision={heroRadius:.55,enemyRadius:.55,eliteRadius:.65,bossRadius:.9};
export const aiRules={activeRadius:20,projectileSpeed:.5,projectileHitRadius:.55,projectileTicks:40,summonCap:8,summonHp:18,summonAttack:3,bossCooldown:65,cooldown:90,attackReach:2.2,
 profiles:{melee:{speed:2.8,range:2},ranged:{speed:2.8,range:9},charger:{speed:2.8,range:7},shaman:{speed:2.8,range:9},guard:{speed:1.7,range:2},assassin:{speed:4.8,range:4},summoner:{speed:2.8,range:5},artillery:{speed:2.8,range:9}}};
