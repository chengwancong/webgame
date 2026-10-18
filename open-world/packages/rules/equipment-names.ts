import type {Gear} from '../contracts/index.ts';
import {getEquipmentItem,getEquipmentSetName} from '../content/equipment-catalog.ts';

// Refresh display metadata by stable base; rolled values and frozen rules stay on the instance.
// Historical receipts are never rewritten. Legacy bases keep their original names.
export function withCurrentEquipmentNames<T extends Pick<Gear,'base'|'name'|'setId'|'setName'>>(gear:T):T{
 const item=getEquipmentItem(gear.base);
 return item?{...gear,name:item.name,...(gear.setId===item.setId?{setName:getEquipmentSetName(item.setId)}:{})}:gear;
}
