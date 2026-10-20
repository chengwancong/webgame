import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import labels from '../../packages/content/stage-key-labels.json';
const i=process.argv.indexOf('--evidence');assert(i>=0&&process.argv[i+1],'--evidence required');
const evidence=JSON.parse(await readFile(process.argv[i+1],'utf8'));
assert(evidence.candidate&&evidence.passed&&evidence.summary.length===3&&evidence.summary.every((r:any)=>r.n===40&&r.scoreImproves===40&&r.withinUpper===40),'Candidate verification failed');
const file='apps/api/src/stage-key-pools.json',source=JSON.parse(await readFile(file,'utf8')),choice=source.pools[0].choices[0];
assert(source.pools[0].stage===1&&choice.id==='stage-1-a','Source identity changed');
const verified=evidence.pool.choice.outputs[0];
assert(verified.quality==='rare'&&verified.itemLevel===1&&verified.guaranteedOutput==='repair-tendency'&&verified.starterAttack===true,'Wrong candidate policy');
const stageName=labels.find(r=>r.id==='stage-key-fragment-1')!.name.replace(/钥匙碎片$/,'');
const basis='Claude GROW-02 fixed starter attack ruling; declared score 40/40 improvement and <=115% repaired for sword/staff/hidden; one candidate verification, no sweep.';
const changes:SpineChange[]=[
 {file,path:['pools',0,'choices',0,'outputs',0],before:choice.outputs[0],after:verified,basis},
 {file,path:['pools',0,'choices',0,'name'],before:choice.name,after:stageName+'·精工主手',basis},
 {file,path:['pools',0,'choices',0,'description'],before:choice.description,after:'钥匙兑换的精工主手，偏重输出',basis},
];
console.log(JSON.stringify(await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/GROW02-20261020'})));
