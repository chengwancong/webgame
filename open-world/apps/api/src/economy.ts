// Private reward configuration. No browser-side imports are allowed.
import regionalRewards from './regional-rewards.json';
export const rewards={boss:{gold:120,xp:100,material:8},rare:{gold:54,xp:72,material:6},elite:{gold:18,xp:24,material:2},normal:{gold:6,xp:10,material:1},gearPercent:18,taskGold:50,taskMaterial:5,salvageMaterial:3,regions:regionalRewards};
import {starseaIslands,starseaBossMaps,starseaHub,starseaLootFocus,starseaBalance,bossLevels,islandBands} from '../../../packages/content/starsea/index.ts';
import {economyRegionOf} from '../../../packages/content/index.ts';
const starseaAreas=['meadow','forest','rift','tundra','abyss','dragonbone'];
/** 星潮海地图复用旧六区的掉落档位：第 N 岛及其首领场对应第 N 个旧区域。 */
export function economyArea(region:string){
 region=economyRegionOf(region);
 if(region===starseaHub)return starseaAreas[0];
 const n=Math.max(starseaIslands.indexOf(region),starseaBossMaps.indexOf(region));
 return n>=0?starseaAreas[n]:region.replace(/-boss$/,'');
}
/** 星潮海击杀按怪物等级给经验和金币（balance-30h-design.md §2.2、§6），带等级差修正。 */
export function overlevelXpMultiplier(playerLevel:number,monsterLevel:number){const excess=Math.max(0,playerLevel-monsterLevel-2);return Math.max(.25,1-.15*excess);}
export function starseaKillReward(level:number,rank:'normal'|'elite'|'rare'|'boss',playerLevel:number,region?:string,hardmode=false){
 const scale=rank==='boss'?20:rank==='rare'?7.5:rank==='elite'?2.5:1,goldScale=rank==='boss'?20:rank==='rare'?9:rank==='elite'?3:1,penalty=overlevelXpMultiplier(playerLevel,level);
 // Chapter multipliers are generated from real task waves, rewards and one island clear.
 if(region)region=economyRegionOf(region);
 const located=region?Math.max(starseaIslands.indexOf(region),starseaBossMaps.indexOf(region)):(rank==='boss'?bossLevels.findIndex(L=>level<=L):islandBands.findIndex(([,hi])=>level<=hi));
 const chapter=located<0?5:located;
 const factor=hardmode?1:(rank==='boss'?starseaBalance.bossXpMultipliers:starseaBalance.killXpMultipliers)[chapter]??1;
 return {xp:Math.max(1,Math.round(30*1.12**(level-1)*scale*penalty*factor)),gold:Math.max(1,Math.round(6*1.09**(level-1)*goldScale)),material:rank==='boss'?8:rank==='rare'?6:rank==='elite'?2:1};
}
type RewardRules=Omit<typeof rewards,'regions'> & {regions?:Record<string,{gold:number;xp:number;material:number}>};
export function rewardFor(region:string,kind:'normal'|'elite'|'rare'|'boss',rules:RewardRules=rewards){
 const base=rules[kind],factor=rules.regions?.[economyArea(region)]??{gold:1,xp:1,material:1};
 return {gold:Math.round(base.gold*factor.gold),xp:Math.round(base.xp*factor.xp),material:Math.round(base.material*factor.material)};
}

import {randomInt} from 'node:crypto';
import type {GearQuality,Spawn} from '../../../packages/contracts/index.ts';
import dropProfiles from './drop-profiles.json';
import collectionDropSource from './equipment-drop-rules.json';
import {z} from 'zod';
import {equipmentSeries} from '../../../packages/contracts/equipment-catalog.ts';
import {collectionEquipment,equipmentStage} from '../../../packages/content/equipment-runtime.ts';
import {progressionGearTemplates} from '../../../packages/content/deep-progression.ts';
const endgameBases=new Set(progressionGearTemplates.map(template=>template.base));
export function worldGearTemplates<T extends {base:string}>(templates:readonly T[]):T[]{return templates.filter(template=>!endgameBases.has(template.base));}
export const equipmentDropRules=z.object({version:z.number().int().positive(),tiers:z.record(z.string(),z.union([z.literal(1),z.literal(2),z.literal(3)])),seriesWeights:z.record(z.enum(equipmentSeries),z.number().int().positive()),
 /** 分章掉落：本区对应岛屿偏重的装备系（starseaLootFocus）权重 ×familyBoost。 */
 familyBoost:z.number().int().positive().optional()}).strict().parse(collectionDropSource);
export type EquipmentDropRules=typeof equipmentDropRules;
export type DropProfile=typeof dropProfiles[number];
export const encounterDropProfiles=dropProfiles;
export function chanceExpectation(probability:number){
 if(!Number.isFinite(probability)||probability<0||probability>1)throw Error('Invalid drop probability');
 return {probability,meanKills:probability?1/probability:null,killsFor95Percent:probability===1?1:probability?Math.ceil(Math.log(.05)/Math.log(1-probability)):null};
}
export function dropProfileFor(region:string):DropProfile{
 const area=economyArea(region);const profile=dropProfiles.find(v=>v.area===area);
 if(!profile)throw Error('No private drop profile for '+region);return profile;
}
export type RewardRandomInt=(min:number,max:number)=>number;
export function scaleWorldGear<T extends {attack:number;armor:number;base?:string;regional_primary_base?:number}>(template:T,profile:{gearBaseScale?:number}):T{
 const scale=profile.gearBaseScale??1;if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid regional equipment power');
 if(template.regional_primary_base!==undefined){const value=Math.round(template.regional_primary_base*scale);return {...template,attack:template.attack>0?value:0,armor:template.armor>0?value:0};}
 const item=template.base?collectionEquipment(template.base):undefined;
 const relative=scale/(item?equipmentStage(item.tier).primaryScale:1);
 return {...template,attack:Math.round(template.attack*relative),armor:Math.round(template.armor*relative)};
}
export function gearTemplatesForRegion<T extends {base:string}>(templates:readonly T[],region:string,rules:EquipmentDropRules=equipmentDropRules):T[]{
 const collection=templates.filter(template=>collectionEquipment(template.base));
 // Old frozen runs retain exactly their old template pool.
 if(!collection.length)return [...templates];
 const tier=rules.tiers[economyArea(region)];if(!tier)throw Error('Missing collection drop stage for '+region);
 const eligible=[...collection.filter(template=>collectionEquipment(template.base)!.tier===tier),...templates.filter(template=>!collectionEquipment(template.base))];
 if(!eligible.length)throw Error('Empty collection drop pool for '+region);return eligible;
}
export function dropWeight(base:string,region:string,rules:EquipmentDropRules=equipmentDropRules){const item=collectionEquipment(base);if(!item)return 1;return rules.seriesWeights[item.series]*(starseaLootFocus[starseaAreas.indexOf(economyArea(region))]?.includes(item.family)?rules.familyBoost??1:1);}
export function pickRegionalGearTemplate<T extends {base:string}>(templates:readonly T[],region:string,rules:EquipmentDropRules=equipmentDropRules,rollInt:RewardRandomInt=randomInt):T{
 const eligible=gearTemplatesForRegion(templates,region,rules);
 const weight=(template:T)=>dropWeight(template.base,region,rules);
 const total=eligible.reduce((sum,template)=>sum+weight(template),0);let roll=rollInt(0,total);
 for(const template of eligible){roll-=weight(template);if(roll<0)return template;}throw Error('Invalid equipment template weights');
}
export function rollGearQuality(weights:Record<GearQuality,number>,rollInt:RewardRandomInt=randomInt):GearQuality{
 const total=Object.values(weights).reduce((a,b)=>a+b,0);if(total<=0)throw Error('Empty quality weights');
 let roll=rollInt(0,total);for(const[q,w]of Object.entries(weights)){roll-=w;if(roll<0)return q as GearQuality;}throw Error('Invalid quality weights');
}
/** `legendaryScale` is the world-tier gear value factor: it scales the legendary weight only. */
export function rollGearDrop(m:Pick<Spawn,'boss'|'elite'>,profile:DropProfile,firstBoss:boolean,rollInt:RewardRandomInt=randomInt,legendaryScale=1):GearQuality|null{
 const kind=m.boss?'boss':m.elite?'elite':'normal';
 const entry=profile[kind];if(rollInt(0,100)>=entry.gearPercent)return null;
 const weights=m.boss&&firstBoss?profile.firstBoss:entry.quality;
 // Weights ×100 keep small integer legendary weights scalable without rounding to nothing.
 return rollGearQuality(legendaryScale===1?weights:Object.fromEntries(Object.entries(weights).map(([q,w])=>[q,Math.round(w*100*(q==='legendary'?legendaryScale:1))])) as typeof weights,rollInt);
}
