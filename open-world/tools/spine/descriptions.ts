import {effectRuleSchema} from '../../packages/contracts/effects.ts';
import {describeAspectRule} from '../../packages/content/aspect-description.ts';
import {readJson,save,review,stamp} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
const source=await readJson(review+'/S3/plan.json'),changes:SpineChange[]=[],output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??review+'/S3/descriptions';
// Only current out-of-run equipment descriptions are regenerated; retired run choices have no owner.
for(const file of ['packages/content/set-effects.json']){
 const raw=await readJson(file),indices=new Set<number>(source.changes.filter((c:any)=>c.file===file).map((c:any)=>Number(c.path[0])));
 for(const i of indices){const object=raw[i];
  for(const part of ['two','four'])for(let r=0;r<(object[part].rules??[]).length;r++){const rule=object[part].rules[r],after=describeAspectRule(effectRuleSchema.parse(rule));if(rule.description!==after)changes.push({file,path:[i,part,'rules',r,'description'],before:rule.description,after,basis:'S3套装主数值的真实参数说明'});}
 }
}
await save(output+'-plan.json',{...stamp(),changes});await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output});
