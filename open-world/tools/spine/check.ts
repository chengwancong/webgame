import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sha,save,readJson,data,review,stamp} from './io.ts';
import {versions} from '../../packages/contracts/index.ts';
import {readKnownDeviations,compareKnownDeviations,type KnownDeviations} from './known-deviations.ts';
/** A separately remeasured budget must not relabel an older full validation as current.
 * Broken/stale explicit references fail closed rather than falling back to old passing reports. */
export async function readBudgetForCheck(pointerPath=data+'/spine-budget-validation.json',lockPath=data+'/spine-source-lock.json',accepted?:KnownDeviations|null){
 let pointer:any,pointerBytes:Buffer;
 try{pointerBytes=await readFile(pointerPath);pointer=JSON.parse(pointerBytes.toString('utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'&&!accepted)return null;throw error;}
 const historical=accepted&&sha(pointerBytes)===accepted.budgetReferenceSha256;
 if(pointer?.schemaVersion!==1||pointer.suite!=='budget'||typeof pointer.audit?.path!=='string'||typeof pointer.audit?.sha256!=='string')throw Error('Invalid current budget reference');
 if(historical){
  const lock=await readJson(lockPath);
  if(sha(JSON.stringify(lock.hashes))!==accepted.sourceHashesSha256||pointer.audit.sha256!==accepted.auditSha256)throw Error('Accepted budget reference does not match');
 }else{
  for(const key of ['client','protocol','rules','assets','db'] as const)if(pointer.versions?.[key]!==versions[key])throw Error('Stale current budget version: '+key);
  if(pointer.sourceLockSha256!==sha(await readFile(lockPath)))throw Error('Current budget source lock does not match');
 }
 const bytes=await readFile(pointer.audit.path);
 if(sha(bytes)!==pointer.audit.sha256)throw Error('Current budget evidence hash does not match');
 const report=JSON.parse(bytes.toString('utf8'));
 for(const key of ['client','protocol','rules','assets','db'] as const)if(report.versions?.[key]!==pointer.versions[key])throw Error('Current budget report version does not match');
 if(!Number.isInteger(report.counts?.outside)||report.counts.outside<0)throw Error('Invalid current budget counts');
 return {report,evidence:pointer,acceptedHistorical:Boolean(historical)};
}
// 仅冻结制作接入的来源；其余域发生漂移时仍须原样报告。
export const craftingSourceFiles=[
 'config/json/crafting-private.json','config/json/crafting-public.json','config/json/crafting.json','config/json/world.json',
 'packages/content/crafting.ts','packages/content/deep-progression.json','packages/content/deep-progression.ts','packages/content/equipment-runtime.ts','packages/content/open-world/production.json','packages/content/world-tables.ts',
 'packages/contracts/crafting-state.ts','packages/contracts/crafting.ts','packages/contracts/deep-progression.ts','packages/contracts/index.ts','packages/contracts/open-world.ts','packages/contracts/weapons.ts',
 'packages/rules/crafting-consumables.ts','packages/rules/crafting-gather.ts','packages/rules/crafting-migration.ts','packages/rules/crafting.ts','packages/rules/deep-progression.ts','packages/rules/index.ts','packages/rules/story-campaign.ts','packages/rules/weapon-skills.ts',
];
export async function freezeCraftingSources(output:string){
 const hashes=await numericHashes(),lock=await readJson(data+'/spine-source-lock.json');
 const changes=craftingSourceFiles.map(file=>{if(!hashes[file])throw Error('制作冻结缺少文件 '+file);return {file,before:lock.hashes[file]??null,after:hashes[file]};});
 for(const row of changes)lock.hashes[row.file]=row.after;
 lock.crafting={...stamp(),decision:'docs/crafting-k8-decision-20261015.md',files:craftingSourceFiles};
 await save(data+'/spine-source-lock.json',lock);await save(output+'/crafting-source-freeze.json',{...lock.crafting,changes});
 return {frozen:true,scope:'制作域',files:changes.length};
}
export async function numericHashes(){const files:string[]=[];async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory()){if(!['node_modules','.git','.qa','dist'].includes(entry.name))await walk(path);}else if(/\.(ts|json)$/.test(entry.name)&&!entry.name.includes('appearance'))files.push(path);}}for(const dir of ['packages/content','packages/rules','packages/contracts','packages/simulation','config/json'])await walk(dir);files.push('apps/api/src/stage-key-pools.json','apps/api/src/field-loot.json');return Object.fromEntries(await Promise.all(files.sort().map(async file=>[file,sha(await readFile(file))])));}
export async function checkSpine(output=review+'/S9',freeze=false){
 const hashes=await numericHashes();if(freeze){await save(data+'/spine-source-lock.json',{...stamp(),hashes});return {frozen:true,files:Object.keys(hashes).length};}
 const lock=await readJson(data+'/spine-source-lock.json'),drift=[...new Set([...Object.keys(hashes),...Object.keys(lock.hashes)])].filter(file=>lock.hashes[file]!==hashes[file]).map(file=>({file,before:lock.hashes[file]??null,after:hashes[file]??null}));
 const baseline=await readKnownDeviations(lock);
 const currentBudget=await readBudgetForCheck(undefined,undefined,baseline);let budget=currentBudget?.report;
 const final=budget?null:await readJson(data+'/spine-final-validation.json').catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;return null;});
 if(final){try{budget=await readJson(final.root+'/budget/audit-summary.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'||!final.localRoot)throw e;budget=await readJson(final.localRoot+'/budget/audit-summary.json');}}
 if(!budget)try{budget=await readJson(review+'/S7/V3/budget/audit-summary.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;try{budget=await readJson(review+'/S7/V2/budget/audit-summary.json');}catch{budget=await readJson(review+'/S7/V1/budget/audit-summary.json');}}
 const stabilityBytes=await readFile(data+'/spine-measurement-stability.json').catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT'||baseline)throw e;return null;});
 const stability=stabilityBytes?JSON.parse(stabilityBytes.toString('utf8')):null,measurementFailures=stability?.aggregate.filter((r:any)=>!Number.isFinite(r.error)||Math.abs(r.error)>=.02)??[];
 const historicalStability=Boolean(baseline&&stabilityBytes&&sha(stabilityBytes)===baseline.stabilitySha256);
 if(baseline&&!historicalStability){
  for(const key of ['client','protocol','rules','assets','db'] as const)if(stability?.versions?.[key]!==versions[key])throw Error('Stale stability evidence: '+key);
 }
 if(baseline){
  if(!stability.source?.path)throw Error('Missing stability source');
  const bytes=await readFile(stability.source.path);
  if(sha(bytes)!==stability.source.sha256)throw Error('Stability evidence hash does not match');
  const source=JSON.parse(bytes.toString('utf8'));
  for(const key of ['client','protocol','rules','assets','db'] as const)if(source.versions?.[key]!==stability.versions?.[key])throw Error('Stability source version does not match');
  if(JSON.stringify(source.aggregate)!==JSON.stringify(stability.aggregate))throw Error('Stability aggregate does not match source');
 }
 const regression=baseline?compareKnownDeviations(baseline,budget.rows,stability.aggregate):null;
 const numericalWithinTargets=budget.counts.outside===0&&measurementFailures.length===0;
 const result={...stamp(),drift,sourcePassed:drift.length===0,gateMode:baseline?'accepted-baseline-regression':'absolute',numericalWithinTargets,
  ...(baseline?{acceptedBaseline:lock.knownDeviations,measurementVersions:baseline.measurementVersions,acceptedHistoricalEvidence:{budget:currentBudget?.acceptedHistorical??false,stability:historicalStability},regressions:regression!.regressions}:{}),
  budget:budget.counts,...(currentBudget?{budgetEvidence:currentBudget.evidence}:{}),measurementFailures,passed:drift.length===0&&(regression?regression.passed:numericalWithinTargets)};
 await save(output+'/check-summary.json',result);return result;
}
