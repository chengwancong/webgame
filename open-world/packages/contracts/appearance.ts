import {z} from 'zod';
import {weaponTypeSchema} from './weapons.ts';

export const appearanceSlots=['head','body','hands','legs','feet','back','weapon'] as const;
export const weaponFamilies=['sword','axe','bow','gun','fist','spear','magic'] as const;
export const appearanceSlotSchema=z.enum(appearanceSlots);
const appearanceId=z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const appearanceSelectionSchema=z.object({head:appearanceId.optional(),body:appearanceId.optional(),hands:appearanceId.optional(),legs:appearanceId.optional(),feet:appearanceId.optional(),back:appearanceId.optional(),weapon:appearanceId.optional()}).strict();
export const appearanceStateSchema=z.object({selection:appearanceSelectionSchema.default({}),unlocked:z.array(appearanceId).default([])}).strict();
const part=z.object({setId:appearanceId}).strict();
const grade={series:z.enum(['standard','primal','omega']),tier:z.number().int().min(1).max(3)};
/** Equipped main hand and armor by gameplay type and grade; the native rig picks body class, rarity and held weapon from this. */
export const appearanceKitSchema=z.object({weapon:z.object({type:weaponTypeSchema,...grade}).strict().nullable(),armor:z.object({family:weaponTypeSchema,...grade}).strict().nullable()}).strict();
export const resolvedAppearanceSchema=z.object({rig:z.literal('modular-hero'),family:z.enum(weaponFamilies),parts:z.object({head:part,body:part,hands:part,legs:part,feet:part,back:part,weapon:part}).strict(),styleProfile:z.literal('v2-soft'),revision:z.number().int().nonnegative(),kit:appearanceKitSchema.optional()}).strict();
export const appearancePreviewSchema=z.object({revision:z.number().int().nonnegative(),selection:appearanceSelectionSchema,resolvedAppearance:resolvedAppearanceSchema}).strict();
export const appearanceViewSchema=appearancePreviewSchema.extend({slots:z.array(appearanceSlotSchema),catalog:z.array(z.object({id:appearanceId,name:z.string(),slots:z.array(appearanceSlotSchema),weaponFamilies:z.array(z.enum(weaponFamilies)),owned:z.boolean(),unlockHint:z.string()}).strict())}).strict();
export type AppearanceSlot=typeof appearanceSlots[number];
export type WeaponFamily=typeof weaponFamilies[number];
export type AppearanceSelection=z.infer<typeof appearanceSelectionSchema>;
export type AppearanceState=z.infer<typeof appearanceStateSchema>;
export type AppearanceKit=z.infer<typeof appearanceKitSchema>;
export type ResolvedAppearance=z.infer<typeof resolvedAppearanceSchema>;
export type AppearancePreview=z.infer<typeof appearancePreviewSchema>;
export type AppearanceView=z.infer<typeof appearanceViewSchema>;
