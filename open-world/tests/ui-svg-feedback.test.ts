import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buttonHtml,tabsHtml,stateBlockHtml} from '../apps/web/src/ui-components.ts';
import {componentArtHtml} from '../apps/web/src/ui/component-art.ts';
import {stateArtHtml} from '../apps/web/src/ui/state-art.ts';
import {ToastQueue,toastHtml} from '../apps/web/src/ui/toast-queue.ts';

describe('SVG controls and feedback retain their existing behavior contracts',()=>{
 it('keeps button labels, actions, disabled/busy attributes and icon button sizing paths',()=>{
  const html=buttonHtml('<领取>',{action:'claim',variant:'primary',busy:true,busyLabel:'正在领取…'});
  expect(html).toContain('ui-component-art--control');expect(html).toContain('data-action="claim"');expect(html).toContain('aria-busy="true"');expect(html).toContain('disabled');expect(html).toContain('&lt;领取&gt;');expect(html).toContain('ui-button__busy-label');
  expect(buttonHtml('关闭',{size:'icon'})).not.toContain('ui-component-art--control');
 });
 it('keeps tab keyboard order, selection, disabled state and counts separate from artwork',()=>{
  const html=tabsHtml({label:'分类',action:'select',selected:'a',items:[{id:'a',label:'物品',count:0},{id:'b',label:'未开放',disabled:true}]});
  expect(html.match(/ui-component-art--tab/g)).toHaveLength(2);expect(html).toContain('aria-selected="true" tabindex="0"');expect(html).toContain('aria-selected="false" tabindex="-1"');expect(html).toContain('class="ui-number">0</small>');
 });
 it('preserves the toast queue expiry, sticky status and escaped content',()=>{
  const queue=new ToastQueue(),normal=queue.push('<获得补给>',0,{kind:'loot',ttl:1000});
  expect(toastHtml(normal,200)).toContain('ui-component-art--toast');expect(toastHtml(normal,200)).toContain('--toast-lifetime:800ms');expect(toastHtml(normal,200)).toContain('&lt;获得补给&gt;');expect(queue.visible(1000)).toHaveLength(0);
  const sticky=queue.push('正在恢复',1000,{kind:'error',sticky:true});expect(toastHtml(sticky,9000)).toContain('role="alert"');expect(queue.visible(9000)).toHaveLength(1);
 });
 it('uses static decorative state illustrations in the original slot and keeps native headings',()=>{
  for(const kind of ['empty','loading','error','success'] as const){
   const svg=stateArtHtml(kind),html=stateBlockHtml({kind,title:'状态 <标题>',message:'说明'});
   expect(svg).toContain('class="ui-state__icon ui-state-art"');expect(svg).toContain('aria-hidden="true"');expect(svg).not.toMatch(/\bid=|<defs|<filter|<animate|<text|<image|href=/);
   expect(html).toContain(kind==='loading'?'<h3>读取中…</h3>':'<h3>状态 &lt;标题&gt;</h3>');expect(html).toContain(`aria-busy="${kind==='loading'}"`);
  }
 });
 it('keeps decorations noninteractive without introducing CSS imports or new animations',()=>{
  for(const kind of ['control','tab','toast'] as const)expect(componentArtHtml(kind)).not.toMatch(/\bid=|<defs|<animate|<text|<filter/);
  const css=readFileSync(new URL('../apps/web/src/ui/component-art.css',import.meta.url),'utf8');expect(css).toContain('pointer-events:none');expect(css.replace(/\s+/g,'')).not.toMatch(/animation:(?!none)/);expect(css).toContain('.ui-button:disabled>.ui-component-art--control{display:none}');
  for(const file of ['state-art.ts','component-art.ts'])expect(readFileSync(new URL('../apps/web/src/ui/'+file,import.meta.url),'utf8')).not.toMatch(/import.*\.css/);
 });
});
