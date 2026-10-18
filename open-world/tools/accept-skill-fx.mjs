import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {sourceVersion} from './source-version.mjs';

// This tool checks skill art only. It never runs global pressure, capacity or boss QA.
const evidence=resolve(process.env.AW_SKILL_FX_EVIDENCE??'../docs/reviews/open-world/skill-source-fx-20261001');
await mkdir(evidence,{recursive:true});
const sourceBefore=await sourceVersion({diagnostics:true}),manifest=JSON.parse(await readFile('packages/asset-manifest/skill-fx.json','utf8'));
const sourceTexture='skill-source-fx';assert.equal(manifest.texture.key,sourceTexture);
const representatives=new Set(['cut','whirl','bolt','ember','chain','ward','mend','rush']);
const observations={skills:[],models:[],moving:[],pause:[],death:[],live:[]},errors=[];
let db,server,browser,context,page,video,cleanup,result;
const inspect=()=>page.evaluate(()=>window.awCombatQA());
const closeEnough=(a,b,label)=>assert(Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
const extraManifests=await Promise.all(['vfx-v2','combat-layer-fx'].map(async name=>JSON.parse(await readFile(`packages/asset-manifest/${name}.json`,'utf8'))));
const textures=new Map([[sourceTexture,new Set(Object.values(manifest.clips).flatMap(c=>c.frames.map(String)))],...extraManifests.flatMap(m=>Object.values(m.clips).map(c=>[c.key,new Set(c.frames??Array.from({length:c.count??1},(_,i)=>String(i)))]))]);
// Registered program-generated terrain masks used by the production renderer.
for(const key of ['telegraph-soft-surface','telegraph-v2-floor','telegraph-v2-front'])textures.set(key,new Set(['__BASE']));
function validateImages(state,label){
 const fx=state.attachments?.effects;assert(fx?.ready,`${label}: production atlases are not ready`);assert.equal(fx.texture,sourceTexture);assert.deepEqual(fx.errors,[],`${label}: effect resource error`);
 for(const image of fx.images){const frames=textures.get(image.texture);assert(frames&&frames.has(String(image.frame)),`${label}: unregistered sprite ${image.texture}/${image.frame}`);assert(image.scale.every(v=>Number.isFinite(v)&&v>0),`${label}: invalid sprite scale`);assert([image.x,image.y,image.depth].every(Number.isFinite));}
 for(const beam of fx.beams??[])assert([beam.from.x,beam.from.y,beam.to.x,beam.to.y,beam.depth].every(Number.isFinite),`${label}: invalid authored beam`);
 return fx;
}
// The production renderer includes registered sprites and procedural beam/ice
// geometry. Both must be tied to an actual release and allocated render nodes.
const visibleRelease=state=>state.release>0&&state.attachments?.effects?.pool.active>0&&(state.attachments.effects.flashes>0||state.attachments.effects.projectiles>0);
async function scenario(id,options={}){
 await page.locator(`[data-skill="${id}"]`).click();
 await page.waitForFunction(id=>window.awCombatQA().selected===id&&window.awCombatQA().tick>2&&window.awCombatQA().attachments.effects?.ready,id);
 await page.evaluate(options=>window.skillFxSampler.begin(options),options);
 await page.locator('#cast').click();
 await page.waitForFunction(()=>window.skillFxSampler.states.some(s=>s.release>0),null,{timeout:10000});
 await page.waitForFunction(()=>window.skillFxSampler.states.some(s=>s.release>0&&s.attachments.effects.pool.active>0),null,{timeout:10000});
}
async function finishScenario(id){
 await page.waitForFunction(()=>{const s=window.awCombatQA();return s.release>0&&s.tick>=s.release+32;},null,{timeout:10000});
 const states=await page.evaluate(()=>window.skillFxSampler.end());
 assert(states.some(s=>s.casting),`${id}: World.cast rejected the real fixture command`);
 const releases=states.filter(visibleRelease);assert(releases.length,`${id}: actual release was never rendered`);assert(releases.some(s=>s.attachments.effects.recentProfiles.includes('player/'+id))); 
 for(const state of states)validateImages(state,id);
 return {id,release:releases[0].release,frames:states.length,actualClips:[...new Set(releases.flatMap(s=>s.attachments.effects.images.map(i=>i.texture)))],states};
}
function stablePause(state){const fx=validateImages(state,'pause');return {tick:state.tick,hero:state.hero,release:state.release,alive:state.alive,pose:state.attachments.pose,points:state.attachments.points,consumeTick:fx.consumeTick,totalConsumed:fx.totalConsumed,totalCreated:fx.totalCreated,clock:fx.clock,interpolation:fx.interpolation,flashes:fx.flashes,projectiles:fx.projectiles,beams:fx.beams,images:fx.images,damageNumbersCreated:state.attachments.damageNumbers?.totalCreated};}
try{
 db=await startDatabase({temporary:true});
 const build=resolve(db.work,'skill-fx-build');
 const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',build],{encoding:'utf8',windowsHide:true});assert.equal(built.status,0,built.stderr||built.stdout);
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_STATIC_ROOT:build,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,server);await waitFor(origin+'/api/health',server);
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:resolve(db.work,'video'),size:{width:1280,height:720}}});
 await context.addInitScript(()=>{
  const sampler={states:[],active:false,options:{},moved:false,paused:false,begin(options={}){this.states=[];this.active=true;this.options=options;this.moved=false;this.paused=false;},end(){this.active=false;return this.states;}};
  window.skillFxSampler=sampler;
  function sample(){
   if(sampler.active&&typeof window.awCombatQA==='function'){
    const s=window.awCombatQA();sampler.states.push(s);
    const visible=s.release>0&&s.attachments?.effects?.pool.active>0;
    if(visible&&sampler.options.move&&!sampler.moved){sampler.moved=true;document.querySelector('#run').click();}
    if(visible&&sampler.options.pause&&!sampler.paused){sampler.paused=true;document.querySelector('#pause').click();}
   }
   requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
 });
 page=await context.newPage();video=page.video();page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(origin+'/combat-art-qa.html');await page.waitForFunction(()=>window.awCombatQA?.().tick>3&&window.awCombatQA().attachments.effects?.ready);
 const skills=await(await context.request.get(origin+'/api/content')).json();assert.equal(skills.skillCatalog.length,83);
 const fixtureIds=await page.locator('[data-skill]').evaluateAll(elements=>elements.map(e=>e.dataset.skill));assert.deepEqual(new Set(fixtureIds),new Set(skills.skillCatalog.map(s=>s.id)));
 for(const skill of skills.skillCatalog){
  const shot=representatives.has(skill.id);await scenario(skill.id,{pause:shot});
  if(shot){await page.waitForFunction(()=>window.awCombatQA().paused);const actual=await inspect();assert(visibleRelease(actual),`${skill.id}: representative screenshot must show an actual effect image`);await page.screenshot({path:resolve(evidence,`skill-${skill.id}.png`)});await page.locator('#pause').click();}
  observations.skills.push(await finishScenario(skill.id));
 }
 console.log('All 77 real World.cast releases rendered actual source atlas frames.');
 for(const model of ['legacy','sword','bow','magic','fist']){
  await page.locator(`[data-model="${model}"]`).click();
  await page.waitForFunction(model=>{const s=window.awCombatQA();return s.model===model&&(model==='legacy'?!String(s.attachments.pose?.frame).startsWith('wardrobe-'):s.attachments.wardrobe?.ready&&s.attachments.wardrobe.family===model);},model);
  const skill=model==='magic'?'fireball':model==='bow'||model==='legacy'?'bolt':'cut';await scenario(skill,{pause:true});await page.waitForFunction(()=>window.awCombatQA().paused);
  const actual=await inspect();assert(visibleRelease(actual));validateImages(actual,model);await page.screenshot({path:resolve(evidence,`model-${model}.png`)});await page.locator('#pause').click();observations.models.push({model,...await finishScenario(skill)});
 }
 // Pause must freeze the displayed instant as well as world event consumption.
 await scenario('ember',{pause:true});await page.waitForFunction(()=>window.awCombatQA().paused);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const paused=stablePause(await inspect());for(let i=0;i<4;i++){await page.waitForTimeout(100);const next=stablePause(await inspect());assert.deepEqual(next,paused,'Paused skill frames, positions, clock and event counts must remain unchanged');observations.pause.push(next);}
 await page.screenshot({path:resolve(evidence,'pause-frozen.png')});await page.locator('#pause').click();await finishScenario('ember');
 // Movement after a hitscan/chain release must not drag its already captured endpoints.
 for(const id of ['snipe','chain']){
  await scenario(id,{move:true});const run=await finishScenario(id),withBeams=run.states.filter(s=>s.attachments.effects.beams.length>0);
  assert(withBeams.length>=2,`${id}: release endpoints need multiple rendered observations`);
  const first=withBeams[0],originEndpoints=first.attachments.effects.beams;
  const moved=withBeams.filter(s=>Math.hypot(s.hero.x-first.hero.x,s.hero.y-first.hero.y)>.05);assert(moved.length,`${id}: fixture must move while released effects are still displayed`);
  for(const state of moved)assert.deepEqual(state.attachments.effects.beams,originEndpoints,`${id}: moving hero dragged released endpoints`);
  observations.moving.push({id,first,moved});
 }
 await scenario('ember',{move:true});const zone=await finishScenario('ember'),pieces=zone.states.flatMap(s=>s.attachments.effects.images.filter(i=>/^zone:\d+:\d+$/.test(i.key)).map(i=>({hero:s.hero,key:i.key,x:i.x,y:i.y})));
 assert(pieces.length>=2,'Real ground flame sprites must appear during zone lifetime');
 const fixed=new Map();for(const piece of pieces){const samples=fixed.get(piece.key)??[];if(samples.length){closeEnough(piece.x,samples[0].x,'fixed ground x');closeEnough(piece.y,samples[0].y,'fixed ground y');}samples.push(piece);fixed.set(piece.key,samples);}
 assert.equal(fixed.size,8,'All eight production ground flame sprites stay fixed');
 const stableAcrossMovement=[...fixed.values()].filter(samples=>samples.some(s=>Math.hypot(s.hero.x-samples[0].hero.x,s.hero.y-samples[0].hero.y)>.1));assert(stableAcrossMovement.length>=3,'At least three fixed source-art points must remain visible as the hero moves');
 observations.moving.push({id:'ember',pieces,stableAcrossMovement:stableAcrossMovement.length});
 // A dead hero has no stepping world; repeated render frames must not consume its
 // final events again or create effects/floating damage numbers again.
 await scenario('bolt',{pause:true});await page.waitForFunction(()=>window.awCombatQA().paused);await page.locator('#dead').click();await page.locator('#pause').click();await page.waitForFunction(()=>!window.awCombatQA().alive&&window.awCombatQA().attachments.effects.cancelReason==='hero-dead');
 const dead=await inspect();assert.equal(dead.attachments.effects.images.length,0);
 for(let i=0;i<4;i++){await page.waitForTimeout(100);const next=await inspect();assert.equal(next.tick,dead.tick);assert.equal(next.attachments.effects.consumeTick,dead.attachments.effects.consumeTick);assert.equal(next.attachments.effects.totalConsumed,dead.attachments.effects.totalConsumed);assert.equal(next.attachments.effects.totalCreated,dead.attachments.effects.totalCreated);assert.deepEqual(next.attachments.effects.images,[]);assert(dead.attachments.damageNumbers,'Death fixture must expose real floating numbers');assert.equal(next.attachments.damageNumbers.totalCreated,dead.attachments.damageNumbers.totalCreated,'Dead hero created duplicate floating numbers');assert(next.attachments.damageNumbers.active<=dead.attachments.damageNumbers.active,'Dead hero increased active floating numbers');observations.death.push(next);}
 await page.screenshot({path:resolve(evidence,'death-cleared.png')});await page.evaluate(()=>window.skillFxSampler.end());
 // One authorized player path: fresh account, camp, travel portal, meadow combat.
 await page.goto(origin);await page.locator('#username').fill('fx_'+randomUUID().replaceAll('-','').slice(0,20));await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect().loggedIn&&window.awInspect().panel==='');
 // Full legacy camp/field path in the disposable QA database, independent of
 // the fresh Starsea campaign's tutorial locks.
 const fixturePool=new Pool({connectionString:db.dsn,max:1});
 try{const id=await page.evaluate(()=>window.awInspect().snapshot.id),state=(await fixturePool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;delete state.starsea;state.level=50;state.story={version:1,legacyAccess:true,events:{},choices:{}};state.progress.regions=['town','meadow'];state.lastRegion='town';state.progress.safe='town';await fixturePool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);}finally{await fixturePool.end();}
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&!window.awInspect().processing&&window.awInspect().region==='town'&&window.awInspect().panel===''&&window.awInspect().attachments.effects?.ready);
 const camp=await page.evaluate(()=>window.awInspect());assert.equal(camp.region,'town');assert(camp.attachments.effects.ready);await page.screenshot({path:resolve(evidence,'live-camp.png')});
 await page.locator('#minimapbox').click();await page.getByRole('button',{name:'远行地图',exact:true}).click();await page.locator('[data-action=travel-depart][data-id=meadow]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');await page.locator('[data-action=hud-mode-toggle]').click();await page.locator('[data-action=mode][data-id=auto]').click();
 await page.waitForFunction(()=>window.awInspect().attachments.effects.pool.active>0&&window.awInspect().attachments.effects.recentProfiles.some(k=>k.startsWith('player/')),null,{timeout:20000});
 const live=await page.evaluate(()=>window.awInspect());assert(!live.blocked);validateImages({attachments:live.attachments},'live authorized meadow');assert(live.attachments.effects.totalConsumed>camp.attachments.effects.totalConsumed);assert(live.attachments.effects.pool.active>0);observations.live.push({camp,meadow:live});await page.screenshot({path:resolve(evidence,'live-meadow-source-fx.png')});
 assert.deepEqual(errors,[]);const sourceAfter=await sourceVersion({diagnostics:true});assert.equal(sourceAfter.sha256,sourceBefore.sha256,'Source changed during skill art acceptance: '+JSON.stringify([...new Set([...Object.keys(sourceBefore.fingerprints),...Object.keys(sourceAfter.fingerprints)])].filter(p=>sourceBefore.fingerprints[p]!==sourceAfter.fingerprints[p])));
 result={ok:true,sourceBefore,sourceAfter,observations,errors,limits:['Skill art acceptance only; expanded descriptions do not imply additional combat mechanics.','Software-rendered browser is not a global native GPU performance certification.','No global stress, capacity benchmark, or three-boss progression run.']};
}catch(error){
 await page?.screenshot({path:resolve(evidence,'failure.png')}).catch(()=>{});result={ok:false,error:String(error),sourceBefore,sourceAfter:await sourceVersion({diagnostics:true}),observations,errors,state:await page?.evaluate(()=>window.awCombatQA?.()??window.awInspect?.()).catch(()=>null)};process.exitCode=1;
}finally{
 await context?.close();if(video)await copyFile(await video.path(),resolve(evidence,'operations.webm')).catch(error=>{errors.push('Video copy: '+error);process.exitCode=1;});await browser?.close();await stopChild(server);if(db)cleanup=await db.stop();
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({...result,cleanup},null,2));console.log(JSON.stringify({ok:result?.ok,error:result?.error,skills:observations.skills.length,models:observations.models.length,cleanup,evidence}));
}
