import type {CharacterState} from '../contracts/index.ts';
import {conditionMet} from './quest-conditions.ts';
import {worldTables} from '../content/world-tables.ts';
import {characterWorldTables} from './world-levels.ts';
import type {WorldPhaseView,WorldTables} from '../contracts/open-world.ts';
import {resolvePlaneGates} from './plane-gates.ts';
export type WorldPhase={when?:string;until?:string};
/** Phase conditions use the exact quest-condition owner. Only the server passes
 * its character snapshot; clients consume the already-filtered view. */
export function worldPhaseVisible(character:Pick<CharacterState,'level'|'starsea'>,row:WorldPhase){return (!row.when||conditionMet(character,row.when))&&(!row.until||!conditionMet(character,row.until));}
export function visibleWorldRows<T extends WorldPhase>(character:Pick<CharacterState,'level'|'starsea'>,rows:readonly T[]):T[]{return rows.filter(row=>worldPhaseVisible(character,row));}
export function resolveWorldPhase(character:Pick<CharacterState,'level'|'starsea'>&{world?:CharacterState['world']},tables:WorldTables=worldTables,now=Date.now()):WorldPhaseView{
 const ids=(key:'camps'|'waypoints'|'gates'|'landmarks'|'events'|'chests'|'rares'|'patrols'|'dungeonEntrances')=>tables[key].filter(row=>worldPhaseVisible(character,row)).map(row=>row.id);
 const publicRows=<T extends WorldPhase&{_row:number}>(rows:readonly T[])=>visibleWorldRows(character,rows).map(({when,until,_row,...row})=>row);
 return {zones:publicRows(characterWorldTables(character,tables).zones),camps:ids('camps'),waypoints:ids('waypoints'),gates:ids('gates'),landmarks:ids('landmarks'),events:ids('events'),chests:ids('chests'),rares:ids('rares'),patrols:ids('patrols'),dungeonEntrances:ids('dungeonEntrances'),planeGates:resolvePlaneGates(character,now,tables),outposts:publicRows(tables.outposts),objects:publicRows(tables.objects),merchants:publicRows(tables.merchants)};
}
export function resolveNpcPhase(character:Pick<CharacterState,'level'|'starsea'>,rows:readonly (WorldPhase&{npc:string;map:string;x:number;y:number})[]){
 const found=new Map<string,{npc:string;map:string;x:number;y:number}>();
 for(const row of visibleWorldRows(character,rows)){if(found.has(row.npc))throw Error('人物相位同时命中两个站位 '+row.npc);found.set(row.npc,{npc:row.npc,map:row.map,x:row.x,y:row.y});}
 return [...found.values()];
}
