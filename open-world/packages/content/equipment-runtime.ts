import {registeredStatShape,statLabels,statRegistry} from '../contracts/stats.ts';
import {z} from 'zod';
import raw from './equipment-runtime.json';
import {equipmentItems,getEquipmentSetName} from './equipment-catalog.ts';
import {equipmentFamilies,equipmentParts,equipmentSeries} from '../contracts/equipment-catalog.ts';
import {slotForEquipmentPart} from '../contracts/gear-slots.ts';
import {weaponFamilies} from '../contracts/appearance.ts';
import type {GearSet,Stats} from '../contracts/index.ts';
import {craftRecipes} from './crafting.ts';
import {skillTagLabel} from './skill-tags.ts';

const positive=z.number().int().positive();
const setStats=z.object(registeredStatShape).strict();
export const equipmentRuntime=z.object({
 version:positive,
 craftQuality:z.enum(['common','magic','rare','legendary']),
 parts:z.record(z.enum(equipmentParts),z.object({primary:z.enum(['attack','armor']),value:positive,reinforcementMinimum:positive}).strict()),
 stages:z.array(z.object({tier:z.union([z.literal(1),z.literal(2),z.literal(3)]),primaryScale:z.number().positive(),requiredLevel:positive,craftLevel:positive.max(300),craftRegion:z.string(),ore:positive,leather:positive}).strict()).length(3),
 series:z.record(z.enum(equipmentSeries),z.object({bonusScale:z.number().positive(),craftMaterial:z.string().nullable(),craftQuantity:z.number().int().nonnegative()}).strict()),
 families:z.record(z.enum(equipmentFamilies),z.object({name:z.string(),animationFamily:z.enum(weaponFamilies),appearances:z.array(z.string()).length(3),weaponSkill:z.object({type:z.enum(['attack','skill','armor','crit']),value:z.number().positive()}).strict(),setZones:z.object({'4':z.object({tags:z.array(z.string()).min(1),mult:z.array(z.number().min(1)).length(3)}).strict(),'6':z.object({tags:z.array(z.string()).min(1),mult:z.array(z.number().min(1)).length(3)}).strict()}).strict().optional(),bonuses:z.array(z.object({pieces:z.union([z.literal(2),z.literal(4),z.literal(6)]),stats:setStats}).strict()).length(3)}).strict())
}).strict().parse(raw);
if(new Set(equipmentRuntime.stages.map(stage=>stage.tier)).size!==3)throw Error('Missing equipment stage');
const catalogByBase=new Map(equipmentItems.map(item=>[item.runtimeBase??item.id,item]));
export function collectionEquipment(base:string){return catalogByBase.get(base);}
export function equipmentStage(tier:number){const stage=equipmentRuntime.stages.find(stage=>stage.tier===tier);if(!stage)throw Error('Unknown equipment stage '+tier);return stage;}

// Art stage and affix quality remain separate. Region scaling uses these stage
// anchors once; generated instances keep their rolled primary values forever.
export const collectionGearTemplates=equipmentItems.map(item=>{
 const part=equipmentRuntime.parts[item.part],stage=equipmentStage(item.tier),value=Math.max(1,Math.round(part.value*stage.primaryScale));
 return {base:item.id,slot:slotForEquipmentPart(item.part),name:item.name,primary_attribute:part.primary,attack:part.primary==='attack'?value:0,armor:part.primary==='armor'?value:0,regional_primary_base:part.value,reinforcement_per_rank:part.reinforcementMinimum,effect:'none' as const,quality:'common' as const,affixes:[],setId:item.setId,setName:getEquipmentSetName(item.setId),requiredLevel:stage.requiredLevel};
});
const labels=statLabels;
const percentages=new Set(statRegistry.filter(s=>s.unit==='ratio').map(s=>s.id));
function bonusStats(stats:Partial<Stats>,tier:number,series:typeof equipmentSeries[number]):Partial<Stats>{
 const result:Partial<Stats>={},scale=equipmentRuntime.series[series].bonusScale;
 for(const [key,value]of Object.entries(stats)){
  if(typeof value!=='number')throw Error('Unsupported collection set modifier '+key);
  const fraction=percentages.has(key)||key==='hp'&&value<1;
  (result as Record<string,number>)[key]=fraction||key==='speed'?Math.round(value*scale*1000)/1000:Math.max(1,Math.round(value*equipmentStage(tier).primaryScale*scale));
 }return result;
}
export const collectionGearSets:GearSet[]=[...new Set(equipmentItems.map(item=>item.setId))].map(id=>{
 const items=equipmentItems.filter(item=>item.setId===id),first=items[0];
 return {id,name:getEquipmentSetName(id),pieces:items.map(item=>item.id),bonuses:equipmentRuntime.families[first.family].bonuses.map(bonus=>{
  const stats=bonusStats(bonus.stats,first.tier,first.series);
  const description=Object.entries(stats).map(([key,value])=>labels[key]+' +'+(percentages.has(key)||key==='hp'&&Number(value)<1?Math.round(Number(value)*1000)/10+'%':value)).join('，');
  // 4/6 件：按标签生效的独立乘区 [×]，随美术阶段 T1–T3 提升（docs/build-depth-design.md §5）。
  const rule=equipmentRuntime.families[first.family].setZones?.[String(bonus.pieces) as '4'|'6'],zones=rule?[{id:'set-'+first.family+'-'+bonus.pieces,label:equipmentRuntime.families[first.family].name+'套 '+bonus.pieces+' 件',kind:'mult' as const,value:rule.mult[first.tier-1],tags:rule.tags}]:undefined;
  const zoneText=rule?'；'+skillTagLabel(rule.tags)+'伤害 [×]'+rule.mult[first.tier-1]:'';
  return {pieces:bonus.pieces,description:description+zoneText,stats,...(zones?{zones}:{})};
 })};
});
export const collectionWeaponSkills=equipmentItems.filter(item=>item.part==='weapon').map(item=>{
 const skill=equipmentRuntime.families[item.family].weaponSkill;
 const type=item.series==='omega'&&skill.type==='attack'?'omegaAttack':item.series==='omega'&&skill.type==='skill'?'omegaSkill':skill.type;
 return {base:item.id,skills:[{type,value:Math.round(skill.value*(item.series==='primal'?1.15:1)*(1+(item.tier-1)*.15)*1000)/1000}]};
});
/** 旧展示代码的只读适配；名称、成本和产出唯一来源已迁到制作表。 */
export const collectionRecipes=craftRecipes.filter(recipe=>recipe.output.base&&catalogByBase.has(recipe.output.base)).map(recipe=>({id:'forge-'+recipe.output.base,name:recipe.name,profession:recipe.profession,level:recipe.levelRequired,reputation:0,region:recipe.island,cost:recipe.baseCost.materials,output:'gear:'+recipe.output.base}));
export const collectionAppearanceMappings=Object.fromEntries(equipmentItems.map(item=>{
 const family=equipmentRuntime.families[item.family];
 return [item.id,{...(item.part==='weapon'?{family:family.animationFamily}:{}),setId:family.appearances[item.tier-1]}];
}));
