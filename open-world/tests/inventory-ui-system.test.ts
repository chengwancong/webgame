import {expect,it} from 'vitest';
import type {Snapshot} from '../packages/contracts/index.ts';
import {makeGear} from '../packages/rules/index.ts';
import {GearDetails,gearUpgradeCostHtml} from '../apps/web/src/components/GearDetails.ts';
import {ForgePanel,forgeGear,forgeSelection} from '../apps/web/src/components/ForgePanel.ts';
import {CharacterPanel,characterSelection} from '../apps/web/src/components/CharacterPanel.ts';

it('unknown server prices remain explicitly unknown even when a wallet has funds',()=>{
 const html=gearUpgradeCostHtml({gold:200,material:20});
 expect(html.match(/data-availability="unknown"/g)).toHaveLength(2);
 expect(html).toContain('待核对');expect(html).not.toContain('数量足够');
});
it('missing inventory balances cannot make a zero-price quote appear affordable',()=>{
 const wallet={gold:undefined,material:NaN} as unknown as Pick<Snapshot,'gold'|'material'>;
 const html=gearUpgradeCostHtml(wallet,{cost:{gold:0,material:0},max:false});
 expect(html.match(/data-availability="unknown"/g)).toHaveLength(2);expect(html).not.toContain('数量足够');
});
it('known shortage, exact balance and maximum rank keep distinct cost states',()=>{
 const html=gearUpgradeCostHtml({gold:29,material:2},{cost:{gold:30,material:2},max:false});
 expect(html).toContain('data-availability="short"');expect(html).toContain('data-availability="enough"');
 expect(gearUpgradeCostHtml({gold:0,material:0},{cost:{gold:0,material:0},max:true})).toContain('已达强化上限');
});
it('gear actions wait for authoritative quotes and reuse shared control markup',()=>{
 const gear=makeGear(0,'inventory-shared'),snapshot={gold:100,material:10,equipment:{},revision:1} as Snapshot;
 const html=GearDetails(gear,snapshot,'bag',false);
 expect(html).toMatch(/data-action="salvage-confirm"[^>]*disabled/);
 // Upgrade and reroll live only in the port workshop (2026-10-11); bag and character only point there.
 for(const context of ['bag','character'] as const){const view=GearDetails(gear,snapshot,context,false);expect(view).not.toContain('data-action="upgrade"');expect(view).not.toContain('副属性重铸');expect(view).toContain('前往拾星港工坊');}
 const forge=GearDetails(gear,snapshot,'forge',false);expect(forge).toMatch(/data-action="upgrade"[^>]*disabled/);expect(forge).not.toContain('salvage-confirm');expect(forge).not.toContain('前往拾星港工坊');
 expect(html).toContain('ui-button__label');expect(html).toContain('class="gear-quote-state"');expect(html).toContain('ui-stat');expect(html).toContain('aria-busy="true"');expect(html).not.toContain('cmp-attributes');
});
it('character quote stays inside the scroll body while actions remain outside it',()=>{
 const gear=makeGear(0,'inventory-shared'),snapshot={gold:100,material:10,equipment:{},revision:1} as Snapshot;
 const html=GearDetails(gear,snapshot,'character',false);
 expect(html.indexOf('id="gear-primary-summary"')).toBeLessThan(html.indexOf('id="preview"'));
 expect(html.indexOf('id="preview"')).toBeLessThan(html.indexOf('class="actions bag-detail-actions"'));
});
it('the port workshop lists worn gear first and opens the forge details for the selection',()=>{
 const a=makeGear(0,'forge-a'),b=makeGear(1,'forge-b'),snapshot={gold:100,material:10,equipment:{[b.slot]:b.id},gear:[a,b],revision:1,story:undefined} as unknown as Snapshot;
 expect(forgeGear(snapshot).map(g=>g.id)).toEqual([b.id,a.id]);expect(forgeSelection(snapshot,'missing')?.id).toBe(b.id);
 const html=ForgePanel(snapshot,forgeSelection(snapshot,a.id),false);
 expect(html).toContain('身上 · 1');expect(html).toContain('背包 · 1');expect(html).toContain('data-preview-context="forge"');expect(html).toMatch(/data-action="select"[^>]*data-id="[^"]*"/);
});
it('swap mode lays worn and selected side by side with main-stat arrows and a one-click replace (2026-10-11, 方案 B)',()=>{
 const mk=(seed:number,id:string,value:number,rank=0)=>({...makeGear(seed,id),slot:'weapon' as const,mainStat:{stat:'attack',value},rank,attributeVersion:2 as const});
 const worn=mk(0,'swap-worn',40,1),better=mk(1,'swap-better',50),worse=mk(2,'swap-worse',30);
 const snapshot={name:'测试',level:24,gold:100,material:10,equipment:{weapon:worn.id},gear:[worse,better,worn],revision:1} as unknown as Snapshot;
 expect(characterSelection(snapshot,'weapon','').items.map(g=>g.id)).toEqual([worn.id,better.id,worse.id]);
 const html=CharacterPanel(snapshot,'weapon',better.id,undefined,false,{chooserOpen:true,detailsOpen:false,blocked:false});
 expect(html).toContain('is-swapping');expect(html).not.toContain('character-summary');expect(html).toContain('character-compare has-pair');expect(html).toContain('character-worn');
 // worn 40 × (1 + 0.08) = 43.2 → better is ▲ 6.8, worse ▼ 13.2
 expect(html).toContain('▲ 6.8');expect(html).toContain('▼ 13.2');expect(html).toContain('穿戴中</span>');
 expect(html).toMatch(/data-action="equip"[^>]*data-id="swap-better[^"]*"/);expect(html).toContain('替换');
 const own=CharacterPanel(snapshot,'weapon',worn.id,undefined,false,{chooserOpen:true,detailsOpen:false,blocked:false});
 expect(own).not.toContain('has-pair');expect(own).toContain('卸下');
});
