import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const phase=process.argv[2]??'after',output=resolve('../docs/reviews/open-world/projectile-emitters-20261004');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:8612/combat-art-qa.html');await page.waitForFunction(()=>window.awCombatQA?.().tick>3&&window.awCombatQA().attachments.effects?.ready);await page.locator('#autopause').click();
 const ids=['bolt','multi_shot','pierce_arrow','explosive_shot','poison_arrow','volley','lance','arcane_missile','frost_bolt','lightning_bolt','fireball','dark_arrow'];
 const scenarios=[...ids.map(id=>({id,model:'sword',left:false})),...['bow','magic'].flatMap(model=>['bolt','fireball'].flatMap(id=>[false,true].map(left=>({id,model,left})))),...(phase==='after'?['legacy','fist'].flatMap(model=>['bolt','fireball'].map(id=>({id,model,left:false}))):[])];
 for(const scenario of scenarios){
  await page.locator(`[data-skill="${scenario.id}"]`).click();await page.locator(`[data-model="${scenario.model}"]`).click();
  await page.waitForFunction(s=>{const q=window.awCombatQA();return q.selected===s.id&&q.model===s.model&&q.tick>3&&(s.model==='legacy'||q.attachments.wardrobe?.family===s.model&&q.attachments.wardrobe?.ready&&!q.attachments.wardrobe?.pending);},scenario);
  if(scenario.left)await page.locator('#flip').click();await page.locator('#cast').click();
  await page.waitForFunction(()=>{const q=window.awCombatQA();return q.release>0&&q.paused&&q.attachments.effects.images.some(i=>i.key.startsWith('projectile:'));});
  const state=await page.evaluate(()=>window.awCombatQA());
  if(phase==='after'){
   const arrows=new Set(['bolt','multi_shot','pierce_arrow','explosive_shot','poison_arrow','volley']),emitter=arrows.has(scenario.id)?'muzzle':'hand',action=emitter==='muzzle'?'projectile':'skill';
   assert.ok(state.attachments.effects.flights.length,scenario.id+' has a flight');assert.deepEqual(state.attachments.effects.errors,[]);
   for(const flight of state.attachments.effects.flights)assert.equal(flight.emitter,emitter,scenario.id+' emitter');
   if(scenario.model!=='legacy')assert.ok(state.attachments.effects.flights[0].frame.includes(action),scenario.model+' '+scenario.id+' source motion');
   const release=await page.evaluate(()=>{const q=window.awCombatQA(),pose=q.attachments.pose;return q.attachments.effects.flights.map(f=>({id:f.id,point:pose.socket?.(f.emitter,f.frame)}));});
   if(scenario.model!=='legacy')for(const {id,point}of release){const flight=state.attachments.effects.flights.find(f=>f.id===id);assert.ok(Math.hypot(flight.launch.x-point.x,flight.launch.y-point.y)<.01,scenario.id+' authored release socket');}
   const pauseTick=state.tick;await page.waitForTimeout(150);const frozen=await page.evaluate(()=>window.awCombatQA());assert.equal(frozen.tick,pauseTick);assert.deepEqual(frozen.attachments.effects.images,state.attachments.effects.images);assert.deepEqual(frozen.attachments.effects.flights,state.attachments.effects.flights);
  }
  cases.push({...scenario,state});
  if(['bolt','fireball','arcane_missile'].includes(scenario.id))await page.screenshot({path:resolve(output,`${phase}-${scenario.model}-${scenario.id}-${scenario.left?'left':'right'}.png`)});
 }
 let movement;
 if(phase==='after'){
  await page.locator('[data-skill="lance"]').click();await page.locator('[data-model="magic"]').click();await page.waitForFunction(()=>{const q=window.awCombatQA();return q.tick>3&&q.attachments.wardrobe?.family==='magic'&&q.attachments.wardrobe.ready&&!q.attachments.wardrobe.pending;});await page.locator('#cast').click();await page.waitForFunction(()=>window.awCombatQA().paused&&window.awCombatQA().release>0);
  const before=await page.evaluate(()=>window.awCombatQA());await page.locator('#run').click();
  for(let i=0;i<3;i++){const tick=await page.evaluate(()=>window.awCombatQA().tick);await page.locator('#frame').click();await page.waitForFunction(t=>window.awCombatQA().tick>t,tick);}
  const after=await page.evaluate(()=>window.awCombatQA()),flight=before.attachments.effects.flights[0],continued=after.attachments.effects.flights.find(f=>f.id===flight.id);assert.ok(continued,'flight survives movement sample');assert.deepEqual(continued,flight,'launch stays frozen after movement');assert.ok(Math.hypot(after.hero.x-before.hero.x,after.hero.y-before.hero.y)>0,'caster moved');movement={before,after};
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,`${phase}.json`),JSON.stringify({phase,at:new Date().toISOString(),cases,movement,errors},null,2));console.log(JSON.stringify({phase,cases:cases.length,movement:!!movement,errors,output}));
}finally{await browser.close();}
