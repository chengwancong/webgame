import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {inspectPng} from './equipment-art/common.mjs';
const base=resolve('assets/ui-source/v2'),folder=join(base,'inventory-handdrawn'),originals=join(folder,'originals');
await mkdir(originals,{recursive:true});
const promoted={tonic_attack:'tonic_attack',tonic_hp:'tonic_hp',skill_book:'book',ore:'ore',herb:'herb',leather:'leather',awakening_crystal:'resource_crystal',gold_moon:'resource_moon'};
for(const [id,file]of Object.entries(promoted))await copyFile(resolve('../.design/inventory-categories/demo-assets',file+'.png'),join(originals,id+'.png'));
const labels={tonic_attack:'攻击合剂',tonic_hp:'生命合剂',skill_book:'技能书底图',ore:'矿石',herb:'草药',leather:'皮革',character_shard:'角色碎片',omega_fragment:'方阵碎片',boss_essence:'领主精华',legendary_essence:'传说精华',gold_moon:'金月',awakening_crystal:'觉醒结晶',glyph_dust:'雕文粉尘',summon_shard:'召唤碎片'};
const records=[],pixels=new Set();
for(const [key,name]of Object.entries(labels)){
 const source=await readFile(join(originals,key+'.png')),original=await inspectPng(source,key);
 if(original.touchesSourceEdge)throw Error('Clipped inventory source '+key);
 const crop=await sharp(source).extract(original.bounds).resize(208,208,{fit:'inside',kernel:'lanczos3'}).png().toBuffer(),meta=await sharp(crop).metadata();
 const bytes=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:crop,left:Math.floor((256-meta.width)/2),top:Math.floor((256-meta.height)/2)}]).png().toBuffer();
 const normalized=await inspectPng(bytes,key,{production:true});if(pixels.has(normalized.pixelSha256))throw Error('Duplicate inventory artwork '+key);pixels.add(normalized.pixelSha256);
 await writeFile(join(folder,key+'.png'),bytes);
 const id=key==='tonic_attack'?'item-tonic-attack':key==='tonic_hp'?'item-tonic-hp':key==='skill_book'?'item-skill-book':'item-material-'+key;
 records.push({id,key,name,file:'inventory-handdrawn/'+key+'.png',kind:'item',size:[256,256],sha256:createHash('sha256').update(bytes).digest('hex'),original,normalized});
}
const sourcePath=join(base,'ui-source.json'),manifest=JSON.parse(await readFile(sourcePath,'utf8')),ids=new Set(records.map(x=>x.id));
manifest.assets=manifest.assets.filter(item=>!ids.has(item.id));manifest.assets.push(...records.map(({id,kind,file,size})=>({id,kind,file,size})));if(Number(manifest.version)<2.5)manifest.version='2.5';
await writeFile(sourcePath,JSON.stringify(manifest,null,2)+'\n');await writeFile(join(folder,'catalog.json'),JSON.stringify({count:records.length,style:'approved-handdrawn',bookRendering:'shared book base plus the associated unique skill icon',items:records},null,2)+'\n');
console.log(JSON.stringify({icons:records.length,uniquePixels:pixels.size,source:folder}));
