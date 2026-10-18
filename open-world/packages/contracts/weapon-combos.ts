import {z} from 'zod';
import {damageTypeSchema,statusKindSchema} from './skill-mechanics.ts';
import {weaponTypeSchema} from './weapons.ts';

// Weapon-school combo rules. Each action has exactly one executor in packages/simulation.
// ratio values are fractions of the triggering reference damage (crit/execute applied, before armor).
const ratio=z.number().positive().max(5),ticks=z.number().int().positive();
export const comboTriggerSchema=z.enum(['hit','crit','kill','cast','nth','passive']);
export const comboStatusSchema=z.enum(['bleed','burn','poison','shock','slow','armor_down']);
export const comboActionSchema=z.discriminatedUnion('type',[
 /** Derived area damage around the triggering target. */
 z.object({type:z.literal('nova'),radius:z.number().positive().max(6),ratio,damageType:damageTypeSchema,vfx:z.string().min(1)}).strict(),
 /** Applies a status to the hit target; DOT budget = ratio × reference damage over duration. */
 z.object({type:z.literal('status'),status:comboStatusSchema,duration:ticks,strength:z.number().nonnegative().max(1).default(0),ratio:z.number().nonnegative().max(5).default(0)}).strict(),
 /** On kill: copies the listed statuses the victim carried to nearby enemies. */
 z.object({type:z.literal('spread'),statuses:z.array(comboStatusSchema).min(1),radius:z.number().positive().max(6),count:z.number().int().min(1).max(6)}).strict(),
 /** Radial derived projectiles fired from the target position. */
 z.object({type:z.literal('shards'),count:z.number().int().min(1).max(6),ratio,range:z.number().positive().max(10),damageType:damageTypeSchema,vfx:z.string().min(1)}).strict(),
 /** On cast: repeats the skill once after delay at ratio damage. Echoes never echo. */
 z.object({type:z.literal('echo'),ratio,delay:ticks}).strict(),
 /** On kill: shortens the killing skill's remaining cooldown. */
 z.object({type:z.literal('refund'),ticks}).strict(),
 /** Passive: damage multiplier (1+ratio) against targets carrying any listed status. */
 z.object({type:z.literal('amplify'),ratio,against:z.array(statusKindSchema).min(1)}).strict(),
]);
export const comboRuleSchema=z.object({
 id:z.string().min(1),name:z.string().min(1),description:z.string().min(1),source:z.string().min(1),
 weapons:z.array(weaponTypeSchema).min(1),trigger:comboTriggerSchema,
 chance:z.number().min(0).max(1).default(1),cooldown:z.number().int().nonnegative().default(0),every:z.number().int().min(2).max(10).optional(),
 damageTypes:z.array(damageTypeSchema).optional(),skillKinds:z.array(z.string()).optional(),targetStatus:z.array(statusKindSchema).optional(),
 action:comboActionSchema,
}).strict().superRefine((r,c)=>{
 const need:Record<string,string[]>={echo:['cast'],refund:['kill'],spread:['kill'],amplify:['passive'],nova:['hit','crit','kill','nth'],status:['hit','crit','nth'],shards:['hit','crit','kill','nth']};
 if(!need[r.action.type].includes(r.trigger))c.addIssue({code:'custom',message:`${r.action.type} cannot use trigger ${r.trigger}`});
 if((r.trigger==='nth')!==(r.every!==undefined))c.addIssue({code:'custom',message:'nth trigger requires every and only nth uses it'});
 if(r.action.type==='status'&&['bleed','burn','poison'].includes(r.action.status)&&!(r.action.ratio>0))c.addIssue({code:'custom',message:'DOT combo requires ratio'});
});
export type ComboRule=z.infer<typeof comboRuleSchema>;
export type ComboAction=z.infer<typeof comboActionSchema>;
/** Combo rule ids are the status/skill source for combo effects; their vfx keys live under combo/. */
export const isComboRuleId=(id:string)=>id.startsWith('innate-')||id.startsWith('aspect-combo-');
export const statusVfxKey=(skill:string,monster:boolean)=>skill==='burn'?'system/burn':isComboRuleId(skill)?'combo/'+skill:(monster?'monster/':'player/')+skill;
/** Per-tick world budget for combo actions; derived kill chains stop at this depth. */
export const comboLimits={actionsPerTick:24,killDepth:2} as const;
