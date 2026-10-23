/**
 * Z2 部位强化面板（M17）。
 * 顶部共鸣徽记 + 6 个部位格，取代旧工坊升级页签里的「按件升级」入口。
 * 样式在 slot-upgrade-panel.css（随本文件引入）。
 */
import {esc, buttonHtml, sectionTitleHtml, resourceAmountHtml, statusBadgeHtml} from '../ui-components.ts';
import type {SlotsView, SlotsView as _} from '../../../../packages/contracts/zhangjian.ts';
import type {Snapshot} from '../../../../packages/contracts/index.ts';

/** 部位中文名（与 rules/zhangjian.ts slotNames 同值，独立避免全量引入规则层）。 */
const SLOT_NAMES: Record<string, string> = {
  weapon: '武器', armor: '衣服', helmet: '头盔',
  boots: '鞋子', accessory: '项链', ring: '戒指',
};

/** 共鸣档位：每档 +2% 攻击/护甲/生命（档位数值以服务端 bonusPercent 为准）。 */
const RESONANCE_TIER_NAMES = ['未激活', '一档', '二档', '三档', '四档', '五档'];

export function slotUpgradePanelHtml(view: SlotsView, snapshot: Pick<Snapshot, 'gold' | 'material'>, busy: boolean): string {
  const {resonance} = view;

  // 共鸣徽记（ART-HF A31：resonance-0..5 六张整图）
  const tier = Math.max(0, Math.min(5, resonance.tier));
  const resonanceRing = `<img class="slot-resonance__ring" src="/art/hub-ui/resonance/resonance-${tier}.png" alt="${esc('共鸣 ' + RESONANCE_TIER_NAMES[tier])}">`;

  const nextHint = resonance.next
    ? `再把 ${resonance.next.missing} 个部位升到 +${resonance.next.rank}`
    : '已达满档';

  const resonanceHeader = `<div class="slot-resonance">
    ${resonanceRing}
    <div class="slot-resonance__info">
      <b class="slot-resonance__title">共鸣 ${RESONANCE_TIER_NAMES[resonance.tier]}</b>
      <span class="slot-resonance__bonus">全身 +${resonance.bonusPercent}% 攻击 / 护甲 / 生命</span>
      <small class="slot-resonance__next">${esc(nextHint)}</small>
    </div>
  </div>`;

  // 六个部位格
  const slotCards = view.slots.map(s => {
    const name = SLOT_NAMES[s.slot] ?? s.slot;
    const rankLabel = s.rank > s.gearCap && s.gearCap > 0
      ? `+${s.rank}（本件生效 +${s.effective}）`
      : `+${s.rank}`;
    const blocked = Boolean(s.block);
    const canUpgrade = !blocked && s.cost !== null;
    const costHtml = s.cost
      ? `<span class="slot-card__cost">${resourceAmountHtml('gold', s.cost.gold, {compact: true})}${resourceAmountHtml('material', s.cost.material, {compact: true})}</span>`
      : '';
    const blockHtml = s.block ? statusBadgeHtml(s.block, 'warning', {variant: 'inline'}) : '';
    const btn = buttonHtml('强化', {
      action: 'slot-upgrade', id: s.slot, variant: 'primary', size: 'compact',
      disabled: busy || !canUpgrade,
      busy: busy,
      busyLabel: '强化中…',
    });
    // ART-HF A31 格框：满级（生效到本件封顶）/ 受本件品质限制 / 普通
    const frame = s.gearId && s.rank > s.gearCap && s.gearCap > 0 ? 'is-limited' : s.gearId && s.gearCap > 0 && s.effective >= s.gearCap ? 'is-maxed' : '';
    return `<div class="slot-card ${frame}">
      <span class="slot-card__name">${esc(name)}</span>
      <span class="slot-card__rank">${esc(rankLabel)}</span>
      ${s.gearId ? `<span class="slot-card__level">生效 +${s.effective}</span>` : '<span class="slot-card__empty">未穿装备</span>'}
      <div class="slot-card__actions">${blockHint(blockHtml)}${costHtml}${btn}</div>
    </div>`;
  }).join('');

  return `<section class="slot-upgrade-panel" aria-label="部位强化">
    ${sectionTitleHtml('部位强化')}
    ${resonanceHeader}
    <div class="slot-grid">${slotCards}</div>
  </section>`;
}

function blockHint(html: string) {
  return html ? `<div class="slot-card__block">${html}</div>` : '';
}
