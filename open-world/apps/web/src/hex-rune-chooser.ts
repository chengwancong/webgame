import type {GearQuality} from '../../../packages/contracts/index.ts';
import {buttonHtml,panelHeaderHtml,sectionTitleHtml,stateBlockHtml} from './ui/primitives.ts';
import {esc,itemSlot,type SlotMark} from './ui-components.ts';
import {qualityLabels} from './components/gear-metadata.ts';
import {hexGlyphForIcon,hexRuneIconSvg} from './hex-rune-icon.ts';
import {renderHexRuneTip,type HexRuneView} from './hex-rune-tip.ts';
import {hexSlots,type HexSlot} from './hex-rune-slots.ts';

// Candidate chooser opened by clicking a HEX socket: owned HEX items on the left, the selected item's tip and the
// socket action on the right. Equip/unequip only dispatch commands; the server decides legality and the result.
// Inert until HEX-B02 ships hex1/hex2 and the catalog (the socket row itself does not render before that).
export type HexChooserItem={gearId:string;runeId:string;quality:GearQuality;locked?:boolean;wornIn?:HexSlot};
export type HexChooserInput={slot:HexSlot;level:number;items:readonly HexChooserItem[];catalog:Record<string,HexRuneView>;selected?:string;busy?:boolean};

const slotNames:Record<HexSlot,string>={hex1:'海克斯 Ⅰ',hex2:'海克斯 Ⅱ'};
const qualityOrder:Record<GearQuality,number>={legendary:0,rare:1,magic:2,common:3};

/** Worn in this socket first, then by quality (high → low), then by name. */
export function sortHexChooserItems(items:readonly HexChooserItem[],slot:HexSlot,catalog:Record<string,HexRuneView>){
 const name=(item:HexChooserItem)=>catalog[item.runeId]?.name??'';
 return [...items].sort((a,b)=>Number(b.wornIn===slot)-Number(a.wornIn===slot)||qualityOrder[a.quality]-qualityOrder[b.quality]||name(a).localeCompare(name(b),'zh-CN')||a.gearId.localeCompare(b.gearId));
}

function requiredLevel(item:HexChooserItem,catalog:Record<string,HexRuneView>){return catalog[item.runeId]?.tiers[item.quality]?.requiredLevel;}

function candidate(item:HexChooserItem,input:HexChooserInput){
 const rune=input.catalog[item.runeId],name=rune?.name??'未知海克斯',need=requiredLevel(item,input.catalog);
 const where=item.wornIn===input.slot?'此槽使用中':item.wornIn?`${slotNames[item.wornIn]} 使用中`:'';
 const marks:SlotMark[]=item.locked?[{corner:'tl',kind:'lock',label:'已锁定'} as SlotMark]:[];
 const under=need!==undefined&&input.level<need;
 return itemSlot({action:'hex-select',id:item.gearId,pressed:item.gearId===input.selected,label:`${name}，${qualityLabels[item.quality]}${where?'，'+where:''}${under?`，需要 ${need} 级`:''}`,className:`character-candidate hex-candidate quality-${item.quality}${under?' is-under-level':''}`,attributes:{'data-hex-slot':input.slot},marks,extra:`<span class="hex-slot-art">${hexRuneIconSvg(hexGlyphForIcon(rune?.icon),item.quality,rune?.name)}</span><span><b class="quality-${item.quality}">${esc(name)}</b><small>${qualityLabels[item.quality]}${need!==undefined?` · ${need} 级`:''}</small></span>${where?`<span class="character-candidate-tag">${esc(where)}</span>`:''}`});
}

function actionBar(item:HexChooserItem|undefined,input:HexChooserInput){
 if(!item)return '<p class="hex-chooser-hint">选择一枚海克斯查看效果</p>';
 const attributes={'data-hex-slot':input.slot};
 if(item.wornIn===input.slot)return buttonHtml('取下',{action:'hex-unequip',id:item.gearId,busy:input.busy,busyLabel:'正在取下…',attributes});
 const need=requiredLevel(item,input.catalog),under=need!==undefined&&input.level<need;
 const label=item.wornIn?`移到${slotNames[input.slot]}`:`放入${slotNames[input.slot]}`;
 return `${buttonHtml(label,{action:'hex-equip',id:item.gearId,variant:'primary',disabled:under||!input.catalog[item.runeId],busy:input.busy,busyLabel:'正在放入…',attributes})}${under?`<p class="hex-chooser-hint">需要 ${need} 级</p>`:''}`;
}

export function HexRuneChooser(input:HexChooserInput){
 const name=slotNames[input.slot],items=sortHexChooserItems(input.items,input.slot,input.catalog);
 const selected=items.find(item=>item.gearId===input.selected)??items.find(item=>item.wornIn===input.slot);
 // Same exclusive group as the rune in the other socket: shown as a note only, the server enforces exclusivity.
 const other=hexSlots.find(slot=>slot!==input.slot),otherItem=items.find(item=>item.wornIn===other);
 const rune=selected?input.catalog[selected.runeId]:undefined,otherRune=otherItem?input.catalog[otherItem.runeId]:undefined;
 const conflictName=rune?.exclusiveGroup&&otherRune&&otherItem!==selected&&otherRune.exclusiveGroup===rune.exclusiveGroup?otherRune.name:undefined;
 const rows=items.length?items.map(item=>candidate(item,{...input,selected:selected?.gearId})).join(''):stateBlockHtml({kind:'empty',title:'暂无海克斯',message:'击败野外精英、首领或通关副本可获得海克斯。',compact:true});
 const detail=selected?(rune?`<div class="equip-tip hex-chooser-tip">${renderHexRuneTip(rune,{quality:selected.quality,equipped:selected.wornIn===input.slot,locked:selected.locked,playerLevel:input.level,conflictName})}</div>`:stateBlockHtml({kind:'error',title:'未知海克斯',message:'内容目录里没有这枚海克斯，请刷新后再试。',compact:true})):'';
 return `<section class="character-chooser hex-chooser" role="region" aria-label="${name}候选">${panelHeaderHtml('更换'+name,{level:'section',closeAction:'hex-chooser-close',closeLabel:'收起海克斯'})}<div class="character-candidate-hint">${sectionTitleHtml('候选',{count:`${items.length} 枚`})}</div><div class="character-candidate-grid" data-character-scroll="hex-candidates-${input.slot}">${rows}</div></section><section class="character-compare hex-chooser-detail" aria-label="海克斯详情">${detail}<div class="hex-chooser-actions">${actionBar(selected,input)}</div></section>`;
}
