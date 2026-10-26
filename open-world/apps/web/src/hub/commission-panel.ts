/**
 * U8 委托板：每条委托一行，固定行高。放弃二次确认在行内完成（不撑高列表），Esc 先收确认再关面板。
 * busyKey 形如 `claim:<id>` / `abandon:<id>`，非空时所有按钮禁用，避免连点与并发请求。
 */
import {esc,buttonHtml,panelHeaderHtml,stateBlockHtml,statusBadgeHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import {hudMenuIcon} from '../hud-icons.ts';
import {meterHtml} from '../ui/graphics.ts';
import {resourceAmountHtml} from '../ui/currency.ts';
import {REGION_NAMES} from './today-panel.ts';
import type {HubCommissionsView as CommissionsView} from '../../../../packages/contracts/hub.ts';

type CommissionSlot = CommissionsView['slots'][number];

export type CommissionPanelState = {
  view: CommissionsView;
  busyKey: string;
  message: string;
  messageTone: 'success' | 'error';
  /** 正在二次确认放弃的委托 id */
  confirmAbandon: string;
};

function slotActions(slot: CommissionSlot, state: CommissionPanelState): string {
  const {busyKey, confirmAbandon} = state;
  const anyBusy = Boolean(busyKey);
  if (confirmAbandon === slot.id) {
    return `${buttonHtml('确认放弃', {action: 'hub-commission-abandon', id: slot.id, variant: 'danger', size: 'compact', busy: busyKey === `abandon:${slot.id}`, busyLabel: '正在放弃…', disabled: anyBusy && busyKey !== `abandon:${slot.id}`})}${buttonHtml('取消', {action: 'hub-commission-abandon-cancel', variant: 'secondary', size: 'compact', disabled: anyBusy})}`;
  }
  const claim = slot.status === 'ready'
    ? buttonHtml('交付', {action: 'hub-commission-claim', id: slot.id, variant: 'primary', size: 'compact', busy: busyKey === `claim:${slot.id}`, busyLabel: '正在交付…', disabled: anyBusy && busyKey !== `claim:${slot.id}`})
    : '';
  return `${claim}${buttonHtml('放弃', {action: 'hub-commission-abandon-confirm', id: slot.id, variant: 'tertiary', size: 'compact', disabled: anyBusy})}`;
}

function repPillHtml(value: number): string {
  return `<span class="hub-commission__rep-pill" aria-label="声望 ${value}">${iconHtml('star', {size: 16})}<b class="ui-number">${value}</b><small>声望</small></span>`;
}

function slotRow(slot: CommissionSlot, state: CommissionPanelState): string {
  const ready = slot.status === 'ready';
  const goal = Math.max(1, slot.target.goal);
  const rewardHtml = `<div class="hub-commission__reward-pills">${resourceAmountHtml('xp', slot.reward.xp, {pill: true, compact: true})}${resourceAmountHtml('gold', slot.reward.gold, {pill: true, compact: true})}${repPillHtml(slot.reward.rep)}</div>`;
  return `<li class="hub-commission__row is-${slot.status}${state.confirmAbandon === slot.id ? ' is-confirming' : ''}${ready ? ' is-ready' : ''}">
    <div class="hub-commission__main">
      <div class="hub-commission__head"><b class="hub-commission__title">${esc(slot.title)}</b><span class="hub-commission__region">${esc(REGION_NAMES[slot.region] ?? slot.region)}</span>${ready ? statusBadgeHtml('可交付', 'success', {iconHtml: iconHtml('check', {size: 16})}) : ''}</div>
      <p class="hub-commission__target">${esc(slot.target.text)}</p>
      <div class="hub-commission__progress">${meterHtml({value: Math.min(slot.target.progress, goal), max: goal, label: `${slot.title}进度`, valueText: 'end'})}</div>
    </div>
    ${rewardHtml}
    <div class="hub-commission__actions">${slotActions(slot, state)}</div>
  </li>`;
}

export function commissionPanelHtml(state: CommissionPanelState): string {
  const {view} = state;
  const heroCard = `<div class="hub-hero-card">
    <div class="hub-hero-card__band">${iconHtml('book', {size: 20})}<h3 class="hub-hero-card__title">今日委托</h3></div>
    <div class="hub-hero-card__body hub-commission__hero-body">
      <span class="hub-hero-card__stat"><span class="hub-hero-card__stat-num ui-number">${view.doneToday}<span class="hub-hero-card__big-denom">/${view.limitToday}</span></span><span class="hub-hero-card__stat-label">今日完成</span></span>
      <span class="hub-hero-card__stat"><span class="hub-hero-card__stat-num ui-number">${view.banked}</span><span class="hub-hero-card__stat-label">可累积</span></span>
    </div>
  </div>`;
  const body = view.slots.length
    ? `<ul class="hub-commission__list">${view.slots.map(s => slotRow(s, state)).join('')}</ul>`
    : stateBlockHtml({kind: 'empty', title: '暂时没有委托', message: '明天刷新后会有新的委托。', compact: true});
  const msg = state.message
    ? `<p class="hub-commission__msg is-${state.messageTone}" role="${state.messageTone === 'error' ? 'alert' : 'status'}">${esc(state.message)}</p>`
    : '<p class="hub-commission__msg" aria-hidden="true"></p>';
  return `<section class="panel hub-commission-panel" data-panel="hub-commission" role="dialog" aria-modal="true" aria-label="委托板" aria-busy="${Boolean(state.busyKey)}">
  ${panelHeaderHtml('委托板', {closeLabel: '关闭委托板', closeAction: 'hub-commission-close', closeDisabled: Boolean(state.busyKey), emblemHtml: hudMenuIcon('commission')})}
  ${heroCard}
  ${body}
  ${msg}
</section>`;
}
