import {appearanceSelectionSchema,appearanceSlots,type AppearanceSelection,type AppearanceView,type ResolvedAppearance} from '../contracts/appearance.ts';
import type {CharacterState} from '../contracts/index.ts';
import {appearanceContent} from '../content/appearance.ts';
import {getEquipmentItem} from '../content/equipment-catalog.ts';
import {gearWeaponType} from './weapon-skills.ts';
import type {AppearanceKit} from '../contracts/appearance.ts';

export class AppearanceError extends Error{constructor(public code:string,message:string){super(message);}}
const bundles=new Map(appearanceContent.bundles.map(b=>[b.id,b]));
function eligible(s:CharacterState,b:typeof appearanceContent.bundles[number]){
 const condition=b.unlock;
 return condition.type==='starter'||condition.type==='gear'&&s.gear.some(g=>g.base===condition.base)||condition.type==='region'&&s.progress.regions.includes(condition.region)||condition.type==='boss'&&s.progress.bosses.includes(condition.boss)||condition.type==='nodeFirstClear'&&Boolean(s.starsea?.seen.includes('hub-node:'+condition.node));
}
// Called by additive migration and transaction boundaries. Collection survives
// later salvage; no resource is unlocked merely because an asset exists.
export function ensureAppearance(s:CharacterState){
 s.appearance??={selection:{},unlocked:[]};
 const owned=new Set(s.appearance.unlocked);
 for(const bundle of appearanceContent.bundles)if(eligible(s,bundle))owned.add(bundle.id);
 s.appearance.unlocked=[...owned];return s.appearance;
}
function ownedSets(s:CharacterState){return new Set([...(s.appearance?.unlocked??[]),...appearanceContent.bundles.filter(b=>eligible(s,b)).map(b=>b.id)]);}
export function validateAppearanceSelection(s:CharacterState,input:unknown,checkFamily=true):AppearanceSelection{
 const selection=appearanceSelectionSchema.parse(input),owned=ownedSets(s);
 const main=s.gear.find(g=>g.id===s.equipment.weapon);const family=(main?appearanceContent.equipment[main.base]?.family:undefined)??appearanceContent.fallbackFamily;
 for(const slot of appearanceSlots){const selected=selection[slot];if(selected===undefined)continue;
  const bundle=bundles.get(selected);
  if(!bundle||!bundle.slots.includes(slot))throw new AppearanceError('APPEARANCE_PART','该部位没有可用的外观资源。');
  if(slot==='weapon'&&checkFamily&&!bundle.weaponFamilies.includes(family))throw new AppearanceError('APPEARANCE_WEAPON','该武器外观与当前主手类型不兼容。');
  if(!owned.has(selected))throw new AppearanceError('APPEARANCE_LOCKED','尚未收集该外观，请先完成解锁条件。');
 }
 return selection;
}
// 脸和发型是玩家自己的形象：只看外观选择，穿戴装备不改变。背部后发跟着脸走，箭袋、刀鞘等背饰跟着衣服走；
// 衣服决定身体、手和腿，鞋子只换脚，武器只换武器。
// 原生骨骼按真实主手类型与护甲系列/阶级选身体与武器；旧底材（blade、omega-bow…）按名字前缀取系列、阶级1。
function gearGrade(base:string){const item=getEquipmentItem(base);return item?{series:item.series,tier:item.tier}:{series:(/^(primal|omega)-/.exec(base)?.[1]??'standard') as 'standard'|'primal'|'omega',tier:1};}
export function appearanceKit(s:Pick<CharacterState,'gear'|'equipment'>):AppearanceKit{
 const main=s.gear.find(g=>g.id===s.equipment.weapon),type=gearWeaponType(main),armor=s.gear.find(g=>g.id===s.equipment.armor),worn=armor&&getEquipmentItem(armor.base);
 return {weapon:type&&main?{type,...gearGrade(main.base)}:null,armor:worn?{family:worn.family,series:worn.series,tier:worn.tier}:null};
}
export function resolveAppearance(s:CharacterState,selection:AppearanceSelection=s.appearance?.selection??{}):ResolvedAppearance{
 const main=s.gear.find(g=>g.id===s.equipment.weapon),armor=s.gear.find(g=>g.id===s.equipment.armor),boots=s.gear.find(g=>g.id===s.equipment.boots);
 const weapon=main?appearanceContent.equipment[main.base]:undefined,clothes=armor?appearanceContent.equipment[armor.base]?.setId??appearanceContent.defaultSet:appearanceContent.defaultSet;
 const family=weapon?.family??appearanceContent.fallbackFamily;
 const selected=validateAppearanceSelection(s,selection,false),parts={} as ResolvedAppearance['parts'];
 const head=selected.head??appearanceContent.defaultSet;
 const back=bundles.get(head)?.back==='hair'?head:bundles.get(clothes)?.back==='gear'?clothes:bundles.get(head)?.back==='none'?head:appearanceContent.defaultSet;
 for(const slot of appearanceSlots){
  const automatic=slot==='weapon'?weapon?.setId??appearanceContent.defaultWeaponSets[family]:slot==='head'?head:slot==='back'?back:slot==='feet'&&boots?appearanceContent.equipment[boots.base]?.setId??clothes:clothes;
  const override=slot==='weapon'&&selected.weapon&&!bundles.get(selected.weapon)?.weaponFamilies.includes(family)?undefined:selected[slot];
  const automaticBundle=bundles.get(automatic);
  parts[slot]={setId:override??(automaticBundle?.slots.includes(slot)?automatic:appearanceContent.defaultSet)};
 }
 return {rig:'modular-hero',family,parts,styleProfile:'v2-soft',revision:s.revision,kit:appearanceKit(s)};
}
export function previewAppearance(s:CharacterState,input:unknown){const selection=validateAppearanceSelection(s,input);return {revision:s.revision,selection,resolvedAppearance:resolveAppearance(s,selection)};}
export function appearanceView(s:CharacterState):AppearanceView{
 const owned=ownedSets(s),selection=s.appearance?.selection??{};
 return {revision:s.revision,selection,resolvedAppearance:resolveAppearance(s,selection),slots:[...appearanceSlots],catalog:appearanceContent.bundles.map(({id,name,slots,weaponFamilies,unlockHint})=>({id,name,slots:[...slots],weaponFamilies:[...weaponFamilies],owned:owned.has(id),unlockHint}))};
}
export function applyAppearance(s:CharacterState,input:unknown){const selection=validateAppearanceSelection(s,input);ensureAppearance(s).selection=selection;}
