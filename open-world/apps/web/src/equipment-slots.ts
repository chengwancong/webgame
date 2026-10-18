import type {Slot} from '../../../packages/contracts/index.ts';

// Six real slots; the necklace retains the persisted accessory key.
export const equipmentParts=['weapon','armor','helmet','boots','necklace','ring'] as const;
export type EquipmentPart=typeof equipmentParts[number];
export type GearSlotFilter=EquipmentPart|'core'|'';
export const equipmentPartLabels:Record<EquipmentPart,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',necklace:'项链',ring:'戒指'};
export const gearSlotLabels:Record<Slot,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指',core:'旧核心'};
const runtimeSlots:Record<Exclude<GearSlotFilter,''>,Slot>={weapon:'weapon',armor:'armor',helmet:'helmet',boots:'boots',necklace:'accessory',ring:'ring',core:'core'};
export function runtimeSlotForPart(part:Exclude<GearSlotFilter,''>):Slot|undefined{return runtimeSlots[part];}
export function isGearSlotFilter(value:string):value is GearSlotFilter{return value===''||value==='core'||equipmentParts.some(part=>part===value);}
