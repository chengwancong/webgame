import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import type {LoadoutView} from '../packages/contracts/zhangjian.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import {CharacterPanel} from '../apps/web/src/components/CharacterPanel.ts';

function snapshot():Snapshot{
 const gear=makeGear(0,'layout-weapon');
 const state:CharacterState={id:'layout-character',name:'布局检查',revision:1,build:1,level:1,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:['cut'],skillRanks:{cut:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};
 return {...state,...resolveBuild(state),capacity:24,rewards:[]};
}
const loadouts:LoadoutView={active:0,dirty:true,canSwitch:true,current:{elements:[],resist:{}},slots:['近战方案','远程方案','防护方案'].map((name,index)=>({index,name,empty:index>0,elements:[],skills:[],pet:null}))};

describe('character panel row allocation',()=>{
 it('reserves the optional loadout row in both summary and equipment comparison modes',()=>{
  for(const chooserOpen of [false,true]){
   const html=CharacterPanel(snapshot(),'weapon','layout-weapon',undefined,false,{chooserOpen,detailsOpen:false,blocked:false,loadoutView:loadouts});
   expect(html).toContain(chooserOpen?'class="character-panel is-swapping has-loadout"':'class="character-panel has-loadout"');
   expect(html).toContain('class="loadout-bar"');
   expect(html.match(/ui-component-art--tab/g)).toHaveLength(3);
   expect(html).toContain(chooserOpen?'class="character-chooser"':'class="character-summary"');
   expect(html.indexOf('class="loadout-bar"')).toBeLessThan(html.indexOf('class="character-paperdoll'));
  }
  const plain=CharacterPanel(snapshot(),'weapon','layout-weapon',undefined,false,{chooserOpen:false,detailsOpen:false,blocked:false});
  expect(plain).not.toContain('has-loadout');expect(plain).not.toContain('class="loadout-bar"');
 });
 it('keeps the toolbar outside the constrained equipment body row and footer',()=>{
  const css=readFileSync(new URL('../apps/web/src/character-equipment.css',import.meta.url),'utf8');
  expect(css).toContain('.character-panel.has-loadout{grid-template-rows:auto minmax(0,1fr) var(--size-control)}');
  expect(css).toContain('.character-panel.has-loadout>.loadout-bar{grid-column:1/-1;grid-row:1;');
  expect(css).toContain('.character-panel.has-loadout>:is(.character-paperdoll,.character-summary,.character-chooser,.character-compare){grid-row:2}');
  expect(css).toContain('.character-panel.has-loadout>.character-footer{grid-row:3}');
 });
});
