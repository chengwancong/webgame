import {weaponTypeSchema} from './weapons.ts';
import {damageTypeSchema,statusKindSchema} from './skill-mechanics.ts';
import {z} from 'zod';
export type Condition={kind:'skill';tags?:string[];skills?:string[];weapons?:string[];damageTypes?:string[];longest?:boolean}|{kind:'target_status';statuses:string[];minStacks?:number}|{kind:'target_rank';ranks:('normal'|'elite'|'boss')[]}|{kind:'target_hp'|'self_hp'|'distance'|'crowd'|'combat_time'|'cast_hits';op:'lt'|'lte'|'gt'|'gte';value:number;radius?:number}|{kind:'self_state';state:'shield'|'moving'|'still'|'mana'|'buff'|'kills'|'manaSpent';value?:number;id?:string}|{kind:'all'|'any';conditions:Condition[]}|{kind:'not';condition:Condition};
const strings=z.array(z.string()).min(1),comparison=z.object({kind:z.enum(['target_hp','self_hp','distance','crowd','combat_time','cast_hits']),op:z.enum(['lt','lte','gt','gte']),value:z.number().finite(),radius:z.number().nonnegative().optional()}).strict();
export const conditionSchema:z.ZodType<Condition>=z.lazy(()=>z.union([
 z.object({kind:z.literal('skill'),tags:strings.optional(),skills:strings.optional(),weapons:z.array(weaponTypeSchema).min(1).optional(),damageTypes:z.array(damageTypeSchema).min(1).optional(),longest:z.boolean().optional()}).strict(),
 z.object({kind:z.literal('target_status'),statuses:z.array(statusKindSchema).min(1),minStacks:z.number().int().positive().optional()}).strict(),
 z.object({kind:z.literal('target_rank'),ranks:z.array(z.enum(['normal','elite','boss'])).min(1)}).strict(),comparison,
 z.object({kind:z.literal('self_state'),state:z.enum(['shield','moving','still','mana','buff','kills','manaSpent']),value:z.number().nonnegative().optional(),id:z.string().optional()}).strict(),
 z.object({kind:z.enum(['all','any']),conditions:z.array(conditionSchema).min(1)}).strict(),z.object({kind:z.literal('not'),condition:conditionSchema}).strict()
]));
export type ConditionContext={skill?:{id:string;tags?:string[];weapon?:string|null;damageType?:string;longest?:boolean};target?:{statuses:Record<string,number>;rank:'normal'|'elite'|'boss';hp:number;distance:number;crowd:number};self:{hp:number;shield:number;moving:number;still:number;mana:number;buffs:string[];kills:number;manaSpent:number};combatTime:number;nearbyDistances?:number[];castHits?:number;upperBound?:boolean};
