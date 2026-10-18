import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

// The RS commit was deliberately staged without unrelated, already present
// working changes. Reconstruct the accepted executable snapshot by checking
// every source against the fingerprints committed with its RS acceptance.
const root=process.cwd(),destination=path.join(root,'.qa/r1-rs-reference');
const archivePath='docs/reviews/build-variety-r1-20261006/frames-77/reference-source.json.gz';
// Keep the complete reference reproducible after later batches change the
// shared, originally uncommitted dependencies.
let archived;
try{archived=JSON.parse(gunzipSync(await readFile(archivePath)));}catch(error){if(error.code!=='ENOENT')throw error;}
if(archived){
 for(const entry of archived.files){if(!/^(packages|config)\//.test(entry.file)||entry.file.split('/').includes('..'))throw Error('Invalid reference source path');const bytes=Buffer.from(entry.base64,'base64');if(sha256(bytes)!==entry.sha256)throw Error('Corrupt reference source '+entry.file);await mkdir(path.dirname(path.join(destination,entry.file)),{recursive:true});await writeFile(path.join(destination,entry.file),bytes);}
 await writeFile(path.join(destination,'package.json'),'{"type":"module"}\n');await writeFile(path.join(destination,'provenance.json'),JSON.stringify(archived.provenance,null,2)+'\n');console.log(JSON.stringify({destination,restoredFiles:archived.files.length,commit:archived.provenance.commit}));exitSuccess();
}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
function exitSuccess(){process.exit(0);}
const evidence=JSON.parse(gunzipSync(await readFile('docs/reviews/build-variety-rs-20261006/fx/result.json.gz')));
const backups=JSON.parse(await readFile('.runtime/build-variety-work/r1/files.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const compatibility={
 'packages/contracts/index.ts':'Pre-R1 backup retains subsequent M1 protocol additions; executable attribute and skill calculations are separately fingerprinted against RS.',
 'packages/rules/starsea.ts':'Later quest runtime; fixture has no starsea progress and performs no quest commands.',
 'packages/asset-manifest/open-world-five.v1.json':'Later art manifest, outside attribute and combat calculations.',
 'packages/asset-manifest/open-world.v1.json':'Later art manifest, outside attribute and combat calculations.'
};
const manifest={commit:'19112f9',acceptance:'docs/reviews/build-variety-rs-20261006/fx/result.json.gz',files:[],compatibility:[],missing:[]};
await mkdir(destination,{recursive:true});
for(const dir of ['packages/contracts','packages/content','packages/rules','packages/simulation','packages/asset-manifest','config/json'])await cp(dir,path.join(destination,dir),{recursive:true,filter:source=>!source.split(path.sep).includes('node_modules')});
for(const [nativePath,expected] of Object.entries(evidence.sourceBefore.fingerprints)){
 const file=nativePath.replaceAll('\\','/');
 if(!['packages/','config/json/'].some(prefix=>file.startsWith(prefix)))continue;
 let bytes=await readFile(file),origin='unchanged RS working dependency';
 if(sha(bytes)!==expected){
  const entry=backups[file];
  if(entry?.copy){const backup=await readFile('.runtime/build-variety-work/r1/'+entry.copy);if(sha(backup)===expected){bytes=backup;origin='verified pre-R1 backup';}}
  if(sha(bytes)!==expected){
   try{const git=execFileSync('git',['show','19112f9:open-world/'+file],{maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});if(sha(git)===expected||sha(Buffer.from(git.toString().replaceAll('\n','\r\n')))===expected){bytes=git;origin='RS commit';}}catch{}
  }
 }
 if(sha(bytes)!==expected&&origin!=='RS commit'){
  if(!compatibility[file]){manifest.missing.push({file,expected,actual:sha(bytes)});continue;}
  const entry=backups[file];if(entry?.copy)bytes=await readFile('.runtime/build-variety-work/r1/'+entry.copy);
  origin='documented compatibility dependency';manifest.compatibility.push({file,reason:compatibility[file],sha256:sha(bytes),acceptedSha256:expected});
 }
 await mkdir(path.dirname(path.join(destination,file)),{recursive:true});
 await writeFile(path.join(destination,file),bytes);
 manifest.files.push({file,origin,sha256:sha(bytes),acceptedSha256:expected});
}
await writeFile(path.join(destination,'package.json'),'{"type":"module"}\n');
await writeFile(path.join(destination,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
if(!manifest.missing.length){
 const files=[];
 async function collect(dir){for(const entry of await readdir(path.join(destination,dir),{withFileTypes:true})){if(entry.name==='node_modules')continue;const file=dir+'/'+entry.name;if(entry.isDirectory())await collect(file);else{const bytes=await readFile(path.join(destination,file));files.push({file,sha256:sha(bytes),base64:bytes.toString('base64')});}}}
 await collect('packages');await collect('config');await mkdir(path.dirname(archivePath),{recursive:true});await writeFile(archivePath,gzipSync(Buffer.from(JSON.stringify({provenance:manifest,files}))));
}
console.log(JSON.stringify({destination,verified:manifest.files.length-manifest.compatibility.length,compatibility:manifest.compatibility,missing:manifest.missing}));
if(manifest.missing.length)process.exitCode=1;
