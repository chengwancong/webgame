/** HUD-only projections. Abilities and movement remain owned by the encounter source. */
import {esc,iconHtml,itemSlot} from '../ui-components.ts';
import {componentArtHtml} from '../ui/component-art.ts';
import type {TacticalAbilityView,TacticalEncounterView} from './contract.ts';
import type {SelectionState} from './selection.ts';
import {canCommand} from './selection.ts';

/** Some sources do not publish the enemy executor. Do not highlight a stale hero ID. */
export function hudActorId(view:TacticalEncounterView):string|null{
 if(view.result||view.phase==='ended'||view.phase==='settling'||view.phase==='resolving')return null;
 const actor=view.units.find(u=>u.id===view.actorId&&u.alive);
 if(!actor||(view.phase==='enemy'&&actor.side!=='enemy'))return null;
 return actor.id;
}

export function hudAbilities(view:TacticalEncounterView):Array<TacticalAbilityView|null>{
 return [view.abilities.find(a=>a.category==='basic')??null,...Array.from({length:4},(_,i)=>view.abilities.filter(a=>a.category==='skill')[i]??null)];
}
export function hudAbilityShortcut(view:TacticalEncounterView,key:string):TacticalAbilityView|null{
 return hudAbilities(view)[key.toLowerCase()==='b'?0:/^[1-4]$/.test(key)?Number(key):-1]??null;
}
/** Idle move affordance consumes the source's legal set, never computes a route. */
export function idleMoveSelection(view:TacticalEncounterView,selection:SelectionState,online=true):SelectionState{
 return online&&view.legalMoves.length>0&&canCommand(view,selection)&&!view.budget.moveUsed&&selection.command==='none'&&!selection.confirmRetreat
  ?{...selection,command:'move'}:selection;
}
export function shouldPreviewIdleMove(view:TacticalEncounterView,selection:SelectionState,cell:{x:number;y:number},online=true):boolean{
 return idleMoveSelection(view,selection,online)!==selection
  &&view.legalMoves.some(m=>m.cell.x===cell.x&&m.cell.y===cell.y)
  &&!view.units.some(u=>u.alive&&u.cell.x===cell.x&&u.cell.y===cell.y);
}
function abilityUnavailableReason(view:TacticalEncounterView,ability:TacticalAbilityView,enabled:boolean):string{
 if(ability.migration!=='supported')return '尚未开放';
 if(view.budget.mainActionUsed)return '主行动已使用';
 if(!ability.available)return ability.reason?.trim()?ability.reason:'当前不可用';
 if(view.result||view.phase==='ended'||view.phase==='settling')return '本场战斗已结束';
 if(view.phase==='resolving'||view.control.phase==='resolving')return '行动结算中';
 if(view.control.mode==='auto')return '托管执行中';
 if(!canCommand(view,{submitting:null}))return '等待我方行动';
 return enabled?'':'当前不能施放';
}

/** Read-only skill details. Unknown fields remain absent instead of receiving guessed values. */
export function hudAbilityInfoHtml(view:TacticalEncounterView,id:string,enabled=true):string{
 const ability=view.abilities.find(a=>a.id===id);if(!ability)return '';
 const reason=abilityUnavailableReason(view,ability,enabled);
 const rows=[
  {label:'当前状态',value:reason?`不可施放：${reason}`:'可用'},
  ...(ability.cost?[{label:'消耗',value:ability.cost}]:[]),
  ...(ability.rangeText?[{label:'范围',value:ability.rangeText}]:[]),
  ...(ability.cooldown?[{label:'冷却',value:ability.cooldown}]:[]),
  ...(ability.reason&&ability.reason!==reason?[{label:'限制说明',value:ability.reason}]:[]),
 ];
 return `<div class="tb-compact-detail-content"><h3 class="tb-card-title">${esc(ability.label)}</h3><div class="tb-compact-detail-scroll" tabindex="0" data-focus="hud-detail-scroll" data-scroll-key="ability:${esc(id)}" aria-label="技能详情内容">${ability.description?`<p class="tb-compact-detail-note">${esc(ability.description)}</p>`:''}<dl class="tb-compact-detail-list">${rows.map(row=>`<div><dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`).join('')}</dl></div></div>`;
}

/** Text only: the caller escapes once when inserting this short contextual summary. */
export function hudAbilityContext(view:TacticalEncounterView,selection:SelectionState):string{
 if(selection.command!=='ability'||!selection.abilityId)return '';
 const ability=view.abilities.find(a=>a.id===selection.abilityId);if(!ability)return '';
 const reason=abilityUnavailableReason(view,ability,canCommand(view,selection));
 return [ability.label,ability.cost,ability.rangeText,ability.cooldown,reason?`不可施放：${reason}`:null].filter(Boolean).join(' · ');
}

export function hudAbilitySlotsHtml(view:TacticalEncounterView,selection:SelectionState,enabled:boolean,activeInfoId:string|null=null):string{
 return hudAbilities(view).map((a,i)=>{
  if(!a)return `<div class="tb-hud-empty" aria-label="${i===0?'未配置普通攻击':'未装配技能'}">${iconHtml('lock')}<span>${i===0?'未配置':'未装配'}</span></div>`;
  const unsupported=a.migration!=='supported',spent=view.budget.mainActionUsed;
  const reason=abilityUnavailableReason(view,a,enabled&&canCommand(view,selection)),available=!reason;
  const title=[a.label,a.description,a.rangeText,a.cost,a.cooldown,reason].filter(Boolean).join(' · ');
  const note=unsupported?'未开放':spent?'已出手':!a.available?a.cooldown??'不可用':'';
  const icon=a.iconSrc?'':iconHtml('swords',{size:32});
  return itemSlot({action:available?'ability':'ability-info',id:a.id,label:available?a.label:`${a.label}，不可施放：${reason}，查看技能详情`,src:a.iconSrc?esc(a.iconSrc):undefined,
   pressed:available&&selection.command==='ability'&&selection.abilityId===a.id,
   className:`tb-hud-slot${unsupported?' is-unsupported':''}`,title:available?title:undefined,
   attributes:{'data-focus':`cmd-ability-${a.id}`,'data-skill-available':available,'aria-keyshortcuts':i===0?'B':String(i),
    ...(!available?{'aria-expanded':activeInfoId===a.id,...(activeInfoId===a.id?{'aria-controls':'tb-hud-detail'}:{})}:{})},
   extra:`${componentArtHtml('panel')}${icon}<kbd class="tb-hud-key">${i===0?'B':i}</kbd><span class="tb-hud-slot-name">${esc(a.label)}</span>${note?`<span class="tb-hud-slot-note">${esc(note)}</span>`:''}`});
 }).join('');
}
