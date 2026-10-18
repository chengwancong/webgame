import {worldTables} from '../content/world-tables.ts';
import {islandBand,starseaIslands} from '../content/starsea/index.ts';
import type {CharacterState} from '../contracts/index.ts';
import type {WorldTables} from '../contracts/open-world.ts';
/** Island endpoints remain authored; each zone keeps its relative position in
 * that island's normal band. Only newly created encounters consume this view. */
export function characterWorldTables(s:Pick<CharacterState,'starsea'>,tables:WorldTables=worldTables){
 if(!s.starsea?.hardmode)return tables;
 return {...tables,zones:tables.zones.map(zone=>{const chapter=starseaIslands.indexOf(zone.region)+1;if(!chapter)return zone;const peers=tables.zones.filter(z=>z.region===zone.region),low=Math.min(...peers.map(z=>z.levelBand[0])),high=Math.max(...peers.map(z=>z.levelBand[1])),band=islandBand(chapter,true),level=(value:number)=>Math.round(band[0]+(value-low)/Math.max(1,high-low)*(band[1]-band[0]));return {...zone,levelBand:zone.levelBand.map(level) as [number,number]};})};
}
