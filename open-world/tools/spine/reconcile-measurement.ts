import assert from 'node:assert/strict';
import {worldPlayerInputs} from './legacy.ts';
import {readJson,save,review,data,sha,stamp,evidence} from './io.ts';
const basePath=review+'/S8/measurement-repair/before/tools/spine/data/spine-player.json.snapshot',before=await readJson(basePath),after=await readJson(data+'/spine-player.json'),oldProjection=worldPlayerInputs(before),newProjection=worldPlayerInputs(after),world=await readJson(review+'/S7/correction-2/world/world-summary.json');
assert.deepEqual(newProjection,oldProjection,'其他主干数值变化，不得复用V3世界/日程/野外证据');
const original=structuredClone(before);if(original.measuredVersions){original.versions=original.measuredVersions;delete original.measuredVersions;delete original.versionBridge;}
assert.equal(sha(JSON.stringify(original)),world.playerSha256,'世界输入来源不匹配');
await save(review+'/S8/measurement-repair/world-input-compat-summary.json',{...stamp(),originalPlayerSha256:world.playerSha256,unchangedInputsSha256:sha(JSON.stringify(newProjection)),currentPlayer:await evidence(data+'/spine-player.json'),originalPlayer:await evidence(basePath),projection:newProjection,changedOnly:['B3','测量版本/来源/说明元数据'],basis:'世界推导仅消费D1/EHP，怪物曲线额外消费DN/hp/armor。13点和10平价配置的所有非B3实测逐值相等。未重新写游戏数值。'});
const flow=await readJson(data+'/spine-flow.json');flow.versions=after.versions;flow.playerSha256=sha(JSON.stringify(after));flow.measurementBridge={source:review+'/S8/measurement-repair/world-input-compat-summary.json',unchangedInputsSha256:sha(JSON.stringify(newProjection))};await save(data+'/spine-flow.json',flow);
console.log(JSON.stringify({unchangedPoints:after.points.length,unchangedParity:after.parity.length,worldInputsUnchanged:true}));
