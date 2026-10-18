/** 模型只保留结论和原始路径；完整已解析构筑移到本机证据，不写入Git。 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {worldPlayerInputs} from './legacy.ts';
import {readJson,save,data,sha,evidence,stamp} from './io.ts';
const review=process.argv[2];if(!review)throw Error('需要原始评审目录');const originalRoot=resolve(review,'../../..'),pointer=await readJson(data+'/spine-world-source.json'),worldPath=resolve(originalRoot,pointer.summary),world=await readJson(worldPath),model=await readJson(data+'/spine-player.json'),numeric=sha(JSON.stringify(worldPlayerInputs(model))),sidecar=worldPath.replace(/world-summary\.json$/,'model-compat-summary.json');
let valid=sha(JSON.stringify(model))===world.playerSha256;if(!valid){const prior=await readJson(sidecar).catch(()=>null);valid=prior?.worldSummarySha256===sha(JSON.stringify(world))&&prior.numericInputsSha256===numeric;}
assert(valid,'需要先证明模型数值与世界推导输入一致');
const rawPath=review+'/S8/model-raw/spine-player-with-inputs.json';
if(model.parity.some((r:any)=>r.buildSource)){
 await mkdir(dirname(rawPath),{recursive:true});await writeFile(rawPath,await readFile(data+'/spine-player.json'));
 const base=dirname(model.points[0].localSource.path??model.points[0].localSource);
 for(const row of model.parity){delete row.buildSource;row.localSource=await evidence(join(base,'standard-final-'+row.family+'-'+row.level+'.json'));}
 const inputProof=await readJson(review+'/S8/isolated-inputs-summary.json');if(inputProof.model.sha256===(await evidence(rawPath)).sha256){inputProof.originalModelPath=inputProof.model.path;inputProof.model=await evidence(rawPath);await save(review+'/S8/isolated-inputs-summary.json',inputProof);}
}
assert.equal(sha(JSON.stringify(worldPlayerInputs(model))),numeric);
const encode=(value:any)=>'{\n'+Object.entries(value).map(([key,v])=>'  '+JSON.stringify(key)+': '+(Array.isArray(v)&&['rows','knobs','points','parity','stages'].includes(key)?'[\n'+v.map(row=>'    '+JSON.stringify(row)).join(',\n')+'\n  ]':JSON.stringify(v))).join(',\n')+'\n}\n';
await writeFile(data+'/spine-player.json',encode(model));
for(const name of ['build-knobs','stat-weights'])await writeFile(data+'/'+name+'.json',encode(await readJson(data+'/'+name+'.json')));
const proof={...stamp(),worldSummarySha256:sha(JSON.stringify(world)),originalPlayerSha256:world.playerSha256,numericInputsSha256:numeric,changedOnly:'删除parity.buildSource原始构筑、增加原始路径、紧凑排版；所有数值不变',currentModel:await evidence(data+'/spine-player.json')};await save(sidecar,proof);const localSidecar=pointer.summary.replace(/world-summary\.json$/,'model-compat-summary.json');if(resolve(localSidecar)!==resolve(sidecar))await save(localSidecar,proof);
const flow=await readJson(data+'/spine-flow.json');flow.playerSha256=sha(JSON.stringify(model));flow.modelMetadataProof=sidecar;await save(data+'/spine-flow.json',flow);
await save(review+'/S9/model-pack-summary.json',{...stamp(),models:await Promise.all(['spine-player','build-knobs','stat-weights'].map(n=>evidence(data+'/'+n+'.json'))),numericInputsUnchanged:true,worldProof:await evidence(sidecar)});console.log(JSON.stringify({numericInputsUnchanged:true,modelsPacked:3}));
