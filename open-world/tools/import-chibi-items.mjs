import {readFile,writeFile,copyFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import sharp from 'sharp';
import {inspectPng,hash} from './equipment-art/common.mjs';
import {art} from '../apps/web/src/ui-assets.ts';

// Art-only import: stable item IDs and gameplay definitions remain intact.
const input=resolve('../.design/item-display-concepts-20261003');
const folder=resolve('assets/ui-source/v2/items-chibi');
const batches=(await readdir(input)).filter(name=>/^chibi-generated-batch\d+\.json$/.test(name)).sort();
const records=(await Promise.all(batches.map(async name=>JSON.parse(await readFile(join(input,name),'utf8'))))).flat();
if(records.length!==23&&!process.argv.includes('--partial'))throw Error('Expected 9 equipment and 14 inventory originals, got '+records.length);
if(new Set(records.map(r=>r.id)).size!==records.length)throw Error('Duplicate stable item ID');
await mkdir(join(folder,'originals'),{recursive:true});
const items=[],unique=new Set();
for(const r of records){
 const original=await readFile(r.path),source=await inspectPng(original,r.id);
 if(source.touchesSourceEdge)throw Error('Clipped original: '+r.id);
 const crop=await sharp(original).extract(source.bounds).resize(208,208,{fit:'inside',kernel:'lanczos3'}).png().toBuffer(),meta=await sharp(crop).metadata();
 const bytes=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left:Math.floor((256-meta.width)/2),top:Math.floor((256-meta.height)/2)}]).png().toBuffer();
 const normalized=await inspectPng(bytes,r.id,{production:true});
 if(unique.has(normalized.pixelSha256))throw Error('Duplicate visual: '+r.id);unique.add(normalized.pixelSha256);
 await copyFile(r.path,join(folder,'originals',r.id+'.png'));await writeFile(join(folder,r.id+'.png'),bytes);
 items.push({...r,previousSource:resolve('assets/ui-source/v2',art(r.id).replace('/art/ui-v2/','')),originalPath:'items-chibi/originals/'+r.id+'.png',file:'items-chibi/'+r.id+'.png',size:[256,256],sha256:hash(bytes),source,normalized});
}
const catalog={style:'user-approved-chibi-handdrawn-20261003',generator:'built-in imagegen',count:items.length,normalization:'alpha crop, Lanczos inside 208px, centered transparent 256px canvas',items};
await writeFile(join(folder,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
if(!process.argv.includes('--partial')){
 const path=resolve('assets/ui-source/v2/ui-source.json'),manifest=JSON.parse(await readFile(path,'utf8'));
 const ids=new Set(items.map(r=>r.id));manifest.assets=manifest.assets.filter(item=>!ids.has(item.id));
 manifest.assets.push(...items.map(({id,kind,file,size})=>({id,kind,file,size})));manifest.version='2.6';
 await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({ok:true,icons:items.length,unique:unique.size,folder,publishedSource:!process.argv.includes('--partial')}));
