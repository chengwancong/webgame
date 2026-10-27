import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
/** Explicit allowlist: never archive the original art tree or a workspace symlink. */
export function pixelArtUploadPlan(publicRoot,committedManifest){
 const manifestPath=path.join(publicRoot,'art-pixel/manifest.json');
 if(!fs.existsSync(manifestPath))return {available:false,files:[],images:0,bytes:0,complete:false};
 const text=fs.readFileSync(manifestPath,'utf8');
 if(committedManifest!==undefined&&text.trim()!==committedManifest.trim())throw Error('Pixel manifest differs from the committed release');
 const manifest=JSON.parse(text),files=new Map();
 const add=(url,expected)=>{
  if(typeof url!=='string'||!/^\/art-pixel\/[a-zA-Z0-9_./:-]+$/.test(url)||url.includes('..')||url.includes(':'))throw Error('Unsafe pixel asset upload path');
  const relative=url.slice(1),file=path.resolve(publicRoot,relative),real=fs.realpathSync(file),base=fs.realpathSync(path.join(publicRoot,'art-pixel'))+path.sep;
  if(!real.startsWith(base)||fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('Pixel asset escapes upload root: '+url);
  const contents=fs.readFileSync(file),sha256=createHash('sha256').update(contents).digest('hex');if(expected&&expected!==sha256)throw Error('Pixel asset hash differs: '+url);
  files.set(relative,{path:relative,sha256,bytes:contents.length});
 };
 add('/art-pixel/manifest.json');add(manifest.palette);add('/art-pixel/palette.png');
 for(const file of manifest.metadataFiles??[])add(file);
 for(const [key,asset] of Object.entries(manifest.assets??{})){
  if(!asset.provenance?.reviewed||!['authored-pixels','adapted-pixels'].includes(asset.provenance.method))throw Error('Unreviewed pixel asset '+key);
  if(!/^[0-9a-f]{64}$/.test(asset.sha256))throw Error('Missing pixel asset hash '+key);add(asset.file,asset.sha256);
 }
 const list=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
 return {available:true,files:list,images:list.filter(f=>/\.(png|webp)$/.test(f.path)).length,bytes:list.reduce((n,f)=>n+f.bytes,0),complete:manifest.complete===true};
}
