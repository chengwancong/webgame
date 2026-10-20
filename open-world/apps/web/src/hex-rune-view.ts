import type {Gear,Snapshot} from '../../../packages/contracts/index.ts';
import {hexSlots,type HexSlot,type HexSlotRowInput,type HexSlotState} from './hex-rune-slots.ts';
import type {HexRuneView} from './hex-rune-tip.ts';
import type {HexChooserItem} from './hex-rune-chooser.ts';

// Adapts the authoritative snapshot + public HEX catalog into the socket row input. Until HEX-B02 ships, the
// snapshot has no hex1/hex2 equipment keys and the catalog is empty, so this returns undefined and nothing renders.
// A HEX item is any gear whose base is a catalog id (d02 §3.4); its quality is the existing Gear.quality.
type HexAwareSnapshot=Snapshot & {equipment:Snapshot['equipment'] & Partial<Record<HexSlot,string|null>>;hexSlotUnlock?:Partial<Record<HexSlot,number>>};

export function isHexGear(gear:Gear,catalog:Record<string,HexRuneView>){return Object.hasOwn(catalog,gear.base);}

export function hexSlotRowInputFromSnapshot(snapshot:HexAwareSnapshot,catalog:Record<string,HexRuneView>,options:{active?:HexSlot|'';busy?:boolean}={}):HexSlotRowInput|undefined{
 const equipment=snapshot.equipment;
 if(!hexSlots.some(slot=>Object.hasOwn(equipment,slot))&&!Object.keys(catalog).length)return undefined;
 const worn=new Set(hexSlots.map(slot=>equipment[slot]).filter((id):id is string=>!!id));
 // Only count runes the player's current level can actually equip; level-locked ones stay visible in the chooser (disabled).
 const candidates=snapshot.gear.filter(gear=>isHexGear(gear,catalog)&&!worn.has(gear.id)&&snapshot.level>=(catalog[gear.base]?.tiers[gear.quality??'common']?.requiredLevel??0)).length;
 const slots={} as Record<HexSlot,HexSlotState>;
 for(const slot of hexSlots){
  const id=equipment[slot],gear=id?snapshot.gear.find(item=>item.id===id):undefined;
  // Worn id without a matching gear row is a stale snapshot; keep the socket filled (unknown rune) rather than empty.
  slots[slot]={candidates,unlockLevel:snapshot.hexSlotUnlock?.[slot],worn:id?{gearId:id,runeId:gear?.base??'',quality:gear?.quality??'common',locked:gear?.locked}:undefined};
 }
 return {level:snapshot.level,revision:snapshot.revision,slots,catalog,...options};
}

export function hexCatalogById(runes:readonly HexRuneView[]|undefined){return Object.fromEntries((runes??[]).map(rune=>[rune.id,rune])) as Record<string,HexRuneView>;}

/** Owned HEX items for the socket chooser; wornIn marks which socket (if any) currently holds each one. */
export function hexChooserItemsFromSnapshot(snapshot:HexAwareSnapshot,catalog:Record<string,HexRuneView>):HexChooserItem[]{
 const wornIn=new Map(hexSlots.map(slot=>[snapshot.equipment[slot],slot] as const).filter((entry):entry is readonly [string,HexSlot]=>!!entry[0]));
 return snapshot.gear.filter(gear=>isHexGear(gear,catalog)).map(gear=>({gearId:gear.id,runeId:gear.base,quality:gear.quality??'common',locked:gear.locked,wornIn:wornIn.get(gear.id)}));
}
