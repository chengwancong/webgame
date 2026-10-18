import {readFile,readdir,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
const docs=resolve('../docs/05-art/equipment-icons-handdrawn-20261001'),raw=resolve('assets/ui-source/v2/equipment-handdrawn-originals');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=JSON.parse(await readFile(resolve(docs,'catalog/with-primal.json'),'utf8')),records=[];
for(const file of (await readdir(docs)).filter(f=>/^generated-.*\.json$/.test(f)).sort()){
 const data=JSON.parse(await readFile(resolve(docs,file),'utf8'));
 for(const record of Array.isArray(data)?data:data.records??[])records.push({...record,recordFile:file});
}
// The two final helmet edits used their previous revision as an edit target.
const previous=JSON.parse(await readFile(resolve(docs,'generated-main-primal-t3.json'),'utf8')).records;
const snapshots=new Map();await mkdir(resolve(raw,'revisions'),{recursive:true});
for(const direction of ['hammer','staff']){
 const id=`gear-primal-${direction}-t3-helmet`,record=previous.find(r=>r.id===id),target=resolve(raw,'revisions',id+'-v1.png');
 await copyFile(record.generatedPath,target);snapshots.set(id,target);
}
const output=[];
for(const item of catalog.items){
 const originalPath=resolve(raw,item.id+'.png'),sha256=hash(await readFile(originalPath));let chosen;
 for(const record of records.filter(r=>r.id===item.id)){
  const generatedPath=record.generatedPath??record.source;if(!generatedPath)continue;
  if(hash(await readFile(generatedPath))===sha256)chosen=record;
 }
 if(!chosen)throw Error('No matching imagegen provenance for '+item.id);
 const attempt=chosen.attempts?.findLast(a=>a.generatedPath===chosen.generatedPath);
 let prompt=chosen.actualPrompt??chosen.finalPrompt??chosen.prompt,job;
 if(!prompt){
  let source=chosen.promptSource.split('#')[0];
  const path=source.startsWith('docs/')?resolve('..',source):source.startsWith('batches/')?resolve(docs,source):resolve(source);
  job=JSON.parse(await readFile(path,'utf8')).jobs.find(j=>j.id===item.id);
  prompt=job.prompt+(attempt?.promptAppendix??chosen.promptSuffix??'');
 }
 const references=chosen.finalReferences??chosen.references??attempt?.references??job?.references??[job?.reference];
 if(!prompt||references.some(ref=>!ref))throw Error('Incomplete final prompt for '+item.id);
 const replayReferences=references.map(ref=>chosen.recordFile==='generated-main-final-refinement.json'&&basename(ref)===item.id+'.png'&&snapshots.has(item.id)?snapshots.get(item.id):ref);
 output.push({id:item.id,generator:'built-in imagegen',originalPath,sha256,generatedPath:chosen.generatedPath??chosen.source,recordFile:chosen.recordFile,prompt,references,replayReferences});
}
await writeFile(resolve(docs,'production-provenance.json'),JSON.stringify({iconCount:output.length,setCount:54,items:output},null,2)+'\n');
console.log(JSON.stringify({icons:output.length,prompts:output.length,output:resolve(docs,'production-provenance.json')}));
