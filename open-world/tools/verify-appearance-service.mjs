import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {root} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';
const base='http://127.0.0.1:8612',evidence=join(root,'../docs/reviews/open-world/appearance-implementation-20261001');await mkdir(evidence,{recursive:true});
const report={ok:false,checks:[],errors:[]};let pool,browser;
try{
 const health=await(await fetch(base+'/api/health')).json(),content=await(await fetch(base+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);report.versions=health.versions;
 const port=Number((await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/)[3]);pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});const existing=(await pool.query('SELECT id,state FROM ow_characters')).rows;report.existingCharacters=existing.length;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('appearance_'+randomUUID().replaceAll('-','').slice(0,16));await page.locator('[data-action=login]').click();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().attachments?.wardrobe?.ready);report.checks.push('real-service-account-only-login-and-modular-character');
 const before=await page.evaluate(()=>window.awInspect());await page.getByRole('button',{name:'外观',exact:true}).click();await page.locator('[data-action=appearance-select][data-id="100011"]').click();await page.waitForFunction(()=>window.awInspect().appearancePreview.parts?.head==='100011'&&window.awInspect().appearancePreview.parts?.back==='100011');
 const commandBefore=await page.evaluate(()=>window.awInspect());await page.locator('[data-action=appearance-save]').click();await page.waitForFunction(()=>window.awInspect().snapshot.appearance.selection.head==='100011');const saved=await page.evaluate(()=>window.awInspect());assert.equal(saved.snapshot.build,before.snapshot.build);assert.deepEqual(saved.snapshot.stats,before.snapshot.stats);assert.equal(saved.snapshot.gold,before.snapshot.gold);assert.equal(saved.snapshot.material,before.snapshot.material);assert.equal(saved.tick,commandBefore.tick);report.checks.push('real-save-with-head-rear-hair-pairing-and-no-combat-or-wallet-change');
 await page.screenshot({path:join(evidence,'local-appearance-1280x720.png')});await page.locator('[data-action=close]').click();await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().attachments?.wardrobe?.ready&&window.awInspect().snapshot.appearance.selection.head==='100011');const restored=await page.evaluate(()=>window.awInspect());assert.equal(restored.snapshot.id,saved.snapshot.id);assert.equal(restored.snapshot.revision,saved.snapshot.revision);assert.equal(restored.attachments.wardrobe.parts.head,'100011');assert.equal(restored.attachments.wardrobe.parts.back,'100011');report.checks.push('session-save-portrait-and-stage-restored');await page.screenshot({path:join(evidence,'local-camp-styled-head-1280x720.png')});
 for(const previous of existing){const current=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[previous.id])).rows[0]?.state;assert.deepEqual(current,previous.state,'Existing save changed during release smoke: '+previous.id);}report.checks.push('all-existing-character-state-preserved');assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{await browser?.close();await pool?.end();await writeFile(join(evidence,'local-service-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
