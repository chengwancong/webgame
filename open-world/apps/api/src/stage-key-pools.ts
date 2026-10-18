import {stageKeyRecipeRandom,stageKeyRecipeIds} from './stage-key-recipe-random.ts';
import {gearWeaponAffinity} from '../../../packages/rules/weapon-skills.ts';
import {storyFeatureUnlocked} from '../../../packages/rules/story-campaign.ts';
import {starseaHub} from '../../../packages/content/starsea/index.ts';
import {randomInt} from 'node:crypto';
import {z} from 'zod';
import raw from './stage-key-pools.json';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {worldProgressSchema} from '../../../packages/contracts/open-world.ts';
import type {StageKeyProgress} from '../../../packages/contracts/stage-keys.ts';
import {stageKeyOutputSchema,freezeStageKeyRewardRules,grantStageKeyOutputs} from './stage-key-rewards.ts';
const count=z.number().int().nonnegative(),positive=z.number().positive(),id=z.string().min(1),stage=z.number().int().min(1).max(24);
const choice=z.object({id,name:id,description:id,weight:positive,outputs:z.array(stageKeyOutputSchema).min(1)}).strict();
export const stageKeyPoolSchema=z.object({stage,level:count.positive(),dropProbability:z.number().min(0).max(1),materialsPerSource:z.object({elite:count,rare:count,chest:count}).strict(),chestLoot:id,required:count.positive(),endgameChoices:z.array(choice).min(2).max(3).optional(),choices:z.array(choice).min(2).max(3),basis:z.object({elitePerMinute:positive,lambdaPerMinute:positive,targetMinutes:positive,materialTargetMinutes:positive}).strict()}).strict();
export const stageKeyPoolsContentSchema=z.object({version:count.positive(),source:id,pools:z.array(stageKeyPoolSchema).min(1)}).strict();
export const stageKeyPools=stageKeyPoolsContentSchema.parse(raw).pools;
if(stageKeyPools.some((p,i)=>p.stage!==i+1))throw Error('阶段钥匙池必须按内容完整顺序声明');
export type FrozenStageKeys={pool:z.infer<typeof stageKeyPoolSchema>;rewards:ReturnType<typeof freezeStageKeyRewardRules>};
function resolvedPool(stage:number,tier=0){const source=stageKeyPools.find(p=>p.stage===stage);if(!source)throw Error('阶段钥匙没有内容 '+stage);const pool=structuredClone(source);if(tier>=4&&pool.endgameChoices)pool.choices=pool.endgameChoices;return pool;}
export function freezeStageKeys(stage:number,tier=0):FrozenStageKeys{return {pool:resolvedPool(stage,tier),rewards:freezeStageKeyRewardRules()};}
export function stageKeyScope(stage:number,worldTier=0){return 'stage:'+stage+(worldTier>=4?':tier:'+worldTier:'');}
function account(s:CharacterState,scope:string,stage:number){const w=s.world??=worldProgressSchema.parse({});w.stageKeys??={};const state=w.stageKeys[scope]??={stage,materials:0,obtained:[]};if(state.stage!==stage)throw Error('阶段钥匙存档与来源不符');return state;}
export function stageKeyProgress(s:CharacterState,stage:number,dungeon:string|null=null,worldTier=0,frozenPool?:FrozenStageKeys['pool']):StageKeyProgress{
 const pool=frozenPool??resolvedPool(stage,worldTier);if(!pool)throw Error('阶段钥匙没有内容');const scope=stageKeyScope(stage,worldTier),state:{materials:number;obtained:string[]}=s.world?.stageKeys?.[scope]??{materials:0,obtained:[]};return {scope,stage,dungeon,materials:state.materials,required:pool.required,obtained:state.obtained.length>0,choices:pool.choices.map(c=>({id:c.id,name:c.name,description:c.description,owned:state.obtained.includes(c.id),craftable:state.materials>=pool.required&&!state.obtained.length&&storyFeatureUnlocked(s,'forge')&&!s.dungeon?.instance&&!s.dungeon?.pendingResult&&(s.lastRegion===starseaHub||s.starsea?.location?.map===starseaHub)}))};
}
/** Caller supplies the frozen instance stage and a real verified source. No
 * other stage can issue this pool's keys or its reserved materials. */
export function awardStageKey(s:CharacterState,origin:{stage:number;kind:'elite'|'rare'|'chest';worldTier?:number},frozen:FrozenStageKeys,int=(max:number)=>randomInt(max)){
 const pool=frozen.pool;if(origin.stage!==pool.stage)throw Error('禁止跨阶段钥匙来源');const scope=stageKeyScope(pool.stage,origin.worldTier),state=account(s,scope,pool.stage),materials=state.obtained.length?0:pool.materialsPerSource[origin.kind];state.materials+=materials;
 if(state.obtained.length||int(1000000)/1000000>=pool.dropProbability)return {materials,gear:[],key:null};
 const total=pool.choices.reduce((n,c)=>n+c.weight,0);let roll=int(1000000)/1000000*total,choice=pool.choices.at(-1)!;for(const c of pool.choices){roll-=c.weight;if(roll<0){choice=c;break;}}
 const gain=grantStageKeyOutputs(s,choice.outputs,pool.level,frozen.rewards);for(const item of gain.gear)item.origin={kind:'stage-key',scope,key:choice.id};state.obtained.push(choice.id);return {...gain,materials,key:{id:choice.id,name:choice.name,scope}};
}
export class StageKeyError extends Error {}
export function craftStageKey(s:CharacterState,stage:number,key:string,worldTier=0){const frozen=freezeStageKeys(stage,worldTier),choice=frozen.pool.choices.find(c=>c.id===key);if(!choice)throw new StageKeyError('找不到这份配方。');const scope=stageKeyScope(stage,worldTier),state=account(s,scope,stage);if(state.obtained.length)throw new StageKeyError('钥匙已经到手了。');if(state.materials<frozen.pool.required)throw new StageKeyError('碎片还不够，先去地城。');const gain=grantStageKeyOutputs(s,choice.outputs,frozen.pool.level,frozen.rewards,stageKeyRecipeRandom(s.id,scope,key),stageKeyRecipeIds(s.id,scope,key,gearWeaponAffinity(s.gear.find(g=>g.id===s.equipment.weapon))));for(const item of gain.gear)item.origin={kind:'stage-key',scope,key:choice.id};state.materials-=frozen.pool.required;state.obtained.push(choice.id);return {...gain,key:{id:choice.id,name:choice.name,scope}};}
