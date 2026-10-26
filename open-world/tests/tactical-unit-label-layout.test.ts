import {describe,expect,it} from 'vitest';
import {labelRectsOverlap,layoutUnitLabels} from '../apps/web/src/tactical/unit-label-layout.ts';
import type {LabelRect,UnitLabelRequest} from '../apps/web/src/tactical/unit-label-layout.ts';

const bounds:LabelRect={x:0,y:0,width:900,height:460};
const request=(id:string,x:number,y:number,priority=0):UnitLabelRequest=>({id,anchor:{x,y},width:104,height:48,priority});
function expectLayoutFits(layout:ReturnType<typeof layoutUnitLabels>,area:LabelRect,gap:number){
 for(const label of layout.placed){
  expect(label.x).toBeGreaterThanOrEqual(area.x);
  expect(label.y).toBeGreaterThanOrEqual(area.y);
  expect(label.x+label.width).toBeLessThanOrEqual(area.x+area.width);
  expect(label.y+label.height).toBeLessThanOrEqual(area.y+area.height);
 }
 for(let i=0;i<layout.placed.length;i++)for(let j=i+1;j<layout.placed.length;j++){
  expect(labelRectsOverlap(layout.placed[i],layout.placed[j],gap)).toBe(false);
 }
}

describe('combined tactical unit-label layout',()=>{
 it('keeps isolated labels centered above their unit and returns a line attachment',()=>{
  const result=layoutUnitLabels([request('hero',300,200)],{bounds,gap:8});
  expect(result.unplaced).toEqual([]);
  expect(result.placed[0]).toMatchObject({id:'hero',x:248,y:144,width:104,height:48,displaced:false,
   leader:{from:{x:300,y:192},to:{x:300,y:200}}});
 });

 it('separates the adjacent and same-column enemies shown in the reported crowded encounter',()=>{
  const units=[request('hero',780,410),request('guard-a',410,220),request('guard-b',458,220),
   request('guard-c',458,268),request('guard-d',410,268),request('support',434,316)];
  const result=layoutUnitLabels(units,{bounds,gap:8});
  expect(result.placed).toHaveLength(units.length);
  expect(result.unplaced).toEqual([]);
  expect(result.placed.some(label=>label.displaced)).toBe(true);
  expectLayoutFits(result,bounds,8);
 });

 it('clamps edge units into the real label viewport and retains their true anchor',()=>{
  const area={x:16,y:100,width:1100,height:420};
  const result=layoutUnitLabels([request('top-left',16,100),request('bottom-right',1116,520)],{bounds:area,gap:6});
  expectLayoutFits(result,area,6);
  expect(result.placed.find(label=>label.id==='top-left')?.anchor).toEqual({x:16,y:100});
  expect(result.placed.find(label=>label.id==='bottom-right')?.leader.to).toEqual({x:1116,y:520});
 });

 it('respects reserved actor silhouettes and leaves combat geometry untouched',()=>{
  const units=[request('a',200,200),request('b',260,200)];
  const obstacles=[{x:140,y:140,width:200,height:100}];
  const before=structuredClone({units,obstacles});
  const result=layoutUnitLabels(units,{bounds,gap:8,obstacles});
  expect(result.unplaced).toEqual([]);
  expectLayoutFits(result,bounds,8);
  for(const label of result.placed)for(const obstacle of obstacles)expect(labelRectsOverlap(label,obstacle,8)).toBe(false);
  expect({units,obstacles}).toEqual(before);
 });

 it('uses stable priorities and IDs, independent of source array order',()=>{
  const units=[request('b',450,200),request('a',450,200),request('active',450,200,1)];
  const first=layoutUnitLabels(units,{bounds,gap:8});
  const reversed=layoutUnitLabels(units.toReversed(),{bounds,gap:8});
  expect(first).toEqual(reversed);
  expect(first.placed[0]).toMatchObject({id:'active',x:398,y:144,displaced:false});
  expectLayoutFits(first,bounds,8);
 });

 it('reports labels that cannot fit instead of silently overlapping or shrinking them',()=>{
  const area={x:0,y:0,width:104,height:48};
  const result=layoutUnitLabels([request('a',52,56),request('b',52,56),{...request('large',52,56),width:105}],{bounds:area,gap:8});
  expect(result.placed).toHaveLength(1);
  expect(result.unplaced).toEqual([{id:'b',reason:'crowded'},{id:'large',reason:'too-large'}]);
  expectLayoutFits(result,area,8);
 });

 it('rejects invalid viewports and explicitly reports invalid label measurements',()=>{
  expect(()=>layoutUnitLabels([],{bounds:{...bounds,width:0},gap:8})).toThrow(RangeError);
  expect(()=>layoutUnitLabels([],{bounds,gap:-1})).toThrow(RangeError);
  const result=layoutUnitLabels([{...request('bad',100,100),width:NaN}],{bounds,gap:8});
  expect(result).toEqual({placed:[],unplaced:[{id:'bad',reason:'invalid-size'}]});
 });
});
