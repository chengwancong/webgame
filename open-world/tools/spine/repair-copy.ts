/** S8仅修复未翻译字段/缺失名称，不触碰数值。 */
import {newAspects} from '../../packages/content/aspects.ts';
import {describeBuildSourceParts,describeAspectRule} from '../../packages/content/aspect-description.ts';
import {readJson,save,review,stamp} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
const file='packages/content/aspects.json',raw=await readJson(file),changes:SpineChange[]=[];
for(const [i,item] of raw.entries())if(/undefined|\b(?:fire|cold|physical|reviveRatio)\b/.test(item.description)){
 const parsed=newAspects.find(a=>a.id===item.id)!;
 changes.push({file,path:[i,'description'],before:item.description,after:describeBuildSourceParts(parsed.parts),basis:'S8原文未翻译字段；同一参数生成中文，不改数值'});
 for(const [j,rule] of parsed.parts.rules.entries()){const before=item.parts.rules[j].description,after=describeAspectRule(rule);if(before!==after)changes.push({file,path:[i,'parts','rules',j,'description'],before,after,basis:'S8同一规则参数的中文描述'});}
}
if(changes.some(c=>c.path.at(-1)!=='description'))throw Error('文案修复不得改数值');
await save(review+'/S8/aspect-copy-plan.json',{...stamp(),changes});await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output:review+'/S8/aspect-copy'});
