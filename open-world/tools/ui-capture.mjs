// Captures the current UI at the design canvas so before/after comparisons use
// the same viewport, region, character states and similar battle pressure.
// Usage: node tools/ui-capture.mjs <evidenceDir> [--wait-login]
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {writeFile, mkdir, rm} from 'node:fs/promises';

const evidence = process.argv[2] ?? 'docs/reviews/open-world/ui-baseline';
const url = process.env.AW_UI_URL ?? 'http://127.0.0.1:8612/';
const VIEWPORT = {width: 1280, height: 720};

export async function capture(url, evidence) {
  await mkdir(evidence, {recursive: true});
  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
  });
  const context = await browser.newContext({viewport: VIEWPORT, deviceScaleFactor: 1});
  const page = await context.newPage();
  const errors = [];
  const badResponses = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) badResponses.push(r.status() + ' ' + r.url()); });
  const inspect = () => page.evaluate(() => window.awInspect());
  const wait = async (fn, timeout = 60000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const s = await inspect();
      if (fn(s)) return s;
      await page.waitForTimeout(200);
    }
    throw Error('timeout: ' + JSON.stringify(await inspect()));
  };
  const shots = [];
  const shot = async (name) => {
    const path = `${evidence}/${name}.png`;
    await page.screenshot({path});
    shots.push(name);
  };

  const username = 'ui_' + randomUUID().slice(0, 10).replaceAll('-', '');
  try {
    await page.goto(url, {waitUntil: 'load'});
    await page.locator('#username').waitFor();
    await shot('01-login');

    await page.fill('#username', username);
    await page.getByRole('button', {name: '进入游戏', exact: true}).click();
    await page.locator('#hero-name').waitFor();
    await shot('02-create');
    await page.fill('#hero-name', '基线旅人');
    await page.getByRole('button', {name: '进入营地', exact: true}).click();
    const camp = await wait(s => s.loggedIn && s.region === 'town' && s.panel === '');
    await page.waitForTimeout(900);
    await shot('03-camp');

    await page.getByRole('button', {name: '出发远行', exact: true}).click();
    await page.locator('[data-action="travel"][data-id="meadow"]').click();
    await wait(s => s.region === 'meadow' && s.panel === '');
    await page.locator('[data-action="mode"][data-id="auto"]').click();
    await page.waitForTimeout(2500);
    await shot('04-battle');
    const fighting = await wait(s => s.enemies > 0, 30000);

    // Busy combat frame: keep fighting until some damage has landed.
    await page.waitForTimeout(2500);
    await shot('05-battle-busy');

    await page.getByRole('button', {name: '背包', exact: true}).click();
    await page.waitForTimeout(700);
    await shot('06-bag');
    await page.locator('[data-action="close"]').click();

    await page.getByRole('button', {name: '构筑', exact: true}).click();
    await page.waitForTimeout(400);
    await shot('07-skills');
    await page.locator('[data-action="close"]').click();

    await page.getByRole('button', {name: '自动设置', exact: true}).click();
    await page.waitForTimeout(400);
    await shot('08-auto');
    await page.locator('[data-action="close"]').click();

    const state = await wait(s => s.snapshot.progress.kills >= 6, 90000);
    await page.getByRole('button', {name: '前往结界', exact: true}).click();
    await wait(s => Math.hypot(s.hero.position.x - 56, s.hero.position.y - 52) < 4, 90000);
    await page.keyboard.press('e');
    await page.waitForTimeout(500);
    await shot('09-boss-entry');
    await page.getByRole('button', {name: '进入试炼', exact: true}).click();
    await wait(s => s.region === 'meadow-boss');
    await page.locator('[data-action="mode"][data-id="auto"]').click();
    await page.waitForTimeout(3000);
    await shot('10-boss');

    const meta = {
      url, viewport: VIEWPORT, captured: new Date().toISOString(),
      region_sequence: ['town', 'meadow', 'meadow-boss'],
      character: '基线旅人',
      enemies_alive_at_capture: fighting.enemies,
      kills_at_boss: state.snapshot.progress.kills,
      level: state.snapshot.level,
      shots, page_errors: errors, bad_responses: badResponses,
    };
    await writeFile(`${evidence}/capture-meta.json`, JSON.stringify(meta, null, 2));
    // 本轮成功：清掉上一轮遗留的失败产物，避免交付目录里混入过时证据
    await rm(`${evidence}/capture-failure.json`, {force: true});
    await rm(`${evidence}/capture-failure.png`, {force: true});
    return meta;
  } catch (e) {
    await page.screenshot({path: `${evidence}/capture-failure.png`}).catch(() => {});
    await writeFile(`${evidence}/capture-failure.json`,
      JSON.stringify({error: String(e), errors, shots}, null, 2));
    throw e;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const meta = await capture(url, evidence);
  console.log(JSON.stringify(meta, null, 2));
}
