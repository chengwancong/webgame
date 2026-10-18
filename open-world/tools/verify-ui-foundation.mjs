import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const origin='http://127.0.0.1:8612',folder=resolve('../.design/global-ui-system'),out=resolve(folder,'screenshots');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:800}}),report={ok:false,checks:[],errors:[]};
page.on('pageerror',error=>report.errors.push(String(error)));
const rect=locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
try{
 await page.goto(origin+'/ui-system.html');await page.evaluate(()=>document.fonts.ready);
 assert(await page.evaluate(()=>[...document.fonts].some(face=>face.family==='WorldSans'&&face.weight==='100 900')));
 const primary=page.locator('#ds-controls [data-ui=button]').nth(0),secondary=page.locator('#ds-controls [data-ui=button]').nth(1);
 assert.equal((await rect(primary)).height,42);assert.equal((await rect(secondary)).height,42);
 const normal=await rect(primary);await primary.hover();assert.deepEqual(await rect(primary),normal);await primary.focus();assert.deepEqual(await rect(primary),normal);
 await primary.click();await page.locator('#ds-controls [data-ui=button][aria-busy=true]').waitFor();assert(await primary.isDisabled());assert.deepEqual(await rect(primary),normal);await page.waitForFunction(()=>document.querySelector('#ds-controls [data-ui=button]').getAttribute('aria-busy')==='false');
 await page.locator('[data-action=demo-tab][data-id=melee]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-action=demo-tab][aria-selected=true]').getAttribute('data-id'),'ranged');await page.keyboard.press('End');assert.equal(await page.locator('[data-action=demo-tab][aria-selected=true]').getAttribute('data-id'),'support');
 await page.locator('[data-action=demo-confirm]').click();await page.locator('[data-ui=confirmation]').waitFor();await page.keyboard.press('Tab');assert(await page.evaluate(()=>Boolean(document.activeElement.closest('.ui-confirm'))));await page.keyboard.press('Escape');assert.equal(await page.locator('[data-ui=confirmation]').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'demo-confirm');
 assert((await page.locator('[data-availability=unknown]').innerText()).includes('—'));assert((await page.locator('[data-availability=short]').first().innerText()).includes('数量不足'));
 report.checks.push('Variable font range, equal action sizes, hover/focus/busy geometry, tab keyboard navigation, zero/missing/large resource values');
 for(const theme of ['dark','light'])for(const viewport of [{width:1280,height:800},{width:768,height:1024},{width:375,height:812}]){
  await page.setViewportSize(viewport);await page.locator('#ui-theme').selectOption(theme);await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const overflow=await page.locator('.ds-panel,.ui-button,.ui-cost').evaluateAll(elements=>elements.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth+1;}).map(e=>e.className));assert.deepEqual(overflow,[]);
  await page.mouse.move(1,1);await page.screenshot({path:resolve(out,`components-${theme}-${viewport.width}.png`),fullPage:true});
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.ui-state--loading .ui-state__icon').evaluate(e=>getComputedStyle(e).animationName),'none');
 report.checks.push('Dark/light semantic surfaces, 1280/768/375 component layouts and reduced motion');

 const live=await browser.newPage({viewport:{width:1280,height:720}});live.on('pageerror',error=>report.errors.push(String(error)));
 let firstHealth=true;await live.route('**/api/health',route=>{if(firstHealth){firstHealth=false;return route.abort('failed');}return route.continue();});
 await live.goto(origin);await live.locator('[data-action=auth-retry]:not([disabled])').waitFor();assert(await live.locator('#username').isDisabled());await live.locator('[data-action=auth-retry]').click();await live.locator('[data-action=login]:not([disabled])').waitFor();await live.evaluate(()=>document.fonts.ready);
 assert.equal(await live.locator('#password').count(),0);const loginBounds=await rect(live.locator('.login-panel')),loginButton=await rect(live.locator('[data-action=login]'));
 let logins=0,creations=0;await live.route('**/api/session/login',async route=>{logins++;await new Promise(resolve=>setTimeout(resolve,550));await route.continue();});
 await live.route('**/api/character',async route=>{if(route.request().method()==='POST'){creations++;await new Promise(resolve=>setTimeout(resolve,550));await route.fetch();await route.abort('failed');return;}await route.continue();});
 await live.locator('#username').fill('!');await live.keyboard.press('Enter');assert.equal(logins,0);assert.equal(await live.locator('#username').getAttribute('aria-invalid'),'true');assert.deepEqual(await rect(live.locator('.login-panel')),loginBounds);assert.deepEqual(await rect(live.locator('[data-action=login]')),loginButton);
 const username='ui_foundation_'+Date.now().toString(36);await live.locator('#username').fill(username);assert.equal(await live.locator('#username').getAttribute('aria-invalid'),'false');await live.keyboard.press('Enter');await live.locator('[data-action=login][aria-busy=true]').waitFor();assert.deepEqual(await rect(live.locator('[data-action=login]')),loginButton);await live.keyboard.press('Enter');
 await live.locator('#hero-name').waitFor();assert.equal(logins,1);assert.equal(await live.evaluate(()=>document.activeElement.id),'hero-name');
 const creationBounds=await rect(live.locator('.login-panel'));await live.locator('#hero-name').fill('   ');await live.keyboard.press('Enter');assert.equal(creations,0);assert.equal(await live.locator('#hero-name').getAttribute('aria-invalid'),'true');assert.deepEqual(await rect(live.locator('.login-panel')),creationBounds);
 await live.locator('#hero-name').fill('设计系统验收');await live.keyboard.press('Enter');await live.locator('[data-action=create][aria-busy=true]').waitFor();await live.keyboard.press('Enter');await live.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');assert.equal(creations,1);
 const before=await live.evaluate(()=>window.awInspect().snapshot);await live.screenshot({path:resolve(out,'auth-entered-camp.png')});
 const second=await browser.newPage({viewport:{width:1280,height:720}});second.on('pageerror',error=>report.errors.push(String(error)));await second.goto(origin);await second.locator('#username').fill(username);await second.locator('[data-action=login]').click();await second.locator('[data-action=takeover]').waitFor();const takeoverBounds=await rect(second.locator('.login-panel'));
 await second.route('**/api/control',async route=>{await new Promise(resolve=>setTimeout(resolve,550));await route.continue();});await second.locator('[data-action=takeover]').click();await second.locator('[data-action=takeover][aria-busy=true]').waitFor();assert.deepEqual(await rect(second.locator('.login-panel')),takeoverBounds);await second.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const after=await second.evaluate(()=>window.awInspect().snapshot);assert.equal(after.id,before.id);assert.deepEqual(after.gear,before.gear);assert.deepEqual(after.progress,before.progress);
 const bow=after.gear.find(g=>g.base==='bow');assert(bow);await second.locator('[data-action=panel][data-id=bag]').click();await second.locator(`[data-action=bag-select][data-id="gear:${bow.id}"]`).click();await second.locator('#preview[data-seq]').waitFor();await second.locator('[data-action=salvage-confirm]').click();await second.locator('[data-ui=confirmation]').waitFor();await second.keyboard.press('Escape');assert.equal(await second.locator('[data-ui=confirmation]').count(),0);assert(await second.evaluate(()=>Boolean(document.activeElement.closest('#modal'))));
 await second.locator('#preview[data-seq]').waitFor();await second.locator('[data-action=salvage-confirm]').click();let salvages=0;await second.route('**/api/gear/salvage',async route=>{salvages++;await new Promise(resolve=>setTimeout(resolve,550));await route.continue();});await second.locator('[data-action=salvage]').click();await second.locator('.ui-confirm[aria-busy=true]').waitFor();assert(await second.locator('.ui-confirm [data-ui-dialog-cancel]').isDisabled());await second.keyboard.press('Enter');await second.waitForFunction(id=>!window.awInspect().snapshot.gear.some(g=>g.id===id),bow.id);assert.equal(salvages,1);assert.equal((await second.evaluate(()=>window.awInspect().snapshot)).material,after.material+3);
 report.checks.push('Shared confirmation traps focus, Escape restores inventory context, busy state disables dismissal and actual salvage submits once');
 report.checks.push('Real account-only login, failed health retry without reload, inline validation without displacement, repeated Enter submits once, lost creation response recovered by reading saved character, stable takeover and preserved character');
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);console.error(error);process.exitCode=1;await page.screenshot({path:resolve(out,'foundation-failure.png'),fullPage:true});}
finally{await browser.close();await writeFile(resolve(folder,'foundation-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
