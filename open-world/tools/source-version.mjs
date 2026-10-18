import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {root} from './runtime.mjs';
export async function sourceVersion({diagnostics=false}={}){
 const files=[];
 // QA and runtime directories may also sit under apps/web; their generated builds are not source.
 async function scan(dir){for(const item of await readdir(dir,{withFileTypes:true})){if(['node_modules','dist','public','.qa','.runtime'].includes(item.name)||item.isSymbolicLink())continue;const path=join(dir,item.name);if(item.isDirectory())await scan(path);else if(item.isFile())files.push(path);}}
 for(const dir of ['apps','packages','tests','tools'])await scan(join(root,dir));
 for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json'])files.push(join(root,file));
 const h=createHash('sha256'),fingerprints={};for(const path of files.sort()){const bytes=await readFile(path),name=relative(root,path);h.update(name);h.update('\0');h.update(bytes);h.update('\0');if(diagnostics)fingerprints[name]=createHash('sha256').update(bytes).digest('hex');}
 return {sha256:h.digest('hex'),file_count:files.length,scope:'Application, packages, tests, tools and dependency lock; excludes generated assets, builds, QA and runtime outputs',...(diagnostics?{fingerprints}:{})};
}
