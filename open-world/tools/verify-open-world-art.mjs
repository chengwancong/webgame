import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const manifest=await read('assets/open-world/manifest.json'),errors=[],results=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const native=await read('assets/mini-hero/navy/runtime/Character.json'),skins=new Set(native.skins.map(s=>s.name)),ids=new Set();
for(const asset of manifest.assets){const result={id:asset.id,files:true,hashes:true,alpha:true,geometry:true,native:true};
 if(ids.has(asset.id))errors.push('Duplicate ID '+asset.id);ids.add(asset.id);
 for(const file of asset.files){try{const bytes=await readFile(join(root,file.path));if(hash(bytes)!==file.sha256){result.hashes=false;errors.push(asset.id+': hash drift '+file.path);}}catch(error){result.files=false;errors.push(asset.id+': '+error);}}
 const r=asset.runtime;if(r.file&&asset.kind!=='effect'){try{const path=join(root,'apps/web/public'+r.file),meta=await sharp(path).metadata();if(meta.width!==r.width||meta.height!==r.height){result.geometry=false;errors.push(asset.id+': dimensions mismatch');}
 if(asset.kind==='sprite'){const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x<7||y<7||x>=info.width-7||y>=info.height-7)&&data[(y*info.width+x)*4+3]!==0){result.alpha=false;break;}if(!result.alpha)errors.push(asset.id+': alpha margin is not transparent');if(!r.anchor?.every(Number.isFinite)||r.displayWidth<=0){result.geometry=false;errors.push(asset.id+': invalid foot or scale');}}
 if(asset.kind==='mask'){const {data,info}=await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});let min=255,max=0;for(let p=0;p<data.length;p+=info.channels){min=Math.min(min,data[p]);max=Math.max(max,data[p]);for(let c=1;c<info.channels;c++)if(data[p+c]!==data[p])throw Error('Mask is not grayscale');}if(min!==0||max!==255)throw Error('Mask does not cover full 0–255 blend interval');}
 }catch(error){errors.push(asset.id+': '+error);}}
 if(asset.kind==='actor'&&['outpost-npc','regional-npc'].includes(asset.category)){try{const p=await read('apps/web/public'+r.profile),actual=await read('apps/web/public'+p.runtime.json),actualSkins=new Set(actual.skins.map(s=>s.name));for(const s of p.skinNames)if(!actualSkins.has(s))throw Error('Missing skin '+s);for(const key of ['idle','move','talk','repair','hurt','death'])if(!asset.actions?.[key])throw Error('Missing actor presentation action '+key);for(const a of Object.values(asset.actions??{}))if(a.name&&!actual.animations[a.name])throw Error('Missing native clip '+a.name);for(const weapon of Object.values(p.weapons))for(const a of Object.values(weapon.actions))if(!actual.animations[a.name])throw Error('Missing native playback clip '+a.name);for(const url of [p.runtime.json,p.runtime.atlas])await readFile(join(root,'apps/web/public'+url));}catch(error){result.native=false;errors.push(asset.id+': '+error);}}
 results.push(result);
}
if(manifest.gameplayIntegrated!==false)errors.push('Resource-only package cannot claim gameplay integration');
if(manifest.pending.length&&!process.argv.includes('--allow-pending'))errors.push(manifest.pending.length+' source assets are still pending');
const report={version:manifest.version,scope:manifest.scope,passed:!errors.length,sourceAndImportOnly:true,visualReview:false,dynamicReview:false,gameplayIntegrated:false,counts:manifest.counts,pending:manifest.pending,results,errors};
await mkdir(join(root,'.design/open-world-art-first'),{recursive:true});await writeFile(join(root,'.design/open-world-art-first/file-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,...manifest.counts,errors}));if(errors.length)process.exitCode=1;

if(manifest.expansion)await import('./verify-wind-art-expansion.mjs');
