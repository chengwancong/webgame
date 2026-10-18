import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {startDatabase, freePort, child, stopChild, waitFor, registerApi} from './runtime.mjs';

const evidence = process.argv[2] ?? 'docs/reviews/open-world/ui-v2-fix-20260929';
const sizes = [[1280,720],[1600,900],[1920,1080],[1024,576]];
const node = process.execPath;

const db = await startDatabase({temporary:true});
const apiPort = await freePort();
const webPort = await freePort();
const origin = `http://127.0.0.1:${webPort}`;
let api, web;
const notes = [];
try {
  api = child(node, ['--import','tsx','apps/api/src/main.ts'], {
    AW_DATABASE_URL: db.dsn,
    AW_API_PORT: String(apiPort),
    AW_ORIGINS: origin,
  });
  await registerApi(db, api);
  await waitFor(`http://127.0.0.1:${apiPort}/api/health`, api);
  web = child(node, ['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'], {
    AW_API_PORT: String(apiPort),
    AW_WEB_PORT: String(webPort),
  });
  await waitFor(origin + '/', web);
  await mkdir(evidence, {recursive:true});
  const browser = await chromium.launch({channel:'chrome', headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
  const page = await browser.newPage({viewport:{width:1280,height:720}, deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const shot = async name => { await page.screenshot({path:`${evidence}/${name}.png`}); notes.push(name); };
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
  await page.getByRole('button', {name:'进入游戏', exact:true}).click();
  await page.locator('#hero-name').waitFor();
  await shot('02-create');
  await page.getByRole('button', {name:'进入营地', exact:true}).click();
  await page.waitForFunction(() => window.awInspect().loggedIn && window.awInspect().panel === '');
  await page.waitForTimeout(600);
  await shot('03-camp');
  await measure('camp');
  await page.getByRole('button', {name:'出发远行', exact:true}).click();
  await shot('04-travel');
  const travel = await measure('travel');
  if (!travel.title) throw Error('travel title empty');
  await page.locator('[data-action="travel"][data-id="meadow"]').click();
  await page.waitForFunction(() => window.awInspect().region === 'meadow' && window.awInspect().panel === '');
  await page.locator('[data-action="mode"][data-id="auto"]').click();
  await page.waitForTimeout(1800);
  await shot('05-battle');
  for (const [name, button] of [['bag','背包'],['skills','构筑'],['auto','自动设置'],['tasks','目标'],['settings','设置']]) {
    await page.getByRole('button', {name:button, exact:true}).click();
    await page.waitForTimeout(250);
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
    await shot(`size-${w}x${h}-bag`);
    const bag = await measure(`bag-${w}x${h}`);
    if (!bag.title) throw Error('bag title empty');
    await page.locator('[data-action="close"]').click();
    await page.getByRole('button', {name:'构筑', exact:true}).click();
    await shot(`size-${w}x${h}-skills`);
    await measure(`skills-${w}x${h}`);
    await page.locator('[data-action="close"]').click();
  }
  await page.goto(origin + '/ui-v2-showcase.html');
  await page.locator('#keygrid').waitFor();
  await shot('07-showcase');
  const showcase = await page.evaluate(() => ({
    grounds: [...document.querySelectorAll('.ground')].map(n => n.getAttribute('aria-label')),
    checkbox: document.querySelector('#demo-check')?.getAttribute('aria-label'),
    role: document.querySelector('#demo-check')?.getAttribute('role'),
  }));
  if (showcase.grounds.length < 5 || !showcase.checkbox) throw Error('showcase incomplete ' + JSON.stringify(showcase));
  await browser.close();
  await writeFile(`${evidence}/visual.json`, JSON.stringify({ok:true, origin, notes, showcase, errors}, null, 2));
  console.log(JSON.stringify({ok:true, shots:notes.filter(n => typeof n === 'string').length, errors}, null, 2));
} finally {
  await stopChild(web);
  await stopChild(api);
  console.log('db', JSON.stringify(await db.stop()));
}
