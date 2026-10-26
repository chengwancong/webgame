import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {toggleHtml,selectFieldHtml,rangeFieldHtml} from '../apps/web/src/ui/form-controls.ts';
import {formArtHtml,type FormArtKind} from '../apps/web/src/ui/form-art.ts';
import {svgFormsQaCases} from '../apps/web/src/ui-svg-forms-qa.ts';

describe('SVG form detail preserves native form behavior',()=>{
 it('keeps checkbox immediately adjacent to its visual track with label and hint associations',()=>{
  const html=toggleHtml({id:'sound',label:'声音 <开关>',checked:true,disabled:true,description:'说明 <文字>'});
  expect(html).toContain('for="sound"');expect(html).toContain('type="checkbox" id="sound" checked disabled aria-describedby="sound-hint"');
  expect(html).toMatch(/<input[^>]+><span class="ui-toggle__track" aria-hidden="true"><svg/);
  expect(html).toContain('声音 &lt;开关&gt;');expect(html).toContain('说明 &lt;文字&gt;');expect(html).toContain('ui-form-art--toggle');
 });
 it('keeps one native select, selected option and disabled state while arrow artwork cannot receive focus',()=>{
  const html=selectFieldHtml({id:'sort',label:'排序',value:'zero',options:[{value:'zero',label:'零值'},{value:'<unsafe>',label:'<名称>'}],description:'选一项',disabled:true,compact:true});
  expect(html.match(/<select /g)).toHaveLength(1);expect(html).toContain('id="sort" disabled aria-describedby="sort-hint"');
  expect(html).toContain('<option value="zero" selected>零值</option>');expect(html).toContain('value="&lt;unsafe&gt;"');
  expect(html).toContain('ui-form-art--chevron');expect(html).toContain('focusable="false"');
 });
 it('preserves slider bounds, output relationship and a direct native input rather than a custom drag target',()=>{
  const html=rangeFieldHtml({id:'volume',label:'音量',value:0,min:0,max:1,step:.05,valueLabel:'0%'});
  expect(html).toContain('<output class="ui-number" for="volume" id="volume-output">0%</output><input');
  expect(html).toContain('type="range" value="0" min="0" max="1" step="0.05" aria-describedby="volume-output"');
  expect(html).toContain('ui-range__rail');expect(html.match(/<input /g)).toHaveLength(1);
 });
 it('keeps form vectors decorative, self-contained and outside the input sizing/focus rules',()=>{
  for(const kind of ['field','toggle','range','chevron'] as FormArtKind[]){const svg=formArtHtml(kind);expect(svg).toContain('aria-hidden="true"');expect(svg).toContain('focusable="false"');expect(svg).not.toMatch(/\bid=|<defs|<filter|<text|<animate|<image|href=|url\(/);}
  const css=readFileSync(new URL('../apps/web/src/ui/form-art.css',import.meta.url),'utf8');
  expect(css).toContain('pointer-events:none');expect(css).not.toMatch(/animation:|transition:|!important|#[0-9a-f]{3,8}\b/i);
  expect(css).toContain('.ui-range:has(>.ui-range__rail)>input[type=range]{grid-row:2;');
  expect(css).toContain('input[aria-invalid=true]');expect(css).toContain('input:disabled');
 });
 it('renders normal and disabled/boundary review cases without API access',()=>{
  for(const item of svgFormsQaCases){const html=item.render();expect(html).toContain('qa-primitives');expect(html).not.toContain('undefined');expect(html).toContain('type="range"');}
 });
});
