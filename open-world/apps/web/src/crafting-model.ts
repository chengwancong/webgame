import type {CraftAction,CraftMaterialDef,CraftingView,CraftPreview} from '../../../packages/contracts/index.ts';
import {craftMaterials} from '../../../packages/content/crafting.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
import type {ResourceCost} from './ui/primitives.ts';
import {gearSlotLabels} from './equipment-slots.ts';

/**
 * Display-only crafting helpers (docs/crafting-system-design.md §8).
 * Quantities, availability, prices and results always come from /api/crafting*; nothing here decides them.
 */
export const craftTabs=[{id:'upgrade',label:'强化'},{id:'reroll',label:'重铸'},{id:'craft',label:'制作'},{id:'pattern',label:'图样'},{id:'refine',label:'提纯'},{id:'masterwork',label:'精工'},{id:'key',label:'钥匙'},{id:'facility',label:'设施'}] as const;
export type CraftTab=typeof craftTabs[number]['id'];
export const professionLabels={smithing:'锻造',jewelcraft:'饰品',alchemy:'炼金',enchanting:'附魔',gathering:'采集'} as const;
export type CraftProfession=Exclude<keyof typeof professionLabels,'gathering'>;
export const craftProfessions:CraftProfession[]=['smithing','jewelcraft','alchemy','enchanting'];
export const elementLabels:Record<string,string>={physical:'物理',fire:'火焰',cold:'冰霜',lightning:'闪电',arcane:'奥术',shadow:'暗影',poison:'毒素'};
export const tendencyLabels:Record<string,string>={martial:'武技倾向',spell:'法术倾向'};
export const categoryLabels:Record<string,string>={gear:'定向装备',accessory:'饰品',tonic:'合剂',resist:'抗性药剂',food:'割草食物',essence:'附魔',pattern:'图样锻造',refine:'提纯',repair:'修复'};
export const tierLabels:Record<CraftMaterialDef['tier'],string>={T0:'通用',T1:'岛屿特产',T2:'领主材料',T3:'星潮终局'};

const islandRows=[...worldTables.islands].sort((a,b)=>a.chapter-b.chapter);
export const islandOrder=islandRows.map(row=>row.region);
export function islandName(region:string|null|undefined){return region?islandRows.find(row=>row.region===region)?.name??region:'通用';}
export function slotLabel(slot:string){return (gearSlotLabels as Record<string,string>)[slot]??slot;}
export function optionLabel(kind:'slot'|'tendency'|'element',value:string){return kind==='slot'?slotLabel(value):kind==='tendency'?tendencyLabels[value]??value:elementLabels[value]??value;}

export const materialDefs=new Map(craftMaterials.map(def=>[def.id,def]));
export function materialName(id:string){return materialDefs.get(id)?.name??id;}

/** Island art arrives later; until then each kind reuses an approved icon and the island tints it. */
const kindIcon:Record<CraftMaterialDef['kind'],string>={common:'item-material-glyph_dust',ore:'item-material-ore',plant:'item-material-herb',part:'item-material-leather',boss:'item-material-boss_essence',endgame:'item-material-legendary_essence',legacy:'item-material-character_shard'};
export function materialIcon(id:string,has:(asset:string)=>boolean){
 const def=materialDefs.get(id);
 for(const candidate of [def?.icon,'item-material-'+id,def?kindIcon[def.kind]:undefined])if(candidate&&has(candidate))return candidate;
 return 'item-material-ore';
}
/** Stable hue per island so placeholder icons of the same kind stay distinguishable. */
export function islandHue(region:string|null|undefined){const index=region?islandOrder.indexOf(region):-1;return index<0?0:[0,200,330,170,260,30][index%6];}

export type MaterialGroup={id:string;label:string;rows:{def:CraftMaterialDef;quantity:number}[]};
/** Bag and workshop share this grouping: islands in chapter order, then common, endgame, legacy. */
export function materialGroups(quantities:Record<string,number>,options:{showZero?:boolean}={}):MaterialGroup[]{
 const groups:MaterialGroup[]=[...islandOrder.map(region=>({id:region,label:islandName(region),rows:[] as MaterialGroup['rows']})),{id:'common',label:'通用',rows:[]},{id:'endgame',label:'星潮终局',rows:[]},{id:'legacy',label:'旧养成材料',rows:[]}];
 const byId=new Map(groups.map(g=>[g.id,g]));
 for(const def of craftMaterials){
  const quantity=quantities[def.id]??0;if(!options.showZero&&quantity<=0)continue;
  const key=def.island??(def.kind==='endgame'?'endgame':def.kind==='legacy'?'legacy':'common');
  (byId.get(key)??byId.get('common')!).rows.push({def,quantity});
 }
 return groups.filter(g=>g.rows.length);
}

/** Wallet quantity for one material ID; 强化石 stays in the legacy `material` field. */
export function materialQuantity(id:string,materials:Record<string,number>|undefined,enhanceStones:number){return id==='enhance_stone'?enhanceStones:materials?.[id]??0;}

export function costRows(cost:{gold:number;materials:Record<string,number>},own:{gold:number;materials:Record<string,number>|undefined;enhanceStones:number},icon:(id:string)=>string|undefined):ResourceCost[]{
 const rows:ResourceCost[]=Object.entries(cost.materials).filter(([,amount])=>amount>0).map(([id,amount])=>{const owned=materialQuantity(id,own.materials,own.enhanceStones);return {id,label:materialName(id),amount,owned,availability:owned>=amount?'enough':'short',iconHtml:icon(id)};});
 if(cost.gold>0)rows.unshift({id:'gold',label:'金币',amount:cost.gold,owned:own.gold,availability:own.gold>=cost.gold?'enough':'short'});
 return rows;
}

export type RecipeFilter={profession:CraftProfession;island:string;showUnknown:boolean;query:string};
type Recipe=CraftingView['recipes'][number];
/** 制作 lists every non-pattern recipe; 图样 lists pattern recipes. Unknown recipes stay visible as goals only on request. */
export function filterRecipes(view:CraftingView|undefined,tab:'craft'|'pattern',filter:RecipeFilter):Recipe[]{
 if(!view)return [];const query=filter.query.trim().toLocaleLowerCase();
 return view.recipes.filter(r=>(tab==='pattern'?r.category==='pattern':r.category!=='pattern'&&r.category!=='refine')
  &&(tab==='pattern'||r.profession===filter.profession)
  &&(!filter.island||r.island===filter.island)
  &&(filter.showUnknown||r.known)
  &&(!query||r.name.toLocaleLowerCase().includes(query)))
  .sort((a,b)=>Number(b.known)-Number(a.known)||islandOrder.indexOf(a.island??'')-islandOrder.indexOf(b.island??'')||a.levelRequired-b.levelRequired||a.name.localeCompare(b.name,'zh-CN'));
}
export function recipeCounts(view:CraftingView|undefined){
 const out:Record<CraftProfession,{known:number;total:number}>={smithing:{known:0,total:0},jewelcraft:{known:0,total:0},alchemy:{known:0,total:0},enchanting:{known:0,total:0}};
 for(const r of view?.recipes??[])if(r.category!=='pattern'&&r.category!=='refine'){out[r.profession].total++;if(r.known)out[r.profession].known++;}
 return out;
}

export type CraftOptions={slot?:string;tendency?:string;element?:string;count:number};
/** Pick defaults only from the options the server offered, so the action stays valid for this recipe. */
export function normalizeOptions(recipe:Recipe|undefined,current:CraftOptions):CraftOptions{
 if(!recipe)return {count:1};const o=recipe.options;
 const pick=(list:string[]|undefined,value:string|undefined,optional:boolean)=>!list?.length?undefined:value&&list.includes(value)?value:optional?undefined:list[0];
 return {slot:pick(o.slots,current.slot,false),tendency:pick(o.tendencies,current.tendency,false),element:pick(o.elements,current.element,true),count:stackable(recipe)?Math.max(1,Math.min(20,Math.floor(current.count)||1)):1};
}
export function stackable(recipe:Recipe){return ['tonic','resist','food','essence'].includes(recipe.category);}
export function craftAction(recipe:Recipe,options:CraftOptions):CraftAction{
 return {op:'craft',recipe:recipe.id,...(stackable(recipe)&&options.count>1?{count:options.count}:{}),...(options.slot?{slot:options.slot}:{}),...(options.tendency?{tendency:options.tendency}:{}),...(options.element?{element:options.element}:{})};
}
export function sameAction(a:CraftAction|undefined,b:CraftAction|undefined){return Boolean(a&&b)&&JSON.stringify(a)===JSON.stringify(b);}
export function affixOdds(preview:CraftPreview|undefined){const pool=preview?.output.affixPool??[],total=pool.reduce((sum,row)=>sum+row.weight,0);return total>0?pool.map(row=>({label:row.label,percent:Math.round(row.weight/total*1000)/10})):[];}
export function percent(value:number){return Math.round(value*1000)/10+'%';}

/** Server error codes → short guidance; the server reason text is shown alongside. */
export const craftErrorHints:Record<string,string>={FORGE_PLACE:'请到拾星港锻造台旁操作。',STORY_LOCKED:'锻造功能尚未开放。',CRAFT_LOCKED:'配方未学会，或熟练度、设施等级不足。',CRAFT_MATERIAL:'材料不足。',CRAFT_GOLD:'金币不足。',BAG_FULL:'背包已满，请先整理装备。',CRAFT_STAGE:'请先通过对应地城。',REVISION:'角色状态已更新，已重新读取。',GATHER_FAR:'离采集点太远。',GATHER_DONE:'本轮已经采过。',GATHER_PLACE:'这里现在不能采集。'};
