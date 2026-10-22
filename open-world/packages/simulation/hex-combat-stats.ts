import {z} from 'zod';
import type {HexCombatStats} from '../contracts/hex-combat-stats.ts';
import type {EffectRule} from '../contracts/effects.ts';
import type {World} from './index.ts';
const amount=z.number().finite().nonnegative();
export const hexStatisticsSchema=z.object({complete:z.boolean(),totalDamage:amount,rules:z.record(z.string(),z.object({rune:z.string(),source:z.string(),triggers:z.number().int().nonnegative(),directDamage:amount}).strict())}).strict().superRefine((s,c)=>{if(Object.values(s.rules).reduce((n,r)=>n+r.directDamage,0)>s.totalDamage+1e-6)c.addIssue({code:'custom',message:'Attributed damage exceeds total damage'});});
export type HexStatistics=z.infer<typeof hexStatisticsSchema>;
export const newHexStatistics=(complete=true):HexStatistics=>({complete,totalDamage:0,rules:{}});
export function hexStatisticsRule(s:HexStatistics,r:EffectRule){return s.rules[r.id]??={rune:r.hexMechanism!,source:r.source,triggers:0,directDamage:0};}
/** Only API callers may label this view server-authoritative. Never ingest a client view. */
export function serverHexCombatStats(s:HexStatistics|null|undefined,rules:readonly EffectRule[]=[]):HexCombatStats{
 if(!s)return {source:'server',coverage:'unavailable',metric:'direct-hp-damage',triggerMetric:'rule-trigger-events',totalDamage:null,directDamage:null,share:null,rules:[]};
 const rows=structuredClone(s.rules);
 for(const r of rules)if(r.hexMechanism&&!rows[r.id])rows[r.id]={rune:r.hexMechanism,source:r.source,triggers:0,directDamage:0};
 const directDamage=Object.values(rows).reduce((n,r)=>n+r.directDamage,0),share=(n:number)=>s.totalDamage>0?n/s.totalDamage:null;
 return {source:'server',coverage:s.complete?'complete':'partial',metric:'direct-hp-damage',triggerMetric:'rule-trigger-events',totalDamage:s.totalDamage,directDamage,share:share(directDamage),rules:Object.entries(rows).sort(([a],[b])=>a.localeCompare(b)).map(([rule,r])=>({rule,...r,share:share(r.directDamage)}))};
}
export function serverWorldHexCombatStats(w:World|null|undefined,character:string):HexCombatStats{
 let result=serverHexCombatStats(null);
 if(w?.players.has(character))w.forPlayer(character,()=>{result=serverHexCombatStats(w.hexStatistics,w.stats.rules);});
 return result;
}
