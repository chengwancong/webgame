import {z} from 'zod';
export const hexCategories=['attack','defense','control','mobility','resource','synergy'] as const;
const tier=z.object({requiredLevel:z.number().int().positive(),description:z.string()}).strict();
export const hexPlaystyles=['贴身绞杀','先铺后炸','穿行续战','节奏接力'] as const;
export const hexPrerequisites=['dot-source','control-source','summon-source','bound-skill','crit-source'] as const;
export const hexMetadata={playstyle:z.enum(hexPlaystyles).optional(),prereq:z.enum(hexPrerequisites).optional(),flavor:z.string().max(28).optional()};
export const publicHexRuneSchema=z.object({id:z.string(),name:z.string(),description:z.string(),category:z.enum(hexCategories),icon:z.string(),exclusiveGroup:z.string(),...hexMetadata,tiers:z.object({common:tier,magic:tier,rare:tier.optional(),legendary:tier.optional()}).strict()}).strict();
export type PublicHexRune=z.infer<typeof publicHexRuneSchema>;
export const hexStateSchema=z.object({awardedTasks:z.array(z.string()),pity:z.object({q01:z.boolean().optional(),q03:z.boolean().optional(),q03Pending:z.boolean().optional()}).strict().optional()}).strict();
export type HexState=z.infer<typeof hexStateSchema>;
export const hexAffixSchema=z.object({rune:z.string().min(1).max(100),tier:z.enum(['common','magic','rare','legendary'])}).strict();
export type HexAffix=z.infer<typeof hexAffixSchema>;
export const hexActiveSchema=z.object({gear:z.uuid(),rune:z.string().min(1),tier:hexAffixSchema.shape.tier,active:z.boolean(),reason:z.enum(['duplicate','group','level']).optional(),resonance:z.number().min(1).optional()}).strict();
export type HexActive=z.infer<typeof hexActiveSchema>;
export const hexEquipPreviewSchema=z.object({
 current:z.array(hexActiveSchema),equipped:z.array(hexActiveSchema),
 changes:z.array(z.object({gear:z.uuid(),rune:z.string(),tier:hexAffixSchema.shape.tier,change:z.enum(['activate','deactivate','unchanged']),reason:z.enum(['duplicate','group','level']).optional()}).strict())
}).strict();
export type HexEquipPreview=z.infer<typeof hexEquipPreviewSchema>;
export const hexCooldownViewSchema=z.object({observedAt:z.number().finite().nonnegative(),readyAt:z.record(z.string().regex(/^hex:[a-z0-9-]+$/),z.number().finite().nonnegative())}).strict();
export type HexCooldownView=z.infer<typeof hexCooldownViewSchema>;
