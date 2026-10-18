import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const phase=process.argv[2]??'after',output=resolve('../docs/reviews/open-world/ground-zone-vfx-20261004');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));const cases=[];
try{
 await page.goto('http://127.0.0.1:8612/combat-art-qa.html');
 await page.waitForFunction(()=>window.awCombatQA?.().tick>3&&window.awCombatQA().attachments.effects?.ready);
 for(const id of ['gravity_well','vortex','barrage','rain_of_arrows','arcane_missile']){
  await page.locator(`[data-skill="${id}"]`).click();
  await page.waitForFunction(id=>window.awCombatQA().selected===id&&window.awCombatQA().tick>2,id);
  if(id==='arcane_missile')await page.locator('#autopause').click();
  await page.locator('#cast').click();
  await page.waitForFunction(({id})=>{const s=window.awCombatQA();return s.release>0&&(id==='arcane_missile'?s.paused:s.tick>=s.release+22);},{id});
  if(id!=='arcane_missile')await page.locator('#pause').click();
  const state=await page.evaluate(()=>window.awCombatQA());
  await page.screenshot({path:resolve(output,`${phase}-${id}.png`)});
  cases.push({id,...state});
  if(id==='arcane_missile')await page.locator('#autopause').click();
 }
 await writeFile(resolve(output,`${phase}.json`),JSON.stringify({phase,at:new Date().toISOString(),cases,errors},null,2));
 console.log(JSON.stringify({phase,cases:cases.map(c=>({id:c.id,tick:c.tick,errors:c.attachments.effects.errors,images:c.attachments.effects.images.length})),errors,output}));
}finally{await browser.close();}
