import type {GearQuality} from '../../../packages/contracts/index.ts';
import {emphasizeNumbersHtml} from './ui/primitives.ts';
import {esc,iconHtml,statusBadgeHtml} from './ui-components.ts';
import {qualityLabels} from './components/gear-metadata.ts';
import {hexGlyphForIcon,hexRuneIconSvg} from './hex-rune-icon.ts';

// Public HEX catalog entry as specified in d02-sample-spec §4.1 (display-only, no rule parameters).
// Provisional local shape: swap for the contracts type once HEX-B02 publishes `hexRunes` in GET /api/content.
export type HexRuneTierView={requiredLevel:number;description:string};
export type HexRuneView={id:string;name:string;description:string;category:string;icon:string;exclusiveGroup?:string;tiers:Partial<Record<GearQuality,HexRuneTierView>>};
export type HexRuneTipState={quality:GearQuality;equipped?:boolean;locked?:boolean;playerLevel?:number;conflictName?:string};

const categoryLabels:Record<string,string>={attack:'攻击',defense:'生存',survival:'生存',control:'控制',mobility:'位移',resource:'资源',synergy:'联动',utility:'功能',sustain:'续航'};

// Effect text always comes from the server catalog for the item's own quality; the client never recomputes numbers.
export function renderHexRuneTip(rune:HexRuneView,state:HexRuneTipState){
 const {quality}=state,tier=rune.tiers[quality],need=tier?.requiredLevel;
 const underLevel=need!==undefined&&state.playerLevel!==undefined&&state.playerLevel<need;
 const flags=(state.equipped?iconHtml('check',{size:16,label:'已装备'}):'')+(state.locked?iconHtml('lock',{size:16,label:'已锁定'}):'')+(underLevel?statusBadgeHtml(`需要 ${need} 级`,'warning'):'');
 const conflict=state.conflictName?`<p class="equip-tip-current">与已装备的「${esc(state.conflictName)}」同类，不能同时装备</p>`:'';
 return `<div class="equip-tip-header quality-${quality}" data-quality="${quality}"><div class="equip-tip-art hex-tip-art">${hexRuneIconSvg(hexGlyphForIcon(rune.icon),quality,rune.name)}</div><div><span class="equip-tip-eyebrow">海克斯 · ${esc(categoryLabels[rune.category]??rune.category)} · <span class="equip-tip-quality">${qualityLabels[quality]}</span></span><h3 class="quality-${quality}">${esc(rune.name)}</h3><div class="equip-tip-flags">${flags}</div></div></div>
 <section class="equip-tip-effect"><h4>机制</h4><p>${emphasizeNumbersHtml(tier?.description||rune.description||'效果说明未记录')}</p>${need!==undefined?`<p class="equip-tip-current">需要等级 ${need}</p>`:''}</section>
 <section class="equip-tip-comparison" aria-label="装备状态">${state.equipped?'<h4>正在使用这枚海克斯</h4><p class="equip-tip-current">效果已计入当前构筑</p>':`<h4>放入海克斯槽后生效</h4>${conflict}`}</section>
 <footer><kbd>Esc</kbd> 收起提示 <span>固定品质，不可强化</span></footer>`;
}
