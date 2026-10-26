import {combatReviewHtml,combatKeyProgressHtml} from './combat-review-view.ts';
import type {HubSettlement as HubResultBlock} from '../../../packages/contracts/hub.ts';
import {hubResultRightHtml,hubResultFooterHtml} from './hub/hub-result-block.ts';
import type {CombatReview} from '../../../packages/simulation/combat-review.ts';
import type {StageKeyProgress} from '../../../packages/contracts/stage-keys.ts';
import {affixDisplayValue} from '../../../packages/contracts/affix-units.ts';
import stageKeyLabels from '../../../packages/content/stage-key-labels.json';
import type {BattleResult,GearQuality} from '../../../packages/contracts/index.ts';
import {regionById,skillCatalog} from '../../../packages/content/index.ts';
import {art,hasArt} from './ui-assets.ts';
import {esc,buttonHtml,itemSlot,resourceAmountHtml,sectionTitleHtml,ceremonyHeadingHtml} from './ui-components.ts';
import {materialDestinations} from './bag-model.ts';
import {materialDefs,materialIcon} from './crafting-model.ts';
import {victory,defeat,pending} from './battle-result-emblems.ts';
import type {ResultPhase} from './battle-result-controller.ts';
import {battleDefeatHtml} from './battle-defeat-panel.ts';
import {publicHexRunes} from '../../../packages/content/hex-runes.ts';
import type {HexCombatStats} from '../../../packages/contracts/hex-combat-stats.ts';

const hexRuneNames=new Map(publicHexRunes.map(r=>[r.id,r.name]));
/** 词缀战绩：仅陈述服务端观测到的触发次数与直接伤害占比，不推算增益。 */
export function hexCombatStatsHtml(stats?:HexCombatStats|null){
 if(!stats||stats.coverage==='unavailable'||!Array.isArray(stats.rules)||!stats.rules.length)return '';
 const rows=[...stats.rules].sort((a,b)=>b.triggers-a.triggers).slice(0,4).map(r=>`<li><b>${esc(hexRuneNames.get(r.rune)||r.rune||r.rule)}</b><span>触发 ${r.triggers.toLocaleString('zh-CN')} 次</span>${r.share===null||r.share===undefined?'':`<span>直接伤害占比 ${Math.round(r.share*1000)/10}%</span>`}</li>`).join('');
 return `<section class="hex-combat-stats" aria-label="词缀战绩">${sectionTitleHtml('词缀战绩')}<ul>${rows}</ul>${stats.coverage==='partial'?'<small>仅统计部分战斗</small>':''}</section>`;
}
const stageMaterials=new Map(stageKeyLabels.map(row=>[row.id,row]));
const weights:Record<GearQuality,number>={legendary:0,rare:1,magic:2,common:3};
export function battleResultHtml(context:{region:string;outcome:'success'|'failure';keyStage?:number},data:BattleResult|undefined,phase:ResultPhase,safe:string,error:string,enter:boolean,revision=0,review?:CombatReview,keyProgress?:StageKeyProgress|null,simpleDefeat=true,hexStats?:HexCombatStats|null,hubBlock?:HubResultBlock){
 const won=Boolean(data?.success),visual=won?'success':context.outcome==='failure'?'failure':'pending',title=won?'挑战成功':visual==='failure'?'挑战失败':'战斗结束';
 if(visual==='failure'&&simpleDefeat)return battleDefeatHtml(regionById(context.region).name,phase,error);
 const gear=[...(data?.gear??[])].sort((a,b)=>weights[a.quality]-weights[b.quality]);
 const stacks=[...Object.entries(data?.materials??{}).map(([id,n])=>({id:'material:'+id,name:materialDefs.get(id)?.name??materialDestinations[id]?.name??stageMaterials.get(id)?.name??id,count:n,icon:materialDefs.has(id)?materialIcon(id,hasArt):stageMaterials.get(id)?.icon??'item-material-'+id,kind:'材料'})),...Object.entries(data?.books??{}).map(([id,n])=>({id:'book:'+id,name:(skillCatalog.find(s=>s.id===id)?.name??id)+'技能书',count:n,icon:'item-skill-book',kind:'技能书'}))].filter(i=>i.count>0);
 const tiles=gear.map(g=>itemSlot({action:'result-item',id:g.id,label:g.name,src:art('gear-'+g.base),className:'loot-tile quality-'+g.quality,attributes:{'data-quality':g.quality},equipmentTip:data?.delivery==='inventory'?{id:g.id,revision}:undefined,tip:data?.delivery==='inventory'?undefined:JSON.stringify({title:g.name,rows:[['攻击',g.attack],['护甲',g.armor],...g.affixes.map(a=>[a.name,affixDisplayValue(a.stat,a.value)])],note:'本次获得的装备'})})).concat(stacks.map(i=>itemSlot({action:'result-item',id:i.id,label:i.name+' ×'+i.count,src:art(i.icon),className:'loot-tile',extra:`<span class="quantity">${i.count.toLocaleString('zh-CN')}</span>`,tip:JSON.stringify({title:i.name,rows:[[i.kind,i.count]],note:'本次获得'})})));
 const relatedKey=keyProgress&&context.keyStage===keyProgress.stage?keyProgress:undefined;
 const firstReward=won&&data?.first_clear?'<p class="result-first-reward">首次通关奖励已领取</p>':'';
 const recap=review?combatReviewHtml(review,relatedKey,won?'钥匙进度':'你倒在了这里',!won):(relatedKey||firstReward)?`<section class="dungeon-diagnostic" aria-label="本场收获">${firstReward}${relatedKey?sectionTitleHtml('钥匙进度')+combatKeyProgressHtml(relatedKey):''}</section>`:'';
 const hexHtml=hexCombatStatsHtml(hexStats);
 const empty=Boolean(data?.history_complete&&!data.pending_gear&&!gear.length&&!stacks.length&&Object.values(data.totals).every(n=>n===0));
 const waiting=!data,count=data?`装备 ${gear.length} 件 · 材料 ${Object.values(data.materials).filter(n=>n>0).length} 种 · 技能书 ${Object.values(data.books).filter(n=>n>0).length} 种`:'正在保存本次收获';
 const messages:Record<ResultPhase,string>={saving:'正在保存战斗结果…',offline:'连接中断，请重新连接。',returning:'正在返回'+safe+'…','return-error':'返回失败，请重试。',ready:data?.pending_gear?'尚未拾取的装备保留在原区域。':data?.delivery==='inventory'?'战利品已收好。':'已拾取的战利品和获得的资源会保留。'};
 const grid=waiting?`<div class="loot-scroll"><div class="loot-grid">${Array.from({length:20},()=>'<div class="loading-tile"></div>').join('')}</div></div>`:tiles.length?`<div class="loot-scroll" tabindex="0" aria-label="本次战利品，可滚动查看"><div class="loot-grid">${tiles.join('')}</div></div>`:'<div class="loot-empty"><h3>这次没带回东西</h3></div>';
 const headerHtml=`<header class="result-hero ${enter?'enter':'quiet'}"><div class="hero-halo" aria-hidden="true"></div><div class="hero-rays" aria-hidden="true"></div>${Array.from({length:8},(_,i)=>`<i class="spark spark-${i}" aria-hidden="true"></i>`).join('')}<div class="hero-content"><div class="result-emblem">${{success:victory,failure:defeat,pending}[visual]}</div><div class="hero-copy"><div class="result-title">${ceremonyHeadingHtml(title)}</div><div class="hero-byline"><p>${esc(regionById(context.region).name)}</p>${data?.phase_progress?`<p class="result-phase">${data.success?'本场进度':'本次挑战'} · ${data.phase_progress.phase==='tide'?'裂星潮':'普通首领'} ${data.phase_progress.completed}/${data.phase_progress.total}</p>`:''}</div></div></div></header>`;
 const resourceRowHtml=`<div class="resource-row">${(['gold','xp','material'] as const).map(id=>resourceAmountHtml(id,data?.totals[id]??null)).join('')}</div>`;
 const lootBodyHtml=`<div class="loot-caption"><h2>本次战利品</h2><span>${count}</span></div><section class="loot-body">${grid}</section>`;
 const msgHtml=`<div class="result-message" data-empty-note="${empty&&phase==='ready'&&!error}" role="status" aria-live="polite" data-tone="${phase==='ready'?'success':phase==='saving'||phase==='returning'?'info':'warning'}"><span>${esc(messages[phase])}</span><small>${error&&phase==='ready'?esc(error):data&&!data.history_complete?'早期战斗的收获未完整记录':error&&phase==='offline'?'恢复连接后可查看本次收获':tiles.length>20?'向下滚动查看更多':''}</small></div>`;
 // hub 块：左战利品 · 右本场记录；没有 hub 块时走下面原有输出，逐字节不变
 if(hubBlock){
  const returning=phase==='saving'||phase==='returning';
  return `<section class="battle-result result hub-result" data-outcome="${visual}" role="dialog" aria-modal="true" aria-label="${title}" data-panel="battle-result">${headerHtml}${resourceRowHtml}${lootBodyHtml}${msgHtml}${hubResultRightHtml(hubBlock,recap+hexHtml)}${hubResultFooterHtml(hubBlock,returning)}</section>`;
 }
 return `<section class="battle-result result${empty?' is-empty':''}" data-outcome="${visual}" role="dialog" aria-modal="true" aria-label="${title}" data-panel="battle-result">${headerHtml}${resourceRowHtml}${lootBodyHtml}${msgHtml}${recap}${hexHtml}<footer class="result-footer"><div class="return-context"><span class="unlock-notice">${won&&data?.unlocked_regions.length?'新地区已开放：'+data.unlocked_regions.map(id=>esc(regionById(id).name)).join('、'):''}</span></div>${phase!=='offline'?buttonHtml('再来一次',{action:'result-retry',busy:phase==='saving'||phase==='returning',busyLabel:'正在出发…'}):''}${buttonHtml(phase==='offline'?'恢复连接':'回港整备',{action:'result-return',variant:'primary',busy:phase==='saving'||phase==='returning',busyLabel:phase==='saving'?'正在保存…':'正在返回…'})}</footer></section>`;
}
