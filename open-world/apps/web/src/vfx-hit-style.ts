import type {SkillVfxProfile,VfxElement} from './vfx-profiles.ts';
/**
 * Hit style approved 2026-10-11: hand-drawn layers from the Spine library (combat-hit-fx.json) replace the line-geometry motifs.
 * One layer per element; family and power only change the size.
 * 2026-10-20: slash / spark / explosion / ice hit switch to the Cozy Chunky theme of the Cooked FX pack (combat-cooked-fx.json);
 * the Spine library layers stay registered for the physical-skill spec, the buff flash and the other elements.
 */
const elementHits:Record<VfxElement,string>={steel:'cooked-slash-x',fire:'hit-fire',ice:'hit-ice-shard',storm:'hit-storm',nature:'hit-nature',arcane:'hit-arcane',shadow:'hit-shadow',earth:'hit-earth',holy:'hit-holy',blood:'hit-blood',poison:'hit-poison'};
/** Monster hits read smaller than player hits so the hero's own impacts stay on top. */
const strength=(p:SkillVfxProfile)=>p.key.startsWith('monster/')?.8:1;
/** Applying an ice status (slow/chill) shows one small shard at the feet instead of a crystal field per target. */
export const iceStatusLayer={clip:'hit-ice-shard',size:56};
/** Frozen targets show the library ice layer held at its formed frame. */
export const freezeLayer={clip:'hit-ice',size:104,hold:.32};
/** Library layers that the physical-skill spec names directly, mapped to the Cooked FX layer that now draws them. */
const cookedHits:Record<string,string>={'hit-slash':'cooked-slash-x','hit-blast':'cooked-hit','hit-fire-big':'cooked-explosion','hit-ice':'cooked-ice-hit'};
export const cookedHitClip=(id:string)=>cookedHits[id]??id;
/** Persistent status markers (Cooked FX status theme): one looping layer per category, shown at the chest, the head for control. */
export type StatusMarkerKind='control'|'burn'|'poison'|'debuff'|'buff';
const markerKinds:Record<string,StatusMarkerKind>={stun:'control',petrify:'control',time_stop:'control',burn:'burn',poison:'poison',vulnerable:'debuff',armor_down:'debuff',blind:'debuff',silence:'debuff',fear:'debuff',shock:'debuff',root:'debuff',attack_up:'buff',speed_up:'buff',regen:'buff',guardian:'buff',immunity:'buff',counter:'buff'};
export const statusMarkerKind=(effect:string)=>markerKinds[effect];
/** Drawing order is also priority: an actor shows at most two of its categories. */
export const statusMarkerLayers:Record<StatusMarkerKind,{clip:string;size:number;lift:number}>={control:{clip:'cooked-stun',size:50,lift:52},burn:{clip:'cooked-burn',size:44,lift:22},poison:{clip:'cooked-poison',size:46,lift:24},debuff:{clip:'cooked-debuff',size:44,lift:26},buff:{clip:'cooked-buff',size:44,lift:26}};
/** Per-target impact layer (clip id from combat-hit-fx.json) and its on-screen size in px. */
export function hitLayer(p:SkillVfxProfile):{clip:string;size:number}{
 const big=p.power===3,s=strength(p);
 if(p.element==='earth'&&p.key.startsWith('player/'))return {clip:'cooked-slash-x',size:big?120:104};
 if(p.element==='fire')return big?{clip:'cooked-explosion',size:150*s}:{clip:'hit-fire',size:120*s};
 if(p.element==='ice')return {clip:'cooked-ice-hit',size:(p.family==='burst'||big?130:100)*s};
 if(p.element==='steel')return {clip:p.family==='projectile'||p.family==='chain'?'cooked-hit':'cooked-slash-x',size:(big?118:96)*s};
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
 if(p.element==='fire')return {clip:'cooked-explosion',scale:1.05};
 if(['storm','holy','blood','nature','poison'].includes(p.element))return {clip:elementHits[p.element],scale:.8};
 return undefined;
}
