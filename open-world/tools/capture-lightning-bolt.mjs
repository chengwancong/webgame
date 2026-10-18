import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const phase=process.argv[2]??'after',folder=resolve('../docs/reviews/open-world/lightning-bolt-20261004');await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],cases=[];page.on('pageerror',e=>errors.push(String(e)));
page.setDefaultTimeout(60000);
try{
 await page.goto('http://127.0.0.1:8612/combat-art-qa.html');await page.waitForFunction(()=>window.awCombatQA?.().attachments.effects?.ready);
 const scenarios=[{model:'magic',left:false,theme:'meadow'},{model:'magic',left:true,theme:'meadow'},{model:'sword',left:false,theme:'meadow'},{model:'magic',left:false,theme:'tundra'},{model:'magic',left:false,theme:'abyss'},...(phase==='after'?[{model:'magic',left:false,theme:'meadow',reduced:true}]:[])];
 for(const scenario of scenarios){
  await page.locator('[data-skill="lightning_bolt"]').click();await page.locator(`[data-theme="${scenario.theme}"]`).click();await page.locator(`[data-model="${scenario.model}"]`).click();await page.waitForFunction(s=>{const q=window.awCombatQA?.();return q?.selected==='lightning_bolt'&&q.tick>3&&q.attachments.wardrobe?.family===s.model&&q.attachments.wardrobe?.ready&&!q.attachments.wardrobe.pending;},scenario);
  if(scenario.left)await page.locator('#flip').click();if(scenario.reduced)await page.locator('#reduced').click();await page.evaluate(()=>{document.querySelector('#cast').click();document.querySelector('#pause').click();});
  const states=[];let releaseSaved=false,flightSaved=false,midSaved=false;
  for(let n=0;n<24;n++){
   const state=await page.evaluate(()=>window.awCombatQA());states.push(state);
   let label;if(!releaseSaved&&state.release>0){label='release';releaseSaved=true;}else if(releaseSaved&&!flightSaved&&state.tick>=state.release+1&&state.attachments.effects.projectiles>0){label='flight';flightSaved=true;}else if(releaseSaved&&!midSaved&&state.tick>=state.release+3&&state.attachments.effects.projectiles>0){label='mid-flight';midSaved=true;}else if(state.impacts>0){label='impact';}else if(n===1)label='windup';
   if(label)await page.screenshot({path:resolve(folder,`${phase}-${scenario.reduced?'reduced-':''}${scenario.model}-${scenario.theme}-${scenario.left?'left':'right'}-${label}.png`)});
   if(phase==='after'&&label==='mid-flight'&&scenario.model==='magic'&&scenario.theme==='meadow'&&!scenario.left&&!scenario.reduced)await page.screenshot({path:resolve(folder,'preview-lightning.png'),clip:{x:555,y:230,width:345,height:305}});
   if(state.impacts>0)break;
   await page.locator('#frame').click();await page.waitForFunction(t=>window.awCombatQA?.().tick>t,state.tick);
  }
  assert.ok(states.some(s=>s.release>0),'actual release');assert.ok(states.some(s=>s.impacts>0),'actual hit');
  const last=states.at(-1);await page.waitForTimeout(150);const frozen=await page.evaluate(()=>window.awCombatQA());assert.equal(frozen.tick,last.tick);assert.deepEqual(frozen.attachments.effects.images,last.attachments.effects.images);
  if(scenario.reduced){const images=states.flatMap(s=>s.attachments.effects.images).filter(i=>i.key.startsWith('projectile:'));assert.ok(images.length);assert.equal(new Set(images.map(i=>i.frame)).size,1);assert.equal(new Set(images.map(i=>JSON.stringify(i.scale))).size,1);await page.locator('#reduced').click();}
  cases.push({...scenario,states,pauseStable:true});
 }
 await writeFile(resolve(folder,`${phase}.json`),JSON.stringify({phase,cases,errors},null,2));console.log(JSON.stringify({phase,cases:cases.length,errors,folder}));
}finally{await browser.close();}
