import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {craftRecipes,craftFacilities,craftFacilityCost,craftPolicy} from '../../packages/content/crafting.ts';
export const craftingBaseline='bf1a63ef808e166fc8b0c0b5e441c63e6e068f12';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
export async function craftingKeyProof(stages:{stage:number;sourceCycle:string[]}[]){
 const files=(await readdir('apps/api/src')).filter(f=>/^stage-key.*\.(ts|json)$/.test(f));
 const rules=await Promise.all(files.map(async name=>{const file='apps/api/src/'+name,currentRaw=await readFile(file,'utf8'),current=sha(currentRaw.replace(/\r\n/g,'\n')),before=sha(execFileSync('git',['show',craftingBaseline+':open-world/'+file],{windowsHide:true,encoding:'utf8'}).replace(/\r\n/g,'\n'));return {file,before,current,rawSHA256:sha(currentRaw),unchanged:current===before};}));
 const baseline=JSON.parse(await readFile('.qa/crafting-20261014/K8-numeric/derivation.json','utf8'));
 const sourceUnchanged=stages.every(row=>JSON.stringify(row.sourceCycle)===JSON.stringify(baseline.stages.find((s:any)=>s.stage===row.stage)?.sourceCycle));
 const raw=JSON.parse(await readFile('config/json/crafting.json','utf8'));
 // 钥匙碎片和阶段原料由 world.stageKeys 持有，不属于制作材料钱包。
 const outputIds=raw.recipes.filter((r:any)=>r.output.kind==='material').map((r:any)=>r.output.id);
 const noKeyOutputs=outputIds.every((id:string)=>raw.materials.some((m:any)=>m.id===id))&&!raw.materials.some((m:any)=>/stage[-_]?key|key[-_]?fragment|key[-_]?material/i.test(m.id))&&craftPolicy.refine.every((r:any)=>r.output>0);
 const pool=rules.find(r=>r.file.endsWith('/stage-key-pools.json'))!;
 return {baseline:craftingBaseline,rules,sourceUnchanged,noKeyOutputs,poolSHA256:pool.rawSHA256,accepted:rules.every(r=>r.unchanged)&&sourceUnchanged&&noKeyOutputs&&pool.rawSHA256==='e95cb97f722c2aa1acc9982a6a7b4088d2af3befd0791ed0828a98cfe44646ef'};
}
export async function craftingNonGoldHash(){
 const raw=JSON.parse(await readFile('config/json/crafting.json','utf8'));
 for(const r of raw.recipes)if(['gear','accessory','pattern'].includes(r.category))r.baseCost.gold=0;
 for(const f of raw.facilities)f.cost.gold=0;
 delete raw.rules[0].value.facilityGoldByIsland;
 return sha(JSON.stringify(raw));
}
export function chapterPrices(i:number){
 const island=['ss-map-wind','ss-map-mist','ss-map-forge','ss-map-frost','ss-map-rift','ss-map-dragon'][i];
 const directed=craftRecipes.filter(r=>r.island===island&&['gear','accessory'].includes(r.category)&&!r.id.startsWith('forge-legacy'));
 const patterns=craftRecipes.filter(r=>r.island===island&&r.category==='pattern');
 const mean=(rows:typeof craftRecipes)=>rows.length?rows.reduce((n,r)=>n+r.baseCost.gold,0)/rows.length:0;
 const level=Math.min(6,i+2),facility=craftFacilityCost(craftFacilities.find(f=>f.id==='forge'&&f.level===level)!,[island]).gold;
 return {island,level,directedFee:mean(directed),patternFee:mean(patterns),facilityFee:facility};
}
export function deriveGoldPrices(chapters:any[]){
 return chapters.map((c,i)=>{const prices=chapterPrices(i),factor=.3*c.incomeEstimate/c.craftSpend;assert(Number.isFinite(factor)&&factor>0,'章金币倍率无效');return {chapter:i+1,...prices,factor,targetSpend:.3*c.incomeEstimate,facilityGold:Math.round(prices.facilityFee*factor),recipes:craftRecipes.filter(r=>r.island===prices.island&&['gear','accessory','pattern'].includes(r.category)).map(r=>({id:r.id,before:r.baseCost.gold,after:Math.round(r.baseCost.gold*factor)}))};});
}
export function verifyGoldPrices(derivation:any){
 return derivation.chapters.map((c:any,i:number)=>{const prices=chapterPrices(i),plan=derivation.goldPlan[i];
  for(const r of plan.recipes)assert.equal(craftRecipes.find(row=>row.id===r.id)!.baseCost.gold,r.after,'配方未应用推导价 '+r.id);
  assert.equal(prices.facilityFee,plan.facilityGold,'设施未应用推导价 '+prices.island);
  const initial=chapterPricesFromPlan(plan),groups=[7.5*prices.directedFee,3*prices.patternFee,3*prices.facilityFee],craftSpend=groups.reduce((a,b)=>a+b,0);
  const proportionError=Math.max(...groups.map((value,j)=>Math.abs(value/craftSpend-initial[j]/c.craftSpend)));
  assert(proportionError<.001,'三类金币比例超出整数舍入误差');
  return {chapter:i+1,incomeEstimate:c.incomeEstimate,craftSpend,remainderRatio:.5-craftSpend/c.incomeEstimate,groups,proportionError};
 });
}
function chapterPricesFromPlan(p:any){return [7.5*p.directedFee,3*p.patternFee,3*p.facilityFee];}
