import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {componentArtHtml,type ComponentArtKind} from '../apps/web/src/ui/component-art.ts';
import {panelHeaderHtml,resourceAmountHtml,rewardRevealHtml,iconHtml} from '../apps/web/src/ui-components.ts';
import {svgQaCases} from '../apps/web/src/ui-svg-qa-samples.ts';

describe('shared component SVG surfaces',()=>{
 it('can repeat without global SVG IDs, animations, external resources or text',()=>{
  for(const kind of ['seal','title','resource','tag'] as ComponentArtKind[]){
   const svg=componentArtHtml(kind);expect(svg).toContain('aria-hidden="true"');expect(svg).toContain('focusable="false"');
   expect(svg).not.toMatch(/\bid=|<defs|<filter|<animate|<text|<image|href=|url\(/);
   expect(svg).toContain('non-scaling-stroke');expect(componentArtHtml(kind)).toBe(svg);
  }
 });
 it('keeps title text escaped and in its existing HTML heading, with independent close action',()=>{
  const html=panelHeaderHtml('背包 <长标题>',{emblemHtml:iconHtml('chest')});
  expect(html).toContain('ui-component-art--seal');expect(html).toContain('ui-component-art--title');
  expect(html).toContain('<span class="ui-panel-head__title-label">背包 &lt;长标题&gt;</span></h2>');
  expect(html).toContain('data-action="close"');
  expect(panelHeaderHtml('普通标题',{close:false})).not.toContain('ui-component-art');
 });
 it('preserves the last numeric span and distinguishes zero from unknown resources',()=>{
  for(const [value,text]of [[0,'0'],[null,'—']] as const){
   const html=resourceAmountHtml('gold',value,{pill:true});expect(html).toContain('ui-component-art--resource');
   expect(html.endsWith(`<span><b class="ui-number">${text}</b><small>金币</small></span></span>`)).toBe(true);
   expect(html).toContain(`aria-label="金币 ${text}"`);
  }
  expect(resourceAmountHtml('gold',5)).not.toContain('ui-component-art');
 });
 it('retains native quality and NEW/HEX labels and never gives decoration pointer events',()=>{
  const html=rewardRevealHtml([{name:'奖励',quality:'legendary',isNew:true,isHex:true}]);
  for(const label of ['传说','NEW','HEX'])expect(html).toContain(`ui-reward-mark__label">${label}</span>`);
  expect(html.indexOf('class="ui-reward-card__marks"')).toBeLessThan(html.indexOf('class="gear-card ui-reward-card__art'));
  const css=readFileSync(new URL('../apps/web/src/ui/component-art.css',import.meta.url),'utf8');
  expect(css).toContain('pointer-events:none');expect(css.replace(/\s+/g,'')).not.toMatch(/animation:(?!none)/);
  expect(css).toContain('.story-dialogue[data-bar] .dlg-head>h2>.ui-component-art{display:none}');
  expect(readFileSync(new URL('../apps/web/src/ui-entry.css',import.meta.url),'utf8')).toContain("@import url('./ui/component-art.css') layer(components);");
 });
 it('renders the shared short/long review cases using registered item IDs',()=>{
  for(const sample of svgQaCases){const html=sample.render();expect(html).not.toContain('undefined');expect(html.match(/ui-button--primary/g)?.length??0).toBeLessThanOrEqual(1);}
 });
});
