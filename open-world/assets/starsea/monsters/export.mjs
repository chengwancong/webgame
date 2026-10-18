import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {resolve,join,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import {chromium} from 'playwright';
import sharp from 'sharp';
import ts from 'typescript';
import {definitions,generatedSources} from './definitions.mjs';
const group=dirname(fileURLToPath(import.meta.url)),root=resolve(group,'../../..');
const publicRoot=join(root,'apps/web/public'),out=join(publicRoot,'art/starsea/monsters');
const originalGen='C:/Users/ccc/.codex/generated_images/01a10241-ae21-7762-ab79-68b275dac56a';
const sha=b=>createHash('sha256').update(b).digest('hex'),rel=p=>p.startsWith(root)?p.slice(root.length+1).replaceAll('\\','/'):p;
const json=async(p,v)=>{await mkdir(dirname(p),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');};
for(const dir of ['sources','preview','evidence']){await mkdir(join(group,dir),{recursive:true});await mkdir(join(out,dir),{recursive:true});}
const clean={'dock-hook':'exec-d7685086-c685-4e65-ba34-5debc67e864a.png','dragon-horns':'exec-f050c42d-1510-44c9-bf98-4c0a86fcce34.png'};
const genRecords=[];let accessoryAtlas='';
for(const [key,file] of Object.entries(generatedSources)){
 const raw=join(originalGen,clean[key]??file),dest=join(group,'sources',key+'-imagegen.png');try{await stat(dest);}catch{await copyFile(raw,dest);}
 const normalized=join(group,'sources',key+'.png');
 if(key.endsWith('atlas')){await sharp(dest).resize(512,512,{fit:'fill'}).png().toFile(normalized);}
 else{
  if(key==='dusk-clasp'){const straight=join(group,'sources/dusk-clasp-straight.png');await sharp(dest).trim({threshold:1}).resize({width:512,height:512,fit:'inside'}).png().toFile(straight);await copyFile(straight,join(out,'sources/dusk-clasp-straight.png'));}
  const normalizedRaw=await sharp(dest).trim({threshold:1}).resize({width:512,height:512,fit:'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Technical alpha encoding only, not painting/recolouring: the native 4.2 rig uses PMA blending.
  const {data,info}=normalizedRaw;for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;data[i]=Math.round(data[i]*a);data[i+1]=Math.round(data[i+1]*a);data[i+2]=Math.round(data[i+2]*a);}
  await sharp(data,{raw:info}).png().toFile(normalized);
  accessoryAtlas+=`\n${key}.png\nsize: ${info.width},${info.height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\npma: true\n${key}\nbounds: 0,0,${info.width},${info.height}\nrotate: false\n`;
 }
 await copyFile(normalized,join(out,'sources',key+'.png'));
 genRecords.push({id:key,tool:'built-in image_gen',rawPath:raw,rawSha256:sha(await readFile(dest)),retainedSource:rel(dest),normalized:rel(normalized),normalizedSha256:sha(await readFile(normalized)),operation:key.endsWith('atlas')?'Mechanical 512px resample, unchanged atlas layout':'Transparent trim, resample, technical PMA conversion',promptSummary:key.endsWith('atlas')?'Preserve all original wolf UV positions and shapes; recolour existing parts to '+(key.startsWith('wind')?'cream-tan, cyan-brass':'blue-white, silver-blue'):'Single detachable hand-painted chibi '+key+' with true alpha; no exterior glow or shadow'});
}
await writeFile(join(out,'sources/accessories.atlas'),accessoryAtlas);await writeFile(join(group,'sources/accessories.atlas'),accessoryAtlas);await json(join(group,'sources/imagegen-provenance.json'),genRecords);
await build({configFile:false,root,logLevel:'error',build:{lib:{entry:join(group,'native-runtime.ts'),formats:['es'],fileName:()=> 'native-runtime.js'},outDir:join(out,'sources'),emptyOutDir:false,minify:false,target:'esnext'}});
const binary=ts.transpileModule(await readFile(join(root,'tools/vendor/spine36/SkeletonBinary.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.None}}).outputText;
const server=createServer(async(req,res)=>{try{const url=decodeURIComponent(req.url.split('?')[0]);
 if(url==='/mini-export'){res.setHeader('Content-Type','text/html');res.end('<canvas width="512" height="512"></canvas><script type="module" src="/art/starsea/monsters/sources/native-runtime.js"></script>');return;}
 if(url==='/sp-export'){res.setHeader('Content-Type','text/html');res.end('<canvas width="512" height="512"></canvas><script src="/spine-webgl.js"></script><script>Object.assign(window,spine)</script><script src="/binary.js"></script>');return;}
 if(url==='/binary.js'){res.setHeader('Content-Type','application/javascript');res.end(binary);return;}
 const file=url==='/spine-webgl.js'?join(root,'tools/vendor/spine36/spine-webgl.js'):url.startsWith('/source/')?resolve(root,url.slice(8)):resolve(publicRoot,url.slice(1));
 if(!file.startsWith(root))throw Error('Path outside workspace');res.setHeader('Content-Type',({'.json':'application/json','.js':'application/javascript','.html':'text/html','.png':'image/png','.atlas':'text/plain'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
const req=JSON.parse(await readFile(join(root,'docs/starsea/requirements.json'),'utf8'));
const selectedIds=process.argv.find(a=>a.startsWith('--ids='))?.slice(6).split(',');
const list=req.monsters.filter(r=>(!process.argv.includes('--first')||r.chapter.includes(1))&&(!selectedIds||selectedIds.includes(r.id)));
const manifestPath=join(group,'manifest.json');let old;try{old=JSON.parse(await readFile(manifestPath,'utf8'));}catch{}
const assets=old?.assets?.filter(a=>!list.some(r=>r.id===a.id))??[];
const diagnostics=[];
const sourceFile=async path=>{const file=resolve(root,path),buffer=await readFile(file),meta=extname(file)==='.png'?await sharp(buffer).metadata():undefined;return {path:rel(file),sha256:sha(buffer),bytes:buffer.length,...(meta?{width:meta.width,height:meta.height,alpha:meta.hasAlpha}: {})};};
try{for(const requirement of list){
 const config={...definitions[requirement.id],id:requirement.id};if(!config.kind)throw Error('Missing definition '+requirement.id);
 let actions,bones=[];
 if(config.kind==='mini42'){
  await page.goto(base+'/mini-export');await page.waitForFunction(()=>window.monsterNative?.ready);actions=await page.evaluate(c=>window.monsterNative.configure(c),config);
 }else{
  await page.goto(base+'/sp-export');
  const info=await page.evaluate(async c=>{
   const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true});
   const img=new Image();img.src=c.texture?'/art/starsea/monsters/'+c.texture:'/source/'+c.source+'/'+c.base+'.png';await img.decode();
   const texture=new spine.webgl.GLTexture(gl,img),atlas=new spine.TextureAtlas(await(await fetch('/source/'+c.source+'/'+c.base+'.atlas')).text(),()=>texture);
   const data=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(await(await fetch('/source/'+c.source+'/'+c.base+'.skel')).arrayBuffer());
   const renderer=new spine.webgl.SceneRenderer(canvas,gl,true),map={idle:'Idle',move:'Movement',attack:'Attack1',hurt:'BeAttacked',death:'Deaded',skill:'Skill'};
   const actions=Object.fromEntries(Object.entries(map).map(([key,source])=>{const a=data.findAnimation(source);if(!a)throw Error('Missing original '+source);return [key,{source,duration:a.duration,count:Math.ceil(a.duration*30)}];}));
   for(const [name,color] of Object.entries(c.darkTints??{})){const slot=data.findSlot(name);if(!slot)throw Error('Missing native tinted slot '+name);slot.darkColor=new spine.Color();slot.darkColor.setFromString(color);}
   const skeleton=new spine.Skeleton(data),state=new spine.AnimationState(new spine.AnimationStateData(data));let badge,badgeMount,badgeImage;
   if(c.overlays?.some(o=>o.asset==='dusk-clasp')){const im=new Image();im.src='/art/starsea/monsters/sources/dusk-clasp-straight.png';await im.decode();badgeImage=im;const tx=new spine.webgl.GLTexture(gl,im),extra=new spine.TextureAtlas(`\ndusk-clasp-straight.png\nsize: ${im.width},${im.height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\ndusk-clasp\n rotate: false\n xy: 0, 0\n size: ${im.width}, ${im.height}\n orig: ${im.width}, ${im.height}\n offset: 0, 0\n index: -1\n`,()=>tx);badge=new spine.RegionAttachment('dusk-clasp');badge.setRegion(extra.findRegion('dusk-clasp'));badge.width=60;badge.height=66;}
   window.spMonster={render(action,time,camera){skeleton.setToSetupPose();state.setAnimation(0,map[action],false);state.update(time);state.apply(skeleton);for(const s of skeleton.slots)if(/diying|touying|^tx[_/]|^xuejian/i.test(s.data.name))s.setAttachment(null);
    for(const [name,color] of Object.entries(c.tints??{})){const slot=skeleton.findSlot(name),alpha=slot.color.a;slot.color.setFromString(color);slot.color.a=alpha;}
    for(const [name,color] of Object.entries(c.darkTints??{}))skeleton.findSlot(name).darkColor.setFromString(color);
    for(const [name,scale] of Object.entries(c.boneScale??{})){const bone=skeleton.findBone(name);if(!bone)throw Error('Missing adjusted native bone '+name);bone.scaleX*=scale[0];bone.scaleY*=scale[1];}
    skeleton.updateWorldTransform();
    if(badge){const body=skeleton.findSlot('qugan'),part=body.getAttachment(),o=c.overlays.find(o=>o.asset==='dusk-clasp'),slot=skeleton.findSlot(o.slot);if(part instanceof spine.RegionAttachment){const b=body.bone;if(!badgeMount){const [dx,dy]=o.calibrationWorldOffset,det=b.a*b.d-b.b*b.c;badgeMount=[(b.d*dx-b.b*dy)/det,(b.a*dy-b.c*dx)/det];}badge.x=badgeMount[0];badge.y=badgeMount[1];badge.rotation=part.rotation;badge.color.a=1;badge.updateOffset();slot.bone=body.bone;slot.color.set(1,1,1,body.color.a);slot.setAttachment(badge);}else slot.setAttachment(null);}
    skeleton.updateWorldTransform();const offset=new spine.Vector2(),size=new spine.Vector2();skeleton.getBounds(offset,size,[]);
    if(camera){canvas.width=canvas.height=camera.cell;gl.viewport(0,0,camera.cell,camera.cell);renderer.camera.position.x=camera.cx;renderer.camera.position.y=camera.cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=camera.span;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,false);renderer.end();}
    const convert=p=>camera?[camera.cell*(.5+(p.x-camera.cx)/camera.span),camera.cell*(.5-(p.y-camera.cy)/camera.span)]:p;
    const bonePoint=name=>{const b=skeleton.findBone(name);return b?{x:b.worldX,y:b.worldY}:undefined;};
    const natives=skeleton.slots.filter(s=>s.getAttachment()).map(s=>{const a=s.getAttachment();return {name:s.data.name,bone:s.bone.data.name,attachment:a.name,x:s.bone.worldX,y:s.bone.worldY};});
    // These names are verified in source-anatomy.json. Original generic "muzzle=feet" records are not reused.
    const chosen=c.base==='hero_xiaolang'?{head:'bone4',chest:'bone2',hand:'bone21',weapon:'bone4'}:{head:'bone4',chest:'bone2',hand:'bone22',weapon:'bone23'};
    const p=name=>bonePoint(chosen[name]);
    function regionPoint(slotName,u,v){const slot=skeleton.findSlot(slotName),a=slot?.getAttachment();if(!(a instanceof spine.RegionAttachment))return;
     const x=(u-.5)*a.width*a.scaleX,y=(v-.5)*a.height*a.scaleY,r=a.rotation*Math.PI/180;
     return {x:slot.bone.a*(x*Math.cos(r)-y*Math.sin(r)+a.x)+slot.bone.b*(x*Math.sin(r)+y*Math.cos(r)+a.y)+slot.bone.worldX,
             y:slot.bone.c*(x*Math.cos(r)-y*Math.sin(r)+a.x)+slot.bone.d*(x*Math.sin(r)+y*Math.cos(r)+a.y)+slot.bone.worldY};}
    const weapon=(c.base==='hero_xiaolang'?(regionPoint('tou2',.94,.38)??regionPoint('fennu2',.94,.38)):regionPoint('qiang',.985,.58))??p('weapon');
    const sockets={feet:convert({x:c.ground?.[0]??0,y:c.ground?.[1]??0}),chest:convert(p('chest')),head:convert(p('head')),hand:convert(p('hand')),weapon:convert(weapon),muzzle:convert(weapon),ground:convert({x:0,y:c.ground?.[1]??0})};
    let png=camera?canvas.toDataURL():undefined;
    if(camera&&badge&&badgeImage){const body=skeleton.findSlot('qugan'),b=body.bone,px=camera.cell/camera.span,world={x:b.a*badge.x+b.b*badge.y+b.worldX,y:b.c*badge.x+b.d*badge.y+b.worldY},point=convert(world),combined=document.createElement('canvas');combined.width=combined.height=camera.cell;const context=combined.getContext('2d');context.drawImage(canvas,0,0);context.save();context.globalAlpha=body.getAttachment()?body.color.a:0;context.translate(point[0],point[1]);context.rotate(-Math.atan2(b.c,b.a)-badge.rotation*Math.PI/180);context.drawImage(badgeImage,-badge.width*px/2,-badge.height*px/2,badge.width*px,badge.height*px);context.restore();png=combined.toDataURL();}
    return {png,bounds:{minX:offset.x,minY:offset.y,maxX:offset.x+size.x,maxY:offset.y+size.y},sockets,natives};
   },setGround(p){c.ground=p;}};
   return {version:data.version,actions,bones:data.bones.map(b=>b.name),slots:data.slots.map(s=>({name:s.name,bone:s.boneData.name})),sample:window.spMonster.render('idle',.1)};
  },config);actions=info.actions;bones=info.bones;
  await json(join(group,'evidence',requirement.id+'-source-anatomy.json'),info);
 }
 const render=(action,time,camera)=>page.evaluate(({kind,action,time,camera})=>kind==='mini42'?window.monsterNative.render(action,time,camera):window.spMonster.render(action,time,camera),{kind:config.kind,action,time,camera});
 const idle=await render('idle',.1);const all=[];
 for(const [action,motion] of Object.entries(actions))for(let i=0;i<motion.count;i++)all.push((await render(action,i/30)).bounds);
 const union={minX:Math.min(...all.map(b=>b.minX))-20,maxX:Math.max(...all.map(b=>b.maxX))+20,minY:Math.min(...all.map(b=>b.minY))-20,maxY:Math.max(...all.map(b=>b.maxY))+20};
 const referenceHeight=idle.bounds.maxY-idle.bounds.minY,cell=256,span=Math.max(union.maxX-union.minX,union.maxY-union.minY),camera={cell,span,cx:(union.minX+union.maxX)/2,cy:(union.minY+union.maxY)/2};
 const ground=config.kind==='mini42'?config.ground:[0,idle.bounds.minY];if(config.kind!=='mini42')await page.evaluate(ground=>window.spMonster.setGround(ground),ground);
 const anchor=[.5+(ground[0]-camera.cx)/span,.5-(ground[1]-camera.cy)/span],scale=requirement.height/(referenceHeight*cell/span);
 const frames=[],sockets={},unique={};let contained=true;
 for(const [action,motion] of Object.entries(actions)){sockets[action]=[];unique[action]=new Set();
  for(let i=0;i<motion.count;i++){
   const sample=await render(action,i/30,camera),buffer=Buffer.from(sample.png.split(',')[1],'base64');
   const raw=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});const {data,info}=raw;
   let l=cell,t=cell,r=-1,b=-1;for(let y=0;y<cell;y++)for(let x=0;x<cell;x++)if(data[(y*cell+x)*4+3]>3){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
   const empty=r<0;if(empty){l=t=0;r=b=0;}else if(l<2||t<2||r>cell-3||b>cell-3)contained=false;
   const width=r-l+1,height=b-t+1,cropped=await sharp(buffer).extract({left:l,top:t,width,height}).png().toBuffer();
   unique[action].add(sha(buffer));frames.push({key:action+'_'+i,buffer:cropped,box:{x:l,y:t,w:width,h:height},empty});sockets[action].push(sample.sockets);
   if(i===Math.floor(motion.count*.25))await writeFile(join(group,'evidence',requirement.id+'-'+action+'.png'),buffer);
  }
 }
 if(!contained)throw Error('Clipped native frame '+requirement.id);
 if(Object.values(unique).some(s=>s.size<3))throw Error('Static action '+requirement.id);
 frames.sort((a,b)=>b.box.h-a.box.h);const width=2048;let x=0,y=0,row=0;
 for(const frame of frames){if(x+frame.box.w+4>width){x=0;y+=row;row=0;}frame.x=x+2;frame.y=y+2;x+=frame.box.w+4;row=Math.max(row,frame.box.h+4);}
 const height=y+row;if(height>8192)throw Error('Atlas too large '+height);
 const runtimeDir=join(out,requirement.id);await mkdir(runtimeDir,{recursive:true});
 const atlas={frames:{},meta:{app:'starsea original Spine exporter',image:'actor.png',format:'RGBA8888',size:{w:width,h:height},scale:1}};
 for(const frame of frames)atlas.frames[frame.key]={frame:{x:frame.x,y:frame.y,w:frame.box.w,h:frame.box.h},rotated:false,trimmed:true,spriteSourceSize:frame.box,sourceSize:{w:cell,h:cell}};
 await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(frames.map(f=>({input:f.buffer,left:f.x,top:f.y}))).png().toFile(join(runtimeDir,'actor.png'));
 await json(join(runtimeDir,'actor.json'),atlas);await json(join(runtimeDir,'sockets.json'),{frameSize:cell,fps:30,ground,anchor,source:config.kind==='mini42'?'native bone and RegionAttachment transforms':'native 3.6.32 anatomy',actions:sockets});
 const profile={id:requirement.id,name:requirement.name,image:'/art/starsea/monsters/'+requirement.id+'/actor.png',atlas:'/art/starsea/monsters/'+requirement.id+'/actor.json',sockets:'/art/starsea/monsters/'+requirement.id+'/sockets.json',displayHeight:requirement.height,referenceHeight,anchor,scale,nativeFacing:config.nativeFacing,fps:30,frameSize:cell,actions:Object.fromEntries(Object.entries(actions).map(([key,m])=>[key,{...m,fps:30,loop:['idle','move'].includes(key),fallback:false,provenance:'complete original native animation',frames:Array.from({length:m.count},(_,i)=>key+'_'+i)}])),skillIds:requirement.skills};
 profile.displayBounds={minX:(Math.min(...frames.map(f=>f.box.x))-anchor[0]*cell)*scale,maxX:(Math.max(...frames.map(f=>f.box.x+f.box.w))-anchor[0]*cell)*scale,minY:(Math.min(...frames.map(f=>f.box.y))-anchor[1]*cell)*scale,maxY:(Math.max(...frames.map(f=>f.box.y+f.box.h))-anchor[1]*cell)*scale};
 await json(join(runtimeDir,'profile.json'),profile);await json(join(group,'sources',requirement.id+'-definition.json'),config);
 const filePaths=[join(runtimeDir,'actor.png'),join(runtimeDir,'actor.json'),join(runtimeDir,'sockets.json'),join(runtimeDir,'profile.json'),join(group,'sources',requirement.id+'-definition.json')];
 const sourcePaths=config.kind==='mini42'?['assets/mini-hero/navy/runtime/Character.json','assets/mini-hero/navy/runtime/Character.atlas','assets/mini-hero/navy/runtime/Character.png','assets/mini-hero/navy/runtime/Character_2.png']:[config.source+'/'+config.base+'.skel',config.source+'/'+config.base+'.atlas',config.source+'/'+config.base+'.png'];
 for(const ov of config.overlays??[]){sourcePaths.push(rel(join(group,'sources',ov.asset+'-imagegen.png')),rel(join(group,'sources',ov.asset+'.png')));}if(config.overlays?.length)sourcePaths.push(rel(join(group,'sources/accessories.atlas')));if(config.kind==='sp33'&&config.overlays?.length)sourcePaths.push(rel(join(group,'sources/dusk-clasp-straight.png')));if(config.texture)sourcePaths.push(rel(join(group,config.texture)),rel(join(group,'sources',config.texture.split('/')[1].replace('.png','-imagegen.png'))));
 const files=await Promise.all([...filePaths.map(rel),...sourcePaths].map(sourceFile));
 const measurements={id:requirement.id,nativeVersion:config.kind==='mini42'?'4.2.43':'3.6.32',referenceHeight,scale,camera,anchor,ground,frameCount:frames.length,uniqueFrames:Object.fromEntries(Object.entries(unique).map(([k,s])=>[k,s.size])),allFramesContained:contained,atlasSize:[width,height],nativeFacing:config.nativeFacing,skills:requirement.skills,sourceBones:bones,headwearCalibration:idle.headwearCalibration,status:'producer-reviewed',limitations:['New art identities are not bound into the production enemy simulation.','Root acceptance and production login checks are separate.']};
 await json(join(group,'evidence',requirement.id+'-diagnostics.json'),measurements);diagnostics.push(measurements);
 assets.push({id:requirement.id,name:requirement.name,type:requirement.rank==='elite'?'elite':'monster',chapters:requirement.chapter,
 source:{mode:'adaptation',path:sourcePaths[0],sha256:files.find(f=>f.path===sourcePaths[0]).sha256,nativeVersion:measurements.nativeVersion,adjustments:[...(config.adjustments??[]),'Native action export at 30 FPS, no fabricated two-pose animation',...(config.skins?['Distinct native outfit combination: '+config.skins.join(', ')]:[]),...(Object.keys(config.tints??{}).length?['Native slot colour multipliers; original textured contours preserved']:[]),...(config.darkTints?['Native two-colour tint (editable Spine slot properties); no procedural texture repaint']:[]),...(config.overlays??[]).map(o=>'Original native '+o.bone+' attachment replaced with imagegen '+o.asset)],imagegen:genRecords.filter(g=>config.texture?.includes(g.id)||(config.overlays??[]).some(o=>o.asset===g.id))},files,runtime:{kind:'atlas',...profile},actions:profile.actions,states:{alive:['idle','move','attack','hurt','skill'],dead:['death']},dependencies:sourcePaths,status:'producer-reviewed',notes:{ruleReference:requirement.rule,visualSkillReferences:requirement.skills,requirementAppearance:requirement.appearance,preview:'/art/starsea/monsters/preview/index.html',diagnostics:rel(join(group,'evidence',requirement.id+'-diagnostics.json')),gameplayBinding:'not-integrated',rootAcceptance:'pending'}});
 console.log(requirement.id,frames.length,Object.fromEntries(Object.entries(unique).map(([k,s])=>[k,s.size])));
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
await json(manifestPath,{schemaVersion:1,group:'monsters',version:'starsea-20261003-monsters-v1',requirementsVersion:req.version,assets:assets.sort((a,b)=>req.monsters.findIndex(r=>r.id===a.id)-req.monsters.findIndex(r=>r.id===b.id)),notes:'21 separate content identities; shared original skeletons counted separately from imagegen accessories and skins. Runtime resources only; no new production gameplay content.'});
await copyFile(manifestPath,join(out,'manifest.json'));
await json(join(group,'evidence/export-summary.json'),{count:assets.length,requirementsCount:req.monsters.length,sampledAt:'2026-10-03',diagnostics});
