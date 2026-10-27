import {describe,it,expect,vi} from 'vitest';
import {bindLandmarkPointer,forgePointerTarget,landmarkInteractionRange,landmarkPointerFallback} from '../apps/web/src/landmark-pointer.ts';
import type {Region} from '../packages/content/index.ts';
import {interactionReach} from '../packages/rules/world-interactions.ts';

type RegionTargets=Pick<Region,'portal'|'bossPortal'|'landmarks'>;
const region:RegionTargets={portal:{x:4,y:4},bossPortal:{x:12,y:4},landmarks:[
 {name:'工坊',kind:'forge',x:20,y:4},{name:'休整点',kind:'safe',x:28,y:4},
]};

describe('landmark pointer ground fallback',()=>{
 it('hits only the portal, boss and safe ground markers',()=>{
  for(const [x,kind] of [[4,'portal'],[12,'boss'],[28,'safe']] as const){
   expect(landmarkPointerFallback({x,y:4},region)).toEqual({kind,position:{x,y:4}});
  }
 });
 it('does not capture nearby ground inside the old two- or three-cell radius',()=>{
  for(const x of [4,12,20,28])for(const offset of [2,3]){
   expect(landmarkPointerFallback({x:x+offset,y:4},region)).toBeUndefined();
   expect(landmarkPointerFallback({x,y:4+offset},region)).toBeUndefined();
  }
 });
 it('uses one isometric tile including its boundary and excludes adjacent ground',()=>{
  for(const dx of [-.5,.5])for(const dy of [-.5,.5])expect(landmarkPointerFallback({x:28+dx,y:4+dy},region)?.kind).toBe('safe');
  for(const [dx,dy] of [[.501,0],[-.501,0],[0,.501],[0,-.501],[1,1]])expect(landmarkPointerFallback({x:28+dx,y:4+dy},region)).toBeUndefined();
 });
 it('chooses the nearest anchor when tiles overlap',()=>{
  const close:RegionTargets={portal:{x:4,y:4},landmarks:[{name:'休整点',kind:'safe',x:4.6,y:4}]};
  expect(landmarkPointerFallback({x:4.4,y:4},close)?.kind).toBe('safe');
  expect(landmarkPointerFallback({x:4.2,y:4},close)?.kind).toBe('portal');
 });
 it('prefers a portal to a safe point at the same location',()=>{
  const shared:RegionTargets={portal:{x:4,y:4},landmarks:[{name:'休整点',kind:'safe',x:4,y:4}]};
  expect(landmarkPointerFallback({x:4,y:4},shared)?.kind).toBe('portal');
 });
 it('breaks equal-distance ties independently of landmark input order',()=>{
  const marks=[{name:'右休整点',kind:'safe',x:10.5,y:10},{name:'左休整点',kind:'safe',x:9.5,y:10}];
  const make=(landmarks:typeof marks)=>landmarkPointerFallback({x:10,y:10},{portal:{x:0,y:0},landmarks});
  expect(make(marks)).toEqual(make([...marks].reverse()));
  expect(make(marks)?.position).toEqual({x:9.5,y:10});
 });
 it('ignores noninteractive landmarks and nonfinite pointer coordinates',()=>{
  expect(landmarkPointerFallback({x:10,y:10},{portal:{x:0,y:0},landmarks:[{name:'桥',kind:'bridge',x:10,y:10}]})).toBeUndefined();
  expect(landmarkPointerFallback({x:NaN,y:4},region)).toBeUndefined();
  expect(landmarkPointerFallback({x:4,y:Infinity},region)).toBeUndefined();
 });
 it('returns no target for an empty stretch of ground',()=>{
  expect(landmarkPointerFallback({x:40,y:40},{portal:{x:0,y:0},landmarks:[]})).toBeUndefined();
 });
 it('never treats the forge service point or its neighboring ground as a building hit',()=>{
  const port:RegionTargets={portal:{x:14,y:18},landmarks:[{name:'工坊',kind:'forge',x:19,y:20}]};
  for(const [x,y] of [[19,20],[19.4,20.4],[18.5,19.5],[19,17],[21,20]])expect(landmarkPointerFallback({x,y},port)).toBeUndefined();
 });
 it('keeps execution reach separate from the pointer footprint',()=>{
  expect(landmarkInteractionRange('forge')).toBe(interactionReach.forge);
  expect(landmarkInteractionRange('portal')).toBe(4);
  expect(landmarkInteractionRange('boss')).toBe(4);
  expect(landmarkInteractionRange('safe')).toBe(3);
 });
});

describe('rendered building pointer binding',()=>{
 it('binds pixel alpha to the service position instead of the building foot',()=>{
  const sprite={x:64,y:648,setData:vi.fn(),setInteractive:vi.fn()};
  const target={kind:'forge' as const,position:{x:19,y:20}};
  bindLandmarkPointer(sprite,target);
  expect(sprite.setInteractive).toHaveBeenCalledWith({pixelPerfect:true,alphaTolerance:1});
  expect(sprite.setData).toHaveBeenCalledWith('landmark-pointer',target);
  expect(target.position).toEqual({x:19,y:20});
 });
 it('finds the nearest forge service landmark without mutating map order',()=>{
  const landmarks=[{name:'远工坊',kind:'forge',x:3,y:3},{name:'近休整点',kind:'safe',x:19,y:17},{name:'近工坊',kind:'forge',x:19,y:20}];
  const before=landmarks.map(l=>({...l}));
  expect(forgePointerTarget({x:19,y:17},{landmarks})).toEqual({kind:'forge',position:{x:19,y:20}});
  expect(landmarks).toEqual(before);
 });
 it('does not invent a service position when there is no forge',()=>{
  expect(forgePointerTarget({x:19,y:17},{landmarks:[{name:'门口',kind:'safe',x:19,y:17}]})).toBeUndefined();
 });
});
