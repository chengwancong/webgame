import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {group,root,out,sharp,sha,json} from './pipeline.mjs';
const manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8')),results=[];
function assert(v,message){if(!v)throw Error(message);}
for(const a of manifest.assets){
 const p=a.runtime,atlas=JSON.parse(await readFile(join(root,'apps/web/public',p.atlas),'utf8')),sockets=JSON.parse(await readFile(join(root,'apps/web/public',p.sockets),'utf8'));
 const {data,info}=await sharp(join(root,'apps/web/public',p.image)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let frames=0,mirrorError=0,groundDrift=0,maxHeight=0;const uniques={},actionHeights={};
 for(const [key,m] of Object.entries(p.actions)){
  assert(m.provenance==='complete original native animation','provenance '+a.id);
  assert(sockets.actions[key].length===m.count,'socket frame count '+a.id);
  assert(m.frames.length===m.count,'clip frame count '+a.id);
  const h=m.displayBounds.maxY-m.displayBounds.minY;assert(Math.max(h,-m.displayBounds.minY,m.displayBounds.maxY)<=75,'75px '+a.id+' '+key);maxHeight=Math.max(maxHeight,h);actionHeights[key]=h;
  const hashes=new Set();
  for(let i=0;i<m.count;i++){
   const f=atlas.frames[m.frames[i]],b=f.frame,s=f.spriteSourceSize;
   assert(f.sourceSize.w===256&&f.sourceSize.h===256,'cell size');
   assert(s.x>=2&&s.y>=2&&s.x+s.w<=254&&s.y+s.h<=254,'frame clipped '+a.id);
   assert(b.x>=0&&b.y>=0&&b.x+b.w<=info.width&&b.y+b.h<=info.height,'atlas bounds');
   const buffer=Buffer.alloc(b.w*b.h*4);let nonempty=0;
   for(let y=0;y<b.h;y++){data.copy(buffer,y*b.w*4,((b.y+y)*info.width+b.x)*4,((b.y+y)*info.width+b.x+b.w)*4);}
   for(let j=3;j<buffer.length;j+=4)if(buffer[j]>3)nonempty++;
   assert(nonempty>0,'empty frame '+a.id);hashes.add(sha(buffer));
   const frame=sockets.actions[key][i];for(const name of ['ground','body','head','emit','accessory']){const v=frame[name],m=frame.mirrored[name];assert(v?.length===2&&v.every(Number.isFinite),'socket missing '+a.id);mirrorError=Math.max(mirrorError,Math.abs(v[0]+m[0]-2*p.anchor[0]*256),Math.abs(v[1]-m[1]));}
   groundDrift=Math.max(groundDrift,Math.hypot(frame.ground[0]-p.anchor[0]*256,frame.ground[1]-p.anchor[1]*256)*p.scale);frames++;
  }
  assert(hashes.size>=3,'fake/static clip '+a.id+' '+key);uniques[key]=hashes.size;
 }
 const idle=atlas.frames.idle_0.spriteSourceSize,actualHeight=p.referencePixelHeight*p.scale;assert(Math.abs(actualHeight-p.displayHeight)<1e-8,'reference height '+a.id);
 assert(mirrorError<.00001&&groundDrift<.00001,'anchor or mirror drift '+a.id);
 let hashes=0;for(const f of [...a.source.files,...a.files]){assert(sha(await readFile(resolve(root,f.path)))===f.sha256,'hash mismatch '+f.path);hashes++;}
 const movement=[];for(const speed of [1,1.3,1.6]){const m=p.actions.move;let maxDrift=0;for(let i=0;i<600;i++){const time=i/120*speed,index=Math.min(m.count-1,Math.floor(time%m.duration*30)),f=sockets.actions.move[index];maxDrift=Math.max(maxDrift,Math.hypot(f.ground[0]-p.anchor[0]*256,f.ground[1]-p.anchor[1]*256)*p.scale);}movement.push({speed,samples:600,seconds:5,maxGroundDriftPx:maxDrift});assert(maxDrift<.00001,'1.6 anchor drift');}
 results.push({id:a.id,frames,uniqueFrames:uniques,actualIdleHeight:actualHeight,maxActionVerticalHeight:maxHeight,actionHeights,mirrorError,sourceAndOutputHashesVerified:hashes,sockets:'all five on every frame',movement,pass:true});
 console.log(a.id,'PASS',frames,'frames',actualHeight+'px');
}
for(const key of ['wind','mist','forge','frost','dragon','star']){const groupAssets=manifest.assets.filter(a=>a.id.startsWith('ss-pet-'+key+'-')&&!a.runtime.variant);if(groupAssets.length===3){const heights=['young','adult','awakened'].map(f=>groupAssets.find(a=>a.runtime.form===f).runtime.displayHeight);assert(heights.join(',')==='44,56,68','growth '+key);}}
await json(join(group,'evidence',process.argv.includes('--pilot')?'pilot-validation.json':'validation.json'),{assets:results.length,totalFrames:results.reduce((s,r)=>s+r.frames,0),pass:results.every(r=>r.pass),scope:'frame pixels, full native clips, calibrated bone sockets, mirror transform, invariant depth-ground at 1.0/1.3/1.6; world locomotion integration is separate',results});
