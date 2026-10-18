import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {boot,group,root,library,sharp,json,record,pixels,sha} from './pipeline.mjs';
const ctx=await boot();let hero;
try{await ctx.page.goto(ctx.base+'/render');hero=await ctx.page.evaluate(async()=>{const {createHero}=await import('/art/starsea/pets/sources/hero-preview.js');const h=await createHero();return h.render(0).toDataURL();});}finally{await ctx.close();}
await writeFile(join(group,'evidence/hero-native.png'),Buffer.from(hero.split(',')[1],'base64'));
const references=[];
for(const id of ['ss-mon-dock-scavenger','ss-mon-wind-hound']){
 const base=join(root,'apps/web/public/art/starsea/monsters',id),p=JSON.parse(await readFile(join(base,'profile.json'),'utf8')),a=JSON.parse(await readFile(join(base,'actor.json'),'utf8')),f=a.frames[p.actions.idle.frames[0]],b=f.frame;
 const buf=await sharp(join(base,'actor.png')).extract({left:b.x,top:b.y,width:b.w,height:b.h}).png().toBuffer();await writeFile(join(group,'evidence',id+'-native.png'),buf);references.push({id,profile:p,files:await Promise.all(['profile.json','actor.json','actor.png'].map(f=>record(join(base,f))))});
}
const sample=[];for(const file of ['hero-native.png','ss-mon-dock-scavenger-native.png']){
 const {data,info}=await sharp(join(group,'evidence',file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),map=new Map();
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*4,[r,g,b,a]=data.subarray(i,i+4);if(a>245&&r>=g&&g>=b&&r>=24&&r<105&&g<83&&b<70){const key='#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');const p=map.get(key)??{color:key,count:0,x,y};p.count++;map.set(key,p);}}
 sample.push({file,candidates:[...map.values()].sort((a,b)=>b.count-a.count).slice(0,16)});
}
await json(join(group,'evidence/outline-pixel-samples.json'),sample);
const composites=[];let refX=20;for(const file of ['hero-native.png','ss-mon-dock-scavenger-native.png','ss-mon-wind-hound-native.png']){const im=await sharp(join(group,'evidence',file)).trim().resize({height:360}).png().toBuffer(),m=await sharp(im).metadata();composites.push({input:im,left:refX,top:20});refX+=m.width+40;}
await sharp({create:{width:refX,height:410,channels:4,background:'#f5f1e7'}}).composite(composites).png().toFile(join(group,'evidence/style-reference.png'));
const parts=[],cells=[];let i=0;
for(const stage of ['a','c','d']){const base=join(library,'guaiD1'+stage,'pic','guaiD1'+stage);for(const file of (await readdir(base)).filter(f=>f.endsWith('.png')).sort()){
 const path=join(base,file),meta=await sharp(path).metadata(),img=await sharp(path).resize(meta.width*3,meta.height*3,{kernel:'nearest'}).png().toBuffer();
 const left=i%4*256,top=Math.floor(i/4)*256;
 cells.push({input:img,left:left+Math.floor((256-meta.width*3)/2),top:top+16+Math.floor((210-meta.height*3)/2)});
 parts.push({index:i,stage,name:file.replace('.png',''),original:await record(path),width:meta.width,height:meta.height,cell:{left,top,width:256,height:256}});i++;
}}
const labels=Buffer.from('<svg width="1024" height="1024">'+parts.map(p=>`<text x="${p.cell.left+128}" y="${p.cell.top+248}" text-anchor="middle" font-family="Arial" font-size="18" fill="#45352b">${p.stage}/${p.name}</text>`).join('')+'</svg>');
await sharp({create:{width:1024,height:1024,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([...cells,{input:labels,left:0,top:0}]).png().toFile(join(group,'evidence/original-parts.png'));
await json(join(group,'sources/parts-index.json'),parts);await json(join(group,'sources/references.json'),references);
// Freeze PA1 files excluding the explicitly writable repaint subtree.
async function walk(dir){let files=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name==='repaint')continue;const p=join(dir,entry.name);if(entry.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const frozen=[];for(const dir of [join(root,'assets/starsea/pets'),join(root,'apps/web/public/art/starsea/pets')])for(const path of await walk(dir)){if(path.includes('evidence'))continue;frozen.push({path,sha256:sha(await readFile(path))});}await json(join(group,'evidence/pa1-before.json'),frozen);
console.log(JSON.stringify(sample,null,2));console.log('parts',parts.length,'frozen PA1',frozen.length);
