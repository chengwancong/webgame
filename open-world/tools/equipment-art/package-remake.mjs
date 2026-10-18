// Freeze a complete native-image remake into the importer's array-based manifest.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'../..');
const art=join(root,'assets/equipment-remake-20261003');
const plan=JSON.parse(await readFile(join(art,'production.json'),'utf8'));
const names=(await readdir(join(art,'records'))).filter(name=>name.endsWith('.json'));
const records=await Promise.all(names.map(name=>readFile(join(art,'records',name),'utf8').then(JSON.parse)));
const byId=new Map(records.map(record=>[record.id,record]));
assert.equal(plan.items.length,324);assert.equal(byId.size,324);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const items=[];
for(const item of plan.items){
 const record=byId.get(item.id);assert(record&&!record.status.startsWith('rejected'),item.id);
 assert.equal(record.generator,'built-in imagegen',item.id);
 for(const field of ['setId','direction','series','tier','slot'])assert.equal(record[field],item[field],item.id+' '+field);
 const original=await readFile(join(art,'originals',item.id+'.png'));
 const retained=await readFile(record.generatedSource);
 assert.equal(sha(original),record.originalSha256,item.id+' retained original');
 assert.equal(sha(retained),record.originalSha256,item.id+' native output');
 assert.equal(record.touchesSourceEdge,false,item.id+' clipped source');
 items.push({...item,prompt:record.prompt,references:record.references,generator:record.generator,generatedSource:record.generatedSource,nativeSourceSha256:record.originalSha256,record:'records/'+item.id+'.json'});
}
assert.equal(new Set(items.map(item=>item.nativeSourceSha256)).size,324);
const manifest={schema:'abyss-walker-equipment-native-remake-v1',createdAt:new Date().toISOString(),expectedCount:324,expectedSetCount:54,style:plan.style,slots:plan.slots,directions:Object.entries(plan.families).map(([id,family])=>({id,name:family.label})),series:Object.entries(plan.series).map(([id,series])=>({id,name:series.label})),tiers:[1,2,3],items};
const path=join(art,'delivery-manifest-r'+(plan.designRevision??1)+'.json');
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({manifest:path,icons:items.length,sets:new Set(items.map(item=>item.setId)).size,nativeUniqueSources:324,clippedSources:0}));
