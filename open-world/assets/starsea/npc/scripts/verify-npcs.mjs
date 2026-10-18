import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'../../../..'),group=join(root,'assets/starsea/npc'),out=join(group,'evidence'),origin=process.env.STARSEA_NPC_ORIGIN??'http://127.0.0.1:8612';await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(join(group,'manifest.json'),'utf8')),req=JSON.parse(await readFile(join(root,'docs/starsea/requirements.json'),'utf8')),original=JSON.parse(await readFile(join(root,'assets/mini-hero/navy/runtime/Character.json'),'utf8'));
const report={passed:false,designVersion:req.version,version:manifest.version,origin,checks:[],runtimeSamples:[],errors:[],limits:['Headless Edge/SwiftShader verifies pixel rendering and native motion, not hardware GPU performance.','Resources are not yet bound to the new campaign or NPC following AI.','Talk is native Cast2 gesture; read/repair use native Life_Crafting. No lip-sync or page-turning claim.','Clothing body silhouettes remain native mini-hero; profession accessories are independent authored regions.']};
let browser,context,page,video;
try{
 assert.deepEqual(manifest.assets.map(a=>a.id).sort(),req.npcs.map(a=>a.id).sort());
 const allFiles=[...manifest.sharedFiles,...manifest.nativeSourceFiles,...manifest.productionFiles,...manifest.assets.flatMap(a=>a.files)];
 for(const file of allFiles){const data=await readFile(isAbsolute(file.path)?file.path:join(root,file.path));assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.path);}
 report.checks.push({name:'all-7-required-ids-and-file-hashes',files:allFiles.length});
 const parts=JSON.parse(await readFile(join(group,'source/accessory-regions.json'),'utf8'));
 for(const actor of manifest.assets){
  const profile=JSON.parse(await readFile(join(root,'apps/web/public',actor.runtime.profile),'utf8')),json=JSON.parse(await readFile(join(root,'apps/web/public',profile.runtime.json),'utf8'));
  for(const key of ['bones','animations','ik','transform','physics'])assert.deepEqual(json[key],original[key],actor.id+': native '+key+' changed');
  assert.equal(profile.runtime.pma,true);assert.equal(json.skeleton.spine,'4.2.43');
  assert(profile.acceptedBodySets.includes(actor.runtime.bodySetId));assert(profile.weapons[actor.runtime.bodySetId]);assert(Object.values(actor.runtime.renderAppearance.parts).every(p=>p.setId===actor.runtime.bodySetId));
  const handParts=profile.accessorySockets.filter(s=>s.bone==='RIGHTHAND'||s.bone==='LEFTHAND'),grips=[];
  for(const socket of handParts){const item=Object.values(parts).find(p=>p.region===socket.region),t=socket.localTransform,{data,info}=await sharp(join(root,item.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(t.rotation,0);const x=Math.floor((.5-t.x/t.width)*info.width),y=Math.floor((.5+t.y/t.height)*info.height);assert(x>=0&&y>=0&&x<info.width&&y<info.height);const alpha=data[(y*info.width+x)*4+3];assert(alpha>16,actor.id+': tool grip falls in transparent pixels '+socket.region);grips.push({region:socket.region,bone:socket.bone,gripPixel:[x,y],alpha});
  }
  report.checks.push({name:'original-geometry-clips-preserved-and-grip-alpha',id:actor.id,grips});
 }
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}});page=await context.newPage();video=page.video();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/art/starsea/npc/'))report.errors.push(r.status()+': '+r.url());});
 await page.goto(origin+'/art/starsea/npc/preview/index.html');await page.waitForFunction(()=>window.starseaNpc?.inspect().ready===7,{timeout:30000});
 const size=await page.locator('canvas').evaluateAll(cs=>cs.map(c=>({buffer:[c.width,c.height],css:[c.getBoundingClientRect().width,c.getBoundingClientRect().height]})));assert(size.every(s=>s.buffer[0]===s.css[0]&&s.buffer[1]===s.css[1]));
 report.checks.push({name:'1280x720-canvas-css-exact-1to1',size});
 await page.evaluate(()=>window.starseaNpc.setPaused(true));
 const actions=['idle','move','talk','read','repair','point','hurt','death'];
 for(const action of actions){
  const duration=manifest.assets[0].actions[action].duration,frames=[];
  for(let step=0;step<16;step++){
   const time=duration*step/16;await page.evaluate(({action,time})=>{window.starseaNpc.setAction(action);window.starseaNpc.seek(time);window.starseaNpc.setFacing(-1);},{action,time});await page.waitForTimeout(22);
   const snapshot=await page.evaluate(()=>({state:window.starseaNpc.inspect(),pixels:[...document.querySelectorAll('canvas')].map(c=>{const ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;let n=0,x0=c.width,y0=c.height,x1=-1,y1=-1,h=2166136261;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const p=(y*c.width+x)*4;if(d[p+3]>8){n++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);h=Math.imul(h^d[p],16777619);h=Math.imul(h^d[p+1],16777619);h=Math.imul(h^d[p+2],16777619);}}return{occupied:n,bounds:[x0,y0,x1,y1],hash:h>>>0};})}));
   assert.equal(snapshot.state.ready,7);assert(snapshot.state.actors.every(a=>a.errors.length===0));
   snapshot.pixels.forEach((p,i)=>{assert(p.occupied>500,manifest.assets[i].id+': empty actor');assert(p.bounds[0]>0&&p.bounds[1]>0&&p.bounds[2]<219&&p.bounds[3]<219,manifest.assets[i].id+': clipping');});
   snapshot.state.actors.forEach(a=>assert.deepEqual(a.sockets.feet,{x:110,y:176}));frames.push({time,pixels:snapshot.pixels,poses:snapshot.state.actors.map(a=>({id:a.id,clip:a.native.sourceAnimation,sourceTime:a.native.sourceTime,frame:a.frame,hand:a.sockets.hand,feet:a.sockets.feet}))});
  }
  for(let i=0;i<7;i++)assert(new Set(frames.map(f=>f.pixels[i].hash)).size>=5,manifest.assets[i].id+': no real changing motion '+action);
  report.runtimeSamples.push({action,duration,frames});
  await page.screenshot({path:join(out,`npc-${action}-1to1-1280x720.png`)});
  const unmirrored=await page.evaluate(()=>window.starseaNpc.inspect());await page.evaluate(()=>window.starseaNpc.setFacing(1));await page.waitForTimeout(40);const mirrored=await page.evaluate(()=>window.starseaNpc.inspect());
  for(let i=0;i<7;i++){const a=unmirrored.actors[i],b=mirrored.actors[i];assert.notEqual(a.flip,b.flip);for(const name of ['feet','chest','head','hand','leftHand','rightHand']){assert(Math.abs(a.sockets[name].x+b.sockets[name].x-220)<1e-5,name+' mirror X');assert(Math.abs(a.sockets[name].y-b.sockets[name].y)<1e-5,name+' mirror Y');}}
  await page.screenshot({path:join(out,`npc-${action}-mirrored-1280x720.png`)});report.checks.push({name:'native-changing-frames-fixed-feet-and-all-sockets-mirror',action,frames:16});
 }
 await page.evaluate(()=>{window.starseaNpc.setAction('move');window.starseaNpc.setPaused(false);});await page.waitForTimeout(350);const running=await page.evaluate(()=>window.starseaNpc.inspect());await page.waitForTimeout(350);const later=await page.evaluate(()=>window.starseaNpc.inspect());assert(later.clock>running.clock);assert(later.actors.every((a,i)=>a.frame!==running.actors[i].frame));
 await page.evaluate(()=>window.starseaNpc.setPaused(true));await page.waitForTimeout(40);const paused=await page.evaluate(()=>window.starseaNpc.inspect());await page.waitForTimeout(180);const still=await page.evaluate(()=>window.starseaNpc.inspect());assert.deepEqual(still,paused);assert.equal(await page.locator('#pause').textContent(),'继续');assert((await page.locator('#status').textContent()).includes('已暂停'));await page.locator('#pause').click();await page.waitForTimeout(40);assert.equal(await page.locator('#pause').textContent(),'暂停');assert((await page.locator('#status').textContent()).includes('持续播放'));report.checks.push({name:'real-clock-advances-pause-freezes-native-physics-and-status-matches-buttons'});
 // Recorded playback contains the actual browser renderer, both directions and all clips.
 for(const action of actions){await page.evaluate(action=>{window.starseaNpc.setAction(action);window.starseaNpc.setFacing(-1);window.starseaNpc.setPaused(false);},action);await page.waitForTimeout(650);await page.evaluate(()=>window.starseaNpc.setFacing(1));await page.waitForTimeout(450);}
 assert.deepEqual(report.errors,[]);report.passed=true;report.finished=new Date().toISOString();
 for(const asset of manifest.assets){asset.status='producer-reviewed';asset.producerReview={report:'assets/starsea/npc/evidence/self-review.json',passed:true,requiredActionsVerified:actions,rootAcceptance:'pending'};}
 await writeFile(join(group,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(root,'apps/web/public/art/starsea/npc/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}catch(error){report.error=error.stack;process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});console.error(error);}
finally{await page?.close();await context?.close();if(video){const path=await video.path();await rename(path,join(out,'npc-native-dynamic-1280x720.webm')).catch(()=>{});}await browser?.close();await writeFile(join(out,'self-review.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,evidence:out}));
