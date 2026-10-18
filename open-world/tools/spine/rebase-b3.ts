/** 用冻结的S2输入重算新B3定义；其他轴原样复用并标明来源，不重新归一内容。 */
import assert from 'node:assert/strict';
import {benchSample,measurementVersion} from './bench.ts';
import {median} from './math.ts';
import {contribution} from './audit.ts';
import {readJson,save,review,data,stamp,evidence} from './io.ts';
const output=review+'/S8/measurement-repair/rebased',cache=new Map<string,any>();
async function replay(file:string,id:string){
 if(cache.has(file))return cache.get(file);
 const old=await readJson(file),rows=old.rows.filter((r:any)=>r.axis==='B3').map((r:any)=>benchSample(old.inputs.player,'B3',r.seed,old.inputs.standardHp));
 for(const row of rows){const prior=old.rows.find((r:any)=>r.axis==='B3'&&r.seed===row.seed);assert(Math.abs(row.rawWindowDps-prior.value)<=1e-7,'冻结输入的原始B3发生变化，不能只重标口径：'+id+'/'+row.seed);}
 const metrics={...old.metrics,B3:median(rows.map((r:any)=>r.value))},source=await evidence(file),result={...stamp(),measurementVersion,inputs:old.inputs,metrics,rows,reusedAxes:['D1','DN','EHP','AV','NT'],reusedFrom:source,rawB3Unchanged:true};
 const path=output+'/arms/'+id+'.json';await save(path,result);const value={metrics,source:await evidence(path),original:source};cache.set(file,value);return value;
}
const originalPath=review+'/S8/measurement-repair/before/tools/spine/data/spine-anchor.json.snapshot',original=await readJson(originalPath),core=await readJson(review+'/S2/core-summary.json'),builds=[];
for(const build of core.builds){const next=await replay(review+'/S2/arms/'+build.id+'.json','anchor-'+build.id);builds.push({build:build.id,before:build.B3,after:next.metrics.B3,source:next.source});}
const anchor={...original.anchor,B3:median(builds.map(r=>r.after))};
await save(data+'/spine-anchor.json',{...original,...stamp(),measurementVersion,anchor,originalAnchor:original.anchor,frozenInputVersions:original.versions,rebase:{authorized:'S8/measurement-repair/authorization-summary.json',changedAxis:'B3',definition:'末1秒线性结算/2.5秒有效窗口；原始3秒DPS原样保留',rawB3Unchanged:true,source:await evidence(originalPath)}});
await save(output+'/anchor-summary.json',{...stamp(),measurementVersion,before:original.anchor,after:anchor,builds,otherAxesUnchanged:true});
const oldWeights=await readJson(review+'/S2/stat-weights.json'),weights=[];
for(const row of oldWeights.rows){const base=await replay(review+'/S2/arms/weights-'+row.level+'-base.json','weights-'+row.level+'-base'),full=await replay(row.source.path,'weights-'+row.level+'-'+row.stat),effect=contribution(full.metrics,base.metrics,anchor);weights.push({...row,weights:Object.fromEntries(Object.entries(effect.axes).map(([s,n])=>[s,n/row.delta])),powerWeight:effect.P/row.delta,before:base.metrics,after:full.metrics,source:full.source,originalSource:row.source});}
await save(output+'/stat-weights-summary.json',{...stamp(),measurementVersion,rows:weights.map(({before,after,source,originalSource,...r})=>r),inputs:await evidence(review+'/S2/stat-weights.json'),sameFrozenInputs:true});
await save(data+'/stat-weights.json',{...stamp(),measurementVersion,frozenInputVersions:oldWeights.versions,rows:weights.map(({before,after,source,originalSource,...r})=>r)});
const oldSources=await readJson(review+'/S2/sources.json'),sources=[];
for(const row of oldSources.rows){const full=await replay(review+'/S2/arms/source-'+row.host+'-full.json','source-'+row.host+'-full'),base=await replay(row.raw.path,'source-'+row.host+'-'+row.source);sources.push({...row,...contribution(full.metrics,base.metrics,anchor),before:full.metrics,without:base.metrics,raw:base.source,originalRaw:row.raw});}
await save(output+'/sources-summary.json',{...stamp(),measurementVersion,rows:sources.map(({before,without,raw,originalRaw,...r})=>r),inputs:await evidence(review+'/S2/sources.json'),sameFrozenInputs:true});
await save(data+'/sources.json',{...stamp(),measurementVersion,rows:sources.map(({before,without,raw,originalRaw,...r})=>r)});
console.log(JSON.stringify({anchor,builds:builds.length,weights:weights.length,sources:sources.length,replayedInputs:cache.size,rawB3Unchanged:true}));
