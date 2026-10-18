import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const folder=resolve('docs/reviews/combat-feel-20261005');await mkdir(folder,{recursive:true});
const hardware=process.argv.includes('--hardware-performance');
const browser=await chromium.launch({channel:'chrome',headless:true,args:hardware?['--use-gl=angle']:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
const q=()=>page.evaluate(()=>window.awCombatFeelQA());
const step=async(count=1)=>{for(let i=0;i<count;i++){const before=(await q()).tick;await page.locator('#qa-step').click();await page.waitForFunction(t=>window.awCombatFeelQA().tick>t,before);}};
const scenario=async id=>{await page.locator(`[data-scenario="${id}"]`).click();await page.waitForFunction(id=>window.awCombatFeelQA().selected===id&&window.awCombatFeelQA().tick===0,id);};
const record=async name=>{const state=await q();assert.deepEqual(state.attachments.effects.errors,[],name);assert.ok(state.attachments.damageNumbers.active<=28,name+' number budget');assert.ok(state.attachments.effects.particles<=384,name+' particle budget');await page.screenshot({path:resolve(folder,name+'.png')});const old=cases.findIndex(c=>c.name===name);if(old>=0)cases[old]={name,...state};else cases.push({name,...state});await writeFile(resolve(folder,name+'.json'),JSON.stringify(state,null,2));return state;};
try{
 await page.goto('http://127.0.0.1:8612/combat-feel-qa.html');await page.waitForFunction(()=>window.awCombatFeelQA?.().attachments.effects?.ready);await page.waitForFunction(()=>window.awCombatFeelQA().attachments.wardrobe?.ready);
 if(hardware){
  const renderer=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';}),result={renderer};
  for(const id of ['hit','stress']){await scenario(id);await page.locator('#qa-play').click();await page.waitForFunction(()=>window.awCombatFeelQA().tick>=100);await page.locator('#qa-play').click();const s=await q();result[id]={metrics:s.metrics,frameTiming:s.frameTiming,numbers:s.attachments.damageNumbers.active,pool:s.attachments.effects.pool};}
  result.hardwareVerified=!/SwiftShader|software|unavailable/i.test(renderer);result.averageFrameRateRatio=result.stress.frameTiming.fps/result.hit.frameTiming.fps;await writeFile(resolve(folder,'hardware-performance.json'),JSON.stringify(result,null,2));await page.setViewportSize({width:1440,height:900});console.log(JSON.stringify(result));
 }else{
 const ids=['hit','crit','kill','minor','hurt','heal','shield','break','expire','miss','boss','ice','snapshot'];if(process.argv.includes('--resume'))for(const name of ids)cases.push({name,...JSON.parse(await readFile(resolve(folder,name+'.json'),'utf8'))});
 for(const id of (process.argv.includes('--resume')?['crit']:ids)){
  await scenario(id);await step(id==='minor'?22:id==='heal'?35:id==='expire'?47:11);const s=await record(id);
  if(id==='hit'){assert.ok(s.numbers.some(n=>n.kind==='hit'));const actor=s.actors.find(a=>a.id==='target-0');assert.equal(actor.fill,true);assert.ok(actor.scaleX>actor.scaleY);assert.ok(s.sounds.includes('hit'));}
  if(id==='crit'){assert.ok(s.numbers.some(n=>n.kind==='crit'&&n.style.color==='#ffd36b'));assert.equal(s.attachments.effects.shake.tier,1);assert.equal(s.actors.find(a=>a.id==='target-0').hitStop,true);}
  if(id==='kill')assert.ok(s.numbers.some(n=>n.kind==='kill'));
  if(id==='minor'){const numbers=s.numbers.filter(n=>n.kind==='minor');assert.equal(numbers.length,1);assert.equal(numbers[0].amount,45);}
  if(id==='hurt')assert.ok(s.numbers.some(n=>n.kind==='taken'&&n.style.color==='#f39f8e'));
  if(id==='heal')assert.ok(s.numbers.some(n=>n.kind==='heal'&&n.style.color==='#9fe39a'));
  if(['shield','ice','snapshot'].includes(id)){assert.ok(s.numbers.some(n=>n.kind==='absorb'));assert.ok(s.history.some(e=>e.type==='hit_resolved'&&e.id==='hero'&&e.amount===0));assert.equal(s.actors.find(a=>a.id==='hero').fill,false);const back=s.layers.find(n=>n.key==='shield-rear'),front=s.layers.find(n=>n.key==='shield-front');assert.ok(back.depth<front.depth);assert.ok(s.layers.some(n=>n.key==='shield-hit-ripple'));assert.equal(s.layers.find(n=>n.key==='shield-source').tint,id==='ice'?0xe8fbff:0xfff0c5);}
  if(id==='snapshot')assert.ok(s.numbers.some(n=>n.kind==='shieldGain'));
  if(id==='break'){assert.equal(s.attachments.effects.shield.phase,'break');assert.equal(s.attachments.effects.shake.tier,3);assert.ok(s.sounds.includes('shield-break'));assert.equal(s.layers.filter(n=>n.key.startsWith('shield-fragment:')).length,14);}
  if(id==='expire'){assert.equal(s.attachments.effects.shield.phase,'expire');assert.ok(!s.sounds.includes('shield-break'));assert.ok(!s.layers.some(n=>n.key.startsWith('shield-fragment:')));}
  if(id==='miss')assert.ok(s.numbers.some(n=>n.kind==='miss'));
  if(id==='boss'){const actor=s.actors.find(a=>a.id==='target-0');assert.ok(Math.abs(actor.scaleX/actor.scaleY-1.03/.97)<.001);}
 }
 await scenario('crit');await page.locator('#qa-reduced').click();await step(11);let reduced=await record('reduced');assert.equal(reduced.actors.find(a=>a.id==='target-0').hitStop,false);assert.ok(reduced.actors.every(a=>Math.abs(a.scaleX-a.scaleY)<.001));const n=reduced.numbers[0];assert.equal(n.render.x,n.x);assert.equal(n.render.y,n.y);assert.equal(n.render.scale,1);await step(3);reduced=await q();assert.equal(reduced.numbers[0].render.x,n.x);assert.equal(reduced.numbers[0].render.y,n.y);await page.locator('#qa-reduced').click();
 await scenario('hit');await page.locator('#qa-play').click();await page.waitForFunction(()=>window.awCombatFeelQA().tick>=90);await page.locator('#qa-play').click();const baseline=(await q()).metrics;await writeFile(resolve(folder,'baseline-metrics.json'),JSON.stringify(baseline,null,2));
 await scenario('stress');await page.locator('#qa-play').click();await page.waitForFunction(()=>window.awCombatFeelQA().tick>=90);await page.locator('#qa-play').click();const stress=await record('stress');stress.baselineMetrics=baseline;cases.find(c=>c.name==='stress').baselineMetrics=baseline;assert.equal(stress.attachments.damageNumbers.active,28);await page.locator('#qa-play').click();await page.waitForFunction(()=>window.awCombatFeelQA().tick>=105);await page.locator('#qa-play').click();const sustained=await q();assert.ok(sustained.attachments.effects.pool.allocated<=stress.attachments.effects.pool.allocated+24,'pooled Graphics allocations plateau');cases.find(c=>c.name==='stress').sustainedPool=sustained.attachments.effects.pool;
 // Real account-only login and camp entry, followed by a real session reload.
 await page.goto('http://127.0.0.1:8612/');await page.waitForFunction(()=>typeof window.awInspect==='function');
 let live=await page.evaluate(()=>window.awInspect());
 if(!live.loggedIn){await page.locator('#username').fill('combatfeel20261005');await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.waitForFunction(()=>['create',''].includes(window.awInspect().panel));if((await page.evaluate(()=>window.awInspect())).panel==='create'){await page.locator('#hero-name').fill('战斗验收');await page.getByRole('button',{name:'进入营地',exact:true}).click();}}
 await page.waitForFunction(()=>{const s=window.awInspect();return s.loggedIn&&s.panel===''&&['town','ss-map-port'].includes(s.region);});await page.screenshot({path:resolve(folder,'camp.png')});const login=await page.evaluate(()=>({loggedIn:window.awInspect().loggedIn,region:window.awInspect().region,lastError:window.awInspect().lastError}));await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const health=await (await page.request.get('http://127.0.0.1:8612/api/health')).json(),content=await (await page.request.get('http://127.0.0.1:8612/api/content')).json();assert.deepEqual(health.versions,content.versions);
 await page.setViewportSize({width:1440,height:900});assert.deepEqual(errors,[]);await writeFile(resolve(folder,'runtime.json'),JSON.stringify({passed:true,cases,login,sessionRestored:true,versions:health.versions,errors,viewportRestored:'desktop',limits:'Controlled simulation fixture. Realtime stress uses 12 targets hit every 3 ticks, Chrome headless and SwiftShader; timings are not a hardware GPU benchmark.'},null,2));console.log(JSON.stringify({passed:true,cases:cases.length,login,sessionRestored:true,errors,folder}));
 }
}finally{await browser.close();}
