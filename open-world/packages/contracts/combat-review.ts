import {z} from 'zod';
// B2: the settlement screen answers one question — what killed you and what to do next.
// The executing side resolves the hit; the client only renders these fields.
/** How the killing blow arrived. Drives both the hint wording and the advice table. */
export const combatHitKindSchema=z.enum(['melee','projectile','zone','beam','trap','summon','buff','teleport']);
export type CombatHitKind=z.infer<typeof combatHitKindSchema>;

export const combatFatalHitSchema=z.object({
  enemy:z.string().min(1).max(40),
  skill:z.string().min(1).max(40),
  damage:z.number().int().nonnegative(),
  damageType:z.string().min(1).max(24),
  statuses:z.array(z.string().min(1).max(12)).max(4),
  hint:z.string().min(1).max(20),
  kind:combatHitKindSchema,
}).strict();
export type CombatFatalHit=z.infer<typeof combatFatalHitSchema>;

/** Where the button takes you. The client owns the navigation token for each target. */
export const combatAdviceTargetSchema=z.enum(['skills','survival','damage','forge','bag']);
export type CombatAdviceTarget=z.infer<typeof combatAdviceTargetSchema>;

export const combatAdviceSchema=z.object({
  label:z.string().min(1).max(6),
  target:combatAdviceTargetSchema,
  focus:z.enum(['armor','weapon']).optional(),
}).strict();
export type CombatAdvice=z.infer<typeof combatAdviceSchema>;

export const combatReviewSchema=z.object({
  totalTaken:z.number().nonnegative().optional(),
  fatal:combatFatalHitSchema.nullable(),
  advice:z.array(combatAdviceSchema).max(3),
  /** Older hits before the killing blow; collapsed, never the main line. */
  recent:z.array(z.string().min(1).max(60)).max(5),
  /** 缺口诊断一行话（docs/progression-goal-plan.md G4），挑不出明确缺口就不给。 */
  gap:z.string().min(1).max(60).optional(),
}).strict();
export type CombatReview=z.infer<typeof combatReviewSchema>;
