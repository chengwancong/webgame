/** 对照已重测的输入，确认隔离副本只排除了制作迁移，没有改变本期战斗样本。 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {standardState,resolvePlayer,referencePlayer} from './player.ts';
import {pacingProfiles} from '../pacing/profiles.ts';
import {contentItems} from './content.ts';
import {readJson,save,data,sha,stamp,evidence} from './io.ts';
const sourceReview=process.argv[2];if(!sourceReview)throw Error('需要原始评审目录');
const model=await readJson(data+'/spine-player.json'),matched:any[]=[],mismatches:any[]=[];
const normalized=(v:any):any=>Array.isArray(v)?v.map(normalized):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,normalized(v[k])])):v;
function check(label:string,current:any,prior:any){const a={level:current.level,skillRanks:current.skillRanks,build:current.build},b={level:prior.level,skillRanks:prior.skillRanks,build:prior.build};if(JSON.stringify(normalized(a))!==JSON.stringify(normalized(b)))mismatches.push({label,current:sha(JSON.stringify(normalized(a))),prior:sha(JSON.stringify(normalized(b)))});else matched.push(label);}
assert.equal(sha(await readFile('packages/simulation/index.ts')),model.engineSha256,'战斗引擎变动，不能复用样本');
for(const point of model.points){const prior=await readJson(point.localSource.path??point.localSource);check('standard-'+point.level,resolvePlayer('fresh',standardState(point.level)),prior.inputs.player);}
for(const p of pacingProfiles){const prior=await readJson(sourceReview+'/S8/measurement-repair/validation-builds/arms/'+p.id+'.json');check(p.id,referencePlayer(p.id).player,prior.inputs.player);}
for(const item of await contentItems()){const pair=item.make();for(const [kind,current] of [['full',pair.full],['without',pair.base]] as const){const prior=await readJson(sourceReview+'/S8/measurement-repair/validation-budget/budget/arms/content-'+item.id+'-'+kind+'.json');check(item.id+'/'+kind,current,prior.inputs.player);}}
const result={...stamp(),scope:resolve('.'),matched:matched.length,mismatches,engineUnchanged:true,model:await evidence(data+'/spine-player.json'),sourceReview};await save(sourceReview+'/S8/isolated-inputs-summary.json',result);console.log(JSON.stringify({matched:matched.length,mismatches}));if(mismatches.length)process.exitCode=1;
