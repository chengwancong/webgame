import plan from './island-enemy-skill-plan.json';
import derived from './island-enemy-skill-damage.json';
import frequency from './island-enemy-frequency.json';
import {statusEffectSchema,type DamageType} from '../contracts/skill-mechanics.ts';
import type {MonsterSkillDef,BossSkillDef} from './chapter-combat.ts';
import {defaultSkillHint} from './combat-hints.ts';
export const islandSkillPlan=plan;
/** 岛屿技能是生成的，按类型/伤害类型/效果合成一句，不按技能 ID 硬编码。 */
export function islandSkillHint(skill:{kind:string;damageType?:string;effect?:string}){
 if(skill.effect==='dash')return '它会冲过来贴身出手';
 if(skill.effect==='root')return '打中会把你定在原地';
 if(skill.effect==='blind')return '打中会让你看不清';
 if(skill.effect==='armor_down')return '打中会削掉你的护甲';
 return defaultSkillHint(skill.kind as Parameters<typeof defaultSkillHint>[0],(skill.damageType??null) as DamageType|null);
}
const status=(effect:string,id:string)=>['slow','root','blind','armor_down','burn'].includes(effect)?[statusEffectSchema.parse({kind:effect,duration:effect==='burn'?90:60,strength:effect==='root'?1:.25,scope:'hit',cleanse:true,...(effect==='burn'?{interval:30,total:Math.max(1,Math.round((derived.rows.find(r=>r.skill===id)?.rawHit??1)*.2)),damageType:'fire'}:{})})]:[];
export const islandMonsterSkills:Record<string,MonsterSkillDef>={},islandBossProfiles:Record<string,{id:string;maxHp:number;phases:{hp:number;phase:number}[];skills:BossSkillDef[]}>={};
export const islandVfxDefinitions:{key:string;family:string;element:string;motif:string;power:1|2|3}[]=[];
for(const island of plan.islands){
 for(const s of island.monsters){islandMonsterSkills[s.id]={id:s.id,name:s.name,kind:s.kind as MonsterSkillDef['kind'],windup:s.windup,cooldown:s.cooldown,damage:(derived.multipliers as Record<string,number>)[s.id]*(s.effect==='burn'?.8:1),radius:s.radius,duration:s.duration,delay:s.delay,damageType:s.damageType as DamageType,statuses:status(s.effect,s.id),hint:islandSkillHint(s),...(s.effect==='dash'?{effect:'dash'}:{}),...(s.kind==='buff'?{effect:'buff_nearby',buff:{range:5,duration:90,strength:.15,removeWithSource:true}}:{})};islandVfxDefinitions.push({key:'monster/'+s.id,family:s.kind==='melee'?(s.effect==='dash'?'dash':'slash'):s.kind==='buff'?'shield':s.kind,element:s.color,motif:s.motif,power:1});}
 const pool=new Map(island.bosses.map(s=>[s.id,s]));
 for(const [template,binding]of Object.entries(island.bindings))if('profile'in binding){
  const selected=binding.skillIds.map((id:string,index:number)=>{const s=pool.get(id)!;return {id:s.id,name:s.name,kind:s.kind as BossSkillDef['kind'],phase:index===0?1:2,windup:s.windup,cooldown:s.cooldown*(frequency.factors as Record<string,number>)[island.key],damage:(derived.multipliers as Record<string,number>)[s.id]*(s.effect==='burn'?.8:1),radius:s.radius,duration:s.duration,delay:s.delay,warning:'ground' as const,interruptible:true,hint:islandSkillHint(s)};});
  islandBossProfiles[template]={id:template,maxHp:1000,phases:binding.phases!,skills:selected};
 }
 for(const s of island.bosses){
  // Existing status executor reads this metadata for hostile zones/projectiles.
  islandMonsterSkills[s.id]={id:s.id,name:s.name,kind:s.kind==='projectile'?'projectile':'zone',windup:s.windup,cooldown:s.cooldown,damage:(derived.multipliers as Record<string,number>)[s.id]*(s.effect==='burn'?.8:1),radius:s.radius,duration:s.duration,delay:s.delay,damageType:s.damageType as DamageType,statuses:status(s.effect,s.id),hint:islandSkillHint(s)};
  islandVfxDefinitions.push({key:'boss/'+s.id,family:s.kind==='projectile'?'projectile':s.kind==='trap'?'mark':'zone',element:s.color,motif:s.motif,power:3});
  islandVfxDefinitions.push({key:'monster/'+s.id,family:s.kind==='projectile'?'projectile':'zone',element:s.color,motif:s.motif,power:2});
 }
}
