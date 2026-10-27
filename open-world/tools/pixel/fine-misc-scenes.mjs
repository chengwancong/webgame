/** Native scenic illustration candidates. Route-chart borders never replace the actual route graph. */
import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
import {Pixels,root,publicRoot,candidateRoot} from './px0-art.mjs';import {checkAsset} from './check-pixel-art.mjs';
const workBase=path.join(root,'.runtime/pixel-coherence/misc'),v2=process.argv.includes('--v2'),work=v2?path.join(workBase,'v2'):workBase,m=JSON.parse(fs.readFileSync(path.join(publicRoot,'art-pixel/manifest.json'),'utf8'));
const out={schemaVersion:1,stage:[1280,720],canvas:[1280,720],palette:'/art-pixel/palette.json',assets:{}},keys=[],bossImages=[];
async function read(file){const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(info.width,info.height);data.copy(p.data);return p;}
async function save(key,p,recipe){
 const old=m.assets[key];if(!old)throw Error('Unknown live scene key '+key);const file='/art-pixel/ui-code/misc-scenes-'+(v2?'v2':'v1')+'/'+key.replaceAll(':','-').replaceAll('/','-');const target=file.endsWith('.png')?file:file+'.png';await p.save(path.join(candidateRoot,target));
 const a={...old,file:target,frame:[p.width,p.height],imageSize:[p.width,p.height],anchor:[p.width/2,p.height/2],scale:1,sha256:createHash('sha256').update(fs.readFileSync(path.join(candidateRoot,target))).digest('hex'),provenance:{method:'authored-pixels',reviewed:true,recipe:'tools/pixel/fine-misc-source.py + fine-misc-scenes.mjs; '+(v2?'V2: independently redrawn broad clean pixel clusters, approved blue/orange harbor reference and meadow representative; 38 master shades; ':'')+recipe}};
 if(old.frames){a.frames={__BASE:{x:0,y:0,w:p.width,h:p.height}};a.defaultFrame='__BASE';}
 const issues=await checkAsset(a,{publicRoot:candidateRoot});if(issues.length)throw Error(key+':'+JSON.stringify(issues));out.assets[key]=a;keys.push(key);
}
for(const region of ['wind','mist','forge','frost','rift','dragon','deep'])await save('chart-bg:'+region,await read(path.join(work,'chart-'+region+'-native.png')),'new regional border-scene draft, proper-pixel-art grid, palette/ivory-space cleanup; native900x504; actual node positions/links remain code-owned');
const bossSources={'tundra-boss':'frost-queen','abyss-boss':'abyss-lord','dragonbone-boss':'dragon'};
for(const region of ['meadow','forest','rift','tundra','abyss','dragonbone','tundra-boss','abyss-boss','dragonbone-boss']){
 const plain=await read(path.join(work,'travel-'+region+'-native.png')),boss=bossSources[region],travel=new Pixels(plain.width,plain.height);travel.stamp(plain,0,0);
 if(boss){const actor=await read(path.join(root,'.runtime/pixel-coherence/monsters/native/'+boss+'-208.png'));travel.stamp(actor,Math.floor((plain.width-actor.width)/2),plain.height-actor.height-36);bossImages.push(travel);}
 await save('supplement:travel/'+region+'.png',travel,'new scene draft preserving original landmarks; proper-pixel-art mesh and master palette; native640x360'+(boss?'; exact same native208 '+boss+' design as game, composited without enlargement':''));
 if(['tundra','abyss','dragonbone','tundra-boss','abyss-boss','dragonbone-boss'].includes(region))await save('supplement:chapters/'+region+'.png',plain,'new scene draft preserving original environment and arena; proper-pixel-art mesh and master palette; native640x360; empty combat floor (no baked duplicate Boss)');
}
fs.writeFileSync(path.join(workBase,'scenic-candidates.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(workBase,'scenic-keys.json'),JSON.stringify(keys,null,2)+'\n');if(v2){fs.writeFileSync(path.join(work,'scenic-candidates.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(work,'scenic-keys.json'),JSON.stringify(keys,null,2)+'\n');}const contact=new Pixels(640,3*360);bossImages.forEach((p,i)=>contact.stamp(p,0,i*360));await contact.save(path.join(work,'boss-card-contact.png'));console.log(JSON.stringify({candidates:keys.length,nativeCharts:7,nativeIllustrations:15,version:v2?2:1}));
