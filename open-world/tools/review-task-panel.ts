import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import serveStatic from '@fastify/static';
import {startDatabase,freePort,root} from './runtime.mjs';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import type {Permit,Snapshot} from '../packages/contracts/index.ts';
const out=resolve(root,'../docs/reviews/open-world/task-panel-20261001');await mkdir(out,{recursive:true});
const database=await startDatabase({temporary:true}),pool=poolFor(database.dsn),port=await freePort(),url=`http://127.0.0.1:${port}`;
await migrate(pool);const app=createApp(pool,{testLogin:true,origins:[url]});await app.register(serveStatic,{root:resolve(root,'apps/web/dist'),prefix:'/'});await app.listen({host:'127.0.0.1',port});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const report:any={ok:false,checks:[],errors:[],scope:'Real API and temporary PostgreSQL; combat report fixture uses a controlled permit creation time. No player database or browser response mock.'};
page.on('pageerror',error=>report.errors.push(String(error)));
const request=async(path:string,body?:unknown)=>{const r=body===undefined?await context.request.get(url+'/api/'+path):await context.request.post(url+'/api/'+path,{data:body});const data=await r.json();assert(r.ok(),path+': '+JSON.stringify(data));return data;};
const ready=async()=>{await page.waitForFunction(()=>document.querySelectorAll('.task-list-row').length>0);await page.evaluate(()=>document.fonts.ready);};
const snapshot=()=>request('character') as Promise<Snapshot>;
const bounds=()=>page.evaluate(()=>Object.fromEntries(['.task-window','.task-list','.desk-task-heading','.quest-emblem','.desk-story','.desk-objective','.desk-chain','.desk-place','.desk-reward','.desk-current-note,.desk-times','.desk-action,.archive-footer-note'].map(selector=>{const r=document.querySelector(selector)!.getBoundingClientRect();return [selector,{x:r.x,y:r.y,w:r.width,h:r.height}];})));
const shot=async(name:string)=>{await page.mouse.move(1,1);await page.screenshot({path:resolve(out,name+'.png')});};
try{
 report.versions=(await request('health')).versions;assert.equal((await request('health')).auth_mode,'account-only');
 await page.goto(url);await page.locator('#username').fill('qa_task_browser');assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('#hero-name').fill('任务界面验收');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 await page.locator('[data-action=panel][data-id=tasks]').click();await ready();assert.equal(await page.locator('.task-list-row').count(),2);const initialBounds=await bounds();await shot('01-current-live');
 await page.locator('[data-action=quest-select-task][data-id="current:first-boss"]').click();assert((await page.locator('.desk-task-heading').innerText()).includes('穿过结界'));assert.deepEqual(await bounds(),initialBounds);
 await page.locator('[data-action=quest-navigate]').click();await page.waitForFunction(()=>window.awInspect().panel==='travel');assert.equal(await page.locator('[data-action=travel-select][data-id=meadow-boss]').count(),1);await page.locator('[data-action=close]').click();
 await page.locator('[data-action=panel][data-id=tasks]').click();await ready();await page.locator('.type-trigger').click();await page.locator('[data-action=quest-type][data-id=dungeon]').click();assert.equal(await page.locator('.task-list-row').count(),0);assert((await page.locator('.desk-empty').innerText()).includes('暂无待办'));
 await page.locator('[data-action=quest-reset-filters]').click();await ready();await page.locator('#task-search').fill('结界');assert.equal(await page.locator('.task-list-row').count(),1);await page.locator('#task-search').fill('');assert.equal(await page.locator('.task-list-row').count(),2);
 report.checks.push('Account-only login, all real tasks, primary type filtering, search, task selection and destination navigation');

 // Prepare a ready task through the real settlement API in this isolated database.
 const s=await snapshot(),lease=(await pool.query('SELECT lease FROM ow_controls WHERE character=$1',[s.id])).rows[0].lease;
 const permit=await request('permit',{lease_id:lease,region:'meadow'}) as Permit;await pool.query("UPDATE ow_permits SET created=now()-interval '30 seconds' WHERE id=$1",[permit.id]);
 await request('combat/report',{command_id:randomUUID(),revision:s.revision,lease_id:lease,permit_id:permit.id,build:permit.build,sequence:1,from_tick:0,to_tick:60,kills:permit.spawns.slice(0,6).map(m=>({source_id:m.id,tick:30}))});
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.locator('[data-action=panel][data-id=tasks]').click();await ready();await page.locator('[data-id="current:first-six"]').click();await page.locator('[data-action=quest-claim]').waitFor();await shot('02-ready-live');
 const readyBounds=await bounds(),walletBefore=await snapshot();let disconnect=true,claimCommand='',posts=0;
 await page.route('**/api/tasks',route=>disconnect&&claimCommand?route.abort('failed'):route.continue());
 await page.route('**/api/task/claim',async route=>{posts++;claimCommand=route.request().postDataJSON().command_id;await route.fetch();await route.abort('failed');});
 await page.locator('[data-action=quest-claim]').click();await page.waitForFunction(()=>window.awInspect().blocked&&Boolean(document.querySelector('[data-action=quest-recover]')));
 await page.waitForFunction(()=>document.querySelector('.desk-task-heading .badge')?.textContent?.includes('领取待确认'));
 assert.equal(await page.locator('.task-list-row').count(),2);assert.deepEqual(await bounds(),readyBounds);await shot('03-pending-live');
 disconnect=false;await page.unroute('**/api/task/claim');await page.locator('.desk-action [data-action=quest-recover]').click();await page.waitForFunction(()=>!window.awInspect().blocked&&window.awInspect().panel==='tasks');await page.waitForFunction(()=>document.querySelectorAll('.task-list-row').length===1);
 assert.equal(posts,1);const walletAfter=await snapshot();assert.equal(walletAfter.gold,walletBefore.gold+50);assert.equal(walletAfter.material,walletBefore.material+5);assert.equal((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[s.id,claimCommand])).rows[0].n,1);
 await page.locator('[data-action=quest-mode][data-id=archive]').click();await ready();assert.equal(await page.locator('[data-action=quest-claim]').count(),0);assert((await page.locator('.desk-times').innerText()).includes('目标达成'));assert((await page.locator('.desk-times').innerText()).includes('领奖入档'));assert.deepEqual(await bounds(),initialBounds);await shot('04-archive-live');
 const archived=(await request('tasks')).archive;assert.equal(archived.length,1);assert(archived[0].goalAt);assert(archived[0].claimedAt);assert.deepEqual(archived[0].reward,{gold:50,material:5,xp:0});
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.locator('[data-action=panel][data-id=tasks]').click();await ready();await page.locator('[data-action=quest-mode][data-id=archive]').click();assert.deepEqual((await request('tasks')).archive,archived);await shot('05-restored-archive-live');
 report.checks.push('Lost claim response retained in outbox; explicit recovery reused receipt; exactly one payment and immutable archive survived reload');
 const current=await snapshot(),currentLease=(await pool.query('SELECT lease FROM ow_controls WHERE character=$1',[s.id])).rows[0].lease;
 const bossPermit=await request('permit',{lease_id:currentLease,region:'meadow-boss'}) as Permit;await pool.query("UPDATE ow_permits SET created=now()-interval '30 seconds' WHERE id=$1",[bossPermit.id]);
 const boss=bossPermit.spawns.find(m=>m.boss)!;
 await request('combat/report',{command_id:randomUUID(),revision:current.revision,lease_id:currentLease,permit_id:bossPermit.id,build:bossPermit.build,sequence:1,from_tick:0,to_tick:60,kills:[{source_id:boss.id,tick:30}]});
 assert((await snapshot()).progress.regions.includes('forest'),'region opens on the boss settlement, independently of task claim');
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.locator('[data-action=panel][data-id=tasks]').click();await ready();await page.locator('[data-action=quest-claim]').click();await page.waitForFunction(()=>Boolean(document.querySelector('.desk-empty [data-action=quest-mode]')));await shot('06-all-claimed-live');
 await page.locator('.desk-empty [data-action=quest-mode]').click();await page.waitForFunction(()=>document.querySelectorAll('.task-list-row').length===2);assert.equal((await request('tasks')).current.length,0);assert.equal((await request('tasks')).archive.length,2);
 report.checks.push('Normal boss-task claim and all-current-tasks-complete shortcut; both archives remain browsable');
 for(const [width,height] of [[1024,576],[1600,900],[1920,1080],[375,812]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await page.locator('.task-window').evaluate(element=>{const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,overflow:element.scrollHeight>element.clientHeight};});
  assert(geometry.left>=0&&geometry.top>=0&&geometry.right<=width+1&&geometry.bottom<=height+1,JSON.stringify({width,height,geometry}));
  const target=page.locator('.desk-times');await target.scrollIntoViewIfNeeded();await shot(`viewport-${width}x${height}`);
 }
 report.checks.push('1280×720 fixed detail anchors and bounded 1024×576, 1600×900, 1920×1080, 375×812 layouts');
 report.geometry=initialBounds;assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error instanceof Error?error.stack:error);console.error(error);process.exitCode=1;await page.screenshot({path:resolve(out,'browser-failure.png')});}
finally{await browser.close();await app.close();await pool.end();report.cleanup=await database.stop();await writeFile(resolve(out,'browser-review.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,error:report.error,checks:report.checks,cleanup:report.cleanup}));}
