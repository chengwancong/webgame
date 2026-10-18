import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import raw from './build-variety-builds.json';
import {weaponTypeSchema} from '../packages/contracts/weapons.ts';
import {statIdSchema} from '../packages/contracts/stats.ts';
import {gearSchema,type CharacterState,type Slot} from '../packages/contracts/index.ts';
import {equipmentItems} from '../packages/content/equipment-catalog.ts';
import {setEffect,gearSetIdentity} from '../packages/content/set-effects.ts';
import {aspectDefinitions} from '../packages/content/deep-progression.ts';
import {skillCatalog} from '../packages/content/index.ts';
import {makeGearByBase,resolveBuild} from '../packages/rules/index.ts';
import {freezeItemRules,issueCombatGear} from '../packages/rules/item-issuance.ts';
import {applyItemPower} from '../packages/rules/item-power.ts';
import {assignMainStat} from '../packages/rules/main-stats.ts';
import {mainHandWeapon,skillWeaponAllowed} from '../packages/rules/skill-weapon-access.ts';
import {getEquippedSets} from '../packages/simulation/set-calculator.ts';

const profileSchema=z.object({id:z.string().min(1),name:z.string().min(1),weapon:weaponTypeSchema,four:z.string(),two:z.string(),skills:z.array(z.string()).min(1).max(4),aspect:z.string(),keyStats:z.array(statIdSchema).min(2).max(3),preferredAugment:z.string(),focus:z.enum(['clear','single','survival'])}).strict();
export const buildVarietyProfiles=z.array(profileSchema).length(17).parse(raw);
assert.equal(new Set(buildVarietyProfiles.map(p=>p.id)).size,17,'Duplicate build profile');
export type BuildVarietyProfile=z.infer<typeof profileSchema>;
const slots:Slot[]=['weapon','armor','helmet','boots','accessory','ring'];
const commonAffixes=['attack','hp','mana','regen'];
const stableId=(label:string)=>{const h=createHash('sha256').update(label).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};

/** Controlled equipment grants for paired combat measurements. Every item uses
 * the real template, issuance, affix, main-stat and build resolvers. Candidate
 * restrictions deliberately select attainable mid-tier rolls; they do not
 * estimate natural drop probability or alter the public content sources. */
export function assembleBuildVariety(profile:BuildVarietyProfile,options:{level?:number;itemLevel?:number;skillRank?:number;artStage?:1|2|3}={}){
 const level=options.level??50,itemLevel=options.itemLevel??level,skillRank=options.skillRank??5,artStage=options.artStage??1;
 assert(Number.isInteger(level)&&level>0&&Number.isInteger(itemLevel)&&itemLevel>0,'Invalid build level');
 assert(Number.isInteger(skillRank)&&skillRank>=1&&skillRank<=5,'Unactivated skill rank');
 const four=setEffect(profile.four),two=setEffect(profile.two),aspect=aspectDefinitions.find(a=>a.id===profile.aspect);
 assert(four&&two&&four.id!==two.id,'Two distinct real set identities required');
 assert(aspect?.dropEnabled&&aspect.requiredLevel<=level,'Core aspect is not obtainable at this level');
 assert(!aspect.weapons.length||aspect.weapons.includes(profile.weapon),'Core aspect has incompatible main hand');
 const mainSet=profile.weapon==='bow'?([four,two].find(s=>['set-hidden-omega','set-sword-omega','set-sword-primal'].includes(s.id))):[four,two].find(s=>s.family===profile.weapon);
 assert(mainSet,'Main-hand template cannot complete the declared four-plus-two sets');
 const assigned=new Map<Slot,string>([['weapon',mainSet.id]]),remaining=new Map([[four.id,4-(mainSet.id===four.id?1:0)],[two.id,2-(mainSet.id===two.id?1:0)]]);
 for(const slot of slots.slice(1)){const set=[four,two].find(s=>remaining.get(s.id)!>0)!;assigned.set(slot,set.id);remaining.set(set.id,remaining.get(set.id)!-1);}
 assert([...remaining.values()].every(n=>n===0),'Set allocation did not fill six slots');
 const coreSlot=slots.find(s=>aspect.slots.includes(s));assert(coreSlot,'Core has no equipment slot');
 const snapshot=freezeItemRules(),publicSnapshot=structuredClone(snapshot);
 snapshot.aspects=snapshot.aspects.filter(a=>a.id===profile.aspect);
 // All selected values and counts are members of the official quality pools.
 snapshot.affixes.quality.rare.count=[3,3];snapshot.affixes.quality.legendary.count=[5,5];
 const priorities=[...profile.keyStats,...commonAffixes];
 snapshot.affixes.pool=snapshot.affixes.pool.filter(a=>a.tier===3).sort((a,b)=>{const ai=priorities.indexOf(a.stat),bi=priorities.indexOf(b.stat);return (ai<0?999:ai)-(bi<0?999:bi);});
 const fixed={int:(min:number)=>min,float:()=>.5};
 const state:CharacterState={id:stableId('benchmark-'+profile.id),name:profile.name,revision:1,build:1,level,xp:0,gold:0,material:0,gear:[],equipment:{},skills:[...profile.skills],skillRanks:Object.fromEntries(profile.skills.map(id=>[id,skillRank])),progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};
 for(const slot of slots){const set=setEffect(assigned.get(slot)!)!,part=slot==='accessory'?'necklace':slot,template=equipmentItems.find(i=>i.family===set.family&&i.series===set.series&&i.tier===artStage&&i.part===part);
  assert(template?.obtainable&&template.runtimeBase,'Missing obtainable catalogue template');
  const g=makeGearByBase(slot==='weapon'&&profile.weapon==='bow'?'bow':template.runtimeBase,stableId(`benchmark-${profile.id}-${slot}`));g.quality=slot===coreSlot?'legendary':'rare';applyItemPower(g,itemLevel);
  const itemRules=structuredClone(snapshot);
  // Pick one official main-stat outcome, without replacing its numeric value.
  const choices=itemRules.affixes.mainStats.filter(m=>m.slot===slot),main=choices.find(m=>slot==='weapon'?m.stat==='attackPercent':slot==='accessory'?profile.keyStats.includes(m.stat):slot==='ring'?m.stat==='critChance':m.stat==='hpPercent')??choices[0];
  assert(main||slot==='weapon'||slot==='armor','Missing main-stat pool');itemRules.affixes.mainStats=main?[main]:[];
  if(slot==='weapon'&&profile.weapon==='bow'){const index=['set-hidden-omega','set-sword-omega','set-sword-primal'].indexOf(set.id);assignMainStat(g,itemLevel,{int:(min,max)=>min===0&&max===3?index:min,float:()=>.5},itemRules.affixes);}
  issueCombatGear(g,itemLevel,3,level,false,itemRules,fixed);gearSchema.parse(g);
  assert.equal(gearSetIdentity(g),set.id,'Issuance changed the requested set identity');
  if(slot===coreSlot)assert.equal(g.aspectId,profile.aspect,'Issuance did not grant the declared core');
  state.gear.push(g);state.equipment[slot]=g.id;
 }
 assert.equal(mainHandWeapon(state),profile.weapon,'Actual main-hand weapon differs');
 const sets=getEquippedSets(state.gear);assert.equal(sets.find(s=>s.setId===four.id)?.count,4);assert.equal(sets.find(s=>s.setId===two.id)?.count,2);
 for(const id of profile.skills){assert(skillCatalog.some(s=>s.id===id),'Unknown requested skill '+id);assert(skillWeaponAllowed(state,id),'Incompatible requested skill '+id+' '+JSON.stringify(state.gear.filter(g=>g.aspectId).map(g=>({base:g.base,slot:g.slot,quality:g.quality,aspect:g.aspectId}))));}
 for(const stat of profile.keyStats)assert(state.gear.some(g=>g.mainStat?.stat===stat||g.affixes.some(a=>a.stat===stat)),'Missing attainable key stat '+stat);
 const resolved=resolveBuild(state);assert.deepEqual(resolved.resolvedSkills.map(s=>s.id),profile.skills,'Requested and resolved skills differ');
 return {profile:structuredClone(profile),state,build:{stats:resolved.stats,skills:resolved.resolvedSkills},sets,acquisition:{scope:'controlled attainable grants; not a natural-drop estimate',level,itemLevel,skillRank,artStage,rareAffixes:3,legendaryAffixes:5,affixTier:3,rollFraction:.5,coreRank:1,publicRulesUnmodified:JSON.stringify(freezeItemRules())===JSON.stringify(publicSnapshot)}};
}
