import {z} from 'zod';
import {effectRuleSchema,type EffectRule} from '../contracts/effects.ts';
import {effectAtoms} from '../content/effect-atoms.ts';
const safePath=z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(?:\.(?:[A-Za-z][A-Za-z0-9_]*|[0-9]+))*$/).refine(path=>!path.split('.').some(key=>['__proto__','prototype','constructor'].includes(key)),'Unsafe effect path');
export const atomReferenceSchema=z.object({id:z.string().min(1),tier:z.number().finite().positive(),source:z.string().min(1),set:z.record(safePath,z.unknown()).optional()}).strict();
export type AtomReference=z.infer<typeof atomReferenceSchema>;
export const ruleOverrideSchema=z.object({target:z.string().min(1),set:z.record(safePath,z.unknown()).optional(),mul:z.record(safePath,z.number().finite()).optional(),add:z.record(safePath,z.number().finite()).optional()}).strict().refine(o=>!!(o.set||o.mul||o.add),'Empty rule override');
export type RuleOverride=z.infer<typeof ruleOverrideSchema>;
function read(value:unknown,path:string){return path.split('.').reduce((node,key)=>node&&typeof node==='object'?(node as Record<string,unknown>)[key]:undefined,value);}
function write(value:EffectRule,path:string,next:unknown){safePath.parse(path);const keys=path.split('.'),last=keys.pop()!;let node=value as unknown as Record<string,unknown>;for(const key of keys){node[key]??={};if(node[key]===null||typeof node[key]!=='object')throw Error('Effect path crosses scalar '+path);node=node[key] as Record<string,unknown>;}node[last]=structuredClone(next);}
function change(rule:EffectRule,override:RuleOverride){
 for(const [path,value]of Object.entries(override.set??{}))write(rule,path,value);
 for(const [op,table]of [['mul',override.mul],['add',override.add]] as const)for(const [path,value]of Object.entries(table??{})){const old=read(rule,path);if(typeof old!=='number'||!Number.isFinite(old))throw Error('Override requires an existing numeric effect field '+path);write(rule,path,op==='mul'?old*value:old+value);}
 // Probability amplification has an explicit 100% ceiling; no other parameter
 // is silently clamped, and unknown mechanism fields still fail the schema.
 rule.chance=Math.min(1,rule.chance);return effectRuleSchema.parse(rule);
}
/** Scaling occurs once after selecting the highest tier of each atom. */
export function resolveAtomParts(inputs:AtomReference[],overrides:RuleOverride[]=[],catalog:EffectRule[]=effectAtoms):EffectRule[]{
 const byId=new Map(catalog.map(r=>[r.id,r]));if(byId.size!==catalog.length)throw Error('Duplicate atom definition');const selected=new Map<string,AtomReference>();
 for(const input of inputs){const ref=atomReferenceSchema.parse(input);if(!byId.has(ref.id))throw Error('Unknown atom '+ref.id);const old=selected.get(ref.id);if(!old||ref.tier>old.tier)selected.set(ref.id,ref);}
 const rules=[...selected.values()].map(ref=>{let rule=structuredClone(byId.get(ref.id)!);rule.source=ref.source;rule.tier=ref.tier;for(const path of rule.scale){const old=read(rule,path);if(typeof old!=='number')throw Error('Invalid atom scale path '+path);write(rule,path,old*ref.tier);}if(ref.set)rule=change(rule,{target:rule.id,set:ref.set});return effectRuleSchema.parse(rule);});
 return overrideEffectRules(rules,overrides);
}
/** Explicit groups let the owner identify legacy combos and set identities. */
export function overrideEffectRules(inputs:EffectRule[],overrides:RuleOverride[],groups:Record<string,string[]>={}):EffectRule[]{
 const checked=overrides.map(o=>ruleOverrideSchema.parse(o));return inputs.map(input=>{let rule=structuredClone(input);for(const o of checked)if(o.target==='*'||o.target===rule.id||o.target===rule.source||groups[o.target]?.includes(rule.id))rule=change(rule,o);return effectRuleSchema.parse(rule);});
}
