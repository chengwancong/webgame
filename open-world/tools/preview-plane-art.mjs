import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import sharp from 'sharp';
import {planeAssets,promptFor} from '../assets/open-world/plane-kits-spec.mjs';
const root=resolve(import.meta.dirname,'..'),kit=process.argv[2]??'cave',dir=join(root,'docs/reviews/plane-art-20261018/contact-sheets');await mkdir(dir,{recursive:true});
const items=planeAssets.filter(a=>a.kit===kit&&!a.baseId&&a.kind!=='spine-fx').flatMap(a=>a.states.map(s=>promptFor(a,s)));
for(let start=0;start<items.length;start+=12){const layers=[],page=items.slice(start,start+12);for(const [i,p]of page.entries()){const x=(i%4)*320,y=Math.floor(i/4)*290;try{const thumb=await sharp(join(root,p.output)).resize(304,250,{fit:'contain',background:'#f3efdf'}).png().toBuffer();layers.push({input:thumb,left:x+8,top:y+6});}catch(e){if(e.code!=='ENOENT'&&!e.message.includes('Input file is missing'))throw e;}const label=p.id.replace('ow-art-plane-','')+' / '+p.state;layers.push({input:Buffer.from(`<svg width="320" height="30"><text x="8" y="20" font-size="13" fill="#304048">${label}</text></svg>`),left:x,top:y+258});}await sharp({create:{width:1280,height:Math.ceil(page.length/4)*290,channels:4,background:'#f3efdf'}}).composite(layers).png().toFile(join(dir,`${kit}-${start/12+1}.png`));}
await writeFile(join(dir,`${kit}-index.json`),JSON.stringify(items.map(({id,state,output})=>({id,state,output})),null,2)+'\n');console.log(`${kit}：${items.length}张，${Math.ceil(items.length/12)}页离线联系表`);
