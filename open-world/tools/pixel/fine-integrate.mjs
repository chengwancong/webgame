/** Integrate explicitly reviewed fine-art groups. Binary art is deployed as an overlay, never committed. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {root,publicRoot,candidateRoot} from './px0-art.mjs';import {checkAsset} from './check-pixel-art.mjs';import {writePixelManifest} from './write-manifest.mjs';
const work=path.join(root,'.runtime/pixel-coherence'),groups={
 characters:['heroes.json','npcs-fine.json','ui.json'],
 interfaces:['ui-icons/candidates.json','misc/misc-candidates.json','misc/atlas-candidates.json'],
 residual:['ui-residual/candidates.json'],
 chrome:['combat-chrome/candidates.json'],
 inline:['inline-svg/candidates.json'],
 terrain:['terrain-fine.json'],
 petsfx:['pets-fx/pets-candidates.json','pets-fx/fx-candidates.json'],
 scenic:['misc/scenic-candidates.json'],
 monsters:['monsters/candidates.json'],
 environment:['environment-v2/candidates.json'],
 worldstates:['world-states/candidates.json'],
};
const requested=process.argv.slice(2).filter(v=>!v.startsWith('--'));if(!requested.length||requested.some(v=>!groups[v]))throw Error('Pass explicit reviewed group names: '+Object.keys(groups).join(', '));
const file=path.join(publicRoot,'art-pixel/manifest.json'),m=JSON.parse(fs.readFileSync(file,'utf8')),next=structuredClone(m),updates=new Map();
for(const group of requested)for(const relative of groups[group]){const c=JSON.parse(fs.readFileSync(path.join(work,relative),'utf8'));for(const[key,a]of Object.entries(c.assets)){if(updates.has(key))throw Error('Overlapping candidate '+key);if(!a.provenance.reviewed)throw Error('Visual review incomplete: '+key);const issues=await checkAsset(a,{publicRoot:candidateRoot});if(issues.length)throw Error(key+': '+JSON.stringify(issues));updates.set(key,a);}}
for(const[key,a]of updates)next.assets[key]=a;
for(const[key,a]of Object.entries(next.assets))for(const layer of a.layers??[]){const b=next.assets[layer];if(!b||b.scale!==a.scale||JSON.stringify(b.frame)!==JSON.stringify(a.frame))throw Error('Mismatched actor layer '+key+' -> '+layer);}
next.canvas=[1280,720];
// Keep the upstream mapping honest: generated or GameUse replacements cannot inherit a former CC0 label.
const registryFile=path.join(root,'packages/asset-manifest/pixel-open-art.json'),registry=JSON.parse(fs.readFileSync(registryFile,'utf8'));
for(const key of Object.keys(registry.mapping))if(next.assets[key]?.provenance?.upstream?.license!=='CC0-1.0')delete registry.mapping[key];
const terrainRegistry=JSON.parse(fs.readFileSync(path.join(work,'terrain-registry-update.json'),'utf8'));
if(requested.includes('terrain'))Object.assign(registry.mapping,terrainRegistry.cc0);
for(const[key,a]of updates){const u=a.provenance.upstream;if(u?.license!=='CC0-1.0')continue;if(!registry.mapping[key])registry.mapping[key]={package:/Stealthix/.test(u.author)?'stealthixNature':/Letargic/.test(u.author)?'stoneFloor':/Duelyst/i.test(u.package)?'duelyst':u.package,files:[u.file],size:a.frame[0]};if(!registry.credits.packages.some(p=>p.author===u.author&&p.sha256===u.archiveSha256))registry.credits.packages.push({name:u.package,author:u.author,url:u.url,sha256:u.archiveSha256});}
for(const a of updates.values()){const target=path.join(publicRoot,a.file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(candidateRoot,a.file),target);}
fs.mkdirSync(path.join(work,'integration-backups'),{recursive:true});const old=fs.readFileSync(file),backup=path.join(work,'integration-backups',createHash('sha256').update(old).digest('hex')+'.json');if(!fs.existsSync(backup))fs.writeFileSync(backup,old);
await writePixelManifest(file,next,{allowInPlace:process.argv.includes('--windows-write-in-place')});
fs.writeFileSync(registryFile,JSON.stringify(registry,null,2)+'\n');fs.writeFileSync(path.join(publicRoot,'art-pixel/open-art-credits.json'),JSON.stringify(registry.credits,null,2)+'\n');
console.log(JSON.stringify({groups:requested,updated:updates.size,total:Object.keys(next.assets).length,cc0Mappings:Object.keys(registry.mapping).length}));
