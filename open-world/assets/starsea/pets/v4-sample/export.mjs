import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {boot,load,render,pixels,sharp,group,root,out,json,record,rel,sha,library} from './pipeline.mjs';
import {pets,forms,palette} from './definitions.mjs';
const wanted=(process.argv.find(a=>a.startsWith('--pets='))?.slice(7)??'wind-light,wind-heavy,mist-light,mist-heavy,forge-light,forge-heavy,frost-light,frost-heavy,dragon-light,dragon-heavy,star-light,star-heavy').split(',');
const wantedForms=(process.argv.find(a=>a.startsWith('--forms='))?.slice(8)??'young,adult,awakened').split(',');
const manifestPath=join(group,'manifest.json');let assets=[];try{assets=JSON.parse(await readFile(manifestPath,'utf8')).assets;}catch{}
const ctx=await boot();
const round=n=>Math.round(n*1e6)/1e6;
const toLocal=(b,p)=>{const x=p[0]-b.x,y=p[1]-b.y,det=b.a*b.d-b.b*b.c;return [(b.d*x-b.b*y)/det,(b.a*y-b.c*x)/det];};
const toWorld=(b,p)=>[b.a*p[0]+b.b*p[1]+b.x,b.c*p[0]+b.d*p[1]+b.y];
try{for(const pet of pets.filter(p=>wanted.includes(p.key)))for(const form of forms.map((f,i)=>({...f,stage:pet.stages[i],height:pet.heights[i]})).filter(f=>wantedForms.includes(f.key))){
 const id='ss-pet-'+pet.key+'-'+form.key,name='guai'+pet.family+form.stage;
 const raw=JSON.parse(await readFile(join(library,name,name+'.json'),'utf8')),tuning=palette(pet,raw,form.variant);
 const info=await load(ctx,pet.family,form.stage,{prefix:`/group/sources/${pet.key}/${name}/`}),samples=[];
 for(const [action,m] of Object.entries(info.actions))for(let i=0;i<m.count;i++)samples.push({action,index:i,time:i/30,...await render(ctx,action,i/30)});
 const all=samples.map(s=>s.bounds),minX=Math.min(...all.map(b=>b.minX)),maxX=Math.max(...all.map(b=>b.maxX)),minY=Math.min(...all.map(b=>b.minY)),maxY=Math.max(...all.map(b=>b.maxY));
 let camera={cell:256,span:Math.max(maxX-minX,maxY-minY)*1.12,cx:(minX+maxX)/2,cy:(minY+maxY)/2};
 const probeBounds=[];for(const sample of samples){const probe=await render(ctx,sample.action,sample.time,{...camera,cell:512}),box=await pixels(Buffer.from(probe.png.split(',')[1],'base64'));if(box.count)probeBounds.push(box);}
 const u=camera.span/512,L=Math.min(...probeBounds.map(b=>b.x))-3,R=Math.max(...probeBounds.map(b=>b.x+b.w))+3,T=Math.min(...probeBounds.map(b=>b.y))-3,B=Math.max(...probeBounds.map(b=>b.y+b.h))+3;
 camera={cell:256,span:Math.max(R-L,B-T)*u*1.10,cx:camera.cx+((L+R)/2-256)*u,cy:camera.cy-((T+B)/2-256)*u};
 const idleFrame=await render(ctx,'idle',0,camera),idleBuffer=Buffer.from(idleFrame.png.split(',')[1],'base64'),idleBox=await pixels(idleBuffer);
 const units=camera.span/256;let referencePixelHeight=idleBox.h,referenceHeight=idleBox.h*units,scale=form.height/idleBox.h;
 const ground=[0,camera.cy+camera.span/2-(idleBox.y+idleBox.h)*units];
 const anchor=[.5-camera.cx/camera.span,.5-(ground[1]-camera.cy)/camera.span];
 const screen=p=>[round(256*(.5+(p[0]-camera.cx)/camera.span)),round(256*(.5-(p[1]-camera.cy)/camera.span))];
 const rest=idleFrame.bones,names=Object.keys(rest);
 const choose=patterns=>{for(const p of patterns){const n=names.find(n=>p.test(n));if(n)return n;}return names.find(n=>/body|shenti|shen/i.test(n))??names[1]??names[0];};
 const bodyBone=choose([/body$/i,/^body1$/,/^shenti$/,/^sehnti$/,/^shent$/,/^shen$/,/\/qugan$/,/\/tou$/,/^body$/,/^jifei$/]);
 const headBone=choose([/head$/i,/^tou$/,/\/tou$/,/^body2$/,/^shenti2$/,/^sehnti2$/,/^guan$/,/^shenti$/,/^shent$/,/^shen$/]);
 const emitBone=choose([/^pao$/,/^pao1$/,/^zui$/,/^zui1$/,/^xiaba$/,/^tou$/,/\/tou$/,/^body2$/,/^shenti2$/,/^sehnti2$/]);
 const idleWorld={left:camera.cx-camera.span/2+idleBox.x*units,right:camera.cx-camera.span/2+(idleBox.x+idleBox.w)*units,bottom:ground[1],top:ground[1]+referenceHeight};
 // Identical normalized anatomical targets in all stages; local bone coordinates are calibrated per original rig.
 const cx=(idleWorld.left+idleWorld.right)/2,w=idleWorld.right-idleWorld.left,h=referenceHeight;
 const targets={body:{bone:bodyBone,normalized:[0,.5],world:[cx,ground[1]+h*.5]},head:{bone:headBone,normalized:[0,1],world:[cx,ground[1]+h]},emit:{bone:emitBone,normalized:[.32,.63],world:[cx+w*.32,ground[1]+h*.63]},accessory:{bone:bodyBone,normalized:[-.2,.58],world:[cx-w*.2,ground[1]+h*.58]}};
 const bindings=Object.fromEntries(Object.entries(targets).map(([k,v])=>[k,{bone:v.bone,normalized:v.normalized,local:toLocal(rest[v.bone],v.world).map(round)}]));
 bindings.ground={bone:'root',world:ground,mode:'fixed depth ground; native animation displacement retained separately'};
 const frames=[],sockets={},unique={},actionBoxes={},nativeDisplacement={},frameEvidence=[];
 let contained=true,mirrorError=0;
 for(const s of samples){
  const frame=await render(ctx,s.action,s.time,camera),buffer=Buffer.from(frame.png.split(',')[1],'base64'),box=await pixels(buffer);
  if(box.count===0)throw Error('Empty '+id+' '+s.action+' '+s.index);
  if(box.x<2||box.y<2||box.x+box.w>254||box.y+box.h>254)contained=false;
  const cropped=await sharp(buffer).extract({left:box.x,top:box.y,width:box.w,height:box.h}).png().toBuffer();
  (unique[s.action]??=new Set()).add(sha(buffer));(actionBoxes[s.action]??=[]).push(box);
  frames.push({key:s.action+'_'+s.index,buffer:cropped,box:{x:box.x,y:box.y,w:box.w,h:box.h}});
  const points={ground:screen(ground)};for(const [key,b] of Object.entries(bindings))if(key!=='ground')points[key]=screen(toWorld(frame.bones[b.bone],b.local));
  const displacement=[(frame.bones.scale?.x??0)-(rest.scale?.x??0),(frame.bones.scale?.y??0)-(rest.scale?.y??0)];
  (nativeDisplacement[s.action]??=[]).push(displacement.map(round));
  const mirrored=Object.fromEntries(Object.entries(points).map(([k,p])=>[k,[round(2*anchor[0]*256-p[0]),p[1]]]));
  for(const key of Object.keys(points))mirrorError=Math.max(mirrorError,Math.abs((mirrored[key][0]-anchor[0]*256)+(points[key][0]-anchor[0]*256)));
  (sockets[s.action]??=[]).push({...points,mirrored,nativeDisplacement:displacement.map(round)});
  frameEvidence.push({action:s.action,index:s.index,box,sha256:sha(buffer),bones:frame.bones});
  if(s.index===0||s.index===Math.floor(info.actions[s.action].count*.5))await writeFile(join(group,'evidence',id+'-'+s.action+'-'+s.index+'.png'),buffer);
 }
 if(!contained)throw Error('Clipped frame '+id);
 if(Object.values(unique).some(u=>u.size<3))throw Error('Static clip '+id);
 const idleTop=Math.min(...actionBoxes.idle.map(b=>b.y)),idleBottom=Math.max(...actionBoxes.idle.map(b=>b.y+b.h));
 referencePixelHeight=Math.max(idleBottom-idleTop,anchor[1]*256-idleTop,idleBottom-anchor[1]*256);
 referenceHeight=referencePixelHeight*units;scale=form.height/referencePixelHeight;
 const displayBoundsFor=(boxes,factor=1)=>({minX:round((Math.min(...boxes.map(b=>b.x))-anchor[0]*256)*scale*factor),maxX:round((Math.max(...boxes.map(b=>b.x+b.w))-anchor[0]*256)*scale*factor),minY:round((Math.min(...boxes.map(b=>b.y))-anchor[1]*256)*scale*factor),maxY:round((Math.max(...boxes.map(b=>b.y+b.h))-anchor[1]*256)*scale*factor)});
 const actions={};for(const [key,m] of Object.entries(info.actions)){
  const b=displayBoundsFor(actionBoxes[key]),verticalExtent=Math.max(b.maxY-b.minY,-b.minY,b.maxY),displayScale=verticalExtent<=form.height?1:Math.min(1,(form.height-2.4)/verticalExtent);
  actions[key]={...m,fps:30,loop:['idle','move'].includes(key),fallback:false,provenance:'complete original native animation',displayScale,displayBounds:displayBoundsFor(actionBoxes[key],displayScale),frames:Array.from({length:m.count},(_,i)=>key+'_'+i),containsBuiltInEffects:info.slots.some(s=>/texiao|^tx|guang|huo/i.test(s.name))};
 }
 if(actions.idle.displayScale<.999)throw Error('Idle exceeds 75px '+id);
 // Bake a constant camera fit for an entire clip. Existing atlas consumers need only profile.scale.
 for(const [key,a] of Object.entries(actions)){
  const factor=a.displayScale;a.bakedPresentationScale=factor;a.displayScale=1;
  if(factor<1){
   const span=camera.span/factor,fitCamera={cell:256,span,cx:ground[0]-(anchor[0]-.5)*span,cy:ground[1]+(anchor[1]-.5)*span};
   actionBoxes[key]=[];
   for(let i=0;i<a.count;i++){
    const sample=await render(ctx,key,i/30,fitCamera),buffer=Buffer.from(sample.png.split(',')[1],'base64'),box=await pixels(buffer),f=frames.find(f=>f.key===key+'_'+i);
    if(box.x<2||box.y<2||box.x+box.w>254||box.y+box.h>254)throw Error('Fitted clip clipped '+id);
    f.box={x:box.x,y:box.y,w:box.w,h:box.h};f.buffer=await sharp(buffer).extract({left:box.x,top:box.y,width:box.w,height:box.h}).png().toBuffer();actionBoxes[key].push(box);
    const socket=sockets[key][i];for(const k of ['ground','body','head','emit','accessory']){socket[k]=socket[k].map((v,j)=>round(anchor[j]*256+(v-anchor[j]*256)*factor));socket.mirrored[k]=[round(2*anchor[0]*256-socket[k][0]),socket[k][1]];}
    const ev=frameEvidence.find(f=>f.action===key&&f.index===i);ev.box=box;ev.sha256=sha(buffer);ev.bakedPresentationScale=factor;
    if(i===0||i===Math.floor(a.count*.5))await writeFile(join(group,'evidence',id+'-'+key+'-'+i+'.png'),buffer);
   }
  }
  a.displayBounds=displayBoundsFor(actionBoxes[key]);
  if(Math.max(a.displayBounds.maxY-a.displayBounds.minY,-a.displayBounds.minY,a.displayBounds.maxY)>form.height)throw Error('75px envelope failed '+id+' '+key);
 }
 frames.sort((a,b)=>b.box.h-a.box.h);const width=2048;let x=0,y=0,row=0;
 for(const f of frames){if(x+f.box.w+4>width){x=0;y+=row;row=0;}f.x=x+2;f.y=y+2;x+=f.box.w+4;row=Math.max(row,f.box.h+4);}const height=y+row;
 if(height>8192)throw Error('Atlas height '+height);
 const dir=join(out,id);await mkdir(dir,{recursive:true});
 const atlas={frames:Object.fromEntries(frames.map(f=>[f.key,{frame:{x:f.x,y:f.y,w:f.box.w,h:f.box.h},rotated:false,trimmed:true,spriteSourceSize:f.box,sourceSize:{w:256,h:256}}])),meta:{app:'PA1 original Spine 3.6 hardware exporter',image:'actor.png',format:'RGBA8888',size:{w:width,h:height},scale:1}};
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(frames.map(f=>({input:f.buffer,left:f.x,top:f.y}))).png().toFile(join(dir,'actor.png'));
 await json(join(dir,'actor.json'),atlas);
 await json(join(dir,'sockets.json'),{frameSize:256,fps:30,ground,anchor,coordinateSpace:'untrimmed 256px frame; scale by profile.scale; clip camera fit already baked; mirror about anchor.x',bindings,source:'native Spine 3.6 bone transforms with normalized rest-pose anatomical calibration',emitNote:pet.family==='C4'?'原生发射口 pao；正面偏上校准':pet.family==='D1'?'无明显嘴部，正面中心偏上，绑定 body2':'嘴/头部正面偏上，原生骨骼局部坐标绑定',actions:sockets});
 const profile={id,name:pet.name+'·'+form.label,island:pet.island,family:pet.family,stage:form.stage,form:form.key,variant:!!form.variant,kind:'atlas',image:'/art/starsea/pets/v4-sample/'+id+'/actor.png',atlas:'/art/starsea/pets/v4-sample/'+id+'/actor.json',sockets:'/art/starsea/pets/v4-sample/'+id+'/sockets.json',displayHeight:form.height,referenceHeight,referencePixelHeight,anchor,scale,nativeFacing:1,fps:30,frameSize:256,displayBounds:displayBoundsFor(frames.map(f=>f.box)),actions,displayRule:'whole idle alpha vertical envelope as reference height; per-action uniform ground-anchored fit to per-stage height vertical envelope; native geometry/timeline unchanged',locomotion:{playbackRange:[1,1.6],testedSpeed:1.6,groundAnchorFixed:true,worldTranslation:'not implemented (no follow AI); synchronize external travel to native gait before gameplay integration'}};
 await json(join(dir,'profile.json'),profile);
 const sourcePaths=[join(info.dir,name+'.json'),join(info.dir,name+'.atlas'),...info.pages.map(p=>join(info.dir,p)),join(info.dir,name+'.spine')];
 const sourceFiles=[];for(const p of sourcePaths)sourceFiles.push(await record(p));
 const definitionPath=join(group,'sources',id+'.json');await json(definitionPath,{pet,form,palette:tuning,bindings,sourceFiles,accessorySource:'无新增；仅保留原生附件',bones:info.bones,slots:info.slots});
 const files=[];for(const p of [join(dir,'actor.png'),join(dir,'actor.json'),join(dir,'sockets.json'),join(dir,'profile.json'),definitionPath])files.push(await record(p));
 const diagnostic={id,gpu:info.gpu,version:info.version,frameCount:frames.length,uniqueFrames:Object.fromEntries(Object.entries(unique).map(([k,v])=>[k,v.size])),allFramesContained:contained,mirrorMaxError:mirrorError,displayHeight:form.height,actualIdleHeight:idleBox.h*scale,camera,anchor,referenceHeight,actions:Object.fromEntries(Object.entries(actions).map(([k,a])=>[k,{displayScale:a.displayScale,displayBounds:a.displayBounds}])),sourceHashesComplete:sourceFiles.every(f=>f.sha256.length===64),socketsComplete:Object.entries(sockets).every(([k,frames])=>frames.length===actions[k].count&&frames.every(f=>['ground','body','head','emit','accessory'].every(s=>f[s]?.length===2))),groundDriftAt1_6:Math.max(...sockets.move.map(f=>Math.hypot(f.ground[0]-anchor[0]*256,f.ground[1]-anchor[1]*256))),status:'geometry-checked; locomotion and visual review pending'};
 await json(join(group,'evidence',id+'-diagnostics.json'),diagnostic);await json(join(group,'evidence',id+'-frames.json'),frameEvidence);
 const entry={id,name:profile.name,type:'pet',chapters:[pet.chapter],source:{mode:form.variant?'reuse':'adaptation',path:sourcePaths[0].replaceAll('\\','/'),sha256:sourceFiles[0].sha256,nativeVersion:info.version,stage:form.stage,family:pet.family,adjustments:['30fps original native animation; complete timeline; no invented poses','Actual alpha bounds for reference size and transparent trimming','Uniform ground-anchored action presentation scale for per-stage height vertical limit',form.variant?'b/d original colours retained':'Painted PNG palette; no slot color or darkColor overrides'],palette:tuning,accessorySource:'无新增',files:sourceFiles,bones:info.bones,slots:info.slots},files,runtime:profile,actions,states:{available:Object.keys(actions),skill:actions.skill?'skill':'无',enter:'程序演出，待做',recall:'程序演出，待做',petting:'程序演出，待做',linkSkill:'由 Claude 亲手做，本批不制作'},dependencies:sourceFiles.map(f=>f.path),status:'producer-review-pending',notes:{preview:'/art/starsea/pets/v4-sample/preview/index.html',diagnostics:rel(join(group,'evidence',id+'-diagnostics.json')),gameplayBinding:'not-integrated',rootAcceptance:'pending'}};
 assets=assets.filter(a=>a.id!==id);assets.push(entry);
 const manifest={schemaVersion:1,group:'pets',version:'starsea-20261018-pets-pa5-sample',requirementsVersion:'pet-tier-ladder-sample-20261018',assets};await json(manifestPath,manifest);await json(join(out,'manifest.json'),manifest);
 console.log(id,frames.length,'frames',form.height+'px','actionFits',Object.fromEntries(Object.entries(actions).map(([k,v])=>[k,+v.bakedPresentationScale.toFixed(3)])));
}}finally{await ctx.close();}
