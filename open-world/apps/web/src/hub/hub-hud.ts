/**
 * U4 星门副本 HUD 的目标行（M15 §3.2.1）：顶部一行「时限 · 目标 进度 · 段数 / 下一波」，怪潮的信标耐久条在下面。
 * 字段来自服务端 hubDungeonPublicSchema（objective / segment / wave / beacon），缺字段就不显示该项，不用客户端推算。
 */
import type {HubDungeonPublic} from '../../../../packages/contracts/hub-dungeons.ts';
import {esc,meterHtml} from '../ui-components.ts';

type HudFrame = Partial<Pick<HubDungeonPublic, 'objective' | 'segment' | 'wave' | 'beacon' | 'opening'>>;

/** 限时类型最后 30 秒变红 */
export const HUB_HUD_DANGER_SECONDS = 30;

/** 没有目标时返回空串（旧副本不显示这一行）。 */
export function hubHudHtml(frame: HudFrame): string {
  const o = frame.objective;
  if (!o?.text) return '';
  const time = o.timeLeft !== undefined
    ? `<span class="hub-hud-time${o.timeLeft <= HUB_HUD_DANGER_SECONDS ? ' is-danger' : ''}">${Math.ceil(o.timeLeft)}s</span>`
    : '';
  const progress = o.progress ? `<span class="hub-hud-progress">${o.progress.done}/${o.progress.total}</span>` : '';
  // 波间倒计时优先于段数：怪潮的「段」就是波，同时写两个是重复信息
  const side = frame.wave?.nextIn !== undefined
    ? `<span class="hub-hud-wave-next">下一波 ${Math.ceil(frame.wave.nextIn)}s</span>`
    : frame.wave
      ? `<span class="hub-hud-segment">第 ${frame.wave.index}/${frame.wave.total} 波</span>`
      : frame.segment && frame.segment.total > 1
        ? `<span class="hub-hud-segment">第 ${frame.segment.index}/${frame.segment.total} 段</span>`
        : '';
  const beacon = frame.beacon
    ? `<div class="hub-hud-beacon">${meterHtml({value: frame.beacon.hp, max: frame.beacon.max, label: '信标耐久', tone: 'hp', valueText: 'end'})}</div>`
    : '';
  // 读条：寻宝开箱或狩猎击碎引雷桩（服务端 2 秒，离开 2 格或倒下会取消）；按 0.1 秒取整，避免每帧都重写这一行
  const opening = frame.opening
    ? `<div class="hub-hud-opening">${meterHtml({value: Math.round((frame.opening.total - frame.opening.left) * 10) / 10, max: frame.opening.total, label: frame.opening.id.startsWith('hub-pylon-') ? '击碎引雷桩' : '开箱中', tone: 'gold', valueText: 'none'})}</div>`
    : '';
  return `<div class="hub-hud-main">${time}<span class="hub-hud-text">${esc(o.text)}${progress}</span>${side}</div>${beacon}${opening}`;
}

/** 只在内容变化时重写，避免每帧重建 DOM。返回这一行是否应显示。 */
export function paintHubHud(row: HTMLElement, frame: HudFrame): boolean {
  const html = hubHudHtml(frame);
  if (row.dataset.html !== html) { row.dataset.html = html; row.innerHTML = html; }
  row.hidden = !html;
  return Boolean(html);
}
