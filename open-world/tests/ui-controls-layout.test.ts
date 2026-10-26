import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,expect,it} from 'vitest';

const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('vite'))('postcss');
const controls=readFileSync(new URL('../apps/web/src/ui/controls.css',import.meta.url),'utf8');
const headers=readFileSync(new URL('../apps/web/src/ui/panel-head.css',import.meta.url),'utf8');
type Declaration={prop:string;value:string};
type Rule={selector:string;walkDecls:(visitor:(decl:Declaration)=>void)=>void};
function rules(source:string,selector:string){
 const found:Map<string,string>[]=[];
 postcss.parse(source).walkRules((rule:Rule)=>{
  if(!rule.selector.split(',').map(s=>s.trim()).includes(selector))return;
  const values=new Map<string,string>();rule.walkDecls(decl=>{values.set(decl.prop,decl.value);});found.push(values);
 });
 return found;
}
const declarations=(source:string,selector:string)=>Object.fromEntries(rules(source,selector).flatMap(rule=>[...rule]));

// Source-level safety contract. Production layer order is checked separately;
// this does not claim to measure rendered pixels without a browser.
describe('shared controls accommodate long text without changing font size',()=>{
 it('allows normal, compact and action buttons to grow even under the coarse-pointer override',()=>{
  for(const selector of ['.ui-button','.ui-button--compact','.ui-button--action']){
   const heights=rules(controls,selector).map(rule=>rule.get('height')).filter(Boolean);
   expect(heights.length,selector).toBeGreaterThan(0);
   expect(heights.every(height=>height==='auto'),selector).toBe(true);
   expect(declarations(controls,selector)['min-height'],selector).toMatch(/^var\(--size-/);
  }
  expect(declarations(controls,'.ui-button__labels>span')['overflow-wrap']).toBe('anywhere');
 });
 it('keeps close/icon buttons square while labels retain their non-overlapping busy-state footprint',()=>{
  const icon=declarations(controls,'.ui-button--icon');
  expect(icon.height).toBe('var(--size-control)');
  expect(icon['min-width']).toBe('var(--size-touch-target)');
  expect(icon['min-height']).toBe('var(--size-control)');
  expect(declarations(controls,'.ui-button__labels>span')['grid-area']).toBe('1/1');
  expect(declarations(controls,'.ui-button__busy-label').visibility).toBe('hidden');
  expect(declarations(controls,'.ui-button[aria-busy=true] .ui-button__label').visibility).toBe('hidden');
  expect(declarations(controls,'.ui-button[aria-busy=true] .ui-button__busy-label').visibility).toBe('visible');
 });
 it('allows vertical or compact tab labels to wrap without squeezing their counts',()=>{
  for(const selector of ['.ui-tabs button','.ui-tabs--compact button']){
   expect(declarations(controls,selector).height).toBe('auto');
   expect(declarations(controls,selector)['min-height']).toMatch(/^var\(--size-/);
  }
  expect(declarations(controls,'.ui-tabs button>span:not(.ui-tabs__icon)')).toMatchObject({'min-width':'0','overflow-wrap':'anywhere'});
  expect(declarations(controls,'.ui-tabs button>small')['flex-shrink']).toBe('0');
 });
 it('lets long ribbon titles grow and wrap while close controls keep their reserved width',()=>{
  expect(declarations(headers,'.ui-panel-head--ribbon>h2')).toMatchObject({height:'auto','min-height':'var(--panel-head-ribbon-height)','min-width':'0','white-space':'normal','overflow-wrap':'anywhere','line-height':'var(--font-line-heading)'});
  expect(declarations(controls,'.ui-panel-head>.close')['flex-shrink']).toBe('0');
  expect(declarations(controls,'.ui-panel-head__actions')['flex-wrap']).toBe('wrap');
  expect(declarations(controls,'.ui-panel-head>h2')['min-width']).toBe('0');
 });
});
