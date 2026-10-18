import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {windExpansionVersion,windExpansionRequired} from '../assets/open-world/wind-expansion-spec.mjs';
const root=resolve(import.meta.dirname,'..'),read=async path=>JSON.parse(await readFile(join(root,path),'utf8')),manifest=await read('assets/open-world/manifest.json'),errors=[],checks=[],files=new Map();
const assets=manifest.assets.filter(a=>a.expansion===windExpansionVersion),ids=new Set();
for(const asset of manifest.assets){if(ids.has(asset.id))errors.push('Duplicate resource ID '+asset.id);ids.add(asset.id);}
for(const asset of assets){try{
 for(const file of asset.files){if(!files.has(file.path))files.set(file.path,createHash('sha256').update(await readFile(join(root,file.path))).digest('hex'));if(files.get(file.path)!==file.sha256)throw Error('Hash drift '+file.path);}
 const r=asset.runtime;
 if(asset.kind==='sprite'){const {data,info}=await sharp(join(root,'apps/web/public'+r.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(!r.anchor?.every(Number.isFinite)||!(r.displayWidth>0))throw Error('Invalid pivot/scale');for(let x=0;x<info.width;x++)if(data[x*4+3]||data[((info.height-1)*info.width+x)*4+3])throw Error('Nontransparent top/bottom border');for(let y=0;y<info.height;y++)if(data[(y*info.width)*4+3]||data[(y*info.width+info.width-1)*4+3])throw Error('Nontransparent side border');}
 if(asset.kind==='actor'&&r.kind==='atlas'){const atlas=await read('apps/web/public'+r.atlas),sockets=await read('apps/web/public'+r.sockets),m=await sharp(join(root,'apps/web/public'+r.image)).metadata();for(const name of ['idle','move','attack','hurt','death','skill']){const action=r.actions[name];if(!action?.frames.length||sockets.actions[name]?.length!==action.frames.length)throw Error('Missing full frames/sockets '+name);for(const frame of action.frames){const box=atlas.frames[frame]?.frame;if(!box||box.x<0||box.y<0||box.x+box.w>m.width||box.y+box.h>m.height)throw Error('Atlas frame outside image '+frame);}}}
 if(asset.kind==='actor'&&r.kind==='native'){const p=await read('apps/web/public'+r.profile),rig=await read('apps/web/public'+p.runtime.json),skins=new Set(rig.skins.map(s=>s.name));for(const skin of p.skinNames)if(!skins.has(skin))throw Error('Missing native skin '+skin);for(const weapon of Object.values(p.weapons))for(const action of Object.values(weapon.actions))if(!rig.animations[action.name])throw Error('Missing native animation '+action.name);if(!rig.skeleton.spine.startsWith('4.2.'))throw Error('Unverified native version');}
 if(asset.kind==='actor'&&!['native','atlas'].includes(r.kind))throw Error('Unknown actor renderer '+r.kind);
 checks.push({id:asset.id,passed:true});
 }catch(error){checks.push({id:asset.id,passed:false});errors.push(asset.id+': '+error.message);}}
const counts=Object.fromEntries(Object.keys(windExpansionRequired).map(key=>[key,assets.filter(a=>a.category===key).length]));for(const [key,required]of Object.entries(windExpansionRequired))if(counts[key]!==required)errors.push(key+' '+counts[key]+'/'+required);
if(assets.length!==22||manifest.assets.length!==92)errors.push('Expected original70 + explicit22 wind additions');if(manifest.gameplayIntegrated!==false)errors.push('This check cannot claim production gameplay integration');
const report={passed:!errors.length,version:windExpansionVersion,counts,uniqueFiles:files.size,checks,errors,sourceOnly:true,browserReviewed:false};await mkdir(join(root,'docs/reviews/open-world-m2-m4/W4'),{recursive:true});await writeFile(join(root,'docs/reviews/open-world-m2-m4/W4/wind-art-files.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts,files:files.size,errors}));if(errors.length)process.exitCode=1;
