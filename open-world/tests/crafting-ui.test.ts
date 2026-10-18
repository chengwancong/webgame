import {expect,it} from 'vitest';
import type {CraftingView,Snapshot} from '../packages/contracts/index.ts';
import {affixOdds,costRows,craftAction,filterRecipes,islandOrder,materialGroups,materialIcon,normalizeOptions,sameAction} from '../apps/web/src/crafting-model.ts';
import {bagItems,initialBagDraft,inventoryItems} from '../apps/web/src/bag-model.ts';

type Recipe=CraftingView['recipes'][number];
const recipe=(over:Partial<Recipe>):Recipe=>({id:'r',name:'配方',profession:'smithing',category:'gear',island:null,levelRequired:1,known:true,options:{},cost:{gold:0,materials:{}},...over} as Recipe);
const view=(recipes:Recipe[])=>({recipes} as unknown as CraftingView);
const snapshot=(materials:Record<string,number>,consumables:Record<string,number>={},buffs:Record<string,number>={})=>({gear:[],material:7,skillBooks:{},skillAccess:[],progression:{materials,consumables,buffs}} as unknown as Snapshot);

it('groups owned materials by island chapter order, then common, endgame and legacy',()=>{
 const groups=materialGroups({wind_ore:3,dragon_boss:1,stardust:5,gold_moon:2,character_shard:4,enhance_stone:0});
 expect(groups.map(g=>g.id)).toEqual(['ss-map-wind','ss-map-dragon','common','endgame','legacy']);
 expect(groups.flatMap(g=>g.rows.map(r=>r.def.id))).not.toContain('enhance_stone');
 expect(materialGroups({},{showZero:true}).find(g=>g.id===islandOrder[0])?.rows).toHaveLength(4);
});

it('falls back to approved kind icons when island art is missing',()=>{
 expect(materialIcon('frost_ore',id=>id==='item-material-ore')).toBe('item-material-ore');
 expect(materialIcon('omega_fragment',id=>id==='item-material-omega_fragment')).toBe('item-material-omega_fragment');
});

it('lists pattern recipes apart from profession recipes and hides unknown ones unless asked',()=>{
 const v=view([recipe({id:'a',profession:'alchemy',category:'tonic'}),recipe({id:'b',profession:'alchemy',category:'tonic',known:false}),recipe({id:'p',category:'pattern',island:'ss-map-wind'}),recipe({id:'s',category:'refine'})]);
 const filter={profession:'alchemy' as const,island:'',showUnknown:false,query:''};
 expect(filterRecipes(v,'craft',filter).map(r=>r.id)).toEqual(['a']);
 expect(filterRecipes(v,'craft',{...filter,showUnknown:true}).map(r=>r.id)).toEqual(['a','b']);
 expect(filterRecipes(v,'pattern',filter).map(r=>r.id)).toEqual(['p']);
});

it('only sends options the server offered and stacks counts for consumables only',()=>{
 const gear=recipe({options:{slots:['weapon','armor'],elements:['fire']}});
 expect(normalizeOptions(gear,{slot:'ring',element:'cold',count:5})).toEqual({slot:'weapon',tendency:undefined,element:undefined,count:1});
 expect(craftAction(gear,{slot:'armor',element:'fire',count:1})).toEqual({op:'craft',recipe:'r',slot:'armor',element:'fire'});
 const tonic=recipe({category:'tonic'});
 expect(craftAction(tonic,normalizeOptions(tonic,{count:30}))).toEqual({op:'craft',recipe:'r',count:20});
 expect(sameAction({op:'craft',recipe:'r'},{op:'craft',recipe:'r'})).toBe(true);
});

it('marks short costs and reads enhance stones from the legacy wallet',()=>{
 const rows=costRows({gold:100,materials:{enhance_stone:5,wind_ore:2}},{gold:50,materials:{wind_ore:2},enhanceStones:9},()=>undefined);
 expect(rows.map(r=>[r.id,r.availability])).toEqual([['gold','short'],['enhance_stone','enough'],['wind_ore','enough']]);
 expect(affixOdds({output:{affixPool:[{label:'甲',weight:1},{label:'乙',weight:3}]}} as never)).toEqual([{label:'甲',percent:25},{label:'乙',percent:75}]);
});

it('shows crafting materials in the bag with island groups and new consumables',()=>{
 const s=snapshot({wind_ore:3,mist_herb:2},{resist_fire:1,food_gold:2},{tonic_attack:5});
 const items=inventoryItems(s);
 const ore=items.find(i=>i.key==='material:wind_ore');
 expect(ore).toMatchObject({name:'风纹铁',quantity:3,group:'ss-map-wind',workshop:true});
 expect(items.find(i=>i.key==='material:enhance_stone')?.quantity).toBe(7);
 expect(items.some(i=>i.key==='material:ore')).toBe(false);
 expect(bagItems(s,{...initialBagDraft(),category:'materials',island:'ss-map-mist'},'','').map(i=>i.key)).toEqual(['material:mist_herb']);
 const resist=items.find(i=>i.key==='tonic:resist_fire');
 expect(resist).toMatchObject({group:'resist',kills:30,quantity:1});
});
