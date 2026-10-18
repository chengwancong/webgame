import {assembleBuildVariety,type BuildVarietyProfile} from '../build-variety-builds.ts';
import {pacingBuildTargets,pacingSettings} from '../../packages/content/pacing-targets.ts';
import {statIdSchema} from '../../packages/contracts/stats.ts';

/** Selected from the existing attainable-content catalogue, not new item grants. */
export const pacingProfiles:BuildVarietyProfile[]=pacingBuildTargets.map(row=>({...structuredClone(row.profile!),keyStats:statIdSchema.array().parse(row.profile!.keyStats)}));
export const profileSubstitutions={arrows:{original:'bow / rain_of_arrows / aspect-build-split',actual:'hidden / throwing_knife + fan_of_knives + blade_flurry / aspect-tf-knife',reason:'目标指定暗器；现有弓技能与分裂箭威能不支持暗器，按任务单 §3 采用同谱系最近的千刃投射物构筑，不静默过滤技能。'}};
export function pacingBuild(profile:BuildVarietyProfile){return assembleBuildVariety(profile,pacingSettings.get('benchmark') as {level:number;itemLevel:number;skillRank:number;artStage:1|2|3});}
