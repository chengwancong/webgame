import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {prepareSpinePlan} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import {loadHubOutsideNumbers} from '../../apps/api/src/hub-numbers.ts';
import type {HubRewardPlan} from './hub-reward-schema.ts';

const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const ordered=(v:any):any=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
/** Measurement identity includes the numbers deliberately omitted from the
 * immutable derivation-source fingerprint. Missing outside config is a distinct
 * pending state, never equivalent to an applied empty object. */
export async function hubRuntimeNumbersHash(){
 const paths=['packages/content/hub-chart.json','config/json/tasks.json','apps/api/src/hex-loot.json'];
 const values=await Promise.all(paths.map(async file=>{try{return [file,JSON.parse(await readFile(file,'utf8'))];}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'&&file.endsWith('hub-outside-numbers.json'))return [file,{state:'pending-file-absent'}];throw error;}}));
 return digest(JSON.stringify(ordered({...Object.fromEntries(values),resolvedHubOutsideNumbers:loadHubOutsideNumbers()})));
}
export function assertHubChangeScope(changes:HubRewardPlan['changes']){
 const seen=new Set<string>();for(const c of changes){const key=c.path.join('.');if(c.file!=='apps/api/src/hex-loot.json'||c.path.length!==3||c.path[0]!=='policy'||c.path[1]!=='sources'||!['elite','event','dungeonChest','rare'].includes(String(c.path[2])))throw Error('HUB may change only the four ordinary HEX source probabilities.');if(seen.has(key))throw Error('Duplicate HUB change path '+key);seen.add(key);for(const value of [c.before,c.after])if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)throw Error('HEX probability must be finite in [0,1].');}
}
export async function assertHubAppliedWorkbooks(planHash:string){
 const manifest=JSON.parse(await readFile('.runtime/hub-b0-b4-20261021/b4-workbooks/'+planHash+'/applied-workbooks.json','utf8'));
 const expected=['config/excel/航图.xlsx','config/excel/任务.xlsx','config/excel/港口收益.xlsx'];
 if(manifest.planHash!==planHash||!manifest.files||Object.keys(manifest.files).length!==expected.length)throw Error('Missing or stale applied workbook manifest.');
 for(const file of expected)if(manifest.files[file]!==digest(await readFile(file)))throw Error('Workbook changed since this plan was applied: '+file);
 for(const name of ['hub-chart.json','hub-outside-numbers.json']){const source=JSON.parse(await readFile('config/json/'+name,'utf8')),runtime=JSON.parse(await readFile('packages/content/'+name,'utf8'));if(JSON.stringify(ordered(source))!==JSON.stringify(ordered(runtime)))throw Error('Config/runtime mirror mismatch: '+name);}
}
/** Reuse the main spine's whitelist/schema/before-value validation while keeping
 * raw numerical before/after evidence local, as the HUB handoff requires. The
 * generic applySpinePlan hardcodes a tracked review directory and cannot serve
 * this caller without violating that boundary. */
export async function applyHubJsonChanges(changes:HubRewardPlan['changes'],output:string){
 assertHubChangeScope(changes);if(!changes.length)return;
 const base=resolve(output),rel=relative(resolve('.runtime'),base),out=resolve(base,'attempt-'+randomUUID());if(isAbsolute(rel)||rel.startsWith('..'))throw Error('HUB raw JSON evidence must stay under .runtime.');
 const file='apps/api/src/hex-loot.json',original=await readFile(file),next=prepareSpinePlan({[file]:JSON.parse(original.toString('utf8'))},changes,spineSchemas),expected=JSON.stringify(next[file],null,2)+'\n';
 await mkdir(out,{recursive:true});await writeFile(resolve(out,'before.json'),original,{flag:'wx'});await writeFile(resolve(out,'changes.json'),JSON.stringify(changes,null,2)+'\n',{flag:'wx'});
 const temporary=resolve('apps/api/src/.hub-hex-'+randomUUID()+'.tmp');let written=false;const rollback=async()=>{if(digest(await readFile(file))!==digest(expected))throw Error('HEX rollback refused: source was changed by another editor.');await writeFile(file,original);await writeFile(resolve(out,'rollback.json'),JSON.stringify({restored:true,beforeHash:digest(original)})+'\n');};
 try{await writeFile(temporary,expected,{flag:'wx'});if(digest(await readFile(file))!==digest(original))throw Error('HEX source changed during HUB preparation.');await rename(temporary,resolve(file));written=true;await writeFile(resolve(out,'apply-result.json'),JSON.stringify({applied:true,file,beforeHash:digest(original),afterHash:digest(expected)})+'\n');}
 catch(error){if(written)await rollback();throw error;}
 finally{if(!written)await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 return rollback;
}
