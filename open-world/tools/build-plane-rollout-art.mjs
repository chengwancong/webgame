import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {projectedFloor,mirroredTexture} from './plane-rollout-texture.mjs';
import {rolloutItems,statePrompt} from '../assets/open-world/plane-kits/rollout-spec.mjs';
const root=resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const save=async(p,v)=>{await mkdir(dirname(resolve(root,p)),{recursive:true});await writeFile(resolve(root,p),JSON.stringify(v,null,2)+'\n');};
async function exists(p){try{await access(resolve(root,p));return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function record(path){const b=await readFile(resolve(root,path)),m=await sharp(b).metadata();return {path,sha256:sha(b),bytes:b.length,width:m.width,height:m.height,alpha:m.hasAlpha};}
async function box(path){const {data,info}=await sharp(resolve(root,path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}if(r<0)throw Error('空图 '+path);return {left:l,top:t,width:r-l+1,height:b-t+1};}
export async function buildPlaneRollout({batch,prepareOnly=false,allowMissing=false}={}){
 const grey=await read('packages/asset-manifest/open-world-planes-greybox.v1.json'),manifest=await read('packages/asset-manifest/open-world-planes.v1.json'),review=await read('assets/open-world/plane-kits/review.json');
 const records=[];
 for(const p of rolloutItems.filter(p=>!batch||p.batch===batch)){
  const g=grey.assets.find(g=>g.id===p.id),c=structuredClone(g?.contract??p.contract),[w,h]=c.canvas;
  let a=manifest.assets.find(a=>a.id===p.id);
  if(!a){if(!g)throw Error('未登记 '+p.id);a={...g,island:p.island,states:p.states,status:'placeholder',accepted:false,sourceMode:'registered-material-adaptation',source:{mode:'registered-material-adaptation',assetId:g.aliasOf??g.id},files:g.files.map(f=>({...f,path:'apps/web/public'+f.path})),canvas:c.canvas,anchor:c.anchor,displayWidth:c.displayWidth,runtime:{...g.runtime,states:p.states,stateFiles:{default:g.runtime.file},stateFrames:{default:{file:g.runtime.file,width:w,height:h,anchor:c.anchor,displayWidth:c.displayWidth}}}};manifest.assets.push(a);}
  const ready=(await Promise.all(p.states.map(s=>exists(p.sources[s])))).every(Boolean);
  if(prepareOnly||!ready){if(a.runtime.registration!=='greybox-contract-exact'){a.status='placeholder';a.accepted=false;}if(!ready&&!allowMissing&&!prepareOnly)throw Error('缺少源图 '+p.id);continue;}
  const sprite=p.batch==='R2'||p.batch==='R4',mask=p.part==='light-pool',kind=sprite?'sprite':mask?'mask':p.part==='backdrop-near'?'ambient':'ground';
  const sourceRecords=await Promise.all(p.states.map(s=>record(p.sources[s])));
  if(sprite||mask)for(const s of sourceRecords)if(!s.alpha)throw Error('缺少透明通道 '+s.path);
  let crop;
  if(sprite){const sizes=new Set(sourceRecords.map(s=>`${s.width}x${s.height}`));if(sizes.size!==1)throw Error('多态原图画布不一致 '+p.id);const boxes=await Promise.all(p.states.map(s=>box(p.sources[s])));const left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top));crop={left,top,width:Math.max(...boxes.map(b=>b.left+b.width))-left,height:Math.max(...boxes.map(b=>b.top+b.height))-top};}
  const stateFiles={},stateFrames={},files=[...sourceRecords],transforms={};
  for(const state of p.states){
   let image=sharp(resolve(root,p.sources[state]));let transform;
   if(sprite){
    const scaled=await image.extract(crop).resize(p.maxWidth,p.maxHeight,{fit:'inside'}).png().toBuffer(),m=await sharp(scaled).metadata();
    const left=Math.round(w*c.anchor[0]-m.width/2),below=p.part==='portal-base'?Math.round(m.width/4):p.batch==='R4'?10:5,top=Math.round(h*c.anchor[1]+below-m.height);
    if(left<2||top<2||left+m.width>w-2||top+m.height>h-2)throw Error('越界 '+p.id);
    image=sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:scaled,left,top}]);transform={sourceCrop:crop,width:m.width,height:m.height,left,top,alignment:'shared-contact-center'};
   }else if(mask){image=image.resize(w-8,h-8,{fit:'fill'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'});}
   else if(['ground-main','ground-path'].includes(p.part)&&p.kit!=='cave'){image=await projectedFloor(resolve(root,p.sources[state]),w,h);transform={sampling:'low-variance-stone-patch-projected-64x36',patchSelection:'4-percent-interior-of-low-variance-scan'};}
   else if(['ground-main','ground-path','wall-top'].includes(p.part)){image=await mirroredTexture(resolve(root,p.sources[state]),w,h);transform={sampling:'four-way-mirrored-source',resize:[w,h]};}
   else if(p.part==='wall-straight'&&p.kit==='cave'){image=await mirroredTexture(resolve(root,p.sources[state]),w,h,{verticalOnly:true});transform={sampling:'vertical-mirrored-source',resize:[w,h]};}
   else image=image.resize(w,h,{fit:'fill'}).removeAlpha();
   const bytes=await image.png().toBuffer(),file=`/art/open-world/plane-kits/rollout/${p.id}/${state}-${sha(bytes).slice(0,12)}.png`,path='apps/web/public'+file;
   await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),bytes);files.push(await record(path));
   stateFiles[state]=file;stateFrames[state]={file,width:w,height:h,anchor:c.anchor,displayWidth:c.displayWidth};transforms[state]=transform??{resize:[w,h]};
  }
  Object.assign(a,{name:p.name,kit:p.kit,island:p.island,part:p.part,kind,category:p.batch==='R4'?'entrance':sprite?'nature':mask?'mask':p.part==='backdrop-near'?'ambient':'ground',states:p.states,canvas:c.canvas,anchor:c.anchor,displayWidth:c.displayWidth,contract:c,sourceMode:'imagegen',source:{mode:'imagegen',...sourceRecords[0],originalStates:sourceRecords},files,status:'imported',accepted:true,rolloutBatch:p.batch});
  delete a.baseId;delete a.material;delete a.aliasOf;
  a.runtime={kind,file:stateFiles[p.states[0]],width:w,height:h,anchor:c.anchor,displayWidth:c.displayWidth,states:p.states,stateFiles,stateFrames,initialState:p.states[0],registration:'greybox-contract-exact',...(mask?{blend:'add',rendererTint:true}:{}),importTransform:transforms[p.states[0]]};
  for(const s of sourceRecords)review.sources[s.path]={sha256:s.sha256,accepted:true,visualNote:'R1–R6 逐件图像复核与契约导入；多态采用共同裁切和同一变换。',seamVerified:false};
  await save(`assets/open-world/plane-kits/source/rollout/${p.id}.json`,{id:p.id,batch:p.batch,tool:'内置 image_gen',reuseExisting:p.batch==='R2',...(p.batch==='R2'?{originalPromptFiles:sourceRecords.map(s=>s.path.replace('.png','.json')),promptPurpose:'本轮未重新出图；prompts仅用于未来必要时简化重画，原生成提示词保持原文件。'}:{}),states:p.states,contract:c,prompts:Object.fromEntries(p.states.map(s=>[s,statePrompt(p,s)])),source:sourceRecords,transforms,status:'imported'});
  records.push({id:p.id,batch:p.batch,states:p.states,contract:c,file:a.runtime.file});
 }
 // 传送底座的既有六岛材质引用跟随基础资源的新画布，不复制像素。
 for(const a of manifest.assets.filter(a=>a.baseId)){
  const base=manifest.assets.find(b=>b.id===a.baseId);
  if(base?.rolloutBatch&&base.status==='imported')Object.assign(a,{canvas:base.canvas,anchor:base.anchor,displayWidth:base.displayWidth,contract:base.contract,files:base.files,source:{mode:'registered-material-adaptation',assetId:base.id,path:base.source.path,sha256:base.source.sha256},runtime:{...base.runtime,material:a.material},status:base.status,accepted:true});
 }
 manifest.pending=manifest.assets.filter(a=>a.status==='placeholder').map(a=>({id:a.id,reason:'正式美术尚未通过当前批次审核'}));
 manifest.counts.ids=manifest.assets.length;manifest.counts.placeholder=manifest.pending.length;
 manifest.counts.newOriginalFiles=new Set(manifest.assets.filter(a=>a.sourceMode==='imagegen').flatMap(a=>a.source.originalStates.map(s=>s.path))).size;
 manifest.counts.materialAdaptations=manifest.assets.filter(a=>a.baseId).length;
 manifest.production.rolloutBuilder='tools/build-plane-rollout-art.mjs';manifest.production.deliveryDigest=sha(JSON.stringify(manifest.assets));
 manifest.production.rollout={planned:rolloutItems.length,imported:rolloutItems.filter(p=>manifest.assets.find(a=>a.id===p.id)?.rolloutBatch===p.batch).length};
 for(const p of ['packages/asset-manifest/open-world-planes.v1.json','assets/open-world/plane-kits/manifest.json','apps/web/public/art/open-world/plane-kits/manifest.json'])await save(p,manifest);
 await save('assets/open-world/plane-kits/review.json',review);
 await save(`docs/reviews/plane-art-20261018/rollout-${batch??'all'}-build.json`,{count:records.length,records});
 return records;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const batch=process.argv.find(a=>a.startsWith('--batch='))?.slice(8);console.log(JSON.stringify({imported:(await buildPlaneRollout({batch,prepareOnly:process.argv.includes('--prepare'),allowMissing:process.argv.includes('--allow-pending')})).length,batch}));}
