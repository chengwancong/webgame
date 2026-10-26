import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Snapshot} from '../packages/contracts/index.ts';
import {itemSlot} from '../apps/web/src/ui-components.ts';
import {slotArtHtml} from '../apps/web/src/ui/slot-art.ts';
import {renderItemTip} from '../apps/web/src/ui/item-tip.ts';
import {CharacterPaperdoll} from '../apps/web/src/components/CharacterPaperdoll.ts';
import {slotQaCases} from '../apps/web/src/ui-svg-slots-qa.ts';

describe('empty equipment guides complement existing quality frames',()=>{
 it('decorates only unqualified empty bag equipment while preserving actions and accessible state',()=>{
  const empty=itemSlot({action:'bag-part',id:'helmet',label:'头盔，未装备',className:'bag-eq is-empty',pressed:true,disabled:true,marks:[{corner:'tr',kind:'count',value:2,label:'2 件候选'}]});
  expect(empty).toContain('ui-slot-art--empty');expect(empty).toContain('data-action="bag-part"');expect(empty).toContain('data-id="helmet"');expect(empty).toContain('aria-pressed="true"');expect(empty).toContain('aria-label="头盔，未装备，2 件候选"');expect(empty).toContain('disabled');
  for(const className of ['bag-eq quality-legendary','bag-eq is-empty quality-common','bag-cell quality-rare is-empty','loot-tile quality-legendary','ui-node ui-node--skill','skill-slot'])expect(itemSlot({action:'pick',id:'a',label:'物品',className})).not.toContain('ui-slot-art');
 });
 it('limits character guides to the empty artwork cell, not the label or equipped frame',()=>{
  const snapshot={name:'空槽验收',level:1,gear:[],equipment:{}} as unknown as Snapshot;
  const html=CharacterPaperdoll(snapshot,'weapon');
  expect(html.match(/ui-slot-art--empty/g)).toHaveLength(6);
  expect(html).toContain('<span class="character-slot-art"><svg');
  expect(html).toContain('data-equipment-part="weapon"');
  expect(html).toContain('<span class="character-slot-copy"><small>武器</small>');
 });
 it('keeps the ordinary tip text, image and rows native and escaped',()=>{
  const target={querySelector:()=>({getAttribute:()=>'/art/book.png'})} as unknown as HTMLElement;
  const html=renderItemTip(target,{title:'<物品>',rows:[['持有','0']],note:'<说明>'});
  expect(html).toContain('ui-slot-art--tip');expect(html).toContain('<img src="/art/book.png"');expect(html).toContain('<h3>&lt;物品&gt;</h3>');expect(html).toContain('<span class="num">0</span>');expect(html).toContain('&lt;说明&gt;');expect(html).toContain('Esc 收起');
 });
 it('uses noninteractive static vectors and leaves the delivered E7 surface source intact',()=>{
  for(const kind of ['empty','tip'] as const){const html=slotArtHtml(kind);expect(html).toContain('aria-hidden="true"');expect(html).toContain('focusable="false"');expect(html).not.toMatch(/\bid=|<defs|<filter|<animate|<text|<image|href=|url\(/);}
  const css=readFileSync(new URL('../apps/web/src/ui/slot-art.css',import.meta.url),'utf8');expect(css).toContain('pointer-events:none');expect(css).not.toContain('animation');
  const slots=readFileSync(new URL('../apps/web/src/ui/item-slots.css',import.meta.url),'utf8');expect(slots).toContain('/art/hub-ui/ui-ornaments.png');expect(slots).not.toContain('ui-slot-art');
 });
 it('renders review cases with existing resource IDs',()=>{for(const sample of slotQaCases)expect(sample.render()).not.toContain('undefined');});
});
