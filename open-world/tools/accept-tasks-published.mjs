import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {versions} from '../packages/contracts/index.ts';
const built=process.argv.includes('--built'),origin=built?'http://127.0.0.1:8611':'http://127.0.0.1:8612',out=resolve('../docs/reviews/open-world/task-panel-20261001');await mkdir(out,{recursive:true});
const health=await(await fetch(origin+'/api/health')).json(),content=await(await fetch(origin+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto(origin);await page.locator('#username').fill('task_release_'+Date.now().toString(36));assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('#hero-name').fill('任务发布验收');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const before=await page.evaluate(()=>({snapshot:window.awInspect().snapshot,region:window.awInspect().region}));assert.equal(before.region,before.snapshot.progress.safe);
 await page.locator('[data-action=panel][data-id=tasks]').click();await page.waitForFunction(()=>document.querySelectorAll('.task-list-row').length===2);await page.evaluate(()=>document.fonts.ready);
 await page.locator('[data-action=quest-select-task][data-id="current:first-boss"]').click();assert((await page.locator('.desk-task-heading').innerText()).includes('穿过结界'));await page.locator('[data-action=quest-select-task][data-id="current:first-six"]').click();await page.mouse.move(1,1);await page.screenshot({path:resolve(out,built?'published-built-1280x720.png':'published-1280x720.png')});
 await page.locator('[data-action=quest-mode][data-id=archive]').click();assert.equal(await page.locator('.task-list-row').count(),0);assert((await page.locator('.desk-empty').innerText()).includes('档案'));
 await page.locator('.task-window [data-action=close]').click();await page.locator('[data-action=panel][data-id=bag]').click();assert(await page.locator('.panel[data-panel=bag]').isVisible());await page.locator('.panel[data-panel=bag] [data-action=close]').click();
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');const after=await page.evaluate(()=>({snapshot:window.awInspect().snapshot,region:window.awInspect().region}));assert.equal(after.snapshot.id,before.snapshot.id);assert.deepEqual(after.snapshot.gear,before.snapshot.gear);assert.equal(after.snapshot.gold,before.snapshot.gold);assert.deepEqual(after.snapshot.progress,before.snapshot.progress);assert.equal(after.region,before.region);
 await page.locator('[data-action=panel][data-id=tasks]').click();await page.waitForFunction(()=>document.querySelectorAll('.task-list-row').length===2);assert.deepEqual(errors,[]);
 await writeFile(resolve(out,built?'published-built.json':'published.json'),JSON.stringify({ok:true,origin,versions,accountOnly:true,camp:true,sessionRestore:true,progressAndGearPreserved:true,officialTasks:2,mockTasksPublished:false,bagStillWorks:true,errors},null,2));console.log(JSON.stringify({ok:true,versions,origin,out}));
}finally{await browser.close();}
