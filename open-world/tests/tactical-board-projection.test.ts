import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {cellFoot,fitSceneBoard} from '../apps/web/src/tactical/board-layout.ts';
import {boardCellsHtml,boardOverlay,boardSvg,cellDressingArt,fitCell} from '../apps/web/src/tactical/board-view.ts';
import {initialSelection} from '../apps/web/src/tactical/selection.ts';
import type {TacticalCell,TacticalEncounterView} from '../apps/web/src/tactical/contract.ts';

const tokens=JSON.parse(readFileSync(new URL('../packages/ui-tokens/tokens.json',import.meta.url),'utf8')) as {
 Size:Record<string,string>;Space:Record<string,string>;
};
const px=(value:string)=>Number.parseFloat(value);
const stage={width:px(tokens.Size.UiQaStageWidth),height:px(tokens.Size.UiQaStageHeight)};
const available={width:stage.width-px(tokens.Space['6'])-px(tokens.Size.TacticalSceneRight),
 height:stage.height-px(tokens.Size.TacticalBoardTop)-px(tokens.Size.TacticalBoardBottom)};

function encounter(width=9,height=7):TacticalEncounterView{
 const blocked=new Set(['0,1','1,1','2,1','3,1']);
 const hero={x:1,y:height-2},enemy={x:width-2,y:1};
 return {source:'sandbox',encounterId:'projection-test',revision:1,ruleVersion:'test',protocolVersion:'test',
  node:{name:'n',objective:'o',enemyGroup:'g'},round:1,phase:'awaiting',actorId:'hero',actionToken:'action',
  board:{width,height,cells:Array.from({length:width*height},(_,index)=>{
   const x=index%width,y=Math.floor(index/width),isBlocked=blocked.has(`${x},${y}`);
   return {x,y,walkable:!isBlocked,blocksSight:isBlocked,revealed:true,hazard:null,dressing:isBlocked?'rocks':null};
  })},
  units:[{id:'hero',side:'hero',name:'行者',cell:hero,footprint:1,alive:true,hp:{current:90,max:100},shield:0,resource:null,statuses:[],art:{kind:'hero-native',assetId:'hero'},tier:'normal'},
   {id:'enemy',side:'enemy',name:'守卫',cell:enemy,footprint:1,alive:true,hp:{current:50,max:50},shield:0,resource:null,statuses:[],art:{kind:'starsea-atlas',assetId:'guard'},tier:'normal'}],
  budget:{moveUsed:false,mainActionUsed:false,ended:false,moveSteps:3},abilities:[],legalMoves:[],pet:null,
  control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:null,warningMs:10000,serverNowMs:0,autoReason:null,canRequestAuto:true,canRequestManual:false},
  result:null,intents:[],unsupported:[]};
}
function preview(view:TacticalEncounterView){
 const from=view.units[0].cell,path=[from,{x:from.x+1,y:from.y},{x:from.x+2,y:from.y-1}],destination=path.at(-1)!;
 return {...initialSelection(from),command:'move' as const,target:destination,
  preview:{ok:true as const,kind:'move' as const,destination,path,steps:2,notes:[]}};
}
const attribute=(tag:string,name:string)=>new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1]??'';
const points=(value:string)=>value.split(' ').map(pair=>pair.split(',').map(Number));
function renderedCells(html:string){
 return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match=>({
  x:Number(attribute(match[1],'data-x')),y:Number(attribute(match[1],'data-y')),
  action:attribute(match[1],'data-action'),focus:attribute(match[1],'data-focus'),
  aria:attribute(match[1],'aria-label'),tabindex:attribute(match[1],'tabindex'),classes:attribute(match[1],'class'),body:match[2],
 }));
}

describe('tactical display projection preserves the logical board',()=>{
 it.each([{width:9,height:7},{width:9,height:9},{width:10,height:10}])(
  'fits the real $width × $height board into the 1280×720 battlefield allocation',board=>{
   const view=encounter(board.width,board.height),before=structuredClone(view);
   const layout=fitSceneBoard(view,available.width,available.height);
   expect(stage).toEqual({width:1280,height:720});
   expect(layout.width).toBeLessThanOrEqual(available.width);
   expect(layout.height).toBeLessThanOrEqual(available.height);
   expect(px(tokens.Size.TacticalBoardTop)+layout.height).toBeLessThanOrEqual(stage.height-px(tokens.Size.TacticalBoardBottom));
   expect(layout.rowHeight).toBeLessThan(layout.cell);
   expect(layout.cell).toBeGreaterThan(fitCell(view,available.width,available.height));
   expect(layout.width).toBeCloseTo(board.width*layout.cell);
   expect(layout.height).toBeCloseTo(board.height*layout.rowHeight);
   const headerBottom=px(tokens.Space['4'])+px(tokens.Space['12'])+px(tokens.Space['2'])+px(tokens.Space['16']);
   const firstRowHead=px(tokens.Size.TacticalBoardTop)+layout.rowHeight*.82-layout.cell*1.05;
   expect(firstRowHead).toBeGreaterThanOrEqual(headerBottom);
   expect(view).toEqual(before);
  },
 );

 it('positions feet in projected rows while retaining cell identity and horizontal pitch',()=>{
  const view=encounter(),layout=fitSceneBoard(view,available.width,available.height),cell={x:3,y:4},before={...cell};
  const foot=cellFoot(cell,layout),right=cellFoot({x:4,y:4},layout),down=cellFoot({x:3,y:5},layout);
  expect(foot.x).toBeCloseTo((cell.x+.5)*layout.cell);
  expect(foot.y).toBeCloseTo((cell.y+.82)*layout.rowHeight);
  expect(foot.y).toBeGreaterThan(cell.y*layout.rowHeight);
  expect(foot.y).toBeLessThan((cell.y+1)*layout.rowHeight);
  expect(right.x-foot.x).toBeCloseTo(layout.cell);
  expect(right.y).toBeCloseTo(foot.y);
  expect(down.y-foot.y).toBeCloseTo(layout.rowHeight);
  expect(down.x).toBeCloseTo(foot.x);
  expect(cell).toEqual(before);
 });

 it('projects path, reticle and public intent endpoints using rowHeight rather than square-cell height',()=>{
  const view=encounter(),selection=preview(view),layout=fitSceneBoard(view,available.width,available.height);
  view.intents=[{unitId:'enemy',order:1,type:'lock',cells:[],targetId:'hero',line:[view.units[1].cell,view.units[0].cell],
   damage:{kind:'amount',value:10},fizzled:false,hidden:false,label:'锁定'},
  {unitId:'enemy',order:2,type:'lock',cells:[],targetId:null,line:[{x:987654,y:987654},{x:987655,y:987655}],
   damage:{kind:'amount',value:999999},fizzled:false,hidden:true,label:'HIDDEN'}];
  const before=structuredClone({view,selection}),overlay=boardOverlay(view,selection),svg=boardSvg(view,overlay,layout.cell,layout.rowHeight);
  const project=(cell:TacticalCell)=>[(cell.x+.5)*layout.cell,(cell.y+.5)*layout.rowHeight];
  const path=/class="tb-path tb-path--preview" points="([^"]+)"/.exec(svg)?.[1];
  expect(path).toBeDefined();
  const plotted=points(path!);
  selection.preview.path.forEach((cell,index)=>{
   expect(plotted[index][0]).toBeCloseTo(project(cell)[0]);expect(plotted[index][1]).toBeCloseTo(project(cell)[1]);
  });
  const line=/class="tb-intent-line" points="([^"]+)"/.exec(svg)?.[1];
  expect(points(line!)[1][1]).toBeCloseTo(project(view.units[0].cell)[1]);
  expect(svg).not.toContain('987654');expect(svg).not.toContain('987655');expect(svg).not.toContain('HIDDEN');
  const ellipse=/<ellipse\b([^>]+)>/.exec(svg)?.[1]??'';
  const cx=Number(attribute(ellipse,'cx')),cy=Number(attribute(ellipse,'cy')),rx=Number(attribute(ellipse,'rx')),ry=Number(attribute(ellipse,'ry'));
  expect([cx,cy]).toEqual(project(selection.target));
  expect(ry/rx).toBeCloseTo(layout.rowHeight/layout.cell);
  const reticle=/<g class="tb-reticle"><ellipse[^>]+><path d="([^"]+)"/.exec(svg)?.[1]??'';
  const vertical=[...reticle.matchAll(/M([\d.-]+) ([\d.-]+)v12/g)].map(match=>[Number(match[1]),Number(match[2])]);
  expect(vertical).toHaveLength(2);
  expect(vertical[0][0]).toBeCloseTo(cx);expect(vertical[1][0]).toBeCloseTo(cx);
  expect(vertical[0][1]+6).toBeCloseTo(cy-ry);expect(vertical[1][1]+6).toBeCloseTo(cy+ry);
  expect(svg).toContain(`viewBox="0 0 ${layout.width} ${layout.height}"`);
  expect({view,selection}).toEqual(before);
 });

 it.each([{width:9,height:7},{width:9,height:9},{width:10,height:10}])(
  'renders every logical cell and identical action/ARIA coordinates under either projection for $width × $height',board=>{
   const view=encounter(board.width,board.height),selection=preview(view),before=structuredClone({view,selection});
   const overlay=boardOverlay(view,selection),layout=fitSceneBoard(view,available.width,available.height);
   const square=renderedCells(boardCellsHtml(view,selection,overlay,fitCell(view,available.width,available.height)));
   const projected=renderedCells(boardCellsHtml(view,selection,overlay,layout.cell));
   expect(projected).toHaveLength(board.width*board.height);
   expect(new Set(projected.map(cell=>`${cell.x},${cell.y}`)).size).toBe(board.width*board.height);
   expect(projected).toEqual(square);
   for(const cell of projected){
    expect(cell.action).toBe('cell');expect(cell.focus).toBe(`cell-${cell.x}-${cell.y}`);
    expect(cell.aria).toContain(`第${cell.x+1}列第${cell.y+1}行`);
   }
   expect(projected.filter(cell=>cell.tabindex==='0')).toHaveLength(1);
   expect({view,selection}).toEqual(before);
  },
 );

 it('varies only source-blocked dressing and never introduces an impassable cell',()=>{
  const view=encounter(),selection=preview(view),before=structuredClone(view);
  const rendered=renderedCells(boardCellsHtml(view,selection,boardOverlay(view,selection),80));
  const declared=view.board.cells.filter(cell=>!cell.walkable).map(cell=>`${cell.x},${cell.y}`);
  const blocked=rendered.filter(cell=>cell.classes.split(' ').includes('is-blocked')).map(cell=>`${cell.x},${cell.y}`);
  expect(blocked).toEqual(declared);
  for(const cell of rendered){
   const source=view.board.cells[cell.y*view.board.width+cell.x];
   if(!source.walkable){expect(cell.body).toContain('class="tb-dressing"');expect(cell.aria).toContain('无法通行');}
   else{expect(cell.body).not.toContain('class="tb-dressing"');expect(cell.aria).not.toContain('无法通行');}
  }
  expect(new Set(view.board.cells.filter(cell=>!cell.walkable).map(cell=>cellDressingArt(cell)?.src)).size).toBe(4);
  expect(view).toEqual(before);
 });
});
