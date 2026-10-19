import type {Slot} from '../../../packages/contracts/index.ts';

// Six real slots; the necklace retains the persisted accessory key.
export const equipmentParts=['weapon','armor','helmet','boots','necklace','ring'] as const;
export type EquipmentPart=typeof equipmentParts[number];
export type GearSlotFilter=EquipmentPart|'core'|'';
export const equipmentPartLabels:Record<EquipmentPart,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',necklace:'项链',ring:'戒指'};
// HEX sockets (hex1/hex2) land with HEX-B02; keyed loosely so this compiles before and after the contract change.
const slotLabelTable:Record<string,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指',core:'旧核心',hex1:'海克斯',hex2:'海克斯'};
export const gearSlotLabels=slotLabelTable as Record<Slot,string>;
export function isHexSlot(slot:string):boolean{return slot==='hex1'||slot==='hex2';}
/** Paperdoll part for a gear slot; HEX sockets have no paperdoll part. */
export function characterPartForSlot(slot:Slot):Exclude<GearSlotFilter,''>|undefined{const value:string=slot;if(isHexSlot(value))return undefined;return value==='accessory'?'necklace':value as Exclude<GearSlotFilter,''>;}
const runtimeSlots:Record<Exclude<GearSlotFilter,''>,Slot>={weapon:'weapon',armor:'armor',helmet:'helmet',boots:'boots',necklace:'accessory',ring:'ring',core:'core'};
export function runtimeSlotForPart(part:Exclude<GearSlotFilter,''>):Slot|undefined{return runtimeSlots[part];}
export function isGearSlotFilter(value:string):value is GearSlotFilter{return value===''||value==='core'||equipmentParts.some(part=>part===value);}
