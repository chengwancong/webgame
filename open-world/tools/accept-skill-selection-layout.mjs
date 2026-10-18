import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';

const evidence=resolve('../docs/reviews/open-world/skill-selection-layout-20261001');
await mkdir(evidence,{recursive:true});
const db=await startDatabase({temporary:true});let server,browser;
const checks=[],errors=[];
try{
 const dist=resolve(db.work,'build');
 const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--outDir',dist],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr);
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_STATIC_ROOT:dist,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});
 await registerApi(db,server);await waitFor(origin+'/api/health',server);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin);await page.locator('#username').fill('layout_'+randomUUID().replaceAll('-','').slice(0,16));
 await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.getByRole('button',{name:'进入营地',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect().loggedIn&&window.awInspect().panel==='');
 await page.getByRole('button',{name:'技能',exact:true}).click();await page.locator('.skill-book').waitFor();await page.evaluate(()=>document.fonts.ready);
 // Record immediately before the handler, after Playwright has scrolled a target into view.
 await page.evaluate(()=>{
  window.skillGeometry=()=>{
   const lib=document.querySelector('.library'),rect=lib.getBoundingClientRect();
   return {scroll:lib.scrollTop,images:[...lib.querySelectorAll('.lib-pick')].map(button=>{
    const r=button.querySelector('img').getBoundingClientRect(),card=button.closest('.lib-card'),style=getComputedStyle(card);
    return {id:button.dataset.id,x:r.x-rect.x,y:r.y-rect.y+lib.scrollTop,w:r.width,h:r.height,padding:style.padding,border:style.borderWidth};
   })};
  };
  document.addEventListener('click',event=>{if(event.target.closest('[data-action=skill-focus]'))window.skillBefore=window.skillGeometry();},true);
 });
 for(const [width,height] of [[1280,720],[1024,576],[1600,900],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const category of ['melee','ranged','control','support']){
   await page.locator(`[data-action=skill-category][data-id=${category}]`).click();
   const ids=await page.locator('[data-action=skill-focus]').evaluateAll(buttons=>buttons.map(b=>b.dataset.id));
   let headerSize;
   for(const id of ids){
    await page.locator(`[data-action=skill-focus][data-id=${id}]`).click();
    await page.waitForFunction(id=>document.querySelector(`.lib-card.is-focus [data-id="${id}"]`),id);
    const metrics=await page.evaluate(()=>({before:window.skillBefore,after:window.skillGeometry(),header:(()=>{const r=document.querySelector('.skill-detail-heading>img').getBoundingClientRect();return [r.width,r.height];})()}));
    assert.deepEqual(metrics.after,metrics.before,`${width}x${height}/${id}: selection changed image geometry or scroll`);
    headerSize??=metrics.header;assert.deepEqual(metrics.header,headerSize,`${id}: detail icon changed size`);assert.equal(metrics.header[0],metrics.header[1],`${id}: detail icon distorted`);
    checks.push({viewport:`${width}x${height}`,category,id,passed:true});
   }
  }
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('[data-action=skill-category][data-id=melee]').click();
 for(const id of ['cut','dual_strike']){
  await page.locator(`[data-action=skill-focus][data-id=${id}]`).click();await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.screenshot({path:resolve(evidence,id+'.png')});
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({checks,errors,limitation:'UI geometry regression using real clicks and isolated development account; no progression actions.'},null,2));
 console.log(`${checks.length} real skill selections passed: unchanged list icons, padding, borders and scroll; stable square detail icons.`);
}finally{await browser?.close();await stopChild(server);await db.stop();}
