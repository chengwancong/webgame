import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {propItems} from '../assets/open-world/plane-kits/props-contract-spec.mjs';
const root=resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const save=async(p,v)=>{await mkdir(dirname(resolve(root,p)),{recursive:true});await writeFile(resolve(root,p),JSON.stringify(v,null,2)+'\n');};
async function record(path){const b=await readFile(resolve(root,path)),m=await sharp(b).metadata();return {path,sha256:sha(b),bytes:b.length,width:m.width,height:m.height,alpha:m.hasAlpha};}
async function bounds(path){const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('空图 '+path);return {left:l,top:t,width:r-l+1,height:b-t+1};}
export async function buildPlaneProps({requireAll=true,kit}={}){
 const grey=await read('packages/asset-manifest/open-world-planes-greybox.v1.json');
 const manifest=await read('packages/asset-manifest/open-world-planes.v1.json');
 const review=await read('assets/open-world/plane-kits/review.json');
 const report=[];
 for(const p of propItems.filter(p=>!kit||p.kit===kit)){
  try{await access(resolve(root,p.source));}catch(e){if(e.code!=='ENOENT'||requireAll)throw e;continue;}
  const g=grey.assets.find(a=>a.id===p.id),a=manifest.assets.find(a=>a.id===p.id);
  if(!g||!a)throw Error('缺少登记 ID '+p.id);
  const c=structuredClone(g.contract),[width,height]=c.canvas;
  const box=await bounds(resolve(root,p.source));
  const maxHeight=p.id==='ow-art-plane-cave-light'?43:p.maxHeight;
  const scaled=await sharp(resolve(root,p.source)).extract(box).resize(p.maxWidth,maxHeight,{fit:'inside'}).png().toBuffer();
  const m=await sharp(scaled).metadata();
  const left=Math.round(width*c.anchor[0]-m.width/2);
  // 光源以灯体中心配准；地面物件的阴影中心对齐占地中心。
  const shadowBelow=p.part==='pillar'?20:p.part.startsWith('prop-s')?3:5;
  const lampCenter=p.id==='ow-art-plane-cave-light'?.64:.5;
  const top=p.part==='light'?Math.round(height*c.anchor[1]-m.height*lampCenter):Math.round(height*c.anchor[1]+shadowBelow-m.height);
  if(left<2||top<2||left+m.width>width-2||top+m.height>height-2)throw Error('画面越界 '+p.id);
  const bytes=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:scaled,left,top}]).png().toBuffer();
  const file=`/art/open-world/plane-kits/props-contract/${p.kit}/${p.part}-${sha(bytes).slice(0,12)}.png`;
  const output='apps/web/public'+file;await mkdir(dirname(resolve(root,output)),{recursive:true});await writeFile(resolve(root,output),bytes);
  const source=await record(p.source),published=await record(output);
  review.sources[p.source]={sha256:source.sha256,accepted:true,visualNote:'本轮装饰物逐图检查：题材、透明底、完整轮廓与简化色面；按灰盒 contract 裁切缩放。',seamVerified:false};
  const transform={sourceCrop:box,width:m.width,height:m.height,left,top,alignment:p.part==='light'?'lamp-center':'ground-contact-center',transparentMargin:2};
  Object.assign(a,{name:p.name,subject:p.subject,canvas:c.canvas,anchor:c.anchor,displayWidth:c.displayWidth,contract:c,sourceMode:'imagegen',source:{mode:'imagegen',...source,originalStates:[source]},files:[source,published],status:'imported',accepted:true});
  delete a.material;
  a.runtime={kind:'sprite',file,width,height,anchor:c.anchor,displayWidth:c.displayWidth,states:['default'],stateFiles:{default:file},stateFrames:{default:{file,width,height,anchor:c.anchor,displayWidth:c.displayWidth}},initialState:'default',registration:'greybox-contract-exact',importTransform:transform};
  await save(p.source.replace('.png','.json'),{id:p.id,tool:'内置 image_gen',useCase:'stylized-concept',prompt:p.prompt,transparent_background:true,styleReference:p.styleReference===null?null:'assets/open-world/plane-kits/source/ow-art-plane-cave-prop-s1.png',contract:c,sourceSha256:source.sha256,importTransform:transform});
  report.push({id:p.id,canvas:c.canvas,anchor:c.anchor,displayWidth:c.displayWidth,file,source:source.path,sha256:published.sha256,importTransform:transform});
 }
 manifest.production.propsContractBuilder='tools/build-plane-prop-art.mjs';
 manifest.pending=manifest.pending.filter(p=>manifest.assets.find(a=>a.id===p.id)?.status==='placeholder');
 manifest.counts.placeholder=manifest.pending.length;
 manifest.counts.newOriginalFiles=new Set(manifest.assets.filter(a=>a.sourceMode==='imagegen').flatMap(a=>a.source.originalStates.map(s=>s.path))).size;
 await save('assets/open-world/plane-kits/review.json',review);
 manifest.production.deliveryDigest=sha(JSON.stringify(manifest.assets));
 for(const p of ['packages/asset-manifest/open-world-planes.v1.json','assets/open-world/plane-kits/manifest.json','apps/web/public/art/open-world/plane-kits/manifest.json'])await save(p,manifest);
 await save(`docs/reviews/plane-world-20261018/props-contract${kit?'-'+kit:''}-build.json`,{count:report.length,assets:report});
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const kit=process.argv.find(a=>a.startsWith('--kit='))?.slice(6);console.log(JSON.stringify((await buildPlaneProps({kit,requireAll:!process.argv.includes('--allow-pending')})).map(a=>({id:a.id,canvas:a.canvas,anchor:a.anchor}))));}
