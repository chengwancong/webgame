/** Semantic appearance thumbnails and native title tiles. Never changes a live manifest. */
import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';import {createHash} from 'node:crypto';
import wardrobe from '../../packages/asset-manifest/wardrobe.json';
import {Pixels,root,publicRoot,candidateRoot,ramps} from './px0-art.mjs';import {checkAsset} from './check-pixel-art.mjs';
const work=path.join(root,'.runtime/pixel-coherence/misc'),m=JSON.parse(fs.readFileSync(path.join(publicRoot,'art-pixel/manifest.json'),'utf8'));
const colors=Object.values(ramps).flat(),rgb=colors.map(c=>Buffer.from(c.slice(1),'hex'));
function nearest(c){const a=Buffer.from(c.slice(1),'hex');let n=0,d=Infinity;for(let i=0;i<rgb.length;i++){const b=rgb[i],v=2*(a[0]-b[0])**2+3*(a[1]-b[1])**2+(a[2]-b[2])**2;if(v<d){n=i;d=v;}}return colors[n];}
function clean(p){const a=Buffer.from(p.data);for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4;if(!a[i+3])continue;let connected=false;for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)if((j||k)&&x+k>=0&&y+j>=0&&x+k<p.width&&y+j<p.height&&a[((y+j)*p.width+x+k)*4+3])connected=true;if(!connected)p.dot(x,y,null);}return p;}
/** Rasterize simple apparel directly on each target grid, including independently readable 16px silhouettes. */
export function garmentGlyph(slot,size,ramp,backKind='empty'){
 const p=new Pixels(size,size),s=size/32,r=(x,y,w,h,c)=>p.rect(Math.round(x*s),Math.round(y*s),Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)),c),q=(a,c)=>p.poly(a.map(([x,y])=>[Math.round(x*s),Math.round(y*s)]),c),ink=ramps.ink[0],cloth=ramp.map(nearest),leather=ramps.wood,gold=ramps.ui[1];
 if(slot==='hands'){
  for(const [ox,oy,flip]of [[2,5,false],[17,8,true]]){
   const a=(x,y,w,h,c)=>r(ox+(flip?13-x-w:x),oy+y,w,h,c),poly=(points,c)=>q(points.map(([x,y])=>[ox+(flip?13-x:x),oy+y]),c);
   poly([[1,0],[11,0],[12,7],[13,12],[10,18],[3,19],[0,16],[0,8]],ink);
   a(2,1,8,5,cloth[2]);a(2,1,7,1,cloth[4]);a(2,5,9,2,gold);a(3,6,7,1,leather[1]);
   poly([[2,8],[10,8],[11,12],[9,17],[4,18],[1,15]],leather[2]);
   poly([[2,8],[7,8],[7,15],[4,16],[2,14]],leather[4]);a(2,9,2,4,leather[5]);
   a(9,8,2,6,leather[1]);a(7,12,1,5,leather[1]);a(4,16,4,1,leather[3]);
  }
 }else if(slot==='legs'){
  q([[5,3],[26,3],[27,11],[28,28],[18,29],[16,17],[14,29],[4,28],[5,11]],ink);
  q([[6,4],[25,4],[26,12],[26,27],[19,27],[17,14],[15,14],[12,27],[6,26]],cloth[2]);
  q([[7,7],[14,7],[14,15],[11,25],[7,25]],cloth[3]);q([[18,8],[23,8],[24,24],[20,24]],cloth[1]);
  r(6,4,19,3,leather[1]);r(6,4,18,1,leather[3]);r(14,4,5,4,gold);r(15,5,3,2,leather[1]);
  r(7,9,5,1,cloth[4]);r(20,9,3,1,cloth[3]);r(7,25,5,2,cloth[1]);r(20,25,5,2,cloth[0]);
  if(size===32){r(14,10,1,5,cloth[1]);r(7,13,1,7,cloth[4]);r(21,17,1,5,cloth[3]);}
 }else if(slot==='back'){
  if(backKind==='empty'){
   // Empty original attachments remain visibly empty, never a fabricated equipped cape.
   for(const[x,y,sx,sy]of [[5,5,1,1],[26,5,-1,1],[5,26,1,-1],[26,26,-1,-1]]){r(Math.min(x,x+sx*5),y,6,2,ramps.ink[3]);r(x,Math.min(y,y+sy*5),2,6,ramps.ink[3]);}
   r(11,15,11,2,ramps.ink[3]);r(11,15,10,1,ramps.ink[4]);
  }else if(backKind==='bow'){
   q([[9,3],[16,5],[22,11],[24,17],[22,24],[16,28],[10,29],[8,27],[15,25],[19,21],[20,16],[18,11],[13,7],[8,6]],ink);
   q([[9,4],[15,6],[20,11],[22,17],[20,23],[15,26],[10,28],[9,26],[15,24],[18,20],[19,16],[17,11],[12,7],[9,6]],leather[3]);
   r(9,6,1,20,ramps.ink[4]);r(9,15,15,1,ramps.ink[5]);q([[25,13],[30,15],[25,18]],ramps.ink[3]);r(13,7,2,2,leather[5]);r(20,14,1,5,leather[4]);
  }else if(backKind==='quiver'){
   q([[9,10],[23,13],[20,29],[7,26]],ink);q([[10,12],[21,14],[18,27],[9,25]],leather[2]);q([[11,13],[15,14],[12,25],[10,24]],leather[4]);r(10,11,12,3,leather[1]);r(10,11,11,1,leather[5]);
   for(const[x,y]of [[12,3],[17,1],[22,4]]){q([[x,y],[x+3,y+1],[x+1,y+13],[x-1,y+12]],leather[4]);q([[x-1,y],[x+3,y],[x+2,y+5],[x-2,y+4]],ramps.ink[4]);r(x,y,1,4,ramps.navy[3]);}
  }else if(backKind==='cape'){
   q([[11,3],[20,3],[23,11],[29,28],[23,27],[17,29],[11,26],[4,28],[9,10]],ink);
   q([[12,5],[19,5],[21,12],[26,25],[22,24],[17,27],[11,24],[7,25],[11,11]],cloth[2]);q([[12,6],[15,6],[12,23],[8,25],[11,11]],cloth[4]);q([[17,9],[21,14],[25,25],[20,24]],cloth[1]);
   r(13,4,6,2,leather[3]);r(14,4,3,3,gold);r(15,5,1,1,ramps.ink[5]);
  }else{
   const long=backKind==='long-hair',twins=backKind==='twin-hair',bottom=long?29:twins?23:22;
   q([[11,3],[21,3],[25,7],[25,15],[28,bottom],[22,bottom-1],[19,bottom-3],[15,bottom],[9,bottom-2],[4,bottom],[7,14],[7,8]],ink);
   q([[11,4],[20,4],[24,8],[23,16],[26,bottom-2],[21,bottom-3],[18,bottom-5],[15,bottom-2],[10,bottom-4],[6,bottom-2],[9,14],[8,9]],cloth[2]);
   q([[11,5],[17,5],[13,10],[12,bottom-5],[9,bottom-4],[10,13],[9,9]],cloth[4]);q([[19,7],[23,9],[22,16],[24,bottom-4],[20,bottom-5]],cloth[1]);
   if(twins){q([[7,10],[5,15],[3,25],[8,28],[11,24],[10,14]],ink);q([[6,14],[5,24],[8,26],[9,23],[8,14]],cloth[3]);q([[24,10],[27,15],[29,25],[24,28],[21,24],[22,14]],ink);q([[24,14],[23,23],[25,26],[27,24],[26,14]],cloth[3]);r(6,12,4,2,gold);r(22,12,4,2,gold);}
   if(size===32){r(14,6,1,5,cloth[5]);r(18,14,1,bottom-18,cloth[3]);}
  }
 }else throw Error('Unknown garment '+slot);return clean(p);
}
async function shibaHead(size){
 const file=path.join(root,'.runtime/pixel-coherence/fine/shiba/images/head.png'),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(size,size),scale=Math.min((size-2)/info.width,(size-2)/info.height),w=Math.round(info.width*scale),h=Math.round(info.height*scale),ox=Math.floor((size-w)/2),oy=Math.floor((size-h)/2);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(info.width-1,Math.floor((x+.5)*info.width/w)),sy=Math.min(info.height-1,Math.floor((y+.5)*info.height/h)),i=(sy*info.width+sx)*4;if(data[i+3]>=128){Buffer.from(nearest('#'+data.subarray(i,i+3).toString('hex')).slice(1),'hex').copy(p.data,((y+oy)*size+x+ox)*4);p.data[((y+oy)*size+x+ox)*4+3]=255;}}
 return clean(p);
}
async function build(){
 fs.mkdirSync(work,{recursive:true});const out={schemaVersion:1,stage:[1280,720],canvas:[1280,720],palette:'/art-pixel/palette.json',assets:{}},keys=[],replaced=[],open=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-open-art.json'),'utf8')).mapping,contact=new Pixels(8*120,8*80);let idx=0;
 async function save(key,p,extra={}){const old=m.assets[key];if(!old)throw Error('Unknown live key '+key);const file=extra.file??'/art-pixel/ui-code/misc-fine-v1/'+key.replaceAll(':','-').replaceAll('/','-')+'.png';await p.save(path.join(candidateRoot,file));const a={...old,file,frame:[p.width,p.height],anchor:[Math.floor(p.width/2),Math.floor(p.height/2)],scale:1,sha256:createHash('sha256').update(fs.readFileSync(path.join(candidateRoot,file))).digest('hex'),provenance:{method:'authored-pixels',reviewed:true,recipe:'tools/pixel/fine-misc.mjs; semantic slot artwork on native target grid'},...extra};const issues=await checkAsset(a,{publicRoot:candidateRoot});if(issues.length)throw Error(key+': '+JSON.stringify(issues));out.assets[key]=a;keys.push(key);if(open[key])replaced.push(key);return a;}
 const backKinds={'100061':'long-hair','100092':'bow','100102':'short-hair','200291':'twin-hair','200311':'quiver','200331':'cape'};
 for(const id of wardrobe.shippedSets)for(const slot of ['head','hands','legs','back']){
  const base='wardrobe-thumb:'+id+':'+slot,back=backKinds[id]??'empty',sourceHair={'100061':ramps.ink,'100102':ramps.fire,'200291':ramps.wood},ramp=slot==='back'&&sourceHair[id]?sourceHair[id]:m.appearances?.[id]?.cloth??ramps.navy;
  for(const size of [32,16]){const p=slot==='head'?await shibaHead(size):garmentGlyph(slot,size,ramp,back),key=base+(size===16?':16':'');const a=await save(key,p);if(size===32)a.small=base+':16';contact.stamp(p,idx%8*120+(size===32?8:56),Math.floor(idx/8)*80+8);}idx++;
 }
 for(const size of [32,16]){const key='wardrobe-style:100011'+(size===16?':16':''),a=await save(key,await shibaHead(size));if(size===32)a.small=key+':16';}
 // Title backgrounds retain their existing filenames; root owns the reversible CSS.
 const terrain=JSON.parse(fs.readFileSync(path.join(root,'.runtime/pixel-coherence/terrain-fine.json'),'utf8'));
 for(const [name,sourceKey]of [['title-grass','ow-art-grass'],['title-road','ss-scene-road']]){
  const src=terrain.assets[sourceKey];if(!src)throw Error('Missing final terrain '+sourceKey);if(src.frame[0]!==32||src.scale!==1)throw Error('Title source must be native32');
  const {data,info}=await sharp(path.join(candidateRoot,src.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(32,32),offset=src.terrain?15*32:0;
  for(let y=0;y<32;y++)data.copy(p.data,y*32*4,(y*info.width+offset)*4,(y*info.width+offset+32)*4);
  await save('css-ground:'+name,p,{file:'/art-pixel/ui-code/'+name+'.png',kind:'tiles',anchor:[0,0],provenance:structuredClone(src.provenance)});
 }
 fs.writeFileSync(path.join(work,'misc-candidates.json'),JSON.stringify(out,null,2)+'\n');fs.writeFileSync(path.join(work,'misc-keys.json'),JSON.stringify(keys,null,2)+'\n');fs.writeFileSync(path.join(work,'misc-replaced-cc0-keys.json'),JSON.stringify(replaced,null,2)+'\n');await contact.save(path.join(work,'garments-contact.png'));console.log(JSON.stringify({candidates:keys.length,replacedCC0:replaced.length}));
}
if(process.argv[1]?.endsWith('fine-misc.mjs'))await build();
