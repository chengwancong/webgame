import {z} from 'zod';
import raw from '../../config/json/crafting-public.json';
import {craftMaterialDefSchema,craftRecipeViewSchema,craftCostSchema,craftConsumableIdSchema} from '../contracts/crafting.ts';
import {weaponAffinitySchema} from '../contracts/weapons.ts';
import {gearSlotSchema} from '../contracts/gear-slots.ts';
import {statRegistry} from '../contracts/stats.ts';

// 导出器的行号仅用于诊断；公开定义不携带 Excel 元数据。
export const craftMaterials=z.array(craftMaterialDefSchema).parse(raw.materials.map(({_row,...row})=>({...row,island:'island' in row?row.island:null})));
export const craftMaterialById=new Map(craftMaterials.map(material=>[material.id,material]));
const positive=z.number().int().positive(),id=z.string().min(1);
const output=z.object({kind:z.enum(['gear','consumable','material']),id:id.optional(),base:id.optional(),pattern:id.optional(),quality:z.enum(['magic','rare','legendary']).optional(),repair:z.boolean().optional(),level:positive.optional(),count:positive.optional(),group:z.enum(['tonic','resist','food']).optional(),stat:id.optional(),value:z.number().optional(),kills:positive.optional()}).strict();
export const craftRecipes=z.array(craftRecipeViewSchema.omit({known:true}).extend({output})).parse(raw.recipes.map(({_row,...row})=>({...row,island:row.island??null})));
export const craftPatterns=raw.patterns.map(({_row,...row})=>row);
export const craftFacilities=z.array(z.object({id,name:id,level:positive.max(6),cost:craftCostSchema,effects:z.array(z.string()),fineBonus:z.number().min(0).max(.3),exchangeBonus:z.number().min(0).max(1)})).parse(raw.facilities);
export const craftMasterwork=z.array(z.object({level:positive.max(5),cost:craftCostSchema,mainBonus:z.number().positive(),reroll:z.boolean()})).parse(raw.masterwork);
export const craftCodex=raw.codex.map(({_row,...row})=>row);
export const craftGathering=raw.gathering[0];
export const craftPolicy=raw.rules[0].value;
// 同一六级设施供第五、六章投影使用；末章金币覆盖由配置声明，材料仍取设施表。
export function craftFacilityCost(facility:typeof craftFacilities[number],islands:readonly string[]=[]){
 const cost=structuredClone(facility.cost),overrides=(craftPolicy as typeof craftPolicy&{facilityGoldByIsland?:{island:string;level:number;gold:number}[]}).facilityGoldByIsland??[];
 for(const row of overrides)if(row.level===facility.level&&islands.includes(row.island))cost.gold=row.gold;
 return cost;
}
export const craftText=craftPolicy.text;
/** 本岛招牌配方（定向武器/护甲/饰品）：登岛即会，不进宝箱与稀有怪的配方掉落。 */
export function craftSignatureRecipe(r:{output:{kind:string;pattern?:string;base?:string;repair?:boolean}}){return r.output.kind==='gear'&&!r.output.pattern&&!r.output.base&&!r.output.repair;}
/** 修复开场武器（docs/progression-goal-plan.md §5.2）：新流程角色开场后即会，只能做一次。 */
export const craftRepairRecipe=craftRecipes.find(r=>r.output.repair);
export const craftRecipeMigration=z.array(z.object({from:id,to:id,aspect:id.optional()})).parse(raw.migration);
export const craftConsumables=craftRecipes.filter(r=>r.output.kind==='consumable').map(r=>({id:r.output.id!,name:r.name,...r.output}));
for(const recipe of craftRecipes){
 for(const tendency of recipe.options.tendencies??[])weaponAffinitySchema.parse(tendency);
 for(const slot of recipe.options.slots??[])gearSlotSchema.parse(slot);
 for(const element of recipe.options.elements??[])if(!statRegistry.some(s=>s.id===element+'Damage'))throw Error('配方元素没有执行语义 '+recipe.id+'/'+element);
 if(recipe.output.kind==='consumable'){
  const o=recipe.output;if(!o.id||!o.group||!o.stat||!o.value||!o.kills)throw Error('消耗品效果不完整 '+recipe.id);
  craftConsumableIdSchema.parse(o.id);
  if(o.group==='food'?!['pickup','gold','material'].includes(o.stat):!statRegistry.some(s=>s.id===o.stat&&s.modifier&&s.progression!=='skill'))throw Error('消耗品效果没有执行语义 '+recipe.id+'/'+o.stat);
 }
}
export const publicCraftingContent={materials:craftMaterials,recipes:craftRecipes.map(({output,...r})=>r),patterns:craftPatterns,facilities:craftFacilities};
