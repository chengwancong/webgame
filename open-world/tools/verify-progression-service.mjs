import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {root} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';
const base=process.env.AW_SERVICE_URL??'http://127.0.0.1:8612',evidence=join(root,'../docs/reviews/open-world/deep-progression-20261001');await mkdir(evidence,{recursive:true});
let pool,browser;const report={ok:false,base,checks:[],errors:[]};
try{
 const health=await (await fetch(base+'/api/health')).json(),content=await (await fetch(base+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');report.versions=health.versions;
 const lines=(await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/),port=Number(lines[3]);assert.ok(Number.isInteger(port)&&port>0&&port<65536);pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});
 const saved=(await pool.query('SELECT id,state FROM ow_characters ORDER BY id')).rows;report.existingCharacters=saved.length;
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base);await page.locator('#username').fill('release_'+randomUUID().replaceAll('-','').slice(0,20));await page.locator('[data-action=login]').click();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');report.checks.push('actual-service-account-only-login-enters-camp');
 const before=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(before.level,1);assert.equal(before.gold,0);assert.equal(before.material,0);
 await page.getByRole('button',{name:'养成',exact:true}).click();await page.locator('.progression-library.is-grid').waitFor();await page.locator('.progression-quote[aria-busy=false]').waitFor();assert.equal(await page.locator('.progression-library.is-grid>.progression-entry').count(),9);await page.screenshot({path:join(evidence,'local-service-grid-1280x720.png')});report.checks.push('actual-service-progression-view-and-nine-slots');
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().panel==='');const restored=await page.evaluate(()=>window.awInspect().snapshot);assert.equal(restored.id,before.id);assert.equal(restored.revision,before.revision);assert.equal(restored.gold,before.gold);assert.deepEqual(restored.gear,before.gear);report.checks.push('actual-service-session-and-save-restored');
 for(const prior of saved){const current=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[prior.id])).rows[0]?.state;assert.deepEqual(current,prior.state,'Existing saved character changed during read-only release smoke: '+prior.id);}report.checks.push('existing-character-rows-preserved');
 const latest=await (await fetch(base+'/api/health')).json();assert.deepEqual(latest.versions,versions);assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{await browser?.close();await pool?.end();await writeFile(join(evidence,'local-service-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
