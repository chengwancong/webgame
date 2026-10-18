import {iconHtml} from './ui-components.ts';
import type {Snapshot} from '../../../packages/contracts/index.ts';
import type {WorldTierChoice} from '../../../packages/contracts/open-world.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import {starseaHub} from '../../../packages/content/starsea/index.ts';
import {worldTiers} from '../../../packages/rules/world-tier.ts';
import {buttonHtml,escapeHtml} from './ui/primitives.ts';

export type SeaDifficultyView={current:number;canSwitch:boolean;tiers:WorldTierChoice[]};
type Vec={x:number;y:number};

/** 海域难度面板：入口在拾星港与星潮海航图。切换仍然只在港口或前哨生效（服务端复核）。 */
export function seaDifficultyView(s:Snapshot|undefined,region:string,hero:Vec):SeaDifficultyView|undefined{
 if(!s?.starsea)return;
 const canSwitch=worldTiers.switchAt.includes('port')&&region===starseaHub||worldTiers.switchAt.includes('outpost')&&worldTables.waypoints.some(w=>(s.worldView?.waypoints.includes(w.id)??(!w.when&&!w.until))&&w.kind==='outpost'&&w.region===region&&Math.hypot(w.x-hero.x,w.y-hero.y)<=worldTiers.outpostReach);
 return {current:s.world?.worldTier??1,canSwitch,tiers:s.worldTierChoices??[]};
}
/** ★ 由服务端按现有倍率分档给出，这里只负责画星。 */
function stars(n:number,tone:string){
 return `<span class="sea-stars ${tone}" role="img" aria-label="${tone==='is-threat'?'危险':'奖励'} ${n} 星，共 5 星"><span class="sea-stars__on" aria-hidden="true">${'★'.repeat(n)}</span><span class="sea-stars__off" aria-hidden="true">${'★'.repeat(5-n)}</span></span>`;
}
const factor=(n:number)=>String(Number(n.toFixed(2)));
function row(t:WorldTierChoice,view:SeaDifficultyView,pick:number){
 const locked=!t.unlocked,current=t.tier===view.current;
 const cells=locked?`<span class="sea-row__lock">${iconHtml('lock',{size:16,label:'未解锁'})}${escapeHtml(t.unlockSummary??t.unlockText??'尚未开启')}</span>`:stars(t.danger,'is-threat')+stars(t.rewardStars,'is-loot');
 return `<button type="button" class="sea-row${current?' is-current':''}${locked?' is-locked':''}${t.tier===pick?' is-picked':''}" data-action="sea-tier-pick" data-id="${t.tier}" aria-pressed="${t.tier===pick}"><b>${escapeHtml(t.name)}</b>${cells}${current?'<span class="sea-row__tag">当前</span>':''}</button>`;
}
function detail(t:WorldTierChoice,view:SeaDifficultyView,busy:boolean){
 const main=t.tier===view.current?'已在此海域':'前往此海域';
 return `<div class="sea-detail"><h3>${escapeHtml(t.name)}</h3><p>${escapeHtml(t.summary)}</p>
  <dl class="sea-detail__rows"><dt>危险</dt><dd>${stars(t.danger,'is-threat')}</dd><dt>奖励</dt><dd>${stars(t.rewardStars,'is-loot')}</dd>${t.level?`<dt>推荐等级</dt><dd>Lv ${t.level}+</dd>`:''}</dl>
  <details class="sea-detail__numbers"><summary>详细数值</summary><p>怪物生命 ${factor(t.monster.hp)} 倍 · 攻击 ${factor(t.monster.attack)} 倍<br>经验 ${factor(t.reward.xp)} 倍 · 金币 ${factor(t.reward.gold)} 倍 · 强化石 ${factor(t.reward.material)} 倍</p></details>
  ${t.unlocked?buttonHtml(main,{action:'world-tier',id:String(t.tier),variant:t.tier===view.current?'secondary':'primary',disabled:busy||!view.canSwitch||t.tier===view.current}):`<p class="ui-caption">${escapeHtml(t.unlockText||'尚未开启')}</p>`}
  ${view.canSwitch?'':`<p class="ui-caption">${t.tier===view.current?'出海后生效':'回港口或前哨才能换海'}</p>`}</div>`;
}
/** 面板正文；标题与关闭按钮由公共面板头统一给。 */
export function seaDifficultyHtml(view:SeaDifficultyView,pick:number,busy:boolean){
 const tiers=view.tiers;
 if(!tiers.length)return '<p class="ui-caption">远航开启后，这里可以选要走多深的海。</p>';
 const selected=tiers.find(t=>t.tier===pick)??tiers.find(t=>t.tier===view.current)??tiers[0];
 return `<p class="ui-caption">越危险的海，带回的东西越好 · 出海后生效</p>
  <div class="sea-difficulty__grid"><div class="sea-list" aria-label="可选海域"><div class="sea-list__head" aria-hidden="true"><span>海域</span><span>危险</span><span>奖励</span><span></span></div>${tiers.map(t=>row(t,view,selected.tier)).join('')}</div>${detail(selected,view,busy)}</div>`;
}
