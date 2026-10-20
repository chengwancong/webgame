import {readFile,writeFile,mkdir} from 'node:fs/promises';import {dirname,resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import ts from 'typescript';
export const toolsDir=dirname(fileURLToPath(import.meta.url)),root=resolve(toolsDir,'../../..'),publicRoot=join(root,'apps/web/public'),out=join(publicRoot,'art/starsea/pets/v3'),evidence=join(root,'.design/pet-sp33-rollout'),sample=join(root,'.design/pet-dragon-claude-20261018'),library='G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine';
export const sha=b=>createHash('sha256').update(b).digest('hex');export const rel=p=>p.replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/','');
export async function json(p,v){await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');}export async function readJSON(p){return JSON.parse(await readFile(p,'utf8'));}
export async function note(text){const p=join(root,'docs/pets/pa6-progress.md');let old='';try{old=await readFile(p,'utf8');}catch{}await writeFile(p,old+'\n'+text+'\n');}
let binaryCache;export async function binarySource(){return binaryCache??=(async()=>ts.transpileModule(await readFile(join(root,'tools/vendor/spine36/SkeletonBinary.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.None,removeComments:false}}).outputText)();}
