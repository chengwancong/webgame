import type {Stats,Skill,Spawn} from '../contracts/index.ts';
import type {DungeonPolicy} from '../contracts/dungeons.ts';
import {monsterContent,type MonsterContent} from '../content/monsters.ts';
import {resolveMonsterSpawn,monsterLevelValues} from './monster-stats.ts';
export type EncounterAffix={hp:number;attack:number;cooldown:number;healing?:number};
export function dungeonBuild(stats:Stats,skills:Skill[],affixes:EncounterAffix[]){
 const healing=affixes.reduce((n,a)=>n*(a.healing??1),1),cooldown=affixes.reduce((n,a)=>n*a.cooldown,1);
 return {stats:{...structuredClone(stats),lifesteal:(stats.lifesteal??0)*healing},skills:skills.map(sk=>{const out=structuredClone(sk);out.cooldown=Math.max(1,Math.round(sk.cooldown*cooldown));if(out.resolution)out.resolution={...out.resolution,finalCooldown:out.cooldown,encounterCooldownMultiplier:cooldown};if(sk.kind==='heal')out.damage=Math.round(sk.damage*healing);for(const status of out.mechanics?.statuses??[])if(status.kind==='regen'&&status.total!==undefined)status.total=Math.round(status.total*healing);return out;})};
}
/** 星潮海角色进入旧副本：旧区 1–9 级映射到星潮海首领等级段（9–37），怪物数值改按星潮海曲线（大数字），
 * 仍是“模板＋等级＋档位＋难度”，只取决于副本与世界线，不随玩家等级变化。 */
export function starseaDungeonLevel(level:number){return level<=9?Math.round(9+(level-1)*3.5):level;}
function curveScale(template:string,level:number,monsters:MonsterContent){const t=monsters.templates.find(x=>x.id===template);if(!t||t.curve!=='campaign'||!monsters.curves.starsea)return {hp:1,attack:1};const a=monsterLevelValues('campaign',level,monsters),b=monsterLevelValues('starsea',level,monsters);return {hp:b.hp/a.hp,attack:b.attack/a.attack};}
export function dungeonSpawns(spawns:Spawn[],policy:DungeonPolicy,tier:number,stage:number,affixes:EncounterAffix[],monsters:MonsterContent=monsterContent,world:'campaign'|'starsea'='campaign',worldDifficulty={hp:1,attack:1}){
 const scale=policy.enemyScale,growth=tier-policy.minTier,n=policy.tierRules,hp=scale.hp*(1+growth*n.hpPerTier)*affixes.reduce((v,a)=>v*a.hp,1),attack=scale.attack*(1+growth*n.attackPerTier)*affixes.reduce((v,a)=>v*a.attack,1);
 const room=policy.stageEnemyScale?.[stage]??{hp:1,attack:1};
 const difficulty={hp:worldDifficulty.hp*hp*(1+stage*scale.hpPerStage)*room.hp,attack:worldDifficulty.attack*attack*(1+stage*scale.attackPerStage)*room.attack,armor:1};
 return spawns.map(m=>m.monster
  ?(()=>{const base=policy.monsterLevel??m.monster!.level,legacy=world==='starsea'&&monsters.templates.find(t=>t.id===m.monster!.template)?.curve==='campaign',level=legacy?starseaDungeonLevel(base):base,k=legacy?curveScale(m.monster!.template,level,monsters):{hp:1,attack:1};
    return resolveMonsterSpawn({id:m.id,x:m.x,y:m.y,template:m.monster!.template,level,rank:m.monster!.rank},monsters,{...difficulty,hp:difficulty.hp*k.hp,attack:difficulty.attack*k.attack});})()
  :{...m,hp:Math.max(1,Math.round(m.hp*difficulty.hp)),attack:Math.max(1,Math.round(m.attack*difficulty.attack))});
}
