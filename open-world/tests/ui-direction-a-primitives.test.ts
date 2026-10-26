import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resourcePillHtml,ribbonTitleHtml,rewardRevealHtml} from '../apps/web/src/ui-components.ts';

describe('direction A shared ceremony',()=>{
 it('uses the existing resource pill and keeps zero and signed deltas explicit',()=>{
  expect(resourcePillHtml('gold',0)).toContain('ui-resource--pill');
  expect(resourcePillHtml('gold',0)).toContain('>0</b>');
  expect(resourcePillHtml('xp',120,20)).toContain('▲ 20');
  expect(resourcePillHtml('material',9,-3)).toContain('▼ 3');
  for(const delta of [0,NaN,Infinity])expect(resourcePillHtml('gold',0,delta)).not.toContain('ui-resource-delta');
 });
 it('escapes the title, uses the real grade asset and never celebrates retreat with stars',()=>{
  const html=ribbonTitleHtml('<通关>',{grade:'S',stars:0});
  expect(html).toContain('&lt;通关&gt;');
  expect(html).toContain('/art/hub-fun/grade-s.png');
  expect(html).toContain('0 星，共 3 星');
  expect(html).not.toContain(' is-lit');
  expect(html).toContain('class="ui-ribbon ui-motion-safe"');
  expect(html).not.toContain('class="result ');
  expect(ribbonTitleHtml('撤退',{tone:'retreat',stars:3})).not.toContain('ui-ribbon__stars');
  expect(ribbonTitleHtml('解锁',{tone:'unlock',stars:20})).toContain('3 星，共 3 星');
 });
 it('preserves quantities including zero, quality classes, and safe NEW/HEX badges',()=>{
  const html=rewardRevealHtml([{name:'<掉落>',quality:'legendary',quantity:0,isNew:true,isHex:true}]);
  expect(html).toContain('gear-card ui-reward-card__art quality-legendary');
  expect(html).toContain('&lt;掉落&gt;');
  expect(html).toContain('×0');
  expect(html).toContain('>NEW<');
  expect(html).toContain('>HEX<');
  expect(html).toContain('>传说<');
  expect(html).toContain('data-icon="chest"');
  expect(html).toContain('role="listitem"');
  expect(rewardRevealHtml([])).toContain('暂无掉落');
  expect(rewardRevealHtml([])).not.toContain('ui-reward-card');
  expect(rewardRevealHtml([{name:'未核对奖励',quantity:'<待核对>'}])).toContain('×&lt;待核对&gt;');
 });
 it('provides both reduced-motion guards and a bounded reward sequence',()=>{
  const css=readFileSync(new URL('../apps/web/src/ui/ceremony.css',import.meta.url),'utf8');
  expect(rewardRevealHtml([{name:'矿石'}])).toContain('ui-motion-safe');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).toContain('[data-motion-reduced=true] .ui-motion-safe .ui-reward-card');
  expect(css).toContain('var(--motion-reveal-total) - var(--motion-reveal)');
 });
});
