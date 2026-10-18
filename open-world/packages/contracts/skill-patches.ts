import {z} from 'zod';
export const skillPatchPaths=[
 'damage','radius','range','pull','projectiles','projectileSpread','cooldown','cost','windup','duration','charges','weapons',
 'mechanics.targeting','mechanics.schedule','mechanics.schedule.advance','mechanics.projectile.penetrations','mechanics.projectile.returns','mechanics.projectile.orbit',
 'mechanics.projectile.collisionRadius','mechanics.statuses','mechanics.damageType','mechanics.zone.mode','mechanics.zone.hits','mechanics.zone.interval','mechanics.zone.firstDelay','mechanics.zone.pullSpeed','mechanics.zone.budget','mechanics.zone.followCaster',
 'mechanics.execute','mechanics.dash.pathHit','mechanics.chain.count',
] as const;
export const skillPatchSchema=z.object({scalePeriodicBudget:z.boolean().optional(),skills:z.array(z.string()).min(1).optional(),tags:z.array(z.string()).min(1).optional(),ops:z.array(z.object({path:z.enum(skillPatchPaths),op:z.enum(['set','add','mul','append']),value:z.unknown()}).strict()).min(1)}).strict().superRefine((patch,ctx)=>{
 if(patch.scalePeriodicBudget&&!patch.ops.some(o=>o.path==='damage'))ctx.addIssue({code:'custom',message:'Periodic scaling requires a damage patch'});
 for(const op of patch.ops){if(['add','mul'].includes(op.op)&&(typeof op.value!=='number'||!Number.isFinite(op.value)))ctx.addIssue({code:'custom',message:'Numeric patch requires finite number'});if(op.op==='append'&&!Array.isArray(op.value))ctx.addIssue({code:'custom',message:'Append patch requires an array'});}
});
export type SkillPatch=z.infer<typeof skillPatchSchema>;
