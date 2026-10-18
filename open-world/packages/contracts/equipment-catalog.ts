import {z} from 'zod';

// Collection parts map to real equipment slots; the legacy accessory key is
// retained for necklaces. Tier describes collection stage, not affix quality.
export const equipmentParts=['weapon','armor','helmet','boots','necklace','ring'] as const;
export const equipmentFamilies=['sword','hammer','axe','staff','hidden','wand'] as const;
export const equipmentSeries=['standard','omega','primal'] as const;
export const equipmentItemSchema=z.object({
 id:z.string().min(1),kind:z.literal('equipment'),name:z.string().min(1),
 part:z.enum(equipmentParts),family:z.enum(equipmentFamilies),series:z.enum(equipmentSeries),
 tier:z.union([z.literal(1),z.literal(2),z.literal(3)]),setId:z.string().min(1),iconId:z.string().min(1),
 status:z.literal('registered'),obtainable:z.boolean(),runtimeBase:z.string().min(1).nullable(),
}).strict();
export const equipmentCatalogSchema=z.object({schemaVersion:z.literal(1),tierMeaning:z.literal('art-stage'),items:z.array(equipmentItemSchema)}).strict();
export type EquipmentItem=z.infer<typeof equipmentItemSchema>;
