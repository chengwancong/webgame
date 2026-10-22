import type {GearQuality} from '../../../packages/contracts/index.ts';
import {emphasizeNumbersHtml} from './ui/primitives.ts';
import {esc,iconHtml,statusBadgeHtml} from './ui-components.ts';
import {qualityLabels} from './components/gear-metadata.ts';
import {hexGlyphForIcon,hexRuneIconSvg} from './hex-rune-icon.ts';

// Public HEX catalog entry (display-only, no rule parameters), as published in GET /api/content `hexRunes`.
export type HexRuneTierView={requiredLevel:number;description:string};
export type HexRuneView={id:string;name:string;description:string;category:string;icon:string;exclusiveGroup?:string;playstyle?:string;prereq?:string;flavor?:string;tiers:Partial<Record<GearQuality,HexRuneTierView>>};
export type HexRuneTipState={quality:GearQuality;equipped?:boolean;locked?:boolean;playerLevel?:number;prereqMissing?:boolean;active?:boolean;reason?:string};
/** Single source of the "why is this HEX off" copy; `need` is the tier's requiredLevel for reason 'level'. */
export function hexInactiveReasonText(reason?:string,need?:number){return reason==='level'?(need!==undefined?`需 ${need} 级`:'等级不足'):reason==='duplicate'?'已有同名海克斯生效':reason==='group'?'同类已有更高品质':'未生效';}

const categoryLabels:Record<string,string>={attack:'攻击',defense:'生存',survival:'生存',control:'控制',mobility:'位移',resource:'资源',synergy:'联动',utility:'功能',sustain:'续航'};

// Display-only copy for the four first-release playstyles (d11 §2): who it suits and the price you pay.
const playstyleTips:Record<string,{fit:string;cost:string}>={
 '贴身绞杀':{fit:'适合敢站进怪群、围着同一目标输出的人',cost:'受击会变多，走开就没有收益'},
 '先铺后炸':{fit:'适合先挂印记/持续伤害、再补刀收尾的人',cost:'对没有印记的目标收益很低'},
 '穿行续战':{fit:'适合持续走位、绕圈拉扯的人',cost:'站桩几乎没有收益'},
 '节奏接力':{fit:'适合技能与普攻交替出手的人',cost:'连放同类或节奏被打断就空转'}
};
const prereqLabels:Record<string,string>={'dot-source':'持续伤害来源','control-source':'控制技能','summon-source':'召唤来源','bound-skill':'绑定技能','crit-source':'暴击来源'};

function playstyleHtml(rune:HexRuneView,missing?:boolean){
 if(!rune.playstyle&&!rune.prereq)return '';
 const tip=rune.playstyle?playstyleTips[rune.playstyle]:undefined,need=rune.prereq?prereqLabels[rune.prereq]??rune.prereq:'';
 return `<section class="equip-tip-playstyle" aria-label="打法">${rune.playstyle?`<p><span class="hex-playstyle-tag">${esc(rune.playstyle)}</span>${tip?` ${esc(tip.fit)}`:''}</p>`:''}${tip?`<p class="equip-tip-current">取舍：${esc(tip.cost)}</p>`:''}${need?`<p class="${missing?'hex-prereq-missing':'equip-tip-current'}">${missing?'缺少前置':'前置'}：${esc(need)}</p>`:''}</section>`;
}

// Effect text always comes from the server catalog for the item's own quality; the client never recomputes numbers.
// d13: HEX is a gear affix (only from drops), so the tip says whether it is in effect instead of asking to be slotted.
export function renderHexRuneTip(rune:HexRuneView,state:HexRuneTipState){
 const {quality}=state,tier=rune.tiers[quality],need=tier?.requiredLevel,inactive=state.active===false;
 const underLevel=need!==undefined&&state.playerLevel!==undefined&&state.playerLevel<need;
 const flags=(state.equipped?iconHtml('check',{size:16,label:'已装备'}):'')+(state.locked?iconHtml('lock',{size:16,label:'已锁定'}):'')+(underLevel?statusBadgeHtml(`需要 ${need} 级`,'warning'):'');
 return `<div class="equip-tip-header quality-${quality}${inactive?' is-inactive':''}" data-quality="${quality}"><div class="equip-tip-art hex-tip-art">${hexRuneIconSvg(hexGlyphForIcon(rune.icon),quality,rune.name,rune.category)}</div><div><span class="equip-tip-eyebrow">海克斯 · ${esc(categoryLabels[rune.category]??rune.category)} · <span class="equip-tip-quality">${qualityLabels[quality]}</span></span><h3 class="quality-${quality}">${esc(rune.name)}</h3><div class="equip-tip-flags">${flags}</div></div></div>
 <section class="equip-tip-effect"><h4>机制</h4><p>${emphasizeNumbersHtml(tier?.description||rune.description||'效果说明未记录')}</p>${need!==undefined?`<p class="equip-tip-current">需要等级 ${need}</p>`:''}${rune.flavor?`<p class="hex-flavor">${esc(rune.flavor)}</p>`:''}</section>${playstyleHtml(rune,state.prereqMissing)}
 <section class="equip-tip-comparison" aria-label="装备状态">${inactive?`<h4>未生效</h4><p class="equip-tip-current">${hexInactiveReasonText(state.reason,need)}</p>`:state.equipped?'<h4>正在使用这枚海克斯</h4><p class="equip-tip-current">效果已计入当前构筑</p>':'<h4>装备词缀，只随掉落</h4><p class="equip-tip-current">穿上这件装备后生效</p>'}</section>
 <footer><kbd>Esc</kbd> 收起提示 <span>固定品质，不可强化</span></footer>`;
}

/** One-line HEX row under the ordinary affixes of an equipment tip: hexagon icon + quality-coloured name + one-line effect.
 *  active=false greys the whole row and states the reason; playstyle / who-fits / trade-off lines are reused from the full tip. */
export function renderHexAffixRow(rune:HexRuneView|undefined,tierQuality:GearQuality,state:{active:boolean;reason?:string;fallbackName?:string}){
 const tier=rune?.tiers[tierQuality],name=rune?.name??state.fallbackName??'海克斯',inactive=!state.active;
 const effect=tier?.description||rune?.description||'效果说明未记录';
 return `<section class="equip-tip-hex${inactive?' is-inactive':''}" aria-label="海克斯词缀"><h4>海克斯 · 装备词缀</h4><div class="equip-tip-hex-row"><span class="equip-tip-hex-art">${hexRuneIconSvg(hexGlyphForIcon(rune?.icon),tierQuality,name,rune?.category)}</span><div class="equip-tip-hex-copy"><b class="quality-${tierQuality}">${esc(name)} <small>${qualityLabels[tierQuality]}</small></b><p>${emphasizeNumbersHtml(effect)}</p>${inactive?`<p class="hex-inactive-note">${hexInactiveReasonText(state.reason,tier?.requiredLevel)}</p>`:''}</div></div>${rune?playstyleHtml(rune):''}</section>`;
}
