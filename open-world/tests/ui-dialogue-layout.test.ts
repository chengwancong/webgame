import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
import {u5QaCases} from '../apps/web/src/u5-qa-samples.ts';
const require=createRequire(import.meta.url),postcss=createRequire(require.resolve('vite/package.json'))('postcss');
const source=readFileSync(new URL('../apps/web/src/ui/dialogue-bar.css',import.meta.url),'utf8');
function declarations(selector:string){const found:Record<string,string>={};postcss.parse(source).walkRules((rule:{selector:string;walkDecls(fn:(decl:{prop:string;value:string})=>void):void})=>{if(rule.selector===selector)rule.walkDecls(decl=>found[decl.prop]=decl.value);});return found;}
describe('dialogue layout uses reserved tracks rather than overlapping offsets',()=>{
 it('allocates separate avatar and content columns, including the no-avatar state',()=>{
  expect(declarations('.story-dialogue[data-bar]')).toMatchObject({display:'grid','grid-template-columns':'var(--size-dialogue-avatar) minmax(0,1fr)',overflow:'auto'});
  expect(declarations('.dlg-avatar')).toMatchObject({position:'static','grid-column':'1'});
  expect(declarations('.story-dialogue[data-bar]>:not(.dlg-avatar)')).toMatchObject({'grid-column':'2','min-width':'0'});
  expect(declarations('.story-dialogue[data-bar]:has(>.dlg-avatar[data-kind=none])')).toMatchObject({'grid-template-columns':'minmax(0,1fr)'});
 });
 it('keeps speaker labels, titles and action text in flow with wrapping',()=>{
  expect(declarations('.story-dialogue[data-bar] .dlg-spoken>strong')).toMatchObject({position:'static','white-space':'normal'});
  expect(declarations('.story-dialogue[data-bar] .dlg-head>h2')).toMatchObject({height:'auto','white-space':'normal','overflow-wrap':'anywhere'});
  expect(declarations('.story-dialogue[data-bar] .dlg-actions')['flex-wrap']).toBe('wrap');
 });
 it('uses the complete production header/spoken/actions hierarchy for all review samples',()=>{
  for(const sample of u5QaCases.filter(item=>item.id.startsWith('u5-dialogue'))){const html=sample.render();expect(html).toContain('ui-panel-head--ribbon');expect(html).toContain('class="story-spoken"');expect(html).toContain('class="story-dialogue-actions"');expect(html).not.toContain('data-bar');expect(sample.mount).toBeTypeOf('function');}
 });
});
