import {z} from 'zod';
import {statusEffectSchema,damageTypeSchema,type StatusEffect,type DamageCategory,type DamageType,type Skill,type Vec} from '../contracts/index.ts';

export const statusInstanceSchema=z.object({
 id:z.string(),sourceId:z.string(),targetId:z.string(),skill:z.string(),castId:z.number().int().nonnegative().optional(),
 vfxKey:z.string().optional(),effect:statusEffectSchema,started:z.number().int().nonnegative(),ends:z.number().int().nonnegative(),next:z.number().int().nonnegative(),
 typeAdd:z.number().nonnegative().optional(),baseEnds:z.number().int().nonnegative().optional(),emitted:z.number().int().nonnegative(),sourcePosition:z.object({x:z.number().finite(),y:z.number().finite()}),penetration:z.number().min(0).max(1),
}).strict();
export type StatusInstance=z.infer<typeof statusInstanceSchema>;
/** comboDepth: >0 marks damage produced by a weapon combo; such hits never fire hit/crit/nth triggers. */
export type DamageContext={typeAdd?:number;part?:number;statusKind?:StatusEffect['kind'];effectCrit?:boolean;category:DamageCategory;damageType:DamageType;penetration?:number;skill?:Skill;scaled?:boolean;comboDepth?:number};
export type ComboEcho={retarget?:boolean;at:number;skill:Skill;targetId?:string;position:Vec;rule:string};
export type SkillSequence={origin?:Vec;direction?:Vec;sourceId:string;targetId?:string;skill:Skill;position:Vec;started:number;ends:number;next:number;index:number;castId?:number;vfxKey?:string};
export function splitBudget(total:number,count:number,index:number){const base=Math.floor(total/count);return index===count-1?total-base*(count-1):base;}
/** Exact future DOT budget, including refreshes past the first budget cycle. */
export function remainingStatusDamage(status:StatusInstance,tick:number){
 const interval=status.effect.interval,total=status.effect.total;
 if(!interval||total===undefined||status.ends<tick||status.next>status.ends)return 0;
 const count=Math.max(1,Math.floor(status.effect.duration/interval)),first=Math.max(tick,status.next),future=Math.max(0,Math.floor((status.ends-first)/interval)+1);
 if(!future)return 0;
 const base=splitBudget(total,count,0),tail=splitBudget(total,count,count-1),offset=(count-1-status.emitted%count+count)%count,lastCount=future>offset?Math.floor((future-1-offset)/count)+1:0;
 return future*base+lastCount*(tail-base);
}
// Legacy checkpoints and hand-authored fixtures have no metadata. Their migrated
// basic attacks have an explicit physical type; known chapter skills use content.
export function checkedDamageType(value:unknown):DamageType{return damageTypeSchema.parse(value);}
