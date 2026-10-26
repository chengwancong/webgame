import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {graphicArtHtml,type GraphicArtKind} from '../apps/web/src/ui/graphic-art.ts';
import {emptySlotHtml,helpHtml,meterHtml,pageDotsHtml,pipsHtml,ringHtml,timerHtml} from '../apps/web/src/ui/graphics.ts';
import {graphicsQaCases} from '../apps/web/src/ui-svg-graphics-qa.ts';

describe('SVG graphic controls retain authoritative data and interaction',()=>{
 it('preserves discrete counts, shapes and a text-free decorative row',()=>{
  for(const shape of ['dot','diamond','bar'] as const){const html=pipsHtml({value:3,max:5,label:'等级',shape});expect(html.match(/ui-pips__dot/g)).toHaveLength(5);expect(html.match(/is-filled/g)).toHaveLength(3);expect(html).toContain('aria-valuenow="3"');expect(html).toContain('aria-valuemax="5"');expect(html.replace(/<[^>]*>/g,'')).toBe('');}
  expect(pipsHtml({value:15,max:21,label:'等级'})).toContain('scaleX(0.7142857142857143)');
 });
 it('does not put decorative bezels into the live progress fill or change zero and invalid values',()=>{
  const normal=meterHtml({value:25,max:100,label:'进度',valueText:'end',ticks:[25,50,75]});expect(normal).toContain('style="transform:scaleX(0.25)"');expect(normal).toContain('aria-valuenow="25"');expect(normal.match(/ui-meter__tick/g)).toHaveLength(3);
  expect(normal.indexOf('ui-graphic-art--meter')).toBeGreaterThan(normal.indexOf('scaleX(0.25)'));
  for(const value of [0,NaN,Infinity,-1]){const html=meterHtml({value,max:0,label:'空范围'});expect(html).toContain('scaleX(0)');expect(html).not.toMatch(/NaN|Infinity/);}
  expect(ringHtml(.6,'救援')).toContain('stroke-dasharray="0.6 1"');expect(ringHtml(2,'完成')).toContain('aria-valuenow="1"');expect(ringHtml(NaN,'未知')).toContain('aria-valuenow="0"');
 });
 it('keeps timer text and the warning boundary while drawing only its existing icon slot',()=>{
  expect(timerHtml(61.1)).toContain('<b>1:02</b>');expect(timerHtml(31)).not.toContain('ui-timer--warning');expect(timerHtml(30)).toContain('ui-timer--warning');expect(timerHtml(NaN)).toContain('<b>0:00</b>');expect(timerHtml(1)).toContain('ui-graphic-art--timer');
 });
 it('keeps page action IDs and edge disabling plus native help and empty-slot labels',()=>{
  const dots=pageDotsHtml(2,5,'pick');expect(dots.match(/data-action="pick"/g)).toHaveLength(5);expect(dots.match(/aria-current="page"/g)).toHaveLength(1);expect(dots).toContain('data-id="2"');
  expect(pageDotsHtml(0,12,'pick')).toContain('aria-label="上一页" disabled');expect(pageDotsHtml(11,12,'pick')).toContain('aria-label="下一页" disabled');
  const empty=emptySlotHtml({label:'<空槽>',action:'choose',id:'slot-1'});expect(empty).toContain('data-action="choose"');expect(empty).toContain('data-id="slot-1"');expect(empty).toContain('aria-label="&lt;空槽&gt;"');
  expect(helpHtml('<帮助>')).toContain('role="tooltip"');expect(helpHtml('<帮助>')).toContain('aria-label="&lt;帮助&gt;"');
 });
 it('does not create SVG IDs, external resources, text, CSS imports or animations',()=>{
  for(const kind of ['pip','diamond-pip','bar-pip','meter','empty-slot','timer','page','page-prev','page-next','help'] as GraphicArtKind[]){const svg=graphicArtHtml(kind);expect(svg).toContain('aria-hidden="true"');expect(svg).toContain('focusable="false"');expect(svg).not.toMatch(/\bid=|<defs|<filter|<animate|<text|<image|href=/);}
  const css=readFileSync(new URL('../apps/web/src/ui/graphic-art.css',import.meta.url),'utf8');expect(css).toContain('pointer-events:none');expect(css).not.toMatch(/animation:|transition:/);expect(readFileSync(new URL('../apps/web/src/ui/graphic-art.ts',import.meta.url),'utf8')).not.toMatch(/import.*\.css/);
  for(const sample of graphicsQaCases)expect(sample.render()).not.toContain('undefined');
 });
});
