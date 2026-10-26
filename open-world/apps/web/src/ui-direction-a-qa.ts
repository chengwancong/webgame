/**
 * ui-direction-a-qa.ts — 方向 A 验收页脚本
 * 展示 U0 组件画廊 + U1 两份结算 + U2 背包/提示框。
 * 只读，不修改任何游戏状态。
 */
import {buttonHtml, tabsHtml, statusBadgeHtml, resourceAmountHtml} from './ui-components.ts';
import {itemSlot} from './ui-components.ts';
import {renderEquipmentTip} from './equipment-tip.ts';
import {hexCatalogById,setHexContext} from './hex-rune-view.ts';
import {publicHexRunes} from '../../../packages/content/hex-runes.ts';
import {art} from './ui-assets.ts';
import type {BattleResult} from '../../../packages/contracts/index.ts';
import {battleResultHtml} from './battle-result-panel.ts';
import {FIXTURE_RESULT} from './hub/hub-fixtures.ts';
import {regions} from '../../../packages/content/index.ts';

// ── U0 画廊：按钮 ─────────────────────────────────────────────────────
const btns = [
  buttonHtml('主要操作', {variant: 'primary'}),
  buttonHtml('次要操作', {variant: 'secondary'}),
  buttonHtml('第三级', {variant: 'tertiary'}),
  buttonHtml('危险操作', {variant: 'danger'}),
  buttonHtml('禁用', {disabled: true}),
  buttonHtml('加载中', {busy: true, busyLabel: '处理中…'}),
  buttonHtml('紧凑', {variant: 'secondary', size: 'compact'}),
  buttonHtml('', {size: 'icon', iconHtml: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2 2"/></svg>'}),
];
document.getElementById('gallery-buttons')!.innerHTML = btns.join('');

// ── U0 画廊：页签 ────────────────────────────────────────────────────
const tabs = tabsHtml({
  label: '示例页签',
  action: 'qa-tab',
  selected: 'all',
  items: [
    {id: 'all', label: '全部'},
    {id: 'gear', label: '装备'},
    {id: 'material', label: '材料'},
    {id: 'book', label: '技能书'},
  ],
});
document.getElementById('gallery-tabs')!.innerHTML = tabs;

// ── U0 画廊：徽章 ────────────────────────────────────────────────────
const tones: Array<Parameters<typeof statusBadgeHtml>[1]> = ['neutral', 'info', 'success', 'warning', 'danger'];
const badgeLabels = ['普通', '信息', '成功', '警告', '危险'];
document.getElementById('gallery-badges')!.innerHTML = tones.map((t, i) =>
  statusBadgeHtml(badgeLabels[i], t)
).join(' ') + ' &nbsp; ' +
tones.map((t, i) => statusBadgeHtml(badgeLabels[i], t, {variant: 'inline'})).join(' ');

// ── U0 画廊：物品格 ──────────────────────────────────────────────────
const qualities = ['common', 'magic', 'rare', 'legendary'] as const;
const gearBases = [
  'standard-sword-t1-weapon',
  'standard-sword-t1-armor',
  'standard-hammer-t2-weapon',
  'omega-sword-t3-weapon',
] as const;
const slotHtml = qualities.map((q, i) =>
  itemSlot({
    action: 'qa-slot',
    id: `qa-${q}`,
    label: `${['普通', '魔法', '稀有', '传说'][i]}装备`,
    src: art('gear-' + gearBases[i]),
    className: `loot-tile quality-${q}`,
    attributes: {'data-quality': q},
  })
).join('');
document.getElementById('gallery-slots')!.innerHTML = slotHtml;

// ── U0 画廊：资源数值 ────────────────────────────────────────────────
const resources = (['gold', 'xp', 'material'] as const).map(id =>
  `<span class="ui-resource ui-resource--pill" data-resource="${id}">` +
  resourceAmountHtml(id, 1280 * (id === 'gold' ? 1 : id === 'xp' ? 3 : 0.04) | 0).replace(
    'class="ui-resource"', 'class="ui-resource--inner"'
  ) +
  '</span>'
);
// simple pill: wrap resourceAmountHtml output in a pill shell
const pillHtml = (['gold', 'xp', 'material'] as const).map(id =>
  resourceAmountHtml(id, id === 'gold' ? 1280 : id === 'xp' ? 3400 : 36).replace(
    'class="ui-resource"',
    'class="ui-resource ui-resource--pill"'
  )
).join('');
document.getElementById('gallery-resources')!.innerHTML =
  (['gold', 'xp', 'material'] as const).map(id =>
    resourceAmountHtml(id, id === 'gold' ? 1280 : id === 'xp' ? 3400 : 36)
  ).join('') +
  '<hr style="border-color:#4a6070;width:100%;margin:8px 0">' +
  pillHtml;

// ── U1 结算数据 ──────────────────────────────────────────────────────
const RESULT_DATA: BattleResult = {
  permit_id: '00000000-0000-0000-0000-000000000001',
  region: regions[0].id,
  cycle: 1,
  success: true,
  first_clear: true,
  delivery: 'inventory',
  history_complete: true,
  pending_gear: 0,
  totals: {gold: 1280, xp: 3400, material: 36},
  materials: {ore: 5, herb: 3, boss_essence: 2},
  books: {'slash': 1},
  unlocked_regions: [],
  gear: [
    {id: 'g1', name: '深渊大剑', quality: 'legendary', base: 'omega-sword-t3-weapon', attack: 380, armor: 0, affixes: [], inscription: null, rank: 0, level: 1},
    {id: 'g2', name: '风纹战衣', quality: 'rare', base: 'standard-sword-t2-armor', attack: 0, armor: 220, affixes: [], inscription: null, rank: 0, level: 1},
    {id: 'g3', name: '飞翼护盔', quality: 'rare', base: 'standard-sword-t2-helmet', attack: 0, armor: 180, affixes: [], inscription: null, rank: 0, level: 1},
    {id: 'g4', name: '追风战靴', quality: 'magic', base: 'standard-sword-t2-boots', attack: 0, armor: 140, affixes: [], inscription: null, rank: 0, level: 1},
    {id: 'g5', name: '逐风之刃', quality: 'magic', base: 'standard-sword-t2-weapon', attack: 210, armor: 0, affixes: [], inscription: null, rank: 0, level: 1},
    {id: 'g6', name: '旅人轻甲', quality: 'common', base: 'standard-sword-t1-armor', attack: 0, armor: 80, affixes: [], inscription: null, rank: 0, level: 1},
  ],
} as unknown as BattleResult;

// ── 结算渲染 ─────────────────────────────────────────────────────────
let currentEnter = true;

function renderResult(withHub: boolean, enter: boolean) {
  const html = battleResultHtml(
    {region: regions[0].id, outcome: 'success'},
    RESULT_DATA,
    'ready',
    '拾星港',
    '',
    enter,
    0,
    undefined,
    null,
    true,
    null,
    withHub ? FIXTURE_RESULT : undefined
  );
  const overlay = document.getElementById('modal-overlay')!;
  const modal = document.getElementById('modal')!;
  overlay.removeAttribute('hidden');
  modal.innerHTML = html;
  modal.classList.add('open');
  modal.dataset.enter = 'open';
}

document.getElementById('btn-result-win')!.addEventListener('click', () => renderResult(false, true));
document.getElementById('btn-result-hub')!.addEventListener('click', () => renderResult(true, true));
document.getElementById('btn-replay')!.addEventListener('click', () => {
  const overlay = document.getElementById('modal-overlay')!;
  if (!overlay.hidden) {
    const wasHub = document.querySelector('.hub-result') !== null;
    renderResult(wasHub, true);
  }
});
document.getElementById('btn-close')!.addEventListener('click', () => {
  const overlay = document.getElementById('modal-overlay')!;
  overlay.setAttribute('hidden', '');
  const modal = document.getElementById('modal')!;
  modal.innerHTML = '';
  modal.classList.remove('open');
});

// ── U2 背包格（四品质 + 空格）────────────────────────────────────────
const bagWellBases = [
  {quality: 'common',    src: art('gear-standard-sword-t1-weapon'), label: '普通装备', count: ''},
  {quality: 'magic',     src: art('gear-standard-sword-t1-armor'),  label: '魔法装备', count: ''},
  {quality: 'rare',      src: art('gear-standard-hammer-t2-weapon'),label: '稀有装备', count: ''},
  {quality: 'legendary', src: art('gear-omega-sword-t3-weapon'),    label: '传说装备', count: ''},
  {quality: '',          src: '',                                    label: '空格',     count: ''},
  {quality: 'common',    src: art('gear-standard-sword-t1-armor'),  label: '普通×3',  count: '3'},
] as const;
const bagWellsHtml = bagWellBases.map(({quality, src, label, count}) => {
  const wellClass = `bag-item-well${quality ? ' quality-' + quality : ''}`;
  const imgHtml = src ? `<span class="bag-item-image"><img src="${src}" alt=""></span>` : '';
  const countHtml = count ? `<span class="bag-item-count">${count}</span>` : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <div class="bag-item" style="width:72px;height:72px;display:block">
      <div class="${wellClass}" style="width:72px;height:72px">
        ${imgHtml}${countHtml}
      </div>
    </div>
    <span style="font:11px/1.4 sans-serif;color:var(--color-text-secondary)">${label}</span>
  </div>`;
}).join('');
document.getElementById('gallery-bag-wells')!.innerHTML = bagWellsHtml;

// ── U2 装备提示框 fixtures ─────────────────────────────────────────────
// 参考 apps/web/item-tip-qa.html 样例数据结构
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TIP_FIXTURES: Record<string, any> = {
  common: {
    gear: {id: 'tip-common', base: 'standard-sword-t1-weapon', slot: 'weapon',
      name: '旅者长刃', quality: 'common', attack: 28, armor: 0, rank: 0, locked: false,
      affixes: [], effect: 'none'},
    primary_attribute: 'attack', revision: 1, max_rank: 5,
    attributes: {base: {attack: 28}, enhancement: {attack: 0}, effective: {attack: 28}},
    effect_description: '普通单体攻击，无特殊效果。',
    comparison: {attack: {current: 22, equipped: 28, delta: 6}},
    currentSets: [], equippedSets: [], equipped: false,
  },
  magic: {
    gear: {id: 'tip-magic', base: 'standard-sword-t1-armor', slot: 'armor',
      name: '轻风护甲', quality: 'magic', attack: 0, armor: 12, rank: 1, locked: false,
      affixes: [{id: 'a1', name: '生命上限', tier: 2, stat: 'hp', value: 40, description: '生命上限 +40'}],
      effect: 'none'},
    primary_attribute: 'armor', revision: 1, max_rank: 5,
    attributes: {base: {armor: 12}, enhancement: {armor: 1}, effective: {armor: 13}},
    effect_description: '无特殊效果。',
    comparison: {armor: {current: 10, equipped: 13, delta: 3}, hp: {current: 340, equipped: 380, delta: 40}},
    currentSets: [], equippedSets: [], equipped: false,
  },
  rare: {
    gear: {id: 'tip-rare', base: 'standard-hammer-t2-weapon', slot: 'weapon',
      name: '裂地战锤', quality: 'rare', attack: 36, armor: 0, rank: 2, locked: false,
      affixes: [
        {id: 'a1', name: '暴击率', tier: 1, stat: 'critChance', value: 0.04, description: '暴击率 +4%'},
        {id: 'a2', name: '生命偷取', tier: 2, stat: 'lifesteal', value: 0.02, description: '生命偷取 +2%'},
        {id: 'a3', name: '移动速度', tier: 3, stat: 'speed', value: 0.05, description: '移动速度 +5%'},
      ],
      effect: 'none'},
    primary_attribute: 'attack', revision: 1, max_rank: 5,
    attributes: {base: {attack: 36}, enhancement: {attack: 4}, effective: {attack: 40}},
    effect_description: '无特殊效果。',
    replaces: {name: '旅者长刃', rank: 0},
    comparison: {attack: {current: 28, equipped: 40, delta: 12}, armor: {current: 18, equipped: 18, delta: 0}},
    currentSets: [], equippedSets: [], equipped: false,
  },
  legendary: {
    gear: {id: 'tip-legendary', base: 'omega-sword-t3-weapon', slot: 'weapon',
      name: '深渊大剑', quality: 'legendary', attack: 42, armor: 0, rank: 3, locked: false,
      affixes: [
        {id: 'a1', name: '暴击率', tier: 3, stat: 'critChance', value: 0.06, description: '暴击率 +6%'},
        {id: 'a2', name: '冷却缩减', tier: 2, stat: 'cdr', value: 0.06, description: '冷却缩减 +6%'},
        {id: 'a3', name: '生命偷取', tier: 3, stat: 'lifesteal', value: 0.03, description: '生命偷取 +3%'},
        {id: 'a4', name: '火焰抗性', tier: 1, stat: 'fireResist', value: 0.08, description: '火焰抗性 +8%'},
      ],
      effect: 'chain'},
    primary_attribute: 'attack', revision: 1, max_rank: 5,
    attributes: {base: {attack: 42}, enhancement: {attack: 8}, effective: {attack: 50}},
    effect_description: '命中向附近敌人传导 30% 伤害。',
    replaces: {name: '旅者长刃', rank: 0},
    comparison: {attack: {current: 28, equipped: 50, delta: 22}},
    currentSets: [], equippedSets: [], equipped: false,
  },
  hex: {
    gear: {id: 'tip-hex', base: 'standard-hammer-t2-weapon', slot: 'weapon',
      name: '裂地战锤（六角印）', quality: 'rare', attack: 36, armor: 0, rank: 0, locked: false,
      affixes: [
        {id: 'a1', name: '暴击率', tier: 2, stat: 'critChance', value: 0.04, description: '暴击率 +4%'},
      ],
      hex: {rune: 'hex-chain-lightning', tier: 'rare'},
      effect: 'none'},
    primary_attribute: 'attack', revision: 1, max_rank: 5,
    attributes: {base: {attack: 36}, enhancement: {attack: 0}, effective: {attack: 36}},
    effect_description: '无特殊效果。',
    comparison: {attack: {current: 28, equipped: 36, delta: 8}},
    currentSets: [], equippedSets: [], equipped: false,
  },
  equipped: {
    gear: {id: 'tip-equipped', base: 'standard-sword-t1-weapon', slot: 'weapon',
      name: '旅者长刃（已装备）', quality: 'magic', attack: 28, armor: 0, rank: 0, locked: false,
      affixes: [{id: 'a1', name: '暴击率', tier: 1, stat: 'critChance', value: 0.03, description: '暴击率 +3%'}],
      effect: 'none'},
    primary_attribute: 'attack', revision: 1, max_rank: 5,
    attributes: {base: {attack: 28}, enhancement: {attack: 0}, effective: {attack: 28}},
    effect_description: '无特殊效果。',
    comparison: {}, currentSets: [], equippedSets: [], equipped: true,
  },
};

// Same catalog the game feeds presentation.ts, so the HEX row shows real rune text.
setHexContext(hexCatalogById(publicHexRunes), undefined);

function showTip(key: string) {
  const tooltip = document.getElementById('tooltip')!;
  const fixture = TIP_FIXTURES[key];
  if (!fixture) {tooltip.innerHTML = ''; return;}
  tooltip.innerHTML = renderEquipmentTip(fixture as any);
  // Mark active button
  document.querySelectorAll<HTMLButtonElement>('[id^="btn-u2-"]').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('btn-u2-' + key);
  if (btn) btn.classList.add('active');
}

(['common', 'magic', 'rare', 'legendary', 'hex', 'equipped'] as const).forEach(k => {
  document.getElementById('btn-u2-' + k)?.addEventListener('click', () => showTip(k));
});
document.getElementById('btn-u2-close')?.addEventListener('click', () => {
  const tooltip = document.getElementById('tooltip')!;
  tooltip.innerHTML = '';
  document.querySelectorAll<HTMLButtonElement>('[id^="btn-u2-"]').forEach(b => b.classList.remove('active'));
});
// 默认展示稀有品质提示框
showTip('rare');
