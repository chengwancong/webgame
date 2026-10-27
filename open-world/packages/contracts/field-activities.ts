import {hexCombatStatsSchema} from './hex-combat-stats.ts';
import {z} from 'zod';
import {clientMovementReportSchema,clientMovementViewSchema} from './client-movement.ts';
const id=z.string().min(1).max(120),point=z.object({x:z.number().finite(),y:z.number().finite()}).strict();
export const fieldActivityCommandSchema=z.object({command_id:z.uuid(),revision:z.number().int().nonnegative(),lease_id:z.uuid(),region:id,target:id,kind:z.enum(['event','chest','rare']),position:point}).strict();
export const fieldActivityInputSchema=z.object({lease_id:z.uuid(),instance:z.uuid(),clientMovement:clientMovementReportSchema.optional(),clientMovementReset:z.boolean().optional(),movement:point.optional(),destination:point.optional(),mode:z.enum(['semi','auto']).optional(),skill:id.optional(),target:point.optional()}).strict().superRefine((v,c)=>{
 if(v.clientMovementReset&&(v.clientMovement||v.movement||v.destination||v.mode||v.skill||v.target))c.addIssue({code:'custom',message:'Movement reset must be a separate command'});
 if(v.clientMovement&&(v.movement||v.destination||v.mode))c.addIssue({code:'custom',message:'Client movement cannot include legacy movement controls'});
});
export const fieldActivityViewSchema=z.object({movement:clientMovementViewSchema.optional(),hexCombatStats:hexCombatStatsSchema.optional(),instance:z.uuid(),target:id,region:id,kind:z.enum(['event','chest','rare']),name:z.string(),position:point,status:z.enum(['running','success','failed','ready','cooldown','claimed']),tick:z.number().int().nonnegative(),waves:z.number().int().nonnegative(),waveCount:z.number().int().nonnegative(),startedAt:z.number().int().nonnegative(),cooldownUntil:z.number().int().nonnegative(),remainingSeconds:z.number().nonnegative(),objectiveHp:z.number().nonnegative().optional(),objectiveMaxHp:z.number().positive().optional(),killed:z.number().int().nonnegative(),total:z.number().int().nonnegative(),reason:z.string(),battle:z.unknown().optional()}).strict();
export type FieldActivityView=z.infer<typeof fieldActivityViewSchema>;
