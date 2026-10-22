/**
 * 预览页入口 —— 仅由 hub-review.html 使用，不进入游戏 bundle。
 * 驱动真实的 HubController：用本页的 fetch 桩回应 /api/hub/*（写操作会改动样例状态），
 * 所以出发 / 切换海域 / 领取 / 放弃等整条交互链都能点。
 * URL 参数 ?scenario=default|404|error|bagfull|slow|fail 切换后端状态。
 */
import {HubController, type HubLaunch} from './hub-controller.ts';
import {fixtureChart, fixtureToday, fixtureCommissions, fixturePort, FIXTURE_RESULT} from './hub-fixtures.ts';
import {battleResultHtml} from '../battle-result-panel.ts';
import type {ChartView, TodayView, HubCommissionsView as CommissionsView, HubPortView as PortView, ChartNodeView} from '../../../../packages/contracts/hub.ts';
import {regions} from '../../../../packages/content/index.ts';
import type {BattleResult} from '../../../../packages/contracts/index.ts';

type Scenario = 'default' | '404' | 'error' | 'bagfull' | 'slow' | 'fail';
const scenario = (new URLSearchParams(location.search).get('scenario') ?? 'default') as Scenario;

let chart: ChartView = fixtureChart(scenario === 'bagfull' ? {bagFull: true} : {});
let today: TodayView = fixtureToday();
let commissions: CommissionsView = fixtureCommissions();
let port: PortView = fixturePort();
const log: string[] = [];

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function handleHub(path: string, body: Record<string, any> | undefined): Promise<Response> {
  if (scenario === '404') return reply(404, {code: 'NOT_FOUND', message: '没有这个接口'});
  if (scenario === 'error' && !body) return reply(500, {code: 'SERVER', message: '航图服务暂时出错了，请稍后再试。'});
  await sleep(scenario === 'slow' ? 1500 : 120);
  if (!body) {
    if (path === 'hub/chart') return reply(200, chart);
    if (path === 'hub/today') return reply(200, today);
    if (path === 'hub/commissions') return reply(200, commissions);
    if (path === 'hub/port') return reply(200, port);
    return reply(404, {code: 'NOT_FOUND', message: ''});
  }
  if (scenario === 'fail') return reply(409, {code: 'CONFLICT', message: '这个操作暂时不能完成，请稍后重试。'});
  log.push(`${path} ${JSON.stringify({...body, command_id: undefined})}`);
  if (path === 'hub/sea-tier') {
    chart = {...chart, seaTier: {...chart.seaTier, current: body.tier}};
  } else if (path === 'hub/commissions') {
    const slot = commissions.slots.find(s => s.id === body.id);
    if (!slot) return reply(409, {code: 'GONE', message: '这个委托已经不存在。'});
    if (body.op === 'claim' && slot.status !== 'ready') return reply(409, {code: 'NOT_READY', message: '委托还没完成。'});
    commissions = {...commissions, doneToday: commissions.doneToday + (body.op === 'claim' ? 1 : 0), slots: commissions.slots.filter(s => s.id !== body.id)};
  } else if (path === 'hub/port/claim') {
    port = {...port, buildings: port.buildings.map(b => b.id !== body.building ? b : {...b, tiers: b.tiers.map(t => t.tier === body.tier ? {...t, claimed: true, claimable: false} : t)})};
  } else if (path === 'hub/dock') {
    today = {...today, dock: {...today.dock, pendingCollect: false, quickAvailable: body.op !== 'quick', fleets: today.dock.fleets.map(f => ({...f, accruedHours: 0}))}};
  }
  return reply(200, {ok: true});
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const m = url.match(/\/api\/(hub\/[^?]*)/);
  if (!m) return realFetch(input, init);
  return handleHub(m[1], init?.body ? JSON.parse(String(init.body)) : undefined);
};

// ---- 假宿主：模拟 main.ts 里 #modal 与 action 分发 ----

const modal = document.getElementById('modal') as HTMLElement;
const noteBox = document.getElementById('note') as HTMLElement;
let current = '';
let lastDepart = '';

const ctrl: HubController = new HubController({
  open: id => open(id),
  refresh: () => render(),
  notice: msg => { noteBox.textContent = msg; },
  panel: () => current,
  resync: () => { noteBox.textContent = '（已重新同步角色快照）'; },
  async startNode(node: ChartNodeView, launch: HubLaunch) {
    await sleep(scenario === 'slow' ? 1500 : 200);
    if (scenario === 'fail') throw new Error('副本暂时无法进入，请稍后重试。');
    lastDepart = `出发 ${node.id} · 残页[${launch.shards.join(',') || '无'}] · 挑战[${launch.challenge || '普通'}] · 海域 ${launch.tier}`;
    noteBox.textContent = lastDepart;
  },
});

function render() {
  if (current === 'hub-chart') ctrl.renderChart(modal);
  else if (current === 'hub-today') ctrl.renderToday(modal);
  else if (current === 'hub-port') ctrl.renderPort(modal);
  else if (current === 'hub-commission') ctrl.renderCommissions(modal);
  else if (current === 'result' || current === 'result-plain') { /* 静态页，不随控制器重绘 */ }
  else { modal.classList.remove('open'); modal.innerHTML = ''; }
}

function open(id: string) {
  current = id;
  if (!id) { modal.classList.remove('open'); modal.innerHTML = ''; return; }
  render();
}

const RESULT_DATA = {
  success: true, first_clear: true, delivery: 'inventory', history_complete: true, pending_gear: false,
  totals: {gold: 1280, xp: 3400, material: 36}, materials: {}, books: {}, gear: [], unlocked_regions: [],
} as unknown as BattleResult;

function showResult(withHub: boolean) {
  current = withHub ? 'result' : 'result-plain';
  modal.classList.add('open');
  modal.innerHTML = battleResultHtml({region: regions[0].id, outcome: 'success'}, RESULT_DATA, 'ready', '拾星港', '', false, 0, undefined, null, true, null, withHub ? FIXTURE_RESULT : undefined, withHub ? ['铁壁', '疾击'] : []);
}

document.addEventListener('click', e => {
  const t = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (!t || t.hasAttribute('disabled')) return;
  const action = t.dataset.action ?? '';
  const id = t.dataset.id ?? '';
  if (action === 'panel') { void openPanel(id); return; }
  if (action === 'hub-result-retry') { void ctrl.relaunch(id); return; }
  if (action === 'hub-result-next') { ctrl.selectNode(id); open('hub-chart'); return; }
  if (action === 'result-return') { open(''); return; }
  const panel = current;
  const mapped = (action === 'sea-tier-pick' && panel === 'hub-chart') ? 'hub-sea-tier-pick' : action;
  void ctrl.handle(mapped, id, panel);
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !current) return;
  if (ctrl.escapeStep(current)) return;
  open('');
});

async function openPanel(id: string) {
  if (id === 'hub-chart') { await ctrl.load(); }
  if (id === 'hub-chart' && !ctrl.ready) { noteBox.textContent = '航图入口已隐藏（404）。'; return; }
  open(id);
}

const bind = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', fn);
bind('btn-chart', () => void openPanel('hub-chart'));
bind('btn-today', () => open('hub-today'));
bind('btn-commission', () => open('hub-commission'));
bind('btn-port', () => open('hub-port'));
bind('btn-result', () => showResult(true));
bind('btn-result-plain', () => showResult(false));
bind('btn-flip', () => {
  // 把选中节点依次切到四个角附近的节点，检查卡片翻转
  const c = ctrl.chart;
  if (!c) { noteBox.textContent = '先打开航图。'; return; }
  const ids = ['wind-story-1', 'wind-nest-1', 'wind-treasure', 'wind-gate'];
  const next = ids[(ids.indexOf(c.selectedNode ?? '') + 1) % ids.length];
  ctrl.selectNode(next);
  render();
});

const select = document.getElementById('scenario') as HTMLSelectElement | null;
if (select) {
  select.value = scenario;
  select.addEventListener('change', () => { location.search = `?scenario=${select.value}`; });
}

void (async () => {
  await ctrl.load();
  if (scenario === '404' || !ctrl.ready) { noteBox.textContent = scenario === '404' ? '航图入口已隐藏（404）。' : ''; }
  open(ctrl.ready ? 'hub-chart' : '');
})();
