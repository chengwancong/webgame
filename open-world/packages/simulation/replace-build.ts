import {statsSchema,skillSchema,type Stats,type Skill} from '../contracts/index.ts';
import type {World} from './index.ts';
/** Replace resolved parameters at a dungeon sync boundary without restarting
 * an actor or discarding any in-flight combat work. Existing HP is capped only
 * when the new maximum falls; increased maximum HP never grants free healing. */
export function replaceCombatBuild(world:World,build:{stats:Stats;skills:Skill[]},playerId=world.playerId){
 const stats=statsSchema.parse(structuredClone(build.stats)),skills=build.skills.map(s=>skillSchema.parse(structuredClone(s)));
 if(new Set(skills.map(s=>s.id)).size!==skills.length)throw Error('Duplicate resolved skill');
 if(world.players.size?!world.players.has(playerId):playerId!==world.playerId)throw Error('Combat player not found');
 world.forPlayer(playerId,()=>{world.stats=stats;world.skills=skills;world.hero.hp=Math.min(world.hero.hp,stats.hp);world.hero.mana=Math.min(world.hero.mana,stats.mana);});
}
