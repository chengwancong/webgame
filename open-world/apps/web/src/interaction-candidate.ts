/** available:false（已采完、已开启、冷却中）的候选不参与选择，提示与 E 一起消失。 */
export type InteractionCandidate={id:string;kind:'starsea'|'portal'|'boss'|'forge'|'waypoint'|'board'|'loot'|'activity'|'gather';position:{x:number;y:number};text:string;reach:number;priority:number;value?:string;available?:boolean};

/** The displayed prompt and the E handler both consume this exact selection. */
export function selectInteraction(hero:{x:number;y:number},candidates:InteractionCandidate[]){
 return candidates.filter(c=>c.available!==false&&Math.hypot(c.position.x-hero.x,c.position.y-hero.y)<=c.reach)
  .sort((a,b)=>a.priority-b.priority||Math.hypot(a.position.x-hero.x,a.position.y-hero.y)-Math.hypot(b.position.x-hero.x,b.position.y-hero.y)||a.id.localeCompare(b.id))[0];
}
