import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assertUiLayerOrder,firstCreatedLayers,uiLayerPrelude} from '../apps/web/ui-cascade.ts';

describe('production UI cascade precedence',()=>{
 it('reproduces the extracted growth CSS failure: later declarations cannot reorder existing layers',()=>{
  expect(firstCreatedLayers(['@layer components {.ui-growth-number{display:grid}}',uiLayerPrelude])).toEqual(['components','tokens','legacy']);
  expect(()=>assertUiLayerOrder('<link rel="stylesheet" href="growth.css"><link rel="stylesheet" href="ui.css">',href=>href==='growth.css'?'@layer components {.x{display:grid}}':uiLayerPrelude,'old-build')).toThrow('components > tokens > legacy');
 });
 it('establishes precedence before any extracted chunk in all HTML entrypoints',()=>{
  const html=`<style data-ui-layer-order>${uiLayerPrelude}</style><link rel="stylesheet" href="growth.css"><link rel="stylesheet" href="ui.css">`;
  expect(assertUiLayerOrder(html,href=>href==='growth.css'?'@layer components {.x{display:grid}}':uiLayerPrelude,'game')).toEqual(['tokens','legacy','components']);
 });
 it('does not mistake nested layers or comments for new top-level precedence',()=>{
  expect(firstCreatedLayers([uiLayerPrelude,'/* @layer first; */ @layer legacy{@layer page{.x{display:flex}}} @layer components{.y{display:grid}}'])).toEqual(['tokens','legacy','components']);
 });
 it('loads growth styling through the unified entry instead of a component side effect',()=>{
  const growth=readFileSync(new URL('../apps/web/src/ui/growth-feedback.ts',import.meta.url),'utf8');
  const entry=readFileSync(new URL('../apps/web/src/ui-entry.css',import.meta.url),'utf8');
  expect(growth).not.toMatch(/import\s+['"].*\.css['"]/);
  expect(entry).toContain("@import url('./ui/growth-feedback.css');");
 });
});
