import {art,skillArt} from './ui-assets.ts';
import {esc,buttonHtml} from './ui-components.ts';
import type {ResultPhase} from './battle-result-controller.ts';

/** 失败只做两件事：回城复活，以及告诉玩家变强的常规去处；不做战斗回顾。 */
const tips=[
 {id:'forge:weapon',title:'升级装备',text:'工坊强化武器与护甲',icon:()=>art('gear-standard-hammer-t1-weapon')},
 {id:'survival',title:'点生存天赋',text:'更耐打，少掉血',icon:()=>skillArt('ward')},
 {id:'skills',title:'调整技能',text:'换上控场与伤害技能',icon:()=>skillArt('stun_strike')},
];
const stars=['left:var(--space-1);top:var(--space-4)','left:calc(50% - var(--defeat-star-size)/2);top:0','right:var(--space-1);top:var(--space-4)'];
/** Dungeon runs keep the same fallen-hero head but swap the three tips for the server-resolved report, and offer a retry next to the return. */
export type DefeatReport={detailHtml:string;title?:string;note?:string;returnLabel?:string;retry?:boolean};
export function battleDefeatHtml(regionName:string,phase:ResultPhase,error:string,report?:DefeatReport){
 const busy=phase==='saving'||phase==='returning',note=report?.note&&phase==='ready'?report.note:phase==='saving'?'正在保存战斗结果…':phase==='returning'?'正在回城…':phase==='offline'?(error||'连接中断，请重新连接。'):phase==='return-error'?(error||'返回失败，请重试。'):'';
 return `<section class="battle-result defeat-screen" data-outcome="failure" role="dialog" aria-modal="true" aria-label="挑战失败" data-panel="battle-result"><div class="defeat-fallen"><div class="defeat-face"><img src="${art('portrait-bust')}" alt=""></div><div class="defeat-stars" aria-hidden="true">${stars.map(s=>`<i style="${s}"></i>`).join('')}</div></div><header class="defeat-ribbon"><div class="result-title"><h1>${esc(report?.title??'挑战失败')}</h1></div><p>${esc(regionName)}</p></header>${report?`<div class="defeat-report">${report.detailHtml}</div>`:`<div class="defeat-tips">${tips.map(t=>`<button type="button" class="defeat-tip" data-action="combat-advice" data-id="${t.id}"><span class="defeat-tip__icon"><img src="${t.icon()}" alt=""></span><b>${t.title}</b><span>${t.text}</span></button>`).join('')}</div>`}<div class="defeat-actions">${report?.retry&&phase!=='offline'?buttonHtml('再来一次',{action:'result-retry',className:'defeat-retry',disabled:busy,busyLabel:'正在出发…'}):''}${buttonHtml(phase==='offline'?'恢复连接':(report?.returnLabel??'回城复活'),{action:'result-return',variant:'primary',className:'defeat-return',busy,busyLabel:phase==='saving'?'正在保存…':'正在回城…'})}</div><p class="defeat-note" role="status" aria-live="polite" data-tone="${phase==='offline'||phase==='return-error'?'warning':'info'}">${esc(note)}</p></section>`;
}
