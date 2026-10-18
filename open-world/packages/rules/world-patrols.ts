import type {WorldCamp,WorldTables} from '../contracts/open-world.ts';
import type {Region} from '../content/index.ts';
import type {MonsterDifficulty} from '../contracts/monsters.ts';
import {resolveMonsterSpawn} from './monster-stats.ts';
import {applyEliteAffixes,rollEliteAffixes} from './elite-affixes.ts';
export function patrolCamp(row:WorldTables['patrols'][number]):WorldCamp{return {_row:row._row,id:row.id,region:row.region,zone:row.zone,...row.path[0],radius:row.radius,respawnSeconds:row.respawnSeconds,pack:[{template:row.template,rank:row.rank,count:1}],when:row.when,until:row.until};}
export function patrolSpawns(region:Region,tables:WorldTables,row:WorldTables['patrols'][number],cycle:number,difficulty:MonsterDifficulty,range:readonly [number,number],seed:number){
 const zone=tables.zones.find(z=>z.id===row.zone);if(!zone)throw Error('巡逻分区不存在 '+row.id);if(!['elite','rare'].includes(row.rank))throw Error('巡逻须为精英或稀有档位 '+row.id);
 let spawn=resolveMonsterSpawn({id:`${row.id}:${cycle}:0`,template:row.template,level:zone.levelBand[1]+1,rank:row.rank,...row.path[0]},undefined,difficulty);spawn=applyEliteAffixes(spawn,rollEliteAffixes(range,seed,spawn.id));spawn.monster!.patrol={path:structuredClone(row.path),speed:row.speed};return [spawn];
}
