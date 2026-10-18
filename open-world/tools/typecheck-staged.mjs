import {execFileSync} from 'node:child_process';
import {relative,resolve,sep} from 'node:path';
import ts from 'typescript';
const gitRoot=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),cwd=process.cwd();
const tracked=new Set(execFileSync('git',['ls-files','-z'],{encoding:'utf8',cwd:gitRoot}).split('\0').filter(Boolean)),cache=new Map();
function repositoryPath(file){const path=relative(gitRoot,resolve(file)).split(sep).join('/');return path.startsWith('..')?undefined:path;}
function ownSource(file){const path=repositoryPath(file);return path!==undefined&&!path.split('/').includes('node_modules');}
const read=file=>{
 if(!ownSource(file))return ts.sys.readFile(file);
 const path=repositoryPath(file);if(!tracked.has(path))return undefined;
 if(!cache.has(path))cache.set(path,execFileSync('git',['show',':'+path],{cwd:gitRoot,encoding:'utf8',maxBuffer:128*1024*1024}));return cache.get(path);
};
const exists=file=>ownSource(file)?tracked.has(repositoryPath(file)):ts.sys.fileExists(file);
const configFile=ts.readConfigFile(resolve(cwd,'tsconfig.json'),read);if(configFile.error)throw Error(ts.flattenDiagnosticMessageText(configFile.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(configFile.config,{...ts.sys,readFile:read,fileExists:exists,readDirectory:(...args)=>ts.sys.readDirectory(...args).filter(exists)},cwd);
const host=ts.createCompilerHost({...parsed.options,noEmit:true});host.readFile=read;host.fileExists=exists;
host.getSourceFile=(file,languageVersion,onError)=>{try{const source=read(file);return source===undefined?undefined:ts.createSourceFile(file,source,languageVersion);}catch(error){onError?.(String(error));return undefined;}};
const program=ts.createProgram(parsed.fileNames,{...parsed.options,noEmit:true},host),diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
if(diagnostics.length){console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>cwd,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));process.exitCode=1;}
else console.log(JSON.stringify({passed:true,rootFiles:parsed.fileNames.length,stagedSourcesRead:cache.size,scope:'Git index, including JSON and dependency graph; no checkout copying or cleanup'}));
