import {questParameters} from './task-tables.ts';
import {dungeonContent} from './dungeons.ts';
import {z} from 'zod';
import raw from './replay-pilots.json';
import {worldTables} from './world-tables.ts';
import {regionById,bodyCollision,type Region} from './index.ts';
import {walkable} from '../simulation/navigation.ts';
const id=z.string().min(1),variant=z.object({id,name:id,formation:z.enum(['elite-front','elite-rear'])}).strict();
export const replayPilotSchema=z.object({version:z.literal(1),dungeons:z.array(z.object({dungeon:id,stages:z.array(z.number().int().nonnegative()),variants:z.array(variant).min(2).max(3)}).strict())}).strict();
const fieldRoutesSchema=z.array(z.object({region:id,goals:z.array(z.object({waypoint:id,label:id}).strict()).min(2)}).strict());
export const replayPilots={...replayPilotSchema.parse(raw),fields:fieldRoutesSchema.parse(questParameters.replay_optional_routes)};
for(const pilot of replayPilots.dungeons){const d=dungeonContent.definitions.find(d=>d.id===pilot.dungeon);if(!d||pilot.stages.some(stage=>!d.stages[stage]||regionById(d.stages[stage]).boss)||new Set(pilot.variants.map(v=>v.formation)).size!==pilot.variants.length)throw Error('Invalid replay pilot content '+pilot.dungeon);}
for(const field of replayPilots.fields)if(new Set(field.goals.map(g=>g.waypoint)).size!==field.goals.length)throw Error('Replay goals must alternate distinct registered points');
for(const field of replayPilots.fields){regionById(field.region);for(const goal of field.goals){const point=worldTables.waypoints.find(w=>w.id===goal.waypoint&&w.region===field.region&&!w.when&&!w.until);if(!point)throw Error('Replay goal must use an always-present registered waypoint '+goal.waypoint);}}
/** Permute existing legal positions only. Every actor, stage scale, source and reward stays identical. */
export function applyReplayFormation(regions:readonly Region[],stages:readonly number[],formation:z.infer<typeof variant>['formation'],body=bodyCollision){
 const result=structuredClone(regions) as Region[];
 for(const stage of stages){const region=result[stage];if(!region||region.boss)throw Error('Replay formation requires a declared front room');
  const points=region.spawns.map(s=>({x:s.x,y:s.y})).sort((a,b)=>Math.hypot(a.x-region.safe.x,a.y-region.safe.y)-Math.hypot(b.x-region.safe.x,b.y-region.safe.y)||a.x-b.x||a.y-b.y),actors=[...region.spawns].sort((a,b)=>Number(b.elite)-Number(a.elite)||a.id.localeCompare(b.id));
  for(const actor of actors){const order=actor.elite&&formation==='elite-rear'?[...points].reverse():points,index=order.findIndex(p=>walkable(region,p,actor.elite?body.eliteRadius:body.enemyRadius));if(index<0)throw Error('No legal registered formation position');const point=order[index],at=points.indexOf(point);points.splice(at,1);actor.x=point.x;actor.y=point.y;}
 }
 return result;
}
