import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../../..'),base=join(root,'assets/starsea/props'),report=JSON.parse(await readFile(join(root,'assets/starsea/integration/evidence/isolated-review.json'),'utf8')),manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));
assert.equal(report.ok,true);const own=report.assets.filter(a=>a.group==='props');assert.equal(own.length,24);const files=[];
for(const asset of manifest.assets){const row=own.find(a=>a.id===asset.id);assert(row);assert.deepEqual(row.checks.map(c=>c.state),Object.keys(asset.runtime.states));for(const file of asset.files){const b=await readFile(join(root,file.path)),sha256=createHash('sha256').update(b).digest('hex');assert.equal(sha256,file.sha256);files.push({path:file.path,sha256});}}
const result={passed:true,version:manifest.version,designVersion:manifest.designVersion,producer:'props_integration',rootAcceptance:'pending',ids:own.map(a=>a.id),stateCount:own.reduce((n,a)=>n+a.checks.length,0),runtimeHashes:Object.fromEntries(manifest.assets.map(a=>[a.id,createHash('sha256').update(JSON.stringify(a.runtime)).digest('hex')])),files,actualBrowserReport:'assets/starsea/integration/evidence/isolated-review.json',viewport:[1280,720],limitations:manifest.limitations};
await mkdir(join(base,'evidence'),{recursive:true});await writeFile(join(base,'evidence/producer-review.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,props:24,states:result.stateCount,rootAcceptance:'pending'}));
