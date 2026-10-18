import assert from 'node:assert/strict';
import {benchSample,measurementVersion} from './bench.ts';
import {median} from './math.ts';
import {readJson,save,stamp,evidence} from './io.ts';
const cache=new Map<string,any>();
export async function replayFrozenBurst(file:string,id:string,output:string){
 const key=output+'|'+file;if(cache.has(key))return cache.get(key);
 const old=await readJson(file),rows=old.rows.filter((r:any)=>r.axis==='B3').map((r:any)=>benchSample(old.inputs.player,'B3',r.seed,old.inputs.standardHp));
 for(const row of rows){const prior=old.rows.find((r:any)=>r.axis==='B3'&&r.seed===row.seed);assert(Math.abs(row.rawWindowDps-prior.value)<=1e-7,'冻结输入原始B3变化，拒绝只换统计定义：'+id+'/'+row.seed);}
 const metrics={...old.metrics,B3:median(rows.map((r:any)=>r.value))},source=await evidence(file),path=output+'/arms/'+id+'.json';
 await save(path,{...stamp(),measurementVersion,inputs:old.inputs,metrics,rows,reusedAxes:['D1','DN','EHP','AV','NT'],reusedFrom:source,rawB3Unchanged:true});
 const result={metrics,source:await evidence(path),original:source};cache.set(key,result);return result;
}
