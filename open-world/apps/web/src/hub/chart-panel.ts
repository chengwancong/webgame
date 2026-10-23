/**
 * U2/U3 航图面板（方案 B「节点旁弹卡」）。
 * 顶部横排航区页签 + 右上海域难度；节点图占满；选中节点后在节点旁弹出固定尺寸的卡片，
 * 卡片放在节点左右两侧、越界时翻到另一侧，绝不压住被选中的节点。
 * 版面按 1280×720 舞台排：图区尺寸是常量，节点坐标和卡片位置都由这些常量算出，面板内不滚动。
 */
import {esc,buttonHtml,panelHeaderHtml,stateBlockHtml,statusBadgeHtml,tabsHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import {art} from '../ui-assets.ts';
import {seaDifficultyHtml} from '../sea-difficulty-view.ts';
import type {ChartView,ChartRegionView,ChartNodeView,NodeKind} from '../../../../packages/contracts/hub.ts';
import type {LoadoutView} from '../../../../packages/contracts/zhangjian.ts';
import {elementHint,elementNames} from '../../../../packages/rules/zhangjian-view.ts';

type ShardStack = ChartView['shards']['owned'][number];

// ---- 图区几何（模板 5 列 × 3 行，见 backend-B0-B4 §3.1） ----
export const GRAPH_W = 1200;
export const GRAPH_H = 480;
export const GRID_COLS = 5;
export const GRID_ROWS = 3;
/** 节点按钮占位（圆盘 + 下方名字）的半宽：卡片从这里之外开始 */
export const NODE_HALF_W = 60;
export const NODE_DISC = 64;
export const CARD_W = 288;
export const CARD_H = 376;
export const CARD_GAP = 12;
export const CARD_EDGE = 8;

export type ChallengePick = '' | 'high' | 'nightmare';

export type ChartPanelState = {
  view: ChartView;
  selectedRegion: string;
  selectedNode: string | null;
  /** 按槽位存放的残页 id，空槽为 '' */
  selectedShards: string[];
  selectedChallenge: ChallengePick;
  /** 正在出发的节点 id；非 null 时整个面板只读 */
  busyNodeId: string | null;
  /** 出发/切海失败的提示，显示在卡片或海域弹层里 */
  message: string;
  seaOpen: boolean;
  seaTierPick: number;
  seaBusy: boolean;
  /** Z1 出战方案：有值时节点卡显示元素克制提示；404 时不显示 */
  loadoutView?: LoadoutView;
};

const KIND_NAMES: Record<NodeKind, string> = {story: '剧情', nest: '巢穴', hunt: '狩猎', tide: '怪潮', treasure: '寻宝', gate: '关口'};
/** ART-HC chart-nodes 图集 500×200；帧 96×96（锚[0.5,0.5]） */
const _CN_SRC='/art/hub-ui/chart-nodes.png',_CN_W=500,_CN_H=200,_CN_FW=96;
const _CN_FRAMES:Record<NodeKind,[number,number]>={story:[2,2],nest:[102,2],hunt:[202,2],tide:[302,2],treasure:[402,2],gate:[2,102]};
const _CN_MARK_COLLECT:[number,number]=[102,102];
const _CN_MARK_HIDDEN:[number,number]=[202,102];
/** 从 chart-nodes 图集裁一帧 */
function cnSprite(fx:number,fy:number,d:number,alt?:string):string{
 const s=d/_CN_FW,bw=Math.round(_CN_W*s),bh=Math.round(_CN_H*s);
 return `<span ${alt?`aria-label="${esc(alt)}"`:' aria-hidden="true"'} class="tp-icon" style="width:${d}px;height:${d}px;background:url(${_CN_SRC}) ${-Math.round(fx*s)}px ${-Math.round(fy*s)}px/${bw}px ${bh}px no-repeat"></span>`;
}
/** ART-HC sea-emblems 图集 924×264；帧 128×128（锚[0.5,0.5]） */
const _SE_SRC='/art/hub-ui/sea-emblems.png',_SE_W=924,_SE_H=264,_SE_FW=128;
const _SE_FRAMES:Record<string,[number,number]>={
 wind:[2,2],mist:[134,2],forge:[266,2],frost:[398,2],rift:[530,2],dragon:[662,2],deep:[794,2],
 'wind-locked':[2,134],'mist-locked':[134,134],'forge-locked':[266,134],'frost-locked':[398,134],'rift-locked':[530,134],'dragon-locked':[662,134],'deep-locked':[794,134],
};
/** 从 sea-emblems 图集裁一帧；locked=true 时取 -locked 变体 */
function seaEmblem(regionId:string,locked:boolean,d:number):string{
 const key=locked?`${regionId}-locked`:regionId;
 const frame=_SE_FRAMES[key]??_SE_FRAMES[regionId];
 if(!frame)return '';
 const s=d/_SE_FW,bw=Math.round(_SE_W*s),bh=Math.round(_SE_H*s);
 return `<span aria-hidden="true" class="tp-icon" style="width:${d}px;height:${d}px;background:url(${_SE_SRC}) ${-Math.round(frame[0]*s)}px ${-Math.round(frame[1]*s)}px/${bw}px ${bh}px no-repeat"></span>`;
}
const STATUS_NAMES = {hidden: '未开放', locked: '未解锁', open: '可挑战', cleared: '已首通'} as const;
const CHALLENGE_NAMES: Record<string, string> = {'': '普通', high: '高难', nightmare: '噩梦'};
const CLOSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 节点圆盘中心（图区坐标）。模板之外的坐标收进网格内，保证不出图区。 */
export function nodeCenter(pos: {col: number; row: number}) {
  const col = clamp(Math.round(pos.col), 0, GRID_COLS - 1);
  const row = clamp(Math.round(pos.row), 0, GRID_ROWS - 1);
  return {x: (col + 0.5) * (GRAPH_W / GRID_COLS), y: (row + 0.5) * (GRAPH_H / GRID_ROWS)};
}

/**
 * 卡片位置：默认贴在节点右侧；右侧放不下（超出图区）就翻到左侧。
 * 纵向以节点为中心，夹在图区内。卡片水平上始终避开节点占位，所以不会盖住被选中的节点。
 */
export function cardPlacement(pos: {col: number; row: number}): {left: number; top: number; side: 'right' | 'left'} {
  const c = nodeCenter(pos);
  const rightLeft = c.x + NODE_HALF_W + CARD_GAP;
  const fitsRight = rightLeft + CARD_W <= GRAPH_W - CARD_EDGE;
  const left = fitsRight ? rightLeft : c.x - NODE_HALF_W - CARD_GAP - CARD_W;
  const top = clamp(c.y - CARD_H / 2, 0, GRAPH_H - CARD_H);
  return {left: Math.round(left), top: Math.round(top), side: fitsRight ? 'right' : 'left'};
}

/** 残页槽循环：空 → 第一种可用残页 → … → 空。同一堆残页不会超过持有数量。 */
export function cycleShard(owned: ShardStack[], picks: string[], slot: number, slots: number): string[] {
  const next = Array.from({length: slots}, (_, i) => picks[i] ?? '');
  if (slot < 0 || slot >= slots) return next;
  const usedElsewhere = (id: string) => next.filter((p, i) => i !== slot && p === id).length;
  const options = owned.filter(s => s.count > usedElsewhere(s.id)).map(s => s.id);
  const current = next[slot];
  const at = current ? options.indexOf(current) : -1;
  next[slot] = at + 1 < options.length ? options[at + 1] : '';
  return next;
}

/** 出发时带的残页：去掉空槽，并丢掉已经不在持有列表里的 id。 */
export function launchShards(owned: ShardStack[], picks: string[], slots: number): string[] {
  const have = new Set(owned.map(s => s.id));
  return picks.slice(0, slots).filter(id => id && have.has(id));
}

const formatBest = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// ---- 节点图 ----

function linksHtml(nodes: ChartNodeView[]): string {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const drawn = new Set<string>();
  const lines: string[] = [];
  for (const n of nodes) {
    for (const linkId of n.links) {
      const other = byId.get(linkId);
      const key = [n.id, linkId].sort().join('|');
      if (!other || drawn.has(key)) continue;
      drawn.add(key);
      const a = nodeCenter(n.pos);
      const b = nodeCenter(other.pos);
      const lit = (n.status === 'open' || n.status === 'cleared') && (other.status === 'open' || other.status === 'cleared');
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="hub-link${lit ? ' is-lit' : ''}"/>`);
    }
  }
  return `<svg class="hub-links" width="${GRAPH_W}" height="${GRAPH_H}" viewBox="0 0 ${GRAPH_W} ${GRAPH_H}" aria-hidden="true" focusable="false">${lines.join('')}</svg>`;
}

function nodeHtml(n: ChartNodeView, selectedId: string | null, interactive: boolean): string {
  const c = nodeCenter(n.pos);
  const hidden = n.status === 'hidden';
  const selected = n.id === selectedId;
  const cls = ['hub-node', `is-${n.status}`, n.recommended && !hidden ? 'is-recommended' : '', selected ? 'is-selected' : ''].filter(Boolean).join(' ');
  const name = hidden ? '？' : n.name;
  const disc = hidden ? cnSprite(..._CN_MARK_HIDDEN,24) : cnSprite(..._CN_FRAMES[n.kind],24);
  const corner: string[] = [];
  if (!hidden && n.status !== 'locked' && n.firstClearBonusAvailable) corner.push('<span class="hub-node__x2">首通 ×2</span>');
  if (!hidden && n.collectible && !n.collectible.owned) corner.push(`<span class="hub-node__collect" title="藏有收藏品">${cnSprite(..._CN_MARK_COLLECT,16,'藏有收藏品')}</span>`);
  const state = n.status === 'cleared' ? `<span class="hub-node__state">${iconHtml('check', {size: 16})}</span>` : n.status === 'locked' ? `<span class="hub-node__state">${iconHtml('lock', {size: 16})}</span>` : '';
  const label = hidden ? `未开放，${KIND_NAMES[n.kind]}` : `${n.name}，${KIND_NAMES[n.kind]}，${STATUS_NAMES[n.status]}${n.recommended ? '，推荐' : ''}`;
  return `<button type="button" class="${cls}" style="left:${c.x - NODE_HALF_W}px;top:${c.y - NODE_DISC / 2}px" data-action="hub-node-select" data-id="${esc(n.id)}" data-kind="${n.kind}" aria-label="${esc(label)}" aria-pressed="${selected}" aria-haspopup="dialog"${hidden || !interactive ? ' disabled' : ''}>
    <span class="hub-node__disc">${disc}${state}</span>
    <span class="hub-node__label">${esc(name)}</span>
    ${corner.length ? `<span class="hub-node__corner">${corner.join('')}</span>` : ''}
  </button>`;
}

// ---- 节点卡片 ----

function shardRowHtml(n: ChartNodeView, view: ChartView, picks: string[]): string {
  if (n.shardSlots <= 0) return '';
  const owned = view.shards.owned;
  const slots = Array.from({length: n.shardSlots}, (_, i) => {
    const chosen = picks[i] ? owned.find(s => s.id === picks[i]) : undefined;
    const title = chosen ? `${chosen.name}：${chosen.effect}` : owned.length ? '空槽，点击放入残页' : '没有可用的残页';
    const shardArtId=chosen?'item-shard-'+chosen.id.replace('hub-shard-',''):'item-shard-blank';
    const shardImg=`<img src="${art(shardArtId)}" alt="" draggable="false" loading="lazy" class="hub-shard__icon">`;
    return `<button type="button" class="hub-shard${chosen ? ' is-filled' : ''}" data-action="hub-shard-slot" data-id="${i}" title="${esc(title)}" aria-label="${esc(`残页槽 ${i + 1}：${chosen ? chosen.name : '空'}`)}"${owned.length ? '' : ' disabled'}>${shardImg}${chosen ? esc(chosen.name) : '空槽'}</button>`;
  });
  return `<div class="hub-card__row"><span class="hub-card__key">残页</span><div class="hub-shards">${slots.join('')}</div></div>`;
}

function challengeRowHtml(n: ChartNodeView, pick: ChallengePick): string {
  if (!n.challenges.length) return '';
  const options: ChallengePick[] = ['', ...n.challenges];
  const buttons = options.map(o => buttonHtml(CHALLENGE_NAMES[o], {action: 'hub-challenge-pick', id: o || 'normal', variant: 'secondary', size: 'compact', pressed: pick === o}));
  return `<div class="hub-card__row"><span class="hub-card__key">档位</span><div class="hub-challenges" role="group" aria-label="挑战档位">${buttons.join('')}</div></div>`;
}

/** Z1 元素行：敌人主要伤害 + 弱点 + 方案切换提示。loadoutView 缺失时静默不显示。 */
function elementRowHtml(n: ChartNodeView, loadoutView?: LoadoutView): string {
  if (!n.elements) return '';
  const {threat, weakness} = n.elements;
  const threatName = elementNames[threat] ?? threat;
  const weakName = elementNames[weakness] ?? weakness;
  const hint = loadoutView ? elementHint(n.elements, loadoutView) : null;
  const hintHtml = hint
    ? `<span class="hub-card__element-hint">${esc(hint.text)}${hint.switchTo !== undefined ? buttonHtml('切换', {action: 'hub-loadout-apply', id: String(hint.switchTo), size: 'compact', variant: 'secondary', className: 'hub-card__switch-btn'}) : ''}</span>`
    : '';
  return `<div class="hub-card__row hub-card__row--elements">
    <span class="hub-card__key">敌人</span>
    <span class="hub-card__element-info">多用 <b>${esc(threatName)}</b> · 弱 <b>${esc(weakName)}</b></span>
    ${hintHtml}
  </div>`;
}

/** Z4 秘藏行（cache 字段由服务端按节点填充）。 */
function cacheRowHtml(n: ChartNodeView): string {
  if (!n.cache) return '';
  const status = n.cache.found ? '已找到' : '未找到';
  const cls = n.cache.found ? 'is-found' : '';
  return `<div class="hub-card__row hub-card__row--cache ${cls}">
    <span class="hub-card__key">秘藏</span>
    <img class="hub-card__key-icon${n.cache.found ? '' : ' is-dim'}" src="/art/hub-ui/explore/icon-cache.png" alt="">
    <span>${esc(status)}</span>
  </div>`;
}

/** Z4 锁门行（door 字段由服务端按节点填充）。 */
function doorRowHtml(n: ChartNodeView): string {
  if (!n.door) return '';
  const {keyName, keyOwned, opened} = n.door;
  const statusText = opened ? '已开启' : keyOwned ? `已获得 ${keyName}` : `需要 ${keyName}（未获得）`;
  const cls = opened ? 'is-opened' : keyOwned ? 'is-ready' : 'is-locked';
  return `<div class="hub-card__row hub-card__row--door ${cls}">
    <span class="hub-card__key">锁门</span>
    <img class="hub-card__key-icon" src="/art/hub-ui/keys/key-${esc(n.door.key)}${keyOwned || opened ? '' : '-locked'}.png" alt="">
    <span>${esc(statusText)}</span>
  </div>`;
}

export function nodeCardHtml(n: ChartNodeView, state: ChartPanelState): string {
  const place = cardPlacement(n.pos);
  const busy = state.busyNodeId === n.id;
  const header = `<div class="hub-card__head">
    <span class="hub-card__kind">${cnSprite(..._CN_FRAMES[n.kind],16)}${KIND_NAMES[n.kind]}</span>
    <b class="hub-card__name">${esc(n.name)}</b>
    ${buttonHtml('关闭节点卡片', {action: 'hub-node-deselect', size: 'icon', iconHtml: CLOSE_ICON, className: 'close', disabled: Boolean(state.busyNodeId)})}
  </div>`;

  let body: string;
  if (n.status === 'locked') {
    body = `<p class="hub-card__line">${esc(n.line)}</p>
      <p class="hub-card__lock">${iconHtml('lock', {size: 16})}<span>${esc(n.lockReason ?? '尚未解锁')}</span></p>`;
  } else {
    const first = n.firstClearDone
      ? `<p class="hub-card__first is-done">${iconHtml('check', {size: 16})}已首通</p>`
      : n.firstClearReward.length
        ? `<p class="hub-card__first"><span class="hub-card__key">首通</span>${esc(n.firstClearReward.join('、'))}</p>`
        : '';
    const bonus = n.firstClearBonusAvailable ? statusBadgeHtml('今日首通 ×2', 'warning') : '';
    const best = n.best ? `<span class="hub-card__best">最好成绩 ${formatBest(n.best.seconds)}</span>` : '';
    const departLabel = state.view.bagFull ? '背包已满，先回港整理' : '出发';
    const depart = buttonHtml(departLabel, {
      action: 'hub-node-go', id: n.id, variant: 'primary', busy,
      busyLabel: '正在出发…', disabled: state.view.bagFull || Boolean(state.busyNodeId) && !busy,
    });
    body = `<p class="hub-card__line">${esc(n.line)}</p>
      <p class="hub-card__meta">推荐 Lv.${n.recommendedLevel} · 预计 ${n.estimatedMinutes[0]}–${n.estimatedMinutes[1]} 分钟</p>
      <p class="hub-card__drop">${esc(n.publicDropNote)}</p>
      ${first}
      <div class="hub-card__badges">${bonus}${best}</div>
      ${elementRowHtml(n, state.loadoutView)}
      ${cacheRowHtml(n)}
      ${doorRowHtml(n)}
      ${shardRowHtml(n, state.view, state.selectedShards)}
      ${challengeRowHtml(n, state.selectedChallenge)}
      <div class="hub-card__foot">
        ${state.message ? `<p class="hub-card__error" role="alert">${esc(state.message)}</p>` : ''}
        ${depart}
      </div>`;
  }
  return `<section class="hub-card" data-side="${place.side}" data-node-card="${esc(n.id)}" role="dialog" aria-label="${esc(n.name)}" aria-busy="${busy}" style="left:${place.left}px;top:${place.top}px;width:${CARD_W}px;height:${CARD_H}px">${header}<div class="hub-card__body">${body}</div></section>`;
}

// ---- Z4 探索圆环（ART-HF A32 分层图：底框 + 三段整圈弧用 conic 遮罩裁出） ----
const EXPLORE_ART = '/art/hub-ui/explore/';
type ExploreView = NonNullable<ChartRegionView['explore']>;
/** 三段弧的角度：按分值（锁门分值由总分反推，不在前端写死点数）依次接续。 */
export function exploreArcs(e: ExploreView): {kind: 'nodes' | 'caches' | 'doors'; from: number; to: number}[] {
  const [n, nt] = e.parts.nodes, [c, ct] = e.parts.caches, [d, dt] = e.parts.doors;
  if (!e.total) return [];
  const nodeW = 1, cacheW = 1, doorW = dt ? Math.max(0, (e.total - nt * nodeW - ct * cacheW) / dt) : 0;
  const out: {kind: 'nodes' | 'caches' | 'doors'; from: number; to: number}[] = [];
  let at = 0;
  for (const [kind, got, w] of [['nodes', n, nodeW], ['caches', c, cacheW], ['doors', d, doorW]] as const) {
    const span = got * w * 360 / e.total;
    if (span > 0) out.push({kind, from: at, to: at + span});
    at += span;
  }
  return out;
}
const arcMask = (from: number, to: number) => {
  const g = `conic-gradient(transparent 0deg ${from}deg,#000 ${from}deg ${to}deg,transparent ${to}deg)`;
  return `-webkit-mask-image:${g};mask-image:${g}`;
};
export function exploreDetail(e: ExploreView): string {
  const lines = [`探索 ${e.percent}%（${e.score}/${e.total}）`, `节点 ${e.parts.nodes[0]}/${e.parts.nodes[1]} · 秘藏 ${e.parts.caches[0]}/${e.parts.caches[1]} · 锁门 ${e.parts.doors[0]}/${e.parts.doors[1]}`];
  if (e.lockedByKey) lines.push(`还有 ${e.lockedByKey} 处锁门要别的航区钥匙`);
  if (e.dockBonus) lines.push(`码头收益 +${Math.round(e.dockBonus * 100)}%`);
  return lines.join('\n');
}

// ---- 顶栏 ----

function regionTabsHtml(view: ChartView, region: ChartRegionView | undefined, busy: boolean): string {
  const items = view.regions.map(r => {
    // Z4 探索圆环：三段拆色，里程碑 50/100 星点
    let exploreMarkHtml = '';
    if (r.explore) {
      const {percent, milestones} = r.explore;
      const stars = milestones.map(m =>
        `<img class="hub-explore-star" src="${EXPLORE_ART}ring-star-${m.reached ? 'on' : 'off'}.png" alt="" title="${esc(m.percent + '%：' + m.reward)}">`
      ).join('');
      const arcs = exploreArcs(r.explore).map(a => `<img class="hub-explore-ring__arc" src="${EXPLORE_ART}ring-arc-${a.kind}.png" alt="" style="${arcMask(a.from, a.to)}">`).join('');
      exploreMarkHtml = `<span class="hub-explore-badge" aria-label="探索 ${percent}%" title="${esc(exploreDetail(r.explore))}">
        <span class="hub-explore-ring"><img class="hub-explore-ring__base" src="${EXPLORE_ART}ring-base.png" alt="">${arcs}</span>
        <span class="hub-explore-badge__pct">${percent}%</span>${stars}
      </span>`;
    }
    return {
      id: r.id,
      label: r.name,
      iconHtml: seaEmblem(r.id, r.status === 'locked', 24), // 航区徽记；-locked 变体自带灰雾态
      count: r.status === 'locked' ? undefined : `Lv.${r.levelRange[0]}–${r.levelRange[1]}`,
      markHtml: exploreMarkHtml,
      attributes: r.status === 'locked' && r.lockReason ? {title: r.lockReason} : undefined,
      disabled: busy,
    };
  });
  return tabsHtml({label: '航区', action: 'hub-region-select', selected: region?.id ?? '', items, className: 'hub-region-tabs'});
}

function seaHtml(state: ChartPanelState): string {
  const {view} = state;
  const choices = view.seaTier?.choices ?? [];
  if (!choices.length) return '';
  const current = choices.find(t => t.tier === view.seaTier.current);
  const toggle = buttonHtml(`海域难度 · ${current?.name ?? view.seaTier.current}`, {
    action: 'hub-sea-toggle', variant: 'secondary', size: 'compact', pressed: state.seaOpen,
    disabled: Boolean(state.busyNodeId), attributes: {'aria-expanded': state.seaOpen, 'aria-controls': 'hub-sea-pop'},
  });
  const pop = state.seaOpen
    ? `<div class="hub-sea-pop" id="hub-sea-pop" role="dialog" aria-label="海域难度">
        ${seaDifficultyHtml({current: view.seaTier.current, canSwitch: true, tiers: choices}, state.seaTierPick || view.seaTier.current, state.seaBusy)}
        ${state.message ? `<p class="hub-card__error" role="alert">${esc(state.message)}</p>` : ''}
      </div>`
    : '';
  return `<div class="hub-chart-sea">${toggle}${pop}</div>`;
}

function gateQuestHtml(region: ChartRegionView | undefined): string {
  const quests = region?.gateQuest ?? [];
  if (!quests.length) return '<footer class="hub-gate-quests" aria-hidden="true"></footer>';
  return `<footer class="hub-gate-quests" aria-label="关口任务"><b>关口任务</b>${quests.map(q => `<span class="hub-gate-quest${q.done ? ' is-done' : ''}">${q.done ? iconHtml('check', {size: 16}) : '<i class="hub-gate-quest__dot" aria-hidden="true"></i>'}${esc(q.text)}</span>`).join('')}</footer>`;
}

/** 渲染航图面板。调用者拥有状态，面板只负责输出 HTML。 */
export function chartPanelHtml(state: ChartPanelState): string {
  const {view} = state;
  const region = view.regions.find(r => r.id === state.selectedRegion) ?? view.regions[0];
  const busy = Boolean(state.busyNodeId);
  const nodes = region?.status === 'locked' ? [] : region?.nodes ?? [];
  const selected = nodes.find(n => n.id === state.selectedNode && n.status !== 'hidden');

  let stage: string;
  if (!region) {
    stage = stateBlockHtml({kind: 'empty', title: '还没有航区', message: '航图上暂时没有可显示的航区。'});
  } else if (region.status === 'locked') {
    stage = stateBlockHtml({kind: 'empty', title: `${region.name} 尚未开放`, message: region.lockReason ?? '完成前一个航区的关口后开放。'});
  } else {
    // chart-bg：航区底图；pointer-events:none，排在最底层
    const bgSrc=`/art/hub-ui/chart-bg-${region.id}.webp`;
    stage = `<div class="hub-graph" style="width:${GRAPH_W}px;height:${GRAPH_H}px">
      <img class="hub-chart-bg" src="${bgSrc}" alt="" aria-hidden="true">
      ${linksHtml(nodes)}
      ${nodes.map(n => nodeHtml(n, selected?.id ?? null, !busy)).join('')}
      ${selected ? nodeCardHtml(selected, state) : ''}
    </div>`;
  }

  return `<section class="panel hub-chart-panel" data-panel="hub-chart" role="dialog" aria-modal="true" aria-label="航图" aria-busy="${busy}">
  ${panelHeaderHtml('航图', {closeLabel: '关闭航图', closeAction: 'hub-chart-close', closeDisabled: busy, iconHtml: iconHtml('compass', {size: 24})})}
  <div class="hub-chart-topbar">${regionTabsHtml(view, region, busy)}${seaHtml(state)}</div>
  <div class="hub-chart-stage">${stage}</div>
  ${gateQuestHtml(region)}
</section>`;
}
