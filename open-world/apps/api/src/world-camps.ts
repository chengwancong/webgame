import type {PoolClient} from 'pg';
import type {Spawn,Vec} from '../../../packages/contracts/index.ts';
import type {WorldCamp} from '../../../packages/contracts/open-world.ts';
import {World,type WorldCheckpoint} from '../../../packages/simulation/index.ts';
import balance from '../../../packages/content/encounter-balance.json';
import {campSource} from '../../../packages/rules/world-camps.ts';
export type CampCycle={camp:string;cycle:number;rules:string;tier:number;seed:number;spawns:Spawn[]};
/** Call inside the character-locked settlement transaction. RNG/rules/tier and
 * spawns are frozen only for a NEW cycle. No client-controlled spawn payload. */
export async function currentCampCycle(c:PoolClient,character:string,camp:WorldCamp,position:Vec,create:(cycle:number)=>CampCycle):Promise<CampCycle>{
 if(!Number.isFinite(position.x)||!Number.isFinite(position.y))throw Error('Invalid camp observer position');
 const owner=await c.query('SELECT id FROM ow_characters WHERE id=$1 FOR UPDATE',[character]);if(!owner.rowCount)throw Error('Unknown camp owner');
 const old=(await c.query('SELECT * FROM ow_camp_cycles WHERE character=$1 AND region=$2 AND camp=$3 ORDER BY cycle DESC LIMIT 1 FOR UPDATE',[character,camp.region,camp.id])).rows[0];
 if(old){const ids=(old.data as CampCycle).spawns.map(m=>m.id);
  if(!old.cleared_at){const kills=(await c.query('SELECT count(*)::integer count,max(killed_at) at FROM ow_kills WHERE character=$1 AND source=ANY($2::text[])',[character,ids])).rows[0];
   // Old untimed kill receipts do not fabricate a clear time or reset instances.
   if(kills.count===ids.length&&kills.at){const untimed=(await c.query('SELECT 1 FROM ow_kills WHERE character=$1 AND source=ANY($2::text[]) AND killed_at IS NULL LIMIT 1',[character,ids])).rowCount;if(!untimed){old.cleared_at=kills.at;await c.query('UPDATE ow_camp_cycles SET cleared_at=$1 WHERE character=$2 AND region=$3 AND camp=$4 AND cycle=$5',[kills.at,character,camp.region,camp.id,old.cycle]);}}
  }
  const elapsed=old.cleared_at?(await c.query('SELECT extract(epoch FROM now()-$1::timestamptz)::float8 seconds',[old.cleared_at])).rows[0].seconds:0;
  if(!old.cleared_at||elapsed<Math.max(camp.respawnSeconds,balance.openWorldCamps.respawnSeconds)||Math.hypot(position.x-camp.x,position.y-camp.y)<=balance.openWorldCamps.minPlayerDistance)return old.data;
 }
 const cycle=(old?.cycle??0)+1,data=create(cycle);
 if(data.camp!==camp.id||data.cycle!==cycle||!Number.isInteger(data.seed)||!Number.isInteger(data.tier)||data.tier<1||!data.rules||!data.spawns.length||data.spawns.some((m,i)=>m.id!==`${camp.id}:${cycle}:${i}`))throw Error('Invalid frozen camp cycle');
 await c.query('INSERT INTO ow_camp_cycles(character,region,camp,cycle,data) VALUES($1,$2,$3,$4,$5)',[character,camp.region,camp.id,cycle,data]);return data;
}
/** A region-wide server checkpoint preserves cross-camp projectiles, effects,
 * cooldowns, HP, positions and RNG. It is never accepted from an HTTP body. */
export async function saveFieldCheckpoint(c:PoolClient,character:string,world:World,expectedTick:number|null){
 if(!(await c.query('SELECT id FROM ow_characters WHERE id=$1 FOR UPDATE',[character])).rowCount)throw Error('Unknown field owner');
 const current=(await c.query('SELECT tick FROM ow_field_sessions WHERE character=$1 AND region=$2 FOR UPDATE',[character,world.region.id])).rows[0];
 if((current?.tick??null)!==expectedTick||current&&world.tick<current.tick)throw Error('Stale field checkpoint');
 const checkpoint=world.exportCheckpoint();World.restore(checkpoint);
 await c.query('INSERT INTO ow_field_sessions(character,region,tick,checkpoint) VALUES($1,$2,$3,$4) ON CONFLICT(character,region) DO UPDATE SET tick=excluded.tick,checkpoint=excluded.checkpoint,updated=now()',[character,world.region.id,world.tick,checkpoint]);
}
export async function loadFieldCheckpoint(c:PoolClient,character:string,region:string):Promise<World|null>{const row=(await c.query('SELECT checkpoint FROM ow_field_sessions WHERE character=$1 AND region=$2',[character,region])).rows[0];if(!row)return null;const world=World.restore(row.checkpoint as WorldCheckpoint);if(world.region.id!==region)throw Error('Mismatched field checkpoint region');return world;}

/** World tier frozen into the camp cycle a kill source belongs to; 1 for non-camp sources.
 * Rewards follow the tier the enemies were created with, not the currently selected one. */
export async function campTier(c:PoolClient,character:string,source:string){
 const at=campSource(source);if(!at)return 1;
 const row=(await c.query("SELECT (data->>'tier')::int tier FROM ow_camp_cycles WHERE character=$1 AND camp=$2 AND cycle=$3",[character,at.camp,at.cycle])).rows[0];
 return row?.tier??1;
}
