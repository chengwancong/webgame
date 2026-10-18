import {statLabels} from '../../../packages/contracts/stats.ts';
import {affixDisplayValue} from '../../../packages/contracts/affix-units.ts';
import type {GearTip} from '../../../packages/contracts/index.ts';
import {art} from './ui-assets.ts';
import {emphasizeNumbersHtml} from './ui/primitives.ts';
import {iconHtml,esc,statusBadgeHtml,statRowHtml,stateBlockHtml} from './ui-components.ts';
import {gearQuality,qualityLabels,gearAffixes,gearSetDetails,gearSetChanges,deltaChangeHtml,gearVerdictHtml} from './components/gear-metadata.ts';
import {gearSlotLabels as slots} from './equipment-slots.ts';
const finite=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const number=(value:unknown)=>finite(value)??'—';
export function equipmentTipShell(target:HTMLElement,message='读取装备信息…'){
 const src=target.querySelector('img')?.getAttribute('src');
 return `<div class="equip-tip-header">${src?`<div class="equip-tip-art"><img src="${esc(src)}" alt=""></div>`:''}<div><span class="equip-tip-eyebrow">装备信息</span><h3>${esc(target.getAttribute('aria-label')??'装备')}</h3></div></div><div class="equip-tip-message">${stateBlockHtml({kind:message==='读取装备信息…'?'loading':'error',title:message==='读取装备信息…'?'读取装备信息':'暂时无法读取',message:message==='读取装备信息…'?'正在核对当前装备与属性。':message,compact:true})}</div><footer>移开后再悬停可重新读取</footer>`;
}
export function renderEquipmentTip(data:GearTip){
 const {gear,attributes,comparison}=data,primary=data.primary_attribute,quality=gearQuality(gear);
 const origin=gear.origin?.kind==='stage-key'?statusBadgeHtml('钥匙制作','info'):gear.origin?.kind==='random'&&gear.quality==='legendary'?statusBadgeHtml('掉落传说','neutral'):'';
 const flags=origin+(data.equipped?iconHtml('check',{size:16,label:'已装备'}):'')+(gear.locked?iconHtml('lock',{size:16,label:'已锁定'}):'')+(Number.isFinite(data.max_rank)&&gear.rank>=data.max_rank?iconHtml('check',{size:16,label:'强化已满'}):'');
 const changes=Object.entries(comparison??{}).filter(([key,row])=>key===primary||row.delta!==0).map(([key,row])=>{const change=finite(row.delta);return statRowHtml({label:'你的'+(statLabels[key]??key),value:affixDisplayValue(key,row.equipped),previousValue:affixDisplayValue(key,row.current),change:deltaChangeHtml(change,amount=>affixDisplayValue(key,amount)),tone:change===null||change===0?'neutral':change>0?'positive':'negative',className:'equip-tip-change'});}).join('');
 return `<div class="equip-tip-header quality-${quality}" data-quality="${quality}"><div class="equip-tip-art"><img src="${art('gear-'+gear.base)}" alt=""></div><div><span class="equip-tip-eyebrow">${slots[gear.slot]} · <span class="equip-tip-quality">${qualityLabels[quality]}</span> · 强化 ${gear.rank}/${number(data.max_rank)}</span><h3 class="quality-${quality}">${esc(gear.name)}${gear.rank?` <em>+${gear.rank}</em>`:''}</h3><div class="equip-tip-flags">${flags}</div></div></div>
 <section class="equip-tip-attributes is-primary" aria-label="装备主属性">${statRowHtml({label:'装备'+(statLabels[primary]??primary),value:affixDisplayValue(primary,attributes.effective[primary]),secondary:`基础 ${affixDisplayValue(primary,attributes.base[primary])} + 强化 ${affixDisplayValue(primary,attributes.enhancement[primary])}`,primary:true,className:'gear-primary-stat'})}</section>
 ${gearAffixes(gear)}${gearSetDetails(gear,data.currentSets)}<section class="equip-tip-effect"><h4>特殊效果</h4><p>${emphasizeNumbersHtml(data.effect_description||'效果说明未记录')}</p></section>
 <section class="equip-tip-comparison" aria-label="换装对比">${data.equipped?'<h4>正在使用这件装备</h4><p class="equip-tip-current">已计入当前角色属性</p>':`<h4>穿上后的属性变化 ${gearVerdictHtml(data.verdict)}</h4>${data.replaces?`<p class="equip-tip-current">替换 ${esc(data.replaces.name)}${data.replaces.rank?' +'+data.replaces.rank:''}</p>`:''}${changes}`}</section>
 ${gearSetChanges(data.currentSets,data.equippedSets)}<footer><kbd>Esc</kbd> 收起提示 <span>点击装备可查看详情</span></footer>`;
}
