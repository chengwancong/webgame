import {inscriptionRubbings} from '../../../packages/content/inscription-rubbings.ts';
import {effectAtomById} from '../../../packages/content/effect-atoms.ts';
import type {Gear,GearQuality,ProgressionView,SkillAccess,Snapshot} from '../../../packages/contracts/index.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {matchesEquipmentSearch} from '../../../packages/content/equipment-catalog.ts';
import {filterGear} from './components/GearFilter.ts';
import {craftConsumables,craftMaterials} from '../../../packages/content/crafting.ts';
import {islandHue,islandOrder,materialDefs,materialIcon} from './crafting-model.ts';
import {hasArt} from './ui-assets.ts';
import type {GearSlotFilter} from './equipment-slots.ts';

export const bagCategories={all:'全部',equipment:'装备',consumables:'消耗品',materials:'材料',quest:'任务'} as const;
export type BagCategory=keyof typeof bagCategories;
export type BagDraft={category:BagCategory;selected:string;query:string;showZero:boolean;scrollTop:number;page?:number;island?:string};
export const initialBagDraft=():BagDraft=>({category:'all',selected:'',query:'',showZero:false,scrollTop:0,page:0});
export type TonicId=string;
/** Consumables from the crafting table (tonic / resist / food); one buff per group may run at a time (server rule). */
export const consumableGroupLabels:Record<string,string>={tonic:'合剂',resist:'抗性药剂',food:'食物'};
const consumableStatLabels:Record<string,string>={attack:'攻击',hp:'最大生命',fireResist:'火焰抗性',coldResist:'冰霜抗性',lightningResist:'闪电抗性',arcaneResist:'奥术抗性',shadowResist:'暗影抗性',poisonResist:'毒素抗性',pickup:'拾取范围',gold:'金币收益',material:'材料掉率'};
// Resist and food art is pending; they borrow approved icons until then.
const consumableIcon=(id:string,group:string)=>[`item-${id.replace('_','-')}`,group==='food'?'item-material-herb':'item-tonic-hp'].find(hasArt)??'item-tonic-hp';
export const tonicDefinitions=[...new Map(craftConsumables.map(c=>[c.id,{id:c.id,name:c.name,group:c.group??'tonic',stat:consumableStatLabels[c.stat??'']??c.stat??'',value:c.value??0,kills:c.kills??0,icon:consumableIcon(c.id,c.group??'tonic')}])).values()].sort((a,b)=>Object.keys(consumableGroupLabels).indexOf(a.group)-Object.keys(consumableGroupLabels).indexOf(b.group));
export type ProgressionDestination={section:string;item:string;label:string};
// Navigation metadata only. Ownership, availability and all prices come from the server.
export const materialDestinations:Record<string,ProgressionDestination&{name:string;use:string}>={
 ore:{name:'矿石',use:'装备锻造',section:'professions',item:'forge-blade',label:'前往锻造'},
 herb:{name:'草药',use:'合剂制作',section:'professions',item:'attack-tonic',label:'前往炼金'},
 leather:{name:'皮革',use:'衣甲锻造与附魔',section:'professions',item:'forge-coat',label:'前往锻造'},
 character_shard:{name:'角色碎片',use:'角色突破',section:'character',item:'uncap',label:'前往突破'},
 omega_fragment:{name:'方阵碎片',use:'方阵装备制造与突破',section:'professions',item:'forge-omega',label:'前往制造'},
 boss_essence:{name:'领主精华',use:'角色突破与高级制造',section:'character',item:'uncap',label:'前往突破'},
 legendary_essence:{name:'传说精华',use:'高级装备制造',section:'professions',item:'forge-primal',label:'前往制造'},
 gold_moon:{name:'金月',use:'高级装备制造',section:'professions',item:'forge-primal',label:'前往制造'},
 awakening_crystal:{name:'觉醒结晶',use:'角色觉醒',section:'character',item:'awakening',label:'前往觉醒'},
 glyph_dust:{name:'雕文粉尘',use:'雕文培养',section:'glyphs',item:'glyph-warrior',label:'前往雕文'},
 summon_shard:{name:'召唤碎片',use:'召唤石培养',section:'summons',item:'wind',label:'前往召唤石'},
};
for(const rubbing of inscriptionRubbings)materialDestinations[rubbing.id]={name:effectAtomById.get(rubbing.atomId)!.name+'铭纹拓片',use:'覆盖同部位装备铭纹',section:'inscriptions',item:rubbing.id,label:'前往铭纹拓印'};
type ItemBase={key:string;name:string;quantity:number;icon:string};
export type BagGear=ItemBase&{kind:'equipment';gear:Gear};
export type BagTonic=ItemBase&{kind:'consumables';type:'tonic';tonicId:TonicId;stat:string;group:string;value:number;kills:number;remainingKills:number};
export type BagBook=ItemBase&{kind:'consumables';type:'book';skillId:string;known:boolean;access?:SkillAccess};
/** `group` is an island region, 'common', 'endgame', 'legacy' or 'other' (inscription rubbings and retired IDs). */
export type BagMaterial=ItemBase&{kind:'materials';materialId:string;source:string;use:string;destination?:ProgressionDestination;group:string;tier?:string;workshop:boolean;hue:number};
export type BagItem=BagGear|BagTonic|BagBook|BagMaterial;
export function inventoryItems(snapshot:Snapshot,metadata?:ProgressionView):BagItem[]{
 const gear:BagGear[]=snapshot.gear.map(gear=>({key:'gear:'+gear.id,kind:'equipment',name:gear.name,quantity:1,icon:'gear-'+gear.base,gear}));
 const tonics:BagTonic[]=tonicDefinitions.map(def=>({key:'tonic:'+def.id,kind:'consumables',type:'tonic',tonicId:def.id,name:def.name,stat:def.stat,group:def.group,value:def.value,kills:def.kills,icon:def.icon,quantity:snapshot.progression?.consumables[def.id]??0,remainingKills:snapshot.progression?.buffs[def.id]??0}));
 const bookIds=new Set([...skillCatalog.filter(skill=>skill.activation?.type==='book').map(skill=>skill.id),...Object.keys(snapshot.skillBooks??{})]);
 const books:BagBook[]=[...bookIds].map(skillId=>{const definition=skillCatalog.find(skill=>skill.id===skillId);return {key:'book:'+skillId,kind:'consumables',type:'book',skillId,known:Boolean(definition),name:(definition?.name??skillId)+'技能书',icon:'item-skill-book',quantity:snapshot.skillBooks?.[skillId]??0,access:snapshot.skillAccess.find(skill=>skill.id===skillId)};});
 const owned=snapshot.progression?.materials??{},quantity=(id:string)=>id==='enhance_stone'?snapshot.material:owned[id]??0;
 // Workshop materials first in island chapter order; retired ore/herb/leather only while someone still holds them.
 const craftIds=[...craftMaterials].sort((a,b)=>rank(a.island)-rank(b.island)).map(def=>def.id),retired=new Set(['ore','herb','leather']);
 const materialIds=new Set([...craftIds,...Object.keys(materialDestinations).filter(id=>!retired.has(id)||quantity(id)>0),...Object.keys(owned)]);
 const materials:BagMaterial[]=[...materialIds].map(materialId=>{const def=materialDefs.get(materialId),icon=def?materialIcon(materialId,hasArt):'',placeholder=Boolean(def)&&icon!==def!.icon&&icon!=='item-material-'+materialId,currency=metadata?.currencies.find(currency=>currency.id===materialId),destination=materialDestinations[materialId],workshop=Boolean(def)&&def!.kind!=='legacy';
  return {key:'material:'+materialId,kind:'materials',materialId,name:def?.name??currency?.name??destination?.name??materialId,quantity:quantity(materialId),icon:def?icon:destination&&hasArt('item-material-'+materialId)?'item-material-'+materialId:'sys-bag',source:def?.sources.join('；')??currency?.source??'',use:destination?.use??(workshop?'拾星港工坊制作、提纯与精工':'暂无用途'),destination,group:def?def.island??(def.kind==='endgame'||def.kind==='legacy'?def.kind:'common'):'other',tier:def?.tier,workshop,hue:placeholder?islandHue(def?.island):0};});
 return [...gear,...tonics,...books,...materials];
}
const rank=(island:string|null)=>island?islandOrder.indexOf(island):islandOrder.length;
export const materialGroupLabels:Record<string,string>={common:'通用',endgame:'星潮终局',legacy:'旧养成材料',other:'其他'};
const relevant=(item:BagItem)=>item.quantity>0||(item.kind==='consumables'&&item.type==='tonic'&&item.remainingKills>0);
export function bagItems(snapshot:Snapshot,draft:BagDraft,quality:GearQuality|'',slot:GearSlotFilter,metadata?:ProgressionView){
 const items=inventoryItems(snapshot,metadata),equipment=new Set(filterGear(snapshot.gear,quality,slot).map(gear=>gear.id)),query=draft.query.trim().toLocaleLowerCase();
 return items.filter(item=>(draft.category==='all'?relevant(item):draft.category===item.kind&&(relevant(item)||draft.category==='materials'&&draft.showZero))&&(!query||item.name.toLocaleLowerCase().includes(query)||item.kind==='equipment'&&matchesEquipmentSearch(item.gear.base,query))&&(draft.category!=='equipment'||item.kind==='equipment'&&equipment.has(item.gear.id))&&(draft.category!=='materials'||!draft.island||item.kind==='materials'&&item.group===draft.island));
}
export function bagCounts(items:BagItem[]){
 const counts:Record<BagCategory,number>={all:0,equipment:0,consumables:0,materials:0,quest:0};
 for(const item of items)if(relevant(item)){counts.all++;counts[item.kind]++;}
 return counts;
}
/** The shelf scrolls (2026-10-20): every matching item is returned, no paging. */
export function bagSelection(snapshot:Snapshot,draft:BagDraft,quality:GearQuality|'',slot:GearSlotFilter,metadata?:ProgressionView){const items=bagItems(snapshot,draft,quality,slot,metadata);return {items,total:items.length,selected:items.find(item=>item.key===draft.selected)??items[0]};}
