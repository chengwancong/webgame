import timing from '../assets/numerics/world-stage-timing.json';
export type StageTiming={index:number;start:number;clear:number;end:number;level:number};
export function validateStageTiming(stages:readonly StageTiming[]){if(stages.length!==24)throw Error('Expected the complete24 stage schedule');for(const [i,s]of stages.entries()){if(s.index!==i+1||![s.start,s.clear,s.end,s.level].every(Number.isFinite)||s.start>=s.clear||s.clear>=s.end||i>0&&Math.abs(s.start-stages[i-1].end)>1e-6)throw Error('Invalid stage timing '+s.index);}return stages;}
export const stageTimings=validateStageTiming(timing.stages);
/** The Python timing owner exports these points; no second level/time formula. */
export function minutesAtLevel(level:number){if(!Number.isFinite(level)||level<1||level>60)throw Error('Invalid expected level');const low=Math.floor(level),a=timing.timeline.find(p=>p.level===low)!,b=timing.timeline.find(p=>p.level===low+1)!;return a.minutes+(b.minutes-a.minutes)*(level-low);}
/** Invert the exported owner points; no independent level/time curve. */
export function levelAtMinutes(minutes:number){if(!Number.isFinite(minutes)||minutes<0)throw Error('Invalid expected clock');const i=timing.timeline.findIndex(p=>p.minutes>=minutes);if(i<0)return 60;const b=timing.timeline[i],a=timing.timeline[Math.max(0,i-1)];return Math.min(60,a.level+(b.level-a.level)*(minutes-a.minutes)/(b.minutes-a.minutes||1));}
export function completedStageAt(minutes:number,stages:readonly StageTiming[]=stageTimings){if(!Number.isFinite(minutes)||minutes<0)throw Error('Invalid schedule clock');return stages.filter(s=>s.clear<=minutes).length;}
const milestone=(stage:number,rows:readonly (readonly [number,number])[])=>rows.reduce((value,[required,next])=>stage>=required?next:value,0);
/** These are acquisition milestones, not combat multipliers. Existing rules
 * calculate the power of the actually equipped items/skills/sets afterwards. */
export function phaseAcquisitionAt(minutes:number){const stage=completedStageAt(minutes);return {stage,
 legendary:milestone(stage,[[10,1],[13,2],[16,3],[20,4],[22,5],[24,6]]),
 rare:milestone(stage,[[3,1],[4,2],[6,4],[9,6]]),
 setPieces:milestone(stage,[[10,2],[18,4],[24,6]]),
 skillRank:Math.max(1,milestone(stage,[[2,2],[6,3],[9,4],[15,5]])),
 enhance:milestone(stage,[[4,2],[6,4],[9,6],[12,7],[15,8],[17,9],[21,11],[24,12]]),
 codexRank:Math.max(1,milestone(stage,[[17,2],[19,3],[22,4],[24,5]])),
 omega:stage>=15,weaponUncap:milestone(stage,[[17,1],[23,2]]),
 summonUncap:milestone(stage,[[20,1],[24,2]]),
 };}
