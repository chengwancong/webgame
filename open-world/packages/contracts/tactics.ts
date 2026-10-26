import {z} from 'zod';
/**
 * 托管编排（planning-bd-v1/27 §3，R2）：玩家影响自动战斗的唯一入口。只用固定选项，不做条件脚本（D-A3）。
 * order 是技能优先级（可用即按顺序放）；target/stance/survival 三个开关；conditions 每个技能最多一个固定条件。
 */
export const tacticTargets=['near','low','elite','ranged'] as const;
export const tacticStances=['close','range','kite'] as const;
export const skillConditions=['crowd','elite','hurt','mana','burst','manual'] as const;
export type TacticTarget=typeof tacticTargets[number];
export type TacticStance=typeof tacticStances[number];
export type SkillCondition=typeof skillConditions[number];
const id=z.string().min(1).max(64);
export const tacticsSchema=z.object({
 order:z.array(id).max(8),
 target:z.enum(tacticTargets),
 stance:z.enum(tacticStances),
 survival:z.boolean(),
 conditions:z.record(id,z.enum(skillConditions)),
 /** R3：爆发能量满时自动放（默认开）。关掉后只在按爆发键时放，可以留给首领破绽窗口。 */
 burstAuto:z.boolean().optional(),
}).strict();
export type Tactics=z.infer<typeof tacticsSchema>;
export const tacticTargetLabels:Record<TacticTarget,string>={near:'最近',low:'残血',elite:'精英优先',ranged:'远程优先'};
export const tacticStanceLabels:Record<TacticStance,string>={close:'贴身',range:'保持距离',kite:'风筝'};
export const skillConditionLabels:Record<SkillCondition,string>={crowd:'敌人≥3 时才放',elite:'目标是精英/首领时才放',hurt:'生命低于 50% 时才放',mana:'蓝量高于 60% 时才放',burst:'保留给首领破绽窗口',manual:'不自动放（留给手动）'};
