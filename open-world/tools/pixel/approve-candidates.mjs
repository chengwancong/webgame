import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkAsset,checkManifest} from './check-pixel-art.mjs';
import {writePixelManifest} from './write-manifest.mjs';
const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const [input,...args]=process.argv.slice(2),keys=args[0]==='--keys-file'?JSON.parse(fs.readFileSync(args[1],'utf8')):args;if(!input||!Array.isArray(keys)||!keys.length)throw Error('Pass the candidate file followed by explicitly reviewed resource keys');
const candidate=JSON.parse(fs.readFileSync(input,'utf8')),file=path.join(root,'apps/web/public/art-pixel/manifest.json');
const candidateRoot=path.join(root,'.runtime/pixel-redraw/candidates'),candidateFiles=new Set(keys.map(key=>candidate.assets[key]?.file).filter(f=>f&&fs.existsSync(path.join(candidateRoot,f))));
const manifest=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{...candidate,assets:{},complete:false};
for(const key of keys){
 const asset=candidate.assets[key];if(!asset)throw Error('Unknown candidate '+key);
 const reviewed={...asset,provenance:{...asset.provenance,reviewed:true}};
 const issues=await checkAsset(reviewed,{candidateRoot,candidateFiles});if(issues.length)throw Error(key+': '+JSON.stringify(issues));manifest.assets[key]=reviewed;
}
for(const [key,value] of Object.entries(candidate.appearances??{}))if(manifest.assets['wardrobe:'+key]){manifest.appearances??={};manifest.appearances[key]=value;}
manifest.metadataFiles=[...new Set([...(manifest.metadataFiles??[]),...(candidate.metadataFiles??[])])];
if(candidate.canvas)manifest.canvas=candidate.canvas;
const report=await checkManifest(manifest,{candidateRoot,candidateFiles});if(!report.ok)throw Error(JSON.stringify(report));
for(const relative of candidateFiles){const target=path.join(root,'apps/web/public',relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(candidateRoot,relative),target);}
await writePixelManifest(file,manifest);console.log(JSON.stringify({approved:keys.length,total:report.assets}));
