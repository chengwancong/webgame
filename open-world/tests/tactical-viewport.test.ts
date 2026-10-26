import {describe,expect,it} from 'vitest';
import {fitTacticalStage,tacticalStageSize} from '../apps/web/src/tactical/viewport.ts';

describe('tactical reference-stage fitting',()=>{
 it('retains the approved 1280 × 720 reference stage',()=>{
  expect(tacticalStageSize).toEqual({width:1280,height:720});
  expect(fitTacticalStage(1280,720)).toEqual({scale:1,width:1280,height:720,offsetX:0,offsetY:0});
 });

 it.each([
  {availableWidth:2560,availableHeight:1080,scale:1.5,width:1920,height:1080,offsetX:320,offsetY:0},
  {availableWidth:1280,availableHeight:1024,scale:1,width:1280,height:720,offsetX:0,offsetY:152},
  {availableWidth:360,availableHeight:720,scale:.28125,width:360,height:202.5,offsetX:0,offsetY:258.75},
  {availableWidth:240,availableHeight:135,scale:.1875,width:240,height:135,offsetX:0,offsetY:0},
  {availableWidth:1280,availableHeight:676,scale:676/720,width:1280*676/720,height:676,offsetX:(1280-1280*676/720)/2,offsetY:0},
 ])('letterboxes $availableWidth × $availableHeight without stretching or a minimum zoom',row=>{
  const fit=fitTacticalStage(row.availableWidth,row.availableHeight);
  for(const key of ['scale','width','height','offsetX','offsetY'] as const)expect(fit[key]).toBeCloseTo(row[key]);
  expect(fit.width).toBeLessThanOrEqual(row.availableWidth+1e-9);
  expect(fit.height).toBeLessThanOrEqual(row.availableHeight+1e-9);
  expect(fit.width/fit.height).toBeCloseTo(16/9);
 });

 it.each([[0,720],[1280,0],[-1,720],[1280,-1],[NaN,720],[1280,NaN],[Infinity,720],[1280,Infinity]])(
  'does not emit an invalid transform for unavailable dimensions %s × %s',(width,height)=>{
   expect(fitTacticalStage(width,height)).toEqual({scale:0,width:0,height:0,offsetX:0,offsetY:0});
  },
 );

 it('responds to measured container changes rather than retaining a previous screen fit',()=>{
  const first=fitTacticalStage(1280,720),toolbarVisible=fitTacticalStage(1280,676),small=fitTacticalStage(160,90);
  expect(first.scale).toBe(1);
  expect(toolbarVisible.scale).toBeLessThan(first.scale);
  expect(small.scale).toBe(.125);
  expect(small.width).toBe(160);
  expect(fitTacticalStage(1280,720)).toEqual(first);
 });
});
