import raw from './hex-runes.json';
import {z} from 'zod';
import {effectRuleSchema} from '../contracts/effects.ts';
import {publicHexRuneSchema,hexCategories,hexMetadata} from '../contracts/hex-runes.ts';
import {describeAspectRule} from './aspect-description.ts';
const tierSchema=z.object({requiredLevel:z.number().int().positive(),rules:z.array(effectRuleSchema).min(1)}).strict();
export const hexRuneSchema=z.object({
 id:z.string().regex(/^hex-[a-z0-9-]+$/),name:z.string().min(1),description:z.string().min(1),
 category:z.enum(hexCategories),icon:z.string().min(1),exclusiveGroup:z.string().min(1),
 ...hexMetadata,
 tiers:z.object({common:tierSchema,magic:tierSchema,rare:tierSchema.optional(),legendary:tierSchema.optional()}).strict()
}).strict();
export const hexRuneCatalogSchema=z.array(hexRuneSchema).superRefine((runes,ctx)=>{
 const ids=new Set<string>(),ruleIds=new Set<string>();
 for(const [index,rune] of runes.entries()){
  if(ids.has(rune.id))ctx.addIssue({code:'custom',path:[index,'id'],message:'Duplicate HEX id'});
  ids.add(rune.id);
  for(const [quality,tier] of Object.entries(rune.tiers))for(const [ruleIndex,rule] of tier.rules.entries()){
   const path=[index,'tiers',quality,'rules',ruleIndex];
   if(ruleIds.has(rule.id))ctx.addIssue({code:'custom',path:[...path,'id'],message:'Duplicate HEX effect rule id'});
   ruleIds.add(rule.id);
   if(rule.source!==rune.id)ctx.addIssue({code:'custom',path:[...path,'source'],message:'HEX source must reference its rune'});
  }
 }
});
export type HexRune=z.infer<typeof hexRuneSchema>;
export const hexRunes=hexRuneCatalogSchema.parse(raw);
// Use the same resolved parameters for public tooltips and equipped rule metadata.
for(const rune of hexRunes)for(const tier of Object.values(rune.tiers))for(const rule of tier.rules)rule.description=describeAspectRule(rule);
export const hexRuneById=new Map(hexRunes.map(r=>[r.id,r]));
export const publicHexRunes=hexRunes.map(({tiers,...rune})=>publicHexRuneSchema.parse({...rune,tiers:Object.fromEntries(Object.entries(tiers).map(([quality,tier])=>[quality,{requiredLevel:tier.requiredLevel,description:tier.rules.map(r=>r.description).join('；')}]))}));
