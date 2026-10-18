import type {Gear,GearQuality} from '../../../../packages/contracts/index.ts';
import {qualityLabels} from './gear-metadata.ts';
import {buttonHtml} from '../ui-components.ts';
import {equipmentParts,equipmentPartLabels,runtimeSlotForPart,type GearSlotFilter} from '../equipment-slots.ts';
export function filterGear(gear:Gear[],quality:GearQuality|'',slot:GearSlotFilter){
 const runtimeSlot=slot?runtimeSlotForPart(slot):undefined;
 return gear.filter(g=>(!quality||(g.quality??'common')===quality)&&(!slot||(runtimeSlot!==undefined&&g.slot===runtimeSlot)));
}
export function GearFilter(quality:GearQuality|'',slot:GearSlotFilter){
 return `<nav class="gear-filters" aria-label="装备筛选"><div class="gear-quality-filters" aria-label="品质筛选">${(['','common','magic','rare','legendary'] as const).map(value=>buttonHtml(value?qualityLabels[value]:'全部品质',{action:'gear-quality',id:value,size:'compact',pressed:quality===value,className:value?'quality-'+value:''})).join('')}</div><div class="slot-filters" aria-label="装备部位">${(['',...equipmentParts] as const).map(value=>buttonHtml(value?equipmentPartLabels[value]:'全部部位',{action:'gear-slot',id:value,size:'compact',pressed:slot===value})).join('')}</div></nav>`;
}
