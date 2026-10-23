// M17 杖剑借鉴的内容表：航区元素、宠物、探索度。
import {z} from 'zod';
import elementsRaw from './hub-elements.json';
import petsRaw from './pets.json';
import exploreRaw from './hub-explore.json';
import {damageTypeSchema} from '../contracts/skill-mechanics.ts';
import {petFlowSchema,petFlows,petIslandSchema,petTierSchema,petFamilyIdSchema} from '../contracts/zhangjian.ts';
import {chartRegionIdSchema} from '../contracts/hub.ts';
import {statRegistry} from '../contracts/stats.ts';
import {hubChartContent} from './hub-chart.ts';

const pair=z.object({threat:damageTypeSchema,weakness:damageTypeSchema}).strict();
export const hubElementsSchema=z.object({weaknessBonus:z.number().positive().max(1),regions:z.record(chartRegionIdSchema,pair),nodes:z.record(z.string(),pair)}).strict().superRefine((v,ctx)=>{for(const id of Object.keys(v.nodes))if(!hubChartContent.nodes.some(n=>n.id===id))ctx.addIssue({code:'custom',message:'元素表引用了不存在的节点 '+id});});
export const hubElements=hubElementsSchema.parse(elementsRaw);

const statBonus=z.object({stat:z.string().refine(id=>statRegistry.some(d=>d.id===id),'未登记的属性'),value:z.number().positive()}).strict();
export const petContentSchema=z.object({
 flows:z.record(petFlowSchema,damageTypeSchema),flowNames:z.record(petFlowSchema,z.string().min(1)),
 tiers:z.record(petTierSchema,z.object({activeRatio:z.number().positive(),passive:statBonus,extra:statBonus.optional(),source:z.string().min(1)}).strict()),
 levelCap:z.number().int().positive(),activeEvery:z.number().int().positive(),activeRadius:z.number().positive(),activeRange:z.number().positive(),levelRatioBonus:z.number().nonnegative(),passivePerTenLevels:z.number().nonnegative(),supportShare:z.number().min(0).max(1),
 forms:z.object({adult:z.number().int().positive(),awakened:z.number().int().positive()}).strict(),
 families:z.array(z.object({id:petFamilyIdSchema,name:z.string().min(1),island:petIslandSchema,region:chartRegionIdSchema,tier:petTierSchema,runtime:z.string().regex(/^ss-pet-/)}).strict()).length(18),
}).strict().superRefine((v,ctx)=>{for(const f of petFlows)if(!v.flows[f])ctx.addIssue({code:'custom',message:'流派缺元素 '+f});if(new Set(v.families.map(f=>f.id)).size!==18)ctx.addIssue({code:'custom',message:'宠物家族重复'});});
export const petContent=petContentSchema.parse(petsRaw);
export type PetFamily=typeof petContent.families[number];
export const petFamilyById=new Map(petContent.families.map(f=>[f.id,f]));

const door=z.object({id:z.string().min(1),node:z.string().min(1),key:chartRegionIdSchema}).strict();
export const hubExploreSchema=z.object({
 points:z.object({node:z.number().int().positive(),cache:z.number().int().positive(),door:z.number().int().positive()}).strict(),
 milestones:z.array(z.object({percent:z.union([z.literal(50),z.literal(100)]),dockBonus:z.number().nonnegative(),reward:z.string()}).strict()).length(2),
 keys:z.partialRecord(chartRegionIdSchema,z.object({name:z.string().min(1),from:z.string().min(1)}).strict()),
 cache:z.object({revealRadius:z.number().positive(),offPath:z.tuple([z.number().positive(),z.number().positive()]),loot:z.object({t1:z.number().int().positive(),patternChance:z.number().min(0).max(1)}).strict()}).strict(),
 door:z.object({loot:z.object({t2:z.number().int().positive(),gold:z.number().int().nonnegative()}).strict()}).strict(),
 regions:z.partialRecord(chartRegionIdSchema,z.object({doors:z.array(door)}).strict()),
}).strict().superRefine((v,ctx)=>{for(const [region,r] of Object.entries(v.regions))for(const d of r.doors){const n=hubChartContent.nodes.find(n=>n.id===d.node);if(!n||n.region!==region)ctx.addIssue({code:'custom',message:'锁门节点不在本航区 '+d.id});if(d.key===region)ctx.addIssue({code:'custom',message:'锁门不能用本航区钥匙 '+d.id});}});
export const hubExplore=hubExploreSchema.parse(exploreRaw);
