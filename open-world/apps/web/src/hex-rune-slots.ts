import type {GearQuality} from '../../../packages/contracts/index.ts';
import {itemSlot,type SlotMark} from './ui-components.ts';
import {qualityLabels} from './components/gear-metadata.ts';
import {hexGlyphForIcon,hexRuneIconSvg} from './hex-rune-icon.ts';
import type {HexRuneTipState,HexRuneView} from './hex-rune-tip.ts';

// Two independent HEX sockets (U-01) shown under the paperdoll. Provisional shapes: replace with the
// contracts types once HEX-B02 adds hex1/hex2 to gear slots and exposes the worn HEX in the snapshot.
export const hexSlots=['hex1','hex2'] as const;
export type HexSlot=typeof hexSlots[number];
export type HexSlotWorn={gearId:string;runeId:string;quality:GearQuality;locked?:boolean};
// unlockLevel is server data (slot unlock level is still pending a user decision); absent means unlocked.
export type HexSlotState={worn?:HexSlotWorn;unlockLevel?:number;candidates:number};
export type HexSlotRowInput={level:number;revision:number;slots:Record<HexSlot,HexSlotState>;catalog:Record<string,HexRuneView>;active?:HexSlot|'';busy?:boolean};

const slotNames:Record<HexSlot,string>={hex1:'海克斯 Ⅰ',hex2:'海克斯 Ⅱ'};

// Hover tip payload for the shared TooltipController (generic data-tip path); presentation renders it with renderHexRuneTip.
export type HexTipPayload={hex:{rune:HexRuneView;state:HexRuneTipState}};
function hexSlotTip(rune:HexRuneView,worn:HexSlotWorn,level:number){
 const tier=rune.tiers[worn.quality];
 return JSON.stringify({hex:{rune:{...rune,tiers:tier?{[worn.quality]:tier}:{}},state:{quality:worn.quality,equipped:true,locked:worn.locked,playerLevel:level}}} satisfies HexTipPayload);
}

function hexSlotButton(slot:HexSlot,state:HexSlotState,input:HexSlotRowInput){
 const name=slotNames[slot],locked=state.unlockLevel!==undefined&&input.level<state.unlockLevel;
 if(locked)return itemSlot({action:'hex-slot',id:slot,label:`${name}，${state.unlockLevel} 级解锁`,disabled:true,className:'hex-slot is-locked',title:`${name}：${state.unlockLevel} 级解锁`,marks:[{corner:'tl',kind:'lock',label:'未解锁'} as SlotMark],extra:`<span class="hex-slot-art">${hexRuneIconSvg(undefined,'common')}</span><span class="hex-slot-copy"><small>${name}</small><b>${state.unlockLevel} 级解锁</b></span>`});
 const worn=state.worn,rune=worn?input.catalog[worn.runeId]:undefined;
 const marks:SlotMark[]=[...(state.candidates?[{corner:'tr',kind:'count',value:state.candidates,label:`${state.candidates} 枚可放入`} as SlotMark]:[]),...(worn?.locked?[{corner:'tl',kind:'lock',label:'已锁定'} as SlotMark]:[])];
 // Unknown runeId (catalog not yet loaded or stale client) still shows the socket as filled, never as empty.
 const title=worn?`${rune?.name??'未知海克斯'} · ${qualityLabels[worn.quality]}`:'空槽';
 return itemSlot({action:'hex-slot',id:slot,label:`${name}，${worn?title+'，已装备':'空槽'}，选择海克斯`,pressed:input.active===slot,loading:input.busy&&input.active===slot,className:`hex-slot${worn?' quality-'+worn.quality:' empty'}`,attributes:{'aria-expanded':input.active===slot},...(worn&&rune?{tip:hexSlotTip(rune,worn,input.level)}:{title:`${name}，${title}，${state.candidates?`可放入 ${state.candidates} 枚`:'暂无可装配'}`}),marks,extra:`<span class="hex-slot-art">${worn?hexRuneIconSvg(hexGlyphForIcon(rune?.icon),worn.quality,rune?.name):hexRuneIconSvg(undefined,'common')}</span><span class="hex-slot-copy"><small>${name}</small><b${worn?` class="quality-${worn.quality}"`:''}>${worn?(rune?.name??'未知海克斯'):'空槽'}</b></span>`});
}

export function HexSlotRow(input:HexSlotRowInput){
 return `<div class="hex-slot-row" role="group" aria-label="海克斯符文槽">${hexSlots.map(slot=>hexSlotButton(slot,input.slots[slot],input)).join('')}</div>`;
}
