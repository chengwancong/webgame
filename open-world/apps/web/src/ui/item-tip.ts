import {escapeHtml as esc} from './primitives.ts';
import {slotArtHtml} from './slot-art.ts';
export type ItemTipData={title:string;rows?:[string,string][];note?:string;why?:string;item?:boolean};
export function renderItemTip(target:HTMLElement,data:ItemTipData){
 const src=target.querySelector('img')?.getAttribute('src');
 return `${slotArtHtml('tip')}<header class="item-tip-heading">${src?`<img src="${esc(src)}" alt="">`:''}<h3>${esc(data.title)}</h3></header>${(data.rows??[]).map(([label,value])=>`<div class="row"><span>${esc(label)}</span><span class="num">${esc(value)}</span></div>`).join('')}${data.note?`<p class="item-tip-description">${esc(data.note)}</p>`:''}${data.why?`<p class="item-tip-note">${esc(data.why)}</p>`:''}<footer>Esc 收起 · 点击物品查看详情</footer>`;
}
