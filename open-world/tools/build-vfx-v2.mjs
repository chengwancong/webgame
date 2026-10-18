import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..'),source=resolve(root,'assets/skill-fx/v2'),out=resolve(root,'apps/web/public/art/effects/v2');await mkdir(out,{recursive:true});
const spec=JSON.parse(await readFile(resolve(source,'source.json'),'utf8')),manifest={version:spec.version,clips:{}};
for(const asset of spec.assets){
 const bytes=await readFile(resolve(source,asset.file)),meta=await sharp(bytes).metadata();if(!meta.hasAlpha)throw Error('Missing alpha: '+asset.id);
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(data[3]>4)throw Error('Opaque background corner: '+asset.id);
 const boundaries=(length,divisions,vertical)=>{
  const energy=Array.from({length},(_,a)=>{let total=0;for(let b=0;b<(vertical?info.width:info.height);b++){const x=vertical?b:a,y=vertical?a:b;if(data[(y*info.width+x)*4+3]>64)total++;}return total;});
  const edges=[0];for(let n=1;n<divisions;n++){const center=n*length/divisions,span=length/divisions*.18,lo=Math.floor(center-span),hi=Math.ceil(center+span),min=Math.min(...energy.slice(lo,hi)),choices=[];for(let p=lo;p<hi;p++)if(energy[p]===min)choices.push(p);edges.push(choices[Math.floor(choices.length/2)]);}edges.push(length);return edges;
 };
 const xs=boundaries(info.width,asset.columns,false),ys=boundaries(info.height,asset.rows,true),logicalW=Math.max(...xs.slice(1).map((x,n)=>x-xs[n])),logicalH=Math.max(...ys.slice(1).map((y,n)=>y-ys[n]));
 const cell=asset.kind==='boss'?256:192,frames={},layers=[],hashes=new Set();let visibleHeight=0;
 for(let n=0;n<asset.columns*asset.rows;n++){
  const column=n%asset.columns,row=Math.floor(n/asset.columns),x=xs[column],y=ys[row],w=xs[column+1]-x,h=ys[row+1]-y;
  const registered=await sharp(bytes).extract({left:x,top:y,width:w,height:h}).extend({left:Math.floor((logicalW-w)/2),right:Math.ceil((logicalW-w)/2),top:0,bottom:logicalH-h,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  let frame=await sharp(registered).resize(cell,cell,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  const frameMeta=await sharp(frame).metadata();if(frameMeta.width!==cell||frameMeta.height!==cell)throw Error('Invalid packed cell dimensions: '+asset.id+'/'+n);
  if(asset.kind==='boss'){
   // Extract the principal connected sprite, excluding fragments of adjacent sheet cells.
   const raw=await sharp(frame).ensureAlpha().raw().toBuffer(),seen=new Uint8Array(cell*cell),queue=new Int32Array(cell*cell);let best={count:0,left:0,right:cell-1,top:0,bottom:cell-1};
   for(let k=0;k<cell*cell;k++){if(seen[k]||raw[k*4+3]<64)continue;let head=0,tail=1;queue[0]=k;seen[k]=1;const box={count:0,left:cell,right:0,top:cell,bottom:0};while(head<tail){const p=queue[head++],x=p%cell,y=Math.floor(p/cell);box.count++;box.left=Math.min(box.left,x);box.right=Math.max(box.right,x);box.top=Math.min(box.top,y);box.bottom=Math.max(box.bottom,y);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy,q=ny*cell+nx;if(nx<0||ny<0||nx>=cell||ny>=cell||seen[q]||raw[q*4+3]<64)continue;seen[q]=1;queue[tail++]=q;}}if(box.count>best.count)best=box;}
   const left=Math.max(0,best.left-3),top=Math.max(0,best.top-3),width=Math.min(cell,best.right+4)-left,height=Math.min(cell,best.bottom+4)-top;
   frame=await sharp({create:{width:cell,height:cell,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:await sharp(frame).extract({left,top,width,height}).toBuffer(),left,top}]).png().toBuffer();
  }
  const raw=await sharp(frame).ensureAlpha().raw().toBuffer();let bottom=0,top=cell;
  for(let py=0;py<cell;py++)for(let px=0;px<cell;px++)if(raw[(py*cell+px)*4+3]>32){bottom=Math.max(bottom,py);top=Math.min(top,py);}
  if(top>=bottom)throw Error('Empty animation frame: '+asset.id+'/'+n);visibleHeight=Math.max(visibleHeight,bottom-top+1);
  hashes.add(createHash('sha256').update(raw).digest('hex'));
  // Shift padded cells to a common floor, never modify the artwork or alpha.
  const shift=asset.kind==='boss'?Math.max(0,Math.floor(cell*.95)-bottom):0;
  const normalized=shift?await sharp({create:{width:cell,height:cell,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:await sharp(frame).extract({left:0,top:0,width:cell,height:cell-shift}).toBuffer(),left:0,top:shift}]).png().toBuffer():frame;
  const left=n%asset.columns*cell,topOut=Math.floor(n/asset.columns)*cell;layers.push({input:normalized,left,top:topOut});frames[String(n)]={frame:{x:left,y:topOut,w:cell,h:cell},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:cell,h:cell},sourceSize:{w:cell,h:cell}};
 }
 if(hashes.size<asset.columns*asset.rows)throw Error('Duplicated frames: '+asset.id);
 const width=asset.columns*cell,height=asset.rows*cell;
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(resolve(out,asset.id+'.png'));
 await writeFile(resolve(out,asset.id+'.json'),JSON.stringify({frames,meta:{image:asset.id+'.png',size:{w:width,h:height},scale:'1'}}));
 manifest.clips[asset.id]={key:'vfx-v2-'+asset.id,image:'/art/effects/v2/'+asset.id+'.png',atlas:'/art/effects/v2/'+asset.id+'.json',count:layers.length,fps:18,origin:asset.origin,cell,visibleHeight,kind:asset.kind,sha256:createHash('sha256').update(bytes).digest('hex'),distinctFrames:hashes.size,frameGrid:{x:xs,y:ys,registration:'Transparent-gutter boundaries, common source scale, shared floor'}};
}
await writeFile(resolve(root,'packages/asset-manifest/vfx-v2.json'),JSON.stringify(manifest,null,2)+'\n');console.log(Object.fromEntries(Object.entries(manifest.clips).map(([id,c])=>[id,{frames:c.count,distinct:c.distinctFrames}])));
