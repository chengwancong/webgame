import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import ts from 'typescript';
import {chromium} from 'playwright';
const root=resolve('tools/vendor/spine36');
const actorKey=process.argv[2];
const config=actorKey?JSON.parse(await readFile('assets/actors/monsters.json','utf8')).actors[actorKey]:{source:'assets/actors/wushi',base:'hero_wushi'};
if(!config)throw Error('Unknown actor '+actorKey);
const output=resolve(config.source,'rendered');
await (await import('node:fs/promises')).mkdir(output,{recursive:true});
const source=resolve(config.source);
const binary=ts.transpileModule(await readFile(root+'/SkeletonBinary.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.None}}).outputText;

const server=createServer(async(req,res)=>{try{const p=decodeURIComponent(req.url.split('?')[0]);if(p==='/binary.js'){res.setHeader('Content-Type','application/javascript');res.end(binary);return;}if(p==='/'){res.setHeader('Content-Type','text/html');res.end('<canvas width="256" height="256"></canvas><script src="/spine-webgl.js"></script><script>Object.assign(window,spine)</script><script src="/binary.js"></script>');return;}const file=p.startsWith('/actor/')?resolve(source,p.slice(7)):resolve(root,p.slice(1));res.setHeader('Content-Type',({'.js':'application/javascript','.png':'image/png'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try{
const page=await browser.newPage();page.on('pageerror',e=>console.log('PAGE',e.message));await page.goto('http://127.0.0.1:'+server.address().port);
const summary=await page.evaluate(async(config)=>{
const canvas=document.querySelector('canvas');const gl=canvas.getContext('webgl',{alpha:true,preserveDrawingBuffer:true});
const image=new Image();image.src='/actor/'+config.base+'.png';await image.decode();
const texture=new spine.webgl.GLTexture(gl,image);const atlas=new spine.TextureAtlas(await (await fetch('/actor/'+config.base+'.atlas')).text(),()=>texture);
const data=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(await (await fetch('/actor/'+config.base+'.skel')).arrayBuffer());
const renderer=new spine.webgl.SceneRenderer(canvas,gl);renderer.camera.position.x=0;renderer.camera.position.y=144;renderer.camera.viewportWidth=renderer.camera.viewportHeight=360;
const map={idle:'Idle',move:'Movement',attack:'Attack1',hurt:'BeAttacked',death:'Deaded',skill:'Skill',win:'Celebrate'};
window.renderActor=(name,time,size=(window.exportSize??256))=>{
canvas.width=canvas.height=size;gl.viewport(0,0,size,size);
const skeleton=new spine.Skeleton(data);const state=new spine.AnimationState(new spine.AnimationStateData(data));state.setAnimation(0,name,false);state.update(time);state.apply(skeleton);
for(const slot of skeleton.slots)if(slot.data.name==='diying'||slot.data.name.startsWith('tx_'))slot.setAttachment(null);
skeleton.updateWorldTransform();const offset=new spine.Vector2(),extent=new spine.Vector2();skeleton.getBounds(offset,extent,[]);window.actorBounds={x:offset.x,y:offset.y,w:extent.x,h:extent.y};gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);renderer.begin();renderer.drawSkeleton(skeleton,false);renderer.end();return canvas.toDataURL();};
for(const name of Object.values(map))if(!data.findAnimation(name))throw Error('Missing '+name+'; available '+data.animations.map(a=>a.name));
window.renderActor('Idle',.1);const idleBounds={...window.actorBounds};
const bounds=[];for(const name of Object.values(map)){const a=data.findAnimation(name);for(let t=0;t<a.duration;t+=1/15){window.renderActor(name,t);bounds.push(window.actorBounds);}}
const left=Math.min(...bounds.map(b=>b.x))-16,right=Math.max(...bounds.map(b=>b.x+b.w))+16,bottom=Math.min(...bounds.map(b=>b.y))-16,top=Math.max(...bounds.map(b=>b.y+b.h))+16;const span=Math.max(right-left,top-bottom);const cx=(left+right)/2,cy=(bottom+top)/2;renderer.camera.position.x=cx;renderer.camera.position.y=cy;renderer.camera.viewportWidth=renderer.camera.viewportHeight=span;
window.exportSize=config.height?512:256;
return {frameSize:window.exportSize,version:data.version,fps:15,anchor:[.5-cx/span,.5+cy/span],scale:config.height?config.height/idleBounds.h*span/256:span/256*.23,idleBounds,displayHeight:config.height,camera:{cx,cy,span},actions:Object.fromEntries(Object.entries(map).map(([key,name])=>{const a=data.findAnimation(name);if(!a)throw Error('Missing '+name);return [key,{source:name,duration:a.duration,count:Math.ceil(a.duration*15)}];}))};
},config);
for(const [action,a] of Object.entries(summary.actions))for(let i=0;i<a.count;i++){
 const png=await page.evaluate(({name,time})=>window.renderActor(name,time),{name:a.source,time:i/summary.fps});
 await writeFile(output+'/'+action+'_'+i+'.png',Buffer.from(png.split(',')[1],'base64'));
}
const portrait=await page.evaluate(()=>window.renderActor('Idle',.1,768));await writeFile(output+'/portrait.png',Buffer.from(portrait.split(',')[1],'base64'));
await writeFile(output+'/render.json',JSON.stringify(summary,null,2));console.log(summary);
}finally{await browser.close();server.close();}
