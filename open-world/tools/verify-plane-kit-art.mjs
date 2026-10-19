import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {contract,planeAssets} from '../assets/open-world/plane-kits-spec.mjs';
const root=resolve(import.meta.dirname,'..'),manifest=JSON.parse(await readFile(join(root,'packages/asset-manifest/open-world-planes.v1.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex'),errors=[],gaps=[],seen=new Set(),checked=new Map(),images=new Map();
async function image(file){if(!images.has(file)){const p=join(root,'apps/web/public'+file);images.set(file,await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true}));}return images.get(file);}
for(const a of manifest.assets){try{
 if(seen.has(a.id))throw Error('重复ID');seen.add(a.id);const def=planeAssets.find(d=>d.id===a.id);if(!def)throw Error('契约以外ID');
 if(a.status==='placeholder')gaps.push(a.id+'：正式美术占位');
 for(const f of a.files){if(!checked.has(f.path))checked.set(f.path,sha(await readFile(resolve(root,f.path))));if(checked.get(f.path)!==f.sha256)throw Error('文件哈希漂移：'+f.path);}
 if(a.kind==='spine-fx'){for(const c of a.runtime.candidates){const raw=JSON.parse(await readFile(c.originalPath,'utf8'));if(raw.skeleton.spine!==c.spineVersion||!Object.hasOwn(raw.animations,c.animation))throw Error('特效版本或动画不存在');}continue;}
 if(a.status==='placeholder'&&def.contract)continue;
 const r=a.runtime,padding=def.contract?2:8;if(JSON.stringify(r.states)!==JSON.stringify(def.states))throw Error('多态契约变化');
 if(JSON.stringify(r.anchor)!==JSON.stringify(def.anchor))throw Error('枢轴漂移');
 for(const s of r.states){const frame=r.stateFrames[s];if(!frame||frame.file!==r.stateFiles[s]||frame.width!==r.width||frame.height!==r.height||JSON.stringify(frame.anchor)!==JSON.stringify(r.anchor)||frame.displayWidth!==r.displayWidth)throw Error('多态画布/枢轴/比例不一致');const {data,info}=await image(frame.file);if(info.width!==r.width||info.height!==r.height)throw Error('发布尺寸不一致');if(['sprite','mask'].includes(a.kind)){for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x<padding||y<padding||x>=info.width-padding||y>=info.height-padding)&&data[(y*info.width+x)*4+3]!==0)throw Error('透明留边不足'+padding+'px');}}
 if(def.contract){const c=def.contract;if(r.width!==c.canvas[0]||r.height!==c.canvas[1]||r.displayWidth!==c.displayWidth)throw Error('现役契约尺寸错误');}
 if(!def.contract&&a.kind==='ground'&&(r.width!==512||r.height!==512||r.sampling!=='mirrored-repeat'))throw Error('地表采样错误');
 if(!def.contract&&a.kind==='ambient'&&(r.width!==2048||r.height!==768||r.sampling!=='repeat-x'))throw Error('远景契约错误');
 if(a.category==='boundary'&&(r.joinPolicy!=='overlap-under-terrain'||r.joinOverlapPx!==16))throw Error('边界拼接声明缺失');
 if(!def.contract&&['boundary','ambient'].includes(a.category)&&r.seamVerified!==true)gaps.push(a.id+'：接缝视觉验收未通过');
 if(a.baseId){const base=manifest.assets.find(b=>b.id===a.baseId);if(JSON.stringify(r.stateFiles)!==JSON.stringify(base.runtime.stateFiles))throw Error('适配复制像素或状态引用漂移');if(JSON.stringify(a.material)!==JSON.stringify(def.material))throw Error('本岛材质漂移');}
}catch(e){errors.push(a.id+'：'+e.message);}}
for(const a of contract.assets)if(!seen.has(a.id))errors.push('缺少契约ID：'+a.id);
if(seen.size!==contract.assets.length)errors.push('明确ID数量与当前规格不一致');
const allowPending=process.argv.includes('--allow-pending');
const result={schemaVersion:1,contractPassed:errors.length===0,artworkPassed:errors.length===0&&gaps.length===0,allowPending,counts:manifest.counts,uniqueFiles:checked.size,errors,gaps,browserUsed:false,gameplayIntegrated:false};
const dir=join(root,'docs/reviews/plane-art-20261018');await mkdir(dir,{recursive:true});await writeFile(join(dir,'validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({契约通过:result.contractPassed,美术通过:result.artworkPassed,文件:checked.size,错误:errors,缺口:gaps.length}));if(errors.length||(!allowPending&&gaps.length))process.exitCode=1;
