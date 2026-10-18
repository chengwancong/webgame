import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),source=join(root,'assets/environment-handdrawn'),out=join(root,'apps/web/public/art/environment/handdrawn');
const config=JSON.parse(await readFile(join(source,'source.json'),'utf8')),hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const manifest={version:config.version,direction:config.direction,projection:[32,18],textures:{grass:'/art/environment/handdrawn/grass.png',road:'/art/environment/handdrawn/road.png',props:'/art/environment/handdrawn/props.png'},chapterGround:{tundra:'/art/environment/handdrawn/tundra.png',abyss:'/art/environment/handdrawn/abyss.png',dragonbone:'/art/environment/handdrawn/dragonbone.png'},themedProps:{tundra:{wall:'rocks',tint:0xcde1f1},abyss:{wall:'rocks',tint:0xb5a5d5},dragonbone:{wall:'rocks',tint:0xdfcbb0}},assets:[],frames:{},anchors:{oak:[.5,.96],lodge:[.5,.91],rocks:[.5,.9],portal:[.5,.92],forge:[.5,.88],lamp:[.5,.96]}};
const composites=[];
Object.assign(manifest.anchors,{cart:[.5,.93],bridge:[.5,.6],sign:[.5,.95]});
const ui=JSON.parse(await readFile(join(root,'packages/asset-manifest/ui.v2.json'),'utf8'));
manifest.reusedClues=Object.fromEntries(Object.entries({forest:'item-material-herb',rift:'item-skill-book',tundra:'item-material-awakening_crystal',abyss:'item-skill-book',dragonbone:'item-skill-book'}).map(([chapter,id])=>{const item=ui.assets[id];if(!item)throw Error('Missing approved clue art '+id);return [chapter,{id,path:item.path,sha256:item.sha256}];}));
manifest.groundByTheme={meadow:'grass',forest:'grass',rift:'dragonbone',tundra:'tundra',abyss:'abyss',dragonbone:'dragonbone'};
manifest.themedProps.rift={wall:'rocks',tint:0xe0aea0};
manifest.themes={meadow:{background:0x27443b,roadEdge:'#33552b55',roadWash:null},forest:{background:0x203d36,roadEdge:'#29443566',roadWash:null},rift:{background:0x633f3b,roadEdge:'#743f3255',roadWash:'#963e332b'},tundra:{background:0x96afc1,roadEdge:'#5c7d9266',roadWash:'#c5e0f770'},abyss:{background:0x272334,roadEdge:'#211c2caa',roadWash:'#29243599'},dragonbone:{background:0x90785b,roadEdge:'#73553f55',roadWash:'#a68a6933'}};
for(const [index,id] of ['oak','lodge','rocks','portal','forge','lamp','cart','bridge','sign'].entries()){
 const original=await readFile(join(source,'originals',id+'.png')),metadata=await sharp(original).metadata(),stats=await sharp(original).stats();
 if(!metadata.hasAlpha||stats.channels[3].min!==0||stats.channels[3].max<250)throw Error('Missing usable alpha for '+id);
 const {data,info}=await sharp(original).trim().resize({width:720,height:720,fit:'inside'}).extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer({resolveWithObject:true});
 const left=index%3*768,top=Math.floor(index/3)*768;
 composites.push({input:data,left,top});manifest.frames[id]=[left,top,info.width,info.height];
 manifest.assets.push({id,source:'assets/environment-handdrawn/originals/'+id+'.png',sourceSha256:hash(original),generation:'built-in imagegen',adjustments:['alpha trim, proportional import resize, 8px padding, atlas packing'],dimensions:[info.width,info.height]});
}
const atlas=await sharp({create:{width:2304,height:2304,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).png().toBuffer();
await writeFile(join(out,'props.png'),atlas);manifest.assets.push({id:'props-atlas',path:manifest.textures.props,sha256:hash(atlas),dimensions:[2304,2304]});
for(const id of ['grass','road','tundra','abyss','dragonbone']){
 const original=await readFile(join(source,'originals',id+'.png'));
 const bytes=await sharp(original).resize(1024,1024,{fit:'fill'}).png().toBuffer();
 await writeFile(join(out,id+'.png'),bytes);
 const {data,info}=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});let horizontal=0,vertical=0,interior=0;
 for(let i=0;i<1024;i++)for(let c=0;c<3;c++){horizontal+=Math.abs(data[(i*1024)*info.channels+c]-data[(i*1024+1023)*info.channels+c]);vertical+=Math.abs(data[i*info.channels+c]-data[(1023*1024+i)*info.channels+c]);interior+=Math.abs(data[(i*1024+511)*info.channels+c]-data[(i*1024+512)*info.channels+c]);}
 manifest.assets.push({id,path:manifest.textures[id]??manifest.chapterGround[id],sha256:hash(bytes),source:'assets/environment-handdrawn/originals/'+id+'.png',sourceSha256:hash(original),generation:'built-in imagegen',dimensions:[1024,1024],edgeMeanRgbDifference:{horizontal:horizontal/3072,vertical:vertical/3072,interior:interior/3072},status:'repeatable-texture-requires-runtime-seam-review'});
}
await writeFile(join(root,'packages/asset-manifest/environment.v2.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({version:manifest.version,independentSprites:Object.keys(manifest.frames).length,groundTextures:5,atlasBytes:atlas.length,edges:manifest.assets.filter(a=>a.edgeMeanRgbDifference).map(a=>({id:a.id,...a.edgeMeanRgbDifference}))}));

