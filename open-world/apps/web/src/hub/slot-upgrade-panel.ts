import {esc,buttonHtml,sectionTitleHtml,resourceAmountHtml,statusBadgeHtml,stateBlockHtml,statRowHtml} from '../ui-components.ts';
import {statLabels} from '../../../../packages/contracts/stats.ts';
import {affixDisplayValue} from '../../../../packages/contracts/affix-units.ts';
import type {SlotsView,RankSlot} from '../../../../packages/contracts/zhangjian.ts';
import type {Snapshot,GrowthPreview} from '../../../../packages/contracts/index.ts';
export type ForgeSlotUI={selected?:RankSlot;preview?:GrowthPreview;loading?:boolean;busy?:boolean;error?:string;message?:string;featureBlock?:string};
export const SLOT_NAMES:Record<RankSlot,string>={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指'};
type Wallet=Pick<Snapshot,'gold'|'material'>;
export function slotAvailability(slot:SlotsView['slots'][number],wallet:Wallet,featureBlock=''){
 const gold=Math.max(0,(slot.cost?.gold??0)-wallet.gold),material=Math.max(0,(slot.cost?.material??0)-wallet.material);
 const block=slot.block||featureBlock||(!slot.cost?'已达强化上限':'');
 const shortage=gold>=material&&gold>0?`缺 ${gold} 金币`:material>0?`缺 ${material} 强化石`:'';
 return {gold,material,reason:block||shortage,canUpgrade:!block&&!shortage};
}
export function selectedUpgradeSlot(view:SlotsView,wallet:Wallet,selected?:RankSlot){return view.slots.find(s=>s.slot===selected)??view.slots.find(s=>slotAvailability(s,wallet).canUpgrade)??view.slots[0];}
export function slotUpgradePanelHtml(view:SlotsView,snapshot:Wallet&Partial<Pick<Snapshot,'gear'>>,busy:boolean,ui:ForgeSlotUI={}){
 const selected=selectedUpgradeSlot(view,snapshot,ui.selected);if(!selected)return stateBlockHtml({kind:'empty',title:'暂无部位',message:'请重新打开工坊。'});
 const availability=slotAvailability(selected,snapshot,ui.featureBlock),pending=busy||Boolean(ui.busy),gear=snapshot.gear?.find(g=>g.id===selected.gearId);
 const list=view.slots.map(s=>{const a=slotAvailability(s,snapshot,ui.featureBlock),g=snapshot.gear?.find(g=>g.id===s.gearId),summary=`<span class="forge-slot-summary"><b>${SLOT_NAMES[s.slot]} · ${esc(g?.name??(s.gearId?'已穿戴装备':'未穿装备'))}</b><span>+${s.rank} · ${statusBadgeHtml(a.reason||'可强化',a.canUpgrade?'success':'warning',{variant:'inline'})}</span></span>`;return `<li>${buttonHtml('',{action:'slot-select',id:s.slot,variant:'secondary',pressed:s.slot===selected.slot,disabled:pending,className:'forge-slot-choice',attributes:{'aria-label':SLOT_NAMES[s.slot]+' '+(g?.name??'')+' +'+s.rank+' '+(a.reason||'可强化')}}).replace('<span class="ui-button__label"></span>','<span class="ui-button__label">'+summary+'</span>')}</li>`;}).join('');
 const costs=selected.cost?(['gold','material'] as const).map(key=>`<div class="forge-cost-row ${availability[key]>0?'is-short':''}"><span>${key==='gold'?'金币':'强化石'}</span><span>需要 ${resourceAmountHtml(key,selected.cost![key],{compact:true})} / 持有 ${resourceAmountHtml(key,snapshot[key],{compact:true})}</span></div>`).join(''):'';
 const preview=ui.preview,changes=preview?Object.entries(preview.upgraded.stats).filter(([key,val])=>typeof val==='number'&&typeof (preview.current.stats as any)[key]==='number'&&val!==(preview.current.stats as any)[key]).map(([key,val])=>statRowHtml({label:statLabels[key]??key,previousValue:affixDisplayValue(key,(preview.current.stats as any)[key]),value:affixDisplayValue(key,val as number)})).join(''):'';
 const changeHtml=ui.loading?'<p role="status">正在读取下一级属性…</p>':preview?(changes||'<p>下一级角色属性不变。</p>'):`<p>${esc(selected.block||'选择部位后读取服务端属性预览。')}</p>`;
 const next=view.resonance.next;
 return `<div class="forge-upgrade" data-panel="slot-upgrade"><nav class="forge-slot-list" aria-label="强化部位"><ul>${list}</ul></nav><section class="forge-slot-detail" aria-label="${SLOT_NAMES[selected.slot]}强化详情">${sectionTitleHtml(SLOT_NAMES[selected.slot]+'强化')}<p>${esc(gear?.name??'未穿装备')} · 当前 +${selected.rank} · 生效 +${selected.effective}</p><div class="forge-upgrade-changes" aria-label="下一级角色属性">${sectionTitleHtml('当前 → 下一级')}${changeHtml}</div><div class="forge-slot-costs">${costs}</div>${availability.reason?`<p class="forge-block" role="status">${esc(availability.reason)}</p>`:''}<p class="forge-sources">金币：通关节点；强化石：分解装备、通关节点。</p><p class="forge-resonance">共鸣加成 ${view.resonance.bonusPercent}% · ${next?`再把 ${next.missing} 个部位升到 +${next.rank}`:'已达满档'}</p>${ui.error?`<p role="alert">${esc(ui.error)}</p>${buttonHtml('重新读取',{action:'slot-refresh',variant:'secondary',disabled:pending})}`:''}${ui.message?`<p role="status">${esc(ui.message)}</p>`:''}<div class="forge-slot-actions">${buttonHtml(availability.reason||'强化',{action:'slot-upgrade',id:selected.slot,variant:availability.canUpgrade?'primary':'secondary',disabled:pending||!availability.canUpgrade||Boolean(ui.loading)||!preview,busy:pending,busyLabel:'强化中…'})}</div></section></div>`;
}
