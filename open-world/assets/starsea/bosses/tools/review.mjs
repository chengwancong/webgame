import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {root,startPreviewServer} from './preview-server.mjs';
const out=join(root,'assets/starsea/bosses/evidence'),pub=join(root,'apps/web/public/art/starsea/bosses');await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(join(root,'assets/starsea/bosses/manifest.json'),'utf8'));
const server=await startPreviewServer(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={passed:false,viewport:{width:1280,height:720},sourceNativeVersion:'4.2.43',runtime:'4.2.120',ids:[],errors:[],limitations:['Browser is headless Edge with SwiftShader; hardware GPU performance is not certified.','Raw source animations and phase attachments reviewed; server skill binding/story gameplay not part of this resource review.']};
try{
 const page=await browser.newPage({viewport:report.viewport});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(server.origin+'/art/starsea/bosses/preview.html');await page.waitForFunction(()=>window.starseaBossQA?.ready||window.starseaBossQA?.errors.length,{timeout:45000});
 assert.deepEqual(await page.evaluate(()=>window.starseaBossQA.errors),[]);
 const contact=[];
 for(const asset of manifest.assets){
  const entry={id:asset.id,clips:[],mirrors:[],states:[],deathPhaseCombinations:[],screenshots:[],video:null};
  await page.evaluate(async id=>{await window.starseaBossQA.select(id);window.starseaBossQA.setSockets(false);},asset.id);
  for(const action of ['idle','move','attack','hurt','death','skill1','skill2','skill3']){
   const start=await page.evaluate(async({id,action})=>window.starseaBossQA.pose(id,action,0),{id:asset.id,action});assert.equal(start.nativeVersion,'4.2.43');assert.equal(start.displayHeight,150);
   const hashes=[],times=[],samples=[];
   for(let n=0;n<=12;n++){
    const t=start.duration*n/12,d=await page.evaluate(async({id,action,t})=>window.starseaBossQA.pose(id,action,t),{id:asset.id,action,t});hashes.push(d.pixelHash);times.push(d.sourceTime);if([0,3,6,9,12].includes(n))samples.push(d);
    assert.equal(d.ready,true);assert.deepEqual(d.errors,[]);assert.equal(d.points.feet.x,420);assert.equal(d.points.feet.y,240);
   }
   assert(new Set(hashes).size>=3,asset.id+'/'+action+' lacks visible continuous movement');
   const left=await page.evaluate(async({id,action,t})=>window.starseaBossQA.pose(id,action,t,'default',-1),{id:asset.id,action,t:start.duration*.35});
   const right=await page.evaluate(async({id,action,t})=>window.starseaBossQA.pose(id,action,t,'default',1),{id:asset.id,action,t:start.duration*.35});
   for(const name of ['hand','weapon','chest','phase']){assert(Math.abs(left.points[name].x+right.points[name].x-840)<1e-7);assert(Math.abs(left.points[name].y-right.points[name].y)<1e-7);}
   assert((left.weaponAttachment.alphaAtCalibratedPoint??0)>0,asset.id+' weapon socket points into empty alpha');
   entry.clips.push({action,animation:start.actualAnimation,sourceAnimation:start.sourceAnimation,duration:start.duration,distinctSamplePixels:new Set(hashes).size,samples});entry.mirrors.push({action,left:left.points,right:right.points,weaponAlpha:left.weaponAttachment.alphaAtCalibratedPoint});
  }
  for(const state of ['default','phase-enter','phase-active','phase-end']){
   const poses=[];for(const t of [0,.25,.6,1])poses.push(await page.evaluate(async({id,state,t})=>window.starseaBossQA.pose(id,'idle',t,state),{id:asset.id,state,t}));
   entry.states.push({state,poses});await page.evaluate(async({id,state})=>window.starseaBossQA.pose(id,'idle',.6,state),{id:asset.id,state});
   const file=asset.id+'-'+state+'.png';await page.screenshot({path:join(out,file)});entry.screenshots.push('assets/starsea/bosses/evidence/'+file);
   if(state==='default')contact.push(await page.locator('#stage').screenshot());
  }
  for(const state of ['default','phase-enter','phase-active','phase-end']){
   const death=await page.evaluate(async({id,state})=>window.starseaBossQA.pose(id,'death',1.1,state),{id:asset.id,state});
   assert.equal(death.actualAnimation,'SS_death');assert.equal(death.sourceAnimation,'Die');assert(death.weaponSlotAlpha===0);assert(Object.values(death.stageSlotAlpha).every(a=>a===0));
   entry.deathPhaseCombinations.push({state,...death});
  }
  const deathFile=asset.id+'-death-phase-end.png';await page.screenshot({path:join(out,deathFile)});entry.screenshots.push('assets/starsea/bosses/evidence/'+deathFile);
  if(!process.argv.includes('--no-video')){
   // Record every complete source action in real time, plus actual phase clips.
   const base64=await page.evaluate(async id=>{
    const qa=window.starseaBossQA,c=document.querySelector('#stage'),chunks=[];
    const stream=c.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1100000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    const series=['idle','move','attack','hurt','skill1','skill2','skill3','phase-enter','phase-active','phase-end','death','death@phase-enter','death@phase-active','death@phase-end'];
    for(const item of series){const state=item.includes('@')?item.split('@')[1]:item.startsWith('phase')?item:'default',action=item.includes('@')?'death':item.startsWith('phase')?'idle':item;const first=await qa.pose(id,action,0,state,-1),until=performance.now()+first.duration*1000,start=performance.now();
     while(performance.now()<until){qa.seek((performance.now()-start)/1000);await new Promise(resolve=>requestAnimationFrame(resolve));}
     qa.seek(first.duration);await new Promise(resolve=>setTimeout(resolve,70));
    }
    recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/webm'}),bytes=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);
   },asset.id);
   const video=Buffer.from(base64,'base64'),file=asset.id+'-all-actions.webm';assert(video.length>50000);await writeFile(join(out,file),video);await mkdir(join(pub,'evidence'),{recursive:true});await copyFile(join(out,file),join(pub,'evidence',file));entry.video={path:'assets/starsea/bosses/evidence/'+file,url:'/art/starsea/bosses/evidence/'+file,bytes:video.length,sha256:createHash('sha256').update(video).digest('hex')};
  }
  report.ids.push(entry);console.log('Reviewed '+asset.id+': 8 true moving motions, 4 phase states, mirrored actual sockets, death cleanup'+(entry.video?', complete-motion WebM':''));
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
 const tiles=[];for(let i=0;i<contact.length;i++)tiles.push({input:await sharp(contact[i]).resize(560,287).png().toBuffer(),left:(i%2)*560,top:Math.floor(i/2)*287});await sharp({create:{width:1120,height:Math.ceil(contact.length/2)*287,channels:4,background:'#fffdf7'}}).composite(tiles).png().toFile(join(out,'boss-body-contact.png'));
 for(const asset of manifest.assets){const evidence=report.ids.find(e=>e.id===asset.id);asset.status='producer-reviewed';asset.preview.dynamicEvidence=evidence.video?.url;asset.preview.review='assets/starsea/bosses/evidence/review.json';asset.producerReview={passed:true,sourceNativeVersion:'4.2.43',motions:8,phaseStates:4,deathPhaseCombinations:evidence.deathPhaseCombinations.length,allActionsRecorded:!!evidence.video,mirroredSockets:true,deathToolAndStageCleanup:true};}
 await writeFile(join(root,'assets/starsea/bosses/manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(pub,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}finally{await writeFile(join(out,'review.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
