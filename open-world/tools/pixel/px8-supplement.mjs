/** Legacy HUD atlases and scene thumbnails discovered by the production inventory. */
import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import {collectInventory} from './inventory.ts';import {Pixels,ramps,root,publicRoot,approve} from './px0-art.mjs';import {icon} from './px8-art.mjs';import {fxFrame} from './px6-art.mjs';import {draw,terrainTile} from './px5-art.mjs';import {paint} from './px2-art.mjs';
const m=JSON.parse(fs.readFileSync(path.join(publicRoot,'art-pixel/manifest.json'),'utf8')),covered=new Set(Object.values(m.assets).flatMap(a=>a.original)),candidate={schemaVersion:1,stage:[1280,720],canvas:[640,360],palette:'/art-pixel/palette.json',assets:{}},files=new Set(collectInventory().flatMap(r=>r.paths).filter(f=>!covered.has(f)&&f.startsWith('/art/'))),chapters=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/chapters.json'),'utf8'));
const numbers=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
const glyphs={
 '连':[[2,2,4,3],[2,6,4,6],[4,6,3,12],[2,13,6,15],[6,15,16,15],[6,4,16,4],[9,2,7,8],[7,8,16,8],[7,11,17,11],[12,4,12,14]],
 '斩':[[1,4,9,4],[4,2,2,8],[2,8,9,8],[1,11,9,11],[6,4,6,16],[11,5,16,2],[11,5,11,12],[11,12,9,16],[11,8,17,8],[15,8,15,16]],
 '横':[[1,6,6,6],[4,2,4,16],[4,7,1,12],[4,8,7,11],[8,4,17,4],[8,7,17,7],[11,2,11,7],[15,2,15,7],[9,9,16,9],[9,9,9,13],[16,9,16,13],[9,13,16,13],[12,8,12,13],[10,15,8,17],[14,15,17,17]],
 '扫':[[1,6,7,6],[4,2,4,16],[1,12,7,9],[4,16,2,16],[9,3,16,3],[16,3,16,15],[9,8,16,8],[9,14,16,14]],
 '无':[[4,3,14,3],[2,7,16,7],[10,4,7,12],[7,12,2,16],[10,8,10,15],[10,15,16,15],[16,15,16,12]],
 '双':[[1,3,8,3],[8,3,3,12],[3,12,1,16],[2,6,9,16],[11,3,17,3],[17,3,13,12],[13,12,9,16],[11,6,17,16]],
 '神':[[3,2,5,4],[1,6,7,6],[7,6,2,12],[5,9,8,12],[4,10,4,17],[9,4,17,4],[9,4,9,13],[17,4,17,13],[9,13,17,13],[9,8,17,8],[13,1,13,17]],
 '威':[[3,5,16,5],[3,5,3,12],[3,12,1,16],[12,2,13,10],[13,10,17,17],[17,17,17,13],[15,1,17,3],[5,8,10,8],[7,6,5,13],[5,13,11,16],[4,11,11,11],[10,10,9,14],[9,14,4,16]]};
function label(tier){const p=new Pixels(56,24),text=['连斩','横扫','无双','神威'][tier-1];for(let n=0;n<2;n++)for(const [x1,y1,x2,y2]of glyphs[text[n]]){let x=x1,y=y1,dx=Math.abs(x2-x1),dy=-Math.abs(y2-y1),sx=x1<x2?1:-1,sy=y1<y2?1:-1,e=dx+dy;while(true){p.rect(x+n*24+4,y+3,2,2,ramps.copper[0]);p.dot(x+n*24+4,y+3,ramps.copper[4]);if(x===x2&&y===y2)break;const e2=2*e;if(e2>=dy){e+=dy;x+=sx}if(e2<=dx){e+=dx;y+=sy}}}return p;}
function digit(n){const p=new Pixels(16,18);if(n==='x'){p.poly([[3,3],[13,13],[11,15],[1,5]],ramps.copper[3]);p.poly([[11,3],[13,5],[3,15],[1,13]],ramps.copper[3]);return p;}for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(numbers[Number(n)][y*3+x]==='1')p.rect(3+x*3,1+y*3,3,3,ramps.copper[3]);return p;}
function scenic(file){const p=draw('sky-'+file,'landmark',320,184),kind=/tundra/.test(file)?'frost':/abyss|rift/.test(file)?'rift':/dragon/.test(file)?'dragon':/forest/.test(file)?'mist':'wind';for(let y=112;y<184;y+=16)for(let x=0;x<320;x+=16)p.stamp(terrainTile('grass',kind),x,y);p.poly([[110,184],[210,184],[175,122],[161,112],[151,115]],ramps.earth[2]);for(const [x,y]of [[8,68],[246,80],[210,100]])p.stamp(draw(kind+'-tree','nature',64,80),x,y);p.stamp(draw(kind+'-rock','nature',40,32),58,133);return p;}
for(const file of files){
 const full=path.join(publicRoot,file),json=full.replace(/\.png$/,'.json'),a=fs.existsSync(json)?JSON.parse(fs.readFileSync(json,'utf8')):undefined,fx=Object.values(chapters.fx).find(f=>f.path===file),meta=await sharp(full).metadata();let names=a?.frames?(Array.isArray(a.frames)?a.frames.map(f=>f.filename):Object.keys(a.frames)):fx?fx.frames.map((_,i)=>String(i)):['__BASE'];
 const frames={},sourceFrames={},tiles=[];for(let n=0;n<names.length;n++){
  const name=names[n],old=Array.isArray(a?.frames)?a.frames.find(f=>f.filename===name)?.frame:a?.frames?.[name]?.frame;let p;
  if(/travel|chapters/.test(file)&&!fx)p=scenic(file);
  else if(/boss-banner/.test(file)){p=new Pixels(304,40);p.poly([[4,0],[300,0],[304,6],[304,34],[300,40],[4,40],[0,34],[0,6]],ramps.wood[0]);p.rect(4,3,296,34,/shield/.test(file)?ramps.navy[1]:ramps.fire[1]);p.rect(7,4,290,1,ramps.copper[2]);p.rect(7,35,290,1,ramps.wood[2]);}
  else if(name.startsWith('streak-tier-'))p=label(Number(name.slice(-1)));
  else if(name.startsWith('streak-digit-')||name==='streak-x')p=digit(name.split('-').at(-1));
  else if(name.startsWith('build-card-'))p=paint('ss-scene-build-'+name.split('-').at(-1)+'-4',100,64);
  else if(/hero-native-fx/.test(file)||fx||/tip-glow/.test(file))p=fxFrame(file+' '+name,n/Math.max(1,names.length-1),64);
  else p=icon(/gold-coin/.test(file)?'coin':name==='__BASE'?file:name,32);
  tiles.push(p);if(old)sourceFrames[name]=old;
 }
 const fw=Math.max(...tiles.map(t=>t.width)),fh=Math.max(...tiles.map(t=>t.height)),cols=Math.min(8,names.length),sheet=new Pixels(fw*cols,fh*Math.ceil(names.length/cols));tiles.forEach((p,n)=>{const x=n%cols*fw,y=Math.floor(n/cols)*fh;sheet.stamp(p,x,y);frames[names[n]]={x,y,w:p.width,h:p.height};});
 const key='supplement:'+file.replace('/art/',''),asset=await approve(key,sheet,{file:file.replace('/art/','/art-pixel/'),original:[file],batch:'PX8',frame:[sheet.width,sheet.height],anchor:[Math.floor(sheet.width/2),Math.floor(sheet.height/2)],recipe:'tools/pixel/px8-supplement.mjs#legacy-atlas'},candidate);asset.frames=frames;asset.sourceFrames=sourceFrames;asset.imageSize=[sheet.width,sheet.height];asset.defaultFrame=names[0];if(fx)asset.effectClips={default:{frames:fx.frames,fps:fx.fps,duration:fx.count/fx.fps}};
}
fs.writeFileSync(path.join(root,'.runtime/pixel-redraw/px8-supplement-candidates.json'),JSON.stringify(candidate,null,2)+'\n');console.log(JSON.stringify({candidates:Object.keys(candidate.assets).length}));
