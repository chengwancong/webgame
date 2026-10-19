import type {Snapshot} from '../contracts/index.ts';
import type {Region} from '../content/index.ts';
import {walkable,findPath,distance} from '../simulation/navigation.ts';
/** Existing authoritative limits, shared by prompts, clicks and server commands. */
export const interactionReach={gather:2,activity:4.5,forge:5,story:2.8} as const;
export function gatheredInRegion(s:Pick<Snapshot,'field'|'lastRegion'>,region:string){return new Set((s.field?.region??s.lastRegion)===region?s.field?.gathered??[]:[]);}
export function inInteractionReach(hero:{x:number;y:number},target:{x:number;y:number},reach:number){return distance(hero,target)<=reach;}
export function interactionApproaches(map:Region,target:{x:number;y:number},reach:number=interactionReach.gather){
 return [target,...Array.from({length:8},(_,i)=>({x:target.x+Math.cos(i*Math.PI/4)*(reach-.5),y:target.y+Math.sin(i*Math.PI/4)*(reach-.5)}))].filter(p=>walkable(map,p,.55));
}
export function reachableApproach(map:Region,start:{x:number;y:number},target:{x:number;y:number},reach:number){
 return interactionApproaches(map,target,reach).sort((a,b)=>distance(a,target)-distance(b,target)).find(p=>distance(start,p)<.1||findPath(map,start,p,.55).length);
}
