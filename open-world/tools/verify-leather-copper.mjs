import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {root} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';

const base=process.env.AW_COPPER_ORIGIN??'http://127.0.0.1:8612',out=join(root,'../docs/reviews/open-world/leather-copper-20261003');
await mkdir(out,{recursive:true});let browser,pool,page;
const report={ok:false,base,checks:[],errors:[],geometry:[],fixture:'New QA account with declared gold, material and inventory fixtures. No existing account is edited.'};
const check=(value,name)=>{assert.ok(value,name);report.checks.push(name);};
try{
 const health=await (await fetch(base+'/api/health')).json(),content=await (await fetch(base+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);
 const port=Number((await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/)[3]);pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/art/'))report.errors.push('Missing art '+r.url());});
 const username='copper_'+randomUUID().replaceAll('-','').slice(0,18);await page.goto(base);await page.locator('#username').fill(username);await page.locator('[data-action=login]').click();await page.locator('#hero-name').fill('铜边冒险者');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 const initial=await page.evaluate(()=>window.awInspect().snapshot);await page.request.post(base+'/api/logout',{data:{}});
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[initial.id])).rows[0].state;delete state.story;state.gold=2656;state.material=16;
 state.progression.materials={ore:48,herb:24,leather:12};state.progression.consumables={tonic_attack:3};state.gear[1].quality='rare';
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);await page.reload();await page.locator('#username').fill(username);await page.locator('[data-action=login]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 await page.waitForFunction(()=>document.fonts.status==='loaded'&&document.querySelectorAll('.hud-menu-illustration').length===6&&document.querySelectorAll('#skillbar .skill-slot').length===3);check(true,'Real account-only login and camp restoration with six colored menu icons');
 const shot=async name=>page.screenshot({path:join(out,name+'.png')});
 const rect=selector=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
 const hudGeometry=async label=>{const skills=await rect('#skillbar'),menu=await rect('#sysbar'),wallet=await rect('.hud-wallet');const size=page.viewportSize();check(skills.right<=menu.x||skills.bottom<=menu.y||menu.bottom<=skills.y,label+' skill/menu do not overlap');check(skills.x>=0&&skills.right<=size.width&&menu.x>=0&&menu.right<=size.width&&wallet.right<=size.width,label+' HUD stays in viewport');report.geometry.push({label,skills,menu,wallet});};
 await hudGeometry('1280x720');await shot('main-camp-1280x720');
 await page.locator('[data-action=panel][data-id=bag]').click();await page.locator('[data-action=bag-select][data-item-kind=equipment]').first().click();await page.locator('#preview[data-state=ready]').waitFor();
 const panelColor=await page.locator('.panel').evaluate(e=>getComputedStyle(e).backgroundColor);check(panelColor==='rgb(48, 33, 24)','Expanded bag has a flat dark-brown page surface');
 const first=page.locator('[data-action=bag-select][data-item-kind=equipment]').first(),second=page.locator('[data-action=bag-select][data-item-kind=equipment]').nth(1);
 const shape=()=>first.locator('.bag-item-well').evaluate(e=>{const r=e.getBoundingClientRect(),img=e.querySelector('img').getBoundingClientRect();return {w:r.width,h:r.height,iw:img.width,ih:img.height};});
 const before=await shape();for(let n=0;n<6;n++){await second.click();await first.click();}assert.deepEqual(await shape(),before);check(true,'Repeated selection keeps item and illustration geometry fixed');await page.locator('#preview[data-state=ready]').waitFor();await shot('bag-equipment-1280x720');
 for(const category of ['materials','consumables','equipment']){await page.locator(`[data-action=bag-category][data-id=${category}]`).click();if(category==='equipment')await page.locator('#preview[data-state=ready]').waitFor();await shot('bag-'+category+'-1280x720');}
 await page.locator('#modal [data-action=close]').click();
 for(const panel of ['skills','progression','appearance','tasks','settings']){
  const entry=page.locator(`#sysbar [data-action=panel][data-id=${panel}]`);await entry.locator('.entry-name').click();
  await page.waitForFunction(id=>window.awInspect().panel===id,panel,{timeout:8000});await page.locator('#modal .panel,#modal .task-window').waitFor();await shot(panel+'-1280x720');
  await page.locator('#modal [data-action=close]').click();await page.waitForFunction(()=>window.awInspect().panel==='');report.checks.push(panel+' menu opens and closes through live controls');
 }check(true,'All six menu windows inherit the shared leather-copper controls');
 const settingsIcon=page.locator('#sysbar [data-id=settings] .entry-orb');await settingsIcon.click();await page.waitForFunction(()=>window.awInspect().panel==='settings');await page.locator('#modal [data-action=close]').click();await page.waitForFunction(()=>window.awInspect().panel==='');check(true,'Settings illustration and label both activate their enclosing menu button');
 const orb=page.locator('#sysbar [data-id=bag] .entry-orb');await page.mouse.move(500,400);
 const idle=await orb.evaluate(e=>getComputedStyle(e).borderColor);await orb.hover();await page.waitForFunction(color=>getComputedStyle(document.querySelector('#sysbar [data-id=bag] .entry-orb')).borderColor!==color,idle);const hovered=await orb.evaluate(e=>getComputedStyle(e).borderColor);check(idle!==hovered,'Hover brightens the copper menu rim');
 const idleRect=await rect('#sysbar [data-id=bag] .entry-orb');await page.mouse.down();const pressedRect=await rect('#sysbar [data-id=bag] .entry-orb');check(Math.abs(pressedRect.y-idleRect.y-1)<.1,'Pressed menu plate sinks one pixel');await page.mouse.move(500,400);await page.mouse.up();
 for(const [width,height]of [[1024,576],[375,812]]){await page.setViewportSize({width,height});await hudGeometry(width+'x'+height);await shot('main-'+width+'x'+height);await page.locator('[data-action=panel][data-id=bag]').click();const r=await rect('#modal .panel');check(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=height,width+'x'+height+' bag frame fits viewport');await shot('bag-'+width+'x'+height);await page.locator('#modal [data-action=close]').click();}
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('#sysbar .entry-orb').first().evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(t=>t.trim()==='0s')),'Reduced motion disables menu transitions');
 assert.deepEqual(report.errors,[]);report.ok=true;report.versions=versions;
}catch(error){report.error=String(error.stack??error);if(page){report.body=await page.locator('body').innerText();report.panel=await page.evaluate(()=>window.awInspect?.().panel);await page.screenshot({path:join(out,'failure.png')});}process.exitCode=1;}finally{await browser?.close();await pool?.end();await writeFile(join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
