/** 同一S4冻结扰动、同一before/after；只复核新B3定义，不移动任何旋钮。 */
import {replayFrozenBurst} from './frozen-burst.ts';
import {measurementVersion} from './bench.ts';
import {mapBench,spineScenes} from './math.ts';
import {readJson,save,data,stamp,evidence} from './io.ts';
const review=process.argv[2];if(!review)throw Error('需要原始评审目录');const output=review+'/S8/measurement-repair/rebased',original=await readJson(review+'/S4/elasticities-summary.json'),anchor=(await readJson(data+'/spine-anchor.json')).anchor;const knobs:any[]=[];
for(const [i,k] of original.knobs.entries()){
 const base=await replayFrozenBurst(review+'/S4/arms/'+k.bd+'-baseline.json','S4-'+k.bd+'-base',output),next=await replayFrozenBurst(review+'/S4/arms/knob-'+k.bd+'-'+i+'.json','S4-knob-'+i,output),a=mapBench(base.metrics,anchor),b=mapBench(next.metrics,anchor),denom=k.scale==='log'?Math.log(k.after/k.before):k.after-k.before;
 const marginal=Object.fromEntries(spineScenes.map(s=>[s,denom?Math.log(b[s]/a[s])/denom:0]));knobs.push({...k,marginal,dedicated:Object.fromEntries(spineScenes.map(s=>[s,Math.abs(marginal[s])>1e-6&&spineScenes.filter(o=>o!==s).every(o=>Math.abs(marginal[s])>=2*Math.abs(marginal[o]))])),basis:k.basis+'；授权B3末端平滑复核，同一冻结输入',replay:{base:base.source,perturb:next.source}});
}
const coverage=[...new Set(knobs.map(k=>k.bd))].map(build=>({build,scenes:Object.fromEntries(spineScenes.map(s=>[s,knobs.filter(k=>k.bd===build&&k.dedicated[s]).map(k=>k.rule)]))}));
await save(output+'/elasticities-summary.json',{...stamp(),measurementVersion,original:await evidence(review+'/S4/elasticities-summary.json'),knobs,coverage,additionalNewtonSteps:0});
await save(data+'/build-knobs.json',{...stamp(),measurementVersion,frozenInputVersions:original.versions,knobs:knobs.map(({replay,...k})=>k)});
console.log(JSON.stringify({knobs:knobs.length,builds:coverage.length,additionalNewtonSteps:0}));
