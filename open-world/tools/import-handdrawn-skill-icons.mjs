// Deterministic production import: retain generated originals, normalize transparent
// canvas dimensions, then publish through the existing transactional UI builder.
import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {skillCatalog} from '../packages/content/index.ts';
const root=resolve('assets/ui-source/v2'),folder=resolve(root,'skill-handdrawn'),records=[];
const onlyAt=process.argv.indexOf('--only'),only=onlyAt<0?undefined:new Set((process.argv[onlyAt+1]??'').split(',').filter(Boolean));
if(only&&(!only.size||[...only].some(id=>!skillCatalog.some(s=>s.id===id))))throw Error('Unknown or empty skill icon selection');
const priorPath=resolve(folder,'provenance.json'),prior=JSON.parse(await readFile(priorPath,'utf8').catch(error=>{if(error.code==='ENOENT')return '{"records":[]}';throw error;}));
const generation=JSON.parse(await readFile(resolve(folder,'generation-rs-20261006.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return '[]';throw error;}));
await mkdir(folder,{recursive:true});
for(const skill of skillCatalog.filter(s=>!only||only.has(s.id))){
 const original=resolve(folder,'originals','skill-'+skill.id+'.png'),bytes=await readFile(original),meta=await sharp(bytes).metadata();
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0;
 for(let i=3;i<raw.data.length;i+=4)if(raw.data[i]===0)transparent++;
 if(transparent<raw.info.width*raw.info.height*.02)throw Error('Icon lacks a transparent background: '+skill.id);
 const content=await sharp(bytes).trim({threshold:2}).resize(208,208,{fit:'inside',withoutEnlargement:false}).ensureAlpha().png().toBuffer();
 const normalized=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:content,gravity:'centre'}]).png().toBuffer();
 const file='skill-handdrawn/skill-'+skill.id+'.png';await writeFile(resolve(root,file),normalized);
 const generated=generation.find(g=>g.id===skill.id);
 records.push({...prior.records.find(r=>r.id===skill.id),id:skill.id,name:skill.name,category:skill.category,file,originalSize:[meta.width,meta.height],originalSha256:createHash('sha256').update(bytes).digest('hex'),sha256:createHash('sha256').update(normalized).digest('hex'),size:[256,256],...(generated?{generation:'built-in imagegen',prompt:generated.prompt,generatedSource:generated.path,placeholder:false}:{})});
}
if(new Set(records.map(r=>r.sha256)).size!==records.length)throw Error('Duplicate production skill artwork');
const manifestPath=resolve(root,'ui-source.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const replacements=new Map(records.map(r=>['skill-'+r.id,{id:'skill-'+r.id,kind:'skill',file:r.file,size:r.size}]));
manifest.assets=manifest.assets.filter(a=>!replacements.has(a.id));manifest.assets.push(...replacements.values());manifest.version='2.3';
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const merged=new Map((prior.records??[]).map(r=>[r.id,r]));for(const r of records)merged.set(r.id,r);
await writeFile(priorPath,JSON.stringify({...prior,style:'approved hand-drawn signs',normalization:'transparent trim, proportional resampling, consistent 256px canvas',records:[...merged.values()]},null,2)+'\n');
console.log(JSON.stringify({icons:records.length,unique:records.length,size:[256,256],manifest:manifestPath}));
