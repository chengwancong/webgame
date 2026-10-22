import {z} from 'zod';
import raw from './hex-policy.json';
export const hexPolicySchema=z.object({
 version:z.union([z.literal(1),z.literal(2),z.literal(3)]),resonanceMin:z.number().int().min(2).max(6),resonanceMultiplier:z.number().min(1),
 damageMultiplierCap:z.number().min(0).max(1),damageReductionCap:z.number().min(0).max(1),
 cooldownReductionCap:z.number().min(0).max(1),recoveryPerSecondCap:z.number().min(0).max(1),
 manaRefundCap:z.number().min(0).max(1),invulnerabilitySharedTicks:z.number().int().positive(),invulnerabilityMaxTicks:z.number().int().positive(),
 lethalSaveMinimumTicks:z.number().int().positive().optional(),resetSecondaryScale:z.number().min(0).max(1).optional()
}).strict().superRefine((p,c)=>{if(p.version>=2&&p.lethalSaveMinimumTicks===undefined)c.addIssue({code:'custom',message:'Missing lethal-save minimum'});});
export const hexPolicyContentSchema=z.object({policy:hexPolicySchema.nullable()}).strict();
export const hexPolicy=hexPolicyContentSchema.parse(raw).policy;
