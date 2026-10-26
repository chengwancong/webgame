import {describe,expect,it} from 'vitest';
import {unitPortraitHtml} from '../apps/web/src/tactical/unit-portrait.ts';
import {art} from '../apps/web/src/ui-assets.ts';
import type {TacticalUnitView} from '../apps/web/src/tactical/contract.ts';

const unit=(patch:Partial<TacticalUnitView>={}):TacticalUnitView=>({
 id:'hero',side:'hero',name:'剑士',cell:{x:0,y:0},footprint:1,alive:true,hp:{current:100,max:100},shield:null,resource:null,statuses:[],
 art:{kind:'hero-native',assetId:'mini-hero/navy'},tier:'normal',...patch,
});

describe('tactical unit portrait markup',()=>{
 it('uses the registered hero bust and retains a fallback until the actual image loads',()=>{
  const html=unitPortraitHtml(unit());
  expect(html).toContain(`src="${art('portrait-bust')}"`);
  expect(html).toContain('data-portrait-state="loading"');
  expect(html).toContain('tb-unit-portrait-fallback');
 });
 it('keeps each enemy asset identity instead of reusing the first enemy or a fabricated face',()=>{
  for(const id of ['ss-mon-dusk-blade','ss-mon-dusk-gunner','not-registered']){
   const html=unitPortraitHtml(unit({side:'enemy',art:{kind:'starsea-atlas',assetId:id}}));
   expect(html).toContain(`data-unit-art="${id}"`);
   expect(html).toContain('data-portrait-kind="atlas"');
   expect(html).not.toContain('<img');
   expect(html).not.toContain(art('portrait-bust'));
  }
 });
 it('escapes unit names and asset identifiers without inline script handlers',()=>{
  const html=unitPortraitHtml(unit({side:'enemy',name:'<script>bad</script>',art:{kind:'starsea-atlas',assetId:'bad" onclick="bad'}}));
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('bad&quot; onclick=&quot;bad');
  expect(html).not.toContain(' onclick="');
  expect(html).not.toContain('<script>');
 });
});
