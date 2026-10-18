import {stageKeyRandomIds} from './stage-key-recipe-random.ts';
import {gearWeaponAffinity} from '../../../packages/rules/weapon-skills.ts';
import type {AffixRandom} from '../../../packages/rules/affix-generator.ts';
import {skillTags} from '../../../packages/content/skill-tags.ts';
import {crystalSources,grantCoreSources} from '../../../packages/rules/crystal-progress.ts';
import selectionSource from './stage-key-selection.json';
import {weaponTypeSchema} from '../../../packages/contracts/weapons.ts';
import {equipmentFamilies} from '../../../packages/contracts/equipment-catalog.ts';
import {gearSlotSchema} from '../../../packages/contracts/gear-slots.ts';
import {randomInt,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {CharacterState,Gear,Slot} from '../../../packages/contracts/index.ts';
import {gearBases,instantiateGearTemplate} from '../../../packages/rules/index.ts';
import {applyItemPower,gearMaxRank} from '../../../packages/rules/item-power.ts';
import {freezeItemRules,issueCombatGear} from '../../../packages/rules/item-issuance.ts';
import {ensureProgression} from '../../../packages/rules/deep-progression.ts';
import {collectionEquipment} from '../../../packages/content/equipment-runtime.ts';
import {mainHandWeapon,gearWeaponType,skillWeaponAllowed,rememberWeaponSkills} from '../../../packages/rules/weapon-skills.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {progressionConfig,aspectDefinitions,progressionGearTemplates,glyphDefinitions} from '../../../packages/content/deep-progression.ts';
const selection=z.object({bodyFamily:z.record(weaponTypeSchema,z.enum(equipmentFamilies)),setSlots:z.array(gearSlotSchema).length(4)}).strict().refine(v=>new Set(v.setSlots).size===4,'套装输出部位不能重复').parse(selectionSource);
const rank=z.number().int().positive();
export const stageKeyOutputSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('gear'),slot:z.enum(['weapon','armor','helmet','boots','accessory','ring']),quality:z.enum(['magic','rare','legendary']),count:rank.max(4).default(1),series:z.enum(['standard','omega','primal']).default('standard')}).strict(),
 z.object({kind:z.literal('skill'),rank:rank.max(5),scope:z.enum(['aoe','single'])}).strict(),
 z.object({kind:z.literal('enhance'),rank:rank.max(12)}).strict(),
 z.object({kind:z.literal('codex'),rank:rank.max(5)}).strict(),
 z.object({kind:z.literal('weapon_uncap'),rank:rank.max(5)}).strict(),
 z.object({kind:z.literal('summon'),stat:z.enum(['attack','hp']),level:rank.max(200),uncap:z.number().int().min(0).max(5).default(0)}).strict(),
 z.object({kind:z.literal('cores'),total:rank.max(12)}).strict(),
 z.object({kind:z.literal('paragon'),points:rank.max(20)}).strict(),
 z.object({kind:z.literal('glyph'),levels:rank.max(5)}).strict(),
]);
export type StageKeyOutput=z.infer<typeof stageKeyOutputSchema>;
export function freezeStageKeyRewardRules(){return structuredClone({gearArtPolicy:'highest-admitted' as const,gearMetadata:Object.fromEntries(gearBases.flatMap(g=>{const item=collectionEquipment(g.base);return item?[[g.base,{family:item.family,tier:item.tier,series:item.series}]]:[]})),coreSourceIds:crystalSources('core').map(row=>row.id),selection,templates:gearBases,gearSeries:Object.fromEntries(progressionGearTemplates.map(t=>[t.base,t.series])),items:freezeItemRules(),skills:skillCatalog,glyphs:glyphDefinitions,summons:progressionConfig.summons,aspects:aspectDefinitions.filter(a=>a.dropEnabled).map(a=>({id:a.id,weapons:a.weapons,slots:a.slots,requiredLevel:a.requiredLevel}))});}
export type FrozenStageKeyRewards=ReturnType<typeof freezeStageKeyRewardRules>;
/** Applies only declared acquisition actions. Effective attributes and skills
 * continue to be resolved by the existing rule owners. Current combat stays frozen. */
export function grantStageKeyOutputs(s:CharacterState,outputs:readonly StageKeyOutput[],level:number,frozen:FrozenStageKeyRewards,rng?:AffixRandom,createId:(base:string,slot:Slot)=>string=stageKeyRandomIds(gearWeaponAffinity(s.gear.find(g=>g.id===s.equipment.weapon)))){
 const p=ensureProgression(s),gear:Gear[]=[],before=JSON.stringify({gear:s.gear,skillRanks:s.skillRanks,progression:s.progression,crystals:s.starsea?.crystals}),family=mainHandWeapon(s),bodyFamily=family?frozen.selection.bodyFamily[family]:null;
 for(const raw of outputs){const o=stageKeyOutputSchema.parse(raw);
  if(o.kind==='gear')for(let i=0;i<o.count;i++){
   const slot:Slot=o.count>1?(frozen.selection.setSlots as Slot[])[i]:o.slot;
   const meta=(base:string)=>frozen.gearMetadata?.[base]??collectionEquipment(base),candidates=frozen.templates.filter(t=>t.slot===slot&&((slot==='weapon'?gearWeaponType(t)===family:meta(t.base)?.family===bodyFamily)||family===null&&slot!=='weapon')&&(meta(t.base)?.series??frozen.gearSeries[t.base]??'standard')===o.series&&(frozen.gearArtPolicy||(meta(t.base)?.tier??1)===1));
   const admitted=candidates.filter(t=>(t.requiredLevel??1)<=Math.min(s.level,level)).sort((a,b)=>(meta(b.base)?.tier??1)-(meta(a.base)?.tier??1)),template=admitted[0]??candidates[0];if(!template)throw Error('阶段钥匙缺少兼容装备模板 '+slot+'/'+family+'/'+o.series);
   const item=instantiateGearTemplate(template,createId(template.base,template.slot),o.quality,[]);applyItemPower(item,level);issueCombatGear(item,level,Math.max(...frozen.items.affixes.pool.map(a=>a.tier)),s.level,false,frozen.items,rng);s.gear.push(item);gear.push(item);
  }
  else if(o.kind==='skill'){
   const available=frozen.skills.filter(sk=>skillWeaponAllowed(s,sk.id)&&!['shield','heal','support'].includes(sk.kind)).sort((a,b)=>a.unlockLevel-b.unlockLevel),matches=(sk:typeof available[number])=>o.scope==='aoe'?skillTags(sk).includes('area'):skillTags(sk).includes('single'),preferred=available.find(sk=>s.skills.includes(sk.id)&&matches(sk)),sk=preferred??available.find(sk=>s.skills.includes(sk.id))??available.find(matches)??available[0];if(!sk)throw Error('阶段技能书没有兼容主技能');s.skillRanks[sk.id]=Math.max(s.skillRanks[sk.id]??0,o.rank);if(!s.skills.some(id=>available.some(a=>a.id===id))&&s.skills.length<4)s.skills.push(sk.id);rememberWeaponSkills(s);
  }
  else if(o.kind==='enhance'){for(const item of s.gear.filter(g=>Object.values(s.equipment).includes(g.id)))item.rank=Math.max(item.rank,Math.min(o.rank,gearMaxRank(item,5)));}
  else if(o.kind==='codex'){const eligible=frozen.aspects.filter(a=>a.requiredLevel<=s.level&&(!a.weapons.length||family!==null&&a.weapons.includes(family)));if(!eligible.length)throw Error('阶段法典没有兼容威能');const selected=eligible.slice(0,2),improves=selected.some(a=>(p.codex[a.id]??0)<o.rank);for(const a of selected)p.codex[a.id]=Math.max(p.codex[a.id]??1,o.rank);if(!improves&&s.level>=50)p.paragonLevel++;}
  else if(o.kind==='weapon_uncap'){const item=s.gear.find(g=>g.id===s.equipment.weapon);if(!item)throw Error('阶段突破需要已装备武器');const owned=p.weapons[item.id]??={level:1,uncap:0};owned.uncap=Math.max(owned.uncap,o.rank);}
  else if(o.kind==='summon'){const definition=frozen.summons.find(a=>a.stat===o.stat);if(!definition)throw Error('阶段召唤石没有定义');const owned=p.summons[definition.id]??={level:1,uncap:0};owned.level=Math.max(owned.level,Math.min(o.level,progressionConfig.summonCaps[o.uncap]));owned.uncap=Math.max(owned.uncap,o.uncap);}
  else if(o.kind==='paragon'){if(s.level<50)throw Error('巅峰钥匙需要50级');p.paragonLevel+=o.points;}
  else if(o.kind==='glyph'){if(s.level<50)throw Error('雕文钥匙需要50级');// 2026-10-07 不再按专精选盘：优先玩家已镶嵌的雕文，其次玩家培养等级最高的雕文，都没有时给第一块盘。
   const owned=frozen.glyphs.filter(g=>p.glyphs[g.id]).sort((x,y)=>(p.glyphs[y.id]??0)-(p.glyphs[x.id]??0)),definition=frozen.glyphs.find(g=>g.id===Object.values(p.glyphSlots)[0])??owned[0]??frozen.glyphs.find(g=>g.board===0);if(!definition)throw Error('雕文钥匙没有对应定义');const before=p.glyphs[definition.id]??0,next=Math.min(21,before+o.levels);p.glyphs[definition.id]=next;p.paragonLevel+=Math.max(0,o.levels-(next-before));}
  else if(o.kind==='cores'){if(frozen.coreSourceIds)grantCoreSources(s,o.total,frozen.coreSourceIds);else{if(!s.starsea)throw Error('星核需要星潮海角色');for(let n=1;n<=o.total;n++){const id='core-key-'+n;if(!s.starsea.crystals.includes(id))s.starsea.crystals.push(id);}}}
 }
 if(before!==JSON.stringify({gear:s.gear,skillRanks:s.skillRanks,progression:s.progression,crystals:s.starsea?.crystals}))s.build++;
 return {gear};
}
