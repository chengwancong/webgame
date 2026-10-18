import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {serve} from './serve.mjs';
const root=resolve(import.meta.dirname,'../../../..'),local=resolve(root,'assets/starsea/vfx'),publicRoot=resolve(root,'apps/web/public/art/starsea/vfx');
const sha=b=>createHash('sha256').update(b).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/');
const list=[
 {n:33,id:'steam',keep:['Smoke'],neutral:true},
 {n:126,id:'warm-burst'},
 {n:132,id:'interrupt',drop:'^(zi|xian)'},
 {n:136,id:'ice-burst',drop:'^ziti$'},
 {n:138,id:'ice-lance'},
 {n:150,id:'flame-jet'},
 {n:152,id:'void-burst',drop:'^(zi|xian)'},
 {n:153,id:'void-charge'},
 {n:155,id:'void-flight'},
 {n:156,id:'blade-charge'},
 {n:157,id:'blade-flight'},
 {n:158,id:'arrow-charge'},
 {n:159,id:'arrow-flight'},
 {n:164,id:'flame-burst',drop:'^(zi|xian)'},
 {n:165,id:'flame-release'},
 {n:166,id:'flame-flight'},
 {n:179,id:'beam'},
 {n:182,id:'burning'},
 {n:187,id:'ice-ground'},
 {n:188,id:'ice-wave',drop:'^(bhz|x\\d+)$'},
 {n:206,id:'slash',drop:'^zi'},
 {n:209,id:'void-cloud',drop:'^zi'},
 {n:220,id:'summon'},
 {n:237,id:'void-zone'},
 {n:242,id:'fire-rain'},
 {n:257,id:'claw',animation:'up'},
 {n:292,id:'void-impact'},
];
const only=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(','),inventory=JSON.parse(await readFile(resolve(local,'source/inventory.json'),'utf8'));
const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage();
page.on('pageerror',e=>console.log('PAGE ERROR '+e.message));
const outputFile=resolve(local,'source/clips.json');let output={};try{output=JSON.parse(await readFile(outputFile,'utf8'));}catch{}
try{await page.goto(server.origin+'/art/starsea/vfx/native-export.html');
for(const choice of list.filter(x=>!only||only.includes(x.id))){
 const original=inventory.find(i=>i.libraryIndex===choice.n),raw=JSON.parse(await readFile(original.originalPath,'utf8'));
 const removed=raw.slots.filter(s=>(choice.keep&&!choice.keep.includes(s.name))||(choice.drop&&new RegExp(choice.drop).test(s.name))).map(s=>s.name);
 raw.slots=raw.slots.filter(s=>!removed.includes(s.name));for(const skin of Object.values(raw.skins))for(const s of removed)delete skin[s];
 for(const a of Object.values(raw.animations)){if(a.slots)for(const s of removed)delete a.slots[s];delete a.drawOrder;delete a.draworder;}
 if(choice.neutral){for(const slot of raw.slots)if(slot.color)slot.color='ffffffff';for(const a of Object.values(raw.animations))for(const s of Object.values(a.slots??{}))for(const k of s.color??[])k.color='ffffff'+k.color.slice(-2);}
 const adapted=JSON.stringify(raw),dest=resolve(publicRoot,'native',original.id,choice.id+'.json');await writeFile(dest,adapted);await writeFile(resolve(local,'source',original.id,choice.id+'.json'),adapted);
 const item={...original,id:choice.id,runtimeJson:'/art/starsea/vfx/native/'+original.id+'/'+choice.id+'.json',animation:choice.animation??original.animation};
 const info=await page.evaluate(i=>nativeExport.load(i),item),frames=[],hashes=[];
 for(let n=0;n<info.frames;n++){
  const rendered=await page.evaluate(({id,time})=>nativeExport.frame(id,time),{id:item.id,time:Math.min(info.duration,n/30)}),png=Buffer.from(rendered.png.split(',')[1],'base64'),data=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=data.info;let l=width,t=height,r=-1,b=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data.data[(y*width+x)*4+3]>0){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  const empty=r<0,rect=empty?{left:0,top:0,width:1,height:1}:{left:l,top:t,width:r-l+1,height:b-t+1},trim=await sharp(png).extract(rect).png().toBuffer();
  frames.push({n,key:choice.id+'/'+n,png:trim,rect,root:rendered.root,empty});hashes.push(sha(png));
 }
 const outdir=resolve(publicRoot,'clips',choice.id);await mkdir(outdir,{recursive:true});await mkdir(resolve(local,'runtime/clips',choice.id),{recursive:true});
 const atlasWidth=2048,pad=2;let x=pad,y=pad,row=0;const atlas={frames:{},meta:{image:'clip.png',size:{w:atlasWidth,h:0},format:'RGBA8888',scale:'1'}};
 for(const f of frames){const w=f.rect.width,h=f.rect.height;if(x+w+pad>atlasWidth){x=pad;y+=row+pad*2;row=0;}f.x=x;f.y=y;atlas.frames[f.key]={frame:{x,y,w,h},rotated:false,trimmed:true,spriteSourceSize:{x:f.rect.left,y:f.rect.top,w,h},sourceSize:{w:512,h:512}};x+=w+pad*2;row=Math.max(row,h);}
 const atlasHeight=y+row+pad,composite=frames.map(f=>({input:f.png,left:f.x,top:f.y}));atlas.meta.size.h=atlasHeight;
 await sharp({create:{width:atlasWidth,height:atlasHeight,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composite).png().toFile(resolve(outdir,'clip.png'));
 await writeFile(resolve(outdir,'clip.json'),JSON.stringify(atlas));
 const png=await readFile(resolve(outdir,'clip.png')),json=await readFile(resolve(outdir,'clip.json'));await writeFile(resolve(local,'runtime/clips',choice.id,'clip.png'),png);await writeFile(resolve(local,'runtime/clips',choice.id,'clip.json'),json);
 const diagnostic={original,adaptedJson:rel(dest),adaptedSha256:sha(Buffer.from(adapted)),adoption:'native-source-layer-export; not complete original Spine animation restoration',removedSlots:removed,slotAdjustments:choice.neutral?['Preserved original alpha timeline; slot RGB changed to neutral white for steam.']:[],drawOrderPolicy:'Retain setup slot order; selected source drawOrder omitted where decorative slots were removed.',info,uniqueFrames:new Set(hashes).size,emptyFrames:frames.filter(f=>f.empty).map(f=>f.n),frameHashes:hashes};
 await writeFile(resolve(local,'evidence',choice.id+'-native.json'),JSON.stringify(diagnostic,null,2)+'\n');
 output[choice.id]={kind:'atlas',sourceMode:'native-layer-adaptation',image:'/art/starsea/vfx/clips/'+choice.id+'/clip.png',atlas:'/art/starsea/vfx/clips/'+choice.id+'/clip.json',frames:frames.map(f=>f.key),fps:30,duration:info.duration,anchor:frames[0].root.map(v=>v/512),canvas:[512,512],nativeFacing:'up',files:[{path:rel(resolve(outdir,'clip.png')),sha256:sha(png),width:atlasWidth,height:atlasHeight,alpha:true},{path:rel(resolve(outdir,'clip.json')),sha256:sha(json)}],source:diagnostic};
 console.log(JSON.stringify({clip:choice.id,frames:info.frames,unique:diagnostic.uniqueFrames,seconds:info.duration,removed:removed.length}));
 await writeFile(outputFile,JSON.stringify(output,null,2)+'\n');await writeFile(resolve(publicRoot,'clips.json'),JSON.stringify(output,null,2)+'\n');
}
}finally{await browser.close();await server.close();}
