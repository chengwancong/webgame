import type {Gear,Snapshot} from '../../../../packages/contracts/index.ts';
import {art} from '../ui-assets.ts';
import {esc,itemSlot,sectionTitleHtml,statusBadgeHtml,stateBlockHtml,type SlotMark} from '../ui-components.ts';
import {featureOpen,featureReason} from '../story-gates.ts';
import {GearDetails} from './GearDetails.ts';
import {gearQuality,qualityLabels} from './gear-metadata.ts';

/**
 * Port workshop (2026-10-11, docs/forge-workshop.md): the only place to upgrade gear and reroll an affix.
 * Opened from the 「打开工坊」 interaction beside the forge; worn gear first, then the bag.
 */
export function forgeGear(snapshot:Snapshot):Gear[]{
 const worn=new Set(Object.values(snapshot.equipment));
 return [...snapshot.gear.filter(g=>worn.has(g.id)),...snapshot.gear.filter(g=>!worn.has(g.id))];
}
export function forgeSelection(snapshot:Snapshot,selected:string):Gear|undefined{
 const gear=forgeGear(snapshot);return gear.find(g=>g.id===selected)??gear[0];
}
function cell(gear:Gear,selected:boolean,snapshot:Snapshot){
 const worn=Object.values(snapshot.equipment).includes(gear.id),quality=gearQuality(gear);
 const marks:SlotMark[]=[...(worn?[{corner:'tr',kind:'check',label:'已装备'} as SlotMark]:[]),...(gear.locked?[{corner:'tl',kind:'lock',label:'已锁定'} as SlotMark]:[]),...(gear.rank?[{corner:'bl',kind:'rank',value:'+'+gear.rank,label:'强化 '+gear.rank} as SlotMark]:[])];
 return itemSlot({action:'select',id:gear.id,label:`${gear.name}，${qualityLabels[quality]}品质${worn?'，已装备':''}`,pressed:selected,className:`bag-item quality-${quality}${selected?' is-selected':''}`,attributes:{'data-item-kind':'equipment','data-quality':quality},marks,equipmentTip:{id:gear.id,revision:snapshot.revision},extra:`<span class="bag-item-well quality-${quality}"><span class="bag-item-image"><img src="${art('gear-'+gear.base)}" alt="" draggable="false"></span></span><b>${esc(gear.name)}</b>`});
}
export function ForgePanel(snapshot:Snapshot,selected:Gear|undefined,busy:boolean){
 const gear=forgeGear(snapshot),worn=gear.filter(g=>Object.values(snapshot.equipment).includes(g.id)).length,open=featureOpen(snapshot,'forge');
 const grid=(title:string,items:Gear[])=>items.length?`${sectionTitleHtml(title+' · '+items.length)}<div class="bag-grid forge-grid">${items.map(g=>cell(g,g.id===selected?.id,snapshot)).join('')}</div>`:'';
 return `<div class="bag-panel forge-panel"><section class="bag-library" aria-label="工坊装备"><div class="bag-toolbar"><p class="bag-muted">选装备 → 选一条副属性 → 重铸</p>${open?'':statusBadgeHtml(featureReason(snapshot,'forge'),'warning',{variant:'inline'})}</div><div class="forge-list" data-forge-scroll="list">${gear.length?grid('身上',gear.slice(0,worn))+grid('背包',gear.slice(worn)):stateBlockHtml({kind:'empty',title:'暂无装备',message:'获得装备后可在这里强化和重铸。'})}</div></section><div class="bag-detail-region">${selected?GearDetails(selected,snapshot,'forge',busy):''}</div></div>`;
}
