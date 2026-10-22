import {z} from 'zod';
const value=z.number().finite().nonnegative();
/** Executor observations, not an estimate of the causal benefit of buffs. */
export const hexCombatStatsSchema=z.object({
 source:z.literal('server'),coverage:z.enum(['complete','partial','unavailable']),
 metric:z.literal('direct-hp-damage'),triggerMetric:z.literal('rule-trigger-events'),
 totalDamage:value.nullable(),directDamage:value.nullable(),share:z.number().min(0).max(1).nullable(),
 rules:z.array(z.object({rule:z.string(),rune:z.string(),source:z.string(),triggers:z.number().int().nonnegative(),directDamage:value,share:z.number().min(0).max(1).nullable()}).strict()),
}).strict();
export type HexCombatStats=z.infer<typeof hexCombatStatsSchema>;
