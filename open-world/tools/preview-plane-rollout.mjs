import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {rolloutItems} from '../assets/open-world/plane-kits/rollout-spec.mjs';
const root=resolve(import.meta.dirname,'..'),batch=process.argv[2]??'R2',manifest=JSON.parse(await readFile(resolve(root,'packages/asset-manifest/open-world-planes.v1.json'),'utf8'));
const dir=resolve(root,'docs/reviews/plane-art-20261018/rollout-contact');await mkdir(dir,{recursive:true});
const groups=new Map();for(const p of rolloutItems.filter(p=>p.batch===batch)){const key=batch==='R4'?p.island:p.kit;if(!groups.has(key))groups.set(key,[]);for(const state of p.states)groups.get(key).push({p,state});}
for(const [group,items] of groups){const layers=[];for(const [i,{p,state}] of items.entries()){const a=manifest.assets.find(a=>a.id===p.id);if(a?.rolloutBatch!==batch)continue;const r=a.runtime;const png=await sharp(resolve(root,'apps/web/public'+r.stateFiles[state])).resize(180,165,{fit:'contain',background:'#363544'}).png().toBuffer();layers.push({input:png,left:i%6*200+10,top:Math.floor(i/6)*200+5});const label=`${p.island}/${p.part}/${state}`;layers.push({input:Buffer.from(`<svg width="200" height="28"><text x="100" y="18" text-anchor="middle" font-size="10" fill="#eee6d8">${label}</text></svg>`),left:i%6*200,top:Math.floor(i/6)*200+170});}const path=resolve(dir,`${batch}-${group}.png`);await sharp({create:{width:1200,height:Math.ceil(items.length/6)*200,channels:4,background:'#363544'}}).composite(layers).png().toFile(path);console.log(path);}
