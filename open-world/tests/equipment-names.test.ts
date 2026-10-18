import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {equipmentItems,getEquipmentSetName,matchesEquipmentSearch} from '../packages/content/equipment-catalog.ts';
import {collectionGearSets,collectionRecipes} from '../packages/content/equipment-runtime.ts';
import {makeGearByBase,instantiateGearTemplate,gearBases} from '../packages/rules/index.ts';
import {withCurrentEquipmentNames} from '../packages/rules/equipment-names.ts';
import {craftRecipes} from '../packages/content/crafting.ts';

it('every new item and set has a distinct short name independent of classification and recipes',()=>{
 expect(new Set(equipmentItems.map(item=>item.name)).size).toBe(324);
 expect(new Set(collectionGearSets.map(set=>set.name)).size).toBe(54);
 for(const item of equipmentItems){
  expect(item.name).not.toMatch(/[·]|T\d|常规|方阵|原初/);expect(item.name.length).toBeLessThanOrEqual(7);
  expect(collectionRecipes.find(recipe=>recipe.output==='gear:'+item.id)?.name).toBe(craftRecipes.find(recipe=>recipe.output.base===item.id)?.name);
  expect(makeGearByBase(item.id,randomUUID()).setName).toBe(getEquipmentSetName(item.setId));
 }
 expect(collectionGearSets.find(set=>set.id==='primal-staff-t3')?.name).toBe('长青誓约');
});
it('an existing rolled instance refreshes only item and set names while legacy gear is untouched',()=>{
 const gear={...makeGearByBase('primal-staff-t3-ring',randomUUID()),name:'原初·法杖·T3·戒指',setName:'原初·法杖·T3',rank:8,locked:true,attack:543,ilvl:50,stage:8,aspectId:'retained-aspect'};
 const before=structuredClone(gear),current=withCurrentEquipmentNames(gear);
 expect(current).toEqual({...before,name:'年轮之戒',setName:'长青誓约'});expect(gear).toEqual(before);
 const legacy={...gear,base:'core',name:'余烬之心',setId:'legacy-core',setName:'旧核心套装'};expect(withCurrentEquipmentNames(legacy)).toBe(legacy);
});
it('a previously frozen drop keeps frozen numbers and uses current display names',()=>{
 const template={...gearBases.find(gear=>gear.base==='primal-staff-t3-ring')!,name:'原初·法杖·T3·戒指',setName:'原初·法杖·T3',attack:97,requiredLevel:33},before=structuredClone(template);
 const gear=instantiateGearTemplate(template,randomUUID(),'rare');
 expect(gear).toMatchObject({name:'年轮之戒',setName:'长青誓约',attack:97,requiredLevel:33,quality:'rare'});expect(template).toEqual(before);
});
it('name, set and multiple classification search terms remain useful after renaming',()=>{
 for(const query of ['年轮','长青誓约','原初 法杖 T3 戒指','原初·法杖·T3'])expect(matchesEquipmentSearch('primal-staff-t3-ring',query)).toBe(true);
 for(const query of ['常规','魔杖','T2','长青 戒指 头盔',''])expect(matchesEquipmentSearch('primal-staff-t3-ring',query)).toBe(false);
 expect(matchesEquipmentSearch('missing','长青')).toBe(false);
});
