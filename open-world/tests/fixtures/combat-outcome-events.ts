/** Legacy gameplay traces compare outcomes. New presentation keys are covered
 * independently by skill-audio-events and skill-audio-vfx-structure. */
export function combatOutcomeEvents(events:readonly any[]){return events.map(({vfxKey,...event})=>{if(event.type==='hit_resolved')delete event.status;return event;});}
