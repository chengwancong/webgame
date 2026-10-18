import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {startDatabase,child,stopChild,freePort,waitFor,root,registerApi} from './runtime.mjs';

const evidence=join(root,'../docs/reviews/open-world/forge-interaction-20260930');
await mkdir(evidence,{recursive:true});
const report={date:new Date().toISOString(),checks:[],errors:[]};
let db,api,web,browser;
const record=(name,details={})=>{report.checks.push({name,...details});console.log(name,JSON.stringify(details));};
try{
 db=await startDatabase({temporary:true});
 const apiPort=await freePort(),webPort=await freePort(),base=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:base,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});
 await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_WEB_PORT:String(webPort),AW_API_PORT:String(apiPort)},{stdio:['ignore','ignore','inherit']});
 await registerApi(db,web,'web');await waitFor(base,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('forge_'+randomUUID().replaceAll('-','').slice(0,20));
 await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('锻造验收');await page.locator('[data-action=create]').click();
 const ready=async()=>{await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().panel==='');await page.waitForTimeout(300);};
 await ready();
 const content=await (await page.request.get(base+'/api/content')).json();
 const town=content.regions.find(r=>r.id==='town'),forge=town.landmarks.find(l=>l.kind==='forge');
 const state=()=>page.evaluate(()=>window.awInspect());
 async function clickWorld(point,offsetY=0){
  const {hero}=await state(),viewport=page.viewportSize();
  await page.mouse.click(viewport.width/2+(point.x-point.y-hero.position.x+hero.position.y)*32,viewport.height/2+15+(point.x+point.y-hero.position.x-hero.position.y)*18+offsetY);
 }
 const start=await state();assert.ok(Math.hypot(start.hero.position.x-forge.x,start.hero.position.y-forge.y)>5);
 await clickWorld(forge,-30);await page.waitForTimeout(180);assert.equal((await state()).panel,'');
 await page.locator('.panel[data-panel=bag]').waitFor();
 assert.equal(await page.locator('[data-action=upgrade]').count(),1);
 const arrived=await state();assert.ok(Math.hypot(arrived.hero.position.x-forge.x,arrived.hero.position.y-forge.y)<5);
 record('far-click-walks-and-opens-equipment',{start:start.hero.position,arrived:arrived.hero.position});
 await page.screenshot({path:join(evidence,'forge-equipment.png')});
 await page.keyboard.press('Escape');await page.waitForTimeout(700);
 assert.deepEqual((await state()).hero.position,arrived.hero.position);
 assert.ok((await page.locator('#hintbox').textContent()).includes('打开锻造台'));
 record('closing-stops-walking-and-shows-keyboard-hint');
 await page.keyboard.press('e');await page.locator('.panel[data-panel=bag]').waitFor();
 await page.locator('[data-action=filter-slot][data-id=armor]').first().click();
 await page.locator('[data-action=bag-tab][data-id=rewards]').click();await page.keyboard.press('Escape');
 await clickWorld(forge,-30);await page.locator('.panel[data-panel=bag]').waitFor();
 assert.equal(await page.locator('[data-action=bag-tab][data-id=bag]').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('[data-action=filter-slot][data-id=armor][aria-pressed=true]').count(),0);
 assert.equal(await page.locator('[data-action=upgrade]').count(),1);
 record('near-click-and-E-open-equipment-with-reset-tabs-and-filter');
 await page.keyboard.press('Escape');await page.waitForTimeout(400);assert.equal((await state()).panel,'');
 await page.reload();await ready();await clickWorld(forge,-30);
 await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');await page.waitForTimeout(2000);
 assert.equal((await state()).panel,'');record('manual-movement-cancels-pending-interaction');
 await page.reload();await ready();await clickWorld(forge,-30);await clickWorld({x:16,y:20});await page.waitForTimeout(2000);
 assert.equal((await state()).panel,'');record('ground-click-cancels-pending-interaction');
 await page.reload();await ready();await clickWorld(forge,-30);
 await page.locator('[data-action=panel][data-id=skills]').click();await page.locator('.panel[data-panel=skills]').waitFor();
 await page.keyboard.press('Escape');await page.waitForTimeout(2500);assert.equal((await state()).panel,'');
 record('opening-another-panel-cancels-pending-interaction');
 await page.reload();await ready();await clickWorld(town.portal,-35);await page.locator('.panel[data-panel=travel]').waitFor();
 record('far-portal-click-opens-travel-after-arrival');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.error=String(error);throw error;}
finally{
 await browser?.close();await stopChild(web);await stopChild(api);if(db)report.cleanup=await db.stop();
 await writeFile(join(evidence,'result.json'),JSON.stringify(report,null,2));
}
