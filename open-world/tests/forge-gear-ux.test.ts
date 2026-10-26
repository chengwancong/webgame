import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {slotUpgradePanelHtml,slotAvailability,selectedUpgradeSlot} from '../apps/web/src/hub/slot-upgrade-panel.ts';
import {forgeReviewSlots as fixtureSlots} from '../apps/web/src/hub/forge-review.ts';
import {GearDetails} from '../apps/web/src/components/GearDetails.ts';
import {CharacterPanel} from '../apps/web/src/components/CharacterPanel.ts';
import {ForgePanel} from '../apps/web/src/components/ForgePanel.ts';
import {craftTabs} from '../apps/web/src/crafting-model.ts';
import {makeGear,gearContribution,gearPrimaryAttribute} from '../packages/rules/index.ts';
import {displayMainStat} from '../apps/web/src/gear-display-stat.ts';
import type {Snapshot,GrowthPreview} from '../packages/contracts/index.ts';
const view=()=>{const v=fixtureSlots();v.slots.forEach(s=>{s.cost={gold:200,material:3};delete s.block;s.gearId='gear-'+s.slot;});return v;};
const preview={current:{stats:{attack:35}},upgraded:{stats:{attack:37}}} as GrowthPreview;
it('F1/F6: embedded body has no duplicate panel/close and only one upgrade action',()=>{
 const html=slotUpgradePanelHtml(view(),{gold:200,material:3},false,{preview});
 expect(html).not.toContain('slot-upgrade-close');expect(html).not.toContain('class="panel');expect(html.match(/data-action="slot-upgrade"/g)).toHaveLength(1);
 expect(html.match(/data-action="slot-select"/g)).toHaveLength(6);expect(craftTabs.filter(t=>['强化','重铸'].includes(t.label))).toHaveLength(2);
});
it.each([{gold:0,material:0,label:'缺 200 金币'},{gold:199,material:3,label:'缺 1 金币'},{gold:200,material:2,label:'缺 1 强化石'}])('F2 shortage is persistent and never primary: %j',wallet=>{
 const html=slotUpgradePanelHtml(view(),wallet,false,{preview});expect(html).toContain(wallet.label);expect(html).not.toContain('ui-button--primary');expect(html).toMatch(/data-action="slot-upgrade"[^>]*disabled/);expect(html).toContain('需要');expect(html).toContain('持有');expect(html).toContain('通关节点');
});
it('F2 exact funds allow one primary; block outranks shortage and busy prevents repeat',()=>{
 const v=view();let html=slotUpgradePanelHtml(v,{gold:200,material:3},false,{preview});expect(html.match(/ui-button--primary/g)).toHaveLength(1);expect(html).not.toMatch(/data-action="slot-upgrade"[^>]*disabled/);
 v.slots[0].block='已强化到满级';expect(slotAvailability(v.slots[0],{gold:0,material:0}).reason).toBe('已强化到满级');
 html=slotUpgradePanelHtml(v,{gold:200,material:3},true,{preview});expect(html).toMatch(/data-action="slot-upgrade"[^>]*disabled/);
 expect(selectedUpgradeSlot(v,{gold:200,material:3}).slot).toBe('armor');expect(selectedUpgradeSlot(v,{gold:0,material:0},'ring').slot).toBe('ring');
});
it('F3 projected legacy stat retains the tip reinforcement semantics',()=>{
 const gear={...makeGear(0,'legacy'),rank:2};delete gear.mainStat;delete gear.attributeVersion;const stat=gearPrimaryAttribute(gear),resolved=gearContribution(gear);const projected={...gear,mainStat:{stat,value:resolved.base[stat]}};
 expect(displayMainStat(projected)?.effective).toBe(resolved.effective[stat]);
});
it('F3/F4/F5 comparison renders synchronous main stats, arrows, early action and destination slot',()=>{
 const worn={...makeGear(0,'worn'),slot:'weapon' as const,attributeVersion:2 as const,mainStat:{stat:'attack',value:30},rank:0,affixes:[{id:'attack',name:'攻击',tier:1 as const,stat:'attack',value:3,description:'攻击 +3'}]};
 const next={...worn,id:'next',mainStat:{stat:'attack',value:40}};
 const s={name:'测试',level:30,gold:200,material:3,gear:[worn,next],equipment:{weapon:worn.id},revision:1} as unknown as Snapshot;
 const html=CharacterPanel(s,'weapon',next.id,undefined,false,{chooserOpen:true,detailsOpen:false,blocked:false});expect(html).toContain('▲ 10');expect(html).toContain('主属性');
 const card=GearDetails(next,s,'character',false);expect(card.indexOf('cmp-attributes')).toBeLessThan(card.indexOf('装备词缀'));expect(card.indexOf('data-action="equip"')).toBeLessThan(card.indexOf('装备词缀'));
 for(const context of ['bag','character'] as const){const h=GearDetails(next,s,context,false);expect(h).toContain('data-action="bag-workshop"');expect(h).toContain('data-slot="weapon"');}
 next.mainStat={stat:'armor',value:40};expect(CharacterPanel(s,'weapon',next.id,undefined,false,{chooserOpen:true,detailsOpen:false,blocked:false})).toContain('主属性不同');
 expect(ForgePanel(s,next,false)).toContain('副属性重铸');
});
it('F6 presentation routes reroll explicitly, independent of slot availability',()=>{
 const source=readFileSync(new URL('../apps/web/src/presentation.ts',import.meta.url),'utf8');expect(source).toContain("craft.tab==='reroll'");expect(source).toContain('body=tabs+ForgePanel');
});
