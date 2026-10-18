import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
const evidence=resolve(process.env.AW_COMBAT_EVIDENCE??'../docs/reviews/open-world/combat-contact-20261001');await mkdir(evidence,{recursive:true});
const db=await startDatabase({temporary:true});let server,browser,context;const errors=[],skills=[],contactSamples=[];
try{
 const dist=resolve(db.work,'build');const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',dist],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_STATIC_ROOT:dist,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,server);await waitFor(origin+'/api/health',server);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:resolve(db.work,'video'),size:{width:1280,height:720}}});
 const page=await context.newPage(),video=page.video();page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin+'/combat-art-qa.html');await page.waitForFunction(()=>window.awCombatQA?.().tick>3);
 for(const id of ['cut','whirl','bolt','fireball','frost_bolt','snipe','petrify','ember','frost','ward','mend','rush','chain','cleave']){
  await page.locator(`[data-skill=${id}]`).click();await page.locator('#cast').click();await page.waitForFunction(()=>window.awCombatQA().release>0);await page.waitForFunction(()=>window.awCombatQA().tick>=window.awCombatQA().release+3);
  const state=await page.evaluate(()=>window.awCombatQA());assert(state.casting);skills.push(state);await page.screenshot({path:resolve(evidence,id+'.png')});await page.waitForTimeout(400);
 }
 await page.locator('[data-skill=bolt]').click();await page.locator('#flip').click();await page.locator('#cast').click();await page.waitForFunction(()=>window.awCombatQA().release>0);await page.screenshot({path:resolve(evidence,'left-facing-projectile.png')});
 await page.locator('#crowd').click();await page.waitForTimeout(250);const crowd=await page.evaluate(()=>window.awCombatQA());for(const e of crowd.enemies)assert(Math.hypot(e.position.x-crowd.hero.x,e.position.y-crowd.hero.y)>=crowd.requiredContact-1e-4);await page.screenshot({path:resolve(evidence,'crowd-separated.png')});
 await page.locator('#boss').click();await page.waitForFunction(()=>window.awCombatQA().tick>=100);await page.screenshot({path:resolve(evidence,'boss-effects.png')});
 // Also exercise the player entry, real account-only login, permit and field combat.
 await page.goto(origin);await page.locator('#username').fill('contact_'+randomUUID().replaceAll('-','').slice(0,16));await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect().loggedIn&&window.awInspect().panel==='');
 await page.getByRole('button',{name:'前往远行之门',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#hintbox').textContent.includes('打开远行地图'));await page.keyboard.press('KeyE');await page.locator('[data-action=travel-depart][data-id=meadow]').click();await page.waitForFunction(()=>window.awInspect().region==='meadow'&&window.awInspect().panel==='');await page.locator('[data-action=mode][data-id=auto]').click();
 for(let i=0;i<100;i++){
  await page.waitForTimeout(100);const state=await page.evaluate(()=>window.awInspect());const [hero,...enemies]=state.combatBodies;let gap=Infinity;
  for(const enemy of enemies)gap=Math.min(gap,Math.hypot(hero.position.x-enemy.position.x,hero.position.y-enemy.position.y)-hero.radius-enemy.radius);
  assert(gap>=-1e-4,'Live hero/enemy overlap: '+gap);contactSamples.push({tick:state.tick,gap,hp:state.hero.hp});
 }
 const player=await page.evaluate(()=>window.awInspect());assert(player.tick>90);assert(!player.blocked);await page.screenshot({path:resolve(evidence,'live-meadow.png')});assert.deepEqual(errors,[]);
 await context.close();context=undefined;await copyFile(await video.path(),resolve(evidence,'operations.webm'));
 await writeFile(resolve(evidence,'result.json'),JSON.stringify({ok:true,skills,crowd,contactSamples,player,errors,limits:['Independent skill fixtures do not validate unimplemented special mechanics in expanded skill descriptions.','Software-rendered browser run is not a native GPU performance certification.']},null,2));console.log('Real releases for 14 skills, coincident-spawn separation and authorized meadow combat passed.');
}finally{await context?.close();await browser?.close();await stopChild(server);await writeFile(resolve(evidence,'cleanup.json'),JSON.stringify(await db.stop(),null,2));}
