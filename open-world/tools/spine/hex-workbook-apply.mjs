// Narrow artifact-authored D12 workbook promotion. No XLSX cells are authored here.
import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const arg=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw Error('Missing '+name);return process.argv[i+1];};
const dir=resolve('.runtime/hex-b07-workbooks-20261021'),metaPath=process.argv.includes('--source-info')?resolve(arg('--source-info')):resolve(dir,'source-info.json'),meta=JSON.parse(await readFile(metaPath,'utf8'));
const allowed=new Set(['任务','对话','NPC'].map(name=>resolve('config/excel/'+name+'.xlsx'))),hash=v=>createHash('sha256').update(v).digest('hex');
if(meta.records.length<1||meta.records.length>3||new Set(meta.records.map(r=>resolve(r.source))).size!==meta.records.length)throw Error('Expected one to three distinct authorized workbooks');
const audit=JSON.parse(execFileSync(arg('--python'),[arg('--checker'),metaPath],{encoding:'utf8',windowsHide:true}));
const work=[];
for(const record of meta.records){
 const source=resolve(record.source),staged=resolve(record.staged);if(!allowed.has(source)||dirname(staged)!==dir)throw Error('Workbook target outside approved scope');
 const before=await readFile(source),after=await readFile(staged),check=audit.find(a=>resolve(a.source)===source);
 if(hash(before)!==record.sha256||!check||check.errors.length||check.sourceSha256!==hash(before)||check.stagedSha256!==hash(after))throw Error('Source changed or preservation audit failed');
 work.push({source,before,after,tmp:resolve(dirname(source),'.hex-'+randomUUID()+'.tmp')});
}
const written=[];
try{
 for(const w of work)await writeFile(w.tmp,w.after,{flag:'wx'});
 for(const w of work){if(hash(await readFile(w.source))!==hash(w.before))throw Error('Concurrent workbook edit');await rename(w.tmp,w.source);written.push(w);}
}catch(e){
 for(const w of written.reverse())if(hash(await readFile(w.source))===hash(w.after)){await writeFile(w.tmp,w.before,{flag:'wx'});await rename(w.tmp,w.source);}
 throw e;
}finally{for(const w of work)await unlink(w.tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
const result={applied:true,at:new Date().toISOString(),audit,changes:meta.records.map(r=>({source:r.source,changes:r.changes}))};
const report=process.argv.includes('--report')?resolve(arg('--report')):resolve(dir,'apply-result.json');
if(dirname(report)!==dir)throw Error('Report outside evidence directory');
await writeFile(report,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({applied:true,files:work.map(w=>w.source),preserved:audit.every(r=>r.unrelatedCellsPreserved)}));
