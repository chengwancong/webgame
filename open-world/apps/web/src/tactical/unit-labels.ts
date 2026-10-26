/** Combined world labels: one measured block per unit, all values source-owned. */
import {esc} from '../ui-components.ts';
import {cellFoot,tacticalGeometry} from './board-layout.ts';
import type {BoardDisplayLayout} from './board-layout.ts';
import type {TacticalEncounterView,TacticalIntentView,TacticalUnitView} from './contract.ts';
import {sameCell} from './contract.ts';
import {hudActorId} from './hud.ts';
import type {SelectionState} from './selection.ts';
import {layoutUnitLabels} from './unit-label-layout.ts';
import type {LabelRect,UnitLabelLayout,UnitLabelPlacement} from './unit-label-layout.ts';

type LabelTone='neutral'|'danger'|'warning'|'preview';
type UnitLabelContent={unit:TacticalUnitView;line:string;tone:LabelTone;detail:string;fizzled:boolean};

function intentText(intent:TacticalIntentView):{short:string;full:string;tone:LabelTone}{
 // Do not read or serialize a hidden intent's label, amount, tier, cells or line.
 if(intent.hidden)return {short:'?',full:'意图未知',tone:'neutral'};
 const damage=intent.damage
  ?intent.damage.kind==='amount'?String(intent.damage.value):({light:'轻',heavy:'重',lethal:'致命'}[intent.damage.tier])
  :'';
 const label=intent.label.replace(/\s*·.*$/,'');
 const state=intent.fizzled?'已落空':'';
 return {
  short:[intent.order,label,damage,state].filter(value=>value!==''&&value!==null).join(' '),
  full:[`意图 ${intent.order}`,intent.label,damage?`预计伤害 ${damage}`:'',state].filter(Boolean).join('，'),
  tone:intent.type==='move-only'?'neutral':intent.type==='buff'||intent.type==='summon'?'warning':'danger',
 };
}

function content(view:TacticalEncounterView,selection:SelectionState,unit:TacticalUnitView):UnitLabelContent{
 const intents=view.intents.filter(intent=>intent.unitId===unit.id).slice().sort((a,b)=>a.order-b.order);
 const summaries=intents.map(intentText),first=summaries[0];
 let line=first?.short??(unit.shield!==null&&unit.shield>0?`护盾 ${unit.shield}`:''),tone:LabelTone=first?.tone??'neutral';
 let forecastDetail='';
 const forecast=selection.command!=='none'&&!selection.previewPending&&selection.preview?.ok?selection.preview.forecast:undefined;
 if(forecast){
  const damage=forecast.damage.find(row=>row.unitId===unit.id);
  if(forecast.kills.includes(unit.id)){line='预计击杀';tone='preview';forecastDetail='预览结果：预计击杀';}
  else if(damage){line=`预计 −${damage.amount}`;tone='preview';forecastDetail=`预览结果：预计伤害 ${damage.amount}`;}
  else if(unit.side==='hero'&&forecast.heroHpAfterIntents!==null){
   line=`预估生命 ${forecast.heroHpAfterIntents}`;tone='preview';forecastDetail=`敌方意图执行后预估生命 ${forecast.heroHpAfterIntents} / ${forecast.heroMaxHp}`;
  }
 }
 const detail=[unit.name,`生命 ${unit.hp.current} / ${unit.hp.max}`,
  unit.shield!==null?`当前护盾 ${unit.shield}`:'',...summaries.map(summary=>summary.full),forecastDetail].filter(Boolean).join('；');
 return {unit,line,tone,detail,fizzled:!!intents[0]&&!intents[0].hidden&&intents[0].fizzled&&!forecastDetail};
}

/** Exposed for geometry checks and source-built previews; never alters unit cells. */
export function unitLabelsLayout(view:TacticalEncounterView,selection:SelectionState,geometry:BoardDisplayLayout):UnitLabelLayout{
 const units=view.units.filter(unit=>unit.alive);
 const bounds={x:-geometry.cell/2,y:0,width:geometry.width+geometry.cell,height:geometry.height};
 const spriteHeight=geometry.cell*1.05;
 const bodies:LabelRect[]=units.map(unit=>{
  const foot=cellFoot(unit.cell,geometry);
  return {x:foot.x-geometry.cell/2,y:foot.y-spriteHeight,width:geometry.cell,height:spriteHeight};
 });
 const labels=units.map(unit=>{
  const foot=cellFoot(unit.cell,geometry);
  return {id:unit.id,anchor:{x:foot.x,y:Math.max(0,foot.y-spriteHeight)},width:tacticalGeometry.labelWidth,height:tacticalGeometry.labelHeight,
   // Selection and current-turn highlights must not move a label under the pointer.
   priority:unit.side==='hero'?1:0};
 });
 return layoutUnitLabels(labels,{bounds,gap:tacticalGeometry.labelGap,obstacles:bodies});
}

function attributes(data:UnitLabelContent,focusPrefix='unit-label-'):string{
 const u=data.unit;
 return `type="button" data-action="cell" data-x="${u.cell.x}" data-y="${u.cell.y}" data-unit="${esc(u.id)}" data-focus="${focusPrefix}${esc(u.id)}" title="${esc(data.detail)}" aria-label="${esc(data.detail)}"`;
}
function inner(data:UnitLabelContent):string{
 const u=data.unit,pct=Math.max(0,Math.min(100,u.hp.current/Math.max(1,u.hp.max)*100));
 return `<span class="tb-unit-label-name">${esc(u.name)}</span><span class="tb-unit-label-hp" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="tb-unit-label-intent${data.fizzled?' is-fizzled':''}">${data.line?esc(data.line):'&#160;'}</span>`;
}
function block(data:UnitLabelContent,placement:UnitLabelPlacement,view:TacticalEncounterView,selection:SelectionState):string{
 const current=hudActorId(view),u=data.unit;
 return `<button class="tb-unit-label${current===u.id?' is-current':''}${selection.inspectId===u.id?' is-inspected':''}${sameCell(selection.target,u.cell)?' is-target':''}" data-side="${u.side}" data-tone="${data.tone}" ${attributes(data)} style="left:${placement.x}px;top:${placement.y}px;width:${placement.width}px;height:${placement.height}px">${inner(data)}</button>`;
}

export function unitLabelsHtml(view:TacticalEncounterView,selection:SelectionState,geometry:BoardDisplayLayout):string{
 const data=view.units.filter(unit=>unit.alive).map(unit=>content(view,selection,unit));
 if(!data.length)return '';
 const byId=new Map(data.map(row=>[row.unit.id,row])),layout=unitLabelsLayout(view,selection,geometry);
 const lines=layout.placed.filter(label=>label.displaced).map(label=>`<line x1="${label.leader.from.x}" y1="${label.leader.from.y}" x2="${label.leader.to.x}" y2="${label.leader.to.y}"/>`).join('');
 const leaders=lines?`<svg class="tb-unit-label-leaders" aria-hidden="true" viewBox="${-geometry.cell/2} 0 ${geometry.width+geometry.cell} ${geometry.height}" style="left:${-geometry.cell/2}px;width:${geometry.width+geometry.cell}px;height:${geometry.height}px">${lines}</svg>`:'';
 const placed=layout.placed.map(label=>block(byId.get(label.id)!,label,view,selection)).join('');
 let fallback='';
 if(layout.unplaced.length){
  const rows=layout.unplaced.map((label,index)=>({data:byId.get(label.id)!,number:index+1}));
  const markers=rows.map(({data,number})=>{
   const foot=cellFoot(data.unit.cell,geometry),y=Math.max(0,Math.min(geometry.height-tacticalGeometry.labelHeight,foot.y-geometry.cell*1.05));
   return `<button class="tb-unit-label-marker" ${attributes(data)} style="left:${foot.x}px;top:${y}px">${number}</button>`;
  }).join('');
  const list=rows.map(({data,number})=>`<li><button class="tb-unit-label-fallback-row" data-side="${data.unit.side}" data-tone="${data.tone}" ${attributes(data,'unit-label-list-')}><b>${number}</b><span>${inner(data)}</span></button></li>`).join('');
  fallback=`${markers}<aside class="tb-unit-label-fallback-list" aria-label="密集单位详情"><ol>${list}</ol></aside>`;
 }
 return `<div class="tb-unit-labels">${leaders}${placed}${fallback}</div>`;
}
