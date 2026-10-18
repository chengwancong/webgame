import {conditionSchema} from './conditions.ts';
import {z} from 'zod';
import raw from '../content/stats.json';
export const statDefinitionSchema=z.object({id:z.string().min(1),name:z.string().min(1),unit:z.enum(['ratio','flat','seconds']),pool:z.enum(['base','type','cond','vuln','defense','resource','status','skill']),tag:z.string().optional(),cond:conditionSchema.optional(),affixValueMax:z.number().nonnegative().optional(),cap:z.number().nonnegative().nullable(),setValueMax:z.number().nonnegative().nullable().default(null),stageScaled:z.boolean(),slots:z.array(z.enum(['weapon','armor','helmet','boots','accessory','ring','core'])),display:z.enum(['percent','number','seconds','multiplier']),affix:z.boolean(),modifier:z.boolean(),progression:z.enum(['multiply','add','skill']),default:z.number()}).strict();
export const statRegistry=z.array(statDefinitionSchema).parse(raw);
if(new Set(statRegistry.map(s=>s.id)).size!==statRegistry.length)throw Error('Duplicate stat registration');
const byId=new Map(statRegistry.map(s=>[s.id,s]));
export const statDefinition=(id:string)=>byId.get(id);
export const statIdSchema=z.enum(statRegistry.map(s=>s.id) as [string,...string[]]);
// Legacy set stats use the direct numeric fields; skill operations belong to
// the modifier/patch channel and may not silently appear in a set-stat object.
export const registeredStatShape=Object.fromEntries(statRegistry.filter(s=>s.modifier&&s.progression!=='skill').map(s=>{let value=z.number().finite().nonnegative();if(s.setValueMax!==null)value=value.max(s.setValueMax);return [s.id,value.optional()];}));
export const statLabels=Object.fromEntries(statRegistry.map(s=>[s.id,s.name]));

export const optionalNumericStatShape=Object.fromEntries(statRegistry.filter(s=>s.pool!=="type").map(s=>[s.id,z.number().finite().nonnegative().optional()]));
export function numericStat(stats:object,id:string){const value=(stats as Record<string,unknown>)[id];return typeof value==="number"?value:statDefinition(id)?.default??0;}
