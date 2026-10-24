/**
 * U6 结算页 hub 块（方案 B「左战利品 · 右本场记录」）。
 * 仅当回执带 hub 块时由 battle-result-panel 调用；没有 hub 块时 battle-result-panel 的输出不变。
 * 字段按服务端给的原样显示，缺失的数组按空处理，不用客户端推算。
 */
import {esc,buttonHtml} from '../ui-components.ts';
import {iconHtml} from '../ui/icons.ts';
import type {HubSettlement as HubResultBlock} from '../../../../packages/contracts/hub.ts';

export const BUILDING_NAMES: Record<string, string> = {forge: '工坊', shipyard: '船台', post: '邮局'};
export const COLLECTIBLE_NAMES: Record<string, string> = {lifeCrystal: '生命星晶', starCore: '星核'};

const record = (label: string, value: string, cls = '') =>
  `<li class="hub-record${cls ? ' ' + cls : ''}"><span class="hub-record__key">${esc(label)}</span><span class="hub-record__value">${value}</span></li>`;

/** 右栏「本场记录」。extraHtml 放战斗回顾 / 词缀战绩，占剩余高度、内部滚动。 */
export function hubResultRightHtml(hub: HubResultBlock, extraHtml = ''): string {
  const rows: string[] = [];

  if (hub.dailyBonus?.applied) {
    rows.push(record('首通加成', `本场 ×2 · 今日 <b class="ui-number">${hub.dailyBonus.used}</b> / ${hub.dailyBonus.limit}`));
  }

  const rewards = hub.firstClearRewards ?? [];
  if (hub.firstClear && rewards.length) rows.push(record('首通奖励', esc(rewards.join('、'))));

  for (const c of hub.collectibles ?? []) {
    rows.push(record('收藏', `${iconHtml('diamond', {size: 16})}${esc(COLLECTIBLE_NAMES[c.kind] ?? c.kind)} <b class="ui-number">${c.owned}</b> / ${c.total}`, 'hub-record--collect'));
  }

  const rep = hub.rep ?? [];
  if (rep.length) rows.push(record('声望', rep.map(r => `${esc(BUILDING_NAMES[r.building] ?? r.building)} <b class="ui-number">+${r.delta}</b>`).join('　')));

  if (hub.unlock) {
    rows.push(`<li class="hub-record hub-record--unlock"><span class="hub-record__key">${iconHtml('star', {size: 16})}新开放</span><span class="hub-record__value"><b>${esc(hub.unlock.title)}</b><small>${esc(hub.unlock.text)}</small></span></li>`);
  }

  return `<aside class="hub-result-right" aria-label="本场记录"><ul class="hub-records">${rows.join('')}</ul>${extraHtml ? `<div class="hub-result-extra">${extraHtml}</div>` : ''}</aside>`;
}

/** 底部按钮行。再来一次不可用时保留按钮并禁用，原因写在左侧，避免布局跳动。 */
export function hubResultFooterHtml(hub: HubResultBlock, returnBusy: boolean): string {
  const retry = buttonHtml('再来一次', {action: 'hub-result-retry', id: hub.nodeId, variant: 'secondary', disabled: returnBusy || !hub.retry?.allowed, attributes: hub.retry?.allowed ? undefined : {title: hub.retry?.reason ?? '暂时不能再来一次'}});
  const next = hub.next
    ? buttonHtml('下一节点', {action: 'hub-result-next', id: hub.next.nodeId, variant: 'secondary', disabled: returnBusy, attributes: {title: hub.next.name}})
    : '';
  const back = buttonHtml('回港整备', {action: 'result-return', variant: 'primary', busy: returnBusy, busyLabel: '正在返回…'});
  const note = !hub.retry?.allowed && hub.retry?.reason
    ? esc(hub.retry.reason)
    : hub.next ? `下一节点：${esc(hub.next.name)}` : '';
  return `<footer class="result-footer hub-result-footer"><div class="return-context"><span class="unlock-notice">${note}</span></div>${retry}${next}${back}</footer>`;
}

/**
 * 结算 hub 块的来源（后端 dungeon-service）：result / leave 回执的 `hub` 字段，随 WS state.receipts 到达；
 * 刷新页面后回执不会重发，只能从 GET dungeons/:id/result 的顶层 `hub` 补读。两处都已经过 zod 校验。
 * 按实例 id 缓存；null = 已经读过、没有块（普通副本、或这场没有走到结算）。
 */
export class HubBlockStore {
  private readonly blocks = new Map<string, HubResultBlock | null>();
  constructor(
    private readonly fetchResult: (instanceId: string) => Promise<{hub?: HubResultBlock}>,
    /** 补读到块之后调用，由宿主决定是否重绘结算页 */
    private readonly changed: (instanceId: string) => void,
  ) {}

  /** WS 帧里的回执 */
  take(instanceId: string, receipt: {hub?: HubResultBlock}): void {
    if (receipt.hub) this.blocks.set(instanceId, receipt.hub);
  }

  /** 结算页取块。hub 副本还没拿到时补读一次（每个实例只读一次，失败也不重试，按普通结算显示）。 */
  get(instanceId: string, hubRun: boolean): HubResultBlock | undefined {
    const known = this.blocks.get(instanceId);
    if (known !== undefined || !hubRun) return known ?? undefined;
    this.blocks.set(instanceId, null);
    void this.fetchResult(instanceId).then(r => {
      if (!r.hub || this.blocks.get(instanceId)) return;
      this.blocks.set(instanceId, r.hub);
      this.changed(instanceId);
    }).catch(() => { /* 读不到就按普通结算显示 */ });
    return undefined;
  }
}
