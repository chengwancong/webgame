import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {benchSample,targets} from './bench.ts';
import {standardState,resolvePlayer} from './player.ts';
import {save,readJson,evidence,stamp,sha,data} from './io.ts';
import {median} from './math.ts';
export async function currentParity(output:string){
 const model=await readJson(data+'/spine-player.json'),engine=sha(await readFile('packages/simulation/index.ts')),bench=sha(await readFile('tools/spine/bench.ts')),rows=[];
 for(const level of [10,20,30,40,50]){const values=[];
  for(const family of ['sword','staff','hidden'] as const){const player=resolvePlayer('parity-current-'+family+'-'+level,standardState(level,family)),point=model.points.find((p:any)=>p.level===level),directory=dirname(typeof point.localSource==='string'?point.localSource:point.localSource.path),candidate=family==='sword'?(typeof point.localSource==='string'?point.localSource:point.localSource.path):resolve(directory,'standard-final-'+family+'-'+level+'.json');let value:number|undefined,reused=false;
   if(model.engineSha256===engine&&model.benchSha256===bench&&model.targetArmors?.[level]===targets(level,1)[0].monster!.armor){try{const prior=await readJson(candidate);if(JSON.stringify(prior.inputs.player.build)===JSON.stringify(player.build)&&JSON.stringify(prior.inputs.player.skillRanks)===JSON.stringify(player.skillRanks)){value=prior.metrics.D1;reused=true;}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
   let source;if(reused)source=await evidence(candidate);else{const path=output+'/arms/parity-'+level+'-'+family+'.json',signature=sha(JSON.stringify({player,engine,bench,seeds:[41,42,43]}));let prior;try{prior=await readJson(path);if(prior.signature!==signature)throw Error('平价输入已变化，不覆盖旧样本 '+path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const samples=[41,42,43].map(seed=>benchSample(player,'D1',seed,player.build.stats.hp));prior={signature,player,samples,D1:median(samples.map(s=>s.value!))};await save(path,prior);}value=prior.D1;source=await evidence(path);}
   values.push({family,D1:value!,reusedCurrentModel:reused,source});
  }
  const dps=values.map(v=>v.D1),gap=Math.max(...dps)/Math.min(...dps)-1;rows.push({level,values,gap,passed:gap<=.15});
 }await save(output+'/parity-summary.json',{...stamp(),rows,passed:rows.every(r=>r.passed)});return rows;
}
