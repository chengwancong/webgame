import {augmentDescription} from '../../packages/rules/augment-descriptions.ts';
import {effectRuleSchema} from '../../packages/contracts/effects.ts';
import {describeBuildSourceParts,describeAspectRule} from '../../packages/content/aspect-description.ts';
import {augmentDefinitionSchema} from '../../packages/content/augments.ts';
import {readJson,save,review,stamp} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
const source=await readJson(review+'/S3/plan.json'),changes:SpineChange[]=[],output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??review+'/S3/descriptions';
for(const file of ['packages/content/augments.json','packages/content/set-effects.json']){
 const raw=await readJson(file),indices=new Set<number>(source.changes.filter((c:any)=>c.file===file).map((c:any)=>Number(c.path[0])));
 for(const i of indices){const object=raw[i];if(file.includes('augments')){const a=augmentDefinitionSchema.parse(object),p=a.parts,atomsOnly=p.atoms.length>0&&[p.stats,p.rules,p.patches,p.zones,p.conditional,p.slotPatches].every(a=>a.length===0),after=atomsOnly?augmentDescription(a):describeBuildSourceParts(p);if(!after)throw Error('不能生成已改潮印的完整说明 '+a.id);for(let r=0;r<(object.parts.rules??[]).length;r++){const rule=object.parts.rules[r],description=describeAspectRule(effectRuleSchema.parse(rule));if(rule.description!==description)changes.push({file,path:[i,'parts','rules',r,'description'],before:rule.description,after:description,basis:'真实规则参数同步内层描述'});}if(object.description!==after)changes.push({file,path:[i,'description'],before:object.description,after,basis:'S3实际归一参数重新生成潮印说明；身份保留'});}
  else for(const part of ['two','four'])for(let r=0;r<(object[part].rules??[]).length;r++){const rule=object[part].rules[r],after=describeAspectRule(effectRuleSchema.parse(rule));if(rule.description!==after)changes.push({file,path:[i,part,'rules',r,'description'],before:rule.description,after,basis:'S3套装主数值的真实参数说明'});}
 }
}
await save(output+'-plan.json',{...stamp(),changes});await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output});
