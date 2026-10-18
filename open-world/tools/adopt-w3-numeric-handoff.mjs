import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory='docs/reviews/open-world-m2-m4/W3/numeric-refresh',handoff=JSON.parse(await readFile(directory+'/handoff.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),changed=[];
const destinations=new Map();
for(const item of handoff.items){
 if(!item.formalDestination?.endsWith('.json'))continue;
 const bytes=await readFile(item.artifact.path);if(hash(bytes)!==item.artifact.sha256)throw Error('Candidate changed: '+item.item);
 const existing=destinations.get(item.formalDestination);if(existing&&hash(existing.bytes)!==hash(bytes))throw Error('Conflicting numeric candidates');
 destinations.set(item.formalDestination,{bytes,source:item.artifact.path});
}
for(const [name,source]of Object.entries(handoff.sources)){
 const actual=hash(await readFile(source.path)),adopted=destinations.get(source.path);
 if(actual!==source.sha256&&(!adopted||actual!==hash(adopted.bytes)))throw Error('Numeric handoff source changed: '+name);
}
for(const [path,{bytes,source}]of destinations){await writeFile(path,bytes);changed.push({path,source,sha256:hash(bytes)});}
await writeFile(directory+'/adoption.json',JSON.stringify({generated:new Date().toISOString(),owner:'main integration',decision:handoff.decision,changed,campBudgets:'Authored into each island workbook before its actual camp acceptance; no runtime player scaling.',tierReference:'ow-boss-dragon-3 level53; final hardmode definition authored in W9/W10'},null,2)+'\n');
console.log(JSON.stringify({changed}));
