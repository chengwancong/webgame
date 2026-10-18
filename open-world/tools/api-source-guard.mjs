import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {spawn} from 'node:child_process';

// Import the real API dependency graph without opening a server or database.
// The entry file is syntax checked separately, since importing it would start it.
export async function validateApiSource(root){
 const script=`import ts from 'typescript';import {readFile} from 'node:fs/promises';
 const file='apps/api/src/main.ts',code=await readFile(file,'utf8');
 const result=ts.transpileModule(code,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}});
 const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw Error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=>String.fromCharCode(10)}));
 await import('./apps/api/src/app.ts');`;
 return new Promise(resolve=>{
  const processCheck=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let diagnostics='',finished=false;
  const done=value=>{if(finished)return;finished=true;clearTimeout(timeout);resolve(value);};
  const timeout=setTimeout(()=>{processCheck.kill();done({ok:false,diagnostics:'API import validation timed out'});},20000);
  for(const stream of [processCheck.stdout,processCheck.stderr])stream.on('data',bytes=>{diagnostics=(diagnostics+bytes.toString()).slice(-6000);});
  processCheck.once('error',error=>done({ok:false,diagnostics:error.message}));
  processCheck.once('exit',code=>done({ok:code===0,diagnostics:diagnostics.trim()}));
 });
}

// Vite reloads the frontend; the API must reload the same shared contracts/content.
// Exclude frontend assets and tools so producing artwork does not interrupt play.
const dependencies=['apps/api/src','packages/contracts','packages/content','packages/rules','packages/simulation'];
export async function apiSourceSignature(root){
 const files=[];
 async function scan(folder){
  for(const item of await readdir(folder,{withFileTypes:true})){
   if(item.isSymbolicLink()||['node_modules','dist'].includes(item.name))continue;
   const path=join(folder,item.name);
   if(item.isDirectory())await scan(path);else if(item.isFile()&&/\.(?:ts|json)$/.test(item.name))files.push(path);
  }
 }
 for(const folder of dependencies)await scan(join(root,folder));
 const hash=createHash('sha256');for(const file of files.sort()){hash.update(relative(root,file));hash.update('\0');hash.update(await readFile(file));hash.update('\0');}
 return hash.digest('hex');
}
export class ApiSourceGuard{
 constructor(signature){this.loaded=signature;this.pending=undefined;}
 // Wait for two identical observations before restarting during a batch of edits.
 changed(signature){
  if(signature===this.loaded){this.pending=undefined;return false;}
  if(signature===this.pending)return true;
  this.pending=signature;return false;
 }
}
