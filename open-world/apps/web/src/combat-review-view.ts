import type {CombatAdvice,CombatAdviceTarget,CombatFatalHit,CombatReview} from '../../../packages/contracts/index.ts';
/** The settlement page needs only the counts; the dungeon panel passes its own place name. */
export type KeyProgressView={stage:number;dungeon:string|null;materials:number;required:number;obtained:boolean};
import {sectionTitleHtml,statRowHtml,esc,buttonHtml} from './ui-components.ts';
import {art,skillArt} from './ui-assets.ts';
import {meterHtml} from './ui-components.ts';
import stageKeyLabels from '../../../packages/content/stage-key-labels.json';
/** Every suggestion opens the panel that actually changes the outcome. */
const adviceNavigation:Record<CombatAdviceTarget,{action:string;id:string}>={
 skills:{action:'panel',id:'skills'},
 survival:{action:'bag-progression',id:'talents-defense'},
 damage:{action:'bag-progression',id:'talents-damage'},
 forge:{action:'panel',id:'character'},
 bag:{action:'panel',id:'bag'},
};
export function combatAdviceDestination(target:string):{action:string;id:string}|undefined{const [page,focus]=target.split(':');return page==='forge'&&(focus==='armor'||focus==='weapon')?{action:'advice-forge',id:focus}:adviceNavigation[page as CombatAdviceTarget];}
/** The one thing the player needs: who hit them, with what, and what to do about it. */
export function combatFatalHitHtml(fatal:CombatFatalHit|null|undefined){
 if(!fatal)return '<p class="ui-caption">没记下这一击，回港整备再来。</p>';
 const moveArt:Record<string,string>={'物理':'cut','火焰':'ember','冰霜':'frost','闪电':'chain','暗影':'dark_arrow','毒素':'poison_arrow','奥术':'bolt','真实':'lance'};
 const tags=fatal.statuses.map(s=>`<span class="review-fatal__tag">${esc(s)}</span>`).join('');
 return `<div class="review-fatal"><img class="review-fatal__art" src="${skillArt(moveArt[fatal.damageType]??'cut')}" alt="${esc(fatal.damageType)}招式"><div class="review-fatal__copy"><div class="review-fatal__line"><b>最后一击 · ${esc(fatal.enemy)} · ${esc(fatal.skill)}</b><span class="review-fatal__damage">${esc(fatal.damageType)} ${fatal.damage}</span>${tags}</div><p>${esc(fatal.hint)}</p></div></div>`;
}
export function combatAdviceHtml(advice:readonly CombatAdvice[]){
 if(!advice.length)return '';
 return `<div class="review-advice">${sectionTitleHtml('试试这样做')}<div class="review-advice__row">${advice.map(a=>{const illustration=a.target==='forge'?art('gear-standard-hammer-t1-weapon'):a.target==='survival'?skillArt('ward'):a.target==='damage'?skillArt('cut'):a.target==='skills'?skillArt('stun_strike'):art('sys-bag');return buttonHtml(a.label,{action:'combat-advice',id:a.target+(a.focus?':'+a.focus:''),size:'compact',className:'review-advice__button',iconHtml:`<img class="review-advice__art" src="${illustration}" alt="">`});}).join('')}</div></div>`;
}
function keyFragmentName(key:KeyProgressView){return stageKeyLabels.find(row=>row.id==='stage-key-fragment-'+key.stage)?.name??'钥匙碎片';}
export function combatKeyProgressHtml(key?:KeyProgressView|null,place?:string){
 if(!key)return '';
 const name=keyFragmentName(key),source=stageKeyLabels.find(row=>row.id==='stage-key-fragment-'+key.stage)?.dropHint??(place?place+'里的精英、稀有敌人和宝箱会掉':'这趟地城的精英、稀有敌人和宝箱会掉');
 return `<div class="review-key">${statRowHtml({label:name,value:key.materials+' / '+key.required})}${meterHtml({value:Math.min(key.materials,key.required),max:key.required,label:name,valueText:'none'})}<p class="ui-caption">${esc(key.obtained?'钥匙已经到手，可以继续前进':source)}</p></div>`;
}
/** Render executor-resolved events and the server's current material progress only. */
export function combatReviewHtml(review:CombatReview,key?:KeyProgressView|null,title='你倒在了这里',defeated=true){
 const earlier=review.recent.length?`<details class="review-earlier"><summary>最近受击 ${review.recent.length} 次（致命一击之前）</summary><ul>${review.recent.map(line=>`<li>${esc(line)}</li>`).join('')}</ul></details>`:'',older=review.omittedTaken?statRowHtml({label:'更早伤害',value:Math.round(review.omittedTaken),secondary:'上面只留最近几次，更早的受击只记合计'}):'';
 // 赢了就没有“致命一击”这一行，只留钥匙进度和建议。
 const failed=defeated,hit=failed?combatFatalHitHtml(review.fatal):'';
 return `<section class="dungeon-diagnostic" aria-label="战斗回顾">${sectionTitleHtml(title)}${failed&&review.totalTaken!==undefined?statRowHtml({label:'本场累计承受伤害',value:Math.round(review.totalTaken),secondary:'实际生命损失，含治疗后再次受伤；不含护盾吸收'}):''}${failed&&review.source?`<p class="ui-caption">${review.source==='server'?'地城战斗记录':'本机战斗记录'}${review.totalTaken!==undefined?' · 累计 = 最近受击 + 更早伤害':''}</p>`:''}${hit}${failed&&review.gap?`<p class="ui-caption review-gap">${esc(review.gap)}</p>`:''}${failed?older+earlier+combatAdviceHtml(review.advice):''}${combatKeyProgressHtml(key)}</section>`;
}
