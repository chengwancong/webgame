import {talentDefinitions} from '../content/deep-progression.ts';
import {applySourceStatMultipliers} from './source-stat-multipliers.ts';
import {resolveAttributeEffects} from './attribute-effects.ts';
import {conversionZones} from './stat-conversions.ts';
import {collectHexRules} from './hex-runes.ts';
import {collectAspectSources} from './aspect-sources.ts';
import {collectInscriptionAtoms} from './inscriptions.ts';
import {overrideEffectRules} from './atom-parts.ts';
import {effectRuleSchema as sourceRuleSchema} from '../contracts/effects.ts';
import {unifiedSetParts} from './unified-sets.ts';
import {resolveAtomParts} from './atom-parts.ts';
import type {CharacterState,Stats,SetBonus} from '../contracts/index.ts';
import type {EffectRule} from '../contracts/effects.ts';
import {comboToEffect,effectRuleSchema} from '../contracts/effects.ts';
import {statRegistry,numericStat} from '../contracts/stats.ts';
import {gearSets} from '../content/gear-sets.ts';
import {getEquippedSets,applyStatBonuses} from '../simulation/set-calculator.ts';
import {addZone,type DamageZone} from './damage-zones.ts';
import {collectProgressionParts,resolveProgressionStats} from './deep-progression.ts';
import {mainStatContribution} from './main-stats.ts';
import {resolveWeaponCombos} from './weapon-combos.ts';
import {mainHandWeapon} from './weapon-skills.ts';
import type {BuildEffectSelection} from '../contracts/build-projection.ts';
import {buildSourcePartsSchema} from '../contracts/build-sources.ts';
import {withSlotRank,resonanceTier,resonanceStats,petBuildParts} from './zhangjian-build.ts';
export type BuildStatPart={source:string;phase:'affix'|'main'|'set'|'progression';stat:string;value:number};
export function collectBuildParts(s:CharacterState,selection:BuildEffectSelection={}){
 // M17 Z2：主属性强化按部位等级（withSlotRank）；共鸣与宠物被动走 main 阶段。
 const worn=s.gear.filter(g=>Object.values(s.equipment).includes(g.id)).map(g=>withSlotRank(s,g)),stats:BuildStatPart[]=[],zones:{source:string;zone:DamageZone}[]=[],sets:SetBonus[]=[];
 for(const g of worn){for(const a of g.affixes)stats.push({source:g.id,phase:'affix',stat:a.stat,value:a.value});const main=mainStatContribution(g);if(main)stats.push({source:g.id,phase:'main',stat:main.stat,value:main.effective});}
 for(const set of getEquippedSets(worn)){const definition=gearSets.find(d=>d.id===set.setId)!;for(const n of set.activeBonuses){const bonus=definition.bonuses.find(b=>b.pieces===n)!;sets.push(bonus);for(const [stat,value]of Object.entries(bonus.stats??{}))if(typeof value==='number')stats.push({source:set.setId+':'+n,phase:'set',stat,value});for(const zone of bonus.zones??[])zones.push({source:set.setId+':'+n,zone});}}
 const unified=unifiedSetParts(worn,selection.withoutFourSets);stats.push(...unified.stats);zones.push(...unified.zones);
 const sources=collectAspectSources(s).map(source=>selection.withoutAspects?.includes(source.source)?{...source,parts:buildSourcePartsSchema.parse({patches:source.parts.patches.flatMap(p=>{const ops=p.ops.filter(o=>o.path==='weapons');return ops.length?[{...p,ops,scalePeriodicBudget:undefined}]:[];})})}:source),inscriptionAtoms=collectInscriptionAtoms(worn),patches=sources.flatMap(s=>s.parts.patches),overrides=sources.flatMap(s=>s.parts.overrides);
 const talentRules=talentDefinitions.filter(t=>t.parts&&(s.progression?.talents[t.id]??0)>0).flatMap(t=>t.parts!.rules.map(r=>({...r,source:t.id})));
 const sourceRules=sources.flatMap(s=>{const list=s.parts.rules.map(r=>({...r,source:s.source}));if(s.parts.flags||s.parts.statusOverrides)list.push(sourceRuleSchema.parse({id:s.source+'-state',name:s.name,description:s.name,source:s.source,tier:1,trigger:'passive',chance:1,icd:0,filter:s.parts.flagFilter??{},when:[],action:{type:'buff',duration:1,maxStacks:1,mods:{},...(s.parts.flags?{flags:Object.fromEntries(Object.entries(s.parts.flags).filter(([k])=>k!=='unsharedProjectiles'))}:{}),...(s.parts.statusOverrides?{statusOverrides:s.parts.statusOverrides}:{})},scale:[],vfxKey:'player/ward'}));return list;});
 const progression=collectProgressionParts(s);for(const m of progression.mods)stats.push({source:m.skill??m.zone??'progression',phase:'progression',stat:m.stat,value:m.value});
 stats.push(...resonanceStats(resonanceTier(s).tier));const pets=petBuildParts(s);stats.push(...pets.stats);
 const combos=resolveWeaponCombos(s,mainHandWeapon(s)),hex=collectHexRules(s);
 return {worn,stats,sets,zones,progression,combos,hex,unified,sources,sourceRules,talentRules,inscriptionAtoms,rules:overrideEffectRules([...pets.rules,...combos.map(comboToEffect),...resolveAtomParts([...unified.atoms,...inscriptionAtoms,...sources.flatMap(s=>s.parts.atoms.map(a=>({...a,source:s.source})))]),...unified.rules,...sourceRules,...talentRules,...hex],overrides),conditional:stats.flatMap((p,i)=>{const def=statRegistry.find(d=>d.id===p.stat);return def?.cond?[{id:p.source+':'+p.stat+':'+i,pool:'cond' as const,value:p.value,when:def.cond}]:[]}),patches,overrides};
}
export type BuildParts=ReturnType<typeof collectBuildParts>;
/** Preserve legacy arithmetic order; new main percentages form one sum per stat. */
export function applyBuildParts(s:CharacterState,base:Stats,parts:BuildParts):Stats{
 let out=applyStatBonuses(base,parts.stats.filter(p=>p.phase==='affix'));
 for(const bonus of parts.sets){for(const zone of bonus.zones??[])out.zones=addZone([...(out.zones??[]).map(z=>({...z}))],zone);if(!bonus.stats)continue;const {hp,...flat}=bonus.stats;out=applyStatBonuses(out,Object.entries(flat).flatMap(([stat,value])=>typeof value==='number'?[{stat,value}]:[]));if(hp)out.hp=hp<1?Math.round(out.hp*(1+hp)):out.hp+hp;}
 out=resolveProgressionStats(s,out,parts.progression);
 for(const source of parts.sources){for(const z of source.parts.zones)out.zones=addZone([...(out.zones??[]).map(z=>({...z}))],z);}
 for(const p of parts.unified.stats.filter(p=>!p.stat.endsWith('Percent')))out=applyStatBonuses(out,[p]);
 for(const {zone}of parts.unified.zones)out.zones=addZone([...(out.zones??[]).map(z=>({...z}))],zone);
 if(parts.unified.dotCrit)out.dotCrit=1;
 const percent:Record<string,number>={};for(const p of parts.stats.filter(p=>p.phase==='main'||p.phase==='set'&&p.source.startsWith('set-')&&p.stat.endsWith('Percent'))){if(p.stat.endsWith('Percent'))percent[p.stat]=(percent[p.stat]??0)+p.value;else out=applyStatBonuses(out,[p]);}
 for(const [id,value]of Object.entries(percent)){const stat=id.slice(0,-7);(out as unknown as Record<string,unknown>)[id]=value;(out as unknown as Record<string,unknown>)[stat]=['attack','armor','hp'].includes(stat)?Math.round(numericStat(out,stat)*(1+value)):numericStat(out,stat)*(1+value);}
 out=applySourceStatMultipliers(out,parts.sources.map(s=>s.parts));
 const conversions=parts.sources.flatMap(source=>source.parts.conversions.map((c,i)=>({...c,source:source.source+':'+i,name:source.name})));if(conversions.length){for(const zone of conversionZones(out,{speed:base.speed},conversions))out.zones=addZone([...(out.zones??[]).map(z=>({...z}))],zone);const speed=conversions.filter(c=>c.fromStat==='speedBonus');if(speed.length)out.dynamicConversions=speed.map(c=>({source:c.source,ratio:c.ratio,baselineSpeed:base.speed,permanentBonus:Math.max(0,out.speed/base.speed-1)}));}
 for(const def of statRegistry){const value=numericStat(out,def.id);if(value&&def.cap!==null)(out as unknown as Record<string,unknown>)[def.id]=Math.min(def.cap,value);}
 const {rules,conditional:dynamic}=resolveAttributeEffects(out);
 dynamic.push(...parts.unified.conditional,...parts.sources.flatMap(s=>s.parts.conditional));
 if(dynamic.length)out.conditional=[...(out.conditional??[]),...dynamic];if(parts.unified.atoms.length||parts.unified.rules.length||parts.sourceRules.length||parts.talentRules.length||parts.inscriptionAtoms.length||parts.hex.length||parts.rules.some(r=>r.id.startsWith('pet-'))||rules.length)out.rules=[...parts.rules,...overrideEffectRules(rules,parts.overrides,{'atom-thorns':['stat-thorns']})];return out;
}

export function applyAttributeSkill(skill:import('../contracts/index.ts').Skill,stats:Stats){
 const speed=Math.min(.5,numericStat(stats,'castSpeed')),area=Math.min(1,numericStat(stats,'areaSize'));if(!speed&&!area)return skill;
 const out=structuredClone(skill);if(speed)out.windup=Math.max(0,Math.round(out.windup/(1+speed)));
 if(area&&(out.kind!=='projectile'||(out.mechanics?.projectile?.explosionRadius??0)>0)){out.radius*=1+area;if(out.mechanics?.projectile?.explosionRadius)out.mechanics.projectile.explosionRadius=out.radius;}
 return out;
}
