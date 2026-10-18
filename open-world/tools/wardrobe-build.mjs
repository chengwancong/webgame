// Reproducible deploy packaging from checked-in selected source assets.
// Does not require the owner's D: source tree, Spine installation, or credentials.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {exportMotion} from './wardrobe-sampler.mjs';
import {loadWeaponSockets} from './wardrobe-sockets.mjs';
const root=resolve(import.meta.dirname,'..'),assetRoot=join(root,'assets/wardrobe'),publicRoot=join(root,'apps/web/public/art/wardrobe'),registry=join(root,'packages/asset-manifest');
const selection=JSON.parse(await readFile(join(assetRoot,'selection.json'),'utf8')),catalog=JSON.parse(await readFile(join(registry,'wardrobe-catalog.json'),'utf8')),manifest=JSON.parse(await readFile(join(registry,'wardrobe.json'),'utf8'));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
const sockets=await loadWeaponSockets(assetRoot,manifest.shippedSets);if(sockets.weaponSocketConfigSha256!==manifest.weaponSocketConfigSha256)throw Error('Weapon socket manifest stale; reimport registry');
for(const dir of [publicRoot,join(publicRoot,'sets'),join(publicRoot,'poses'),join(publicRoot,'previews')])await mkdir(dir,{recursive:true});
for(const setId of manifest.shippedSets){const record=catalog.sets.find(s=>s.setId===setId&&s.shipped);if(!record)throw Error('Unregistered bundle '+setId);await mkdir(join(publicRoot,'sets',setId),{recursive:true});for(const [part,metadata]of Object.entries(record.parts)){const src=join(assetRoot,'sets',setId,part+'.png');const bytes=await readFile(src);if(hash(bytes)!==metadata.sha256)throw Error('Canonical asset hash mismatch '+setId+'/'+part);await copyFile(src,join(publicRoot,'sets',setId,part+'.png'));}await copyFile(join(assetRoot,'previews',setId+'.png'),join(publicRoot,'previews',setId+'.png'));}
for(const [family,metadata]of Object.entries(manifest.motions)){const source=family==='axe'?'ax':family,bytes=await readFile(join(assetRoot,'source',source+'.json'));if(hash(bytes)!==metadata.sourceSha256)throw Error('Canonical skeleton hash mismatch '+family);const motion=exportMotion(JSON.parse(bytes),family,30,selection.motionTiming?.[family]??{}),packed=Buffer.from(JSON.stringify(motion));if(hash(packed)!==metadata.sha256)throw Error('Motion manifest stale, reimport assets: '+family);await writeFile(join(publicRoot,'poses',family+'.json'),packed);}
await writeFile(join(publicRoot,'catalog.json'),JSON.stringify(catalog)+'\n');await writeFile(join(publicRoot,'manifest.json'),JSON.stringify(manifest)+'\n');console.log('Packaged '+manifest.shippedSets.length+' modular hero bundles and '+Object.keys(manifest.motions).length+' real motion families from canonical project assets.');
for(const [url,metadata]of Object.entries(manifest.styleAssets??{})){const name=url.split('/').pop(),src=join(assetRoot,'stylized',name),bytes=await readFile(src);if(hash(bytes)!==metadata.sha256)throw Error('Canonical style override hash mismatch '+name);await mkdir(join(publicRoot,'stylized'),{recursive:true});await copyFile(src,join(publicRoot,'stylized',name));}
