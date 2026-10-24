/** JSON差量写入层。每文件必须由调用模块传入真实schema；没有schema就拒绝写入。 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename,unlink,realpath} from 'node:fs/promises';
import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const spineJsonWritableFiles=new Set([
 'packages/content/aspects.json','packages/content/set-effects.json',
 'packages/content/gear-affixes.json','packages/content/deep-progression.json','packages/content/inscriptions.json',
 'packages/content/monsters.json','packages/content/elite-affixes.json','packages/content/dungeons.json',
 'packages/content/world-tiers.json','packages/content/progression-curve.json',
 'apps/api/src/stage-key-pools.json','apps/api/src/field-loot.json','apps/api/src/hex-loot.json',
 'packages/content/skill-coefficients.json','packages/content/skill-costs.json','packages/content/progression-node-values.json',
 'packages/content/spine-rate-limits.json',
 'packages/content/hex-runes.json','packages/content/hex-policy.json','packages/content/progression-challenges.json',
]);
export type SpineChange={file:string;path:(string|number)[];before:unknown;after:unknown;basis:string;op?:'append'|'add'};
export type SpineSchemas=Record<string,{parse:(value:unknown)=>unknown}>;
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
function pathValue(value:any,path:(string|number)[]){
 let current=value;
 for(const key of path){if(current===null||typeof current!=='object'||!Object.hasOwn(current,key))throw Error('未知路径 '+path.join('.'));current=current[key];}
 return current;
}
function validJson(value:unknown){const check=(v:unknown):void=>{if(['undefined','function','symbol','bigint'].includes(typeof v))throw Error('配置值不可序列化');if(typeof v==='number'&&!Number.isFinite(v))throw Error('配置数值必须有限');if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('配置包含危险字段');check(x);}}};check(value);return JSON.stringify(value);}
export function prepareSpinePlan(sources:Record<string,unknown>,changes:readonly SpineChange[],schemas:SpineSchemas){
 const next=structuredClone(sources),paths=new Set<string>();
 const appendFiles=new Set(changes.filter(c=>c.op==='append').map(c=>c.file));
 for(const c of changes){
  if(!spineJsonWritableFiles.has(c.file)||!schemas[c.file])throw Error('配置不在白名单或没有真实schema：'+c.file);
  if(!c.path.length||c.path.some(k=>typeof k==='string'?['__proto__','constructor','prototype'].includes(k):!Number.isSafeInteger(k)||k<0))throw Error('配置路径无效');
  if(!c.basis.trim())throw Error('每项变更必须有实测/推导依据');
  if(c.op!==undefined&&c.op!=='append'&&c.op!=='add')throw Error('未知配置操作');
  if(appendFiles.has(c.file)&&c.op!=='append')throw Error('追加内容不可同时修改已有条目');
  const key=c.file+'/'+JSON.stringify(c.path);if(paths.has(key))throw Error('同一路径重复写入');paths.add(key);
  if(c.op==='add'){
   if(c.file!=='packages/content/progression-challenges.json'||c.path.length!==1||c.path[0]!=='seasons'||c.before!==null||Object.hasOwn(next[c.file] as object,'seasons'))throw Error('仅允许新增未存在的赛季日程');
   validJson(c.after);(next[c.file] as any).seasons=structuredClone(c.after);continue;
  }
  if(c.op==='append'){
   const hex=c.file==='packages/content/hex-runes.json'&&c.path.length===1,dungeon=c.file==='packages/content/dungeons.json'&&c.path.length===2&&c.path[0]==='definitions';
   const catalogue=dungeon?(next[c.file] as any).definitions:next[c.file];
   if((!hex&&!dungeon)||!Array.isArray(catalogue)||c.path.at(-1)!==catalogue.length||c.before!==null)throw Error('仅允许在海克斯目录或副本定义末尾追加新身份');
   validJson(c.after);catalogue.push(structuredClone(c.after));continue;
  }
  if(validJson(pathValue(next[c.file],c.path))!==validJson(c.before))throw Error('写前值已变化：'+key);
  validJson(c.after);const parent=pathValue(next[c.file],c.path.slice(0,-1));parent[c.path.at(-1)!]=structuredClone(c.after);
 }
 for(const file of new Set(changes.map(c=>c.file))){
  schemas[file].parse(next[file]);
  const original=sources[file] as any,changed=next[file] as any;
  for(const [before,after] of [[original,changed],...['templates','definitions','pools'].map(key=>[original?.[key],changed?.[key]])]){
   if(Array.isArray(before)&&before.every(v=>v&&typeof v==='object'&&'id' in v)){
    if(appendFiles.has(file)){
     if(!Array.isArray(after)||after.length<=before.length||validJson(after.slice(0,before.length))!==validJson(before))throw Error('追加内容不得改动原条目');
     continue;
    }
    if(!Array.isArray(after)||JSON.stringify(before.map(v=>v.id))!==JSON.stringify(after.map(v=>v.id)))throw Error('不得删除、合并或替换内容身份：'+file);
   }
  }
 }
 return next;
}
export async function applySpinePlan(root:string,changes:readonly SpineChange[],schemas:SpineSchemas,options:{apply?:boolean;output:string}){
 const base=await realpath(root),files=[...new Set(changes.map(c=>c.file))],sources:Record<string,unknown>={},bytes:Record<string,Buffer>={};
 for(const file of files){
  if(!spineJsonWritableFiles.has(file))throw Error('拒绝白名单之外的文件：'+file);
  const target=await realpath(resolve(base,file)),rel=relative(base,target);
  if(rel.startsWith('..')||isAbsolute(rel))throw Error('拒绝越界路径或链接：'+file);
  bytes[file]=await readFile(target);sources[file]=JSON.parse(bytes[file].toString('utf8'));
 }
 const next=prepareSpinePlan(sources,changes,schemas),output=resolve(base,options.output);
 const evidence=relative(base,output).split(/[\\/]/);
 if(evidence[0]!=='docs'||evidence[1]!=='reviews'||!['numeric-spine-20261013','roguelike-removal-20261024'].includes(evidence[2])||evidence.includes('..'))throw Error('变更证据必须留在本期评审目录');
 await mkdir(output,{recursive:true});
 await writeFile(resolve(output,'changes.md'),'# 主干配置变更\n\n'+(options.apply?'申请应用，结果见apply-result.json。':'只推导，未应用。')+'\n\n| 文件 | 路径 | 前 | 后 | 依据 |\n|---|---|---|---|---|\n'+changes.map(c=>`| ${c.file} | ${c.path.join('.')} | ${validJson(c.before)} | ${validJson(c.after)} | ${c.basis.replaceAll('|','/').replaceAll('\n',' ')} |`).join('\n')+'\n');
 if(!options.apply)return {applied:false,files};
 const commits=execFileSync('git',['log','--format=%H','--grep=pacing-identity:'],{cwd:base,encoding:'utf8',windowsHide:true});
 assert(commits.trim(),'硬阻塞6：三期尚未提交，禁止应用数值');
 const temporary=new Map<string,string>(),written:string[]=[],result:{applied:boolean;files:string[];rollbackConflicts:string[]}={applied:false,files:[],rollbackConflicts:[]};
 try{
  for(const file of files){
   assert.equal(digest(await readFile(resolve(base,file))),digest(bytes[file]),'推导后内容变化：'+file);
   const tmp=resolve(dirname(resolve(base,file)),'.spine-'+randomUUID()+'.tmp');temporary.set(file,tmp);
   await writeFile(tmp,JSON.stringify(next[file],null,2)+'\n',{flag:'wx'});
  }
  for(const file of files){assert.equal(digest(await readFile(resolve(base,file))),digest(bytes[file]),'提交前内容变化：'+file);await rename(temporary.get(file)!,resolve(base,file));temporary.delete(file);written.push(file);}
  result.applied=true;result.files=written;return result;
 }catch(error){
  for(const file of written.reverse()){
   const current=await readFile(resolve(base,file)),expected=JSON.stringify(next[file],null,2)+'\n';
   if(digest(current)!==digest(expected)){result.rollbackConflicts.push(file);continue;}
   await writeFile(resolve(base,file),bytes[file]);
  }
  throw error;
 }finally{
  for(const tmp of temporary.values())await unlink(tmp).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await writeFile(resolve(output,'apply-result.json'),JSON.stringify(result,null,2)+'\n');
 }
}
