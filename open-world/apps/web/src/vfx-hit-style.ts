import type {SkillVfxProfile,VfxElement} from './vfx-profiles.ts';
/**
 * Hit style approved 2026-10-11: hand-drawn layers from the Spine library (combat-hit-fx.json) replace the line-geometry motifs.
 * One layer per element; family and power only change the size.
 */
const elementHits:Record<VfxElement,string>={steel:'hit-slash',fire:'hit-fire',ice:'hit-ice-shard',storm:'hit-storm',nature:'hit-nature',arcane:'hit-arcane',shadow:'hit-shadow',earth:'hit-earth',holy:'hit-holy',blood:'hit-blood',poison:'hit-poison'};
/** Monster hits read smaller than player hits so the hero's own impacts stay on top. */
const strength=(p:SkillVfxProfile)=>p.key.startsWith('monster/')?.8:1;
/** Applying an ice status (slow/chill) shows one small shard at the feet instead of a crystal field per target. */
export const iceStatusLayer={clip:'hit-ice-shard',size:56};
/** Frozen targets show the library ice layer held at its formed frame. */
export const freezeLayer={clip:'hit-ice',size:104,hold:.32};
/** Per-target impact layer (clip id from combat-hit-fx.json) and its on-screen size in px. */
export function hitLayer(p:SkillVfxProfile):{clip:string;size:number}{
 const big=p.power===3,s=strength(p);
 if(p.element==='earth'&&p.key.startsWith('player/'))return {clip:'hit-slash',size:big?120:104};
 if(p.element==='fire')return big?{clip:'hit-fire-big',size:170*s}:{clip:'hit-fire',size:120*s};
 if(p.element==='ice')return p.family==='burst'||big?{clip:'hit-ice',size:118*s}:{clip:'hit-ice-shard',size:96*s};
 if(p.element==='steel')return {clip:p.family==='projectile'||p.family==='chain'?'hit-blast':'hit-slash',size:(big?124:104)*s};
 return {clip:elementHits[p.element],size:(p.element==='earth'?110:big?124:104)*(p.element==='poison'?1.25:1)*s};
}
/** Self-buff release flash at the chest (2026-10-16): the vivid element layer, gold for elements without a readable own layer
 * (earth stays reserved for monsters). Replaces the solid-filled guard flare that read as a box. */
export function buffLayer(p:SkillVfxProfile):{clip:string;size:number}{
 return {clip:['steel','earth','blood'].includes(p.element)?'hit-holy':elementHits[p.element],size:(p.power===3?124:104)*strength(p)};
}
/** Overlay on critical hits. */
export const critLayer={clip:'hit-crit',size:96};
/** Ground body for area releases (slam / nova / explosion) and its size relative to the resolved area width. Undefined keeps the presence release layer. */
export function areaLayer(p:SkillVfxProfile):{clip:string;scale:number}|undefined{
 if(p.element==='earth'&&p.key.startsWith('player/'))return undefined; // GroundImpact owns player earth releases.
 if(p.element==='earth')return {clip:'hit-earth',scale:1};
 if(p.element==='fire')return {clip:'hit-fire-big',scale:1.15};
 if(['storm','holy','blood','nature','poison'].includes(p.element))return {clip:elementHits[p.element],scale:.8};
 return undefined;
}
