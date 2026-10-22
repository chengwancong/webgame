import {currentGearCount} from './current-inventory.ts';
import {randomInt,randomUUID} from 'node:crypto';
import type {CharacterState,Gear} from '../contracts/index.ts';
import {versions} from '../contracts/index.ts';
import {craftActionSchema,type CraftAction,type CraftPreview,type CraftDelta,type CraftingView} from '../contracts/crafting.ts';
import {craftRecipes,craftMaterials,craftFacilities,craftFacilityCost,craftMasterwork,craftPatterns,craftCodex,craftPolicy,craftText,craftSignatureRecipe,craftRepairRecipe} from '../content/crafting.ts';
import {ensureProgression,assignGearAspect} from './deep-progression.ts';
import {settings} from '../content/index.ts';
import {makeGearByBase,gearBases} from './index.ts';
import {applyItemPower,scaleItemAffixes} from './item-power.ts';
import {affixDisplayValue} from '../contracts/affix-units.ts';
import {generateGearAffixes,gearAffixConfig,maxAffixTierForItemLevel,type AffixRandom} from './affix-generator.ts';
import {equipmentItems} from '../content/equipment-catalog.ts';
import {gearWeaponType,mainHandWeapon,gearWeaponAffinity,type WeaponAffinity} from './weapon-skills.ts';
import {freezeItemRules,issueCombatGear} from './item-issuance.ts';
import {statDefinition} from '../contracts/stats.ts';
import {starseaFactionByMap} from '../content/starsea/reputation.ts';
import {guaranteedAffixPool as guaranteedPool,generateGuaranteedAffix} from './guaranteed-affix.ts';

export class CraftError extends Error{constructor(public code:string,message:string){super(message);}}
function need(condition:unknown,code:string,message:string):asserts condition{if(!condition)throw new CraftError(code,message);}
export function ensureCrafting(s:CharacterState){if(!s.progression?.crafting)ensureProgression(s);const c=s.progression!.crafting;c.once??=[];for(const {id}of craftPolicy.professions)c.professions[id]??={level:1,xp:0};return c;}
export function craftingXp(s:CharacterState,id:string,amount:number){const p=ensureCrafting(s).professions[id];p.xp+=amount;while(p.level<craftPolicy.xp.maxLevel&&p.xp>=craftPolicy.xp.base+craftPolicy.xp.perLevel*p.level){p.xp-=craftPolicy.xp.base+craftPolicy.xp.perLevel*p.level;p.level++;}return {...p};}
export function craftingFineChance(s:CharacterState,profession:string){const c=ensureCrafting(s),id=craftPolicy.professions.find(p=>p.id===profession)?.facility,facility=craftFacilities.find(f=>f.id===id&&f.level===(c.facilities[id??'']??1));return Math.min(craftPolicy.fine.max,craftPolicy.fine.base+c.professions[profession].level*craftPolicy.fine.perLevel+(facility?.fineBonus??0));}
export function craftIslandOpen(s:CharacterState,island:string|null){return !island||Boolean(s.starsea?.islands.includes(island)||s.progress.regions.includes(island)||!s.starsea&&starseaFactionByMap.get(island)?.id&&s.progress.regions.includes(starseaFactionByMap.get(island)!.id));}
function facilityCost(s:CharacterState,f:typeof craftFacilities[number]){return craftFacilityCost(f,craftMaterials.flatMap(m=>m.island&&craftIslandOpen(s,m.island)?[m.island]:[]));}
export function craftRepairAvailable(s:CharacterState){return Boolean(s.starsea?.prologue)&&!s.progression?.crafting?.once?.includes(craftRepairRecipe?.id??'');}
/** 修复对象：装备中的开场武器（1 级、带开场「攻击」词缀）。 */
export function craftRepairTarget(s:Pick<CharacterState,'gear'|'equipment'>){return s.gear.find(g=>g.id===s.equipment.weapon&&g.slot==='weapon'&&(g.ilvl??1)===1&&g.affixes.some(a=>a.id===g.id+'-attack'));}
const repairTargetText='先装备开场武器，再来修复。';
export function craftRecipeKnown(s:CharacterState,r:typeof craftRecipes[number]){return r.output.repair?craftRepairAvailable(s):r.output.pattern?ensureCrafting(s).patterns.includes(r.output.pattern):craftSignatureRecipe(r)?craftIslandOpen(s,r.island):s.progression!.recipes.includes(r.id);}
const known=craftRecipeKnown;
export function learnCraftPattern(s:CharacterState,g:Gear){const pattern=craftPatterns.find(p=>p.base===g.base);if(!pattern||!(g.quality==='legendary'||g.setId))return [];const c=ensureCrafting(s);if(c.patterns.includes(pattern.id))return [];c.patterns.push(pattern.id);if(g.aspectId&&pattern.quality==='legendary')c.patternAspects[pattern.id]=g.aspectId;return [pattern.id];}
const quantity=(s:CharacterState,id:string)=>id==='enhance_stone'?s.material:s.progression!.materials[id]??0;
export type CraftPlace={atForge:boolean;reason:string;storyUnlocked:boolean;maxCraftLevel?:number};
type Plan={cost:CraftPreview['cost'];output:CraftPreview['output'];recipe?:typeof craftRecipes[number];material?:{id:string;count:number};facility?:{id:string;level:number};gear?:Gear;template?:typeof gearBases[number];guaranteedStat?:string;affinity?:WeaponAffinity};
const round=(n:number)=>Math.round(n*1e6)/1e6;
/** The preview and roll share the same eligible tiers, including the low-level fallback. */
function guaranteedPreview(stat:string,level:number){
 const {pool,scaled}=guaranteedPool(stat,level),name=gearAffixConfig.names[stat as keyof typeof gearAffixConfig.names];
 const values=pool.flatMap(row=>[row.minValue,row.maxValue].map(value=>{const affix={id:'preview',name,stat:row.stat,value,tier:row.tier,description:''};return scaled?scaleItemAffixes([affix],level)[0].value:value;}));
 const min=affixDisplayValue(stat,Math.min(...values)),max=affixDisplayValue(stat,Math.max(...values));
 return `${name} +${min}${min===max?'':'～'+max}`;
}
function guaranteedStat(element:string|undefined,tendency:string|undefined,slot:string|undefined){
 const candidates=element?[element+'Damage',element+'Resist']:slot==='weapon'?[craftPolicy.tendencyStats[(tendency??'martial') as 'martial'|'spell']]:[];
 return candidates.find(stat=>gearAffixConfig.pool.some(row=>row.stat===stat));
}
function templateFor(s:CharacterState,r:typeof craftRecipes[number],a:Extract<CraftAction,{op:'craft'}>){
 if(r.output.base)return gearBases.find(g=>g.base===r.output.base);
 if(r.output.repair){const target=craftRepairTarget(s);return target&&gearBases.find(g=>g.base===target.base);}
 const slot=a.slot??r.options.slots?.[0],affinity=a.tendency,preferred=mainHandWeapon(s);
 const pool=gearBases.filter(g=>g.slot===slot&&equipmentItems.some(i=>i.id===g.base&&i.series==='standard'&&i.tier===1)&&(!affinity||g.slot!=='weapon'||(affinity==='spell'?['staff','wand'].includes(gearWeaponType(g)!):gearWeaponType(g)!=='wand')));
 return pool.find(g=>g.slot==='weapon'&&gearWeaponType(g)===preferred)??pool[0];
}
/** 报价只组装配置和可选池，绝不生成实例或消耗随机流。 */
function plan(s:CharacterState,a:CraftAction):Plan{
 const c=ensureCrafting(s),cost={gold:0,materials:{} as Record<string,number>};
 if(a.op==='craft'){
  const r=craftRecipes.find(r=>r.id===a.recipe);need(r,'CRAFT_UNKNOWN',craftText.unknownRecipe);const n=a.count??1;
  cost.gold=r.baseCost.gold*n;for(const[id,count]of Object.entries(r.baseCost.materials))cost.materials[id]=count*n;
  if(a.element){const boss=craftMaterials.find(m=>m.island===r.island&&m.tier==='T2');need(boss,'CRAFT_UNKNOWN',r.unlockHint);cost.materials[boss.id]=(cost.materials[boss.id]??0)+n;}
  const template=r.output.kind==='gear'?templateFor(s,r,a):undefined,tendency=a.tendency??(r.output.repair&&template?.slot==='weapon'?(['staff','wand'].includes(gearWeaponType(template)!)?'spell':'martial'):undefined),stat=r.category==='pattern'?undefined:guaranteedStat(a.element,tendency,template?.slot),level=r.output.level;
  const primary=gearAffixConfig.mainStats.find(row=>row.slot===template?.slot)?.stat??(template?.attack?'attack':template?.armor?'armor':undefined),quality=gearAffixConfig.quality[r.output.quality??'rare'];
  const pool=gearAffixConfig.pool.filter(row=>row.tier<=(level?maxAffixTierForItemLevel(level):3)&&quality.tiers.includes(row.tier)&&row.stat!==primary&&row.stat!==stat&&(!template||statDefinition(row.stat)!.slots.includes(template.slot))),weights=new Map<string,number>();for(const row of pool)weights.set(row.stat,(weights.get(row.stat)??0)+1);
  return {cost,recipe:r,template,guaranteedStat:stat,affinity:tendency as WeaponAffinity|undefined,output:{kind:r.output.kind,name:template?.name??r.name,icon:template?(equipmentItems.find(i=>i.id===template.base)?.iconId??'gear-'+template.base):craftMaterials.find(m=>m.id===r.output.id)?.icon??craftPolicy.defaultIcon,count:n*(r.output.count??1),...(r.output.kind==='gear'?{quality:r.output.quality,level,...(r.output.repair?{}:{fineChance:craftingFineChance(s,r.profession)}),affixPool:[...weights].map(([stat,weight])=>({label:gearAffixConfig.names[stat as keyof typeof gearAffixConfig.names],weight})),...(stat?{guaranteedAffix:guaranteedPreview(stat,level??1)}:{})}:{})}};
 }
 if(a.op==='refine'||a.op==='exchange'){
  const m=craftMaterials.find(m=>m.id===(a.op==='refine'?a.from:a.to));need(m,'CRAFT_UNKNOWN',craftText.unknownMaterial);
  const rule=craftPolicy.refine.find(r=>r.tier===m.tier);need(a.op==='exchange'?m.tier==='T1':rule,'CRAFT_LOCKED',craftText.exchangeLocked);
  const from=a.op==='refine'?m.id:'stardust',to=a.op==='refine'?'stardust':m.id;
  const facility=craftFacilities.find(f=>f.id==='alchemy'&&f.level===(c.facilities.alchemy??1));
  cost.materials[from]=(a.op==='refine'?rule!.input:craftPolicy.exchange.input)*a.times;
  const count=a.op==='refine'?rule!.output*a.times:Math.floor(craftPolicy.exchange.output*a.times/(1-(facility?.exchangeBonus??0)));
  return {cost,material:{id:to,count},output:{kind:'material',name:craftMaterials.find(m=>m.id===to)!.name,icon:craftMaterials.find(m=>m.id===to)!.icon,count}};
 }
 if(a.op==='facility.upgrade'){
  const level=(c.facilities[a.facility]??1)+1,f=craftFacilities.find(f=>f.id===a.facility&&f.level===level);need(f,'CRAFT_LOCKED',craftText.facilityMax);
  return {cost:facilityCost(s,f),facility:{id:f.id,level},output:{kind:'facility',name:f.name,icon:craftPolicy.defaultIcon,count:1,level,statChanges:[{label:craftText.facilityLevel,before:String(level-1),after:String(level)}]}};
 }
 if(a.op==='masterwork.apply'||a.op==='masterwork.reroll'){
  const g=s.gear.find(g=>g.id===a.gear);need(g,'CRAFT_UNKNOWN',craftText.unknownGear);const lv=c.masterwork[g.id]??0,spec=craftMasterwork.find(m=>m.level===(a.op==='masterwork.apply'?lv+1:lv));need(spec,'CRAFT_LOCKED',craftText.masterworkMax);
  const before=g.mainStat?.value??Math.max(g.attack,g.armor),after=a.op==='masterwork.apply'?round(before*(1+craftPolicy.masterwork.perLevel*(lv+1))/(1+craftPolicy.masterwork.perLevel*lv)):before;
  return {cost:structuredClone(spec.cost),gear:g,output:{kind:'masterwork',name:g.name,icon:equipmentItems.find(i=>i.id===g.base)?.iconId??craftPolicy.defaultIcon,count:1,level:spec.level,statChanges:[{label:craftText.statPrimary,before:String(before),after:String(after)}]}};
 }
 const target=craftCodex.find(d=>d.id===a.target);need(target,'CRAFT_UNKNOWN',craftText.unknownCodex);
 return {cost,output:{kind:'pattern',name:target.name,icon:craftPolicy.defaultIcon,count:1}};
}
function validate(s:CharacterState,a:CraftAction,p:Plan,place:CraftPlace){
 need(place.storyUnlocked,'STORY_LOCKED',place.reason);need(place.atForge,'FORGE_PLACE',place.reason);const c=ensureCrafting(s);
 if(p.recipe&&a.op==='craft'){
  const r=p.recipe;need(known(s,r)&&craftIslandOpen(s,r.island),'CRAFT_LOCKED',r.unlockHint);need(c.professions[r.profession].level>=r.levelRequired,'CRAFT_LOCKED',r.unlockHint);need(!r.facilityRequired||(c.facilities[r.facilityRequired.id]??1)>=r.facilityRequired.level,'CRAFT_LOCKED',r.unlockHint);
  need(r.output.kind!=='gear'||(a.count??1)===1,'CRAFT_LOCKED',r.unlockHint);
  for(const[selected,choices]of [[a.slot,r.options.slots],[a.tendency,r.options.tendencies],[a.element,r.options.elements]] as const)need(!selected||choices?.includes(selected),'CRAFT_UNKNOWN',r.unlockHint);
  // 修复是原地重铸开场武器：不占背包，也不受地城阶段上限（只做一次，强度见 tools/spine/repair-weapon-check.ts）。
  if(r.output.repair)need(craftRepairTarget(s)&&p.template,'CRAFT_LOCKED',repairTargetText);
  else if(r.output.kind==='gear'){need(p.template,'CRAFT_UNKNOWN',r.unlockHint);need(currentGearCount(s.gear)<settings.capacity,'BAG_FULL',craftText.bagFull);need((r.output.level??1)<=(place.maxCraftLevel??0),'CRAFT_STAGE',craftText.stage);}
 }
 if(a.op==='exchange'){const m=craftMaterials.find(m=>m.id===a.to)!;need(craftIslandOpen(s,m.island),'CRAFT_LOCKED',craftText.exchangeLocked);}
 if(a.op==='masterwork.apply'||a.op==='masterwork.reroll'){
  need((s.world?.unlockedWorldTier??1)>=craftPolicy.masterwork.unlockTier,'CRAFT_LOCKED',craftText.masterworkLocked);
  if(a.op==='masterwork.reroll'){const lv=c.masterwork[a.gear]??0;need(craftMasterwork.some(row=>row.reroll&&row.level<=lv)&&a.lockAffix<p.gear!.affixes.length,'CRAFT_LOCKED',craftText.rerollLocked);}
 }
 if(a.op==='codex.claim'){const d=craftCodex.find(d=>d.id===a.target)!;need(!c.claims.includes(d.id)&&craftRecipes.filter(r=>r.island===d.island&&!r.output.repair).every(r=>known(s,r)),'CRAFT_LOCKED',d.description);}
 need(s.gold>=p.cost.gold,'CRAFT_GOLD',craftText.gold);need(Object.entries(p.cost.materials).every(([id,n])=>quantity(s,id)>=n),'CRAFT_MATERIAL',craftText.material);
 const material=p.material??(p.recipe?.output.kind==='material'?{id:p.recipe.output.id!,count:p.output.count}:undefined);
 if(material){const def=craftMaterials.find(m=>m.id===material.id)!;need(quantity(s,material.id)-(p.cost.materials[material.id]??0)+material.count<=def.stack,'CRAFT_MATERIAL',craftText.stackFull);}
}
export function previewCraft(s:CharacterState,input:CraftAction,place:CraftPlace):CraftPreview{
 const copy=structuredClone(s),action=craftActionSchema.parse(input);ensureProgression(copy);let p:Plan={cost:{gold:0,materials:{}},output:{kind:'material',name:craftText.craft,icon:craftPolicy.defaultIcon,count:0}};
 try{p=plan(copy,action);validate(copy,action,p,place);return {revision:s.revision,action,enabled:true,reason:'',cost:p.cost,output:p.output,bagFull:false};}catch(e){if(!(e instanceof CraftError))throw e;return {revision:s.revision,action,enabled:false,reason:e.message,cost:p.cost,output:p.output,bagFull:e.code==='BAG_FULL'};}
}
const random:AffixRandom={int:randomInt,float:()=>randomInt(0,1000000)/1000000};
/** 扣费、随机产出与成长都在副本上执行，任一失败都不改变调用者。 */
export function applyCraft(s:CharacterState,input:CraftAction,place:CraftPlace,rng:AffixRandom=random):CraftDelta{
 const copy=structuredClone(s),a=craftActionSchema.parse(input);ensureProgression(copy);const p=plan(copy,a);validate(copy,a,p,place);const growth=copy.progression!,c=ensureCrafting(copy),delta:CraftDelta={gold:-p.cost.gold,materials:{}};
 copy.gold-=p.cost.gold;for(const[id,n]of Object.entries(p.cost.materials)){if(id==='enhance_stone')copy.material-=n;else growth.materials[id]=(growth.materials[id]??0)-n;delta.materials[id]=-n;}
 if(p.recipe){const r=p.recipe,n=a.op==='craft'?a.count??1:1;
  if(r.output.kind==='consumable'){const count=n*(r.output.count??1);growth.consumables[r.output.id!]=(growth.consumables[r.output.id!]??0)+count;delta.consumables={[r.output.id!]:count};}
  else if(r.output.kind==='material')p.material={id:r.output.id!,count:p.output.count};
  else{
   const old=r.output.repair?craftRepairTarget(copy)!:undefined;let id=old?.id??randomUUID();if(!old&&p.template!.slot==='weapon'&&gearWeaponType(p.template)==='staff'&&p.affinity)id=id.slice(0,-1)+(p.affinity==='spell'?'1':'0');
   const g=makeGearByBase(p.template!.base,id);g.quality=r.output.quality??'rare';applyItemPower(g,r.output.level??1);
   const frozen=freezeItemRules(),primary=frozen.affixes.mainStats.find(row=>row.slot===g.slot);if(primary)frozen.affixes.mainStats=[primary];issueCombatGear(g,g.ilvl!,3,copy.level,false,frozen,rng);
   if(p.guaranteedStat){
    const affix=generateGuaranteedAffix(g,p.guaranteedStat,rng,frozen.affixes);
    need(affix,'CRAFT_UNKNOWN',r.unlockHint);g.affixes=[affix,...g.affixes.filter(a=>a.stat!==affix.stat)].slice(0,Math.max(1,g.affixes.length));
   }
   if(old){g.affixes=[structuredClone(old.affixes.find(a=>a.id===old.id+'-attack')!),...g.affixes.filter(a=>a.stat===p.guaranteedStat).slice(0,1)];if(old.locked)g.locked=true;}
   if(r.output.pattern&&g.quality==='legendary'){const aspect=c.patternAspects[r.output.pattern];if(aspect)g.aspectId=aspect;else{delete g.aspectId;assignGearAspect(g,[...r.id].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,7),copy.level);}}
   delta.fine=!old&&rng.float()<craftingFineChance(copy,r.profession);if(delta.fine){if(g.mainStat)g.mainStat.value=round(g.mainStat.value*(1+craftPolicy.fine.mainBonus));else{g.attack=Math.round(g.attack*(1+craftPolicy.fine.mainBonus));g.armor=Math.round(g.armor*(1+craftPolicy.fine.mainBonus));}}
   if(old)copy.gear[copy.gear.findIndex(x=>x.id===old.id)]=g;else copy.gear.push(g);delta.gear=[g];
  }
  delta.professions={[r.profession]:craftingXp(copy,r.profession,craftPolicy.xp.craft*n)};
  if(a.op==='craft'&&c.pin?.recipe===r.id)delete c.pin;
  if(r.output.repair&&!c.once.includes(r.id))c.once.push(r.id);
 }
 if(p.material){const{id,count}=p.material;growth.materials[id]=(growth.materials[id]??0)+count;delta.materials[id]=(delta.materials[id]??0)+count;}
 if(p.facility){c.facilities[p.facility.id]=p.facility.level;delta.facility=p.facility;}
 if(a.op==='codex.claim')c.claims.push(a.target);
 if(p.gear){const g=p.gear,lv=c.masterwork[g.id]??0;
  if(a.op==='masterwork.apply'){const prior=1+craftPolicy.masterwork.perLevel*lv,base=c.masterworkBases[g.id]??={attack:g.attack/prior,armor:g.armor/prior,...(g.mainStat?{main:g.mainStat.value/prior}:{})},factor=1+craftPolicy.masterwork.perLevel*(lv+1);if(g.mainStat)g.mainStat.value=round(base.main!*factor);else{g.attack=Math.round(base.attack*factor);g.armor=Math.round(base.armor*factor);}c.masterwork[g.id]=lv+1;}
  else if(a.op==='masterwork.reroll'){const locked=structuredClone(g.affixes[a.lockAffix]),count=g.affixes.length-1,config={...gearAffixConfig,pool:gearAffixConfig.pool.filter(row=>row.stat!==locked.stat),quality:{...gearAffixConfig.quality,[g.quality]:{...gearAffixConfig.quality[g.quality],count:[count,count] as [number,number]}}};const next=generateGearAffixes(g,3,rng,config);need(next.length===count,'CRAFT_LOCKED',craftText.rerollLocked);next.splice(a.lockAffix,0,locked);g.affixes=next;}
 }
 copy.build++;Object.assign(s,copy);return delta;
}
export function craftingView(s:CharacterState,place:{atForge:boolean;reason:string},stageKey:CraftingView['stageKey']=null):CraftingView{
 const copy=structuredClone(s);ensureProgression(copy);const c=ensureCrafting(copy);
 return {revision:s.revision,ruleset_version:versions.rules,atForge:place.atForge,forgeReason:place.reason,
  materials:craftMaterials.map(m=>({id:m.id,quantity:quantity(copy,m.id),uses:craftRecipes.filter(r=>r.baseCost.materials[m.id]).map(r=>({recipe:r.id,name:r.name}))})),
  professions:craftPolicy.professions.map(p=>({id:p.id as CraftingView['professions'][number]['id'],name:p.name,...c.professions[p.id],xpNext:craftPolicy.xp.base+craftPolicy.xp.perLevel*c.professions[p.id].level,fineChance:p.id==='gathering'?0:craftingFineChance(copy,p.id)})),
  recipes:craftRecipes.filter(r=>!r.output.repair||craftRepairAvailable(copy)).map(({output,...r})=>({...r,known:known(copy,{...r,output})})),patterns:craftPatterns.map(r=>({id:r.id,name:r.name,slot:r.slot,quality:r.quality as 'legendary'|'set',island:r.island??null,learned:c.patterns.includes(r.id),sourceHint:r.sourceHint})),
  codex:craftCodex.map(d=>{const rs=craftRecipes.filter(r=>r.island===d.island&&!r.output.repair);return {id:d.id,name:d.name,required:rs.length,current:rs.filter(r=>known(copy,r)).length,bonus:d.description,claimed:c.claims.includes(d.id)};}),
  facilities:craftFacilities.filter(f=>f.level===(c.facilities[f.id]??1)).map(f=>{const next=craftFacilities.find(n=>n.id===f.id&&n.level===f.level+1);return {id:f.id as CraftingView['facilities'][number]['id'],name:f.name,level:f.level,maxLevel:6,appearanceTier:Math.ceil(f.level/2) as 1|2|3,effects:f.effects,next:next?{level:next.level,cost:facilityCost(copy,next),effects:next.effects}:null};}),
  refine:craftMaterials.filter(m=>craftPolicy.refine.some(r=>r.tier===m.tier)&&(craftIslandOpen(copy,m.island)||quantity(copy,m.id)>0)).map(m=>{const rule=craftPolicy.refine.find(r=>r.tier===m.tier)!;return {from:m.id,to:'stardust',inputCount:rule.input,outputCount:rule.output};}),
  masterwork:{unlocked:(s.world?.unlockedWorldTier??1)>=craftPolicy.masterwork.unlockTier,reason:(s.world?.unlockedWorldTier??1)>=craftPolicy.masterwork.unlockTier?'':craftText.masterworkLocked,maxLevel:5},stageKey};
}
