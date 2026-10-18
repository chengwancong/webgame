import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import ts from 'typescript';
import {chromium} from 'playwright';
const vendor=resolve('tools/vendor/spine36'),source=resolve('assets/actors/wushi'),output=resolve(source,'effect-attachments');await mkdir(output,{recursive:true});
const nativeActors=JSON.parse(await readFile('assets/actors/monsters.json','utf8')).actors;
const meta=JSON.parse(await readFile(resolve(source,'rendered/render.json'),'utf8'));
const binary=ts.transpileModule(await readFile(vendor+'/SkeletonBinary.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.None}}).outputText;
const server=createServer(async(req,res)=>{try{const p=req.url.split('?')[0];if(p==='/binary.js'){res.setHeader('Content-Type','application/javascript');res.end(binary);return;}if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="512" height="512"></canvas><script src="/spine-webgl.js"></script><script>Object.assign(window,spine)</script><script src="/binary.js"></script>');return;}const parts=p.split('/'),other=parts[1]==='other'?nativeActors[parts[2]]:undefined;const file=other?resolve(other.source,parts[3]):p.startsWith('/actor/')?resolve(source,p.slice(7)):resolve(vendor,p.slice(1));res.setHeader('Content-Type',({'.js':'application/javascript','.png':'image/png'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 const sockets=await page.evaluate(async meta=>{
  const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true}),image=new Image();image.src='/actor/hero_wushi.png';await image.decode();
  const texture=new spine.webgl.GLTexture(gl,image),atlas=new spine.TextureAtlas(await(await fetch('/actor/hero_wushi.atlas')).text(),()=>texture);
  const data=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(await(await fetch('/actor/hero_wushi.skel')).arrayBuffer()),renderer=new spine.webgl.SceneRenderer(canvas,gl);
  renderer.camera.position.x=meta.camera.cx;renderer.camera.position.y=meta.camera.cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=meta.camera.span*2;
  const pose=(action,index)=>{const s=new spine.Skeleton(data),state=new spine.AnimationState(new spine.AnimationStateData(data));state.setAnimation(0,meta.actions[action].source,false);state.update(index/meta.fps);state.apply(s);s.updateWorldTransform();return s;};
  const convert=(x,y)=>[(x-meta.camera.cx)/meta.camera.span*256+128,(meta.camera.cy-y)/meta.camera.span*256+128];
  const actions={};
  for(const [action,info] of Object.entries(meta.actions))actions[action]=Array.from({length:info.count},(_,index)=>{
   const s=pose(action,index),get=name=>{const bone=s.findBone(name);if(!bone)throw Error('Missing attachment bone '+name);return convert(bone.worldX,bone.worldY);};
   const weaponSlot=s.findSlot('chuizi'),attachment=weaponSlot.getAttachment();let weapon=get('chuizi');
   if(attachment){const count=attachment.worldVerticesLength??8,vertices=new Float32Array(count);if(attachment.worldVerticesLength)attachment.computeWorldVertices(weaponSlot,0,count,vertices,0,2);else attachment.computeWorldVertices(weaponSlot.bone,vertices,0,2);let x=0,y=0;for(let i=0;i<count;i+=2){x+=vertices[i];y+=vertices[i+1];}weapon=convert(x/(count/2),y/(count/2));}
   return {feet:convert(0,0),chest:get('AttackedNode'),muzzle:get('ProjectileInitNode'),hand:get('L_hand'),weapon};
  });
  window.renderHeroFX=(action,index,layer)=>{const s=pose(action,index);for(const slot of s.slots){const name=slot.data.name,isFX=name.startsWith('tx_'),back=name.includes('/hou/');if(!isFX||(layer==='back')!==back)slot.setAttachment(null);}gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(s,false);renderer.end();return canvas.toDataURL();};
  return {source:'hero_wushi.skel',sourceCamera:meta.camera,frameSize:256,fxFrameSize:512,fxAnchor:[.5-meta.camera.cx/(meta.camera.span*2),.5+meta.camera.cy/(meta.camera.span*2)],fps:meta.fps,actions};
 },meta);
 for(const action of ['attack','skill'])for(let index=0;index<meta.actions[action].count;index++)for(const layer of ['back','front']){
  const png=await page.evaluate(({action,index,layer})=>window.renderHeroFX(action,index,layer),{action,index,layer});await writeFile(resolve(output,`${action}_${index}_${layer}.png`),Buffer.from(png.split(',')[1],'base64'));
 }
 await writeFile(resolve('packages/asset-manifest/hero-sockets.json'),JSON.stringify(sockets,null,2)+'\n');
 const native={};for(const [key,actor] of Object.entries(nativeActors)){
  const render=JSON.parse(await readFile(resolve(actor.source,'export.json'),'utf8')).animation_mapping;const cell=key.includes('boss')?512:256;
  native[key]=await page.evaluate(async({key,base,render,cell})=>{
   const atlas=new spine.TextureAtlas(await(await fetch('/other/'+key+'/'+base+'.atlas')).text(),()=>({setFilters(){},setWraps(){},getImage(){return {width:2048,height:2048};}}));const data=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(await(await fetch('/other/'+key+'/'+base+'.skel')).arrayBuffer());
   const actions={};for(const [action,info] of Object.entries(render.actions))actions[action]=Array.from({length:info.count},(_,index)=>{
    const skeleton=new spine.Skeleton(data),state=new spine.AnimationState(new spine.AnimationStateData(data));state.setAnimation(0,info.source,false);state.update(index/render.fps);state.apply(skeleton);skeleton.updateWorldTransform();
    const get=(names)=>{const bone=names.map(name=>skeleton.findBone(name)).find(Boolean);if(!bone)throw Error('No source socket '+key+'/'+names);return [(bone.worldX-render.camera.cx)/render.camera.span*cell+cell/2,(render.camera.cy-bone.worldY)/render.camera.span*cell+cell/2];};
    return {feet:get(['root']),chest:get(['AttackedNode','Body','Face','root']),muzzle:get(['ProjectileInitNode','L_hand','R_hand','Face','root']),hand:get(['L_hand','R_hand','Face','root']),weapon:get(['chuizi','ProjectileInitNode','R_hand','L_hand','Face','root'])};
   });return {source:base+'.skel',frameSize:cell,fps:render.fps,actions};
  },{key,base:actor.base,render,cell});
 }
 await writeFile(resolve('packages/asset-manifest/native-actor-sockets.json'),JSON.stringify(native)+'\n');console.log('Exported original per-frame hand, weapon, muzzle and impact sockets; native front/back effects.');
}finally{await browser.close();server.close();}
