// Promote a reviewed artifact-tool workbook through a CAS/atomic spine entry point.
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
const arg=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1])throw Error('Missing '+name);return process.argv[i+1];};
const source=resolve('config/excel/任务.xlsx'),staged=resolve(arg('--staged')),metadata=JSON.parse(await readFile(arg('--source-info'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(resolve(metadata.source)!==source)throw Error('Only the task workbook is authorized');
const before=await readFile(source),after=await readFile(staged);
if(sha(before)!==metadata.sha256)throw Error('Workbook changed since authoring; reread and reapply');
const audit=JSON.parse(execFileSync(arg('--python'),[arg('--checker')],{encoding:'utf8',windowsHide:true}).trim());
if(audit.sourceSha256!==sha(before)||audit.stagedSha256!==sha(after)||audit.errors.length||audit.styleDifferenceCount)throw Error('Workbook preservation check failed');
const out=resolve('.runtime/grow03-workbook-20261020');await mkdir(out,{recursive:true});
await writeFile(resolve(out,'before.xlsx'),before,{flag:'wx'});
const tmp=resolve(dirname(source),'.spine-'+randomUUID()+'.tmp');
try{
 await writeFile(tmp,after,{flag:'wx'});
 if(sha(await readFile(source))!==sha(before))throw Error('Concurrent workbook update before commit');
 await rename(tmp,source);
}finally{await unlink(tmp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
const report={at:new Date().toISOString(),applied:true,source,beforeSha256:sha(before),afterSha256:sha(after),audit,changes:[{sheet:'步骤',range:'AC1:AD4',target:'ss-c01-t01/1',hp:680,attack:12}],scope:'Only authored encounter overrides; original workbook content/styles/notes preserved. Existing source backup kept in .runtime.'};
await writeFile(resolve(out,'apply-result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
