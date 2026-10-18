// Technical packing only: preserves original generated PNGs and alpha in art-assets/.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=fileURLToPath(new URL('..',import.meta.url)),source=join(root,'art-assets'),out=join(root,'apps/web/public/art/chapters');mkdirSync(out,{recursive:true});
const input=JSON.parse(readFileSync(join(source,'source.json'),'utf8'));
const actors={},scenes={},fx={};
for(const asset of input.assets){
 const path=resolve(source,asset.file);if(!path.startsWith(source+ '\\')&&!path.startsWith(source+'/'))throw Error('Invalid source path');
 const bytes=readFileSync(path),sha256=createHash('sha256').update(bytes).digest('hex'),meta=await sharp(bytes).metadata();
 if(asset.kind==='scene'){
  copyFileSync(path,join(out,asset.id+'.png'));await sharp(bytes).resize(256,256,{fit:'cover'}).png().toFile(join(out,asset.id+'-thumb.png'));
  scenes[asset.id]={path:'/art/chapters/'+asset.id+'.png',size:[meta.width,meta.height],sha256,source:asset.file,status:'illustration-ready'};
 }else{
  if(!meta.hasAlpha)throw Error('Boss sheet must have alpha: '+asset.id);
  const frames={},cell=384,actions={idle:2,move:2,attack:2,skill:2,hurt:2,death:2};
  // Normalizes the sheet to the declared grid; never synthesizes extra animation frames.
  await sharp(bytes).resize(cell*4,cell*3,{fit:'fill'}).png().toFile(join(out,asset.id+'.png'));
  for(const [a,action] of Object.keys(actions).entries())for(let i=0;i<2;i++){const n=a*2+i,x=n%4*cell,y=Math.floor(n/4)*cell;frames[action+'_'+i]={frame:{x,y,w:cell,h:cell},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:cell,h:cell},sourceSize:{w:cell,h:cell}};}
  writeFileSync(join(out,asset.id+'.json'),JSON.stringify({frames,meta:{image:asset.id+'.png',size:{w:cell*4,h:cell*3},scale:'1'}}));
  actors[asset.id]={identity:'generated-raster-'+asset.id,displayName:asset.name,anchor:[.5,.96],scale:asset.height/350,displayHeight:asset.height,nativeFacing:1,fps:4,actions,texture:'chapters/'+asset.id,source:asset.file,status:'raster-animation-preview',sha256};
 }
}
const base=JSON.parse(readFileSync(join(root,'packages/asset-manifest/catalog.json'))).actors;
const borrowed={frost_wolf:['beast','冰霜狼',64],snow_ranger:['archer','雪地游侠',128],ice_elemental:['forest-boss','冰元素',112],frost_giant:['meadow-boss','霜巨人',256],shadow_stalker:['hero','暗影潜行者',120],bone_mage:['caster','骸骨法师',128],abomination:['meadow-boss','憎恶缝合怪',192],shadow_lord:['summoner','暗影领主',160],dragon_whelp:['rift-boss','幼龙',96],dragon_guard:['assassin','龙人守卫',160],dragon_priest:['forest-boss','龙祭司',144]};
for(const [id,[old,name,height]] of Object.entries(borrowed)){const b=base[old];actors[id]={...b,displayName:name,displayHeight:height,scale:b.scale*height/(b.displayHeight??100),texture:old,status:'borrowed-animation-placeholder',source:'existing:'+old};}
const palettes={tundra:['#d7eafa','#bddcec','#83bde2'],abyss:['#292437','#3b304e','#756095'],dragonbone:['#c49655','#ddb06b','#8c6038']};
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const raster=async(file,w,h,body)=>{const bytes=await sharp(Buffer.from(svg(w,h,body))).png().toBuffer();writeFileSync(join(out,file+'.png'),bytes);return bytes;};
for(const [id,[ground,light,edge]] of Object.entries(palettes)){
 await raster(id+'-ground',128,128,`<rect width="128" height="128" fill="${ground}"/><path d="M0 34Q20 27 32 35T64 35T96 35T128 34M0 91Q20 84 32 92T64 92T96 92T128 91" fill="none" stroke="${light}" stroke-width="3"/><path d="M9 14l6 1m64 43 7-3m-43 54 6-2m64-3 6 1" stroke="${edge}" opacity=".3" stroke-width="2"/>`);
 const rock=`<path d="M32 172 12 144 38 100 90 82 148 114 166 160 121 184Z" fill="${edge}" stroke="#293040" stroke-width="4"/><path d="m38 100 36 39 16-57 58 32-45 38 63 8-45 24-18-32-29-13-62 5" fill="${light}" opacity=".55"/>`;
 let monument=id==='tundra'?`<path d="m73 184-30-43 16-96L83 9l32 68-4 80-17 27Z" fill="#74c0fc" stroke="#405e8b" stroke-width="4"/><path d="m83 9-9 111 20 64 1-105Z" fill="#ecfbff"/><path d="m43 141 31-21-15-75m15 75 41-43" stroke="#c9f1ff" stroke-width="3"/>`:id==='abyss'?`<path d="M51 176V63l33-25 34 25v113Z" fill="#342747" stroke="#9c7bc0" stroke-width="4"/><path d="m84 56 20 40-20 30-20-30Z" fill="#ab78f0"/><path d="M56 170H112" stroke="#dbc299" stroke-width="9"/><path d="M76 149Q54 120 84 90q32 32 10 59Z" fill="#ffd577"/><path d="m84 135-6-17 6-17 8 19Z" fill="#fff3c4"/>`:`<path d="m36 169-11-45 27-38 49-7 43 26 14 37-37 38Z" fill="#eddbaf" stroke="#725439" stroke-width="4"/><path d="m45 114 27-7-9 23-17 5Zm51-11 28 12-8 19-19-8Z" fill="#665139"/><path d="m24 124-9-37 34 22m97 16 17-40-32 18M72 161l9-20 11 20m-38 17 7-24m44 22-6-24" stroke="#725439" stroke-width="4" fill="#efddad"/>`;
 const arch=`<path d="M35 186V74Q85 8 135 74v112h-29V85Q85 54 64 85v101Z" fill="${edge}" stroke="${light}" stroke-width="5"/><ellipse cx="85" cy="126" rx="29" ry="57" fill="${light}" opacity=".8"/><ellipse cx="85" cy="126" rx="15" ry="38" fill="${ground}"/>`;
 const altar=`<ellipse cx="85" cy="174" rx="63" ry="17" fill="${edge}" stroke="${light}" stroke-width="3"/><path d="m47 168 10-28h55l11 28Z" fill="${light}"/><path d="M85 144Q46 112 85 51q39 61 0 93Z" fill="${id==='abyss'?'#ffe497':light}"/><path d="M85 132V72" stroke="#ffffff" stroke-width="6"/>`;
 const overlays=[];for(const [n,body] of [rock,monument,arch,altar].entries())overlays.push({input:Buffer.from(svg(176,200,body)),left:n*176,top:0});
 await sharp({create:{width:704,height:200,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(overlays).png().toFile(join(out,id+'-props.png'));
}
// Vector-authored game FX: frame counts are explicit, separate from the AI illustrations.
for(const [id,color,size,count] of [['blizzard','#b6eaff',384,16],['ritual','#ba83ff',512,20],['ultimate-charge','#ffdc6e',256,30],['danger-circle','#ff6058',320,1]]){
 const frameList=[],cols=8,rows=Math.ceil(count/cols),overlays=[];
 for(let n=0;n<count;n++){const t=n/count,a=2*Math.PI*t,r=size*(.2+.2*t),body=`<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="${color}" fill-opacity=".05" stroke="${color}" stroke-width="4"/><circle cx="${size/2}" cy="${size/2}" r="${r*.85}" fill="none" stroke="${color}" stroke-dasharray="10 8" stroke-width="2"/>`+Array.from({length:12},(_,i)=>{const angle=i*Math.PI/6+a,x=size/2+Math.cos(angle)*r,y=size/2+Math.sin(angle)*r;return `<path d="M${x-6} ${y}h12m-6-6v12" stroke="${color}" stroke-width="3"/>`;}).join('');
 const bytes=await raster(id+'_'+String(n).padStart(3,'0'),size,size,body);const folder=join(source,id==='blizzard'?'chapter4-tundra/fx':id==='ritual'?'chapter5-abyss/fx':id==='ultimate-charge'?'chapter6-dragonbone/fx':'common/ui');mkdirSync(folder,{recursive:true});writeFileSync(join(folder,id+'_'+String(n).padStart(3,'0')+'.png'),bytes);
 overlays.push({input:bytes,left:n%cols*size,top:Math.floor(n/cols)*size});frameList.push(id+'_'+String(n).padStart(3,'0')+'.png');}
 await sharp({create:{width:cols*size,height:rows*size,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(overlays).png().toFile(join(out,id+'-fx.png'));
 fx[id]={path:'/art/chapters/'+id+'-fx.png',frameSize:size,count,fps:30,status:'procedural-preview',frames:frameList};
}
writeFileSync(join(root,'packages/asset-manifest/chapters.json'),JSON.stringify({version:'chapters-20260930-v1',actors,scenes,fx},null,2)+'\n');
const travelPath=join(root,'assets/ui-source/travel/source.json'),travel=JSON.parse(readFileSync(travelPath));
for(const id of Object.keys(scenes)){copyFileSync(join(out,id+'.png'),join(root,'assets/ui-source/travel',id+'.png'));if(!travel.assets.some(a=>a.id===id))travel.assets.push({id,file:id+'.png'});}
writeFileSync(travelPath,JSON.stringify(travel,null,2)+'\n');
console.log(JSON.stringify({scenes:Object.keys(scenes).length,actors:Object.keys(actors).length,fx:Object.keys(fx).length}));
