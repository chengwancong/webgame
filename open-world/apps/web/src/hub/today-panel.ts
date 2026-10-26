/**
 * U7「今日」面板：每行一项。字段缺失、open=false、null 时整行隐藏，不显示占位，也不用客户端算的值。
 * returnQueue（回港演出队列）不在这里播放，由回港流程消费（见交付报告）。
 */
import {esc,buttonHtml,panelHeaderHtml,stateBlockHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import {hudMenuIcon} from '../hud-icons.ts';
import type {TodayView} from '../../../../packages/contracts/hub.ts';

export const REGION_NAMES: Record<string, string> = {
  wind: '风栖', mist: '雾铃', forge: '赤炉', frost: '霜镜', rift: '沉星', dragon: '龙眠', deep: '深潮',
};

export type TodayPanelState = {
  view: TodayView;
  /** 码头操作进行中：领取 / 快速收益都禁用，防止连点 */
  dockBusy: 'collect' | 'quick' | '';
  message: string;
  messageTone: 'success' | 'error';
  /** 委托板接口 404 后，不再显示「打开委托板」 */
  commissionsHidden: boolean;
};

/** resetAt 是服务端给的下次刷新时刻（ISO）。解析失败返回空串，调用方整行隐藏。 */
export function formatResetAt(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const row = (icon: Parameters<typeof iconHtml>[0], label: string, value: string, actions = '') =>
  `<li class="hub-card-row"><span class="hub-card-row__icon">${iconHtml(icon, {size: 20})}</span><div class="hub-card-row__content"><b class="hub-card-row__title">${esc(label)}</b><span class="hub-card-row__value">${value}</span></div><div class="hub-card-row__actions">${actions}</div></li>`;

/** heroShown: the hero card already shows first-clear and reset, so those rows are left out of the list. */
export function todayRows(state: TodayPanelState, heroShown = false): string[] {
  const {view} = state;
  const rows: string[] = [];

  if (view.firstClear && !heroShown) {
    rows.push(row('star', '首通 ×2', `今日剩余 <b class="ui-number">${Math.max(0, view.firstClear.limit - view.firstClear.used)}</b> / ${view.firstClear.limit} 次`));
  }

  if (view.commissions?.open) {
    const c = view.commissions;
    rows.push(row('book', '委托', `进行中 ${c.active} / ${c.slots} · 今日已完成 ${c.doneToday} · 可累积 ${c.banked}`,
      state.commissionsHidden ? '' : buttonHtml('打开委托板', {action: 'panel', id: 'hub-commission', variant: 'secondary', size: 'compact'})));
  }

  if (view.dock?.open) {
    const d = view.dock;
    const fleets = d.fleets.length
      ? d.fleets.map(f => `<span class="hub-today__fleet">船队 ${f.fleet} · ${f.region ? esc(REGION_NAMES[f.region] ?? f.region) : '空闲'}${f.region ? ` · 已累积 ${f.accruedHours.toFixed(1)} / ${f.cap} 小时` : ''}</span>`).join('')
      : '<span class="hub-today__fleet">还没有派出船队</span>';
    const busy = Boolean(state.dockBusy);
    const actions = [
      d.pendingCollect ? buttonHtml('领取', {action: 'hub-dock-collect', variant: 'primary', size: 'compact', busy: state.dockBusy === 'collect', busyLabel: '正在领取…', disabled: busy && state.dockBusy !== 'collect'}) : '',
      d.quickAvailable ? buttonHtml('快速收益', {action: 'hub-dock-quick', variant: 'secondary', size: 'compact', busy: state.dockBusy === 'quick', busyLabel: '正在结算…', disabled: busy && state.dockBusy !== 'quick'}) : '',
    ].join('');
    rows.push(row('hourglass', '码头船队', `<span class="hub-today__fleets">${fleets}</span>`, actions));
  }

  if (view.high) {
    rows.push(row('skull', '高难副本', `今日剩余 <b class="ui-number">${view.high.left}</b> / ${view.high.limit} 次`));
  }

  const reset = formatResetAt(view.resetAt);
  if (reset && !heroShown) rows.push(row('clock', '下次刷新', esc(reset)));
  return rows;
}

function todayHeroCardHtml(state: TodayPanelState): string {
  const {view} = state;
  const remaining = view.firstClear ? Math.max(0, view.firstClear.limit - view.firstClear.used) : null;
  const limit = view.firstClear?.limit ?? 0;
  const reset = formatResetAt(view.resetAt);
  if (remaining === null && !reset) return '';
  return `<div class="hub-hero-card">
    <div class="hub-hero-card__band">${iconHtml('star', {size: 20})}<h3 class="hub-hero-card__title">今日概况</h3></div>
    <div class="hub-hero-card__body">${remaining !== null ? `<span class="hub-hero-card__big ui-number">${remaining}<span class="hub-hero-card__big-denom">/${limit}</span></span><span class="hub-hero-card__sub">首通次数剩余</span>` : ''}${reset ? `<span class="hub-hero-card__sub hub-hero-card__sub--reset">${iconHtml('clock', {size: 16})}刷新 ${esc(reset)}</span>` : ''}</div>
  </div>`;
}

export function todayPanelHtml(state: TodayPanelState): string {
  const heroCard = todayHeroCardHtml(state);
  const rows = todayRows(state, Boolean(heroCard));
  const body = rows.length
    ? `<ul class="hub-today__list">${rows.join('')}</ul>`
    : stateBlockHtml({kind: 'empty', title: '今天还没出航', message: '出海一趟，任务记录会显示在这里。', action: {label: '打开航图', action: 'panel', id: 'hub-chart'}, compact: true});
  const msg = state.message
    ? `<p class="hub-today__msg is-${state.messageTone}" role="${state.messageTone === 'error' ? 'alert' : 'status'}">${esc(state.message)}</p>`
    : '<p class="hub-today__msg" aria-hidden="true"></p>';
  return `<section class="panel hub-today-panel" data-panel="hub-today" role="dialog" aria-modal="true" aria-label="今日" aria-busy="${Boolean(state.dockBusy)}">
  ${panelHeaderHtml('今日', {closeLabel: '关闭今日', closeAction: 'hub-today-close', closeDisabled: Boolean(state.dockBusy), emblemHtml: hudMenuIcon('today')})}
  ${heroCard}
  ${body}
  ${msg}
</section>`;
}
