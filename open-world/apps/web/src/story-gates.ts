import type {CharacterState,StoryFeature} from '../../../packages/contracts/index.ts';
import {storyFeatureUnlocked,storyFeatureReason,storyProgressionFeature} from '../../../packages/rules/story-campaign.ts';

/** 剧情功能入口显隐。规则只来自 packages/rules，服务端仍负责最终拦截；快照未就绪时不隐藏。 */
export function featureOpen(snapshot:CharacterState|undefined,feature:StoryFeature|undefined){return !feature||!snapshot||storyFeatureUnlocked(snapshot,feature);}
export function featureReason(snapshot:CharacterState|undefined,feature:StoryFeature){return snapshot?storyFeatureReason(snapshot,feature):'尚未解锁';}

// 每个养成模块用一个代表操作交给共享规则判定；未映射到剧情功能的模块始终可见。
// 收集奖励以法典收集为主，随威能法典一起展示。
const sectionOperations:Record<string,[string,number?]>={grid:['grid.assign',1],weapons:['weapon.level'],aspects:['aspect.imprint'],collection:['aspect.imprint'],summons:['summon.level'],professions:['profession.gather']};
export function progressionSectionOpen(snapshot:CharacterState|undefined,section:string){const op=sectionOperations[section];return !op||featureOpen(snapshot,storyProgressionFeature(op[0],op[1]));}

export const challengeFeatures=['high','nightmare','raid'] as const satisfies readonly StoryFeature[];
export function challengeOpen(snapshot:CharacterState|undefined,kind:string){return !(challengeFeatures as readonly string[]).includes(kind)||featureOpen(snapshot,kind as StoryFeature);}
export const anyChallengeOpen=(snapshot:CharacterState|undefined)=>challengeFeatures.some(kind=>featureOpen(snapshot,kind));
