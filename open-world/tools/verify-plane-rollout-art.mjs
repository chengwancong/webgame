import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {rolloutItems} from '../assets/open-world/plane-kits/rollout-spec.mjs';
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const manifest=await read('packages/asset-manifest/open-world-planes.v1.json'),grey=await read('packages/asset-manifest/open-world-planes-greybox.v1.json');
const batch=process.argv.find(a=>a.startsWith('--batch='))?.slice(8),allow=process.argv.includes('--allow-pending'),results=[],pending=[];
for(const p of rolloutItems.filter(p=>!batch||p.batch===batch)){
 const a=manifest.assets.find(a=>a.id===p.id),c=grey.assets.find(g=>g.id===p.id)?.contract??p.contract;
 if(!a||a.status!=='imported'||a.runtime.registration!=='greybox-contract-exact'){pending.push(p.id);continue;}
 const r=a.runtime;assert.deepEqual(a.contract,c,p.id+' contract');assert.deepEqual([r.width,r.height],c.canvas);assert.deepEqual(r.anchor,c.anchor);assert.equal(r.displayWidth,c.displayWidth);assert.deepEqual(a.canvas,c.canvas);assert.deepEqual(a.anchor,c.anchor);assert.equal(a.displayWidth,c.displayWidth);assert.deepEqual(r.states,p.states);
 assert.equal(a.baseId,undefined,p.id+' 已独立绘制，不能保留基础图适配');assert.equal(r.material,undefined,p.id+' 新图不重复叠本岛材质');
 const sizes=[],alphaStates=[];let sharedTransform;
 for(const state of p.states){
  const f=r.stateFrames[state];assert.deepEqual(f,{file:r.stateFiles[state],width:r.width,height:r.height,anchor:r.anchor,displayWidth:r.displayWidth});
  const {data,info}=await sharp(resolve(root,'apps/web/public'+f.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],c.canvas);
  let l=info.width,t=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(['R2','R4'].includes(p.batch)||p.part==='light-pool'){if(x<2||y<2||x>=info.width-2||y>=info.height-2)assert.equal(alpha,0,p.id+' 留边');}if(alpha>1){l=Math.min(l,x);t=Math.min(t,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}
  assert.ok(right>=l,p.id+' 空图');if(p.batch==='R2'){assert.ok(right-l+1<=64);assert.ok(bottom-t+1<=80);}
  if(['ground-main','ground-path'].includes(p.part)&&p.kit!=='cave'){
   let delta=0,samples=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)for(const [dx,dy] of [[64,0],[0,36]])for(let c=0;c<3;c++){delta+=Math.abs(data[(y*info.width+x)*4+c]-data[(((y+dy)%info.height)*info.width+(x+dx)%info.width)*4+c]);samples++;}
   assert.ok(delta/samples<1,p.id+' 菱形周期不对齐 '+delta/samples);
  }else if(['ground-main','ground-path','wall-top'].includes(p.part)){
   for(let y=0;y<info.height;y++)for(let c=0;c<3;c++)assert.equal(data[y*info.width*4+c],data[(y*info.width+info.width-1)*4+c],p.id+' 左右平铺');
   for(let x=0;x<info.width;x++)for(let c=0;c<3;c++)assert.equal(data[x*4+c],data[((info.height-1)*info.width+x)*4+c],p.id+' 上下平铺');
  }
  sizes.push({state,bounds:[l,t,right+1,bottom+1]});
  if(p.batch==='R4')alphaStates.push(data.filter((_,i)=>i%4===3));
 }
 for(const f of a.files){const bytes=await readFile(resolve(root,f.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,p.id+' 哈希');}
 if(p.batch==='R4'){
  const meta=await read(`assets/open-world/plane-kits/source/rollout/${p.id}.json`);for(const state of p.states){if(sharedTransform)assert.deepEqual(meta.transforms[state],sharedTransform,p.id+' 状态变换');else sharedTransform=meta.transforms[state];}
  let intersection=0,union=0;for(let i=0;i<alphaStates[0].length;i++){const a=alphaStates[0][i]>160,b=alphaStates[1][i]>160;if(a||b)union++;if(a&&b)intersection++;}assert.ok(intersection/union>=.75,p.id+' 两态轮廓漂移：'+(intersection/union).toFixed(3));
 }
 results.push({id:p.id,batch:p.batch,states:p.states.length,canvas:c.canvas,...(p.batch==='R2'?{bounds:sizes[0].bounds}:{})});
}
const report={passed:allow||pending.length===0,imported:results.length,states:results.reduce((s,a)=>s+a.states,0),pending,results};
await mkdir(resolve(root,'docs/reviews/plane-art-20261018'),{recursive:true});await writeFile(resolve(root,`docs/reviews/plane-art-20261018/rollout-${batch??'all'}-validation.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,imported:report.imported,states:report.states,pending:pending.length}));if(!report.passed)process.exitCode=1;
