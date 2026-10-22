import {z} from 'zod';
import {hexCooldownViewSchema,type HexCooldownView} from '../contracts/hex-runes.ts';
import type {EffectRule} from '../contracts/effects.ts';
export function hexProtection(rule:EffectRule){
 const buffs=[rule.action,...rule.after??[]].filter(a=>a.type==='buff');
 return {invuln:!!rule.hexMechanism&&buffs.some(a=>a.type==='buff'&&a.flags?.immortal),
  lethal:!!rule.hexMechanism&&(rule.trigger==='lethal'||rule.also?.includes('lethal'))&&buffs.some(a=>a.type==='buff'&&(a.flags?.surviveAtOne||a.flags?.immortal))};
}
const tick=z.number().int().nonnegative();
export const hexResetFrameSchema=z.object({tick,first:z.string().min(1)}).strict();
export const hexResetMechanisms=new Set(['hex-mana-surge','hex-cycle-reset','hex-free-incantation','hex-finisher-refund','hex-streak-movement']);
export const hexCombatLedgerSchema=z.object({
 deaths:tick,
 triggers:z.record(z.string().regex(/^hex:[a-z0-9-]+$/),z.object({tick,ready:tick}).strict())
}).strict().superRefine((s,c)=>{if(Object.keys(s.triggers).length>256||Object.values(s.triggers).some(x=>x.ready<x.tick))c.addIssue({code:'custom',message:'Invalid HEX cooldown ledger'});});
export type HexCombatLedger=z.infer<typeof hexCombatLedgerSchema>;
export function validateHexCombatLedger(value:unknown,at:number){
 if(value===undefined)return;
 const ledger=hexCombatLedgerSchema.parse(value);
 if(Object.values(ledger.triggers).some(x=>x.tick>at))throw Error('Future HEX trigger');
}
/** Shared read-only projection consumer. elapsedMs is monotonic time spent
 * since receiving the view, not a comparison against the browser wall clock. */
export function importHexCooldownView(ready:Record<string,number>,at:number,view:HexCooldownView,elapsedMs=0){
 hexCooldownViewSchema.parse(view);
 if(!Number.isInteger(at)||at<0||!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('Invalid HEX view clock');
 for(const [key,until] of Object.entries(view.readyAt)){
  const remaining=Math.max(0,until-view.observedAt-elapsedMs);
  if(remaining>0)ready[key]=Math.max(ready[key]??0,at+Math.ceil(remaining*30/1000));
 }
}
