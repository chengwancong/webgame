import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sha,save,readJson,data,review,stamp} from './io.ts';
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
 let budget;const final=await readJson(data+'/spine-final-validation.json').catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;return null;});
 if(final){try{budget=await readJson(final.root+'/budget/audit-summary.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'||!final.localRoot)throw e;budget=await readJson(final.localRoot+'/budget/audit-summary.json');}}
 if(!budget)try{budget=await readJson(review+'/S7/V3/budget/audit-summary.json');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;try{budget=await readJson(review+'/S7/V2/budget/audit-summary.json');}catch{budget=await readJson(review+'/S7/V1/budget/audit-summary.json');}}
 const stability=await readJson(data+'/spine-measurement-stability.json').catch((e:NodeJS.ErrnoException)=>{if(e.code!=='ENOENT')throw e;return null;}),measurementFailures=stability?.aggregate.filter((r:any)=>!Number.isFinite(r.error)||Math.abs(r.error)>=.02)??[];
 const result={...stamp(),drift,sourcePassed:drift.length===0,budget:budget.counts,measurementFailures,passed:drift.length===0&&budget.counts.outside===0&&measurementFailures.length===0};await save(output+'/check-summary.json',result);return result;
}
