import raw from './equipment-catalog.json';
import rawSetNames from './equipment-set-names.json';
import {z} from 'zod';
import {equipmentCatalogSchema,equipmentFamilies,equipmentParts,equipmentSeries} from '../contracts/equipment-catalog.ts';

/** Public item definitions; acquisition and instantiated combat equipment are separate. */
export const equipmentCatalog=equipmentCatalogSchema.parse(raw);
export const equipmentItems=equipmentCatalog.items;
export const equipmentSetNames=z.record(z.string().min(1),z.string().min(1)).parse(rawSetNames);
const byId=new Map(equipmentItems.map(item=>[item.id,item]));
if(byId.size!==equipmentItems.length)throw Error('Duplicate equipment item ID');
if(new Set(equipmentItems.map(item=>item.name)).size!==equipmentItems.length)throw Error('Duplicate equipment display name');
const expected=new Set<string>();
for(const series of equipmentSeries)for(const family of equipmentFamilies)for(const tier of [1,2,3])for(const part of equipmentParts){
 const id=`${series}-${family}-t${tier}-${part}`,item=byId.get(id);expected.add(id);
 if(!item||item.series!==series||item.family!==family||item.tier!==tier||item.part!==part||item.setId!==`${series}-${family}-t${tier}`||item.iconId!==`gear-${id}`)throw Error('Missing or misplaced equipment item '+id);
 if(item.obtainable&&!item.runtimeBase)throw Error('Obtainable item needs a runtime equipment definition: '+id);
}
if(expected.size!==byId.size)throw Error('Unexpected equipment catalog entry');
const setIds=new Set(equipmentItems.map(item=>item.setId));
if(Object.keys(equipmentSetNames).length!==setIds.size||Object.keys(equipmentSetNames).some(id=>!setIds.has(id))||[...setIds].some(id=>!equipmentSetNames[id]))throw Error('Missing or unexpected equipment set name');
if(new Set(Object.values(equipmentSetNames)).size!==setIds.size)throw Error('Duplicate equipment set name');
export function getEquipmentItem(id:string){return byId.get(id);}
export function getEquipmentSetName(id:string){return equipmentSetNames[id];}

const familyLabels={sword:'剑',hammer:'锤',axe:'斧',staff:'法杖',hidden:'暗器',wand:'魔杖'} as const;
const seriesLabels={standard:'常规',omega:'方阵',primal:'原初'} as const;
const partLabels={weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',necklace:'项链',ring:'戒指'} as const;
export function equipmentClassification(base:string){const item=byId.get(base);return item?`${seriesLabels[item.series]} · ${familyLabels[item.family]}`:'';}
export function matchesEquipmentSearch(base:string,query:string){
 const item=byId.get(base);if(!item)return false;
 const text=[item.name,equipmentSetNames[item.setId],equipmentClassification(base),'T'+item.tier,partLabels[item.part]].join(' ').toLocaleLowerCase();
 const terms=query.trim().toLocaleLowerCase().split(/[\s·,，、/]+/).filter(Boolean);
 return terms.length>0&&terms.every(term=>text.includes(term));
}
