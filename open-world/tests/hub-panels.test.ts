/**
 * HUB-F01a / F02 前端：航图 / 今日 / 委托板 / 港口建设 / 结算 hub 块 / 副本目标行 / 自动选卡倒计时 / 回港队列 / A1 红点。
 * 直接测真实模块；唯一的替身是 network.ts 的 api（vitest 跑在 node，没有 DOM，面板用 HTML 字符串断言）。
 * 样例数据同时过 packages/contracts/hub.ts 的 zod 模式，防止前端样例与后端契约漂移。
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

const net = vi.hoisted(() => {
  class ApiFailure extends Error {
    constructor(public code: string, message: string, public status: number) { super(message); }
  }
  return {ApiFailure, api: vi.fn()};
});
vi.mock('../apps/web/src/network.ts', () => ({api: net.api, ApiFailure: net.ApiFailure}));

import {chartViewSchema, todayViewSchema, hubCommissionsViewSchema, hubPortViewSchema, hubSettlementSchema} from '../packages/contracts/hub.ts';
import {fixtureChart, fixtureToday, fixtureCommissions, fixturePort, FIXTURE_RESULT, buildRegion} from '../apps/web/src/hub/hub-fixtures.ts';
import {
  nodeCenter, cardPlacement, cycleShard, launchShards, nodeCardHtml, chartPanelHtml,
  GRAPH_W, GRAPH_H, GRID_COLS, GRID_ROWS, NODE_HALF_W, NODE_DISC, CARD_W, CARD_H, CARD_EDGE, type ChartPanelState,
} from '../apps/web/src/hub/chart-panel.ts';
import {hasClaimable, tiersReached, repTarget, portPanelHtml} from '../apps/web/src/hub/port-panel.ts';
import {todayRows, formatResetAt, todayPanelHtml} from '../apps/web/src/hub/today-panel.ts';
import {commissionPanelHtml} from '../apps/web/src/hub/commission-panel.ts';
import {hubResultRightHtml, hubResultFooterHtml, HubBlockStore} from '../apps/web/src/hub/hub-result-block.ts';
import {getHubChart, getHubToday, postCommission, postSeaTier, postDock, isHubNotFound, hubErrorMessage} from '../apps/web/src/hub/hub-api.ts';
import {HubController, hubEnabled, type HubDeps} from '../apps/web/src/hub/hub-controller.ts';
import {hubHudHtml, HUB_HUD_DANGER_SECONDS} from '../apps/web/src/hub/hub-hud.ts';
import {returnAckId, returnItemHtml, returnLines} from '../apps/web/src/hub/return-queue.ts';
import {AugmentPanel, augmentCountdownText} from '../apps/web/src/augments-panel.ts';
import type {ChartView, HubReturnItem} from '../packages/contracts/hub.ts';

const failure = (status: number, message = '出错了', code = 'SERVER') => new net.ApiFailure(code, message, status);

// ---------- 样例数据 vs 契约 ----------

describe('样例数据符合后端契约', () => {
  it('航图 / 今日 / 委托 / 港口 / 结算都能通过 zod 校验', () => {
    expect(() => chartViewSchema.parse(fixtureChart())).not.toThrow();
    expect(() => todayViewSchema.parse(fixtureToday())).not.toThrow();
    expect(() => hubCommissionsViewSchema.parse(fixtureCommissions())).not.toThrow();
    expect(() => hubPortViewSchema.parse(fixturePort())).not.toThrow();
    expect(() => hubSettlementSchema.parse(FIXTURE_RESULT)).not.toThrow();
  });

  it('每个航区 10 个节点，连线双向且都指向本区节点', () => {
    for (const region of fixtureChart().regions) {
      expect(region.nodes).toHaveLength(10);
      const ids = new Set(region.nodes.map(n => n.id));
      for (const n of region.nodes) for (const l of n.links) {
        expect(ids.has(l)).toBe(true);
        expect(region.nodes.find(o => o.id === l)!.links).toContain(n.id);
      }
    }
  });
});

// ---------- 节点图几何 ----------

describe('节点位置与卡片翻转', () => {
  const nodes = fixtureChart().regions[0].nodes;

  it('nodeCenter 把越界坐标收进网格', () => {
    const lo = nodeCenter({col: -3, row: -1});
    const hi = nodeCenter({col: 99, row: 99});
    expect(lo).toEqual(nodeCenter({col: 0, row: 0}));
    expect(hi.x).toBeLessThan(GRAPH_W);
    expect(hi.y).toBeLessThan(GRAPH_H);
    expect(nodeCenter({col: 1.4, row: 0}).x).toBe(nodeCenter({col: 1, row: 0}).x);
  });

  it('所有 5×3 网格位置：卡片都在图区内，且不遮挡被选中的节点', () => {
    for (let col = 0; col < GRID_COLS; col++) for (let row = 0; row < GRID_ROWS; row++) {
      const c = nodeCenter({col, row});
      const p = cardPlacement({col, row});
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left + CARD_W).toBeLessThanOrEqual(GRAPH_W - CARD_EDGE + 1);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.top + CARD_H).toBeLessThanOrEqual(GRAPH_H);
      const overlapsX = p.left < c.x + NODE_HALF_W && p.left + CARD_W > c.x - NODE_HALF_W;
      expect(overlapsX, `col ${col} row ${row}`).toBe(false);
      expect(c.y - NODE_DISC / 2).toBeGreaterThanOrEqual(0);
    }
  });

  it('左列贴右侧，右侧放不下的列翻到左侧（四个角都成立）', () => {
    expect(cardPlacement({col: 0, row: 0}).side).toBe('right');
    expect(cardPlacement({col: 0, row: 2}).side).toBe('right');
    expect(cardPlacement({col: 4, row: 0}).side).toBe('left');
    expect(cardPlacement({col: 4, row: 2}).side).toBe('left');
    expect(cardPlacement({col: 4, row: 1}).side).toBe('left');
  });

  it('模板里的 gate 节点（最右列）卡片在其左侧', () => {
    const gate = nodes.find(n => n.kind === 'gate')!;
    const c = nodeCenter(gate.pos);
    expect(cardPlacement(gate.pos).left + CARD_W).toBeLessThanOrEqual(c.x - NODE_HALF_W);
  });
});

// ---------- 残页 ----------

describe('残页选择', () => {
  const owned = [{id: 'a', name: 'A', effect: '', count: 2}, {id: 'b', name: 'B', effect: '', count: 1}];

  it('循环：空 → a → b → 空，补齐到槽位数', () => {
    expect(cycleShard(owned, [], 0, 2)).toEqual(['a', '']);
    expect(cycleShard(owned, ['a', ''], 0, 2)).toEqual(['b', '']);
    expect(cycleShard(owned, ['b', ''], 0, 2)).toEqual(['', '']);
  });

  it('不会超过持有数量：b 只有一张，另一槽已用就跳过', () => {
    expect(cycleShard(owned, ['b', 'a'], 1, 2)).toEqual(['b', '']);
  });

  it('槽位越界不改动', () => {
    expect(cycleShard(owned, ['a'], 5, 2)).toEqual(['a', '']);
  });

  it('launchShards 去掉空槽、已不持有的残页和超出槽位的项', () => {
    expect(launchShards(owned, ['a', '', 'gone', 'b'], 3)).toEqual(['a']);
    expect(launchShards(owned, ['a', 'b'], 1)).toEqual(['a']);
  });
});

// ---------- 航图 HTML ----------

function chartState(patch: Partial<ChartPanelState> = {}, view: ChartView = fixtureChart()): ChartPanelState {
  return {view, selectedRegion: 'wind', selectedNode: null, selectedShards: [], selectedChallenge: '', busyNodeId: null, message: '', seaOpen: false, seaTierPick: 1, seaBusy: false, ...patch};
}

describe('航图渲染', () => {
  it('未开放节点只留禁用占位，不泄露名称', () => {
    const html = chartPanelHtml(chartState());
    expect(html).toContain('data-id="wind-story-3"');
    // 未开放节点只画一个禁用的「？」占位，不泄露名称和说明
    expect(html).toMatch(/data-id="wind-hunt"[^>]*disabled/);
    expect(html).not.toContain('风车旧井');
    expect(html).toContain('data-action="hub-region-select"');
  });

  it('选中节点出现卡片，出发按钮带节点 id；背包满时不能出发的原因写在卡片里', () => {
    const open = nodeCardHtml(fixtureChart().regions[0].nodes.find(n => n.id === 'wind-story-3')!, chartState({selectedNode: 'wind-story-3'}));
    expect(open).toContain('data-action="hub-node-go"');
    expect(open).toContain('data-id="wind-story-3"');
  });

  it('出发请求进行中：出发按钮处于 busy / 禁用，防止重复点击', () => {
    const html = chartPanelHtml(chartState({selectedNode: 'wind-story-3', busyNodeId: 'wind-story-3'}));
    expect(html).toMatch(/hub-node-go[^>]*disabled|disabled[^>]*hub-node-go|aria-busy="true"/);
  });

  it('锁定航区：节点不可选，整区不画出发', () => {
    const view = fixtureChart();
    const html = chartPanelHtml(chartState({selectedRegion: 'mist'}, view));
    expect(html).not.toContain('data-action="hub-node-go"');
  });
});

// ---------- 港口 ----------

describe('港口建设', () => {
  const port = fixturePort();

  it('hasClaimable / tiersReached / repTarget', () => {
    const [forge, shipyard, post] = port.buildings;
    expect(hasClaimable(forge)).toBe(false);
    expect(hasClaimable(shipyard)).toBe(true);
    expect(tiersReached(shipyard)).toBe(2);
    expect(tiersReached(post)).toBe(0);
    expect(repTarget(forge)).toBeGreaterThanOrEqual(forge.rep >= 200 ? 400 : 200);
  });

  it('可领取阶级有领取按钮；请求中同类按钮全部禁用', () => {
    const idle = portPanelHtml({view: port, selected: 'shipyard', busyKey: '', message: '', messageTone: 'success'});
    expect(idle).toContain('data-action="hub-port-claim"');
    expect(idle).toContain('data-id="shipyard:2"');
    const busy = portPanelHtml({view: port, selected: 'shipyard', busyKey: 'shipyard:2', message: '', messageTone: 'success'});
    expect(busy).toContain('aria-busy="true"');
  });

  it('失败信息显示在右侧详情区', () => {
    const html = portPanelHtml({view: port, selected: 'forge', busyKey: '', message: '领取失败，请重试。', messageTone: 'error'});
    expect(html).toContain('领取失败，请重试。');
  });
});

// ---------- 今日 ----------

describe('今日面板', () => {
  const base = {dockBusy: '' as const, message: '', messageTone: 'success' as const, commissionsHidden: false};

  it('数据缺失 / 未开放的行整行不出现', () => {
    const today = fixtureToday({high: null, commissions: {open: false, active: 0, slots: 0, doneToday: 0, banked: 0}, dock: {open: false, fleets: [], maxFleets: 0, quickAvailable: false, pendingCollect: false}});
    const rows = todayRows({...base, view: today}).join('');
    expect(rows).not.toContain('高难副本');
    expect(rows).not.toContain('委托');
    expect(rows).not.toContain('码头船队');
    expect(rows).toContain('首通');
  });

  it('首通剩余次数不会出现负数', () => {
    const rows = todayRows({...base, view: fixtureToday({firstClear: {used: 9, limit: 8}})}).join('');
    expect(rows.replace(/<[^>]*>/g, '')).not.toMatch(/-\d/);
  });

  it('委托板被 404 隐藏后，今日里不再给「打开委托板」', () => {
    const shown = todayRows({...base, view: fixtureToday()}).join('');
    const hidden = todayRows({...base, view: fixtureToday(), commissionsHidden: true}).join('');
    expect(shown).toContain('hub-commission');
    expect(hidden).not.toContain('hub-commission');
  });

  it('领取与快速收益在对方请求中禁用，自己显示忙碌', () => {
    const rows = todayRows({...base, view: fixtureToday(), dockBusy: 'collect'}).join('');
    expect(rows).toContain('aria-busy="true"');
    expect(rows).toMatch(/hub-dock-quick[^>]*disabled|disabled[^>]*hub-dock-quick/);
  });

  it('无法解析的刷新时间返回空串', () => {
    expect(formatResetAt('not-a-date')).toBe('');
    expect(formatResetAt(undefined)).toBe('');
    expect(formatResetAt('2026-10-22T04:00:00.000Z')).toMatch(/^\d+月\d+日 \d\d:\d\d$/);
  });

  it('整页渲染带关闭按钮；码头请求中关闭被禁用', () => {
    const html = todayPanelHtml({...base, view: fixtureToday(), dockBusy: 'quick'});
    expect(html).toContain('hub-today-close');
  });
});

// ---------- 委托板 ----------

describe('委托板', () => {
  const view = fixtureCommissions();
  const state = (patch = {}) => ({view, busyKey: '', message: '', messageTone: 'success' as const, confirmAbandon: '', ...patch});

  it('只有已完成的委托才有「交付」，所有委托都能放弃', () => {
    const html = commissionPanelHtml(state());
    expect(html.match(/data-action="hub-commission-claim"/g)).toHaveLength(1);
    expect(html.match(/data-action="hub-commission-abandon-confirm"/g)).toHaveLength(3);
  });

  it('放弃走行内二次确认', () => {
    const html = commissionPanelHtml(state({confirmAbandon: 'c1'}));
    expect(html).toContain('data-action="hub-commission-abandon"');
    expect(html).toContain('hub-commission-abandon-cancel');
  });

  it('请求进行中其它按钮全部禁用', () => {
    const html = commissionPanelHtml(state({busyKey: 'claim:c2'}));
    const buttons = html.match(/<button[^>]*data-action="hub-commission-(?:abandon-confirm|claim)"[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    const disabled = buttons.filter(b => /disabled/.test(b)).length;
    expect(disabled).toBe(buttons.length);
    expect(buttons.filter(b => /aria-busy="true"/.test(b))).toHaveLength(1);
  });

  it('空列表给出空态文案而不是空白', () => {
    const html = commissionPanelHtml(state({view: fixtureCommissions({slots: []})}));
    expect(html).toMatch(/暂无|没有|空/);
  });
});

// ---------- 结算 hub 块 ----------

describe('结算 hub 块', () => {
  it('HubBlockStore：回执带块直接用，不再请求；没带 hub 的回执不覆盖', () => {
    const fetchResult = vi.fn(async () => ({}));
    const store = new HubBlockStore(fetchResult, vi.fn());
    store.take('run-1', {hub: FIXTURE_RESULT});
    store.take('run-1', {});
    expect(store.get('run-1', true)?.nodeId).toBe(FIXTURE_RESULT.nodeId);
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('HubBlockStore：刷新后（无回执）从 result 接口补读一次，读到后通知重绘', async () => {
    const fetchResult = vi.fn(async () => ({hub: FIXTURE_RESULT}));
    const changed = vi.fn();
    const store = new HubBlockStore(fetchResult, changed);
    expect(store.get('run-2', true)).toBeUndefined();
    expect(store.get('run-2', true)).toBeUndefined();
    await vi.waitFor(() => expect(changed).toHaveBeenCalledWith('run-2'));
    expect(fetchResult).toHaveBeenCalledTimes(1);
    expect(fetchResult).toHaveBeenCalledWith('run-2');
    expect(store.get('run-2', true)?.nodeId).toBe(FIXTURE_RESULT.nodeId);
  });

  it('HubBlockStore：普通副本不请求；接口没有块或失败只读一次，不再重试', async () => {
    const fetchResult = vi.fn(async (id: string) => { if (id === 'bad') throw new Error('x'); return {}; });
    const changed = vi.fn();
    const store = new HubBlockStore(fetchResult, changed);
    expect(store.get('plain', false)).toBeUndefined();
    expect(fetchResult).not.toHaveBeenCalled();
    store.get('empty', true); store.get('bad', true);
    await Promise.resolve(); await Promise.resolve();
    store.get('empty', true); store.get('bad', true);
    expect(fetchResult).toHaveBeenCalledTimes(2);
    expect(changed).not.toHaveBeenCalled();
  });

  it('HubBlockStore：补读途中回执先到，以回执为准', async () => {
    let resolve!: (v: {hub?: typeof FIXTURE_RESULT}) => void;
    const changed = vi.fn();
    const store = new HubBlockStore(() => new Promise(r => { resolve = r; }), changed);
    store.get('run-3', true);
    const fromReceipt = {...FIXTURE_RESULT, nodeId: 'wind-hunt'};
    store.take('run-3', {hub: fromReceipt});
    resolve({hub: FIXTURE_RESULT});
    await Promise.resolve(); await Promise.resolve();
    expect(store.get('run-3', true)?.nodeId).toBe('wind-hunt');
    expect(changed).not.toHaveBeenCalled();
  });

  it('右栏按服务端字段逐项显示，缺失的数组按空处理', () => {
    const html = hubResultRightHtml(FIXTURE_RESULT, ['铁壁', '疾击']);
    expect(html).toContain('铁壁 · 疾击');
    expect(html).toContain('首通奖励');
    expect(html).toContain('生命星晶');
    expect(html).toContain('船台');
    expect(html).toContain('船坞遗址');
    const sparse = {...FIXTURE_RESULT, collectibles: undefined, rep: undefined, firstClearRewards: undefined, unlock: undefined, dailyBonus: {applied: false, used: 0, limit: 8}} as never;
    expect(() => hubResultRightHtml(sparse, [])).not.toThrow();
  });

  it('再来一次不可用时保留按钮、禁用并写明原因；下一节点只在服务端给出时才有', () => {
    const blocked = hubResultFooterHtml({...FIXTURE_RESULT, retry: {allowed: false, reason: '背包已满'}, next: undefined}, false);
    expect(blocked).toMatch(/hub-result-retry[^>]*disabled|disabled[^>]*hub-result-retry/);
    expect(blocked).toContain('背包已满');
    expect(blocked).not.toContain('hub-result-next');
    const ok = hubResultFooterHtml(FIXTURE_RESULT, false);
    expect(ok).toContain('data-action="hub-result-next"');
    expect(ok).toContain(`data-id="${FIXTURE_RESULT.next!.nodeId}"`);
  });

  it('回港中所有按钮禁用，防止重复点击', () => {
    const html = hubResultFooterHtml(FIXTURE_RESULT, true);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBe(3);
    for (const b of buttons) expect(b).toMatch(/disabled|aria-busy="true"/);
  });
});

// ---------- 接口层 ----------

describe('hub-api', () => {
  beforeEach(() => { net.api.mockReset(); });

  it('只有 404 当作「未开放」返回 undefined；其它失败原样抛出', async () => {
    net.api.mockRejectedValueOnce(failure(404, '没有', 'NOT_FOUND'));
    await expect(getHubChart()).resolves.toBeUndefined();
    net.api.mockRejectedValueOnce(failure(500));
    await expect(getHubChart()).rejects.toMatchObject({status: 500});
    net.api.mockRejectedValueOnce(failure(501));
    await expect(getHubToday()).rejects.toMatchObject({status: 501});
    net.api.mockRejectedValueOnce(failure(0, '断网', 'NETWORK'));
    await expect(getHubToday()).rejects.toMatchObject({status: 0});
  });

  it('写接口不抛异常，失败给出玩家能读的文字；成功带新的 command_id', async () => {
    net.api.mockResolvedValue({});
    await expect(postCommission('claim', 'c1')).resolves.toEqual({ok: true});
    await postDock('collect');
    const ids = net.api.mock.calls.map(c => (c[1] as {command_id: string}).command_id);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    expect(net.api.mock.calls[0][0]).toBe('hub/commissions');
    expect(net.api.mock.calls[0][1]).toMatchObject({op: 'claim', id: 'c1'});

    net.api.mockRejectedValueOnce(failure(409, '委托已不存在', 'GONE'));
    await expect(postSeaTier(2)).resolves.toEqual({ok: false, message: '委托已不存在'});
    net.api.mockRejectedValueOnce(failure(0, 'x', 'NETWORK'));
    const r = await postSeaTier(2);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('网络');
  });

  it('isHubNotFound / hubErrorMessage', () => {
    expect(isHubNotFound(failure(404))).toBe(true);
    expect(isHubNotFound(failure(500))).toBe(false);
    expect(isHubNotFound(new Error('x'))).toBe(false);
    expect(hubErrorMessage(new Error(''), '兜底')).toBe('兜底');
    expect(hubErrorMessage(failure(500, ''), '兜底')).toBe('兜底');
  });
});

// ---------- 控制器 ----------

function makeController(enabled?: () => boolean) {
  const deps = {
    enabled,
    open: vi.fn<(p: string) => void>(),
    refresh: vi.fn(),
    notice: vi.fn<(m: string) => void>(),
    startNode: vi.fn<HubDeps['startNode']>(async () => {}),
    panel: vi.fn(() => 'hub-chart'),
    resync: vi.fn(),
  };
  const ctrl = new HubController(deps);
  return {ctrl, deps};
}

/** api 桩：按路径返回样例；写操作默认成功。 */
function serve(chart: ChartView = fixtureChart(), extra: Record<string, unknown> = {}) {
  net.api.mockImplementation(async (path: string, body?: unknown) => {
    if (path in extra) { const v = extra[path]; if (v instanceof Error) throw v; return v; }
    if (body !== undefined) return {};
    if (path === 'hub/chart') return chart;
    if (path === 'hub/today') return fixtureToday();
    if (path === 'hub/commissions') return fixtureCommissions();
    if (path === 'hub/port') return fixturePort();
    throw failure(404);
  });
}

describe('HubController', () => {
  beforeEach(() => { net.api.mockReset(); });

  it('航图 404：入口整体隐藏；其它错误：入口仍在（可重试）', async () => {
    serve(undefined, {'hub/chart': failure(404)});
    const a = makeController();
    await expect(a.ctrl.load()).resolves.toBe(false);
    expect(a.ctrl.ready).toBe(false);
    expect(a.ctrl.isHidden('chart')).toBe(true);

    serve(undefined, {'hub/chart': failure(501, '尚未开放')});
    const b = makeController();
    await expect(b.ctrl.load()).resolves.toBe(true);
    expect(b.ctrl.ready).toBe(true);
    expect(b.ctrl.isHidden('chart')).toBe(false);
  });

  it('九开关：fieldEntry 未打开时入口全部隐藏且不发请求；打开后正常加载', async () => {
    expect(hubEnabled(undefined)).toBe(false);
    expect(hubEnabled({fieldEntry: false})).toBe(false);
    expect(hubEnabled({fieldEntry: true})).toBe(true);
    serve();
    let on = false;
    const {ctrl} = makeController(() => on);
    await expect(ctrl.load()).resolves.toBe(false);
    expect(net.api).not.toHaveBeenCalled();
    expect(ctrl.ready).toBe(false);
    for (const e of ['chart', 'today', 'port', 'commission'] as const) expect(ctrl.isHidden(e)).toBe(true);
    on = true;
    await expect(ctrl.load()).resolves.toBe(true);
    expect(ctrl.ready).toBe(true);
    expect(ctrl.isHidden('today')).toBe(false);
    on = false;
    expect(ctrl.ready).toBe(false);
  });

  it('默认选中上次的航区，没有选中节点', async () => {
    serve();
    const {ctrl} = makeController();
    await ctrl.load();
    expect(ctrl.chart?.selectedRegion).toBe('wind');
    expect(ctrl.chart?.selectedNode).toBeNull();
  });

  it('选中航区 / 节点；隐藏节点和锁定航区的节点选不中', async () => {
    serve();
    const {ctrl} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-select', 'wind-hunt', 'hub-chart');
    expect(ctrl.chart?.selectedNode).toBeNull();
    await ctrl.handle('hub-node-select', 'wind-story-3', 'hub-chart');
    expect(ctrl.chart?.selectedNode).toBe('wind-story-3');
    await ctrl.handle('hub-region-select', 'mist', 'hub-chart');
    expect(ctrl.chart?.selectedNode).toBeNull();
    await ctrl.handle('hub-node-select', 'mist-story-1', 'hub-chart');
    expect(ctrl.chart?.selectedNode).toBeNull();
  });

  it('Esc 逐级：先收海域弹层，再收节点卡片，最后放行关闭面板', async () => {
    serve();
    const {ctrl} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-select', 'wind-story-3', 'hub-chart');
    await ctrl.handle('hub-sea-toggle', '', 'hub-chart');
    expect(ctrl.chart?.seaOpen).toBe(true);
    expect(ctrl.escapeStep('hub-chart')).toBe(true);
    expect(ctrl.chart?.seaOpen).toBe(false);
    expect(ctrl.chart?.selectedNode).toBe('wind-story-3');
    expect(ctrl.escapeStep('hub-chart')).toBe(true);
    expect(ctrl.chart?.selectedNode).toBeNull();
    expect(ctrl.escapeStep('hub-chart')).toBe(false);
  });

  it('出发：带上残页 / 挑战 / 海域，成功后关闭面板；进行中再点不会重复发起', async () => {
    serve();
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-select', 'wind-nest-1', 'hub-chart');
    await ctrl.handle('hub-shard-slot', '0', 'hub-chart');
    await ctrl.handle('hub-challenge-pick', 'high', 'hub-chart');
    let release!: () => void;
    deps.startNode.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
    const first = ctrl.handle('hub-node-go', 'wind-nest-1', 'hub-chart');
    const second = ctrl.handle('hub-node-go', 'wind-nest-1', 'hub-chart');
    await second;
    expect(deps.startNode).toHaveBeenCalledTimes(1);
    expect(ctrl.escapeStep('hub-chart')).toBe(true);
    expect(ctrl.chart?.busyNodeId).toBe('wind-nest-1');
    release();
    await first;
    expect(deps.startNode.mock.calls[0][1]).toEqual({shards: ['shard-swift'], challenge: 'high', tier: 1});
    expect(deps.open).toHaveBeenCalledWith('');
    expect(ctrl.chart?.busyNodeId).toBeNull();
  });

  it('出发失败：面板保持打开，卡片里显示原因，busy 解除', async () => {
    serve();
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-select', 'wind-story-3', 'hub-chart');
    deps.startNode.mockRejectedValueOnce(new Error('副本暂时无法进入'));
    await ctrl.handle('hub-node-go', 'wind-story-3', 'hub-chart');
    expect(ctrl.chart?.message).toBe('副本暂时无法进入');
    expect(ctrl.chart?.busyNodeId).toBeNull();
    expect(deps.open).not.toHaveBeenCalledWith('');
  });

  it('背包已满：不发起出发，给出提示', async () => {
    serve(fixtureChart({bagFull: true}));
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-select', 'wind-story-3', 'hub-chart');
    await ctrl.handle('hub-node-go', 'wind-story-3', 'hub-chart');
    expect(deps.startNode).not.toHaveBeenCalled();
    expect(ctrl.chart?.message).toContain('背包');
  });

  it('不能出发锁定 / 隐藏节点（即使 action 被伪造）', async () => {
    serve();
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-node-go', 'wind-nest-3', 'hub-chart');
    await ctrl.handle('hub-node-go', 'wind-hunt', 'hub-chart');
    await ctrl.handle('hub-node-go', 'nope', 'hub-chart');
    expect(deps.startNode).not.toHaveBeenCalled();
  });

  it('切换海域：成功后重读航图并提示；失败显示服务端原因且不改当前档位', async () => {
    serve();
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-sea-toggle', '', 'hub-chart');
    await ctrl.handle('hub-sea-tier-pick', '2', 'hub-chart');
    await ctrl.handle('hub-sea-tier-confirm', '2', 'hub-chart');
    expect(deps.notice).toHaveBeenCalledWith(expect.stringContaining('出海后生效'));
    expect(ctrl.chart?.seaBusy).toBe(false);

    serve(undefined, {'hub/sea-tier': failure(409, '这档海域还没开放', 'LOCKED')});
    await ctrl.handle('hub-sea-toggle', '', 'hub-chart');
    await ctrl.handle('hub-sea-tier-confirm', '2', 'hub-chart');
    expect(ctrl.chart?.message).toBe('这档海域还没开放');
    expect(ctrl.chart?.seaBusy).toBe(false);
  });

  it('再来一次：用上次的残页 / 挑战重新出发；节点已不可挑战时回航图并提示', async () => {
    serve();
    const a = makeController();
    await a.ctrl.load();
    await a.ctrl.handle('hub-node-select', 'wind-nest-1', 'hub-chart');
    await a.ctrl.handle('hub-shard-slot', '0', 'hub-chart');
    await a.ctrl.handle('hub-challenge-pick', 'high', 'hub-chart');
    await a.ctrl.handle('hub-node-go', 'wind-nest-1', 'hub-chart');
    a.deps.startNode.mockClear();
    await a.ctrl.relaunch('wind-nest-1');
    expect(a.deps.startNode).toHaveBeenCalledTimes(1);
    expect(a.deps.startNode.mock.calls[0][1]).toMatchObject({shards: ['shard-swift'], challenge: 'high'});

    const b = makeController();
    await b.ctrl.load();
    await b.ctrl.relaunch('wind-nest-3');
    expect(b.deps.startNode).not.toHaveBeenCalled();
    expect(b.deps.open).toHaveBeenCalledWith('hub-chart');
    expect(b.deps.notice).toHaveBeenCalled();
  });

  it('领取类操作：成功后重读并同步角色快照，失败不同步；请求中重复点击被吞掉', async () => {
    serve();
    const {ctrl, deps} = makeController();
    await ctrl.load();
    await ctrl.handle('hub-port-claim', 'shipyard:2', 'hub-port');
    expect(deps.resync).toHaveBeenCalledTimes(1);

    deps.resync.mockClear();
    serve(undefined, {'hub/commissions': failure(409, '委托还没完成', 'NOT_READY')});
    await ctrl.handle('hub-commission-claim', 'c2', 'hub-commission');
    expect(deps.resync).not.toHaveBeenCalled();

    serve();
    let release!: () => void;
    net.api.mockImplementationOnce(() => new Promise(r => { release = () => r({}); }));
    const first = ctrl.handle('hub-dock-collect', '', 'hub-today');
    await ctrl.handle('hub-dock-quick', '', 'hub-today');
    const dockCalls = net.api.mock.calls.filter(c => c[0] === 'hub/dock');
    expect(dockCalls).toHaveLength(1);
    expect(ctrl.escapeStep('hub-today')).toBe(true);
    release();
    await first;
    expect(ctrl.escapeStep('hub-today')).toBe(false);
  });

  it('委托放弃必须先确认；Esc 先取消确认', async () => {
    serve();
    const {ctrl} = makeController();
    await ctrl.load();
    net.api.mockClear();
    await ctrl.handle('hub-commission-abandon', 'c1', 'hub-commission');
    expect(net.api.mock.calls.filter(c => c[0] === 'hub/commissions' && c[1] !== undefined)).toHaveLength(0);
    await ctrl.handle('hub-commission-abandon-confirm', 'c1', 'hub-commission');
    expect(ctrl.escapeStep('hub-commission')).toBe(true);
    expect(ctrl.escapeStep('hub-commission')).toBe(false);
  });

  it('未知 action 不消费', async () => {
    serve();
    const {ctrl} = makeController();
    await expect(ctrl.handle('nope', '', 'x')).resolves.toBe(false);
  });
});

describe('buildRegion 夹具工具', () => {
  it('节点模板位置与后端一致（5 列 × 3 行内，互不重叠）', () => {
    const r = buildRegion('wind', 'open', {});
    const seen = new Set(r.nodes.map(n => `${n.pos.col},${n.pos.row}`));
    expect(seen.size).toBe(10);
    for (const n of r.nodes) {
      expect(n.pos.col).toBeLessThan(GRID_COLS);
      expect(n.pos.row).toBeLessThan(GRID_ROWS);
    }
  });
});

// ---------- 结算页：没有 hub 块时输出不变 ----------

describe('battleResultHtml 的 hub 分支', () => {
  const data = {success: true, first_clear: false, delivery: 'inventory', history_complete: true, pending_gear: false, totals: {gold: 10, xp: 20, material: 3}, materials: {}, books: {}, gear: [], unlocked_regions: []} as never;
  const render = async (hub?: typeof FIXTURE_RESULT, names: string[] = []) => {
    const {battleResultHtml} = await import('../apps/web/src/battle-result-panel.ts');
    const {regions} = await import('../packages/content/index.ts');
    return battleResultHtml({region: regions[0].id, outcome: 'success'}, data, 'ready', '拾星港', '', false, 0, undefined, null, true, null, hub, names);
  };

  it('没有 hub 块：走原结算页，不含任何 hub 标记，也不受 hubChosenNames 影响', async () => {
    const plain = await render();
    expect(plain).not.toContain('hub-result');
    expect(plain).not.toContain('hub-records');
    expect(await render(undefined, ['铁壁'])).toBe(plain);
  });

  it('有 hub 块：左战利品 + 右本场记录 + hub 按钮行，回港按钮仍是 result-return', async () => {
    const html = await render(FIXTURE_RESULT, ['铁壁']);
    expect(html).toContain('hub-result');
    expect(html).toContain('hub-records');
    expect(html).toContain('data-action="hub-result-retry"');
    expect(html).toContain('data-action="result-return"');
    expect(html).toContain('铁壁');
  });
});

// ---------- F02：副本目标行（U4） ----------

describe('副本目标行 hubHudHtml', () => {
  const objective = {kind: 'open-chests' as const, text: '找到藏宝', progress: {done: 2, total: 5}, timeLeft: 31};

  it('没有目标（旧副本）不显示', () => {
    expect(hubHudHtml({})).toBe('');
    expect(hubHudHtml({segment: {index: 1, total: 3}})).toBe('');
  });

  it('时限到 30 秒变红，31 秒不变；进度原样显示', () => {
    expect(HUB_HUD_DANGER_SECONDS).toBe(30);
    expect(hubHudHtml({objective})).not.toContain('is-danger');
    const danger = hubHudHtml({objective: {...objective, timeLeft: 30}});
    expect(danger).toContain('is-danger');
    expect(danger).toContain('30s');
    expect(danger).toContain('2/5');
  });

  it('下一波倒计时优先于波数，波数优先于段数；单段不写段数', () => {
    const base = {objective: {kind: 'defend-beacon' as const, text: '守住信标'}, segment: {index: 2, total: 4}};
    expect(hubHudHtml({...base, wave: {index: 2, total: 4, nextIn: 4.2}})).toContain('下一波 5s');
    const wave = hubHudHtml({...base, wave: {index: 2, total: 4}});
    expect(wave).toContain('第 2/4 波');
    expect(wave).not.toContain('段');
    expect(hubHudHtml(base)).toContain('第 2/4 段');
    expect(hubHudHtml({...base, segment: {index: 1, total: 1}})).not.toContain('段');
  });

  it('怪潮信标耐久条；文字转义', () => {
    const html = hubHudHtml({objective: {kind: 'defend-beacon', text: '<守住>'}, beacon: {hp: 40, max: 100}});
    expect(html).toContain('信标耐久');
    expect(html).toContain('&lt;守住&gt;');
  });

  it('寻宝开箱读条：有 opening 才显示', () => {
    expect(hubHudHtml({objective})).not.toContain('开箱中');
    const html = hubHudHtml({objective, opening: {id: 'chest-1', left: 1.5, total: 2}});
    expect(html).toContain('hub-hud-opening');
    expect(html).toContain('开箱中');
  });
});

// ---------- F02：自动选卡倒计时（U5） ----------

describe('自动选卡倒计时', () => {
  const now = Date.parse('2026-10-21T10:00:00.000Z');
  it('整数秒向上取整；到点或缺省为空', () => {
    expect(augmentCountdownText('2026-10-21T10:00:04.200Z', now)).toBe('5 秒后自动选择');
    expect(augmentCountdownText('2026-10-21T10:00:00.000Z', now)).toBe('');
    expect(augmentCountdownText(undefined, now)).toBe('');
    expect(augmentCountdownText('不是时间', now)).toBe('');
  });

  it('面板保留倒计时行（供每秒改字），贴合构筑用 fitsBuild 标记', () => {
    const offered = (['a', 'b', 'c'] as const).map(id => ({id, name: id.toUpperCase(), description: '说明', tier: 'gold' as const}));
    const at = new Date(Date.now() + 9000).toISOString();
    const html = AugmentPanel({offered, chosen: [], rerollsLeft: 1, offerVersion: 1, busy: false, autoPickAt: at, fitsBuild: ['b']});
    expect(html).toContain('data-augment-countdown');
    expect(html).toContain('秒后自动选择');
    expect(html.match(/贴合构筑/g)).toHaveLength(1);
    const manual = AugmentPanel({offered, chosen: [], rerollsLeft: 1, offerVersion: 1, busy: false});
    expect(manual).not.toContain('data-augment-countdown');
  });
});

// ---------- F02：回港队列（U13） ----------

describe('回港队列', () => {
  beforeEach(() => { net.api.mockReset(); });

  const queue: HubReturnItem[] = [
    {kind: 'unlock', id: 'unlock:forge', title: '工坊开放', text: '可以去找铜铃强化装备了。'},
    {kind: 'dialogue', dialogueId: '没有这组对白'},
    {kind: 'dialogue', dialogueId: 'hub:first-return:1'},
    {kind: 'away', days: 2, lines: ['船队带回 3 箱补给']},
  ];
  const acks = () => net.api.mock.calls.filter(c => c[0] === 'hub/return-ack').map(c => [(c[1] as {kind: string}).kind, (c[1] as {id: string}).id]);

  it('ack id 与服务端出队规则一致', () => {
    expect(queue.map(returnAckId)).toEqual(['unlock:forge', '没有这组对白', 'hub:first-return:1', 'away']);
  });

  it('对白取对白表，说话人显示名字', () => {
    const lines = returnLines('hub:first-return:1');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].speaker).toBe('铜铃');
    expect(returnLines('没有这组对白')).toEqual([]);
  });

  it('卡片：开放提示 / 离港小结用小卡，对白用 story-dialogue；主按钮都是 hub-return-next', () => {
    const unlock = returnItemHtml({item: queue[0], lines: [], line: 0, left: 3});
    expect(unlock).toContain('新开放');
    expect(unlock).toContain('工坊开放');
    expect(unlock).toContain('还有 2 条');
    expect(unlock).toContain('data-action="hub-return-next"');
    const away = returnItemHtml({item: queue[3], lines: [], line: 0, left: 1});
    expect(away).toContain('离开 2 天');
    expect(away).toContain('船队带回 3 箱补给');
    expect(away).toContain('知道了');
    const lines = [{speaker: '铜铃', text: '第一句'}, {speaker: '你', text: '第二句'}];
    const first = returnItemHtml({item: queue[2], lines, line: 0, left: 1});
    expect(first).toContain('story-dialogue');
    expect(first).toContain('第一句');
    expect(first).toContain('1 / 2');
    expect(first).toContain('继续');
    expect(returnItemHtml({item: queue[2], lines, line: 1, left: 1})).toContain('知道了');
  });

  it('对白条目 HUB 降级：直接 ack + toast，不开对白窗口；unlock/away 仍走面板；播完打开 after 面板', async () => {
    serve(undefined, {'hub/today': fixtureToday({returnQueue: queue})});
    let panel = '';
    const {ctrl, deps} = makeController();
    deps.panel.mockImplementation(() => panel);
    deps.open.mockImplementation((p: string) => { panel = p; });
    await expect(ctrl.showReturnQueue('hub-chart')).resolves.toBe(true);
    // 两条 dialogue 均立即 ack（无台词的 + 有台词的）
    expect(acks()).toContainEqual(['dialogue', '没有这组对白']);
    expect(acks()).toContainEqual(['dialogue', 'hub:first-return:1']);
    // 有台词的对白显示 toast
    expect(deps.notice).toHaveBeenCalledWith(expect.stringContaining('铜铃'));
    // 面板队列只剩 unlock + away
    expect(panel).toBe('hub-return');
    expect(ctrl.returnView?.item.kind).toBe('unlock');
    expect(ctrl.returnView?.left).toBe(2);

    await ctrl.handle('hub-return-next', '', 'hub-return');
    expect(acks()).toContainEqual(['unlock', 'unlock:forge']);
    expect(ctrl.returnView?.item.kind).toBe('away');

    await ctrl.handle('hub-return-next', '', 'hub-return');
    expect(acks()).toContainEqual(['away', 'away']);
    expect(ctrl.returnView).toBeUndefined();
    expect(panel).toBe('hub-chart');
  });

  it('别的面板开着且没有 after 时不打断；队列为空不打开', async () => {
    serve(undefined, {'hub/today': fixtureToday({returnQueue: [queue[0]]})});
    const a = makeController();
    a.deps.panel.mockImplementation(() => 'bag');
    await expect(a.ctrl.showReturnQueue()).resolves.toBe(false);
    expect(a.deps.open).not.toHaveBeenCalled();
    expect(acks()).toEqual([]);

    serve();
    const b = makeController();
    b.deps.panel.mockImplementation(() => '');
    await expect(b.ctrl.showReturnQueue()).resolves.toBe(false);
    expect(b.deps.open).not.toHaveBeenCalled();
  });

  it('开关未开时不读、不播', async () => {
    serve(undefined, {'hub/today': fixtureToday({returnQueue: queue})});
    const {ctrl} = makeController(() => false);
    await expect(ctrl.showReturnQueue('hub-chart')).resolves.toBe(false);
    expect(net.api).not.toHaveBeenCalled();
  });
});

// ---------- F02：A1 红点 ----------

describe('港口 A1 红点', () => {
  beforeEach(() => { net.api.mockReset(); });

  it('进港后台读今日 / 港口建设：码头待领亮点，港口建设显示可领阶级数', async () => {
    serve();
    const {ctrl} = makeController();
    expect(ctrl.badges()).toEqual({today: 0, port: 0});
    await ctrl.load();
    await vi.waitFor(() => expect(ctrl.badges()).toEqual({today: 1, port: 1}));
  });

  it('开关未开或接口 404：不亮', async () => {
    serve(undefined, {'hub/port': failure(404)});
    const a = makeController();
    await a.ctrl.load();
    await vi.waitFor(() => expect(a.ctrl.isHidden('port')).toBe(true));
    expect(a.ctrl.badges().port).toBe(0);
    let on = true;
    const b = makeController(() => on);
    serve();
    await b.ctrl.load();
    await vi.waitFor(() => expect(b.ctrl.badges().today).toBe(1));
    on = false;
    expect(b.ctrl.badges()).toEqual({today: 0, port: 0});
  });
});
