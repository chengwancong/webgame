import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:10596/quests/',out=resolve('../.design/inventory-categories/quests/screenshots');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:768}}),report={ok:false,checks:[],errors:[],apiRequests:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))report.apiRequests.push(request.url());});
try{
 for(const scheme of ['A','B','C']){
  for(const state of ['active','gate','ready','pending','failed','complete']){
   await page.goto(origin+`index.html?scheme=${scheme}&state=${state}`);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
   const checks=await page.evaluate(()=>{const w=document.querySelector('.quest-window'),r=w.getBoundingClientRect();return {window:{x:r.x,y:r.y,width:r.width,height:r.height},overflow:w.scrollHeight>w.clientHeight+1,button:[...w.querySelectorAll('button')].filter(b=>!b.disabled).map(b=>{const q=b.getBoundingClientRect();return {text:b.textContent.trim(),inside:q.top>=r.top&&q.bottom<=r.bottom+1&&q.left>=r.left&&q.right<=r.right+1};})};});
   assert(!checks.overflow,`${scheme}/${state} window overflow`);assert(checks.button.every(b=>b.inside),`${scheme}/${state} button outside`);report.checks.push({scheme,state,...checks});
   if(state==='active'||scheme==='A'&&['ready','complete'].includes(state))await page.locator('#quest-frame').screenshot({path:resolve(out,`${scheme}-${state}.png`)});
  }
  await page.goto(origin+`index.html?scheme=${scheme}&state=ready`);await page.locator('[data-action=claim]').click();await page.waitForFunction(()=>window.questDesignInspect().state==='complete');assert.equal(await page.locator('[data-action=claim]').count(),0);assert((await page.locator('.quest-window').textContent()).includes('所有任务奖励已领取'));
  await page.goto(origin+`index.html?scheme=${scheme}&state=pending`);assert.equal(await page.locator('[data-action=claim]').count(),0);await page.locator('[data-action=verify]').click();await page.waitForFunction(()=>window.questDesignInspect().state==='complete');
 }
 await page.setViewportSize({width:1440,height:960});await page.goto(origin+'states.html');await page.evaluate(()=>document.fonts.ready);await page.locator('#states').screenshot({path:resolve(out,'states.png')});
 await page.goto(origin+'references.html');await page.evaluate(()=>document.fonts.ready);const images=await page.evaluate(()=>Promise.all([...document.images].map(async img=>{try{await img.decode();return {src:img.src,loaded:true,width:img.naturalWidth,height:img.naturalHeight};}catch{return {src:img.src,loaded:false};}})));report.referenceImages=images;if(images.every(img=>img.loaded))await page.locator('#references').screenshot({path:resolve(out,'references.png')});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.apiRequests,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;await page.screenshot({path:resolve(out,'failure.png')});console.error(error);}
finally{await browser.close();await writeFile(resolve(out,'review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,states:report.checks.length,errors:report.errors,apiRequests:report.apiRequests,referenceImages:report.referenceImages,out}));}
