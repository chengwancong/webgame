/**
 * Z3 宠物面板（M17）。
 * 阵容区（1 上阵 + 2 助阵）+ 已拥有列表 + 9 个流派选择 + 图鉴。
 */
import {esc, buttonHtml, sectionTitleHtml, stateBlockHtml, statusBadgeHtml, panelHeaderHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import {hudMenuIcon} from '../hud-icons.ts';
import {petPortraitHtml} from './pet-portrait.ts';
import {petFlows} from '../../../../packages/contracts/zhangjian.ts';
import type {PetsView, PetView} from '../../../../packages/contracts/zhangjian.ts';

type PetCatalogEntry = PetsView['catalog'][number];

/**
 * 向前兼容扩展：保证在 GPT 尚未提交 schema 变更时 HEAD 仍可编译。
 * suitableFor / tradeoff / activeEffect 已在工作区 schema 中（packages/contracts/zhangjian.ts），
 * 此处只提取前端关心的最小子集。
 */
type PetViewExt = PetView & {
  suitableFor?: string;
  tradeoff?: string;
  activeEffect?: {
    kind: 'single' | 'area' | 'shield' | 'chain';
    dealsDamage: boolean;
  };
};

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
const TIER_NAMES: Record<string, string> = {free: '常见', light: '稀有', heavy: '传说'};
const STATUS_NAMES = {owned: '已拥有', locked: '未解锁', unavailable: '暂未开放'} as const;

/** 动作种类中文名。 */
const KIND_NAMES: Record<string, string> = {
  single: '单体', area: '范围', chain: '连锁', shield: '护盾',
};

function petAnim(runtime: string): string {
  return petPortraitHtml(runtime, 'pet-anim');
}

/**
 * 攻击型/辅助型徽章，由 activeEffect.dealsDamage 决定。
 * true→攻击型（暖金）；false→辅助型（浅青）；无 activeEffect→不显示。
 * activeEffect.kind 作为小字后缀：单体/范围/连锁/护盾。
 */
function activeEffectBadgeHtml(activeEffect?: PetViewExt['activeEffect']): string {
  if (!activeEffect) return '';
  const roleLabel = activeEffect.dealsDamage ? '攻击型' : '辅助型';
  const roleCls = activeEffect.dealsDamage ? 'pet-role--attack' : 'pet-role--support';
  const kindLabel = KIND_NAMES[activeEffect.kind] ?? '';
  return `<span class="pet-role-badge ${roleCls}">${roleLabel}<small class="pet-role-badge__kind"> · ${kindLabel}</small></span>`;
}

function petCardHtml(petRaw: PetView, role: 'active' | 'support', busy: boolean): string {
  const pet = petRaw as PetViewExt;
  const flowBtns = petFlows.map(f => buttonHtml(FLOW_NAMES[f] ?? f, {
    action: 'pet-flow', id: `${pet.family}:${f}`, variant: 'secondary', size: 'compact',
    pressed: pet.flow === f, disabled: busy,
  })).join('');

  // 做什么：skillName（有则加粗前缀）+ activeLine；passiveLine 另起"被动"行
  const activePart = pet.skillName
    ? `<b>${esc(pet.skillName)}</b>：${esc(pet.activeLine)}`
    : esc(pet.activeLine);
  const passivePart = `<span class="pet-card__label">被动</span>${esc(pet.passiveLine)}`;

  // combatRole / flavor 作小字说明（有则显示，无则隐藏）
  const descPart = (pet.combatRole || pet.flavor)
    ? `<p class="pet-card__desc">${esc((pet.combatRole ?? '') + (pet.combatRole && pet.flavor ? ' · ' : '') + (pet.flavor ?? ''))}</p>`
    : '';

  // 适合哪里 / 代价（仅当字段存在时显示，整行隐藏）
  const bestPart = pet.suitableFor
    ? `<p class="pet-card__best"><span class="pet-card__label">适合</span>${esc(pet.suitableFor)}</p>`
    : '';
  const costPart = pet.tradeoff
    ? `<p class="pet-card__cost"><span class="pet-card__label">代价</span>${esc(pet.tradeoff)}</p>`
    : '';

  return `<article class="pet-card pet-card--${role}" aria-label="${esc(pet.name)}">
    ${petAnim(pet.runtime)}
    <div class="pet-card__info">
      <div class="pet-card__name-row">
        <b class="pet-card__name">${esc(pet.name)}</b>
        ${activeEffectBadgeHtml(pet.activeEffect)}
      </div>
      <small class="pet-card__meta">${FORM_NAMES[pet.form] ?? pet.form} · Lv.${pet.level} · ${TIER_NAMES[pet.tier] ?? pet.tier}</small>
      <p class="pet-card__line">${activePart}</p>
      <p class="pet-card__line pet-card__line--passive">${passivePart}</p>
      ${descPart}
      ${bestPart}
      ${costPart}
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
  return `<li class="pet-catalog-entry is-${entry.status}">
    ${petPortraitHtml(`ss-pet-${entry.family}-young`, 'pet-catalog-entry__portrait')}
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

  // 主角卡：当前上阵宠物信息
  const activeName = activeOwned?.name ?? '（空）';
  const activeLevel = activeOwned ? `Lv.${activeOwned.level}` : '';
  const activeElem = activeOwned ? (ELEMENT_NAMES[activeOwned.element] ?? activeOwned.element) : '';
  const heroCard = `<div class="hub-hero-card">
    <div class="hub-hero-card__band">${iconHtml('star', {size: 20})}<h3 class="hub-hero-card__title">出战阵容</h3></div>
    <div class="hub-hero-card__body">
      ${activeOwned ? `<span class="pet-hero__anim">${petAnim(activeOwned.runtime)}</span>` : ''}
      <div class="pet-hero__info">
        <b class="hub-hero-card__big" style="font-size:var(--font-size-h2)">${esc(activeName)}</b>
        ${activeOwned ? `<span class="hub-hero-card__sub">${esc(activeLevel)} · ${esc(activeElem)}</span>` : '<span class="hub-hero-card__sub">从下方列表选择宠物上阵</span>'}
        <span class="hub-hero-card__sub">助阵 ${supportOwned.length} / 2</span>
      </div>
    </div>
  </div>`;

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

  // 已拥有列表：只有第一个未上阵的宠物用 primary 上阵按钮（每屏最多 1 个主按钮）
  let hasPrimaryActive = false;
  const ownedHtml = owned.length
    ? `<section class="pet-owned" aria-label="已拥有宠物">
        ${sectionTitleHtml('已拥有', {count: `${owned.length} 只`})}
        <div class="pet-owned__list">
          ${owned.map(p => {
            const inLineup = p.family === lineup.active || lineup.support.includes(p.family);
            const isActive = p.family === lineup.active, isSupport = lineup.support.includes(p.family);
            const pext = p as PetViewExt;
            const canSetActive = !inLineup && !hasPrimaryActive;
            const activeVariant = canSetActive ? 'primary' : 'secondary';
            if (!inLineup) hasPrimaryActive = true;
            return `<div class="hub-card-row pet-owned-item${inLineup ? ' is-in-lineup' : ''}">
              <span class="hub-card-row__icon pet-owned-item__portrait">${petAnim(p.runtime)}</span>
              <div class="hub-card-row__content">
                <span class="hub-card-row__title pet-owned-item__name">${esc(p.name)}${activeEffectBadgeHtml(pext.activeEffect)}${inLineup ? statusBadgeHtml(isActive ? '上阵' : '助阵', 'success', {variant: 'inline'}) : ''}</span>
                <span class="hub-card-row__sub pet-owned-item__meta">Lv.${p.level} · ${esc(ELEMENT_NAMES[p.element] ?? p.element)} · ${esc(TIER_NAMES[p.tier] ?? p.tier)}</span>
              </div>
              <span class="hub-card-row__actions">${isActive ? '' : buttonHtml('上阵', {action: 'pet-set-active', id: p.family, size: 'compact', variant: activeVariant, disabled: busy})}${isActive || isSupport ? '' : buttonHtml('助阵', {action: 'pet-set-support', id: p.family, size: 'compact', variant: 'secondary', disabled: busy || lineup.support.length >= 2})}</span>
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

  return `<section class="panel pet-panel-wrap" data-panel="pet" role="dialog" aria-modal="true" aria-label="宠物">
    ${panelHeaderHtml('宠物', {closeLabel: '关闭宠物', closeAction: 'pet-close', emblemHtml: hudMenuIcon('pets')})}
    ${heroCard}
    <div class="pet-panel">${lineupHtml}${ownedHtml}${catalogHtml}</div>
  </section>`;
}
