import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {componentArtHtml} from '../apps/web/src/ui/component-art.ts';
import {confirmationHtml,sectionTitleHtml,statusBadgeHtml,statTilesHtml,resourceCostHtml,fieldHtml} from '../apps/web/src/ui-components.ts';
import {surfaceSvgQaCases} from '../apps/web/src/ui-svg-surfaces-qa.ts';

describe('remaining SVG data and panel components',()=>{
 it('keeps section text as first child and leaves count/actions in their existing hierarchy',()=>{
  const html=sectionTitleHtml('<属性>',{count:'0',actionsHtml:'<button>查看</button>',className:'ui-section-title--stacked-count'});
  expect(html).toContain('><span>&lt;属性&gt;</span>');expect(html).toContain('ui-section-title__actions');expect(html).toContain('ui-component-art--divider');
 });
 it('preserves accessible field associations and the native input rather than drawing text in SVG',()=>{
  const html=fieldHtml({id:'svg-field',label:'角色名字',value:'<远行者>',error:'请输入名字'});
  expect(html).toContain('for="svg-field"');expect(html).toContain('<input ');expect(html).toContain('id="svg-field"');expect(html).toContain('aria-invalid="true"');expect(html).toContain('aria-describedby="svg-field-description"');expect(html).toContain('&lt;远行者&gt;');expect(html).toContain('ui-form-field-shell');
 });
 it('preserves zero, unknown, shortages, native numerical text and badge semantics',()=>{
  const html=statTilesHtml([{label:'攻击',value:'0'}])+resourceCostHtml([{id:'gold',label:'金币',amount:2,owned:0,availability:'short'},{id:'unknown',label:'未核对',amount:null,owned:null,availability:'unknown'}]);
  expect(html).toContain('>0</dd>');expect(html).toContain('还缺 2');expect(html).toContain('待核对');expect(html).toContain('ui-component-art--stat');expect(html).toContain('ui-component-art--well');
  expect(statusBadgeHtml('完成','success')).toContain('ui-component-art--status');expect(statusBadgeHtml('说明','neutral',{variant:'inline'})).not.toContain('ui-component-art--status');
 });
 it('keeps the modal focus/cancel/confirm contract and disables commands while busy',()=>{
  const html=confirmationHtml({title:'确认',description:'说明',confirmLabel:'执行',confirmAction:'run',cancelAction:'cancel',busy:true});
  expect(html).toContain('ui-component-art--panel');expect(html).toContain('role="dialog" tabindex="-1" aria-modal="true"');expect(html).toContain('data-ui-dialog-cancel="true"');expect(html).toContain('data-action="run"');expect(html).toContain('aria-busy="true"');
 });
 it('uses noninteractive token-driven decoration without IDs or CSS side effects',()=>{
  for(const kind of ['panel','well','stat','status','divider'] as const){const svg=componentArtHtml(kind);expect(svg).not.toMatch(/\bid=|<defs|<filter|<animate|<text|<image|href=|#[\da-f]{3}/i);expect(svg).toContain('aria-hidden="true"');}
  const css=readFileSync(new URL('../apps/web/src/ui/component-art.css',import.meta.url),'utf8');expect(css).toContain('pointer-events:none');
  for(const sample of surfaceSvgQaCases)expect(sample.render()).not.toContain('undefined');
 });
});
