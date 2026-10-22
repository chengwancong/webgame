import {z} from 'zod';
import type {Gear,WeaponType} from '../contracts/index.ts';
import {gearSlotSchema} from '../contracts/gear-slots.ts';
import {gearWeaponType} from './weapon-skills.ts';
export const pickupFilterSchema=z.object({minimumQuality:z.enum(['common','magic','rare','legendary']).default('common'),excludedSlots:z.array(gearSlotSchema).max(7).default([]),ownWeaponOnly:z.boolean().default(false)}).strict();
export type PickupFilter=z.infer<typeof pickupFilterSchema>;
export const defaultPickupFilter=():PickupFilter=>pickupFilterSchema.parse({});
const order={common:0,magic:1,rare:2,legendary:3};
/** A filter changes automatic claim candidates only. It never salvages an item
 * or removes the pending server reward. Explicit manual pickup remains possible. */
export function acceptsPickup(gear:Gear,filter:PickupFilter,weapon:WeaponType|null){return (Boolean(gear.hex)||order[gear.quality]>=order[filter.minimumQuality])&&!filter.excludedSlots.includes(gear.slot)&&(!filter.ownWeaponOnly||gear.slot!=='weapon'||weapon!==null&&gearWeaponType(gear)===weapon);}
