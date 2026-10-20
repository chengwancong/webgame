import {z} from 'zod';
export const hexCategories=['attack','defense','control','mobility','resource','synergy'] as const;
const tier=z.object({requiredLevel:z.number().int().positive(),description:z.string()}).strict();
export const hexPlaystyles=['贴身绞杀','先铺后炸','穿行续战','节奏接力'] as const;
export const hexPrerequisites=['dot-source','control-source','summon-source','bound-skill','crit-source'] as const;
export const hexMetadata={playstyle:z.enum(hexPlaystyles).optional(),prereq:z.enum(hexPrerequisites).optional(),flavor:z.string().max(28).optional()};
export const publicHexRuneSchema=z.object({id:z.string(),name:z.string(),description:z.string(),category:z.enum(hexCategories),icon:z.string(),exclusiveGroup:z.string(),...hexMetadata,tiers:z.object({common:tier,magic:tier,rare:tier.optional(),legendary:tier.optional()}).strict()}).strict();
export type PublicHexRune=z.infer<typeof publicHexRuneSchema>;
export const hexChoiceRewardSchema=z.object({quality:z.enum(['common','magic']),count:z.number().int().min(1).max(4)}).strict();
export const hexChoiceOfferSchema=z.object({
 id:z.string().min(1).max(120),task:z.string().min(1).max(120),
 candidates:z.array(z.object({id:z.uuid(),base:z.string().min(1),quality:z.enum(['common','magic']),playstyle:z.enum(hexPlaystyles)}).strict()).min(1).max(4),
 selected:z.uuid().optional()
}).strict();
export const hexStateSchema=z.object({shards:z.number().int().nonnegative(),awardedTasks:z.array(z.string()),offers:z.array(hexChoiceOfferSchema)}).strict();
export type HexState=z.infer<typeof hexStateSchema>;
