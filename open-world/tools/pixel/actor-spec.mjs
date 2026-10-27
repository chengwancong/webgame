export const legacyBosses=new Set(['meadow-boss','forest-boss','rift-boss','frost_queen','abyss_lord','dragon_king','shadow_lord']);
export function actorRole(id,group){return group==='bosses'||legacyBosses.has(id)?'boss':/(?:^|-)elite(?:-|$)|(?:^|-)rare(?:-|$)/.test(id)?'elite':'ordinary';}
