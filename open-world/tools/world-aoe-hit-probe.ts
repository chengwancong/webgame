import type {CharacterState,Spawn} from '../packages/contracts/index.ts';
import type {Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../packages/rules/monster-stats.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {World} from '../packages/simulation/index.ts';
/** Controlled single-primary-hit probe for numeric-flow §6.1. The runtime owns
 * all damage math. Only direct critical permission is disabled in this private
 * World, so forced crit patches do not replace the requested noncritical hit. */
export function measureAoeHit(character:CharacterState,skillId:string,seed=41){
 const resolved=resolveBuild(character),skill=resolved.resolvedSkills.find(s=>s.id===skillId);
 if(!character.skills.includes(skillId)||!skill||!['area','zone'].includes(skill.kind))throw Error('Requested primary AOE must be active in the actual resolved build');
 const template=monsterContent.templates.find(t=>t.kind==='melee');if(!template)throw Error('Probe has no registered target template');
 const region:Region={id:'controlled-hit-probe',name:'单次非暴击命中探针',subtitle:'受控实测',theme:'meadow',width:30,height:30,safe:{x:10,y:10},portal:{x:2,y:2},landmarks:[],obstacles:[],spawns:[],boss:false,auto:false};
 const base=resolveMonsterSpawn({id:'hit-target',template:template.id,level:character.level,rank:'normal',x:11,y:10}),target:Spawn={...base,hp:1e14,attack:0,monster:{...base.monster!,armor:0,baseStats:{...base.monster!.baseStats,hp:1e14,attack:0,armor:0}}};
 const world=new World(region,resolved.stats,resolved.resolvedSkills,[target],[],seed);world.setMode('manual');
 const direct=world.rules.damagePermissions.direct as {crit:boolean};direct.crit=false;
 const cast=world.cast(skill.id,world.enemies[0],{...world.enemies[0].position});if(!cast)throw Error('Actual AOE cast was refused');
 const failures:string[]=[];for(let i=0;i<Math.max(300,skill.windup+skill.duration+90);i++){world.step();for(const event of world.events){if(event.type==='cast_failed')failures.push(event.reason??'unknown');if(event.type==='hit_resolved'&&event.id===target.id&&event.skill===skill.id&&event.category==='direct'){if(event.crit)throw Error('Noncritical probe produced a critical hit');if(!(event.amount!>0))throw Error('Primary hit has no positive damage');return {seed,level:character.level,requestedSkill:skillId,executedSkill:skill.id,skillRank:character.skillRanks[skill.id],hitAoe:event.amount!,tick:event.tick,failures,resolvedBuild:{stats:resolved.stats,skills:resolved.resolvedSkills},target:{hp:target.hp,armor:0,attack:0},controls:{directCrit:false},limits:['Controlled first direct hit, zero-armour nonattacking target.','This is not DPS, TTK, boss success rate or natural acquisition evidence.']};}}}
 throw Error('No primary noncritical AOE hit before the declared probe budget');
}
