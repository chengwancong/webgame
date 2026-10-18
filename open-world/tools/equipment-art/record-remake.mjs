import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'../..'),out=join(root,'assets/equipment-remake-20261003');
const id=process.argv[2],source=process.argv[3],plan=JSON.parse(await readFile(join(out,'production.json'),'utf8'));
const planned=plan.items.find(i=>i.id===id);if(!planned)throw Error('Unknown planned equipment ID');
const requestPath=join(out,'requests',id+'.json'),item=existsSync(requestPath)?JSON.parse(await readFile(requestPath,'utf8')):planned;
if(item.id!==planned.id||item.setId!==planned.setId||item.slot!==planned.slot)throw Error('Request identity mismatch');
if(!source||!source.endsWith('.png'))throw Error('A generated PNG source is required');
const bytes=await readFile(source),meta=await sharp(bytes).metadata(),stats=await sharp(bytes).stats();
if(!meta.hasAlpha||stats.channels.length!==4||stats.channels[3].min!==0||stats.channels[3].max<250)throw Error('True usable transparency required');
const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=-1,bottom=-1;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
if(right<left)throw Error('Empty generated asset');
const bounds={left,top,width:right-left+1,height:bottom-top+1};
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(join(out,'originals'),{recursive:true});await mkdir(join(out,'icons'),{recursive:true});await mkdir(join(out,'records'),{recursive:true});
const previousPath=join(out,'records',id+'.json');
if(existsSync(previousPath)){
 const previous=JSON.parse(await readFile(previousPath,'utf8')),archive=join(out,'revisions',id);await mkdir(archive,{recursive:true});
 await copyFile(join(out,'originals',id+'.png'),join(archive,previous.originalSha256+'.png'));
 await writeFile(join(archive,previous.originalSha256+'.json'),JSON.stringify(previous,null,2));
}
const content=await sharp(bytes).extract(bounds).resize(208,208,{fit:'inside',kernel:'lanczos3'}).png().toBuffer();
const png=await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:content,gravity:'centre'}]).png().toBuffer();
await copyFile(source,join(out,'originals',id+'.png'));await writeFile(join(out,'icons',id+'.png'),png);
const record={...item,generatedSource:source,generator:'built-in imagegen',status:'generated-awaiting-visual-review',size:[256,256],sourceSize:[meta.width,meta.height],bounds,originalSha256:hash(bytes),sha256:hash(png),touchesSourceEdge:left===0||top===0||right===info.width-1||bottom===info.height-1,normalization:'alpha crop and proportional Lanczos inside 208px, centred on transparent 256px canvas'};
await writeFile(join(out,'records',id+'.json'),JSON.stringify(record,null,2));
const generated=(await readdir(join(out,'records'))).filter(p=>p.endsWith('.json')).length;console.log(JSON.stringify({id,generated,expected:324,edgeWarning:record.touchesSourceEdge,path:join(out,'icons',id+'.png')}));
