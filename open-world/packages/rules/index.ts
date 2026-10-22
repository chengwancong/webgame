import {craftBuffValue} from './crafting-consumables.ts';
import {settings} from '../content/index.ts';
import {applySkillPatches} from './skill-patches.ts';
import {ownedCrystalSources} from './crystal-progress.ts';
import {resolvedHardmodeGrowth} from './hardmode-growth.ts';
import {collectBuildParts,applyBuildParts,applyAttributeSkill,type BuildParts} from './build-parts.ts';
import {mainStatContribution} from './main-stats.ts';
import {numericStat} from '../contracts/stats.ts';
import {mainHandWeapon,mainHandAffinity,skillWeaponAllowed,skillWeaponRequirement,rememberWeaponSkills} from './skill-weapon-access.ts';
import {weaponAffinityPower} from '../content/skill-weapons.ts';
import {resolveWeaponCombos} from './weapon-combos.ts';
import {primaryReinforcement} from './combat-numerics.ts';
import {gearMaxRank} from './item-power.ts';
import {starseaBalance,lifeCrystalHp} from '../content/starsea/index.ts';
import {characterDamageZones,foldZones,skillCoefficientBase} from './damage-zones.ts';
import {skillTags} from '../content/skill-tags.ts';
import {ensureProgression,resolveProgressionStats,resolveProgressionSkill,progressionLevelCap,assignGearAspect,applyParagonXp} from './deep-progression.ts';
export * from './deep-progression.ts';
import {progressionGearTemplates} from '../content/deep-progression.ts';
import type {CharacterState,Stats,Skill,Gear,Slot,Effect,SkillAccess,GearQuality,GearAffix} from '../contracts/index.ts';
import {skillCatalog,starterSkills,skillBookRewards,regionById,levelStats} from '../content/index.ts';
import {gearSchema,gearShapeSchema} from '../contracts/index.ts';
import {z} from 'zod';
import gearDefinitions from './gear-bases.json';
import progressionCurve from '../content/progression-curve.json';
import {skillCoefficients} from '../content/spine-controls.ts';
import {skillSealed,signatureRow,grantRow,spellIslandGate,skillSlotCount,recoveryFamily} from './skill-slots.ts';
import {prologueConfig} from '../content/starsea/prologue.ts';
import {taskById} from '../content/task-tables.ts';
import {starseaMap} from '../content/starsea/index.ts';
import {collectionGearTemplates} from '../content/equipment-runtime.ts';
import {withCurrentEquipmentNames} from './equipment-names.ts';
import {ordinaryGearSlotSchema} from '../contracts/gear-slots.ts';
import {isLegacyHexSlot as isHexSlot} from './legacy-hex.ts';
import {hexDefinition} from './hex-runes.ts';
const gearBaseSchema=gearShapeSchema.omit({id:true,rank:true,locked:true}).extend({slot:ordinaryGearSlotSchema,primary_attribute:z.enum(['attack','armor']),reinforcement_per_rank:z.number().int().positive(),regional_primary_base:z.number().positive().optional()}).strict().refine(g=>g.primary_attribute==='attack'?g.attack>0&&g.armor===0:g.armor>0&&g.attack===0,'Equipment must have exactly one primary attribute');
export const gearBases=z.array(gearBaseSchema).parse([...gearDefinitions,...progressionGearTemplates.map(g=>({base:g.base,slot:'weapon',name:g.name,primary_attribute:'attack',attack:g.attack,armor:0,reinforcement_per_rank:2,effect:'none',quality:g.base.startsWith('primal')?'legendary':'rare',affixes:[]})),...collectionGearTemplates]);
const gearDefinitionByBase=new Map(gearBases.map(definition=>[definition.base,definition]));
if(gearDefinitionByBase.size!==gearBases.length)throw Error('Duplicate runtime equipment base');
export function gearPrimaryAttribute(g:Pick<Gear,'base'>&Partial<Pick<Gear,'mainStat'>>){if(g.mainStat)return g.mainStat.stat;const definition=gearDefinitionByBase.get(g.base);if(!definition)throw Error('Unknown equipment definition: '+g.base);return definition.primary_attribute;}
import {applyAffixBonuses,applySetBonuses} from '../simulation/set-calculator.ts';
import {gearSets} from '../content/gear-sets.ts';
export function skillUnlocked(s:Pick<CharacterState,'skillRanks'>&{starsea?:CharacterState['starsea']},id:string){return skillCatalog.some(sk=>sk.id===id)&&(s.skillRanks[id]??0)>0&&!skillSealed(s,id);}
/** 装配为空时的回退：新流程角色回到本武器的起手招，老角色回到旧起手。 */
const fallbackSkills=(s:CharacterState)=>{const f=recoveryFamily(s);return [...(f?prologueConfig.families[f].starterSkills:starterSkills)];};
export function resolveSkillAccess(s:CharacterState,stats=resolveStats(s),parts=collectBuildParts(s)):SkillAccess[]{
 return skillCatalog.map(sk=>{
  const sealed=skillSealed(s,sk.id),rank=sealed?0:s.skillRanks[sk.id]??0,activated=rank>0,max=rank>=5;
  const source=skillBookRewards.find(r=>r.skill===sk.id),signature=signatureRow(s,sk.id),given=grantRow(s,sk.id),island=spellIslandGate(s,sk.id);
  // 新流程：招牌技只靠找回任务；法术与辅助要「等级 + 到过所属岛」，不再要技能书（docs/progression-goal-plan.md §4.1）。
  const activation:SkillAccess['activation']=signature?{type:'recovery',task:signature.task,name:taskById.get(signature.task)?.title??signature.task,order:signature.order,required:1,current:sealed?0:1}
   :given?{type:'task',task:given.task,name:taskById.get(given.task)?.title??given.task,required:1,current:sealed?0:1}
   :island?{type:'island',island:island.island,islandName:starseaMap(island.island).name,visited:island.visited,required:sk.unlockLevel,current:s.level}
   :sk.activation?{type:'book',book:sk.id,name:sk.name+'技能书',required:sk.activation.quantity,current:s.skillBooks?.[sk.id]??0,source:source?'首次击败'+(regionById(source.boss).spawns.find(m=>m.boss)?.name??regionById(source.boss).name):'尚无获取来源'}:{type:'level',required:sk.unlockLevel,current:s.level};
  const eligible=activation.current>=activation.required&&(activation.type!=='island'||activation.visited);
  const action=max?null:activated?'upgrade':'activate';
  const cost=action==='upgrade'?skillUpgradeCost(rank):action==='activate'?{gold:0,material:0}:null;
  const affordable=action==='activate'?eligible:action==='upgrade'?s.gold>=cost!.gold&&s.material>=cost!.material:false;
  const blocked:SkillAccess['blocked']=max?'max':!activated&&!eligible?activation.type==='island'?activation.current<activation.required?'level':'island':activation.type:!affordable?'resource':'';
  const affinity=mainHandAffinity(s);
  return {weaponCompatible:skillWeaponAllowed(s,sk.id),weaponRequirement:skillWeaponRequirement(sk.id,s),mainHandWeapon:mainHandWeapon(s),mainHandAffinity:affinity,affinityBonus:affinity&&skillTags(sk).includes(affinity)?weaponAffinityPower:1,id:sk.id,unlocked:activated,unlockLevel:sk.unlockLevel,activated,rank,max,eligible,activation,action,cost,affordable,blocked,current:activated?applyAttributeSkill(patchBuildSkill(resolveProgressionSkill(s,resolveSkill(sk.id,rank,stats,!!s.starsea),parts.progression),parts,stats),stats):null,next:action?applyAttributeSkill(patchBuildSkill(resolveProgressionSkill(s,resolveSkill(sk.id,activated?rank+1:1,stats,!!s.starsea),parts.progression),parts,stats),stats):null};
 });
}
function resolveSkill(id:string,rank:number,stats:Stats,starsea=false):Skill{
 const base=skillCatalog.find(sk=>sk.id===id)!;
 // 每个技能只折算对它生效的区（通用区 + 标签匹配的区）。
 const tags=skillTags(base),fold=stats.zones?foldZones(stats.zones,tags):{damageAdd:stats.damageAdd??0,damageMult:stats.damageMult??1};
 const out:Skill={...structuredClone(base),...(tags.length?{tags}:{})},growth=1+(rank-1)*.12,zone=(1+fold.damageAdd)*fold.damageMult,scale=stats.attack/skillCoefficientBase*growth*zone,coefficient=skillCoefficients[base.id]??1;
 out.damage=Math.round(base.damage*scale*coefficient);
 if(coefficient!==1)out.description+='；基础伤害 ×'+coefficient;
 // Starsea's weapon output grows faster than HP. Bound protective shields by
 // the HP/TTD budget while retaining the original formula outside starsea.
 if(starsea&&['ward','barrier'].includes(base.id)){out.damage=Math.min(out.damage,Math.round(stats.hp*starseaBalance.supportShieldHpRatio*growth));out.duration=Math.max(out.duration,starseaBalance.supportShieldDuration);}
 const m=out.mechanics;
 if(m){
  for(const effect of m.statuses){
   if(effect.total!==undefined)effect.total=Math.round(effect.total*(effect.kind==='regen'?(1+stats.attack/45)*growth:scale));
   if(['attack_up','speed_up'].includes(effect.kind))effect.strength+=.04*(rank-1);
   if(['slow','blind','armor_down'].includes(effect.kind))effect.strength=Math.min(.65,effect.strength+.02*(rank-1));
   if(['stun','silence','petrify','fear','time_stop','immunity'].includes(effect.kind))effect.duration=Math.round(effect.duration*(1+(rank-1)*.08));
   if(effect.kind==='guardian')effect.reviveRatio=Math.min(.5,(effect.reviveRatio??.3)+.05*(rank-1));
  }
  if(m.cleanse)m.cleanse.count=2+(rank-1);
  if(m.restoreMana)m.restoreMana=Math.round(m.restoreMana*growth);
  if(m.targeting==='direction'&&out.damage===0)out.range=Math.min(12,out.range+.5*(rank-1));
  if(out.damage===0&&m.cleanse)out.cooldown=Math.max(1,out.cooldown-6*(rank-1));
  // Poison's published damage remains the total direct + periodic budget.
  for(const dot of m.statuses.filter(e=>e.kind==='poison'&&e.scope==='hit'))dot.total=Math.floor(out.damage/2);
  if(m.statuses.some(e=>e.scope==='self'&&['immunity','guardian'].includes(e.kind)))out.duration=Math.max(...m.statuses.map(e=>e.duration));
 }
 out.resolution={attackShare:['heal','shield'].includes(base.kind)?0:1,baseCooldown:out.cooldown,skillCooldownReduction:0,statsCooldownReduction:Math.max(0,Math.min(.75,stats.cdr??0)),effectiveCooldownReduction:0,cooldownCap:.75,finalCooldown:out.cooldown};
 return out;
}
// Give legacy equipped/trained skills explicit activation without losing investment.
export function migrateSkillActivation(s:CharacterState){
 s.skillBooks??={};
 for(const id of [...['cut','bolt','ward'],...s.skills])if(skillCatalog.some(sk=>sk.id===id))s.skillRanks[id]??=1;
 for(const reward of skillBookRewards)if(s.progress.bosses.includes(reward.boss)&&!skillUnlocked(s,reward.skill)&&!(s.skillBooks[reward.skill]>0))s.skillBooks[reward.skill]=reward.quantity;
 const valid=[...new Set(s.skills)].filter(id=>skillUnlocked(s,id)).slice(0,skillSlotCount(s));s.skills=valid.length?valid:fallbackSkills(s);
 s.revision++;s.build++;
}
// Repair legacy loadouts without discarding progression or paid skill ranks.
export function normalizeSkillLoadout(s:CharacterState){
 const valid=[...new Set(s.skills)].filter(id=>skillCatalog.some(sk=>sk.id===id&&s.level>=sk.unlockLevel)).slice(0,skillSlotCount(s));
 const skills=valid.length?valid:fallbackSkills(s);
 if(JSON.stringify(skills)===JSON.stringify(s.skills))return false;
 s.skills=skills;s.revision++;s.build++;return true;
}
// Single server-owned implementation for deriving persistent build parameters.
export function gearContribution(g:Gear):{base:{attack:number;armor:number;[stat:string]:number};enhancement:{attack:number;armor:number;[stat:string]:number};effective:{attack:number;armor:number;[stat:string]:number}}{
 if(isHexSlot(g.slot)){hexDefinition(g);return {base:{attack:0,armor:0},enhancement:{attack:0,armor:0},effective:{attack:0,armor:0}};}
 const main=mainStatContribution(g);if(main)return {base:{attack:0,armor:0,[main.stat]:main.base},enhancement:{attack:0,armor:0,[main.stat]:main.enhancement},effective:{attack:0,armor:0,[main.stat]:main.effective}};
 const definition=gearDefinitionByBase.get(g.base);if(!definition)throw Error('Unknown equipment definition: '+g.base);
 const base={attack:definition.primary_attribute==='attack'?g.attack:0,armor:definition.primary_attribute==='armor'?g.armor:0};
 const reinforcement=primaryReinforcement(definition.primary_attribute==='attack'?g.attack:g.armor,definition.reinforcement_per_rank,g.rank,gearMaxRank(g,5));
 const enhancement={attack:definition.primary_attribute==='attack'?reinforcement:0,armor:definition.primary_attribute==='armor'?reinforcement:0};
 // Affixes are applied once by resolveBuild, separately from the primary attribute.
 return {base,enhancement,effective:{attack:base.attack+enhancement.attack,armor:base.armor+enhancement.armor}};
}
function resolveStats(s:CharacterState,parts=collectBuildParts(s)):Stats{
 const worn=parts.worn;
 // 基础属性：等级属性表（packages/content/level-stats.json）+ 装备主属性
 const base=levelStats(s.level);
 const attack=base.attack+worn.reduce((v,g)=>v+gearContribution(g).effective.attack,0);
 let stats:Stats={weapon:mainHandWeapon(s),hp:base.hp,attack,armor:base.armor+worn.reduce((v,g)=>v+gearContribution(g).effective.armor,0),speed:base.speed,mana:base.mana,regen:base.regen,effects:worn.map(g=>g.effect).filter(e=>e!=='none')};
 
 const out=applyBuildParts(s,stats,parts),zones=characterDamageZones(s,out);
 // 生命星晶：每处 +5% 最大生命（星潮海探索奖励）。
 const lives=ownedCrystalSources(s,'life').length;if(lives)out.hp=Math.round(out.hp*(1+lifeCrystalHp*lives));
 out.hp=Math.round(out.hp*resolvedHardmodeGrowth(s).axisMultiplier);
 const weapon=mainHandWeapon(s),combos=parts.combos;
 const pickup=craftBuffValue(s,'pickup'),gold=craftBuffValue(s,'gold'),material=craftBuffValue(s,'material');
 const food=pickup||gold||material?{pickupRadius:settings.pickupRadius*(1+pickup),goldBonus:gold,materialDropBonus:material}:{};
 return {...out,...food,weapon,zones,...foldZones(zones),...(combos.length?{combos}:{})};
}
export function resolveBuild(s:CharacterState,selection:import('../contracts/build-projection.ts').BuildEffectSelection={}):{stats:Stats;resolvedSkills:Skill[];skillAccess:SkillAccess[]}{
 ensureProgression(s);const parts=collectBuildParts(s,selection),stats=resolveStats(s,parts);
 return {stats,skillAccess:resolveSkillAccess(s,stats,parts),resolvedSkills:s.skills.filter(id=>skillUnlocked(s,id)&&skillWeaponAllowed(s,id)).map(id=>applyAttributeSkill(patchBuildSkill(resolveProgressionSkill(s,resolveSkill(id,s.skillRanks[id],stats,!!s.starsea),parts.progression),parts,stats),stats))};
}
// 1–50 comes from docs/balance-30h-design.md §2.1; uncapped levels keep growing 14% per level.
export function xpThreshold(level:number){const table=progressionCurve.thresholds;return level<=table.length?table[Math.max(1,level)-1]:Math.round(table.at(-1)!*1.14**(level-table.length));}
export function equipNewLevelSkills(s:CharacterState,previousLevel:number){
 const added:string[]=[];if(!s.starsea||s.starsea.prologue?.done===false||s.level<=previousLevel)return added;
 for(const q of resolveSkillAccess(s).filter(q=>!q.activated&&q.eligible&&q.weaponCompatible&&['level','island'].includes(q.activation.type)&&q.unlockLevel>previousLevel).sort((a,b)=>a.unlockLevel-b.unlockLevel)){
  if(s.skills.length>=skillSlotCount(s))break;s.skillRanks[q.id]=1;s.skills.push(q.id);added.push(q.id);
 }
 if(added.length){rememberWeaponSkills(s);s.build++;}return added;
}
export function applyXp(s:CharacterState,amount:number){const before=s.level;applyParagonXp(s,amount);s.xp+=amount;while(s.level<progressionLevelCap(s)&&s.xp>=xpThreshold(s.level)){s.xp-=xpThreshold(s.level);s.level++;s.build++;}equipNewLevelSkills(s,before);}
// Equipment uses gold and enhancement stones; skills use gold only.
export function upgradeCost(rank:number){return {gold:35+rank*25,material:2+rank};}
export function skillUpgradeCost(rank:number){return {gold:35+rank*25,material:0};}
export function makeGear(base:number,id:string):Gear{
  if(!Number.isInteger(base)||base<0)throw Error('Invalid runtime equipment index');
  const template=gearBases[base%gearBases.length];
  return instantiateGearTemplate(template,id);
}
export function makeGearByBase(base:string,id:string):Gear{
 const template=gearDefinitionByBase.get(base);if(!template)throw Error('Unknown runtime equipment base '+base);
 return instantiateGearTemplate(template,id);
}
export function instantiateGearTemplate(template:typeof gearBases[number],id:string,quality:GearQuality='common',affixes:GearAffix[]=[]):Gear{
 const {regional_primary_base,...instance}=template;
 const set=template.setId?gearSets.find(set=>set.id===template.setId):undefined;
 return withCurrentEquipmentNames({...instance,id,rank:0,locked:false,quality,affixes,setName:set?.name});
}



function patchBuildSkill(skill:Skill,parts:ReturnType<typeof collectBuildParts>,stats:Stats){const out=parts.patches.length?applySkillPatches(skill,parts.patches,skill.damage/Math.max(1,skillCatalog.find(s=>s.id===skill.id)!.damage)):skill;if(stats.dynamicConversions?.length&&out.resolution)out.resolution={...out.resolution,typeAdd:foldZones(stats.zones??[],skillTags({...out,category:skillCatalog.find(s=>s.id===out.id)?.category})).damageAdd};return out;}
