import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {propItems} from '../assets/open-world/plane-kits/props-contract-spec.mjs';
const root=resolve(import.meta.dirname,'..'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const grey=await read('packages/asset-manifest/open-world-planes-greybox.v1.json'),manifest=await read('packages/asset-manifest/open-world-planes.v1.json');
const kit=process.argv.find(a=>a.startsWith('--kit='))?.slice(6),results=[];
for(const p of propItems.filter(p=>!kit||p.kit===kit)){
 const a=manifest.assets.find(a=>a.id===p.id),g=grey.assets.find(a=>a.id===p.id),r=a.runtime;
 assert.deepEqual(a.contract,g.contract,p.id+' contract');
 assert.deepEqual(a.canvas,g.contract.canvas,p.id+' canvas');
 assert.deepEqual([r.width,r.height],g.contract.canvas,p.id+' runtime canvas');
 assert.deepEqual(r.anchor,g.contract.anchor,p.id+' anchor');
 assert.deepEqual(a.anchor,g.contract.anchor,p.id+' source anchor');
 assert.equal(r.displayWidth,g.contract.displayWidth,p.id+' displayWidth');
 assert.equal(a.displayWidth,g.contract.displayWidth,p.id+' displayWidth');
 assert.equal(a.status,'imported');assert.equal(a.accepted,true);
 assert.equal(r.stateFiles.default,r.file);assert.deepEqual(r.stateFrames.default,{file:r.file,width:r.width,height:r.height,anchor:r.anchor,displayWidth:r.displayWidth});
 const {data,info}=await sharp(resolve(root,'apps/web/public'+r.file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height],g.contract.canvas);
 let l=info.width,t=info.height,right=-1,bottom=-1,semi=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const alpha=data[(y*info.width+x)*4+3];if(x<2||y<2||x>=info.width-2||y>=info.height-2)assert.equal(alpha,0,p.id+' transparent margin');if(alpha>1){l=Math.min(l,x);t=Math.min(t,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}if(alpha>0&&alpha<200)semi++;}
 assert.ok(right>=l&&semi>0,p.id+' nonempty transparent sprite');
 if(p.part.startsWith('prop-'))assert.ok(right-l+1<=60,p.id+' single-cell width');
 for(const f of a.files){const bytes=await readFile(resolve(root,f.path));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,p.id+' hash');}
 results.push({id:p.id,canvas:g.contract.canvas,anchor:r.anchor,displayWidth:r.displayWidth,bounds:[l,t,right+1,bottom+1],semiTransparentPixels:semi,file:r.file});
}
const report={passed:true,count:results.length,assets:results};
await writeFile(resolve(root,`docs/reviews/plane-world-20261018/props-contract${kit?'-'+kit:''}-validation.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(!kit){
 const layers=[];let labels='';
 for(const [row,kitName] of ['cave','crypt','maze'].entries())for(const [col,p] of propItems.filter(p=>p.kit===kitName).entries()){
  const r=manifest.assets.find(a=>a.id===p.id).runtime;
  layers.push({input:await readFile(resolve(root,'apps/web/public'+r.file)),left:col*144+Math.round((144-r.width)/2),top:row*240+Math.round(203-r.anchor[1]*r.height)});
  labels+=`<text x="${col*144+72}" y="${row*240+230}" text-anchor="middle" font-size="13" fill="#eee5d8">${kitName} / ${p.part}</text>`;
 }
 layers.push({input:Buffer.from(`<svg width="1008" height="720">${labels}</svg>`),left:0,top:0});
 await sharp({create:{width:1008,height:720,channels:4,background:'#383747'}}).composite(layers).png().toFile(resolve(root,'docs/reviews/plane-world-20261018/props-final-contact.png'));
}
