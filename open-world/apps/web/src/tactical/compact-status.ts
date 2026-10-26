/** Compact, read-only HUD projection. These detail buttons never spend an action. */
import {esc,iconHtml,meterHtml} from '../ui-components.ts';
import {petPortraitHtml} from '../hub/pet-portrait.ts';
import type {IconName} from '../ui/icons.ts';
import type {TacticalEncounterView} from './contract.ts';

export type CompactHudDetail='vitals'|'move'|'main'|'pet';
export type CompactActionState='available'|'spent'|'waiting';
export type CompactStatusOptions={
 activeDetail?:CompactHudDetail|null;
 /** ID of the controller-owned details surface, when one is mounted. */
 detailId?:string;
 /** Connection/submission locks affect availability, never the authoritative budget. */
 blocked?:boolean;
};
export type CompactStatusDetail={title:string;rows:{label:string;value:string}[];notes:string[]};

export function isCompactHudDetail(value:unknown):value is CompactHudDetail{
 return value==='vitals'||value==='move'||value==='main'||value==='pet';
}

export function compactActionState(view:TacticalEncounterView,kind:'move'|'main',blocked=false):CompactActionState{
 const used=kind==='move'?view.budget.moveUsed:view.budget.mainActionUsed;
 if(used)return 'spent';
 const hero=view.units.find(unit=>unit.side==='hero');
 if(blocked||!hero?.alive||view.actorId!==hero.id||view.budget.ended||view.result||
  view.phase!=='awaiting'||view.control.phase!=='awaiting'||view.control.mode!=='manual')return 'waiting';
 return 'available';
}

function actionSummary(view:TacticalEncounterView,kind:'move'|'main',blocked=false):string{
 const state=compactActionState(view,kind,blocked),label=kind==='move'?'移动':'主行动';
 if(state==='spent')return `${label}已使用`;
 if(view.result||view.phase==='ended'||view.budget.ended)return '本次行动已结束';
 if(blocked)return '正在同步或提交行动';
 if(view.control.mode==='auto')return `${label}尚未使用，由托管执行`;
 return state==='available'?`${label}可用`:`${label}尚未使用，等待我方行动`;
}

/** All combat values and pet conditions come from the supplied encounter projection. */
export function compactStatusDetail(view:TacticalEncounterView,kind:CompactHudDetail,options:Pick<CompactStatusOptions,'blocked'>={}):CompactStatusDetail|null{
 const hero=view.units.find(unit=>unit.side==='hero');
 if(kind==='vitals'){
  if(!hero)return null;
  const rows=[{label:'生命',value:`${hero.hp.current} / ${hero.hp.max}`}];
  if(hero.resource)rows.push({label:'蓝量',value:`${hero.resource.current} / ${hero.resource.max}`});
  if(hero.shield!==null)rows.push({label:'当前护盾',value:String(hero.shield)});
  rows.push(...hero.statuses.map(status=>({label:status.label,value:status.remaining??'生效中'})));
  return {title:hero.name,rows,notes:hero.resource?[]:['本场未提供蓝量数据。']};
 }
 if(kind==='pet'){
  const pet=view.pet;if(!pet)return null;
  const rows=[{label:'当前状态',value:pet.statusText}];
  if(pet.remainingInWindow!==null)rows.push({label:'当前窗口剩余次数',value:String(pet.remainingInWindow)});
  return {title:pet.name,rows,notes:pet.conditionText?[pet.conditionText]:['本场尚未提供辅助条件。']};
 }
 const move=kind==='move';
 const rows=[{label:'当前状态',value:actionSummary(view,kind,options.blocked)}];
 if(move&&view.budget.moveSteps!==null)rows.push({label:'移动上限',value:`${view.budget.moveSteps} 格`});
 return {title:move?'移动额度':'主行动额度',rows,notes:[move
  ?'每次行动可移动一次，不能拆成攻击前后两段。'
  :'普攻与技能共享一次主行动；移动与主行动的先后可自行选择。']};
}

export function compactStatusDetailHtml(view:TacticalEncounterView,kind:CompactHudDetail,options:Pick<CompactStatusOptions,'blocked'>&{feedback?:string}={}):string{
 const detail=compactStatusDetail(view,kind,options);if(!detail)return '';
 return `<div class="tb-compact-detail-content"><h3 class="tb-card-title">${esc(detail.title)}</h3>
<div class="tb-compact-detail-scroll" tabindex="0" data-focus="hud-detail-scroll" data-scroll-key="status:${kind}" aria-label="状态详情内容"><dl class="tb-compact-detail-list">${detail.rows.map(row=>`<div><dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}</dl>
${detail.notes.map(note=>`<p class="tb-compact-detail-note">${esc(note)}</p>`).join('')}${options.feedback?`<p class="tb-compact-detail-note">${esc(options.feedback)}</p>`:''}</div></div>`;
}

/** The parent installs click/hover/focus handling and hydrates existing pet portraits. */
export function compactStatusHtml(view:TacticalEncounterView,options:CompactStatusOptions={}):string{
 const hero=view.units.find(unit=>unit.side==='hero');
 const attrs=(kind:CompactHudDetail)=>{
  const detail=compactStatusDetail(view,kind,options);
  const label=detail?[detail.title,...detail.rows.map(row=>`${row.label} ${row.value}`),...detail.notes].join('；'):'';
  return `type="button" data-action="hud-detail" data-detail="${kind}" data-focus="hud-detail-${kind}" aria-label="${esc(label)}" aria-expanded="${options.activeDetail===kind}"${options.detailId&&options.activeDetail===kind?` aria-controls="${esc(options.detailId)}"`:''}`;
 };
 const meter=(kind:'hp'|'mana',value:number,max:number)=>`<span class="tb-compact-meter" data-vital="${kind}">${iconHtml(kind,{size:16})}${meterHtml({value,max,label:kind==='hp'?'生命':'蓝量',tone:kind==='hp'?'hp':'mp',valueText:'none'}).replace(/ title="[^"]*"/g,'')}</span>`;
 const vitals=hero?`<button class="tb-compact-vitals" ${attrs('vitals')}>${meter('hp',hero.hp.current,hero.hp.max)}${hero.resource?meter('mana',hero.resource.current,hero.resource.max):''}</button>`:'';
 const action=(kind:'move'|'main')=>{
  const state=compactActionState(view,kind,options.blocked);
  return `<button class="tb-compact-action" data-state="${state}" ${attrs(kind)}>${iconHtml(kind==='move'?'speed':'swords',{size:24})}${state==='spent'?'<span class="tb-compact-slash" aria-hidden="true"></span>':''}${state==='waiting'?`<span class="tb-compact-wait" aria-hidden="true">${iconHtml('hourglass',{size:16})}</span>`:''}</button>`;
 };
 const pet=view.pet;
 let petHtml='';
 if(pet){
  const mark:Record<NonNullable<TacticalEncounterView['pet']>['status'],IconName>={ready:'diamond','not-met':'hourglass',spent:'pause',unconfigured:'info'};
  const runtime=pet.runtimeId||`ss-pet-${pet.familyId}-young`;
  petHtml=`<button class="tb-compact-pet" data-state="${pet.status}" ${attrs('pet')}><span class="tb-compact-pet-fallback" aria-hidden="true">${iconHtml('star',{size:24})}</span>${petPortraitHtml(runtime,'tb-compact-pet-portrait')}<span class="tb-compact-pet-mark" aria-hidden="true">${iconHtml(mark[pet.status],{size:16})}</span></button>`;
 }
 return `<div class="tb-compact-status" role="group" aria-label="角色与行动状态">${vitals}<div class="tb-compact-actions">${action('move')}${action('main')}</div>${petHtml}</div>`;
}
