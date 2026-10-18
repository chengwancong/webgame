import {applyCraft,previewCraft,ensureCrafting} from '../packages/rules/crafting.ts';
import {craftRecipes,craftPatterns,craftCodex} from '../packages/content/crafting.ts';
import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {collectionGearSets,collectionGearTemplates,collectionRecipes,collectionWeaponSkills,collectionEquipment,equipmentStage} from '../packages/content/equipment-runtime.ts';
import {gearSchema,slotForEquipmentPart,type CharacterState} from '../packages/contracts/index.ts';
import {gearBases,gearContribution,makeGearByBase,makeGear,resolveBuild} from '../packages/rules/index.ts';
import {dropWeight,gearTemplatesForRegion,pickRegionalGearTemplate,equipmentDropRules,dropProfileFor,scaleWorldGear,worldGearTemplates} from '../apps/api/src/economy.ts';
import {applySetBonuses,getEquippedSets} from '../packages/simulation/set-calculator.ts';
import {resolveAppearance} from '../packages/rules/appearance.ts';
import {filterGear} from '../apps/web/src/components/GearFilter.ts';
import {groundLootArt,groundLootTexture} from '../apps/web/src/ground-loot.ts';
import {applyProgressionAction,ensureProgression,progressionMultipliers,quoteProgressionAction} from '../packages/rules/deep-progression.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';

function character(gear=equipmentItems.filter(item=>item.setId==='standard-sword-t1').map(item=>makeGearByBase(item.id,randomUUID()))):CharacterState{
 const s:CharacterState={id:randomUUID(),name:'装备矩阵',revision:0,build:1,level:50,xp:0,gold:100000,material:10000,gear,equipment:{},skills:['cut','ward'],skillRanks:{cut:1,ward:1},progress:{kills:0,regions:['town','meadow','forest','rift','tundra','abyss','dragonbone'],bosses:[],safe:'town',tasks:[]}};ensureProgression(s);return s;
}
it('all 324 definitions instantiate real, unique, six-slot equipment with resolvable large and ground art',()=>{
 expect(equipmentItems).toHaveLength(324);expect(collectionRecipes).toHaveLength(324);expect(collectionGearSets).toHaveLength(54);expect(collectionWeaponSkills).toHaveLength(54);
 for(const item of equipmentItems){
  expect(item.obtainable).toBe(true);expect(item.runtimeBase).toBe(item.id);
  const gear=makeGearByBase(item.runtimeBase!,randomUUID());expect(gearSchema.parse(gear).slot).toBe(slotForEquipmentPart(item.part));
  expect(gear).toMatchObject({base:item.id,name:item.name,setId:item.setId,requiredLevel:equipmentStage(item.tier).requiredLevel});
  const contribution=gearContribution({...gear,rank:5});expect(contribution.effective.attack>0).not.toBe(contribution.effective.armor>0);
  const reward={id:randomUUID(),source_id:'qa',region:'meadow',position:{x:1,y:1},gear};
  expect(groundLootArt(reward)).toContain(item.iconId+'.png');expect(groundLootTexture(reward)).toContain(item.iconId+'.png');
  expect(filterGear([gear],'',item.part)).toEqual([gear]);
 }
 expect(()=>makeGearByBase('missing-equipment',randomUUID())).toThrow('Unknown runtime equipment');
 expect(()=>makeGear(-1,randomUUID())).toThrow('Invalid runtime equipment');
});
it('regional pools cover the complete matrix and cannot leak later stages into early drops',()=>{
 const all=new Set<string>();
 for(const region of ['meadow','forest','rift','tundra','abyss','dragonbone']){
  const pool=gearTemplatesForRegion(collectionGearTemplates,region),tier=equipmentDropRules.tiers[region];expect(pool).toHaveLength(108);
  expect(pool.every(gear=>collectionEquipment(gear.base)?.tier===tier)).toBe(true);
  const total=pool.reduce((sum,gear)=>sum+dropWeight(gear.base,region),0),seen=new Set<string>();
  for(let roll=0;roll<total;roll++){const chosen=pickRegionalGearTemplate(collectionGearTemplates,region,equipmentDropRules,()=>roll);seen.add(chosen.base);all.add(chosen.base);}
  expect(seen.size).toBe(108);
  expect(scaleWorldGear(pool.find(gear=>gear.base===`standard-sword-t${tier}-weapon`)!,dropProfileFor(region)).attack).toBe(scaleWorldGear(makeGear(0,'old-sword'),dropProfileFor(region)).attack);
 }
 expect(all.size).toBe(324);
});
it('old frozen pools keep their templates and old starters retain their exact primary values',()=>{
 const old=gearBases.slice(0,6);expect(gearTemplatesForRegion(old,'abyss')).toEqual(old);
 for(let roll=0;roll<old.length;roll++)expect(pickRegionalGearTemplate(old,'abyss',equipmentDropRules,()=>roll)).toEqual(old[roll]);
 expect(makeGear(0,'blade').attack).toBe(9);expect(makeGear(2,'coat').armor).toBe(4);expect(makeGear(3,'charm').slot).toBe('accessory');
 const mixed=gearTemplatesForRegion(worldGearTemplates(gearBases),'meadow');expect(mixed).toHaveLength(114);for(const template of old)expect(mixed.some(gear=>gear.base===template.base)).toBe(true);
});
it('旧弓、护符与核心保留可重复制作来源',()=>{
 for(const base of ['bow','charm','core','shield']){const s=character(),p=ensureProgression(s);s.progress.regions.push('ss-map-wind');p.recipes.push('forge-legacy-'+base);p.materials={wind_ore:100,wind_herb:100,wind_part:100};applyCraft(s,{op:'craft',recipe:'forge-legacy-'+base},{atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:60});expect(s.gear.some(gear=>gear.base===base)).toBe(true);}
});
it('every set activates 2/4/6 distinct pieces and only worn pieces contribute to live attributes',()=>{
 const base={hp:100,attack:10,armor:0,speed:6,mana:100,regen:10,effects:[]};
 for(const set of collectionGearSets){
  const gear=set.pieces.map(base=>makeGearByBase(base,randomUUID())),s=character(gear);
  for(const count of [2,4,6]){const worn=gear.slice(0,count);expect(getEquippedSets(worn,true)[0]).toMatchObject({setId:set.id,count,activeBonuses:[2,4,6].filter(pieces=>pieces<=count)});expect(applySetBonuses(base,worn)).not.toEqual(base);}
  expect(getEquippedSets([gear[0],{...gear[0],id:randomUUID()}],true)[0].count).toBe(1);
  const before=resolveBuild(s).stats;for(const g of gear)s.equipment[g.slot]=g.id;
  const equipped=resolveBuild(s).stats;expect(equipped.attack).toBeGreaterThan(before.attack);expect(equipped.armor).toBeGreaterThan(before.armor);
  expect(resolveAppearance(s).parts.weapon.setId).toBeTruthy();expect(resolveAppearance(s).parts.head.setId).toBeTruthy();expect(resolveAppearance(s).parts.feet.setId).toBeTruthy();
  expect(Object.values(s.equipment)).toHaveLength(6);
 }
});
it('all new weapons participate in the existing nine-weapon progression calculation',()=>{
 for(const template of collectionWeaponSkills){const gear=makeGearByBase(template.base,randomUUID()),s=character([gear]);s.equipment.weapon=gear.id;const p=ensureProgression(s);p.weapons[gear.id]={level:150,uncap:5};const multiplier=progressionMultipliers(s);expect(Object.entries(multiplier).some(([key,value])=>['omegaAttack','omegaSkill'].includes(key)?value>1:value>0)).toBe(true);}
});
it('新图鉴按岛统计配方与图样，旧百工奖励不能重复领取',()=>{
 const s=character(),p=ensureProgression(s);p.collectionClaims.push('craft-8');const c=ensureCrafting(s);expect(craftCodex).toHaveLength(6);expect(craftPatterns.length).toBeGreaterThanOrEqual(324);expect(()=>applyProgressionAction(s,{op:'collection.claim',target:'craft-8'})).toThrow();expect(p.collectionClaims).toContain('craft-8');
});
it('制作列表预览不生成装备也不改变背包，与实际报价一致',()=>{
 for(const recipe of craftRecipes.filter((_,index)=>index%7===0)){const s=character(),p=ensureProgression(s),c=ensureCrafting(s);s.progress.regions.push(...craftRecipes.flatMap(r=>r.island?[r.island]:[]));p.recipes.push(recipe.id);if(recipe.output.pattern)c.patterns.push(recipe.output.pattern);for(const id of Object.keys(recipe.baseCost.materials))p.materials[id]=9999;
 if(recipe.output.kind==='material')p.materials[recipe.output.id!]=0;const action={op:'craft' as const,recipe:recipe.id},before=structuredClone(s),place={atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:60},quote=previewCraft(s,action,place);expect(s).toEqual(before);expect(quote.enabled,recipe.id).toBe(true);const delta=applyCraft(s,action,place);expect(delta.gold).toBe(-quote.cost.gold);}
});
