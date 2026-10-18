import {z} from 'zod';

// Every damage path declares both its trigger category and damage type.
export const damageTypeSchema=z.enum(['physical','fire','cold','lightning','arcane','shadow','poison','pure']);
export type DamageType=z.infer<typeof damageTypeSchema>;
export type DamageCategory='direct'|'periodic'|'derived';
export const damagePermissions={
 direct:{crit:true,lifesteal:true,chain:true,burn:true,ward:true,execute:true,interrupt:true,counter:true},
 periodic:{crit:false,lifesteal:false,chain:false,burn:false,ward:false,execute:false,interrupt:false,counter:false},
 derived:{crit:false,lifesteal:false,chain:false,burn:false,ward:false,execute:false,interrupt:false,counter:false},
} as const;
// bleed: physical DOT; shock: target takes (1+strength) damage from player sources.
export const statusKindSchema=z.enum(['burn','poison','slow','stun','silence','petrify','fear','root','blind','time_stop','attack_up','speed_up','armor_down','counter','immunity','guardian','regen','bleed','shock','freeze','vulnerable']);
export const periodicDamageKinds=['burn','poison','bleed'] as const;
export type StatusKind=z.infer<typeof statusKindSchema>;
const ticks=z.number().int().positive(),ratio=z.number().min(0).max(1);
export const statusEffectSchema=z.object({
 maxStacks:z.number().int().min(1).max(20).optional(),stackMode:z.enum(['refresh','independent']).optional(),onStacks:z.object({at:ticks,convert:statusKindSchema,duration:ticks,consume:ticks}).strict().optional(),
 kind:statusKindSchema,duration:ticks,strength:z.number().nonnegative(),scope:z.enum(['hit','self','zone','ally']),
 interval:ticks.optional(),damageType:damageTypeSchema.optional(),cleanse:z.boolean(),breakOnDamage:z.boolean().default(false),
 removeWithSource:z.boolean().default(false),immunityTypes:z.array(damageTypeSchema).optional(),
 // Total periodic budget is split exactly, including integer remainder at the last tick.
 total:z.number().int().nonnegative().optional(),hpDrainRatio:ratio.optional(),reviveRatio:ratio.optional(),
 radius:z.number().nonnegative().optional(),
}).strict().superRefine((s,c)=>{
 if(['burn','poison','bleed','regen'].includes(s.kind)&&(!s.interval||s.total===undefined))c.addIssue({code:'custom',message:'Periodic status requires interval and total budget'});
 if(['burn','poison','bleed'].includes(s.kind)&&!s.damageType)c.addIssue({code:'custom',message:'DOT requires damage type'});
 if(s.kind==='immunity'&&!s.immunityTypes?.length)c.addIssue({code:'custom',message:'Immunity requires explicit damage types'});
 if(s.kind==='guardian'&&!s.reviveRatio)c.addIssue({code:'custom',message:'Guardian requires revive ratio'});
 if(['slow','blind','armor_down','shock','vulnerable'].includes(s.kind)&&s.strength>1)c.addIssue({code:'custom',message:'Status ratio exceeds one'});
 if(s.interval&&s.interval>s.duration)c.addIssue({code:'custom',message:'Status interval exceeds duration'});
 if(s.interval&&!['burn','poison','bleed','regen'].includes(s.kind)&&!s.hpDrainRatio)c.addIssue({code:'custom',message:'Status interval has no periodic operation'});
});
export type StatusEffect=z.infer<typeof statusEffectSchema>;
export type StatusEffectInput=z.input<typeof statusEffectSchema>;
export const skillMechanicsSchema=z.object({
 damageType:damageTypeSchema,targeting:z.enum(['enemy','self','ground','direction']),
 schedule:z.object({hits:z.number().int().min(2).max(10),interval:ticks,followCaster:z.boolean(),interruptOnMove:z.boolean(),advance:z.number().nonnegative().optional()}).strict().optional(),
 projectile:z.object({returns:z.boolean().optional(),orbit:z.object({duration:ticks,radius:z.number().positive(),interval:ticks,speed:z.number().positive()}).strict().optional(),collisionRadius:z.number().positive().max(1),penetrations:z.number().int().min(0).max(20),turnRate:z.number().nonnegative().max(Math.PI),explosionRadius:z.number().nonnegative()}).strict().optional(),
 zone:z.object({mode:z.enum(['burst','periodic']),hits:ticks,interval:ticks,firstDelay:z.number().int().nonnegative().default(0),pullSpeed:z.number().nonnegative(),budget:z.enum(['total','per_tick']),followCaster:z.boolean().optional()}).strict().optional(),
 dash:z.object({pathHit:z.number().nonnegative()}).strict().optional(),chain:z.object({count:ticks.max(20)}).strict().optional(),statuses:z.array(statusEffectSchema).default([]),execute:z.object({threshold:ratio,bonus:z.number().nonnegative()}).strict().optional(),
 penetration:ratio.optional(),restoreMana:z.number().int().nonnegative().optional(),
 cleanse:z.object({kinds:z.array(statusKindSchema).min(1),count:ticks}).strict().optional(),
}).strict().superRefine((m,c)=>{const ids=m.statuses.map(s=>s.kind+':'+s.scope);if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Conflicting duplicate status effects'});});
export type SkillMechanics=z.infer<typeof skillMechanicsSchema>;
export const skillResolutionSchema=z.object({
 typeAdd:z.number().nonnegative().optional(),attackShare:ratio,baseCooldown:ticks,skillCooldownReduction:ratio,statsCooldownReduction:ratio,
 effectiveCooldownReduction:ratio,cooldownCap:ratio,finalCooldown:ticks,
 encounterCooldownMultiplier:z.number().positive().optional(),
}).strict();
export type SkillResolution=z.infer<typeof skillResolutionSchema>;
export type CastFailure='unknown'|'paused'|'dead'|'busy'|'controlled'|'cooldown'|'resource'|'target'|'range'|'blocked'|'unneeded'|'weapon';
export const statusPolicy={boss:{durationScale:.35,pullScale:0,immune:['fear','time_stop'] as StatusKind[],uninterruptibleCastImmune:['stun','petrify'] as StatusKind[]},maxStacks:1,zoneExitTicks:1};
