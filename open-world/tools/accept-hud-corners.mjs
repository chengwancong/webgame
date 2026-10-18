import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
const evidence=resolve(process.argv[2]??'../docs/reviews/open-world/hud-corners-20260930');await mkdir(evidence,{recursive:true});
const db=await startDatabase({temporary:true});let api,browser;const checks=[],errors=[];
try{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--outDir',resolve(db.work,'web')],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_TEST_LOGIN:'1',AW_STATIC_ROOT:resolve(db.work,'web')});await registerApi(db,api);await waitFor(origin+'/api/health',api);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin);await page.locator('#username').fill('hud_test');await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.locator('#hero-name').waitFor();await page.locator('#hero-name').fill('用于检查长名字不会挤压生命条的远行者');await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const topGeometry=()=>page.evaluate(()=>Object.fromEntries(['#vitals','#vitals .who img','#vitals .bars','#tracker'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
 await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.awInspect().hero.shield),0);assert.equal(await page.locator('.skill-slot[data-id="2"] .cd').count(),0);
 const idleGeometry=await topGeometry();await page.screenshot({path:resolve(evidence,'town-idle.png')});
 await page.locator('.skill-slot[data-id="2"]').click();await page.waitForFunction(()=>window.awInspect().hero.shield>0);await page.waitForTimeout(220);assert.deepEqual(await topGeometry(),idleGeometry);await page.screenshot({path:resolve(evidence,'town-manual-shield.png')});
 await page.waitForFunction(()=>window.awInspect().hero.shield===0,{},{timeout:8000});await page.waitForTimeout(220);assert.deepEqual(await topGeometry(),idleGeometry);
 await page.locator('[data-action=tracker-toggle]').click();assert(await page.locator('#tracker .keys').isVisible());assert.deepEqual(await topGeometry(),idleGeometry);await page.locator('[data-action=tracker-toggle]').click();
 checks.push({name:'town-no-automatic-shield-manual-cast-and-stable-top-left',idleGeometry,passed:true});
 await page.getByRole('button',{name:'出发远行',exact:true}).click();await page.locator('[data-action=travel][data-id=meadow]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');
 for(const mode of ['manual','semi','auto']){await page.locator(`[data-action=mode][data-id=${mode}]`).click();assert.equal(await page.evaluate(()=>window.awInspect().mode),mode);assert.equal(await page.locator(`[data-action=mode][data-id=${mode}]`).getAttribute('aria-pressed'),'true');}
 await page.keyboard.down('KeyD');await page.waitForTimeout(300);await page.keyboard.up('KeyD');assert.equal(await page.evaluate(()=>window.awInspect().mode),'semi');checks.push({name:'three-modes-and-manual-takeover',passed:true});
 await page.getByRole('button',{name:'暂停战斗',exact:true}).click();const tick=await page.evaluate(()=>window.awInspect().tick);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.awInspect().tick),tick);await page.screenshot({path:resolve(evidence,'paused.png')});await page.getByRole('button',{name:'继续战斗',exact:true}).click();checks.push({name:'pause-freezes-simulation-and-resume',passed:true});
 const focus=page.locator('[data-action=mode][data-id=semi]');await focus.focus();await page.waitForTimeout(400);assert(await focus.evaluate(el=>el===document.activeElement));checks.push({name:'hud-refresh-preserves-keyboard-focus',passed:true});
 for(const [label,id] of [['自动设置','auto'],['背包','bag'],['构筑','skills'],['目标','tasks'],['设置','settings']]){await page.getByRole('button',{name:label,exact:true}).click();await page.locator(`[data-panel=${id}]`).waitFor();await page.locator('[data-action=close]').click();await page.waitForFunction(()=>window.awInspect().panel==='');checks.push({name:'opens-'+id,passed:true});}
 await page.locator('[data-action=mode][data-id=auto]').click();await page.waitForTimeout(500);await page.locator('[data-action=mode][data-id=auto]').hover();assert((await page.locator('[data-action=mode][data-id=auto]').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('gradient'));checks.push({name:'selected-mode-keeps-gold-on-hover',passed:true});await page.mouse.move(640,200);
 for(const [width,height] of [[1280,720],[1600,900],[1920,1080],[1024,576]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(250);
 const result=await page.evaluate(()=>{const b=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {left:b('#bottomLeft'),right:b('#sysbar'),center:b('#skillbar'),wallet:b('.hud-wallet'),gold:document.querySelector('#hud-gold').textContent,officialGold:window.awInspect().snapshot.gold,icons:document.querySelectorAll('#sysbar .hud-symbol').length};});
 assert(result.left.right<result.center.x);assert(result.center.right<result.right.x);assert(result.wallet.bottom<result.right.y);assert(result.left.bottom<=height&&result.right.bottom<=height);assert.equal(result.gold,String(result.officialGold));assert.equal(result.icons,4);checks.push({name:'layout-and-official-wallet',width,height,...result});
 const top=await topGeometry();assert.deepEqual(top,idleGeometry);checks.push({name:'fixed-top-left-across-viewports',width,height,top});await page.screenshot({path:resolve(evidence,`hud-${width}x${height}.png`)});
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(evidence,'result.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log('HUD corner checks passed');
}finally{await browser?.close();await stopChild(api);const cleanup=await db.stop();await writeFile(resolve(evidence,`cleanup-${Date.now()}.json`),JSON.stringify(cleanup,null,2));console.log(cleanup);}
