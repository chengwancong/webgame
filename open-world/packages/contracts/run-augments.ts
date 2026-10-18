import {z} from 'zod';
export const augmentTierSchema=z.enum(['silver','gold','prismatic']);
export type AugmentTier=z.infer<typeof augmentTierSchema>;
export const augmentPolicySchema=z.object({enabled:z.boolean(),choices:z.literal(3),rerolls:z.number().int().nonnegative().max(100),rounds:z.array(z.array(z.object({tier:augmentTierSchema,weight:z.number().finite().positive()}).strict()).min(1).max(3).refine(rows=>new Set(rows.map(r=>r.tier)).size===rows.length,'Duplicate tier weight')).max(100)}).strict().refine(p=>!p.enabled||p.rounds.length>0,'Enabled augments require rounds');
export type AugmentPolicy=z.infer<typeof augmentPolicySchema>;
export type AugmentOption={id:string;tier:AugmentTier;tags:string[];requires?:{setId:string;pieces:number}};
export type AugmentContext={tags:string[];sets:Record<string,number>};
export const augmentCommandIdSchema=z.uuid();
export const augmentRunSchema=z.object({offered:z.array(z.string().min(1)).max(3),chosen:z.array(z.string().min(1)).max(100),rerollsLeft:z.number().int().nonnegative(),round:z.number().int().nonnegative(),offerVersion:z.number().int().nonnegative(),privateSeed:z.number().int().min(1).max(4294967295),commands:z.record(augmentCommandIdSchema,z.object({op:z.enum(['choose','reroll']),choice:z.string().optional(),offerVersion:z.number().int().nonnegative()}).strict())}).strict().superRefine((r,c)=>{
 if(new Set(r.offered).size!==r.offered.length||new Set(r.chosen).size!==r.chosen.length||r.offered.some(id=>r.chosen.includes(id)))c.addIssue({code:'custom',message:'Duplicate or already chosen augment'});
});
export type AugmentRun=z.infer<typeof augmentRunSchema>;
export const publicAugmentRunSchema=z.object({offered:augmentRunSchema.shape.offered,chosen:augmentRunSchema.shape.chosen,rerollsLeft:augmentRunSchema.shape.rerollsLeft,round:augmentRunSchema.shape.round,offerVersion:augmentRunSchema.shape.offerVersion}).strict();
