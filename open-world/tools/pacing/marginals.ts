import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {newAspects} from '../../packages/content/aspects.ts';
import {mechanismKnobs,knobPath,at,put,snapKnob,type MechanismKnob} from './derive-model.ts';
import {measurePacingBuilds,median} from './measure.ts';
import {pacingScenes} from '../../packages/contracts/pacing.ts';
import {auditShared} from './identity-audit.ts';
export function perturb(value:number,k:MechanismKnob){const delta=k.scale==='log'?Math.max(value*.2,2*k.step):2*k.step;return snapKnob(value+(value+delta<=k.ceiling?delta:-delta),k);}
export function elasticity(before:number|null,after:number|null,value:number,perturbed:number,scale:string){if(before===null||after===null||before<=0||after<=0||value===perturbed)return null;return Math.log(after/before)/(scale==='log'?Math.log(perturbed/value):perturbed-value);}
export async function runMarginals(args=process.argv.slice(2)){
 const from=resolve(args.find(a=>a.startsWith('--from='))?.slice(7)??''),out=resolve(args.find(a=>a.startsWith('--out='))?.slice(6)??'.qa/pacing/marginals');await mkdir(out,{recursive:true});await auditShared(out);
 const base=JSON.parse(await readFile(resolve(from,'combat/bd-measurements.json'),'utf8'));if(JSON.stringify(base.seeds)!=='[41,42,43]')throw Error('边际需要完整三种子基线');
 const saved=await readFile(resolve(out,'marginals.json'),'utf8').then(JSON.parse).catch(()=>({knobs:[]})),results:any[]=saved.knobs;
 for(const k of mechanismKnobs){const key=k.bd+':'+k.rule+':'+k.path.join('.');if(results.some(r=>r.key===key))continue;const path=knobPath(newAspects,k),value=at(newAspects,path),next=perturb(value,k);if(next===value)throw Error('旋钮无可扰动网格 '+key);put(newAspects,path,next);
  let arm;try{arm=await measurePacingBuilds({output:resolve(out,'arms',String(results.length+1)),buildIds:[k.bd],seeds:[41,42,43]});}finally{put(newAspects,path,value);}
  const samples=arm.rows.map(r=>{const b=base.rows.find((b:any)=>b.bd===k.bd&&b.scene===r.scene&&b.seed===r.seed&&b.variant==='full');return {scene:r.scene,seed:r.seed,before:b.score,after:r.score,elasticity:elasticity(b.score,r.score,value,next,k.scale),seconds:r.elapsed,rules:r.rules};}),marginal=Object.fromEntries(pacingScenes.map(scene=>{const values=samples.filter(r=>r.scene===scene).map(r=>r.elasticity);return [scene,values.some(v=>v===null)?null:median(values as number[])];}));
  results.push({key,bd:k.bd,rule:k.rule,path:k.path,value,perturbed:next,delta:next-value,scale:k.scale,marginal,samples});await writeFile(resolve(out,'marginals.json'),JSON.stringify({seeds:[41,42,43],from,model:'每旋钮一次配对扰动',knobs:results},null,2)+'\n');console.log('完成旋钮 '+results.length+'/'+mechanismKnobs.length+' '+key);
 }
 const table=JSON.parse(await readFile('config/json/pacing-mechanism-knobs.json','utf8'));for(const k of table.knobs){const r=results.find(r=>r.key===k.bd+':'+k.rule+':'+k.path.join('.'));k.marginal=r.marginal;k.basis=`measured:C3 seeds=41,42,43 Δ=${Number(r.delta.toFixed(4))} ${k.scale}`;}await writeFile('config/json/pacing-mechanism-knobs.json',JSON.stringify(table,null,2)+'\n');
 for(const cmd of [['tools/pacing/sync-knobs.py'],['tools/config-export.py']]){const p=spawnSync('python',['-X','utf8',...cmd],{stdio:'inherit',windowsHide:true});if(p.status!==0)throw Error('旋钮Excel同步失败');}
 return results;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await runMarginals();
