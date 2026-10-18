import {z} from 'zod';
export const skillChargeStateSchema=z.object({max:z.number().int().min(1).max(5),spentUntil:z.array(z.number().int().nonnegative()).max(5)}).strict().superRefine((s,c)=>{if(s.spentUntil.length>s.max||s.spentUntil.some((t,i)=>i>0&&t<s.spentUntil[i-1]))c.addIssue({code:'custom',message:'Invalid sequential charge queue'});});
export type SkillChargeState=z.infer<typeof skillChargeStateSchema>;
function clock(tick:number){if(!Number.isSafeInteger(tick)||tick<0)throw Error('Invalid combat tick');}
export function freshSkillCharges(max:number):SkillChargeState{return skillChargeStateSchema.parse({max,spentUntil:[]});}
export function chargeReadiness(input:SkillChargeState,tick:number){clock(tick);const state=skillChargeStateSchema.parse(input),spent=state.spentUntil.filter(until=>until>tick);return {available:state.max-spent.length,next:spent.length?spent[0]-tick:0};}
/** One charge recharges at a time on the battle clock. Consuming a ready
 * charge adds one future deadline and leaves previous recharge progress intact. */
export function consumeSkillCharge(input:SkillChargeState,tick:number,rechargeTicks:number):SkillChargeState{
 clock(tick);if(!Number.isSafeInteger(rechargeTicks)||rechargeTicks<1)throw Error('Invalid recharge duration');const state=skillChargeStateSchema.parse(input),spentUntil=state.spentUntil.filter(until=>until>tick);if(spentUntil.length>=state.max)throw Error('No skill charges');spentUntil.push(Math.max(tick,spentUntil.at(-1)??tick)+rechargeTicks);return {max:state.max,spentUntil};
}
/** Reset makes all stored charges available. Reducing cooldown moves the
 * current recharge forward, keeping the spacing of subsequent charges. */
export function reduceSkillChargeCooldown(input:SkillChargeState,tick:number,ticks:number,reset=false):SkillChargeState{
 clock(tick);if(!Number.isSafeInteger(ticks)||ticks<0)throw Error('Invalid cooldown reduction');const state=skillChargeStateSchema.parse(input);if(reset)return {max:state.max,spentUntil:[]};const pending=state.spentUntil.filter(until=>until>tick);if(!pending.length)return {max:state.max,spentUntil:[]};const shift=Math.min(ticks,pending[0]-tick);return {max:state.max,spentUntil:pending.map(until=>until-shift).filter(until=>until>tick)};
}
