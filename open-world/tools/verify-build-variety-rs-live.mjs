import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {versions} from '../packages/contracts/index.ts';
import {persistenceSnapshot,persistenceSummary,verifyPersistence} from './persistence-audit.mjs';
const out=resolve('docs/reviews/build-variety-rs-20261006/live');await mkdir(out,{recursive:true});
const result={ok:false,versions,errors:[]};let browser,page;
try{
 const origin='http://127.0.0.1:8612',health=await(await fetch(origin+'/api/health')).json(),content=await(await fetch(origin+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(content.skillCatalog.length,77);result.health=health;
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>result.errors.push(String(e)));
 await page.goto(origin);await page.waitForLoadState('networkidle',{timeout:60000});await page.waitForFunction(()=>window.awInspect?.().attachments?.effects?.ready,null,{timeout:60000});await page.locator('#username').fill('qa_build_variety_r0');await page.getByRole('button',{name:'进入游戏',exact:true}).click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn||document.querySelector('[data-action=takeover]'));if(await page.locator('[data-action=takeover]').count())await page.locator('[data-action=takeover]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&!window.awInspect().processing&&window.awInspect().region==='ss-map-port');await page.waitForLoadState('networkidle');const first=await page.evaluate(()=>window.awInspect());assert(!first.blocked);assert.equal(first.lastError,'');await page.screenshot({path:resolve(out,'camp.png')});
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();await page.waitForFunction(()=>window.awInspect().panel==='bag');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.awInspect().panel),'bag');await page.screenshot({path:resolve(out,'bag-stable.png')});await page.keyboard.press('Escape');
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&!window.awInspect().processing&&window.awInspect().region==='ss-map-port');await page.waitForLoadState('networkidle');const restored=await page.evaluate(()=>window.awInspect());assert.equal(restored.snapshot.id,first.snapshot.id);assert.deepEqual(restored.snapshot.gear,first.snapshot.gear);assert(!restored.blocked);result.login={accountOnly:true,camp:'ss-map-port',restored:true,bagStableAfterReady:true};
 const before=JSON.parse(await readFile('.runtime/build-variety-rs/persistence-before.json','utf8')),after=await persistenceSnapshot();result.persistence=verifyPersistence(before,after);result.before=persistenceSummary(before);result.after=persistenceSummary(after);const current=new Map(after.tables.ow_characters.map(c=>[c.id,c]));for(const c of before.tables.ow_characters){assert.deepEqual(current.get(c.id).state.gear,c.state.gear,'Old gear fields changed');assert.deepEqual(current.get(c.id).state.warehouse,c.state.warehouse,'Old warehouse fields changed');}result.gearAndWarehouseUnchanged=true;assert.deepEqual(result.errors,[]);result.ok=true;
}catch(error){result.error=String(error.stack);await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{await browser?.close();await writeFile(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:result.ok,versions,error:result.error,persistence:result.persistence}));}
