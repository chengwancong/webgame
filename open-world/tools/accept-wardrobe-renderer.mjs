import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const origin=process.env.AW_WARDROBE_ORIGIN??'http://127.0.0.1:8612',evidence=resolve(process.env.AW_WARDROBE_EVIDENCE??'../docs/reviews/open-world/wardrobe-renderer-20261001');
await mkdir(evidence,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:resolve(evidence,'video'),size:{width:1280,height:720}}});let page;
try{
 page=await context.newPage();const video=page.video();page.on('pageerror',error=>errors.push(String(error)));
 // Freeze this test's module graph while other agents edit the shared Vite workspace.
 await page.routeWebSocket('**',()=>{});
 await page.goto(origin);await page.evaluate(async()=>{
  const {WardrobePreview}=await import('/src/wardrobe-renderer.ts');
  const manifest=await (await fetch('/art/wardrobe/manifest.json')).json();
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.style.cssText='position:fixed;top:120px;left:320px;z-index:10000;background:#163e49;border:1px solid #86abae;';document.body.append(canvas);
  const preview=new WardrobePreview(canvas,{height:260,footY:.75}),slots=Object.keys(manifest.partSlots),appearance={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(slots.map((slot,index)=>[slot,{setId:manifest.shippedSets[index%manifest.shippedSets.length]}]))};
  const state={action:'idle',clock:0,facing:1},samples=[];
  let active=true,start=performance.now(),durations=[];
  function animate(now){if(!active)return;state.clock=(now-start)/1000;const t=performance.now();preview.render(state);durations.push(performance.now()-t);requestAnimationFrame(animate);}requestAnimationFrame(animate);
  function pixels(){const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let alpha=0,hash=0;for(let i=0;i<bytes.length;i+=4){if(bytes[i+3])alpha++;hash=(hash*31+bytes[i]+bytes[i+1]+bytes[i+2]+bytes[i+3])>>>0;}return {alpha,hash};}
  window.wardrobeQA={preview,appearance,manifest,state,samples,pixels,durations,stop(){active=false;},setAction(action){state.action=action;start=performance.now();state.clock=0;},setFacing(value){state.facing=value;}};
  window.wardrobeQA.socketProof=()=>{
   const diagnostics=preview.diagnostics(),bundle=preview.bundle,match=/wardrobe-(\w+)_(\d+)/.exec(diagnostics.frame),frame=bundle.motion.actions[match[1]].frames[Number(match[2])];
   const weaponSet=bundle.appearance.parts.weapon.setId,weaponMetadata=bundle.manifest.weaponSockets[weaponSet],attachment=weaponMetadata.attachment??'weapon',setId=attachment==='front_hand'?bundle.appearance.parts.hands.setId:weaponSet,metadata=attachment==='front_hand'?bundle.manifest.handSockets[setId]:weaponMetadata,scale=260/bundle.manifest.referenceHeight,[feetX,feetY]=bundle.manifest.ground;
   const world=new DOMMatrix([scale*(diagnostics.flip?-1:1),0,0,-scale,canvas.width*.5-scale*(diagnostics.flip?-1:1)*feetX,canvas.height*.75+scale*feetY]);
   return Object.fromEntries(['weapon','muzzle'].map(name=>{
    const choices=[[attachment,metadata]];if(weaponMetadata.handPolicy==='leading-hand')choices.push(['back_hand',metadata.backHand]);
    const candidates=choices.map(([partName,calibration])=>{const part=frame.parts.find(part=>part.name===partName),image=bundle.images.get(partName),[x,y]=calibration[name],transform=world.multiply(new DOMMatrix(part.matrix)).translate(-part.width/2,-part.height/2).scale(part.width/image.naturalWidth,part.height/image.naturalHeight),expected=transform.transformPoint(new DOMPoint(x,y));const scratch=document.createElement('canvas');scratch.width=image.naturalWidth;scratch.height=image.naturalHeight;const ctx=scratch.getContext('2d');ctx.drawImage(image,0,0);return {attachment:partName,pixel:[x,y],expected:{x:expected.x,y:expected.y},alpha:ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data[3]};});
    const chosen=candidates.reduce((lead,item)=>(item.expected.x-lead.expected.x)*window.wardrobeQA.state.facing>0?item:lead),actual=preview.socket(name);
    return [name,{source:diagnostics.socketSources[name],setId,...chosen,actual,error:Math.hypot(actual.x-chosen.expected.x,actual.y-chosen.expected.y)}];
   }));
  };
  await preview.setAppearance(appearance);
 });
 const families=['sword','axe','bow','gun','fist','spear','magic'],samples=[];
 for(const family of families){
  await page.evaluate(async family=>{const q=window.wardrobeQA;q.appearance.family=family;q.appearance.parts.weapon={setId:q.manifest.defaultWeaponSets[family]};await q.preview.setAppearance(q.appearance);q.setAction('attack');},family);
  await page.waitForTimeout(150);const first=await page.evaluate(()=>({pixels:window.wardrobeQA.pixels(),...window.wardrobeQA.preview.diagnostics()}));
  await page.waitForTimeout(300);const second=await page.evaluate(()=>({pixels:window.wardrobeQA.pixels(),...window.wardrobeQA.preview.diagnostics()}));
  assert(first.ready&&first.partCount===14);assert(first.pixels.alpha>500);assert.notEqual(first.pixels.hash,second.pixels.hash,`${family} animation must move`);
  const sockets=await page.evaluate(()=>window.wardrobeQA.socketProof());for(const socket of Object.values(sockets)){assert(socket.error<1e-6,`${family}: socket must use the exact drawImage affine transform`);assert(socket.source.startsWith('part:'));assert(socket.alpha>16,`${family}: tip must be on actual art pixels`);}
  samples.push({family,first,second,sockets});await page.screenshot({path:resolve(evidence,`${family}-mixed-parts.png`)});
 }
 await page.evaluate(()=>{const q=window.wardrobeQA;q.stop();q.state.action='idle';q.state.clock=0;q.state.facing=1;q.preview.render(q.state);});
 const right=await page.evaluate(()=>window.wardrobeQA.preview.diagnostics());await page.evaluate(()=>{const q=window.wardrobeQA;q.state.facing=-1;q.preview.render(q.state);});const left=await page.evaluate(()=>window.wardrobeQA.preview.diagnostics());
 assert(Math.abs(right.sockets.weapon.x+left.sockets.weapon.x-640)<1e-6);assert.equal(right.sockets.weapon.y,left.sockets.weapon.y);await page.screenshot({path:resolve(evidence,'mirror.png')});
 const socketFrames=await page.evaluate(async()=>{
  const q=window.wardrobeQA,results=[];
  for(const family of ['sword','axe','bow','gun','fist','spear','magic']){
   const appearance={...q.appearance,family,parts:{...q.appearance.parts,weapon:{setId:q.manifest.defaultWeaponSets[family]}}};await q.preview.setAppearance(appearance);
   for(const action of ['idle','move','attack','skill','projectile','hurt','death'])for(const facing of [-1,1])for(const clock of [0,.15,.3,.5,.8]){q.state={action,facing,clock};q.preview.render(q.state);results.push({family,action,facing,clock,proof:q.socketProof()});}
  }
  return results;
 });
 for(const frame of socketFrames)for(const proof of Object.values(frame.proof)){assert(proof.error<1e-6);assert(proof.source.startsWith('part:'));assert(proof.alpha>16,`${frame.family}/${frame.action}/${frame.facing}: ${JSON.stringify(proof)}`);}
 // The socket sweep ends on death; restore a visible idle pose for resource-retention checks.
 await page.evaluate(()=>{const q=window.wardrobeQA;q.state={action:'idle',facing:1,clock:0};q.preview.render(q.state);});
 // Delayed full outfit must retain old parts until complete; a later request wins.
 await page.route('**/sets/100031/**',async route=>{await new Promise(r=>setTimeout(r,550));await route.continue();});
 const race=await page.evaluate(async()=>{const q=window.wardrobeQA,old=q.preview.diagnostics().key;const slow={...q.appearance,parts:Object.fromEntries(Object.keys(q.appearance.parts).map(slot=>[slot,{setId:'100031'}]))};const load=q.preview.setAppearance(slow);await new Promise(r=>setTimeout(r,60));const during=q.preview.diagnostics();const next={...q.appearance,parts:Object.fromEntries(Object.keys(q.appearance.parts).map(slot=>[slot,{setId:'100011'}]))};const committed=await q.preview.setAppearance(next);await load;q.preview.render(q.state);return {old,during,committed,final:q.preview.diagnostics()};});
 assert.equal(race.old,race.during.key);assert(race.committed);assert(Object.values(race.final.parts).every(id=>id==='100011'));
 await page.route('**/sets/100102/face.png',route=>route.abort('failed'));
 const failed=await page.evaluate(async()=>{const q=window.wardrobeQA;q.failedAppearance={...q.appearance,parts:Object.fromEntries(Object.keys(q.appearance.parts).map(slot=>[slot,{setId:'100102'}]))};const before=q.preview.diagnostics();const ok=await q.preview.setAppearance(q.failedAppearance);q.preview.render(q.state);return {before,ok,after:q.preview.diagnostics(),pixels:q.pixels()};});
 assert.equal(failed.ok,false);assert.equal(failed.before.key,failed.after.key);assert(failed.after.errors.length>0&&failed.pixels.alpha>500);
 await page.unroute('**/sets/100102/face.png');await page.waitForTimeout(5050);
 const recovered=await page.evaluate(async()=>{const q=window.wardrobeQA;const ok=await q.preview.setAppearance(q.failedAppearance);q.preview.render(q.state);return {ok,diagnostics:q.preview.diagnostics(),pixels:q.pixels()};});assert(recovered.ok);assert(Object.values(recovered.diagnostics.parts).every(id=>id==='100102'));
 const pause=await page.evaluate(()=>{const q=window.wardrobeQA;q.state.action='death';q.state.clock=5;q.preview.render(q.state);const before=q.pixels();q.preview.render(q.state);const after=q.pixels();q.state.action='idle';q.state.clock=0;q.preview.render(q.state);return {before,after,revived:q.pixels(),diagnostics:q.preview.diagnostics()};});assert.equal(pause.before.hash,pause.after.hash);assert.notEqual(pause.before.hash,pause.revived.hash);
 const durations=await page.evaluate(()=>window.wardrobeQA.durations),sorted=durations.sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)];
 // Real World + Phaser fixture exercises event-driven preparation, releases, and pause.
 // Expose the existing fixture only in this browser response, without production hooks.
 await page.route(/\/src\/combat-art-qa\.ts(?:\?.*)?$/,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.wardrobeBattleQA={scene,bridge,scenario};'});});
 await page.goto(origin+'/combat-art-qa.html');await page.waitForFunction(()=>window.wardrobeBattleQA?.bridge.world.tick>3);
 await page.evaluate(async()=>{const manifest=await(await fetch('/art/wardrobe/manifest.json')).json();const q=window.wardrobeBattleQA;q.manifest=manifest;q.appearance={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(Object.keys(manifest.partSlots).map(slot=>[slot,{setId:'100011'}]))};q.bridge.resolvedAppearance=q.appearance;});
 await page.waitForFunction(()=>window.wardrobeBattleQA.scene.attachmentDiagnostics().wardrobe?.ready);
 const combat=[];
 for(const family of families){
  await page.evaluate(family=>{const q=window.wardrobeBattleQA;q.appearance={...q.appearance,family,parts:{...q.appearance.parts,weapon:{setId:q.manifest.defaultWeaponSets[family]}}};q.bridge.resolvedAppearance=q.appearance;q.scenario(['bow','gun','magic'].includes(family)?'bolt':'cut');},family);
  await page.waitForFunction(family=>window.wardrobeBattleQA.scene.attachmentDiagnostics().wardrobe.family===family,family);
  await page.locator('#cast').click();await page.waitForFunction(()=>window.awCombatQA().release>0);await page.locator('#pause').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const first=await page.evaluate(()=>window.awCombatQA());assert(first.attachments.wardrobe.ready&&first.attachments.wardrobe.partCount===14);assert(first.attachments.pose.frame.startsWith('wardrobe-'));assert(first.release>0);assert(first.attachments.wardrobe.socketSources.weapon.startsWith('part:'));assert(first.attachments.wardrobe.socketSources.muzzle.startsWith('part:'));
  await page.waitForTimeout(120);const paused=await page.evaluate(()=>window.awCombatQA());assert.equal(first.tick,paused.tick);assert.equal(first.attachments.wardrobe.frame,paused.attachments.wardrobe.frame);assert.deepEqual(first.attachments.points,paused.attachments.points);
  await page.screenshot({path:resolve(evidence,`${family}-battle-release.png`)});await page.locator('#pause').click();await page.waitForFunction(()=>window.awCombatQA().impacts>0);const impacted=await page.evaluate(()=>window.awCombatQA());combat.push({family,released:first,paused,impacted});
 }
 await page.locator('#flip').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.awCombatQA().release>0);await page.screenshot({path:resolve(evidence,'mirrored-battle.png')});
 const battlePerformance=await page.evaluate(()=>window.awCombatQA().metrics);
 assert.deepEqual(errors,[]);await context.close();await copyFile(await video.path(),resolve(evidence,'operations.webm'));
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({ok:true,samples,right,left,socketFrames,race,failed,recovered,pause,combat,performance:{frames:durations.length,canvasCpuP95:p95,battle:battlePerformance},errors,limits:['Browser uses software/headless GPU; this is not native GPU certification.','Family combat fixtures consume real World events but do not change equipment ownership.']},null,2));console.log(`Wardrobe 14-part render, 7 families, exact pixel sockets, animation, mirror, atomic loading, race, death/revival, resource recovery and real battle releases passed; canvas CPU p95 ${p95.toFixed(2)}ms`);
}catch(error){await page?.screenshot({path:resolve(evidence,'failure.png')}).catch(()=>{});await writeFile(resolve(evidence,'failure.json'),JSON.stringify({error:String(error),errors,url:page?.url()},null,2));throw error;}finally{await context.close().catch(()=>{});await browser.close();}
