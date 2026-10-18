/** Shared V2 controls. Chrome is CSS; icons resolve through ui-assets. */
export {currencyIconHtml,resourceAmountHtml} from './ui/currency.ts';

import {marksHtml,type SlotMark,type NodeState} from './ui/graphics.ts';
export {pipsHtml,meterHtml,marksHtml,deltaHtml,rewardStripHtml,emptySlotHtml,timerHtml,ringHtml,pageDotsHtml,helpHtml} from './ui/graphics.ts';
export {iconHtml,statIcon,iconNames} from './ui/icons.ts';
export type {SlotMark,NodeState} from './ui/graphics.ts';
import {escapeHtml as esc} from './ui/primitives.ts';
export {esc};
export {toggleHtml,rangeFieldHtml,selectFieldHtml} from './ui/form-controls.ts';
export type {StatusTone,ResourceCost,ButtonOptions} from './ui/primitives.ts';

export {statTilesHtml,sectionTitleHtml,buttonHtml,panelHeaderHtml,confirmationHtml,fieldHtml,statusBadgeHtml,stateBlockHtml,resourceCostHtml,statRowHtml,tabsHtml} from './ui/primitives.ts';

export function itemSlot(opts: {action: string; id: string; label: string; src?: string; pressed?: boolean; className?: string; extra?: string; tip?: string; equipmentPart?:string; equipmentTip?:{id:string;revision:number}; disabled?: boolean; loading?: boolean; marks?:SlotMark[];state?:NodeState;title?:string;attributes?:Partial<Record<`data-${string}`|`aria-${string}`,string|number|boolean>>}) {
  const tip = opts.equipmentTip?` data-equipment-tip="${esc(opts.equipmentTip.id)}" data-equipment-revision="${opts.equipmentTip.revision}"`:opts.tip ? ` data-tip="${esc(opts.tip)}"` : '';
  const extraAttributes=Object.entries({...opts.attributes,...(opts.state?{'data-state':opts.state}:{})}).map(([name,value])=>`${name}="${esc(value)}"`).join(' ');
  return `<button ${extraAttributes} class="slot ${opts.className ?? ''}" type="button" data-action="${esc(opts.action)}" data-id="${esc(opts.id)}"${opts.equipmentPart?` data-equipment-part="${esc(opts.equipmentPart)}"`:''} aria-pressed="${opts.pressed ? 'true' : 'false'}" aria-label="${esc([opts.label,...(opts.marks??[]).map(mark=>mark.label)].join('，'))}"${opts.title?` title="${esc(opts.title)}"`:''}${opts.disabled?' disabled':''}${opts.loading?' aria-busy="true" disabled':''}${tip}>${opts.src ? `<img src="${opts.src}" alt="" draggable="false">` : ''}${opts.extra ?? ''}${marksHtml(opts.marks)}</button>`;
}

export function statusBar(kind: 'hp' | 'mp' | 'neutral', ratio: number, label: string) {
  const width = Math.max(0, Math.min(100, ratio * 100));
  return `<div class="meter ${kind}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}" aria-label="${esc(label)}"><i style="transform:scaleX(${width / 100})"></i><span class="numv num">${esc(label)}</span></div>`;
}

/** 仅公共按钮发声；各页面不绑定第二套监听器。返回卸载函数供QA复用。 */
export function mountUiAudio(play:(key:string)=>void,root:Document=document){
 const resolve=(event:Event)=>event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-ui="button"]'):null;
 const click=(event:Event)=>{const button=resolve(event);if(!button||button.disabled)return;const action=button.dataset.action??'';play(action==='close'?'ui/cancel':button.getAttribute('role')==='tab'?'ui/tab':'ui/click');};
 const hover=(event:Event)=>{const button=resolve(event);if(button&&!button.disabled&&!(event instanceof MouseEvent&&event.relatedTarget instanceof Node&&button.contains(event.relatedTarget)))play('ui/hover');};
 let panel=root.querySelector('[data-ui=panel-header] h2')?.textContent??'';const observer=new MutationObserver(()=>{const next=root.querySelector('[data-ui=panel-header] h2')?.textContent??'';if(next===panel)return;play(next?'ui/panel-open':'ui/panel-close');panel=next;});observer.observe(root.body,{childList:true,subtree:true});root.addEventListener('click',click);root.addEventListener('pointerover',hover);return ()=>{observer.disconnect();root.removeEventListener('click',click);root.removeEventListener('pointerover',hover);};
}
