import {readJson,save,review,decision} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
const file='packages/content/world-tiers.json',raw=await readJson(file),changes:SpineChange[]=[];
for(const key of ['hp','attack']){const before=raw.tiers[3].monster[key],after=Number((Math.max(.05,Math.round(before/.05)*.05)).toFixed(2));if(after!==before)changes.push({file,path:['tiers',3,'monster',key],before,after,basis:'M8当前闭式推导值投影到0.05倍率档；无新增测量或候选比较'});}
await save(review+'/S5/tier-step-plan.json',{changes});await applySpinePlan('.',changes,spineSchemas,{apply:true,output:review+'/S5/tier-step'});
