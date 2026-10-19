import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildPlaneProps} from './build-plane-prop-art.mjs';
import {buildPlaneRollout} from './build-plane-rollout-art.mjs';
import {rolloutItems} from '../assets/open-world/plane-kits/rollout-spec.mjs';
import {planeVersion,planeAssets,promptFor,kitThemes,style} from '../assets/open-world/plane-kits-spec.mjs';
const root=resolve(import.meta.dirname,'..'),group=join(root,'assets/open-world/plane-kits'),pub=join(root,'apps/web/public/art/open-world/plane-kits');
const sha=b=>createHash('sha256').update(b).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/');
const json=async(p,v)=>{await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');};
const read=async p=>JSON.parse(await readFile(join(root,p),'utf8'));
const exists=async p=>{try{await access(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const files=new Map();async function file(p){if(!files.has(p)){const b=await readFile(p),m=p.endsWith('.png')?await sharp(b).metadata():{};files.set(p,{path:rel(p),sha256:sha(b),bytes:b.length,...(m.width?{width:m.width,height:m.height,alpha:m.hasAlpha}:{})});}return files.get(p);}
const library=[...(await read('assets/open-world/manifest.json')).assets,...(await read('packages/asset-manifest/open-world-five.v1.json')).assets];
const review=await exists(join(group,'review.json'))?await read('assets/open-world/plane-kits/review.json'):{sources:{}};
const fx=await exists(join(group,'fx-selection.json'))?await read('assets/open-world/plane-kits/fx-selection.json'):{assets:[]};
const manifest={schemaVersion:1,version:planeVersion,scope:'plane-art-only',status:'placeholder',accepted:false,gameplayIntegrated:false,projection:[32,18],assets:[],pending:[],outstanding:[],production:{builder:'tools/build-plane-kit-art.mjs',generationQueue:'assets/open-world/plane-kits/generation-queue.json'}};
const queue=[],cache=new Map();
async function alphaBox(path){const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});let left=info.width,top=info.height,right=-1,bottom=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>1){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}if(right<left)throw Error('透明空图：'+path);return {left,top,width:right-left+1,height:bottom-top+1};}
async function publish(source,a,isOriginal,rect){
 const key=JSON.stringify([source,a.canvas,a.kind,a.category,isOriginal,rect]);if(cache.has(key))return cache.get(key);
 const out=join(pub,a.kind==='ground'?'textures':a.kind==='ambient'?'backdrops':'sprites',sha(key).slice(0,20)+'.png');await mkdir(resolve(out,'..'),{recursive:true});
 let input=sharp(source);const [w,h]=a.canvas;
 if(a.kind==='ground')input=input.resize(w,h,{fit:'cover'});
 else if(a.kind==='ambient')input=input.resize(w,h,{fit:'cover'});
 else if(rect){const scaled=await input.extract(rect).ensureAlpha().resize(w-16,h-16,{fit:'inside'}).png().toBuffer(),m=await sharp(scaled).metadata();input=sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:scaled,left:Math.floor((w-m.width)/2),top:h-8-m.height}]);}
 else input=input.ensureAlpha().resize(w-16,h-16,{fit:'contain',background:'#00000000'}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'});
 await input.png().toFile(out);const f=await file(out);const value={file:'/art/open-world/plane-kits/'+rel(out).split('/plane-kits/')[1],record:f};cache.set(key,value);return value;
}
for(const a of planeAssets){
 if(a.kind==='spine-fx'){const selection=fx.assets.find(x=>x.id===a.id);manifest.assets.push({...a,sourceMode:'registered-spine-selection',source:{mode:'registered-spine-selection'},files:selection?.files??[],runtime:{kind:'spine-fx',candidates:selection?.candidates??[],integrated:false},status:selection?.candidates?.length?'selected':'placeholder',accepted:false,...(selection?{selectionNote:selection.note}:{})});continue;}
 if(a.baseId){const base=manifest.assets.find(x=>x.id===a.baseId);if(!base)throw Error('适配缺少基础ID：'+a.id);manifest.assets.push({...a,source:{mode:'registered-material-adaptation',assetId:base.id,path:base.source.path,sha256:base.source.sha256},files:base.files,runtime:{...base.runtime,material:a.material},status:base.status,accepted:false});continue;}
 const prompts=a.states.map(s=>promptFor(a,s));for(const p of prompts){queue.push(p);const path=join(root,p.output.replace('.png','.json'));if(!(rolloutItems.find(i=>i.id===a.id)?.reuseSource&&await exists(path)))await json(path,p);}
 const donor=library.find(x=>x.id===a.placeholderAssetId);if(!donor?.runtime?.file)throw Error('占位来源不存在：'+a.id);
 const donorPath=join(root,'apps/web/public'+donor.runtime.file);
 const approved=[];for(const p of prompts){const path=join(root,p.output);approved.push(await exists(path)&&review.sources?.[p.output]?.sha256===sha(await readFile(path))&&review.sources[p.output].accepted===true);}
 const imported=approved.every(Boolean),records=[],stateFiles={},stateFrames={},sourceRecords=[];
 if(imported&&a.states.length>1){const metas=await Promise.all(prompts.map(p=>sharp(join(root,p.output)).metadata()));if(metas.some(m=>m.width!==metas[0].width||m.height!==metas[0].height))throw Error('多态源画布不一致：'+a.id);}
 let rect;if(a.kind==='sprite'&&a.category!=='boundary'){const boxes=[];for(const p of prompts)boxes.push(await alphaBox(imported?join(root,p.output):donorPath));const left=Math.min(...boxes.map(b=>b.left)),top=Math.min(...boxes.map(b=>b.top));rect={left,top,width:Math.max(...boxes.map(b=>b.left+b.width))-left,height:Math.max(...boxes.map(b=>b.top+b.height))-top};}
 for(const [i,state]of a.states.entries()){
  const source=imported?join(root,prompts[i].output):donorPath;
  const published=await publish(source,a,imported,rect);records.push(await file(source),published.record);sourceRecords.push(await file(source));stateFiles[state]=published.file;stateFrames[state]={file:published.file,width:a.canvas[0],height:a.canvas[1],anchor:a.anchor,displayWidth:a.displayWidth};
 }
 const source=sourceRecords[0],runtime={kind:a.kind,file:stateFiles[a.states[0]],width:a.canvas[0],height:a.canvas[1],anchor:a.anchor,displayWidth:a.displayWidth,states:a.states,stateFiles,stateFrames,initialState:a.states[0],registration:'fixed-canvas-and-scale',material:a.material,...(a.kind==='ground'?{sampling:'mirrored-repeat'}:{}),...(a.kind==='ambient'?{sampling:'repeat-x',seamVerified:imported&&review.sources[prompts[0].output]?.seamVerified===true}:{}),...(a.category==='boundary'?{registration:'upper-ground-plane',joinPolicy:'overlap-under-terrain',joinOverlapPx:16,seamVerified:imported&&review.sources[prompts[0].output]?.seamVerified===true}:{}),...(a.kind==='mask'?{blend:'add',rendererTint:true}:{})};
 manifest.assets.push({...a,sourceMode:imported?'imagegen':'registered-material-adaptation',source:{mode:imported?'imagegen':'registered-material-adaptation',...source,...(!imported?{assetId:donor.id}:{}),originalStates:sourceRecords},files:[...new Map(records.map(r=>[r.path,r])).values()],runtime,status:imported?'imported':'placeholder',accepted:imported});
 const added=manifest.assets.at(-1);if(imported&&a.island==='shared'){delete added.material;delete added.runtime.material;}if(a.kind==='mask'){delete added.material;delete added.runtime.material;}if(rect)added.runtime.importTransform={sharedSourceCrop:rect,alignment:'bottom-center',padding:8};
}
for(const kit of Object.keys(kitThemes))for(const direction of ['a','b'])queue.push({id:`sample-${kit}-${direction}`,kind:'style-sample',tool:'内置image_gen',output:`docs/reviews/plane-art-20261018/style-samples/${kit}-${direction}.png`,transparent_background:false,prompt:`${style} ${kitThemes[kit]}，24×20格视野的等距大厅样张，地表、墙、光源、三件独立摆件、远景层。${direction==='a'?'A方向：贴近五岛户外明亮度。':'B方向：有色阴影更明显、局部暖光更强，仍守明亮底线。'}仅方向参考，不作游戏素材。`,status:'queued'});
manifest.pending=manifest.assets.filter(a=>a.status==='placeholder').map(a=>({id:a.id,reason:'正式美术尚未通过导入审核，保留已有资源占位'}));
manifest.counts={ids:manifest.assets.length,newOriginalFiles:new Set(manifest.assets.filter(a=>a.sourceMode==='imagegen').flatMap(a=>a.source.originalStates.map(s=>s.path))).size,originalAssetIds:manifest.assets.filter(a=>!a.baseId&&a.kind!=='spine-fx').length,materialAdaptations:manifest.assets.filter(a=>a.baseId).length,fxUses:manifest.assets.filter(a=>a.kind==='spine-fx').length,selectedFxUses:manifest.assets.filter(a=>a.kind==='spine-fx'&&a.status==='selected').length,placeholder:manifest.pending.length};
manifest.production.deliveryDigest=sha(JSON.stringify(manifest.assets));manifest.artworkComplete=manifest.pending.length===0;manifest.status=manifest.artworkComplete?'imported':'placeholder';
await json(join(group,'generation-queue.json'),{schemaVersion:1,version:planeVersion,items:queue});
for(const p of [join(group,'manifest.json'),join(pub,'manifest.json'),join(root,'packages/asset-manifest/open-world-planes.v1.json')])await json(p,manifest);
console.log(JSON.stringify(manifest.counts));
await buildPlaneProps({requireAll:false});
await buildPlaneRollout({allowMissing:true});
if(manifest.pending.length&&!process.argv.includes('--allow-pending'))throw Error(`正式美术未齐：${manifest.pending.length}项占位；不能宣称完整美术构建通过。`);
