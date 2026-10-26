/**
 * 棋盘格与覆盖层（纯 HTML 字符串）。所有可达、路径、射程、影响范围都来自投影或服务端预览；
 * 这里只负责把它们画出来，并给每种状态配形状/文字线索，不只靠颜色。
 */
import {esc} from '../ui-components.ts';
import {cellKey,sameCell} from './contract.ts';
import type {TacticalCell,TacticalCellView,TacticalEncounterView,TacticalIntentView,TacticalLegalMove} from './contract.ts';
import type {SelectionState} from './selection.ts';

export const DRESSING_ART:Record<string,{src:string;label:string;scale:number}>={
 tree:{src:'/art/open-world/five-islands/sprites/ow-art-mist-tree-wind.png',label:'树木',scale:1.5},
 rocks:{src:'/art/open-world/five-islands/sprites/ow-art-mist-rocks.png',label:'岩石',scale:1.05},
 boulder:{src:'/art/open-world/five-islands/sprites/ow-art-mist-boulder.png',label:'巨石',scale:1.1},
};
import {PIXEL_DRESSING,pixelFloor,pixelSkin,pixelTile} from './pixel-skin.ts';
export const GROUND_ART='/art/open-world/five-islands/textures/ow-art-mist-ground-main.png';

/** Registered visual variants on already blocked cells; never adds collision. */
export function cellDressingArt(cell:TacticalCellView){
 if(!cell.walkable&&(!cell.dressing||cell.dressing==='rocks')){
  const variant=(cell.x*31+cell.y*17)%4;
  if(variant===0)return {src:'/art/open-world/plane-kits/props-contract/maze/pillar-362ac39bde66.png',label:'石柱',scale:.85};
  if(variant===1)return {src:'/art/open-world/five-islands/sprites/ow-art-mist-camp-cargo.png',label:'木箱',scale:.9};
  if(variant===2)return {src:'/art/open-world/five-islands/sprites/ow-art-mist-rocks-flat.png',label:'碎石',scale:1.05};
  return DRESSING_ART.rocks;
 }
 return cell.dressing?DRESSING_ART[cell.dressing]:undefined;
}

export type BoardOverlay={
 reach:Map<string,TacticalLegalMove>;path:TacticalCell[]|null;pathKind:'hover'|'preview'|null;
 range:Set<string>;affected:Set<string>;target:TacticalCell|null;denied:{cell:TacticalCell;message:string}|null;
 /** 格子型意图的危险格：key=cellKey → order */
 intentGrid:Map<string,{order:number;fizzled:boolean}>;
 /** 锁定型意图的预告线：[{line,order,fizzled}] */
 intentLines:{line:TacticalCell[];order:number;fizzled:boolean}[];
 /** 骷髅标记（预计击杀） */
 killMarks:Set<string>;
 /** 受伤预计量：cellKey → amount */
 damagePreview:Map<string,number>;
 /** 主角预计剩余生命（来自 forecast） */
 heroHpForecast:{remaining:number;max:number}|null;
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

 // 意图覆盖层
 const intentGrid=new Map<string,{order:number;fizzled:boolean}>();
 const intentLines:{line:TacticalCell[];order:number;fizzled:boolean}[]=[];
 for(const intent of view.intents??[]){
  if(intent.hidden)continue; // 隐藏意图只在侧栏和头顶显示"?"，棋盘上不泄露格子与路线
  if(intent.type==='grid'){for(const c of intent.cells)intentGrid.set(cellKey(c),{order:intent.order,fizzled:intent.fizzled});}
  else if((intent.type==='lock'||intent.type==='charge-windup')&&intent.line?.length)intentLines.push({line:intent.line,order:intent.order,fizzled:intent.fizzled});
 }

 // 预览结果（forecast）
 const killMarks=new Set<string>();
 const damagePreview=new Map<string,number>();
 let heroHpForecast:BoardOverlay['heroHpForecast']=null;
 const preview=s.preview;
 if(preview?.ok){
  const fc=preview.forecast;
  if(fc){
   for(const uid of fc.kills){const u=view.units.find(x=>x.id===uid&&x.alive);if(u)killMarks.add(cellKey(u.cell));}
   for(const d of fc.damage){const u=view.units.find(x=>x.id===d.unitId&&x.alive);if(u)damagePreview.set(cellKey(u.cell),d.amount);}
   if(fc.heroHpAfterIntents!==null&&fc.heroHpAfterIntents!==undefined)heroHpForecast={remaining:fc.heroHpAfterIntents,max:fc.heroMaxHp};
  }
 }

 return {reach,path,pathKind,range,affected,target:s.target,denied,intentGrid,intentLines,killMarks,damagePreview,heroHpForecast};
}

function cellLabel(view:TacticalEncounterView,o:BoardOverlay,x:number,y:number){
 const c=view.board.cells[y*view.board.width+x],parts=[`第${x+1}列第${y+1}行`];
 const unit=view.units.find(u=>u.alive&&u.cell.x===x&&u.cell.y===y);
 if(unit)parts.push(`${unit.side==='hero'?'我方':'敌方'}${unit.name}，生命${unit.hp.current}/${unit.hp.max}`);
 if(c&&!c.walkable)parts.push(`${(pixelSkin?PIXEL_DRESSING[c.dressing??'']:cellDressingArt(c))?.label??'障碍'}，无法通行`);
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
  const pix=pixelSkin&&c.dressing?PIXEL_DRESSING[c.dressing]??PIXEL_DRESSING.rocks:undefined;
  const art=pix?{src:pixelTile(pix.tile),scale:1}:cellDressingArt(c);
  const step=pathIndex.get(key);
  const intentG=o.intentGrid.get(key);
  if(intentG){classes.push(intentG.fizzled?'is-intent-grid-fizzled':'is-intent-grid');}
  if(o.killMarks.has(key))classes.push('is-kill-mark');
  const dmgPrev=o.damagePreview.get(key);
  out.push(`<button type="button" class="${classes.join(' ')}" data-action="cell" data-x="${x}" data-y="${y}" data-focus="cell-${x}-${y}" tabindex="${sameCell(s.cursor,{x,y})?0:-1}" aria-label="${esc(cellLabel(view,o,x,y))}" style="--cx:${x};--cy:${y}${pixelSkin?`;--floor:url('${pixelFloor(x,y)}')`:''}">`+
   (art?`<img class="tb-dressing" src="${art.src}" alt="" draggable="false" style="--art-scale:${art.scale}">`:'')+
   (c.hazard?'<span class="tb-hazard-mark" aria-hidden="true">!</span>':'')+
   (step!==undefined?`<span class="tb-step" aria-hidden="true">${step}</span>`:o.reach.has(key)?'<span class="tb-reach-dot" aria-hidden="true"></span>':'')+
   (o.denied&&sameCell(o.denied.cell,{x,y})?'<span class="tb-denied-mark" aria-hidden="true">✕</span>':'')+
   (intentG?`<span class="tb-intent-order" aria-hidden="true">${intentG.order}</span>`+
    (intentG.fizzled?'<span class="tb-intent-fizzle" aria-hidden="true">落空</span>':'')
   :'')+
   (o.killMarks.has(key)?'<span class="tb-kill-mark" aria-hidden="true">☠</span>':
    dmgPrev!==undefined?`<span class="tb-dmg-preview" aria-hidden="true">-${dmgPrev}</span>`:'')+
   '</button>');
 }
 return out.join('');
}

/** SVG 覆盖层：路径折线 + 箭头、目标准星、意图直线。单位为格。 */
export function boardSvg(view:TacticalEncounterView,o:BoardOverlay,cell:number,rowHeight=cell){
 const w=view.board.width*cell,h=view.board.height*rowHeight,center=(c:TacticalCell)=>`${(c.x+.5)*cell},${(c.y+.5)*rowHeight}`;
 const parts:string[]=[];
 if(o.path&&o.path.length>1){
  const points=o.path.map(center).join(' ');
  parts.push(`<polyline class="tb-path-under" points="${points}"/><polyline class="tb-path tb-path--${o.pathKind}" points="${points}" marker-end="url(#tb-arrow)"/>`);
 }
 if(o.target){
  const x=(o.target.x+.5)*cell,y=(o.target.y+.5)*rowHeight,r=cell*.36,ry=rowHeight*.36;
  parts.push(`<g class="tb-reticle${o.denied?' is-denied':''}"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${ry}"/><path d="M${x-r-6} ${y}h12M${x+r-6} ${y}h12M${x} ${y-ry-6}v12M${x} ${y+ry-6}v12"/></g>`);
 }
 // 意图直线（锁定型/冲锋型）
 for(const il of o.intentLines){
  if(il.line.length<2)continue;
  const points=il.line.map(center).join(' ');
  parts.push(`<polyline class="tb-intent-line${il.fizzled?' is-fizzled':''}" points="${points}" marker-end="url(#tb-intent-arrow-${il.fizzled?'fizzle':'lock'})"/>`);
 }
 return `<svg class="tb-overlay" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><defs>
<marker id="tb-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z"/></marker>
<marker id="tb-intent-arrow-lock" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--tb-intent-lock-color)"/></marker>
<marker id="tb-intent-arrow-fizzle" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--tb-intent-fizzle-color)"/></marker>
</defs>${parts.join('')}</svg>`;
}

export function fitCell(view:Pick<TacticalEncounterView,'board'>,width:number,height:number){
 // Larger encounters must fit the same stage; a minimum tile size cannot override its bounds.
 return Math.max(1,Math.min(88,Math.floor(Math.min(width/view.board.width,height/view.board.height))));
}
