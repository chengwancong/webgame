import {expect,it} from 'vitest';
import {beginPreview,invalidatePreviews,previewDomMatches,previewStillCurrent} from '../apps/web/src/preview-guard.ts';

it('keeps only the latest gear selection',()=>{
  const armor=beginPreview('armor',3);
  const bow=beginPreview('bow',3);
  expect(previewStillCurrent(armor)).toBe(false);
  expect(previewStillCurrent(bow)).toBe(true);
});

it('uses the same guard for a late success and a late failure',()=>{
  const stale=beginPreview('armor',2);
  const current=beginPreview('bow',2);
  expect(previewStillCurrent(stale)).toBe(false);
  expect(previewDomMatches(stale,{seq:String(stale.seq),gear:stale.gearId,revision:'2',generation:String(stale.generation)})).toBe(false);
  expect(previewStillCurrent(current)).toBe(true);
});

it('drops an in-flight preview when the panel generation changes',()=>{
  const open=beginPreview('bow',4);
  invalidatePreviews();
  expect(previewStillCurrent(open)).toBe(false);
  const reopened=beginPreview('bow',4);
  expect(previewStillCurrent(reopened)).toBe(true);
  expect(previewDomMatches(reopened,null)).toBe(false);
});

it('rejects a revision or item mismatch on the preview node',()=>{
  const token=beginPreview('bow',9);
  expect(previewDomMatches(token,{seq:String(token.seq),gear:'armor',revision:'9',generation:String(token.generation)})).toBe(false);
  expect(previewDomMatches(token,{seq:String(token.seq),gear:'bow',revision:'8',generation:String(token.generation)})).toBe(false);
  expect(previewDomMatches(token,{seq:String(token.seq),gear:'bow',revision:'9',generation:String(token.generation)})).toBe(true);
});
