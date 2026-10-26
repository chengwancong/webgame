/** Static review cases only: no TacticalSource, server commands, or player data. */
import {buttonHtml,esc,iconHtml,meterHtml,statusBadgeHtml} from './ui-components.ts';
import {hydratePetPortraits,petPortraitHtml} from './hub/pet-portrait.ts';
import {tacticalEncounterHtml,tacticalResultHtml} from './tactical/presentation.ts';
import type {TacticalResultView} from './tactical/contract.ts';
import boards from '../../../packages/content/tactical-boards.json';
import graybox from '../../../packages/content/tactical-graybox.json';

const board=boards.boards.find(x=>x.id==='wind-blades')!;
const hero=graybox.heroes.find(x=>x.id==='sword')!;
const inRoot=(body:string)=>`<div class="tb-root" data-screen="board">${body}</div>`;
const result=(patch:Partial<TacticalResultView>={}):TacticalResultView=>({outcome:'victory',receiptId:null,rewards:[],rewardsNote:'战棋沙盒 · 不发奖，不写角色存档。',nodeCompleted:true,returnLabel:'返回探索',...patch});
const command=(label:string,icon:Parameters<typeof iconHtml>[0],extra='')=>`<button class="tb-cmd ui-button ui-button--secondary ${extra}" type="button">${iconHtml(icon,{size:24})}<span class="tb-cmd-label">${label}</span><span class="tb-cmd-state">可用</span></button>`;

function sidebarHtml(){
 return inRoot(`<header class="tb-top"><div class="tb-node"><strong>${esc(board.name)}</strong><span>静态样例 · 侧栏与指令状态</span></div><b class="tb-round">第 2 回合</b>${statusBadgeHtml('手动','info')}</header>
<aside class="tb-left" aria-label="我方信息">
<section class="tb-card tb-hero-card"><h3 class="tb-card-title">${iconHtml('people',{size:24})}星海旅人</h3>${meterHtml({value:78,max:100,label:'生命',tone:'hp',valueText:'end'})}<p class="tb-line">${iconHtml('diamond',{size:16})}护盾 <b>25</b></p></section>
<section class="tb-card tb-budget-card"><h3 class="tb-card-title">本回合额度</h3><ul class="tb-budget"><li class="tb-budget-row is-used"><span class="tb-budget-mark">◇</span>${iconHtml('speed',{size:20})}<span>移动：<b>已用</b></span><small>移动步数：4</small></li><li class="tb-budget-row is-open"><span class="tb-budget-mark">◆</span>${iconHtml('star',{size:20})}<span>技能：<b>可用</b></span><small>普攻也占用</small></li></ul><p class="tb-note">移动与技能各一次，先后自选。</p></section>
<section class="tb-card tb-pet-card">${petPortraitHtml('ss-pet-wind-free-young','tb-pet-portrait')}<h3 class="tb-card-title">风绒·幼年</h3><p class="tb-line">${statusBadgeHtml('条件辅助','info',{variant:'inline'})}</p><p class="tb-note">主角受到攻击后辅助。</p></section></aside>
<main class="tb-main"><div class="tb-banner">行动预览：确认后执行。</div><section class="ui-state"><h3>棋盘保持现状</h3><p>本页只审阅 U6 侧栏、指令、开局和结算。</p></section></main>
<aside class="tb-right" aria-label="选择与记录"><section class="tb-card tb-preview"><h3 class="tb-card-title">行动预览</h3><p class="tb-line">${iconHtml('swords',{size:24})}<b>普通攻击</b></p><dl class="tb-facts"><dt>影响</dt><dd>1 格</dd><dt>伤害</dt><dd>10（静态样例）</dd></dl><div class="tb-actions">${buttonHtml('确认行动',{variant:'primary'})}${buttonHtml('取消选择',{variant:'secondary'})}</div></section>
<section class="tb-card tb-order"><p class="tb-eyebrow">行动顺序</p><ol class="tb-order-list"><li><button type="button" class="tb-unit-chip ui-button ui-button--secondary ui-button--compact is-actor">${iconHtml('people',{size:16})}星海旅人</button></li><li><button type="button" class="tb-unit-chip ui-button ui-button--secondary ui-button--compact">${iconHtml('skull',{size:16})}刀兵</button></li></ol></section>
<section class="tb-card tb-log"><p class="tb-eyebrow">战斗记录</p><ol class="tb-log-list"><li class="tb-log-hero">星海旅人移动完成。</li><li class="tb-log-pet">风绒·幼年：风护。</li></ol></section></aside>
<footer class="tb-commands"><div class="tb-cmd-group">${command('移动','speed','is-used')}${command('普通攻击','swords','is-on')}${command('横扫','area')}${command('守护','armor')}</div><div class="tb-cmd-group">${command('结束行动','check')}${command('开启托管','auto')}${command('撤退','chevron-left')}</div></footer>`);
}

function setupHtml(){
 return inRoot(`<div class="tb-cover"><section class="sandbox-card" aria-label="沙盒开局设置"><h2>${iconHtml('swords',{size:32})}沙盒开局设置</h2><p class="sandbox-note">战棋沙盒 · 不发奖（不写角色存档）。编排只在开局时提交，开局后不可修改。</p>
<div class="sandbox-field ui-field"><label for="u6-qa-board">棋盘</label><select id="u6-qa-board" class="ui-select"><option value="${esc(board.id)}">${esc(board.name)}（普通）</option></select></div>
<div class="sandbox-field ui-field"><label for="u6-qa-hero">英雄</label><select id="u6-qa-hero" class="ui-select"><option value="${esc(hero.id)}">${esc(hero.name)}</option></select></div>
<div class="sandbox-field ui-field"><label for="u6-qa-seed">种子（可选，留空随机）</label><input id="u6-qa-seed" value="37"></div>
<div class="sandbox-field"><label>技能优先级（上方优先）</label><ul class="sandbox-priority-list">${hero.skillIds.filter(id=>id!==hero.basicSkillId).map((id,i)=>`<li class="sandbox-priority-item" data-skill="${esc(id)}"><span class="sandbox-priority-order">${i+1}</span>${iconHtml('star',{size:24})}<span class="sandbox-priority-label">${esc(({whirl:'旋风斩',ward:'守护',vortex_blade:'回旋刃'} as Record<string,string>)[id]??id)}</span>${buttonHtml('▲',{variant:'tertiary',size:'compact',disabled:i===0,attributes:{'aria-label':'上移'}})}${buttonHtml('▼',{variant:'tertiary',size:'compact',disabled:i===2,attributes:{'aria-label':'下移'}})}</li>`).join('')}</ul></div>
<div class="sandbox-switches"><div class="sandbox-switch-row"><label for="u6-qa-target">目标</label><select id="u6-qa-target" class="ui-select"><option>最近（nearest）</option></select></div><div class="sandbox-switch-row"><label for="u6-qa-position">位置</label><select id="u6-qa-position" class="ui-select"><option>贴近（stay-close）</option></select></div><div class="sandbox-switch-row"><label for="u6-qa-guard">保命守护</label><input id="u6-qa-guard" type="checkbox" checked><span class="ui-caption">低于 50% 生命先用防护</span></div></div>${buttonHtml('开始',{id:'sandbox-start',variant:'primary'})}</section></div>`);
}

export const u6QaCases:{id:string;label:string;render:()=>string;mount?:(root:HTMLElement)=>void}[]=[
 {id:'u6-sidebar',label:'U6 侧栏与指令',render:sidebarHtml,mount:hydratePetPortraits},
 {id:'u6-setup',label:'U6 开局设置',render:setupHtml},
 {id:'u6-encounter',label:'U6 遭遇',render:()=>inRoot(tacticalEncounterHtml('刀兵 ×3',board.name))},
 {id:'u6-rewards',label:'U6 奖励样式',render:()=>inRoot(tacticalResultHtml(result({rewards:[{label:'金币',amount:'120'},{label:'经验',amount:'60'},{label:'强化石',amount:'2'},{label:'木材',amount:'3'}]})))},
 {id:'u6-empty',label:'U6 沙盒无奖励',render:()=>inRoot(tacticalResultHtml(result()))},
 {id:'u6-retreat',label:'U6 撤退',render:()=>inRoot(tacticalResultHtml(result({outcome:'retreat',nodeCompleted:false})))},
];
