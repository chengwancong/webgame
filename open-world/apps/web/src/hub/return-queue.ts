/**
 * U13 回港队列（M15 §3.7）：回到拾星港后，把 today.returnQueue 里服务端排好的条目逐条播放——
 * 新开放提示、离港小结、回港对白。每条播完 POST hub/return-ack，服务端据此出队并结算 hub_return 任务事实。
 * 顺序、筛选（本次只放一条 unlock）都由服务端决定，这里按原样播放。
 */
import type {HubReturnItem} from '../../../../packages/contracts/hub.ts';
import {dialogueLines} from '../../../../packages/content/task-tables.ts';
import {starseaSpeaker} from '../../../../packages/rules/starsea.ts';
import {esc,buttonHtml,panelHeaderHtml,sealEmblem} from '../ui-components.ts';

export type ReturnLine = {speaker: string; text: string};

/** return-ack 的 id：unlock 用条目 id，对白用 dialogueId，离港小结固定 'away'（与 hub-chart-service ackHubReturn 一致）。 */
export function returnAckId(item: HubReturnItem): string {
  return item.kind === 'unlock' ? item.id : item.kind === 'dialogue' ? item.dialogueId : 'away';
}

/** 回港对白：对白表（config/json/dialogue.json）里的分组，说话人显示名与星潮海对白同一套。 */
export function returnLines(dialogueId: string, player = '你'): ReturnLine[] {
  return dialogueLines(dialogueId, {player}).map(l => ({speaker: starseaSpeaker(l.speaker), text: l.text}));
}

export type ReturnItemView = {item: HubReturnItem; lines: ReturnLine[]; line: number; left: number};

/**
 * 一条队列条目的面板。对白沿用 .story-dialogue 结构（ui/dialogue-bar.ts 会自动改成底部对白条、逐字显示），
 * 开放提示 / 离港小结是居中小卡。主按钮固定是 hub-return-next，Esc 同「继续」。
 */
export function returnItemHtml(v: ReturnItemView): string {
  const more = v.left > 1;
  if (v.item.kind === 'dialogue') {
    const line = v.lines[Math.min(v.line, v.lines.length - 1)] ?? {speaker: '', text: ''};
    const last = v.line >= v.lines.length - 1;
    return `<section class="panel story-dialogue hub-return" data-panel="hub-return" role="dialog" aria-modal="true" aria-label="回港对白">${panelHeaderHtml(line.speaker || '拾星港', {emblemHtml: sealEmblem('people')})}<div class="story-spoken">${line.speaker ? `<strong>${esc(line.speaker)}</strong>` : ''}<p>${esc(line.text)}</p></div>${v.lines.length > 1 ? `<p class="ui-caption">${Math.min(v.line + 1, v.lines.length)} / ${v.lines.length}</p>` : ''}<div class="story-dialogue-actions">${buttonHtml(last ? (more ? '继续' : '知道了') : '继续', {action: 'hub-return-next', variant: 'primary'})}</div></section>`;
  }
  let card: {kicker: string; title: string; body: string};
  if (v.item.kind === 'unlock') {
    card = {kicker: '新开放', title: v.item.title, body: `<p>${esc(v.item.text)}</p>`};
  } else {
    const lines = v.item.lines;
    card = {kicker: '离港期间', title: `离开 ${v.item.days} 天`, body: lines.length ? `<ul class="hub-return-lines">${lines.map((l: string) => `<li class="hub-return-lines__item">${esc(l)}</li>`).join('')}</ul>` : ''};
  }
  // 主角卡头带（浅金顶带 + kicker + title）
  const heroBand = `<div class="hub-hero-card hub-return-hero"><div class="hub-hero-card__band"><p class="hub-return-kicker">${esc(card.kicker)}</p></div><div class="hub-hero-card__body"><h3 class="hub-return-title">${esc(card.title)}</h3></div></div>`;
  return `<div class="confirm-overlay ui-confirm-overlay" data-panel="hub-return"><section class="confirm-box ui-confirm hub-return-card" role="dialog" tabindex="-1" aria-modal="true" aria-label="${esc(card.kicker)}"><div class="ui-confirm__body">${heroBand}${card.body}</div><div class="ui-confirm__actions">${more ? `<span class="ui-caption">还有 ${v.left - 1} 条</span>` : ''}${buttonHtml(more ? '继续' : '知道了', {action: 'hub-return-next', variant: 'primary'})}</div></section></div>`;
}
