import {describe,expect,it} from 'vitest';
import {unitLabelsHtml,unitLabelsLayout} from '../apps/web/src/tactical/unit-labels.ts';
import {labelRectsOverlap} from '../apps/web/src/tactical/unit-label-layout.ts';
import {initialSelection} from '../apps/web/src/tactical/selection.ts';
import {tacticalGeometry} from '../apps/web/src/tactical/board-layout.ts';
import type {TacticalEncounterView,TacticalIntentView,TacticalUnitView} from '../apps/web/src/tactical/contract.ts';

const unit=(id:string,x:number,y:number):TacticalUnitView=>({id,name:id,side:id==='hero'?'hero':'enemy',cell:{x,y},footprint:1,alive:true,
 hp:{current:60,max:100},shield:null,resource:null,statuses:[],art:{kind:'hero-native',assetId:'hero'},tier:'normal'});
const intent=(id:string):TacticalIntentView=>({unitId:id,order:1,type:'chase',cells:[],targetId:'hero',line:null,
 damage:{kind:'amount',value:9},fizzled:false,hidden:false,label:'追击 · 接近目标'});
const view=():TacticalEncounterView=>({source:'sandbox',encounterId:'labels',revision:1,ruleVersion:'test',protocolVersion:'test',
 node:{name:'n',objective:'o',enemyGroup:'g'},round:1,phase:'awaiting',actorId:'hero',actionToken:'turn',board:{width:10,height:8,cells:[]},
 units:[unit('hero',2,6),unit('enemy-a',5,3),unit('enemy-b',6,3),unit('enemy-c',6,4)],
 budget:{moveUsed:false,mainActionUsed:false,ended:false,moveSteps:3},abilities:[],legalMoves:[],pet:null,
 control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:null,warningMs:10000,serverNowMs:0,autoReason:null,canRequestAuto:true,canRequestManual:false},
 result:null,intents:[intent('enemy-a'),intent('enemy-b'),intent('enemy-c')],unsupported:[]});
const geometry={cell:84,rowHeight:46.2,width:840,height:369.6};

describe('combined tactical unit labels',()=>{
 it('does not move labels when inspecting, targeting or changing the current actor',()=>{
  const v=view(),selection=initialSelection({x:0,y:0}),before=unitLabelsLayout(v,selection,geometry);
  const selected={...selection,inspectId:'enemy-b',target:{x:6,y:3},command:'ability' as const,abilityId:'sweep'};
  expect(unitLabelsLayout(v,selected,geometry)).toEqual(before);
  expect(unitLabelsLayout({...v,actorId:'enemy-b',phase:'enemy'},selected,geometry)).toEqual(before);
 });
 it('uses one block per live unit and preserves cell targeting for ability selection',()=>{
  const v=view(),selection={...initialSelection({x:2,y:6}),command:'ability' as const,abilityId:'sweep'};
  v.units.push({...unit('dead',1,1),alive:false});
  const html=unitLabelsHtml(v,selection,geometry);
  expect([...html.matchAll(/class="tb-unit-label(?: |")/g)]).toHaveLength(4);
  expect(html).toContain('data-action="cell" data-x="6" data-y="3" data-unit="enemy-b" data-focus="unit-label-enemy-b"');
  expect(html).not.toContain('data-action="inspect"');
  expect(html).not.toContain('data-unit="dead"');
  expect(html).toContain('tb-unit-label-hp');
  expect(html).toContain('生命 60 / 100');
 });

 it('never serializes hidden intent details, including title and accessible text',()=>{
  const v=view();
  v.intents=[{...intent('enemy-a'),hidden:true,label:'SECRET_DIRECTION',damage:{kind:'amount',value:987654321},
   cells:[{x:654321,y:765432}],line:[{x:876543,y:987654}],tier:'lethal'}];
  const html=unitLabelsHtml(v,initialSelection({x:0,y:0}),geometry);
  expect(html).toContain('意图未知');
  expect(html).toContain('tb-unit-label-intent">?</span>');
  for(const secret of ['SECRET_DIRECTION','987654321','654321','765432','876543','987654','致命'])expect(html).not.toContain(secret);
 });

 it('replaces the third line with source forecast without adding a separate overlapping pill',()=>{
  const v=view(),selection={...initialSelection({x:0,y:0}),command:'ability' as const,abilityId:'sweep',
   preview:{ok:true as const,kind:'ability' as const,abilityId:'sweep',target:{x:5,y:3},rangeCells:[],affectedCells:[],targets:[],known:[],uncertain:[],notes:[],
    forecast:{kills:['enemy-a'],damage:[{unitId:'enemy-a',amount:60},{unitId:'enemy-b',amount:15}],heroHpAfterIntents:45,heroMaxHp:100}}};
  const html=unitLabelsHtml(v,selection,geometry);
  expect(html).toContain('预计击杀');
  expect(html).toContain('预计 −15');
  expect(html).toContain('预估生命 45');
  expect(html).toContain('意图 1，追击 · 接近目标，预计伤害 9');
  expect(html).not.toContain('tb-preview-label');
  expect(unitLabelsHtml(v,{...selection,previewPending:true},geometry)).not.toContain('预计击杀');
 });

 it('keeps dense labels separate and outside actor bodies inside the projected viewport',()=>{
  const v=view(),before=structuredClone(v),selection=initialSelection({x:0,y:0});
  const layout=unitLabelsLayout(v,selection,geometry);
  expect(layout.unplaced).toEqual([]);
  for(let i=0;i<layout.placed.length;i++){
   const label=layout.placed[i];
   expect(label.y).toBeGreaterThanOrEqual(0);
   expect(label.y+label.height).toBeLessThanOrEqual(geometry.height);
   expect(label.x).toBeGreaterThanOrEqual(-geometry.cell/2);
   expect(label.x+label.width).toBeLessThanOrEqual(geometry.width+geometry.cell/2);
   for(let j=i+1;j<layout.placed.length;j++)expect(labelRectsOverlap(label,layout.placed[j],tacticalGeometry.labelGap)).toBe(false);
   for(const u of v.units){const foot={x:(u.cell.x+.5)*geometry.cell,y:(u.cell.y+.82)*geometry.rowHeight};
    expect(labelRectsOverlap(label,{x:foot.x-geometry.cell/2,y:foot.y-geometry.cell*1.05,width:geometry.cell,height:geometry.cell*1.05},tacticalGeometry.labelGap)).toBe(false);
   }
  }
  expect(v).toEqual(before);
 });

 it('keeps every unit accessible through numbered fallback when the label area is too small',()=>{
  const v=view(),small={cell:20,rowHeight:10,width:80,height:20};
  v.board={width:4,height:2,cells:[]};
  v.units=v.units.map((u,index)=>({...u,cell:{x:index,y:index===3?1:0}}));
  const html=unitLabelsHtml(v,initialSelection({x:0,y:0}),small);
  expect(html).toContain('tb-unit-label-fallback-list');
  expect([...html.matchAll(/class="tb-unit-label-marker"/g)]).toHaveLength(4);
  expect(html).toContain('data-focus="unit-label-list-enemy-a"');
  expect(html).toContain('生命 60 / 100');
  expect(html).toContain('意图 1，追击 · 接近目标，预计伤害 9');
 });

 it('escapes source text and includes real shield values only in the combined label/details',()=>{
  const v=view();v.units[0].name='<img src=x onerror=alert(1)>';v.units[0].shield=17;
  v.intents[0].label='<script>bad()</script>';
  const html=unitLabelsHtml(v,initialSelection({x:0,y:0}),geometry);
  expect(html).not.toContain('<img src=x');expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).toContain('当前护盾 17');expect(html).toContain('护盾 17');
  expect(html).not.toContain('tb-shield-tag');
 });
});
