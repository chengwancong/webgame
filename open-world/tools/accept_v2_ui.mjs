import {chromium} from 'playwright';
import {mkdir, writeFile,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {startDatabase, freePort, child, stopChild, waitFor, registerApi} from './runtime.mjs';

const evidence = process.argv[2] ?? 'docs/reviews/open-world/ui-v2-final-20260930';
const sizes = [[1280,720],[1600,900],[1920,1080],[1024,576]];
const node = process.execPath;

const db = await startDatabase({temporary:true});
const apiPort = await freePort();
const webPort = apiPort;
const origin = `http://127.0.0.1:${webPort}`;
let api, web, browser;const checks=[];
const notes = [];
try {
  const built=spawnSync(node,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--outDir',resolve(db.work,'web-build')],{encoding:'utf8'});if(built.status!==0)throw Error(built.stderr);
  api = child(node, ['--import','tsx','apps/api/src/main.ts'], {
    AW_DATABASE_URL: db.dsn,
    AW_API_PORT: String(apiPort),
    AW_ORIGINS: origin,
    AW_STATIC_ROOT:resolve(db.work,'web-build'),
  });
  await registerApi(db, api);
  await waitFor(`http://127.0.0.1:${apiPort}/api/health`, api);
  const catalog=(await (await fetch(origin+'/api/content')).json()).skillCatalog;
  await mkdir(evidence, {recursive:true});
  browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:{dir:resolve(db.work,'video'),size:{width:1280,height:720}}});
  const page=await context.newPage();
  const video=page.video();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => { await page.evaluate(()=>Promise.all(Array.from(document.images).map(img=>img.decode())));await page.waitForTimeout(150);await page.screenshot({path:`${evidence}/${name}.png`}); notes.push(name); };
  const measure = async label => {
    const box = await page.evaluate(() => {
      const panel = document.querySelector('#modal .panel');
      const title = panel?.querySelector('h2')?.textContent?.trim() ?? '';
      const map = document.querySelector('.minimap')?.getBoundingClientRect();
      const canvas = document.querySelector('#minimap')?.getBoundingClientRect();
      const primary = document.querySelector('button.primary');
      const cs = primary ? getComputedStyle(primary) : null;
      return {
        title,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        map, canvas,
        primary: cs ? {color: cs.color, background: cs.backgroundColor} : null,
        missing: performance.getEntriesByType('resource').filter(r => r.name.includes('/art/') && r.transferSize === 0 && r.decodedBodySize === 0).map(r => r.name),
      };
    });
    if (box.map && box.canvas) {
      const pad = 2;
      box.minimapContainsCanvas = box.canvas.left >= box.map.left - pad && box.canvas.right <= box.map.right + pad && box.canvas.top >= box.map.top - pad && box.canvas.bottom <= box.map.bottom + pad;
    }
    notes.push({label, ...box, errors:[...errors]});
    return box;
  };
  await page.goto(origin);
  await page.locator('#username').waitFor();
  await shot('01-login');
  const username = 'v2_' + randomUUID().slice(0, 10).replaceAll('-', '');
  await page.fill('#username', username);
  assert.equal(await page.locator('#password').count(),0);
  await page.getByRole('button', {name:'进入游戏', exact:true}).click();
  await page.locator('#hero-name').waitFor();
  await shot('02-create');
  await page.getByRole('button', {name:'进入营地', exact:true}).click();
  await page.waitForFunction(() => window.awInspect().loggedIn && window.awInspect().panel === '');
  await page.waitForTimeout(600);
  await shot('03-camp');
  const initialPosition=await page.evaluate(()=>window.awInspect().hero.position);await page.keyboard.down('KeyD');await page.waitForTimeout(1800);await page.keyboard.up('KeyD');const movedPosition=await page.evaluate(()=>window.awInspect().hero.position);assert(Math.hypot(movedPosition.x-initialPosition.x,movedPosition.y-initialPosition.y)>1);checks.push({name:'painted-map-real-movement',initialPosition,movedPosition});await shot('03-camp-moved');
  await measure('camp');
  await page.getByRole('button', {name:'前往远行之门', exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#hintbox')?.textContent.includes('打开远行地图'),{},{timeout:45000});
  await page.keyboard.press('KeyE');
  await shot('04-travel');
  const travel = await measure('travel');
  if (!travel.title) throw Error('travel title empty');
  await page.locator('[data-action="travel-depart"][data-id="meadow"]').click();
  await page.waitForFunction(() => window.awInspect().region === 'meadow' && window.awInspect().panel === '');
  await page.locator('[data-action="mode"][data-id="auto"]').click();
  await page.waitForTimeout(1800);
  await shot('05-battle');
  for (const [name, button] of [['bag','背包'],['skills','技能'],['tasks','目标'],['settings','设置']]) {
    await page.getByRole('button', {name:button, exact:true}).click();
    await page.locator('[data-panel="'+name+'"]').waitFor();await page.waitForTimeout(250);
    await shot('06-' + name);
    const box = await measure(name);
    if (!box.title) throw Error(name + ' title empty');
    await page.locator('[data-action="close"]').click();
  }
  for (const [w,h] of sizes) {
    await page.setViewportSize({width:w, height:h});
    await page.waitForTimeout(200);
    await shot(`size-${w}x${h}-hud`);
    const hud = await measure(`hud-${w}x${h}`);
    if (hud.minimapContainsCanvas === false) throw Error(`minimap overflow at ${w}x${h}`);
    if (hud.overflow > 1) throw Error(`page overflow ${hud.overflow} at ${w}x${h}`);
    await page.getByRole('button', {name:'背包', exact:true}).click();
    await page.locator('.bag-v2').waitFor();await page.waitForTimeout(250);assert(await page.locator('#preview').isVisible());const actions=await page.locator('.gear-detail .actions').boundingBox();assert(actions&&actions.y+actions.height<=h);await shot(`size-${w}x${h}-bag`);
    const bag = await measure(`bag-${w}x${h}`);
    if (!bag.title) throw Error('bag title empty');
    await page.locator('[data-action="close"]').click();
    await page.getByRole('button', {name:'技能', exact:true}).click();
    await page.locator('.skill-book').waitFor();
    for(const category of ['melee','ranged','control','support']){
      await page.locator('[data-action=skill-category][data-id='+category+']').click();
      assert.equal(await page.getByRole('tab').count(),4);
      assert.equal(await page.locator('[data-action=skill-category][data-id='+category+']').getAttribute('aria-selected'),'true');
      const allowed=catalog.filter(sk=>sk.category===category).map(sk=>sk.id);
      assert.deepEqual((await page.locator('.lib-pick').evaluateAll(els=>els.map(el=>el.dataset.id))).sort(),[...allowed].sort());
      await shot(`size-${w}x${h}-skills${category==='melee'?'':'-'+category}`);
      const layout=await page.evaluate(()=>{const rect=q=>document.querySelector(q).getBoundingClientRect(),panel=rect('[data-panel=skills]'),save=rect('.savebar'),library=rect('.library'),detail=rect('.skill-detail'),loadout=rect('.skill-loadout'),ops=rect('.skill-detail .ops'),tabs=rect('.skill-categories');return {panelHeight:panel.height,panelTop:panel.top,panelBottom:panel.bottom,saveBottom:save.bottom,sideBySide:library.right<=detail.left+1,loadoutBelow:loadout.top>=library.bottom,actionsVisible:ops.top>=detail.top&&ops.bottom<=detail.bottom,tabsVisible:tabs.top>=panel.top&&tabs.bottom<=panel.bottom};});
      assert(layout.sideBySide&&layout.saveBottom<=h&&layout.loadoutBelow&&layout.actionsVisible&&layout.tabsVisible&&layout.panelTop>=0&&layout.panelBottom<=h,JSON.stringify(layout));
      const density=await page.locator('.library').evaluate(el=>({visibleHeight:el.clientHeight,totalHeight:el.scrollHeight,cards:el.querySelectorAll('.lib-card').length}));
      checks.push({name:'category-page-layout',size:[w,h],category,...layout,...density});
    }
    await measure(`skills-${w}x${h}`);
    await page.locator('[data-action="close"]').click();
  }
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:'技能',exact:true}).click();
  const available=await page.evaluate(()=>window.awInspect().snapshot.skillAccess);
  assert.equal(available.filter(sk=>sk.unlocked).length,3);
  await page.locator('[data-action=skill-category][data-id=ranged]').click();
  assert(await page.locator('input[name=skill][value=lance]').isDisabled());
  await page.locator('[data-action=skill-focus][data-id=lance]').click();
  assert(await page.locator('[data-action=skill-activate]').isDisabled());
  assert((await page.locator('.skill-detail').innerText()).includes('10级'));
  await shot('locked-lance');
  for(const category of ['melee','ranged','control','support']){
    await page.locator('[data-action=skill-category][data-id='+category+']').click();
    assert.equal(await page.locator('[data-action=skill-category][data-id='+category+']').getAttribute('aria-pressed'),'true');
    const count=catalog.filter(sk=>sk.category===category).length;assert.equal(await page.locator('.lib-card').count(),count);
  }
  await shot('support-category');
  await page.locator('[data-action=skill-category][data-id=ranged]').click();
  checks.push({name:'skill-categories-and-locks',unlocked:available.filter(sk=>sk.unlocked).map(sk=>sk.id)});
  assert.equal(await page.locator('.skill-detail h3').innerText(),'星矛');
  await page.locator('[data-action=skill-category][data-id=ranged]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-id'),'control');
  await page.keyboard.press('End');assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-id'),'support');
  await page.keyboard.press('Home');assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-id'),'melee');
  await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[role=tab][aria-selected=true]').getAttribute('data-id'),'support');
  await page.locator('[data-action=skill-category][data-id=ranged]').click();checks.push({name:'tab-keyboard-and-page-focus-memory',passed:true});
  const before=await page.evaluate(()=>window.awInspect().snapshot.skills);
  const changed=before[1];await page.locator('input[name=skill][value="'+changed+'"]').uncheck();
  await page.locator('[data-action=skill-category][data-id=support]').click();
  assert.equal(await page.locator('.loadout [data-id="'+changed+'"]').count(),0);
  await page.locator('[data-action=skill-category][data-id=ranged]').click();
  assert.equal(await page.locator('.savebar').getAttribute('data-state'),'draft');
  assert.equal(await page.locator('.loadout [data-id="'+changed+'"]').count(),0);
  await page.getByRole('button',{name:'保存装配',exact:true}).click();
  await page.waitForFunction(()=>window.awInspect().snapshot.skills.length===2);
  await page.locator('[data-action=close]').click();
  const saved=await page.evaluate(()=>window.awInspect().snapshot.skills);assert(!saved.includes(changed));checks.push({name:'skill-draft-and-server-save',before,saved});
  await page.getByRole('button',{name:'背包',exact:true}).click();
  const bow=await page.evaluate(()=>window.awInspect().snapshot.gear.find(g=>g.base==='bow').id);
  await page.locator('.grid24 [data-id="'+bow+'"]').click();await page.waitForTimeout(250);
  await page.locator('[data-action=salvage-confirm]').click();
  await page.locator('[data-action=cancel-confirm]').focus();await page.keyboard.press('Tab');
  assert(await page.evaluate(()=>!!document.activeElement.closest('.confirm-box')));
  await page.keyboard.press('Escape');assert.equal(await page.locator('.confirm-box').count(),0);assert.equal(await page.locator('#modal .panel').count(),1);checks.push({name:'confirmation-focus-and-escape',passed:true});
  await page.locator('[data-action=close]').click();await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'背包');checks.push({name:'stable-hud-focus-return',passed:true});
  await page.route('**/api/gear/*/preview',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue();});
  await page.getByRole('button',{name:'背包',exact:true}).click();await page.locator('[data-action=close]').click();
  await page.waitForTimeout(700);assert.equal(errors.length,0);await page.unroute('**/api/gear/*/preview');checks.push({name:'late-preview-after-close',passed:true});
  await page.keyboard.down('KeyD');await page.waitForTimeout(1200);await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA');await page.waitForTimeout(1200);await page.keyboard.up('KeyA');
  await page.goto(origin + '/ui-v2-showcase.html');
  await page.locator('#keygrid').waitFor();
  await shot('07-showcase');
  const showcase = await page.evaluate(() => ({
    grounds: [...document.querySelectorAll('.ground')].map(n => n.getAttribute('aria-label')),
    checkbox: document.querySelector('#demo-check')?.getAttribute('aria-label'),
    role: document.querySelector('#demo-check')?.getAttribute('role'),
  }));
  if (showcase.grounds.length < 5 || !showcase.checkbox) throw Error('showcase incomplete ' + JSON.stringify(showcase));
  await page.mouse.move(500,400);await page.mouse.wheel(0,2000);await page.waitForTimeout(300);assert(await page.evaluate(()=>scrollY>0));
  await page.locator('#demo-check').check();assert.equal(await page.locator('#keygrid .is-cd').count(),12);
  await page.locator('#keygrid button').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');assert.equal(await page.locator('#keygrid button').nth(1).getAttribute('aria-pressed'),'true');
  await page.locator('#tip-host').focus();assert.equal(await page.locator('#tooltip').evaluate(el=>getComputedStyle(el).display),'block');
  assert(await page.locator('[data-id="禁用"]').isDisabled());assert.equal(await page.locator('[data-id="加载"]').getAttribute('aria-busy'),'true');
  checks.push({name:'showcase-scroll-selection-cooldown-tooltip-disabled-loading',passed:true});await shot('showcase-states');
  assert.equal(errors.length,0);await context.close();await copyFile(await video.path(),resolve(evidence,'operations.webm'));await browser.close();
  await writeFile(`${evidence}/visual.json`, JSON.stringify({ok:true, origin, notes, showcase, errors,checks}, null, 2));
  console.log(JSON.stringify({ok:true, shots:notes.filter(n => typeof n === 'string').length, errors}, null, 2));
} finally {
  await stopChild(web);
  await stopChild(api);
  if(browser)await browser.close();
  const cleanup=await db.stop();await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'cleanup.json'),JSON.stringify(cleanup,null,2));console.log('db',JSON.stringify(cleanup));
}
