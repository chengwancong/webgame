import type {Region} from '../../../packages/content/index.ts';
import type {Mode,Snapshot,TaskView} from '../../../packages/contracts/index.ts';
import {buttonHtml,esc} from './ui-components.ts';
import {hudMenuIcon} from './hud-icons.ts';
export type HudContext='home'|'field'|'dungeon'|'result';
// A recorded spawn/checkpoint does not establish a protected area.
export function hudContext(region:Pick<Region,'auto'|'spawns'>,dungeon=false,result=false):HudContext{
 if(result)return 'result';if(dungeon)return 'dungeon';return !region.auto&&!region.spawns.length?'home':'field';
}
export function hudModeBlocked(mode:Mode,options:{blocked:boolean;processing:boolean;hp:number;full:boolean;context:HudContext}){
 return options.blocked||options.processing||options.hp<=0||mode==='auto'&&options.full&&options.context==='field';
}
export const hudExitIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M10 12h10m-4-4 4 4-4 4"/></svg>';
// Field and town are fixed semi-auto: skills auto-cast, the player moves (user 2026-10-11). The mode switch exists only inside dungeons.
export function combatModeHtml(mode:Mode,open:boolean,options:Parameters<typeof hudModeBlocked>[1]){
 if(options.context!=='dungeon')return '';
 const labels={manual:'手动',semi:'半自动',auto:'全自动'},disabled=options.blocked||options.processing||options.hp<=0;
 const current=`<button type="button" class="entry hud-mode-current" data-action="hud-mode-toggle" aria-label="战斗模式：${labels[mode]}" aria-expanded="${open}" aria-controls="hud-mode-options"${disabled?' disabled':''}><span class="entry-orb">${hudMenuIcon('combat')}</span><span class="entry-name">${labels[mode]}</span></button>`;
 return current+(open?`<div id="hud-mode-options" class="hud-mode-options" role="group" aria-label="选择战斗模式">${(['manual','semi','auto'] as Mode[]).map(id=>buttonHtml((id===mode?'✓ ':'')+labels[id],{action:'mode',id,variant:'tertiary',className:'hud-mode-option',disabled:hudModeBlocked(id,options),attributes:id===mode?{'aria-current':'true'}:{}})).join('')}</div>`:'');
}
export function hudStatusHtml(s:Pick<Snapshot,'gear'|'capacity'>,context:HudContext,processing=false,stopReason=''){
 if(context==='result')return '';
 if(s.gear.length>=s.capacity){const action=context==='field'?'camp-sort':'panel',label=context==='field'?'回港整理':'行囊',note=context==='home'?'整理装备后再出发':context==='dungeon'?'副本继续，结束后回港整理':'拾取已暂停，先回港整理';return `<div class="hud-inventory-notice"><div><strong>背包满了 <span class="num">${s.gear.length}/${s.capacity}</span></strong>${buttonHtml(context==='home'?'整理':label,{action,id:action==='panel'?'bag':'town',size:'compact',variant:'secondary',disabled:processing})}</div><small>${note}</small></div>`;}
 return context==='field'&&stopReason?`<div class="hud-combat-notice">${esc(stopReason)}</div>`:'';
}
export const hudGoalLabel=(goal:string,fallback='查看下一步 →')=>Array.from(goal).length>14?fallback:goal;
// 归途主线已下线（老角色迁入星潮海），追踪栏只列任务。
/** 追踪条的成长目标行（钉选装备、下一次找回），docs/progression-goal-plan.md §3：与任务合计最多三行。 */
export type TrackerGoal={kind:string;title:string;goal:string;action:string;id:string;full?:boolean};
export function questTrackerHtml(tasks?:TaskView,goals:readonly TrackerGoal[]=[]){
 const rows=[],extra=goals.slice(0,2);
 for(const row of (tasks?.current??[]).slice(0,Math.max(1,3-extra.length))){const goal=row.goal??row.note;rows.push(`<button type="button" class="hud-quest-row" data-action="hud-task-open" data-id="${esc(row.id)}" title="${esc(goal)}"><span class="hud-quest-title"><small>${esc(row.typeName)}</small><b>${esc(row.title)}</b></span><span class="hud-quest-goal">${esc(hudGoalLabel(goal,'查看任务目标 →'))}${row.current!==null&&row.total!==null?` <strong class="num">${row.current}/${row.total}</strong>`:''}${row.state==='ready'?' · 可领取':''}</span></button>`);}
 for(const g of extra)rows.push(`<button type="button" class="hud-quest-row hud-goal-row" data-action="${esc(g.action)}" data-id="${esc(g.id)}" title="${esc(g.goal)}"><span class="hud-quest-title"><small>${esc(g.kind)}</small><b>${esc(g.title)}</b></span><span class="hud-quest-goal">${esc(g.full?g.goal:hudGoalLabel(g.goal,'查看 →'))}</span></button>`);
 return rows.length?`<div class="hud-quest-list">${rows.join('')}</div>`:'<p class="hud-quest-goal">任务信息待同步</p>';
}
