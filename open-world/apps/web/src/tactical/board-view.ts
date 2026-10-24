/**
 * 棋盘格与覆盖层（纯 HTML 字符串）。所有可达、路径、射程、影响范围都来自投影或服务端预览；
 * 这里只负责把它们画出来，并给每种状态配形状/文字线索，不只靠颜色。
 */
import {esc} from '../ui-components.ts';
import {cellKey,sameCell} from './contract.ts';
import type {TacticalCell,TacticalEncounterView,TacticalLegalMove} from './contract.ts';
import type {SelectionState} from './selection.ts';

export const DRESSING_ART:Record<string,{src:string;label:string;scale:number}>={
 tree:{src:'/art/open-world/five-islands/sprites/ow-art-mist-tree-wind.png',label:'树木',scale:1.5},
 rocks:{src:'/art/open-world/five-islands/sprites/ow-art-mist-rocks.png',label:'岩石',scale:1.05},
 boulder:{src:'/art/open-world/five-islands/sprites/ow-art-mist-boulder.png',label:'巨石',scale:1.1},
};
export const GROUND_ART='/art/open-world/five-islands/textures/ow-art-mist-ground-main.png';

export type BoardOverlay={
 reach:Map<string,TacticalLegalMove>;path:TacticalCell[]|null;pathKind:'hover'|'preview'|null;
 range:Set<string>;affected:Set<string>;target:TacticalCell|null;denied:{cell:TacticalCell;message:string}|null;
};
/** 由投影 + 选择状态推出要画的覆盖层（只挑选已有数据，不计算规则）。 */
export function boardOverlay(view:TacticalEncounterView,s:SelectionState):BoardOverlay{
 const reach=new Map<string,TacticalLegalMove>(),range=new Set<string>(),affected=new Set<string>();
 let path:TacticalCell[]|null=null,pathKind:BoardOverlay['pathKind']=null,denied:BoardOverlay['denied']=null;
 if(s.command==='move'){
  for(const m of view.legalMoves)reach.set(cellKey(m.cell),m);
  const p=s.preview;
  if(p?.ok&&p.kind==='move'){path=p.path;pathKind='preview';}
  else if(!s.target){const h=s.hover??s.cursor,m=h&&reach.get(cellKey(h));if(m){path=m.path;pathKind='hover';}}
 }
 if(s.command==='ability'&&s.preview?.ok&&s.preview.kind==='ability'){
  for(const c of s.preview.rangeCells)range.add(cellKey(c));
  for(const c of s.preview.affectedCells)affected.add(cellKey(c));
 }
 if(s.preview&&!s.preview.ok&&s.target)denied={cell:s.target,message:s.preview.denial.message};
 return {reach,path,pathKind,range,affected,target:s.target,denied};
}

function cellLabel(view:TacticalEncounterView,o:BoardOverlay,x:number,y:number){
 const c=view.board.cells[y*view.board.width+x],parts=[`第${x+1}列第${y+1}行`];
 const unit=view.units.find(u=>u.alive&&u.cell.x===x&&u.cell.y===y);
 if(unit)parts.push(`${unit.side==='hero'?'我方':'敌方'}${unit.name}，生命${unit.hp.current}/${unit.hp.max}`);
 if(c&&!c.walkable)parts.push(`${DRESSING_ART[c.dressing??'']?.label??'障碍'}，无法通行`);
 if(c?.hazard)parts.push(`${c.hazard.label}：${c.hazard.detail}`);
 const key=x+','+y,m=o.reach.get(key);
 if(m)parts.push(`可到达，移动步数：${m.cost}`);
 if(o.range.has(key))parts.push('在射程内');
 if(o.affected.has(key))parts.push('在影响范围内');
 if(sameCell(o.target,{x,y}))parts.push('当前目标');
 if(o.denied&&sameCell(o.denied.cell,{x,y}))parts.push(o.denied.message);
 return parts.join('，');
}

export function boardCellsHtml(view:TacticalEncounterView,s:SelectionState,o:BoardOverlay,cell:number){
 const pathIndex=new Map<string,number>();(o.path??[]).forEach((c,i)=>{if(i>0)pathIndex.set(cellKey(c),i);});
 const out:string[]=[];
 for(let y=0;y<view.board.height;y++)for(let x=0;x<view.board.width;x++){
  const c=view.board.cells[y*view.board.width+x],key=x+','+y,classes=['tb-cell'];
  const unit=view.units.find(u=>u.alive&&u.cell.x===x&&u.cell.y===y);
  if(!c.walkable)classes.push('is-blocked');
  if(c.hazard)classes.push('is-hazard');
  if(unit)classes.push(unit.side==='hero'?'has-hero':'has-enemy');
  if(unit&&unit.id===view.actorId)classes.push('is-actor');
  if(unit&&unit.id===s.inspectId)classes.push('is-inspect');
  if(o.reach.has(key))classes.push('is-reach');
  if(pathIndex.has(key))classes.push('is-path');
  if(o.range.has(key))classes.push('is-range');
  if(o.affected.has(key))classes.push('is-affected');
  if(sameCell(o.target,{x,y}))classes.push('is-target');
  if(o.denied&&sameCell(o.denied.cell,{x,y}))classes.push('is-denied');
  if(sameCell(s.cursor,{x,y}))classes.push('is-cursor');
  if(s.command==='move'&&c.walkable&&!unit&&!o.reach.has(key))classes.push('is-out');
  const art=c.dressing?DRESSING_ART[c.dressing]:undefined;
  const step=pathIndex.get(key);
  out.push(`<button type="button" class="${classes.join(' ')}" data-action="cell" data-x="${x}" data-y="${y}" data-focus="cell-${x}-${y}" tabindex="${sameCell(s.cursor,{x,y})?0:-1}" aria-label="${esc(cellLabel(view,o,x,y))}" style="--cx:${x};--cy:${y}">`+
   (art?`<img class="tb-dressing" src="${art.src}" alt="" draggable="false" style="--art-scale:${art.scale}">`:'')+
   (c.hazard?'<span class="tb-hazard-mark" aria-hidden="true">!</span>':'')+
   (step!==undefined?`<span class="tb-step" aria-hidden="true">${step}</span>`:o.reach.has(key)?'<span class="tb-reach-dot" aria-hidden="true"></span>':'')+
   (o.denied&&sameCell(o.denied.cell,{x,y})?'<span class="tb-denied-mark" aria-hidden="true">✕</span>':'')+
   '</button>');
 }
 return out.join('');
}

/** SVG 覆盖层：路径折线 + 箭头、目标准星。单位为格。 */
export function boardSvg(view:TacticalEncounterView,o:BoardOverlay,cell:number){
 const w=view.board.width*cell,h=view.board.height*cell,center=(c:TacticalCell)=>`${(c.x+.5)*cell},${(c.y+.5)*cell}`;
 const parts:string[]=[];
 if(o.path&&o.path.length>1){
  const points=o.path.map(center).join(' ');
  parts.push(`<polyline class="tb-path-under" points="${points}"/><polyline class="tb-path tb-path--${o.pathKind}" points="${points}" marker-end="url(#tb-arrow)"/>`);
 }
 if(o.target){
  const x=(o.target.x+.5)*cell,y=(o.target.y+.5)*cell,r=cell*.36;
  parts.push(`<g class="tb-reticle${o.denied?' is-denied':''}"><circle cx="${x}" cy="${y}" r="${r}"/><path d="M${x-r-6} ${y}h12M${x+r-6} ${y}h12M${x} ${y-r-6}v12M${x} ${y+r-6}v12"/></g>`);
 }
 return `<svg class="tb-overlay" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs><marker id="tb-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z"/></marker></defs>${parts.join('')}</svg>`;
}

export function fitCell(view:Pick<TacticalEncounterView,'board'>,width:number,height:number){
 return Math.max(40,Math.min(88,Math.floor(Math.min(width/view.board.width,height/view.board.height))));
}
