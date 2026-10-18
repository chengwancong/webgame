import {z} from 'zod';
import type {Stats} from '../contracts/index.ts';
import {damageZoneSchema} from '../contracts/damage-zones.ts';
import type {DamageZone} from './damage-zones.ts';
export const statConversionSchema=z.object({source:z.string().min(1),name:z.string().min(1),fromStat:z.enum(['speedBonus','cdr']),toStat:z.literal('damageAdd'),ratio:z.number().finite().nonnegative(),threshold:z.number().finite().nonnegative().default(0)}).strict();
export type StatConversion=z.input<typeof statConversionSchema>;
/** Server-owned permanent-stat conversion. speedBonus is a ratio over the
 * character's level baseline, so flat cells/second never become percentages. */
export function conversionZones(stats:Stats,baseline:{speed:number},inputs:StatConversion[]):DamageZone[]{
 if(!Number.isFinite(baseline.speed)||baseline.speed<=0)throw Error('Invalid baseline speed');const definitions=inputs.map(c=>statConversionSchema.parse(c));if(new Set(definitions.map(c=>c.source)).size!==definitions.length)throw Error('Duplicate conversion source');
 return definitions.map(c=>{const value=c.fromStat==='speedBonus'?stats.speed/baseline.speed-1:stats.cdr??0;if(!Number.isFinite(value))throw Error('Invalid conversion input');return damageZoneSchema.parse({id:'conversion-'+c.source,label:c.name,kind:'add',pool:'type',value:Math.max(0,value-c.threshold)*c.ratio});});
}
