import type {SkillVfxProfile,VfxElement,VfxFamily} from './vfx-profiles.ts';

const impacts:Record<VfxElement,string>={steel:'library-warm-burst',earth:'library-warm-burst',fire:'library-flame-burst',ice:'library-ice-burst',storm:'lightning-arrow-hit',nature:'nature-aura-05',holy:'library-warm-burst',blood:'library-warm-burst',poison:'library-warm-burst',arcane:'library-void-burst',shadow:'library-void-impact'};
const minimum:Record<VfxFamily,number[]>={slash:[144,184,224],spin:[176,216,256],dash:[128,164,200],projectile:[88,120,156],chain:[96,128,164],zone:[160,200,256],burst:[160,216,280],shield:[136,168,208],heal:[136,168,208],mark:[136,176,216],summon:[184,232,280],beam:[160,216,280]};
export type VfxPresence={size:number;impactSize:number;chargeSize:number;impact:string;release:string;surface?:string;flight?:string};
const cache=new WeakMap<SkillVfxProfile,VfxPresence>();
/** Presentation hierarchy only. Areas still come from the resolved combat radius. */
export function vfxPresence(p:SkillVfxProfile):VfxPresence{
 const found=cache.get(p);if(found)return found;const tier=p.power-1,strength=p.key.startsWith('boss/')?1.12:p.key.startsWith('monster/')?.86:1;
 const release=p.family==='slash'||p.family==='spin'?'library-slash':p.family==='shield'?'shield':p.family==='heal'?(p.element==='holy'?'library-warm-burst':'nature-aura-05'):p.element==='ice'?'library-ice-wave':p.element==='fire'?'library-flame-burst':p.element==='arcane'||p.element==='shadow'?'library-void-burst':'library-warm-burst';
 const surface=p.motif==='meteor'?'library-fire-rain':p.element==='ice'?'library-ice-wave':p.element==='fire'?'ground-flame':p.element==='nature'?'nature-aura-05':['arcane','shadow','poison'].includes(p.element)?'library-void-cloud':undefined;
 // dark_arrow leaves a bow: an arrow with the shadow trail, not the void orb (2026-10-16).
 const id=p.key.split('/')[1],flight=['bolt','multi_shot','pierce_arrow','poison_arrow','volley','dark_arrow'].includes(id)?'arrow':['lance'].includes(id)?'library-blade-flight':['arcane_missile','void_bolt'].includes(id)?'library-void-flight':p.key==='boss/ice_lance'?'ice-bolt-flight':undefined;
 const value={size:Math.max(p.size,minimum[p.family][tier]*strength),impactSize:[92,132,180][tier]*strength,chargeSize:[26,38,50][tier]*strength,impact:impacts[p.element],release,surface,flight};cache.set(p,value);return value;
}

export function visibleFxScale(size:number,visible:number[]|undefined,canvas:number[]){const dimensions=visible?.every(n=>Number.isFinite(n)&&n>0)?visible:canvas;return size/Math.max(1,...dimensions);}
export function stageOpacity(progress:number){const t=Math.max(0,Math.min(1,progress));return 1-t*t;}
