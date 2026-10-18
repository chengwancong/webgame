import {readJson,save,review,stamp,decision} from './io.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
export async function relaxRateLimits(output=review+'/S6/rate',observed?:number){
 const samples=[];if(observed===undefined)for(const level of [10,20,30,40,50]){const sample=await readJson(review+'/S5/arms/efficiency-'+level+'.json');samples.push({level,kills:sample.kills,seconds:sample.elapsed,rate:sample.kills/sample.elapsed});}
 const maximum=observed??Math.max(...samples.map(r=>r.rate)),raw=await readJson('packages/content/spine-rate-limits.json'),after=Math.max(raw.killsPerSecond,Math.ceil(maximum*2)),changes:SpineChange[]=after===raw.killsPerSecond?[]:[{file:'packages/content/spine-rate-limits.json',path:['killsPerSecond'],before:raw.killsPerSecond,after,basis:'M9真实World观察最大击杀速率'+maximum+'×2；只放宽，原RATE公式与鉴权不变'}];
 await save(output+'/rate-summary.json',{...stamp(),samples,maximum,before:raw.killsPerSecond,after,changes});await applySpinePlan('.',changes,spineSchemas,{apply:true,output});if(changes.length)await decision('RATE击杀阈值放宽 '+output,'观察最大速率'+maximum+'，原阈值'+raw.killsPerSecond+'→'+after+'；仅配置阈值，判定逻辑不变','packages/content/spine-rate-limits.json、apps/api/src/app.ts');return after;
}
if(process.argv[1]?.endsWith('rate-limits.ts'))await relaxRateLimits();
