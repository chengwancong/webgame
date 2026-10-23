/**
 * Z3 宠物面板（M17）。
 * 阵容区（1 上阵 + 2 助阵）+ 已拥有列表 + 9 个流派选择 + 图鉴。
 */
import {esc, buttonHtml, sectionTitleHtml, stateBlockHtml, statusBadgeHtml} from '../ui-components.ts';
import {petFlows} from '../../../../packages/contracts/zhangjian.ts';
import type {PetsView, PetView} from '../../../../packages/contracts/zhangjian.ts';

type PetCatalogEntry = PetsView['catalog'][number];

/** 流派中文名与元素（与 packages/rules/zhangjian.ts petFlows 同顺序）。 */
const FLOW_NAMES: Record<string, string> = {
  blade: '锋刃', ember: '余烬', glacier: '冰川', storm: '风暴',
  arcanum: '奥秘', shade: '暗影', venom: '剧毒', ricochet: '连弹', frostneedle: '霜针',
};
const ELEMENT_NAMES: Record<string, string> = {
  physical: '物理', fire: '火焰', cold: '冰霜', lightning: '雷电',
  arcane: '奥术', shadow: '暗影', poison: '毒素', pure: '真实',
};
const FORM_NAMES: Record<string, string> = {young: '幼年', adult: '成年', awakened: '觉醒'};
const TIER_NAMES: Record<string, string> = {free: '零氪', light: '轻氪', heavy: '重氪'};
const STATUS_NAMES = {owned: '已拥有', locked: '未解锁', unavailable: '暂未开放'} as const;

/** 宠物图集路径。runtime 格式：`<family>-<form>`，如 ss-pet-wind-free-young。 */
function petAtlasUrl(runtime: string) {
  // family 为 runtime 去掉末尾 -young/-adult/-awakened 的部分
  const family = runtime.replace(/-(?:young|adult|awakened)$/, '');
  return `/art/starsea/pets/v3/${family}/actor.webp`;
}

function petAnim(runtime: string): string {
  return `<div class="pet-anim" data-pet-runtime="${esc(runtime)}" aria-hidden="true"><img class="pet-anim__img" src="${petAtlasUrl(runtime)}" alt="" draggable="false"></div>`;
}

function petCardHtml(pet: PetView, role: 'active' | 'support', busy: boolean): string {
  const flowBtns = petFlows.map(f => buttonHtml(FLOW_NAMES[f] ?? f, {
    action: 'pet-flow', id: `${pet.family}:${f}`, variant: 'secondary', size: 'compact',
    pressed: pet.flow === f, disabled: busy,
  })).join('');
  return `<article class="pet-card pet-card--${role}" aria-label="${esc(pet.name)}">
    ${petAnim(pet.runtime)}
    <div class="pet-card__info">
      <b class="pet-card__name">${esc(pet.name)}</b>
      <small class="pet-card__meta">${FORM_NAMES[pet.form] ?? pet.form} · Lv.${pet.level} · ${TIER_NAMES[pet.tier] ?? pet.tier}</small>
      <p class="pet-card__line">${esc(pet.activeLine)}</p>
      <p class="pet-card__line">${esc(pet.passiveLine)}</p>
      <div class="pet-card__element">${esc(ELEMENT_NAMES[pet.element] ?? pet.element)}</div>
    </div>
    <div class="pet-card__flows" role="group" aria-label="流派">
      ${flowBtns}
    </div>
    ${buttonHtml('撤下', {action: 'pet-remove', id: pet.family, variant: 'secondary', size: 'compact', disabled: busy})}
  </article>`;
}

function slotHtml(label: string, pet: PetView | null, role: 'active' | 'support', busy: boolean): string {
  if (!pet) {
    return `<div class="pet-slot pet-slot--empty pet-slot--${role}" aria-label="${esc(label)}">
      <span class="pet-slot__label">${esc(label)}</span>
      <p class="pet-slot__hint">从下方列表选择</p>
    </div>`;
  }
  return `<div class="pet-slot pet-slot--filled pet-slot--${role}" aria-label="${esc(label)}">${petCardHtml(pet, role, busy)}</div>`;
}

function catalogEntryHtml(entry: PetCatalogEntry, owned: PetView[]): string {
  const ownedPet = owned.find(p => p.family === entry.family);
  const badge = statusBadgeHtml(STATUS_NAMES[entry.status], entry.status === 'owned' ? 'success' : 'neutral');
  return `<li class="pet-catalog-entry ${entry.status === 'unavailable' ? 'is-unavailable' : ''}">
    <b>${esc(entry.name)}</b>
    <small>${esc(TIER_NAMES[entry.tier] ?? entry.tier)} · ${esc(entry.source)}</small>
    ${badge}
    ${ownedPet ? `<small>Lv.${ownedPet.level}</small>` : ''}
  </li>`;
}

export function petPanelHtml(view: PetsView, busy: boolean): string {
  const {owned, lineup, catalog} = view;
  const activeOwned = lineup.active ? owned.find(p => p.family === lineup.active) ?? null : null;
  const supportOwned = lineup.support.map(id => owned.find(p => p.family === id)).filter((p): p is PetView => Boolean(p));

  // 阵容区
  const lineupHtml = `<section class="pet-lineup" aria-label="宠物阵容">
    ${sectionTitleHtml('出战阵容')}
    <div class="pet-lineup__grid">
      ${slotHtml('上阵', activeOwned, 'active', busy)}
      <div class="pet-lineup__support">
        ${slotHtml('助阵 1', supportOwned[0] ?? null, 'support', busy)}
        ${slotHtml('助阵 2', supportOwned[1] ?? null, 'support', busy)}
      </div>
    </div>
  </section>`;

  // 已拥有列表（可点击上阵/助阵）
  const ownedHtml = owned.length
    ? `<section class="pet-owned" aria-label="已拥有宠物">
        ${sectionTitleHtml('已拥有', {count: `${owned.length} 只`})}
        <div class="pet-owned__list">
          ${owned.map(p => {
            const inLineup = p.family === lineup.active || lineup.support.includes(p.family);
            const isActive = p.family === lineup.active, isSupport = lineup.support.includes(p.family);
            return `<div class="pet-owned-item${inLineup ? ' is-in-lineup' : ''}">
              ${petAnim(p.runtime)}
              <span class="pet-owned-item__name">${esc(p.name)}</span>
              <span class="pet-owned-item__meta">Lv.${p.level} · ${esc(ELEMENT_NAMES[p.element] ?? p.element)}</span>
              ${inLineup ? statusBadgeHtml(isActive ? '上阵' : '助阵', 'success', {variant: 'inline'}) : ''}
              <span class="pet-owned-item__actions">${isActive ? '' : buttonHtml('上阵', {action: 'pet-set-active', id: p.family, size: 'compact', variant: 'primary', disabled: busy})}${isActive || isSupport ? '' : buttonHtml('助阵', {action: 'pet-set-support', id: p.family, size: 'compact', variant: 'secondary', disabled: busy || lineup.support.length >= 2})}</span>
            </div>`;
          }).join('')}
        </div>
      </section>`
    : stateBlockHtml({kind: 'empty', title: '还没有宠物', message: '完成关口首通可以解锁宠物。'});

  // 图鉴
  const catalogHtml = `<section class="pet-catalog" aria-label="宠物图鉴">
    ${sectionTitleHtml('宠物图鉴')}
    <ul class="pet-catalog__list">
      ${catalog.map(entry => catalogEntryHtml(entry, owned)).join('')}
    </ul>
  </section>`;

  return `<div class="pet-panel">${lineupHtml}${ownedHtml}${catalogHtml}</div>`;
}
