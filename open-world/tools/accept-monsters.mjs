import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
const evidence=resolve('../docs/reviews/open-world/monsters-20260930');await mkdir(evidence,{recursive:true});
const db=await startDatabase({temporary:true});let api,browser;const checks=[],errors=[];
try{
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 const build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','qa','--config','apps/web/vite.config.ts','--outDir',resolve(db.work,'web')],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_TEST_LOGIN:'1',AW_STATIC_ROOT:resolve(db.work,'web')});await registerApi(db,api);await waitFor(origin+'/api/health',api);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/monster-art-qa.html');await page.waitForFunction(()=>window.monsterQA?.ready());await page.waitForTimeout(400);
 const inspect=()=>page.evaluate(()=>window.monsterQA.views());
 const initial=await inspect();assert.equal(initial.length,12);assert(initial.every(v=>v.frame.startsWith('idle_')));await page.screenshot({path:resolve(evidence,'01-monster-lineup.png')});
 await page.locator('#flip').click();await page.waitForTimeout(100);const flipped=await inspect();assert(flipped.filter(v=>v.id!=='hero').every(v=>v.flip!==initial.find(i=>i.id===v.id).flip));await page.screenshot({path:resolve(evidence,'02-facing-reversed.png')});checks.push({name:'eleven-enemies-native-facing-and-hero',passed:true,views:initial});
 for(const action of ['move','attack','hurt','skill']){await page.locator(`[data-action=${action}]`).click();await page.waitForTimeout(90);const a=await inspect();await page.waitForFunction(previous=>window.monsterQA.views().filter(v=>v.id!=='hero').every(v=>v.frame!==previous.find(i=>i.id===v.id).frame),a,{timeout:6000});const b=await inspect();assert(b.filter(v=>v.id!=='hero').every(v=>v.frame.startsWith(action+'_')));assert(b.filter(v=>v.id!=='hero').every(v=>v.frame!==a.find(i=>i.id===v.id).frame),JSON.stringify({action,a,b}));checks.push({name:'all-eleven-animate-'+action,passed:true});if(action==='attack')await page.screenshot({path:resolve(evidence,'03-attacks.png')});}
 await page.evaluate(()=>window.monsterQA.play('attack'));await page.waitForFunction(()=>Number(window.monsterQA.views().find(v=>v.id==='raider').frame.split('_')[1])>=6);
 const before=await page.evaluate(()=>{const v=window.monsterQA.views().find(v=>v.id==='raider');window.monsterQA.play('attack');return Number(v.frame.split('_')[1]);});
 await page.waitForFunction(previous=>Number(window.monsterQA.views().find(v=>v.id==='raider').frame.split('_')[1])<previous,before,{timeout:5000});
 await page.evaluate(()=>window.monsterQA.world.paused=true);await page.waitForTimeout(120);const paused=await page.evaluate(()=>window.monsterQA.views().map(v=>v.frame));await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>window.monsterQA.views().map(v=>v.frame)),paused);await page.evaluate(()=>window.monsterQA.world.paused=false);checks.push({name:'same-action-attack-restarts-and-paused-animation-freezes',passed:true});
 await page.locator('[data-action=death]').click();await page.waitForTimeout(800);assert.equal((await inspect()).length,12);await page.screenshot({path:resolve(evidence,'04-deaths.png')});await page.waitForFunction(()=>window.monsterQA.views().length===1,{},{timeout:12000});checks.push({name:'death-animation-completes-before-removal',passed:true});
 // Real player path on an isolated database: login, enter meadow, approach the first pack, fight.
 await page.goto(origin);await page.locator('#username').fill('monster_art_test');await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.locator('#hero-name').fill('远行者');await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 await page.getByRole('button',{name:'出发远行',exact:true}).click();await page.locator('[data-action=travel][data-id=meadow]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');
 await page.locator('[data-action=mode][data-id=auto]').click();
 await page.waitForTimeout(10000);await page.screenshot({path:resolve(evidence,'05-live-meadow.png')});
 const live=await page.evaluate(()=>window.awInspect());assert.equal(live.region,'meadow');assert(live.tick>90);checks.push({name:'real-login-authorized-meadow-runtime',passed:true,tick:live.tick,hero:live.hero,snapshot:live.snapshot});
 assert.deepEqual(errors,[]);await writeFile(resolve(evidence,'result.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log('Monster artwork and runtime checks passed');
}finally{await browser?.close();await stopChild(api);const cleanup=await db.stop();await writeFile(resolve(evidence,`cleanup-${Date.now()}.json`),JSON.stringify(cleanup,null,2));console.log(cleanup);}
