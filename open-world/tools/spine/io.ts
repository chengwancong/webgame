import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {versions} from '../../packages/contracts/index.ts';
export const review='docs/reviews/numeric-spine-20261013',data='tools/spine/data';
export const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
export async function save(path:string,value:unknown){await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,null,path.endsWith('-summary.json')?undefined:2)+'\n');}
export const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export const stamp=()=>({versions,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),seeds:[41,42,43]});
export async function evidence(path:string){return {path:resolve(path),sha256:sha(await readFile(path))};}
export async function decision(problem:string,ruling:string,files:string,reviewRoot=review){const path=reviewRoot+'/decisions.md',old=await readFile(path,'utf8');if(!old.includes('| '+problem+' |'))await writeFile(path,old+`| ${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})} | ${problem} | ${ruling} | ${files} |\n`);}
