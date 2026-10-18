import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {root} from './runtime.mjs';
// Explicit registration repair, never a routine "accept whatever changed" build step.
const path=resolve(root,'assets/starsea/scenes/manifest.json'),manifest=JSON.parse(await readFile(path,'utf8')),updates=[],files=new Map();
for(const asset of manifest.assets.filter(a=>a.type==='map')){
 const content=JSON.parse(await readFile(resolve(root,'packages/content/starsea/maps',asset.id+'.json'),'utf8')),sourceBytes=await readFile(resolve(root,asset.source.path)),source=JSON.parse(sourceBytes),publicPath='apps/web/public'+asset.runtime.file,publicBytes=await readFile(resolve(root,publicPath));
 assert.equal(sourceBytes.compare(publicBytes),0,'Render source and published map differ: '+asset.id);
 for(const key of ['width','height','groundResource','backdropResource','obstacles','roads','decorations','boundary'])assert.deepEqual(source[key],content[key],'Geometry/material mismatch '+asset.id+'/'+key);
 const sha256=createHash('sha256').update(sourceBytes).digest('hex');files.set(asset.source.path,{sha256,bytes:sourceBytes.length});files.set(publicPath,{sha256,bytes:publicBytes.length});
 if(asset.source.sha256!==sha256)updates.push({id:asset.id,path:asset.source.path,previousSha256:asset.source.sha256,sha256,bytes:sourceBytes.length,geometryAndMaterialsUnchanged:true,landmarksDifferFromContent:JSON.stringify(source.landmarks)!==JSON.stringify(content.landmarks)});
}
function sync(value){if(!value||typeof value!=='object')return;const info=files.get(value.path);if(info&&typeof value.sha256==='string'){value.sha256=info.sha256;if(Object.hasOwn(value,'bytes'))value.bytes=info.bytes;}for(const item of Object.values(value))sync(item);}
sync(manifest);await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
const folder=resolve(root,'.design/open-world-m0');await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'map-metadata-repair.json'),JSON.stringify({date:'2026-10-06',updates,limits:['No map coordinates, collision, decoration, material or image was changed','One pre-existing wind landmark difference is recorded; its existing source/public files were preserved','Resource acceptance flags and historical ledger were not changed']},null,2));console.log(JSON.stringify({updated:updates.length,geometryAndMaterialsUnchanged:true}));
