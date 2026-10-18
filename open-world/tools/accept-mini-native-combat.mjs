import assert from 'node:assert/strict';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const origin=process.env.AW_MINI_ORIGIN??'http://127.0.0.1:8612';
const evidence=resolve(process.env.AW_MINI_CONTROLLED_EVIDENCE??resolve(root,'../docs/reviews/open-world/mini-hero-integration-20261002/controlled'));
await mkdir(evidence,{recursive:true});
const result={passed:false,steps:[],checks:[],errors:[],apiWrites:[],limits:[
  'Uses actual World and Phaser in the existing isolated combat fixture; no real player ownership or database is changed.',
  'Headless Edge uses SwiftShader, so this does not certify native GPU performance.',
  'Private fixture inspection is injected only into this browser response and is not a production game mutator.',
]};
let browser,context,page,video;

// This response-only hook observes the real fixture and steps its existing controls.
const hook=String.raw`
const nativeFixtureEvents=[];
const nativeFixtureStep=bridge.step.bind(bridge);
bridge.step=function(){
 const before=this.world.tick;nativeFixtureStep();
 if(this.world.tick!==before)for(const event of this.world.events)nativeFixtureEvents.push(structuredClone(event));
};
window.miniCombatQA={scene,bridge,scenario,events:nativeFixtureEvents,
 async prepare(setId,family,skill){
  scenario(skill);bridge.world.paused=true;nativeFixtureEvents.length=0;
  bridge.resolvedAppearance={rig:'modular-hero',family,styleProfile:'v2-soft',revision:1,
   parts:{head:{setId:'100011'},body:{setId:'100041'},hands:{setId:'100011'},legs:{setId:'100011'},feet:{setId:'100011'},back:{setId:'100011'},weapon:{setId}}};
 },
 cast(){bridge.world.paused=false;document.querySelector('#cast').click();bridge.world.paused=true;},
  snapshot(){
  const original=window.awCombatQA(),actor=scene.actors.get('hero'),wrapper=actor?.wardrobe,painter=wrapper?.painter;
  const canvas=painter?.canvas;let hash=0,alpha=0;
  if(canvas){const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   for(let i=0;i<rgba.length;i+=4){if(rgba[i+3])alpha++;hash=(hash*31+rgba[i]+rgba[i+1]+rgba[i+2]+rgba[i+3])>>>0;}}
  return {...original,events:structuredClone(nativeFixtureEvents),deathElapsed:scene.heroDeathPlayback.elapsed,
   rendererPixels:{alpha,hash},canvas:canvas?{width:canvas.width,height:canvas.height}:null};
 },
 socketProof(){
  const actor=scene.actors.get('hero'),wrapper=actor.wardrobe,painter=wrapper.painter,bundle=painter.bundle;
  const diagnostics=scene.attachmentDiagnostics(),profile=bundle.profile,scale=painter.options.height/profile.referenceHeight;
  const mirror=painter.mirrored?-1:1,pose=diagnostics.pose;
  return Object.fromEntries(['weapon','muzzle'].map(name=>{
   const calibration=bundle.weapon.sockets[name];
   if(!calibration){const b=bundle.playback.skeleton.findBone('RIGHTHAND'),expected={x:pose.position.x+(b.worldX-profile.ground[0])*scale*mirror,y:pose.position.y-(b.worldY-profile.ground[1])*scale};
    const actual=diagnostics.points[name];return [name,{source:diagnostics.wardrobe.socketSources[name],actual,expected,error:Math.hypot(actual.x-expected.x,actual.y-expected.y),policy:'native-hand'}];}
   const slot=bundle.playback.skeleton.findSlot(calibration.slot),a=slot.getAttachment(),b=slot.bone;
   const [px,py]=calibration.pixel,[width,height]=calibration.imageSize;
   const lx=(px/width-.5)*a.width*a.scaleX,ly=(.5-py/height)*a.height*a.scaleY,theta=a.rotation*Math.PI/180;
   const x=lx*Math.cos(theta)-ly*Math.sin(theta)+a.x,y=lx*Math.sin(theta)+ly*Math.cos(theta)+a.y;
   const wx=b.a*x+b.b*y+b.worldX,wy=b.c*x+b.d*y+b.worldY;
   const expected={x:pose.position.x+(wx-profile.ground[0])*scale*mirror,y:pose.position.y-(wy-profile.ground[1])*scale};
   const actual=diagnostics.points[name];
   // Interpolate the original attachment UV quad, including atlas rotation/trim,
   // then inspect the actual loaded atlas pixel at the calibrated source point.
   let u,v;
   for(const tri of [[0,1,2],[2,3,0]]){
    const [i,j,k]=tri.map(n=>n*2),o=a.offset;
    const d=(o[j+1]-o[k+1])*(o[i]-o[k])+(o[k]-o[j])*(o[i+1]-o[k+1]);
    if(Math.abs(d)<1e-9)continue;
    const p=((o[j+1]-o[k+1])*(x-o[k])+(o[k]-o[j])*(y-o[k+1]))/d;
    const q=((o[k+1]-o[i+1])*(x-o[k])+(o[i]-o[k])*(y-o[k+1]))/d,r=1-p-q;
    if(Math.min(p,q,r)<-1e-5)continue;
    u=a.uvs[i]*p+a.uvs[j]*q+a.uvs[k]*r;v=a.uvs[i+1]*p+a.uvs[j+1]*q+a.uvs[k+1]*r;break;
   }
   let alpha=null;
   if(Number.isFinite(u)&&Number.isFinite(v)){
    const image=a.region.texture.getImage(),sample=document.createElement('canvas');sample.width=sample.height=1;
    const ctx=sample.getContext('2d');ctx.drawImage(image,Math.floor(u*image.width),Math.floor(v*image.height),1,1,0,0,1,1);alpha=ctx.getImageData(0,0,1,1).data[3];
   }
   return [name,{source:diagnostics.wardrobe.socketSources[name],pixel:calibration.pixel,imageSize:calibration.imageSize,
    attachment:a.name,regionTrim:[a.region.offsetX,a.region.offsetY],actual,expected,error:Math.hypot(actual.x-expected.x,actual.y-expected.y),alpha}];
  }));
 }
};
`;

try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:resolve(evidence,'video'),size:{width:1280,height:720}}});
 page=await context.newPage();video=page.video();page.on('pageerror',error=>result.errors.push(error.message));
 await page.routeWebSocket('**',()=>{});
 await page.route('**/api/**',async route=>{if(!['GET','HEAD'].includes(route.request().method())){result.apiWrites.push({url:route.request().url(),method:route.request().method()});await route.abort();}else await route.continue();});
 await page.route(/\/src\/combat-art-qa\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\n'+hook});});
 await page.goto(origin+'/combat-art-qa.html');
 await page.waitForFunction(()=>window.miniCombatQA?.scene.sys?.isActive()&&window.awCombatQA().attachments.wardrobe?.ready,null,{timeout:60000});
 result.profile=await page.evaluate(async()=>await(await fetch('/art/mini-hero/navy/profile.json')).json());
 const snapshot=()=>page.evaluate(()=>window.miniCombatQA.snapshot());
 const frame=async()=>{
  const before=(await snapshot()).tick;await page.locator('#frame').click();
  await page.waitForFunction(tick=>window.miniCombatQA.bridge.stepFrames===0&&window.awCombatQA().tick===tick+1,before);
  return snapshot();
 };
 const prepare=async(setId,family,skill)=>{
  await page.evaluate(async args=>await window.miniCombatQA.prepare(...args),[setId,family,skill]);
  await page.waitForFunction(setId=>{const q=window.miniCombatQA,s=q.snapshot();return q.scene.previousWorld===q.bridge.world&&s.tick===0&&s.alive&&s.paused&&s.rendererPixels.alpha>100&&s.attachments.wardrobe?.ready&&!s.attachments.wardrobe.pending&&s.attachments.wardrobe.parts.weapon===setId&&s.attachments.pose.frame.startsWith('mini-')&&s.attachments.wardrobe.native.sourceAnimation==='Wait1';},setId,{timeout:60000});
 };
 for(const preset of [{setId:'100011',family:'sword',skill:'cut'},{setId:'300601',family:'sword',skill:'cut'},{setId:'400105',family:'magic',skill:'bolt'}]){
  await prepare(preset.setId,preset.family,preset.skill);
  const initial=await snapshot();assert(initial.rendererPixels.alpha>100,'native hero must contain real visible artwork');
  await page.evaluate(()=>window.miniCombatQA.cast());
  const timeline=[];let released;
  for(let i=0;i<120;i++){
   const state=await frame();timeline.push(state);
   if(state.events.some(event=>event.type==='cast_released'&&event.id==='hero')){released=state;break;}
  }
  assert(released,`${preset.setId}: real World must release the cast`);
  const started=released.events.find(event=>event.type==='cast_started'&&event.id==='hero'),release=released.events.find(event=>event.type==='cast_released'&&event.id==='hero');
  assert(started);assert.equal(release.tick-started.tick,started.windup);
  const d=released.attachments.wardrobe,motion=result.profile.weapons[preset.setId].actions[preset.skill==='bolt'?'projectile':'attack'];
  assert.equal(d.native.sourceAnimation,motion.name);
  assert(Math.abs(d.native.mappedTime-motion.impactTime)<1e-8,`${preset.setId}: mapped pose must hit source impact at windup boundary`);
  assert(Math.abs(d.native.sourceTime-motion.impactTime)<1e-8,`${preset.setId}: sampled source frame must be the exact impact frame`);
  result.steps.push({weaponSet:preset.setId,skill:preset.skill,castStartedTick:started.tick,windupTicks:started.windup,releasedTick:release.tick,
    sourceAnimation:d.native.sourceAnimation,sourceFrame:d.frame,expectedImpactTime:motion.impactTime,mappedTime:d.native.mappedTime,actualSourceTime:d.native.sourceTime});
  const proof=await page.evaluate(()=>window.miniCombatQA.socketProof());
  for(const [name,socket] of Object.entries(proof)){assert(socket.error<1e-5,`${preset.setId}/${name}: attachment pixel must follow the drawn bone transform`);assert(socket.source.startsWith('native-attachment:'),`${preset.setId}/${name}: published calibration must be used`);assert(socket.alpha>16,`${preset.setId}/${name}: socket must be on the actual packed art`);}
  await page.screenshot({path:resolve(evidence,`${preset.setId}-release-right.png`)});
  await page.waitForTimeout(180);const frozen=await snapshot();
  assert.equal(frozen.tick,released.tick);assert.equal(frozen.attachments.wardrobe.frame,d.frame);
  assert.equal(frozen.attachments.wardrobe.native.physicsSteps,d.native.physicsSteps);assert.deepEqual(frozen.attachments.points,released.attachments.points);assert.deepEqual(frozen.rendererPixels,released.rendererPixels);
  const right=frozen;await page.locator('#flip').click();await page.waitForFunction(before=>{const s=window.awCombatQA();return s.facing===-before.facing&&s.attachments.wardrobe.flip!==before.flip;},{facing:right.facing,flip:right.attachments.wardrobe.flip});
  const left=await snapshot();assert.equal(left.attachments.wardrobe.flip,!right.attachments.wardrobe.flip);
  for(const name of ['head','chest','hand','weapon','muzzle']){assert(Math.abs(right.attachments.wardrobe.sockets[name].x+left.attachments.wardrobe.sockets[name].x-right.canvas.width)<1e-5);assert.equal(right.attachments.wardrobe.sockets[name].y,left.attachments.wardrobe.sockets[name].y);}
  const mirrorProof=await page.evaluate(()=>window.miniCombatQA.socketProof());for(const value of Object.values(mirrorProof))assert(value.error<1e-5);
  await page.screenshot({path:resolve(evidence,`${preset.setId}-release-left.png`)});
  const next=await frame();assert.equal(next.tick,right.tick+1);assert(next.attachments.wardrobe.native.physicsSteps>d.native.physicsSteps);
  result.checks.push({name:'real-world-native-release-pause-mirror-step',preset,initial,started,release,timeline,released,frozen,proof,left,mirrorProof,next});
 }

 // A dead World must remain stopped while the presentation clock completes Die.
 await prepare('100011','sword','cut');
 await page.locator('#pause').click();await page.waitForFunction(()=>!window.awCombatQA().paused&&window.awCombatQA().tick>0);
 await page.locator('#dead').click();await page.waitForFunction(()=>!window.awCombatQA().alive&&window.awCombatQA().attachments.wardrobe.frame.startsWith('mini-death_'));
 const deadFirst=await snapshot();await page.waitForFunction(()=>window.miniCombatQA.snapshot().deathElapsed>=1.49,null,{timeout:10000});
 const deadFinal=await snapshot();assert.equal(deadFinal.tick,deadFirst.tick);assert.equal(deadFinal.attachments.wardrobe.native.sourceAnimation,'Die');
 assert(Math.abs(deadFinal.attachments.wardrobe.native.sourceTime-1.5)<1e-8);assert.equal(deadFinal.attachments.wardrobe.frame,'mini-death_90');assert.notEqual(deadFirst.rendererPixels.hash,deadFinal.rendererPixels.hash);
 await page.screenshot({path:resolve(evidence,'death-complete-1500ms.png')});

 // Freeze midway, then the existing single-frame control advances death only.
 await prepare('100011','sword','cut');await page.locator('#pause').click();await page.waitForFunction(()=>!window.awCombatQA().paused);
 await page.locator('#dead').click();await page.waitForFunction(()=>!window.awCombatQA().alive&&window.miniCombatQA.snapshot().deathElapsed>=.15);
 await page.locator('#pause').click();await page.waitForFunction(()=>window.awCombatQA().paused);
 const deathPause=await snapshot();await page.waitForTimeout(180);const deathStill=await snapshot();
 assert.equal(deathPause.tick,deathStill.tick);assert.equal(deathPause.deathElapsed,deathStill.deathElapsed);assert.equal(deathPause.attachments.wardrobe.frame,deathStill.attachments.wardrobe.frame);assert.deepEqual(deathPause.attachments.points,deathStill.attachments.points);
 await page.locator('#frame').click();await page.waitForFunction(before=>window.miniCombatQA.bridge.stepFrames===0&&window.miniCombatQA.snapshot().deathElapsed>before,deathPause.deathElapsed);
 const deathStep=await snapshot();assert.equal(deathStep.tick,deathPause.tick);assert(Math.abs(deathStep.deathElapsed-deathPause.deathElapsed-1/30)<1e-8);
 await page.screenshot({path:resolve(evidence,'death-pause-single-frame.png')});
 await prepare('100011','sword','cut');const revived=await snapshot();assert.equal(revived.deathElapsed,0);assert(revived.alive);assert.equal(revived.attachments.wardrobe.native.sourceAnimation,'Wait1');assert(revived.attachments.wardrobe.native.sourceTime<.05);
 await page.screenshot({path:resolve(evidence,'scenario-revival-reset.png')});
  result.checks.push({name:'death-completes-without-simulation-ticks-and-pause-single-step-revival',deadFirst,deadFinal,deathPause,deathStill,deathStep,revived});
 // Use the actual loaded preview constructor so this is the same shared GPU module
 // instance, not another HMR/dynamic-import copy of the renderer.
 await page.evaluate(()=>{
  const q=window.miniCombatQA,Preview=q.scene.actors.get('hero').wardrobe.painter.constructor;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
  canvas.style.cssText='position:fixed;right:16px;top:175px;width:384px;height:384px;z-index:200;background:#102b40;border:1px solid #547080';
  document.body.append(canvas);q.ui={canvas,preview:new Preview(canvas,{height:240,footX:.5,footY:.8,fitBounds:true})};
 });
 const uiSamples=[];
 for(const preset of [{setId:'100011',family:'sword',clock:5/60},{setId:'300601',family:'sword',clock:10/60},{setId:'400105',family:'magic',clock:28/60}])for(const facing of [-1,1]){
  const sample=await page.evaluate(async({preset,facing})=>{
   const q=window.miniCombatQA,{canvas,preview}=q.ui;
   await preview.setAppearance({...q.bridge.resolvedAppearance,family:preset.family,parts:{...q.bridge.resolvedAppearance.parts,weapon:{setId:preset.setId}}});
   preview.render({action:'attack',clock:preset.clock,facing});
   const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let minX=canvas.width,maxX=-1,minY=canvas.height,maxY=-1;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(rgba[(y*canvas.width+x)*4+3]>16){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
   return {preset,facing,diagnostics:preview.diagnostics(),bounds:{minX,maxX:maxX+1,minY,maxY:maxY+1},canvas:[canvas.width,canvas.height]};
  },{preset,facing});
  assert(sample.diagnostics.ready&&sample.diagnostics.native.fitBounds);assert(sample.diagnostics.native.displayScale<240/result.profile.referenceHeight);
  assert(sample.bounds.minX>=8&&sample.bounds.minY>=8&&sample.bounds.maxX<=sample.canvas[0]-8&&sample.bounds.maxY<=sample.canvas[1]-8,`${preset.setId}: actual UI pixels must be within the 8px protected canvas border`);
  uiSamples.push(sample);await page.screenshot({path:resolve(evidence,`${preset.setId}-ui-highest-${facing===1?'right':'left'}.png`)});
 }
 await page.evaluate(()=>{window.miniCombatQA.ui.preview.destroy();window.miniCombatQA.ui.canvas.remove();});
 result.checks.push({name:'fitted-ui-three-native-weapon-highest-poses-both-mirrors-no-clipping',samples:uiSamples});
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.apiWrites,[]);result.passed=true;
 await context.close();await copyFile(await video.path(),resolve(evidence,'controlled-operations.webm'));
 await writeFile(resolve(evidence,'result.json'),JSON.stringify(result,null,2));
 console.log('Mini native 3 weapons: real cast/release/impact, source-pixel sockets, pause/physics freeze, mirror, step, death/revival passed.');
}catch(error){
 result.failure=String(error);await page?.screenshot({path:resolve(evidence,'failure.png')}).catch(()=>{});
 if(page)result.lastSnapshot=await page.evaluate(()=>window.miniCombatQA?.snapshot()).catch(()=>null);
 await writeFile(resolve(evidence,'failure.json'),JSON.stringify(result,null,2));throw error;
}finally{await context?.close().catch(()=>{});await browser?.close();}
