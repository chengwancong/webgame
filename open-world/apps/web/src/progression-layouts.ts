import type {ProgressionView} from '../../../packages/contracts/deep-progression.ts';
import {esc,itemSlot,pipsHtml,meterHtml,iconHtml,statusBadgeHtml,type SlotMark,type NodeState} from './ui-components.ts';
type Section=ProgressionView['sections'][number];
const stateOf=(item:Section['items'][number]):NodeState=>item.state==='learned'&&item.rank!==undefined&&item.rank===item.max?'maxed':item.state??'locked';
const stateMarks=(item:Section['items'][number]):SlotMark[]=>item.state==='locked'?[{corner:'tr',kind:'lock',label:item.operations.find(o=>!o.enabled)?.reason||'未解锁'}]:stateOf(item)==='maxed'?[{corner:'tr',kind:'check',label:'已达最高档'}]:[];
export function paragonBoardHtml(section:Section,selected:string):string|undefined{
 if(!section.items.length||!section.items.every(i=>i.x!==undefined&&i.y!==undefined&&i.board!==undefined&&i.requires!==undefined&&i.state!==undefined))return undefined;
 const boards=[...new Set(section.items.map(i=>i.board!))].sort((a,b)=>a-b);
 return `<div class="paragon-boards">${boards.map(board=>{
  const nodes=section.items.filter(i=>i.board===board),width=Math.max(...nodes.map(i=>i.x!))+1,height=Math.max(...nodes.map(i=>i.y!))+1;
  const links=nodes.flatMap(node=>node.requires!.flatMap(id=>{const previous=nodes.find(i=>i.id===id);return previous?[`<line x1="${previous.x!+.5}" y1="${previous.y!+.5}" x2="${node.x!+.5}" y2="${node.y!+.5}" class="${node.state==='learned'?'is-learned':''}"/>`]:[]})).join('');
  const bridge=nodes.flatMap(i=>i.requires!).filter(id=>!nodes.some(i=>i.id===id)).map(id=>section.items.find(i=>i.id===id));
  return `<section class="paragon-board"><h4>巅峰盘 ${board+1}</h4>${bridge.length?`<span class="paragon-bridge">${bridge.map(i=>iconHtml('link',{size:20,label:'连接：'+(i?.name??'前一盘')})).join('')}</span>`:''}<div class="paragon-board-grid" style="--board-columns:${width};--board-rows:${height}"><svg class="paragon-links" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${links}</svg>${nodes.map(node=>`<div class="paragon-node-position" style="grid-column:${node.x!+1};grid-row:${node.y!+1}">${itemSlot({action:'progression-item',id:node.id,label:node.name+'，'+node.status+(node.slottedGlyph?'，'+node.slottedGlyph.name:'')+'，'+node.description,title:node.name+'，'+node.status+(node.slottedGlyph?'，'+node.slottedGlyph.name:'')+'，'+node.description,pressed:node.id===selected,className:'ui-progression-node ui-node'+(node.socket?' ui-node--socket':''),state:stateOf(node),marks:[...stateMarks(node),...(node.slottedGlyph?[{corner:'br',kind:'level',value:node.slottedGlyph.rank,label:node.slottedGlyph.name+'，等级 '+node.slottedGlyph.rank} as SlotMark]:[])],extra:iconHtml(node.socket?'diamond':'plus',{size:24})})}</div>`).join('')}</div></section>`;
 }).join('')}</div>`;
}
export function glyphCardsHtml(section:Section,selected:string):string|undefined{
 if(!section.items.length||!section.items.every(i=>i.rank!==undefined&&i.max!==undefined&&i.state!==undefined&&i.board!==undefined&&i.radius!==undefined))return undefined;
 return `<div class="glyph-cards">${section.items.map(i=>itemSlot({action:'progression-item',id:i.id,label:`${i.name}，${i.status}，半径 ${i.radius} 格，巅峰盘 ${i.board!+1}`,title:`${i.name}，${i.rank}/${i.max}，半径 ${i.radius} 格，巅峰盘 ${i.board!+1}`,pressed:i.id===selected,className:'ui-progression-node ui-progression-node--card ui-card',state:stateOf(i),marks:stateMarks(i),extra:`<b class="ui-card__name">${esc(i.name)}</b>${pipsHtml({value:i.rank!,max:i.max!,label:i.name+'等级'})}<span class="ui-node-meta">${iconHtml('skillRadius',{size:16})}<b>${i.radius}</b><span class="ui-board-number" title="巅峰盘 ${i.board!+1}">${i.board!+1}</span></span>`})).join('')}</div>`;
}
export function stageTracksHtml(section:Section,selected:string):string|undefined{
 if(!section.items.length||!section.items.every(i=>i.rank!==undefined&&i.max!==undefined&&i.stages!==undefined))return undefined;
 return `<div class="progression-tracks">${section.items.map(i=>itemSlot({action:'progression-item',id:i.id,label:i.name+'，'+i.status,title:i.name+'，'+i.status,pressed:i.id===selected,className:'ui-progression-node ui-progression-node--track ui-card',state:stateOf(i),marks:stateMarks(i),extra:`<b class="ui-card__name">${esc(i.name)}</b><span class="ui-stage-track" aria-label="${esc(i.name)}进度">${i.stages!.map(step=>`<span class="ui-stage-step" data-state="${step.state}" title="${esc(step.label)}" aria-label="${esc(step.label)}，${step.state==='learned'?'已完成':step.state==='available'?'可进行':'未解锁'}">${iconHtml(step.state==='learned'?'check':step.state==='locked'?'lock':'diamond',{size:16})}</span>`).join('')}</span>`})).join('')}</div>`;
}
export function reputationCardsHtml(section:Section,selected:string):string|undefined{
 if(!section.items.length||!section.items.every(i=>i.rank!==undefined&&i.max!==undefined&&i.currentValue!==undefined&&i.nextValue!==undefined&&i.progressRatio!==undefined&&i.rewardTiers!==undefined))return undefined;
 return `<div class="reputation-regions">${section.items.map(i=>{
  const rankName=i.status.split(' · ')[0],maximum=i.rewardTiers!.at(-1)?.required??i.nextValue??i.currentValue!,progress=i.nextValue===null?'已达最高档':`${i.currentValue} / ${i.nextValue}`;
  return itemSlot({action:'progression-item',id:i.id,label:i.name+'，'+i.status+'，'+progress,title:i.name+'，'+i.status+'，'+progress,pressed:i.id===selected,className:'ui-progression-node ui-progression-node--track ui-card',state:stateOf(i),marks:stateMarks(i),extra:`<span class="reputation-card-heading"><b class="ui-card__name">${esc(i.name)}</b>${statusBadgeHtml(rankName,'neutral')}</span>${meterHtml({value:i.currentValue!,max:maximum,label:i.name+'声望',valueText:'none',ticks:i.rewardTiers!.map(t=>t.required),markers:i.rewardTiers!.map(t=>({at:t.required,icon:'chest',state:t.state,label:t.name+'，声望 '+t.required+'，'+(t.state==='learned'?'已领取':t.state==='available'?'可领取':'未解锁')}))})}<span class="reputation-progress-label">${esc(progress)}</span>`});
 }).join('')}</div>`;
}
