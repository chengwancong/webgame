import {z} from 'zod';
import type {EquipmentItem} from './equipment-catalog.ts';

// Preserve the persisted accessory key as the single necklace slot, and keep
// old cores usable in their existing separate management entry.
export const gearSlots=['weapon','armor','helmet','boots','accessory','ring','core'] as const;
export const gearSlotSchema=z.enum(gearSlots);
export type Slot=typeof gearSlots[number];
export function slotForEquipmentPart(part:EquipmentItem['part']):Slot{return part==='necklace'?'accessory':part;}
