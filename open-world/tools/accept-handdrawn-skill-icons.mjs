import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {Pool} from 'pg';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {skillCatalog} from '../packages/content/index.ts';

const evidence=resolve(process.env.AW_SKILL_ICON_EVIDENCE??'../docs/reviews/open-world/skill-icons-handdrawn-20261001');await mkdir(evidence,{recursive:true});
const manifest=JSON.parse(await readFile('packages/asset-manifest/ui.v2.json','utf8'));
const icons=skillCatalog.map(skill=>({skill,asset:manifest.assets['skill-'+skill.id]}));
assert(icons.every(({asset})=>asset?.path.startsWith('/art/ui-v2/skill-handdrawn/')),'Every skill requires formal hand-drawn art');
assert.equal(new Set(icons.map(({asset})=>asset.sha256)).size,skillCatalog.length,'Shared skill artwork is not allowed');
const db=await startDatabase({temporary:true});let server,browser;const errors=[],checks=[];
try{
 const dist=resolve(db.work,'build'),build=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--outDir',dist],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);
 const port=await freePort(),origin=`http://127.0.0.1:${port}`;
 server=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(port),AW_ORIGINS:origin,AW_STATIC_ROOT:dist,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,server);await waitFor(origin+'/api/health',server);
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(origin);await page.locator('#username').fill('icon_'+randomUUID().replaceAll('-','').slice(0,16));await page.getByRole('button',{name:'进入游戏',exact:true}).click();await page.getByRole('button',{name:'进入营地',exact:true}).click();await page.waitForFunction(()=>window.awInspect().loggedIn&&window.awInspect().panel==='');
 // Controlled legacy fixture in this disposable database exposes the whole
 // library; fresh campaign accounts otherwise keep skills behind story unlocks.
 const pool=new Pool({connectionString:db.dsn,max:1});
 try{const id=await page.evaluate(()=>window.awInspect().snapshot.id),state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;delete state.story;delete state.starsea;state.level=50;state.lastRegion='town';state.progress.safe='town';await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);}finally{await pool.end();}
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().panel==='');
 await page.locator('#sysbar [data-action=panel][data-id=skills]').click();
 for(const category of ['martial','spell','support']){
  await page.locator(`[data-action=skill-category][data-id=${category}]`).click();
  const ids=await page.locator('[data-action=skill-focus]').evaluateAll(elements=>elements.map(el=>el.dataset.id));
  for(const id of ids){
   await page.locator(`[data-action=skill-focus][data-id=${id}]`).click();
   await page.locator('.skill-detail-heading img').evaluate(image=>image.decode());
   const geometry=await page.evaluate(id=>{const icon=document.querySelector(`[data-action=skill-focus][data-id="${id}"] img`),detail=document.querySelector('.skill-detail-heading img'),r=icon.getBoundingClientRect();return {src:icon.getAttribute('src'),detailSrc:detail.getAttribute('src'),natural:[detail.naturalWidth,detail.naturalHeight],size:[r.width,r.height],loaded:icon.complete&&icon.naturalWidth>0};},id);
   const expected=manifest.assets['skill-'+id].path;assert.equal(geometry.src,expected);assert.equal(geometry.detailSrc,expected);assert.deepEqual(geometry.natural,[256,256]);assert(geometry.loaded);assert.equal(geometry.size[0],geometry.size[1]);checks.push({id,category,...geometry});
  }
  await page.screenshot({path:resolve(evidence,category+'.png')});
 }
 await page.locator('[data-action=close]').click();await page.evaluate(()=>Promise.all([...document.querySelectorAll('.skill-slot img')].map(i=>i.decode())));const hud=await page.locator('.skill-slot img').evaluateAll(images=>images.map(i=>i.getAttribute('src')));assert(hud.length>0&&hud.every(path=>path.includes('/skill-handdrawn/')));await page.screenshot({path:resolve(evidence,'hotbar.png')});
 const gallery=await browser.newPage({viewport:{width:1280,height:1180}});
 await gallery.setContent(`<html><head><style>@font-face{font-family:WorldSans;src:url('${origin}/art/NotoSansSC.ttf')}body{margin:0;padding:24px;background:#0b1f3b;color:#f7e6c8;font:14px WorldSans,sans-serif}h1{font-size:24px;margin:0 0 8px}p{color:#a9c3d2;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}.tile{display:flex;flex-direction:column;align-items:center;gap:6px;background:#123450;border:1px solid #436782;border-radius:8px;padding:10px 4px}.tile>img{width:76px;height:76px;object-fit:contain}.small{display:flex;gap:8px;align-items:center;height:48px}.small img{width:32px;height:32px}.small img:last-child{width:48px;height:48px}b{font-weight:500}</style></head><body><h1>全部技能 · 手绘符记</h1><p>正式资源：透明底、独立图形。每格下方为 32px / 48px 小尺寸对照。</p><div class="grid">${icons.map(({skill,asset})=>`<div class="tile"><img src="${origin+asset.path}"><b>${skill.name}</b><div class="small"><img src="${origin+asset.path}"><img src="${origin+asset.path}"></div></div>`).join('')}</div></body></html>`);
 await gallery.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await gallery.evaluate(()=>document.fonts.ready);await gallery.screenshot({path:resolve(evidence,'all-skills.png'),fullPage:true});
 assert.equal(checks.length,skillCatalog.length);assert.deepEqual(errors,[]);await writeFile(resolve(evidence,'result.json'),JSON.stringify({ok:true,icons:checks.length,checks,hud,errors},null,2));console.log('All formal skill icons, detail selection, hotbar and small-size gallery passed.');
}finally{await browser?.close();await stopChild(server);await writeFile(resolve(evidence,'cleanup.json'),JSON.stringify(await db.stop(),null,2));}
