import {monsterLevelValues} from './monster-stats.ts';
/** Objective progression uses authored encounter levels, never player gear or
 * player level. The server freezes this value when creating the encounter. */
export function worldObjectiveHp(baseHp:number,normalLevel:number,encounterLevel:number){
 if(![baseHp,normalLevel,encounterLevel].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid objective progression basis');
 return Math.max(1,Math.round(baseHp*monsterLevelValues('starsea',encounterLevel).hp/monsterLevelValues('starsea',normalLevel).hp));
}
