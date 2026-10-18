import {it,expect} from 'vitest';
import {gearBases,gearContribution,makeGear,resolveBuild} from '../packages/rules/index.ts';
import {filterGear} from '../apps/web/src/components/GearFilter.ts';
import {GearCard} from '../apps/web/src/components/GearCard.ts';
import {gearAffixes,gearSetDetails,gearSetChanges} from '../apps/web/src/components/gear-metadata.ts';
import {renderEquipmentTip} from '../apps/web/src/equipment-tip.ts';
import type {GearTip} from '../packages/contracts/index.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
it('reinforcement remains primary-only while affixes are added exactly once',()=>{
 const gear={...makeGear(1,'bow'),rank:3,affixes:[{id:'armor',name:'护甲',tier:1 as const,stat:'armor',value:3,description:'护甲 +3'},{id:'attack',name:'攻击',tier:2 as const,stat:'attack',value:6,description:'攻击 +6'}]};
 expect(gearContribution(gear).effective).toEqual({attack:13,armor:0});
 const state={id:'player',name:'fixture',revision:0,build:1,level:1,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:['cut'],skillRanks:{},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}} as CharacterState;
 expect(resolveBuild(state).stats.attack).toBe(31);expect(resolveBuild(state).stats.armor).toBe(3);
});
it('all six bases keep exactly one primary attribute at every reinforcement rank',()=>{
 for(const definition of gearBases)for(let rank=0;rank<=5;rank++){
  const gear={...makeGear(gearBases.indexOf(definition),'fixture'),rank},attributes=gearContribution(gear),other=definition.primary_attribute==='attack'?'armor':'attack';
  expect(attributes.base[other]).toBe(0);expect(attributes.enhancement[other]).toBe(0);expect(attributes.effective[other]).toBe(0);
 }
 expect(gearContribution({...makeGear(1,'bow'),rank:5}).effective).toEqual({attack:17,armor:0});expect(gearContribution({...makeGear(2,'coat'),rank:5}).effective).toEqual({attack:0,armor:9});expect(gearContribution({...makeGear(5,'shield'),rank:5}).effective).toEqual({attack:0,armor:7});
});
it('quality and slot filters combine and leave the original collection unchanged',()=>{
 const blade=makeGear(0,'blade'),coat={...makeGear(2,'coat'),quality:'rare' as const},bow={...makeGear(1,'bow'),quality:'rare' as const},gear=[blade,coat,bow];
 expect(filterGear(gear,'rare','weapon')).toEqual([bow]);expect(filterGear(gear,'legendary','')).toEqual([]);expect(gear).toHaveLength(3);
});
it('cards and affixes escape server names and retain quality and affix values',()=>{
 const gear={...makeGear(1,'fixture'),quality:'legendary' as const,name:'<script>bow</script>',affixes:[{id:'test',name:'<b>攻击</b>',tier:1 as const,stat:'attack',value:5,description:'攻击 +5 <script>'}]};
 expect(GearCard(gear,{revision:0})).toContain('quality-legendary');expect(GearCard(gear,{revision:0})).not.toContain('<script>');expect(gearAffixes(gear)).not.toContain('>T1<');expect(gearAffixes(gear).replace(/<[^>]+>/g,'')).toContain('攻击 +5');expect(gearAffixes(gear)).not.toContain('<script>');
});
it('set activation rendering follows server-reported active milestones',()=>{
 const gear={...makeGear(0,'fixture'),setId:'berserker',setName:'狂战士'};
 const before={setId:'berserker',setName:'狂战士',count:1,total:3,activeBonuses:[]},after={...before,count:2,activeBonuses:[2]};
 expect(gearSetDetails(gear,[before])).toContain('1/3');expect(gearSetDetails(gear,[after])).toContain('gear-set-bonus active');expect(gearSetChanges([before],[after])).toContain('激活 2 件');
});
it('a primary-only tip separates affixes and omits an unchanged secondary comparison',()=>{
 const gear={...makeGear(1,'fixture'),rank:3},tip={gear,primary_attribute:'attack',revision:0,ruleset_version:'fixture',equipped:false,max_rank:5,attributes:gearContribution(gear),effect_description:'穿透',replaces:makeGear(0,'previous'),comparison:{attack:{current:21,equipped:25,delta:4},armor:{current:4,equipped:4,delta:0}},currentSets:[],equippedSets:[]} as GearTip;
 const html=renderEquipmentTip(tip);expect(html).toContain('装备主属性');expect(html).toContain('装备攻击');expect(html).not.toContain('装备护甲');expect(html).not.toContain('角色护甲');expect(html).toContain('▲ 4');expect(html).toContain('ui-stat__previous">21</span>');expect(html).toContain('data-icon="chevron-right"');
});
it('keeps quality on the tip header and icon scope while preserving long effect prose',()=>{
 for(const quality of ['common','magic','rare','legendary'] as const){
  const gear={...makeGear(0,'tip-quality'),quality,name:'<b>长名称</b>'};
  const tip={gear,primary_attribute:'attack',revision:0,ruleset_version:'fixture',equipped:false,max_rank:5,attributes:gearContribution(gear),effect_description:'命中时传导伤害。目标生命较低时，附加效果仍保留完整说明。',replaces:null,comparison:{attack:{current:20,equipped:24,delta:4},armor:{current:7,equipped:5,delta:-2}},currentSets:[],equippedSets:[]} as GearTip;
  const html=renderEquipmentTip(tip);expect(html).toContain(`equip-tip-header quality-${quality}`);expect(html).toContain(`data-quality="${quality}"`);expect(html).toContain('&lt;b&gt;长名称&lt;/b&gt;');expect(html).not.toContain('<b>长名称</b>');expect(html).toContain(tip.effect_description);expect(html).toContain('ui-stat__change--negative');expect(html).toContain('ui-stat__previous">7</span>');expect(html).toContain('穿上后的属性变化');
 }
});
