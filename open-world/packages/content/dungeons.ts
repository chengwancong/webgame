import {augmentPolicySchema} from '../contracts/run-augments.ts';
import {dungeonAugmentPublicSchema as augmentPublic,dungeonAugmentExtraSchema as augmentExtra} from './dungeon-augments.ts';
import {z} from 'zod';
import source from './dungeons.json';
import encounter from './encounter-balance.json';
import {regions,regionById} from './index.ts';
import './open-world/index.ts';
import {challengeContent} from './progression-challenges.ts';
import {monsterContent} from './monsters.ts';
import {monsterLevelValues} from '../rules/monster-stats.ts';
import {planePolicySchema,type DungeonDefinition,type DungeonPolicy,type DungeonRuntimeOptions} from '../contracts/dungeons.ts';
const positive=z.number().positive(),nonnegative=z.number().nonnegative(),integer=z.number().int().nonnegative();
const goals=z.union([integer,z.enum(['bossEntry.requiredKills','bossEntry.requiredElites'])]);
const quota=z.object({pool:z.string(),period:z.enum(['day','week']),limit:integer.positive().optional(),limitRef:z.enum(['challenge.raidWeekly','challenge.highDaily','challenge.nightmareDaily']).optional()}).strict().refine(v=>v.limit!==undefined||v.limitRef!==undefined,'Quota needs a declared limit');
export const dungeonPolicySchema=z.object({plane:planePolicySchema.optional(),stageEnemyScale:z.array(z.object({hp:positive,attack:positive}).strict()).min(1).optional(),augments:augmentPublic.optional(),entryLevel:integer.positive(),monsterLevel:integer.positive().nullable(),maxTier:integer.positive(),minTier:integer.positive(),tierRules:z.object({hpPerTier:nonnegative,attackPerTier:nonnegative,rewardPerTier:nonnegative,affixCount:integer,recordNightmareRank:z.boolean()}).strict(),timeLimitSeconds:positive,loadingSeconds:positive,retention:z.object({enabled:z.boolean(),seconds:positive}).strict(),disconnect:z.enum(['retain','end']),buildLocked:z.boolean(),checkpointJoin:z.boolean(),quotaAt:z.enum(['start','success']),entryCost:z.object({gold:integer,material:integer}).strict(),rescue:z.object({seconds:positive,range:positive,hpRatio:positive.max(1)}).strict(),allyRange:nonnegative,overflow:z.literal('allow'),returnRegion:z.string(),refundSystemAbort:z.boolean(),party:z.object({min:integer.positive(),max:integer.positive(),roles:z.record(z.string(),integer),defaultRole:z.string()}).strict(),enemyScale:z.object({hp:positive,attack:positive,hpPerStage:nonnegative,attackPerStage:nonnegative}).strict(),normalGoals:z.object({killCount:goals,eliteCount:goals}).strict()}).strict();
const partial=dungeonPolicySchema.partial().extend({augments:augmentPublic.partial().optional(),retention:dungeonPolicySchema.shape.retention.partial().optional(),rescue:dungeonPolicySchema.shape.rescue.partial().optional(),party:dungeonPolicySchema.shape.party.partial().optional(),enemyScale:dungeonPolicySchema.shape.enemyScale.partial().optional(),normalGoals:dungeonPolicySchema.shape.normalGoals.partial().optional(),entryCost:dungeonPolicySchema.shape.entryCost.partial().optional(),tierRules:dungeonPolicySchema.shape.tierRules.partial().optional(),mode:z.enum(['realtime','simulation']).optional(),feature:z.enum(['trial','high','raid','nightmare','field-dungeon']).optional(),partyRef:z.literal('challenge.raidParty').optional(),tierRef:z.literal('challenge.nightmare').optional(),quota:quota.optional()}).strict();
const reward=z.object({gold:integer,xp:integer,material:integer}).strict();
const definition=z.object({hardmode:z.object({stageEnemyScale:z.array(z.object({hp:positive,attack:positive}).strict()).min(1).optional(),worldTierScalingFrom:integer.min(4).optional(),numericStage:integer.min(19).max(24),level:integer.positive(),monsterLevel:integer.positive(),enemyScale:z.object({hp:positive,attack:positive}).strict()}).strict().optional(),bossBudgetSeconds:positive.optional(),numericStage:integer.min(1).max(24).optional(),worldTierScaling:z.boolean().optional(),id:z.string(),name:z.string().optional(),kind:z.enum(['normal','trial','high','nightmare','raid']),profiles:z.array(z.string()),area:z.string().optional(),stages:z.array(z.string()).optional(),worldDrops:z.boolean().optional(),bossAccess:z.string().optional(),requires:z.array(z.string()).optional(),level:integer.positive().optional(),challenge:z.string().optional(),story:z.string().optional(),reward:reward.optional(),policy:partial.optional()}).strict();
export const dungeonContentSchema=z.object({augmentExtra:augmentExtra.optional(),augments:augmentPolicySchema.optional(),version:integer.positive(),defaults:dungeonPolicySchema.extend({worldDrops:z.boolean(),reward}),runtime:z.object({pumpMs:positive,stateEveryMs:positive,heartbeatMs:positive,connectionTimeoutMs:positive,inputHoldMs:positive,inputEveryMs:positive,maxInputBatch:integer.positive(),autoTicksPerSlice:integer.positive(),maxCatchupTicksPerSlice:integer.positive(),detailRetentionDays:positive,maxPreparingPerLeader:integer.positive(),preparingHours:positive,maxFaultRetries:integer.positive(),cleanupEveryMs:positive}).strict(),profiles:z.record(z.string(),partial),definitions:z.array(definition)}).strict();
function merge(a:any,b:any):any{const out={...a};for(const [key,value] of Object.entries(b))out[key]=key==='roles'?structuredClone(value):value&&typeof value==='object'&&!Array.isArray(value)?merge(a[key]??{},value):value;return out;}
function referencePatch(p:z.infer<typeof partial>){let result:any=structuredClone(p);if(p.partyRef)result=merge({party:{min:challengeContent.limits.raidSize,max:challengeContent.limits.raidSize,roles:challengeContent.limits.raidRoles}},result);if(p.tierRef)result=merge({maxTier:challengeContent.nightmare.maxTier,tierRules:{...challengeContent.nightmare,recordNightmareRank:true}},result);if(result.tierRules)delete result.tierRules.maxTier;return result;}
export function resolveDungeonContent(raw:unknown):{definitions:DungeonDefinition[];runtime:DungeonRuntimeOptions;version:number}{
 const content=dungeonContentSchema.parse(raw),ids=new Set<string>();
 const definitions:DungeonDefinition[]=content.definitions.map(d=>{
  if(ids.has(d.id))throw Error('Duplicate dungeon '+d.id);ids.add(d.id);
  const legacy=d.challenge?challengeContent.entries.find(e=>e.id===d.challenge):undefined;if(d.challenge&&!legacy)throw Error('Unknown dungeon challenge '+d.challenge);
  let resolved:any=structuredClone(content.defaults);if(legacy)resolved=merge(resolved,{enemyScale:{hp:legacy.hp,attack:legacy.attack}});
  for(const name of d.profiles){const profile=content.profiles[name];if(!profile)throw Error('Unknown dungeon profile '+name);resolved=merge(resolved,referencePatch(profile));}
  resolved=merge(resolved,referencePatch(d.policy??{}));
  if(!resolved.mode)throw Error('Missing execution mode '+d.id);
  if(resolved.party.min>resolved.party.max||Object.values(resolved.party.roles as Record<string,number>).reduce((n,v)=>n+v,0)>resolved.party.max)throw Error('Impossible dungeon party '+d.id);
  if(resolved.plane&&(resolved.party.max!==1||resolved.mode!=='realtime'))throw Error('Plane instances are solo realtime runs '+d.id);
  if(resolved.disconnect==='retain'&&!resolved.retention.enabled)throw Error('Retention disabled but disconnect retains '+d.id);
  if(resolved.minTier>resolved.maxTier||resolved.tierRules.affixCount>challengeContent.affixes.length)throw Error('Impossible tier or affix configuration '+d.id);
  if(!regions.some(r=>r.id===resolved.returnRegion&&!r.boss))throw Error('Unknown dungeon return '+d.id);
  const lookup=(ref:any)=>typeof ref==='number'?ref:ref==='bossEntry.requiredKills'?encounter.bossEntry.requiredKills:encounter.bossEntry.requiredElites;
  resolved.normalGoals={killCount:lookup(resolved.normalGoals.killCount),eliteCount:lookup(resolved.normalGoals.eliteCount)};
  const stages=d.stages??(legacy?Array.from({length:legacy.stages},()=>legacy.region):undefined);if(!stages?.length)throw Error('Missing dungeon stages '+d.id);
  if(resolved.stageEnemyScale&&resolved.stageEnemyScale.length!==stages.length)throw Error('Stage enemy scale must cover every declared room '+d.id);
  for(const id of stages){const region=regions.find(r=>r.id===id&&r.id!=='town');if(!region)throw Error('Unknown dungeon map '+id);if(resolved.monsterLevel!==null)for(const spawn of region.spawns){const template=monsterContent.templates.find(t=>t.id===spawn.monster?.template);if(!template)throw Error('Unknown dungeon monster template');monsterLevelValues(template.curve,resolved.monsterLevel);}}
  if(!regions.find(r=>r.id===stages.at(-1))?.spawns.some(s=>s.boss))throw Error('Dungeon final stage requires real boss '+d.id);
  if(d.bossAccess&&!regions.some(r=>r.id===d.bossAccess&&r.boss))throw Error('Unknown boss access '+d.id);
  const area=d.area??legacy!.region.replace(/-boss$/,''),level=d.level??legacy?.level??resolved.entryLevel;
  try{regionById(area);}catch{throw Error('Unknown dungeon area '+d.id);}
  const limits:Record<string,number>={'challenge.raidWeekly':challengeContent.limits.raidWeekly,'challenge.highDaily':challengeContent.limits.highDaily,'challenge.nightmareDaily':challengeContent.limits.nightmareDaily};
  const q=resolved.quota?{pool:resolved.quota.pool,period:resolved.quota.period,limit:resolved.quota.limit??limits[resolved.quota.limitRef]}:undefined;
  const {mode,feature,worldDrops,reward:defaultReward,quota:_quota,partyRef,tierRef,...policy}=resolved;dungeonPolicySchema.parse(policy);
  if(policy.augments&&content.augments&&!content.augments.enabled)policy.augments.enabled=false;
  if(policy.augments?.enabled&&(!content.augments||policy.augments.roundCount<1||policy.augments.roundCount>content.augments.rounds.length))throw Error('Unsupported declared augment round count '+d.id);
  for(const id of stages.slice(0,-1)){const r=regions.find(r=>r.id===id)!;if(!r.boss&&!d.story&&(policy.normalGoals.killCount>r.spawns.filter(e=>!e.boss).length||policy.normalGoals.eliteCount>r.spawns.filter(e=>e.elite).length))throw Error('Impossible stage objectives '+d.id);}
  return {...(d.hardmode?{hardmode:d.hardmode}:{}),...(d.bossBudgetSeconds?{bossBudgetSeconds:d.bossBudgetSeconds}:{}),...(d.numericStage?{numericStage:d.numericStage}:{}),...(d.worldTierScaling!==undefined?{worldTierScaling:d.worldTierScaling}:{}),id:d.id,name:d.name??legacy?.name??regions.find(r=>r.id===area)!.name,kind:d.kind,mode,feature,area,stages,level,bossAccess:d.bossAccess,requires:d.requires??[],worldDrops:d.worldDrops??worldDrops,challenge:d.challenge,story:d.story,maxTier:policy.maxTier,quota:q,reward:d.reward??legacy?.reward??defaultReward,policy:policy as DungeonPolicy,contentVersion:content.version};
 });
 for(const d of definitions)for(const id of d.requires)if(!ids.has(id))throw Error('Unknown prerequisite '+id);
 const visit=(id:string,path:Set<string>)=>{if(path.has(id))throw Error('Cyclic dungeon prerequisites '+id);const next=new Set([...path,id]);for(const required of definitions.find(d=>d.id===id)!.requires)visit(required,next);};for(const d of definitions)visit(d.id,new Set());
 return {definitions,runtime:content.runtime,version:content.version};
}
export const dungeonContent=resolveDungeonContent(source);

export {dungeonAugmentPolicy,dungeonAugmentExtra,resolveRunAugmentPolicy} from './dungeon-augments.ts';
