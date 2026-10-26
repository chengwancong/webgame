/**
 * Hub 控制器：航图 / 今日 / 港口建设 / 委托板四个面板的数据、状态和交互。
 *
 * 约定：
 * - 入口跟服务端九开关走：fieldEntry（野外入口冻结）打开后才是星门 / 港口新流程，之前全部隐藏且不发请求（hubEnabled）。
 * - 开关已开但接口返回 404 也算「功能未开放」，对应入口整体隐藏（isHidden）；其余失败显示可重试的错误态。
 * - 每个写操作都有 busy 标记，进行中其余按钮禁用，Esc 也不会在请求途中关面板。
 * - 面板渲染进 #modal；installPanelMotion 已由 main.ts 在 #modal 上装过一次，这里不再重复安装。
 * - 回港队列（U13）也挂在这里：它跟「今日」同一个接口（today.returnQueue），播完逐条 return-ack。
 */
import {chartPanelHtml,cycleShard,launchShards,type ChartPanelState,type ChallengePick} from './chart-panel.ts';
import {portPanelHtml,hasClaimable,type PortPanelState} from './port-panel.ts';
import {todayPanelHtml,type TodayPanelState} from './today-panel.ts';
import {commissionPanelHtml,type CommissionPanelState} from './commission-panel.ts';
import {getHubChart,getHubToday,getHubPort,getHubCommissions,postSeaTier,postDock,postPortClaim,postCommission,postReturnAck,hubErrorMessage} from './hub-api.ts';
import {returnAckId,returnItemHtml,returnLines,type ReturnLine,type ReturnItemView} from './return-queue.ts';
import {dialogueToastText} from '../automatic-quest-dialogue.ts';
import type {ChartView,TodayView,HubPortView as PortView,HubCommissionsView as CommissionsView,ChartNodeView,HubReturnItem} from '../../../../packages/contracts/hub.ts';
import type {LoadoutView} from '../../../../packages/contracts/zhangjian.ts';
import type {FieldFreeze} from '../../../../packages/contracts/field-freeze.ts';
import {esc,panelHeaderHtml,stateBlockHtml} from '../ui-components.ts';

/** HUB 新流程是否开放：服务端 S 切换时九开关一起打开，fieldEntry 是其中「旧野外入口关闭、改走星门」那一项。读不到开关时按未开放处理。 */
export function hubEnabled(freeze: Readonly<Pick<FieldFreeze, 'fieldEntry'>> | undefined): boolean {
  return freeze?.fieldEntry === true;
}

export type HubLaunch = {shards: string[]; challenge: ChallengePick; tier: number};

export type HubDeps = {
  open(panel: string): void;
  refresh(): void;
  notice(msg: string): void;
  /** 出发。失败时抛出异常（消息由控制器显示在卡片里，调用方不要再弹提示）。 */
  startNode(node: ChartNodeView, launch: HubLaunch): Promise<void>;
  /** 当前打开的面板 id；用于异步回来时只重绘仍在显示的面板 */
  panel?(): string;
  /** 领取类写操作成功后重新拉取角色快照（金币 / 背包 / 声望可能变了） */
  resync?(): void | Promise<void>;
  /** 服务端开关是否已切到 HUB 新流程（见 hubEnabled）；不传视为开放，供预览页 / 测试使用。 */
  enabled?(): boolean;
  /** 回港对白里 {player} 的替换名 */
  playerName?(): string;
};

export type HubEntry = 'chart' | 'today' | 'port' | 'commission';
type Section = HubEntry;
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type Slot<T> = {view?: T; status: LoadStatus; error: string; stale: boolean};
const newSlot = <T>(): Slot<T> => ({status: 'idle', error: '', stale: false});

const PANEL_OF: Record<Section, string> = {chart: 'hub-chart', today: 'hub-today', port: 'hub-port', commission: 'hub-commission'};
const TITLE_OF: Record<Section, string> = {chart: '航图', today: '今日', port: '港口建设', commission: '委托板'};

export class HubController {
  private slots = {chart: newSlot<ChartView>(), today: newSlot<TodayView>(), port: newSlot<PortView>(), commission: newSlot<CommissionsView>()};
  private hidden = new Set<Section>();
  private inflight: Partial<Record<Section, Promise<boolean>>> = {};

  private chartState?: ChartPanelState;
  private todayUi = {dockBusy: '' as TodayPanelState['dockBusy'], message: '', tone: 'success' as TodayPanelState['messageTone']};
  private portUi = {selected: '', busyKey: '', message: '', tone: 'success' as PortPanelState['messageTone']};
  private commUi = {busyKey: '', message: '', tone: 'success' as CommissionPanelState['messageTone'], confirmAbandon: ''};

  private lastLaunch = new Map<string, {shards: string[]; challenge: ChallengePick}>();
  private pendingFocus?: {action: string; id?: string};
  private relaunching = false;
  /** 正在播放的回港队列（服务端顺序）；returnLine 是当前对白的第几句，returnAfter 是播完要打开的面板 */
  private returnItems: {item: HubReturnItem; lines: ReturnLine[]}[] = [];
  private returnLine = 0;
  private returnAfter = '';

  constructor(private deps: HubDeps) {}

  // ---------- 入口可见性 ----------

  private get enabled(): boolean { return this.deps.enabled?.() ?? true; }
  /** 开关未开，或该接口返回过 404 */
  private off(section: Section): boolean { return !this.enabled || this.hidden.has(section); }

  /** 航图可用（含加载出错、可重试）。开关未开、404 或尚未加载时为 false。 */
  get ready(): boolean {
    return !this.off('chart') && (this.slots.chart.status === 'ready' || this.slots.chart.status === 'error');
  }

  /** 开关未开，或该入口的接口返回过 404：入口整体隐藏。 */
  isHidden(entry: HubEntry): boolean { return this.off(entry); }

  /** A1 菜单红点（M15 §3.1）：「今日」= 码头有待领收益；「港口建设」= 可领的阶级奖励数。数据没读到时按 0。 */
  badges(): {today: number; port: number} {
    const today = !this.off('today') && this.slots.today.view?.dock.pendingCollect ? 1 : 0;
    const port = this.off('port') ? 0 : (this.slots.port.view?.buildings ?? []).reduce((n, b) => n + b.tiers.filter(t => t.claimable && !t.claimed).length, 0);
    return {today, port};
  }

  /** 场景摆件用：各建筑已领阶数（forge/shipyard/post → 0–4，数据未加载时全为 0） */
  buildingLevels(): Record<string, number> {
    return Object.fromEntries((this.slots.port.view?.buildings ?? []).map(b => [b.id, b.tiers.filter(t => t.claimed).length]));
  }

  /** 测试 / 调试用：当前航图面板状态 */
  get chart(): ChartPanelState | undefined { return this.chartState; }

  /** Z1：更新方案视图，航图节点卡实时更新元素提示。 */
  setLoadoutView(v: LoadoutView | undefined): void {
    if (!this.chartState) return;
    this.chartState = {...this.chartState, loadoutView: v};
  }

  /** 标记所有已缓存的视图过期；下次渲染时后台刷新，旧数据继续显示不闪烁。 */
  invalidate(): void {
    for (const k of Object.keys(this.slots) as Section[]) this.slots[k].stale = true;
  }

  // ---------- 加载 ----------

  private runLoad<T>(section: Section, fetcher: () => Promise<T | undefined>, apply: (v: T) => void): Promise<boolean> {
    const running = this.inflight[section];
    if (running) return running;
    const slot = this.slots[section] as unknown as Slot<T>;
    if (!slot.view) { slot.status = 'loading'; slot.error = ''; }
    slot.stale = false;
    let p!: Promise<boolean>;
    p = (async () => {
      try {
        const v = await fetcher();
        if (v === undefined) {
          this.hidden.add(section);
          slot.view = undefined; slot.status = 'idle'; slot.error = '';
          this.afterHidden(section);
          return false;
        }
        slot.view = v; slot.status = 'ready'; slot.error = '';
        apply(v);
        return true;
      } catch (e) {
        slot.error = hubErrorMessage(e, `${TITLE_OF[section]}加载失败，请重试。`);
        if (!slot.view) slot.status = 'error';
        return false;
      } finally {
        if (this.inflight[section] === p) delete this.inflight[section];
      }
    })();
    this.inflight[section] = p;
    return p;
  }

  private afterHidden(section: Section) {
    if (this.deps.panel?.() === PANEL_OF[section]) this.deps.open('');
    this.deps.refresh();
  }

  private repaintIf(section: Section) {
    if (!this.deps.panel || this.deps.panel() === PANEL_OF[section]) this.deps.refresh();
  }

  /** 进入港口时调用。返回 true 表示航图入口应当显示（含加载失败可重试的状态）。 */
  async load(): Promise<boolean> {
    if (!this.enabled) return false;
    this.invalidate();
    // 红点要用到今日 / 港口建设两份视图，进港时顺带在后台读一次，读完重绘 HUD
    for (const section of ['today', 'port'] as const) if (!this.off(section)) void (section === 'today' ? this.loadToday() : this.loadPort()).then(ok => { if (ok) this.deps.refresh(); });
    await this.loadChart();
    return this.ready;
  }

  private loadChart(): Promise<boolean> {
    return this.runLoad('chart', getHubChart, chart => this.applyChart(chart));
  }

  private applyChart(chart: ChartView) {
    const prev = this.chartState;
    const usable = (id: string) => chart.regions.some(r => r.id === id && r.status !== 'locked');
    const region = prev && usable(prev.selectedRegion) ? prev.selectedRegion
      : usable(chart.lastRegion) ? chart.lastRegion
      : chart.regions.find(r => r.status !== 'locked')?.id ?? chart.regions[0]?.id ?? '';
    const regionView = chart.regions.find(r => r.id === region);
    const node = prev?.selectedNode && regionView?.nodes.some(n => n.id === prev.selectedNode && n.status !== 'hidden') ? prev.selectedNode : null;
    this.chartState = {
      view: chart, selectedRegion: region, selectedNode: node,
      selectedShards: prev?.selectedShards ?? [],
      selectedChallenge: node ? prev?.selectedChallenge ?? '' : '',
      busyNodeId: prev?.busyNodeId ?? null,
      message: prev?.message ?? '',
      seaOpen: prev?.seaOpen ?? false,
      seaTierPick: chart.seaTier.current,
      seaBusy: prev?.seaBusy ?? false,
    };
  }

  private loadToday() { return this.runLoad('today', getHubToday, () => {}); }
  private loadCommissions() { return this.runLoad('commission', getHubCommissions, () => {}); }
  private loadPort() {
    return this.runLoad('port', getHubPort, view => {
      const ids = [...view.buildings.map(b => b.id as string), 'collectibles', 'systems'];
      if (!ids.includes(this.portUi.selected)) this.portUi.selected = view.buildings.find(hasClaimable)?.id ?? view.buildings[0]?.id ?? 'systems';
    });
  }

  // ---------- 渲染 ----------

  private paint(host: HTMLElement, html: string) {
    const active = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : undefined;
    const want = this.pendingFocus ?? (active?.dataset.action ? {action: active.dataset.action, id: active.dataset.id} : undefined);
    this.pendingFocus = undefined;
    host.classList.add('open');
    host.innerHTML = html;
    if (!want) return;
    const target = Array.from(host.querySelectorAll<HTMLElement>('[data-action]')).find(el => el.dataset.action === want.action && el.dataset.id === want.id && !el.hasAttribute('disabled'));
    target?.focus({preventScroll: true});
  }

  /** 加载中 / 出错时的整页状态；返回 undefined 表示该面板已有可显示的视图。 */
  private stateHtml(section: Section): string | undefined {
    const slot = this.slots[section];
    if (this.off(section)) {
      return `<section class="panel hub-state-panel" data-panel="${PANEL_OF[section]}" role="dialog" aria-modal="true" aria-label="${esc(TITLE_OF[section])}">${panelHeaderHtml(TITLE_OF[section], {closeLabel: `关闭${TITLE_OF[section]}`, closeAction: `${PANEL_OF[section]}-close`})}${stateBlockHtml({kind: 'empty', title: '暂未开放', message: '这个功能还没有开放。', compact: true})}</section>`;
    }
    if (slot.view) {
      if (slot.stale && !this.inflight[section]) void this.reloadSection(section);
      return undefined;
    }
    if (slot.status === 'idle' || (slot.status === 'ready')) void this.reloadSection(section);
    const title = TITLE_OF[section];
    const panel = PANEL_OF[section];
    const error = slot.status === 'error';
    const body = stateBlockHtml({
      kind: error ? 'error' : 'loading',
      title: error ? `${title}暂时打不开` : '正在加载…',
      message: error ? slot.error || '请稍后重试。' : '请稍候。',
      action: error ? {label: '重试', action: `${panel}-retry`} : undefined,
      compact: true,
    });
    return `<section class="panel hub-state-panel" data-panel="${panel}" role="dialog" aria-modal="true" aria-label="${esc(title)}" aria-busy="${!error}">${panelHeaderHtml(title, {closeLabel: `关闭${title}`, closeAction: `${panel}-close`})}${body}</section>`;
  }

  private async reloadSection(section: Section) {
    if (this.inflight[section] || this.off(section)) return;
    const ok = await (section === 'chart' ? this.loadChart() : section === 'today' ? this.loadToday() : section === 'port' ? this.loadPort() : this.loadCommissions());
    if (this.hidden.has(section)) return;
    if (ok || !this.slots[section].view) this.repaintIf(section);
  }

  renderChart(host: HTMLElement) {
    const state = this.stateHtml('chart');
    if (state) { this.paint(host, state); return; }
    if (!this.chartState) return;
    this.paint(host, chartPanelHtml(this.chartState));
  }

  renderToday(host: HTMLElement) {
    const state = this.stateHtml('today');
    if (state) { this.paint(host, state); return; }
    this.paint(host, todayPanelHtml({view: this.slots.today.view!, dockBusy: this.todayUi.dockBusy, message: this.todayUi.message, messageTone: this.todayUi.tone, commissionsHidden: this.off('commission')}));
  }

  renderPort(host: HTMLElement) {
    const state = this.stateHtml('port');
    if (state) { this.paint(host, state); return; }
    this.paint(host, portPanelHtml({view: this.slots.port.view!, selected: this.portUi.selected, busyKey: this.portUi.busyKey, message: this.portUi.message, messageTone: this.portUi.tone}));
  }

  renderCommissions(host: HTMLElement) {
    const state = this.stateHtml('commission');
    if (state) { this.paint(host, state); return; }
    this.paint(host, commissionPanelHtml({view: this.slots.commission.view!, busyKey: this.commUi.busyKey, message: this.commUi.message, messageTone: this.commUi.tone, confirmAbandon: this.commUi.confirmAbandon}));
  }

  // ---------- 回港队列（U13） ----------

  /**
   * 回到拾星港后调用：读今日视图里的 returnQueue，有可播放的条目就打开 hub-return 面板逐条播放。
   * after = 播完要打开的面板（结算页「下一节点」回到航图）；不传时若别的面板正开着就不打断，等下次回港再播（服务端会保留队列）。
   * 对白条目（kind='dialogue'）HUB 模式降级：不打开多句对白窗口，直接确认出队（奖励链不变），
   * 有台词时最多弹一行轻 toast（说话人：第一句，截断）。unlock / settlement 条目保持原有面板流程。
   */
  async showReturnQueue(after = ''): Promise<boolean> {
    if (this.off('today')) return false;
    if (this.deps.panel?.() === 'hub-return') { if (after) this.returnAfter = after; return true; }
    if (!this.slots.today.view || this.slots.today.stale || this.inflight.today) await this.loadToday();
    const queue = this.slots.today.view?.returnQueue ?? [];
    const items: {item: HubReturnItem; lines: ReturnLine[]}[] = [];
    for (const item of queue) {
      if (item.kind === 'dialogue') {
        // HUB 降级：对白不开窗口，直接 ack；有台词时显示一行 toast。
        const text = dialogueToastText(returnLines(item.dialogueId, this.deps.playerName?.()));
        if (text) this.deps.notice(text);
        void postReturnAck(item.kind, returnAckId(item));
        continue;
      }
      items.push({item, lines: []});
    }
    if (items.length < queue.length) this.slots.today.stale = true;
    const panel = this.deps.panel?.() ?? '';
    if (panel === 'hub-return') { if (after) this.returnAfter = after; return true; }
    if (!items.length || (panel && !after)) return false;
    this.returnItems = items;
    this.returnLine = 0;
    this.returnAfter = after;
    this.pendingFocus = {action: 'hub-return-next'};
    this.deps.open('hub-return');
    return true;
  }

  /** 当前播放的队列条目；没有在播时为 undefined */
  get returnView(): ReturnItemView | undefined {
    const head = this.returnItems[0];
    return head && {item: head.item, lines: head.lines, line: this.returnLine, left: this.returnItems.length};
  }

  renderReturn(host: HTMLElement) {
    const view = this.returnView;
    if (!view) { this.deps.open(this.takeReturnAfter()); return; }
    this.pendingFocus ??= {action: 'hub-return-next'};
    this.paint(host, returnItemHtml(view));
  }

  private takeReturnAfter(): string { const after = this.returnAfter; this.returnAfter = ''; return after; }

  /** 「继续 / 知道了」与 Esc：对白先翻句，一条播完就确认出队（失败不拦，下次回港服务端会再给）。 */
  private advanceReturn() {
    const head = this.returnItems[0];
    if (!head) { this.deps.open(this.takeReturnAfter()); return; }
    if (head.item.kind === 'dialogue' && this.returnLine < head.lines.length - 1) { this.returnLine++; this.pendingFocus = {action: 'hub-return-next'}; this.deps.refresh(); return; }
    void postReturnAck(head.item.kind, returnAckId(head.item));
    this.returnItems.shift();
    this.returnLine = 0;
    this.slots.today.stale = true;
    if (this.returnItems.length) { this.pendingFocus = {action: 'hub-return-next'}; this.deps.refresh(); return; }
    this.deps.open(this.takeReturnAfter());
  }

  // ---------- Esc ----------

  /** Esc 逐级处理：请求进行中吞掉；海域弹层 → 节点卡片 → 放弃确认；返回 true 表示已消费，面板保持打开。 */
  escapeStep(panel: string): boolean {
    if (panel === 'hub-return') { this.advanceReturn(); return true; }
    if (panel === 'hub-chart') {
      const c = this.chartState;
      if (!c) return false;
      if (c.busyNodeId || c.seaBusy) return true;
      if (c.seaOpen) { this.chartState = {...c, seaOpen: false, message: ''}; this.pendingFocus = {action: 'hub-sea-toggle'}; this.deps.refresh(); return true; }
      if (c.selectedNode) { this.deselectNode(); return true; }
      return false;
    }
    if (panel === 'hub-commission') {
      if (this.commUi.busyKey) return true;
      if (this.commUi.confirmAbandon) { const id = this.commUi.confirmAbandon; this.commUi.confirmAbandon = ''; this.pendingFocus = {action: 'hub-commission-abandon-confirm', id}; this.deps.refresh(); return true; }
      return false;
    }
    if (panel === 'hub-port') return Boolean(this.portUi.busyKey);
    if (panel === 'hub-today') return Boolean(this.todayUi.dockBusy);
    return false;
  }

  private deselectNode() {
    const c = this.chartState!;
    const id = c.selectedNode;
    this.chartState = {...c, selectedNode: null, selectedChallenge: '', message: ''};
    if (id) this.pendingFocus = {action: 'hub-node-select', id};
    this.deps.refresh();
  }

  // ---------- 出发 ----------

  private findNode(id: string): ChartNodeView | undefined {
    return this.slots.chart.view?.regions.flatMap(r => r.nodes).find(n => n.id === id);
  }

  private seaTier(): number { return this.slots.chart.view?.seaTier.current ?? 0; }

  /** 切到节点所在航区并选中该节点（「下一节点」「再来一次」失败时回到航图用）。 */
  selectNode(nodeId: string): void {
    const view = this.slots.chart.view;
    const c = this.chartState;
    if (!view || !c) return;
    const region = view.regions.find(r => r.nodes.some(n => n.id === nodeId));
    if (!region) return;
    this.chartState = {...c, selectedRegion: region.id, selectedNode: nodeId, selectedChallenge: '', message: '', seaOpen: false};
  }

  /** 真正发起出发；返回空串表示成功，否则是要显示给玩家的失败原因。 */
  private async depart(node: ChartNodeView, shards: string[], challenge: ChallengePick): Promise<string> {
    const view = this.slots.chart.view!;
    const challenges = node.challenges as string[];
    const pick: ChallengePick = challenge && challenges.includes(challenge) ? challenge : '';
    const launch: HubLaunch = {shards: launchShards(view.shards.owned, shards, node.shardSlots), challenge: pick, tier: this.seaTier()};
    try {
      await this.deps.startNode(node, launch);
      this.lastLaunch.set(node.id, {shards: launch.shards, challenge: launch.challenge});
      this.invalidate();
      return '';
    } catch (e) {
      return hubErrorMessage(e, '出发失败，请重试。');
    }
  }

  /** 结算页「再来一次」：校验节点仍可挑战，用上次的残页和难度重新出发。调用前已回港。 */
  async relaunch(nodeId: string): Promise<void> {
    if (this.relaunching) return;
    this.relaunching = true;
    try {
      this.invalidate();
      await this.loadChart();
      const node = this.findNode(nodeId);
      const c = this.chartState;
      if (!node || !c || (node.status !== 'open' && node.status !== 'cleared')) {
        this.selectNode(nodeId);
        this.deps.notice(node?.lockReason ?? '这个节点现在不能再来一次，请从航图重新选择。');
        this.deps.open('hub-chart');
        return;
      }
      if (this.slots.chart.view!.bagFull) {
        this.selectNode(nodeId);
        this.deps.notice('背包已满，先回港整理再出发。');
        this.deps.open('hub-chart');
        return;
      }
      const prev = this.lastLaunch.get(nodeId);
      this.chartState = {...c, busyNodeId: nodeId, message: ''};
      const error = await this.depart(node, prev?.shards ?? [], prev?.challenge ?? '');
      this.chartState = {...this.chartState!, busyNodeId: null};
      if (error) {
        this.selectNode(nodeId);
        this.chartState = {...this.chartState!, message: error};
        this.deps.open('hub-chart');
        this.deps.refresh();
      } else {
        this.deps.open('');
      }
    } finally {
      this.relaunching = false;
    }
  }

  // ---------- 动作分发 ----------

  /** 处理 hub 面板内的 action，返回 true 表示已消费。 */
  async handle(action: string, id: string, _panel: string): Promise<boolean> {
    switch (action) {
      case 'hub-region-select': case 'hub-node-select': case 'hub-node-deselect': case 'hub-shard-slot': case 'hub-challenge-pick':
      case 'hub-sea-toggle': case 'hub-sea-tier-pick': case 'hub-sea-tier-confirm': case 'hub-node-go': case 'hub-chart-close': case 'hub-chart-retry':
        return this.handleChart(action, id);
      case 'hub-today-close': case 'hub-today-retry': case 'hub-dock-collect': case 'hub-dock-quick':
        return this.handleToday(action);
      case 'hub-port-select': case 'hub-port-close': case 'hub-port-retry': case 'hub-port-claim':
        return this.handlePort(action, id);
      case 'hub-commission-close': case 'hub-commission-retry': case 'hub-commission-abandon-confirm': case 'hub-commission-abandon-cancel':
      case 'hub-commission-claim': case 'hub-commission-abandon':
        return this.handleCommission(action, id);
      case 'hub-return-next':
        this.advanceReturn();
        return true;
      default:
        return false;
    }
  }

  private async handleChart(action: string, id: string): Promise<boolean> {
    if (action === 'hub-chart-retry') { this.slots.chart.status = this.slots.chart.view ? 'ready' : 'idle'; void this.reloadSection('chart'); this.deps.refresh(); return true; }
    const c = this.chartState;
    const view = this.slots.chart.view;
    if (action === 'hub-chart-close') { if (!c?.busyNodeId && !c?.seaBusy) this.deps.open(''); return true; }
    if (!c || !view) return true;
    if (c.busyNodeId || c.seaBusy) return true;
    const region = view.regions.find(r => r.id === c.selectedRegion);
    const node = c.selectedNode ? region?.nodes.find(n => n.id === c.selectedNode) : undefined;

    switch (action) {
      case 'hub-region-select':
        if (!view.regions.some(r => r.id === id)) return true;
        this.chartState = {...c, selectedRegion: id, selectedNode: null, selectedChallenge: '', message: ''};
        break;
      case 'hub-node-select': {
        const target = region?.status === 'locked' ? undefined : region?.nodes.find(n => n.id === id && n.status !== 'hidden');
        if (!target) return true;
        this.chartState = {...c, selectedNode: id, selectedChallenge: target.id === c.selectedNode ? c.selectedChallenge : '', message: ''};
        break;
      }
      case 'hub-node-deselect': this.deselectNode(); return true;
      case 'hub-shard-slot': {
        if (!node) return true;
        this.chartState = {...c, selectedShards: cycleShard(view.shards.owned, c.selectedShards, Number(id), node.shardSlots)};
        break;
      }
      case 'hub-challenge-pick': {
        if (!node) return true;
        const pick = (id === 'normal' ? '' : id) as ChallengePick;
        if (pick && !(node.challenges as string[]).includes(pick)) return true;
        this.chartState = {...c, selectedChallenge: pick};
        break;
      }
      case 'hub-sea-toggle': this.chartState = {...c, seaOpen: !c.seaOpen, seaTierPick: view.seaTier.current, message: ''}; break;
      case 'hub-sea-tier-pick': {
        const tier = Number(id);
        if (!view.seaTier.choices.some(t => t.tier === tier)) return true;
        this.chartState = {...c, seaTierPick: tier};
        break;
      }
      case 'hub-sea-tier-confirm': {
        const tier = Number.isFinite(Number(id)) && id !== '' ? Number(id) : c.seaTierPick;
        if (tier === view.seaTier.current || !view.seaTier.choices.some(t => t.tier === tier)) return true;
        this.chartState = {...c, seaBusy: true, message: ''};
        this.deps.refresh();
        const result = await postSeaTier(tier);
        const name = view.seaTier.choices.find(t => t.tier === tier)?.name ?? '所选海域';
        if (result.ok) {
          await this.inflight.chart;
          const ok = await this.loadChart();
          this.chartState = {...this.chartState!, seaBusy: false, seaOpen: false, message: ok ? '' : this.slots.chart.error};
          this.deps.notice(`已切换到${name}，出海后生效`);
        } else {
          this.chartState = {...this.chartState!, seaBusy: false, message: result.message ?? '切换海域失败，请重试。'};
        }
        this.deps.refresh();
        return true;
      }
      case 'hub-node-go': return this.goNode(id);
      default: return false;
    }
    this.deps.refresh();
    return true;
  }

  private async goNode(id: string): Promise<boolean> {
    const view = this.slots.chart.view!;
    const c = this.chartState!;
    const node = this.findNode(id);
    if (!node || node.status === 'locked' || node.status === 'hidden') return true;
    if (view.bagFull) {
      this.chartState = {...c, message: '背包已满，先回港整理再出发。'};
      this.deps.refresh();
      return true;
    }
    this.chartState = {...c, busyNodeId: id, message: ''};
    this.deps.refresh();
    const error = await this.depart(node, c.selectedShards, c.selectedChallenge);
    this.chartState = {...this.chartState!, busyNodeId: null, message: error};
    if (error) {
      void this.loadChart().then(() => this.repaintIf('chart'));
      this.deps.refresh();
    } else {
      this.deps.open('');
    }
    return true;
  }

  private async handleToday(action: string): Promise<boolean> {
    if (action === 'hub-today-close') { if (!this.todayUi.dockBusy) this.deps.open(''); return true; }
    if (action === 'hub-today-retry') { this.slots.today.status = this.slots.today.view ? 'ready' : 'idle'; this.deps.refresh(); return true; }
    if (this.todayUi.dockBusy) return true;
    const op = action === 'hub-dock-collect' ? 'collect' : 'quick';
    this.todayUi = {dockBusy: op, message: '', tone: 'success'};
    this.deps.refresh();
    const result = await postDock(op);
    this.todayUi = {dockBusy: '', message: result.ok ? (op === 'collect' ? '已领取码头收益。' : '快速收益已结算。') : result.message ?? '码头操作失败，请重试。', tone: result.ok ? 'success' : 'error'};
    if (result.ok) {
      await this.loadToday();
      void this.deps.resync?.();
    }
    this.deps.refresh();
    return true;
  }

  private async handlePort(action: string, id: string): Promise<boolean> {
    if (action === 'hub-port-close') { if (!this.portUi.busyKey) this.deps.open(''); return true; }
    if (action === 'hub-port-retry') { this.slots.port.status = this.slots.port.view ? 'ready' : 'idle'; this.deps.refresh(); return true; }
    if (action === 'hub-port-select') {
      if (this.portUi.busyKey) return true;
      this.portUi = {...this.portUi, selected: id, message: ''};
      this.deps.refresh();
      return true;
    }
    // hub-port-claim：id = `${building}:${tier}`
    if (this.portUi.busyKey) return true;
    const [building, tierText] = id.split(':');
    const tier = Number(tierText);
    if (!building || !Number.isInteger(tier)) return true;
    this.portUi = {...this.portUi, busyKey: id, message: ''};
    this.deps.refresh();
    const result = await postPortClaim(building, tier);
    this.portUi = {...this.portUi, busyKey: '', message: result.ok ? '已领取。' : result.message ?? '领取失败，请重试。', tone: result.ok ? 'success' : 'error'};
    if (result.ok) {
      await this.loadPort();
      void this.deps.resync?.();
    }
    this.deps.refresh();
    return true;
  }

  private async handleCommission(action: string, id: string): Promise<boolean> {
    const ui = this.commUi;
    if (action === 'hub-commission-close') { if (!ui.busyKey) this.deps.open(''); return true; }
    if (action === 'hub-commission-retry') { this.slots.commission.status = this.slots.commission.view ? 'ready' : 'idle'; this.deps.refresh(); return true; }
    if (ui.busyKey) return true;
    if (action === 'hub-commission-abandon-confirm') { ui.confirmAbandon = id; ui.message = ''; this.pendingFocus = {action: 'hub-commission-abandon-cancel'}; this.deps.refresh(); return true; }
    if (action === 'hub-commission-abandon-cancel') { const was = ui.confirmAbandon; ui.confirmAbandon = ''; this.pendingFocus = {action: 'hub-commission-abandon-confirm', id: was}; this.deps.refresh(); return true; }
    const op = action === 'hub-commission-claim' ? 'claim' : 'abandon';
    if (op === 'abandon' && ui.confirmAbandon !== id) return true;
    ui.busyKey = `${op}:${id}`; ui.message = '';
    this.deps.refresh();
    const result = await postCommission(op, id);
    ui.busyKey = ''; ui.confirmAbandon = '';
    ui.message = result.ok ? (op === 'claim' ? '委托已交付。' : '已放弃委托。') : result.message ?? '操作失败，请重试。';
    ui.tone = result.ok ? 'success' : 'error';
    if (result.ok) {
      this.slots.today.stale = true;
      await this.loadCommissions();
      if (op === 'claim') void this.deps.resync?.();
    }
    this.deps.refresh();
    return true;
  }
}
