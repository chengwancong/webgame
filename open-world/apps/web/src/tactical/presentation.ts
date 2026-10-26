/** Pure presentation of authoritative encounter/result fields; never assigns rewards or grades. */
import {buttonHtml,esc,iconHtml,resourcePillHtml,rewardRevealHtml,ribbonTitleHtml} from '../ui-components.ts';
import type {CurrencyKind} from '../ui/currency.ts';
import type {TacticalResultView} from './contract.ts';

const resourceLabels:Readonly<Record<string,CurrencyKind>>={金币:'gold',经验:'xp',强化石:'material'};

export function tacticalEncounterHtml(enemyGroup:string,nodeName:string):string{
 return `<div class="tb-cover tb-encounter" role="status" aria-live="assertive"><div class="tb-encounter-card">
<span class="tb-encounter-icon" aria-hidden="true">${iconHtml('swords',{size:32})}</span><p class="tb-eyebrow">遭遇敌人</p>
<h2>${esc(enemyGroup)}</h2><p>${esc(nodeName)}</p><p class="tb-dim">正在展开战场…</p></div></div>`;
}

export function tacticalResultHtml(result:TacticalResultView,returning=false):string{
 const title={victory:'战斗胜利',defeat:'战斗结束',retreat:'已撤退','system-abort':'战斗中止'}[result.outcome];
 const resources:string[]=[],items:Array<Parameters<typeof rewardRevealHtml>[0][number]>=[];
 for(const reward of result.rewards){
  const kind=Object.hasOwn(resourceLabels,reward.label)?resourceLabels[reward.label]:undefined;
  // Only exact known resource labels and complete numeric amounts can use a currency pill.
  // Other payloads retain their verbatim amount, including ranges and explanatory text.
  const numeric=/^\d+$/.test(reward.amount)?Number(reward.amount):NaN;
  if(kind&&Number.isSafeInteger(numeric))resources.push(resourcePillHtml(kind,numeric));
  else items.push({name:reward.label,quantity:reward.amount,iconHtml:iconHtml('chest',{size:32})});
 }
 const rewards=result.rewards.length
  ?`<div class="tb-result-rewards" aria-label="已获得">${resources.length?`<div class="tb-result-resources">${resources.join('')}</div>`:''}${items.length?rewardRevealHtml(items):''}</div>`
  :`<p class="tb-result-empty">${iconHtml('chest',{size:32})}<span>${esc(result.rewardsNote)}</span></p>`;
 return `<div class="tb-cover tb-result" role="dialog" aria-modal="true" aria-label="${title}"><section class="tb-result-card tb-result--${result.outcome}">
<p class="tb-eyebrow">${result.outcome==='victory'?'节点目标已完成':'本场结束'}</p>
${ribbonTitleHtml(title,{tone:result.outcome==='victory'?'victory':'retreat'})}${rewards}
<div class="tb-actions">${buttonHtml(returning?'正在返回…':result.returnLabel,{action:'return',variant:'primary',busy:returning,busyLabel:'正在返回…',attributes:{'data-focus':'result-return'}})}</div></section></div>`;
}
