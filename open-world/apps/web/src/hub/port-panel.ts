/**
 * U9 港口建设面板（方案 B「左列建筑 · 右侧详情」）。
 * 左列 5 项（工坊 / 船台 / 邮局 · n 阶、收藏、强度系统），有可领取阶级的建筑带红点；
 * 右侧是固定尺寸的详情区，内容放不下时靠版面压缩而不是滚动。
 */
import {esc,buttonHtml,panelHeaderHtml,stateBlockHtml,statusBadgeHtml,tabsHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import {hudMenuIcon} from '../hud-icons.ts';
import {meterHtml} from '../ui/graphics.ts';
import {art} from '../ui-assets.ts';
import type {HubPortView as PortView} from '../../../../packages/contracts/hub.ts';

type PortBuilding = PortView['buildings'][number];

/** ART-HC port-build 图集 1520×424 */
const _PB_SRC='/art/hub-ui/port-build.png',_PB_W=1520,_PB_H=424;
/** build-card 帧（480×320）；建筑 id → [fx,fy] */
const _CARD_FRAMES:Record<string,[number,number]>={forge:[2,2],shipyard:[486,2],post:[970,2]};
/** build-tier 帧（64×64）；1-based index */
const _TIER_FRAMES:Record<number,[number,number]>={1:[1454,2],2:[2,326],3:[70,326],4:[138,326]};
/** collect 帧（96×96） */
const _COLLECT_FRAMES:Record<string,[number,number]>={life:[206,326],star:[306,326]};
/** 建筑声望图标（ui.v2 单图，item-rep-forge/dock/post） */
const _REP_ICON:Record<string,string>={forge:'item-rep-forge',shipyard:'item-rep-dock',post:'item-rep-post'};
function buildRepIcon(id:string):string{const key=_REP_ICON[id];return key?`<img src="${art(key)}" alt="" class="hub-port-rep-icon" draggable="false" loading="lazy">`:'';}

function _pbSprite(fx:number,fy:number,fw:number,fh:number,dw:number,dh:number):string{
 const s=dw/fw,bw=Math.round(_PB_W*s),bh=Math.round(_PB_H*s);
 return `<span aria-hidden="true" class="tp-icon" data-pixel-atlas="${_PB_SRC}" data-pixel-rect="${fx},${fy},${fw},${fh}" style="width:${dw}px;height:${dh}px;background:url(${_PB_SRC}) ${-Math.round(fx*s)}px ${-Math.round(fy*s)}px/${bw}px ${bh}px no-repeat"></span>`;
}
/** 建筑近景图（480×320 → 120×80） */
function buildCardImg(id:string):string{const f=_CARD_FRAMES[id];return f?_pbSprite(f[0],f[1],480,320,120,80):'';}
/** 阶级徽章（64×64 → 24×24） */
function buildTierBadge(tier:number):string{const f=_TIER_FRAMES[tier];return f?_pbSprite(f[0],f[1],64,64,24,24):'';}
/** 收藏品图标（96×96 → 24×24） */
function collectItemIcon(kind:'life'|'star'):string{const f=_COLLECT_FRAMES[kind];return f?_pbSprite(f[0],f[1],96,96,24,24):'';}


export type PortSection = 'collectibles' | 'systems' | PortBuilding['id'];

export type PortPanelState = {
  view: PortView;
  selected: string;
  /** 正在领取的 `${building}:${tier}`；非空时所有领取按钮禁用 */
  busyKey: string;
  message: string;
  messageTone: 'success' | 'error';
};

export const hasClaimable = (b: PortBuilding) => b.tiers.some(t => t.claimable && !t.claimed);
/** 已达成的阶数 = 已领 + 可领（由服务端标记，客户端不拿声望去比门槛） */
export const tiersReached = (b: PortBuilding) => b.tiers.filter(t => t.claimed || t.claimable).length;
/** 声望条的目标：第一个还没领的阶的门槛；全部领完则取最高门槛 */
export function repTarget(b: PortBuilding): number {
  const next = b.tiers.find(t => !t.claimed);
  return next?.threshold ?? b.tiers[b.tiers.length - 1]?.threshold ?? 0;
}

function tierRow(b: PortBuilding, t: PortBuilding['tiers'][number], busyKey: string): string {
  const key = `${b.id}:${t.tier}`;
  let action: string;
  let cls = 'is-locked';
  if (t.claimed) {
    cls = 'is-claimed';
    action = statusBadgeHtml('已领取', 'success', {iconHtml: iconHtml('check', {size: 16})});
  } else if (t.claimable) {
    cls = 'is-claimable';
    action = buttonHtml('领取', {action: 'hub-port-claim', id: key, variant: 'primary', size: 'compact', busy: busyKey === key, busyLabel: '正在领取…', disabled: Boolean(busyKey) && busyKey !== key});
  } else {
    action = statusBadgeHtml('声望不足', 'neutral');
  }
  return `<li class="hub-tier ${cls}">
    <span class="hub-tier__index">${buildTierBadge(t.tier)}<b>第 ${t.tier} 阶</b></span>
    <span class="hub-tier__need">声望 ${t.threshold}</span>
    <span class="hub-tier__rewards">${esc(t.rewards.join('、'))}</span>
    <span class="hub-tier__action">${action}</span>
  </li>`;
}

function buildingDetail(b: PortBuilding, busyKey: string): string {
  const target = repTarget(b);
  const cardImg = buildCardImg(b.id);
  // 主角卡：建筑插画放大 + 名称标题 + 声望进度
  const heroCard = `<div class="hub-hero-card hub-port-detail__hero">
    <div class="hub-hero-card__band">${cardImg ? `<div class="hub-port-detail__card-lg">${_pbSprite(_CARD_FRAMES[b.id]?.[0] ?? 0, _CARD_FRAMES[b.id]?.[1] ?? 0, 480, 320, 200, 134)}</div>` : ''}
      <div class="hub-port-detail__head-text"><h3 class="hub-hero-card__title">${buildRepIcon(b.id)}${esc(b.name)}</h3><span class="hub-port-detail__npc">${esc(b.npc)}</span></div>
    </div>
    <div class="hub-hero-card__body hub-port-rep-body">
      <span class="hub-port-rep__label">${iconHtml('star', {size: 16})}声望 <b class="ui-number">${b.rep}</b> / ${target}</span>
      <div class="hub-port-rep__bar">${meterHtml({value: b.rep, max: target, label: `${b.name}声望`, valueText: 'none'})}</div>
    </div>
  </div>`;
  return `${heroCard}<ol class="hub-tiers">${b.tiers.map(t => tierRow(b, t, busyKey)).join('')}</ol>`;
}

function collectionRow(label: string, owned: number, total: number, cellIcon?: string): string {
  const icon = cellIcon ?? iconHtml('diamond', {size: 24});
  const cells = Array.from({length: total}, (_, i) => `<span class="hub-collect__cell${i < owned ? ' is-owned' : ''}">${icon}</span>`).join('');
  return `<div class="hub-collect"><div class="hub-collect__head"><b>${esc(label)}</b><span class="ui-number">${owned} / ${total}</span></div><div class="hub-collect__cells" role="img" aria-label="${esc(`${label} ${owned} / ${total}`)}">${cells}</div></div>`;
}

function collectiblesDetail(v: PortView): string {
  const {lifeCrystal: lc, starCore: sc} = v.collectibles;
  return `<div class="hub-port-detail__head"><div class="hub-port-detail__head-text"><h3>收藏</h3></div></div>${collectionRow('生命星晶', lc.owned, lc.total, collectItemIcon('life'))}${collectionRow('星核', sc.owned, sc.total, collectItemIcon('star'))}`;
}

function systemsDetail(v: PortView): string {
  const body = v.systems.length
    ? `<ul class="hub-systems">${v.systems.map(s => `<li class="hub-system${s.open ? '' : ' is-locked'}">
        <b>${esc(s.name)}</b>
        ${s.open ? statusBadgeHtml('已开放', 'success') : `<span class="hub-system__reason">${iconHtml('lock', {size: 16})}${esc(s.lockReason ?? '尚未开放')}</span>`}
      </li>`).join('')}</ul>`
    : stateBlockHtml({kind: 'empty', title: '暂无强度系统', message: '后续开放的强度系统会列在这里。', compact: true});
  return `<div class="hub-port-detail__head"><h3>强度系统</h3></div>${body}`;
}

export function portPanelHtml(state: PortPanelState): string {
  const {view, selected, busyKey} = state;
  const lc = view.collectibles?.lifeCrystal;
  const sc = view.collectibles?.starCore;

  const items = [
    ...view.buildings.map(b => ({
      id: b.id as string, label: b.name, count: `${tiersReached(b)} 阶`,
      attributes: hasClaimable(b) ? {'data-actionable': 'true', title: '有可领取的奖励'} : undefined,
    })),
    ...(lc && sc ? [{id: 'collectibles', label: '收藏', count: `${lc.owned + sc.owned}/${lc.total + sc.total}`}] : []),
    {id: 'systems', label: '强度系统', count: view.systems.length ? `${view.systems.filter(s => s.open).length}/${view.systems.length}` : undefined},
  ];
  const active = items.some(i => i.id === selected) ? selected : items[0]?.id ?? '';

  const building = view.buildings.find(b => b.id === active);
  const detail = building ? buildingDetail(building, busyKey)
    : active === 'collectibles' && lc && sc ? collectiblesDetail(view)
    : systemsDetail(view);

  const msg = state.message
    ? `<p class="hub-port-msg is-${state.messageTone}" role="${state.messageTone === 'error' ? 'alert' : 'status'}">${esc(state.message)}</p>`
    : '<p class="hub-port-msg" aria-hidden="true"></p>';

  return `<section class="panel hub-port-panel" data-panel="hub-port" role="dialog" aria-modal="true" aria-label="港口建设" aria-busy="${Boolean(busyKey)}">
  ${panelHeaderHtml('港口建设', {closeLabel: '关闭港口建设', closeAction: 'hub-port-close', closeDisabled: Boolean(busyKey), emblemHtml: hudMenuIcon('port-build')})}
  <div class="hub-port-body">
    ${tabsHtml({label: '港口建设分类', action: 'hub-port-select', selected: active, items, orientation: 'vertical', className: 'hub-port-tabs'})}
    <div class="hub-port-detail" role="tabpanel">${detail}${msg}</div>
  </div>
</section>`;
}
