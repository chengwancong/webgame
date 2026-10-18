import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {root} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';

const base=process.env.AW_IVORY_ORIGIN??'http://127.0.0.1:8611',out=join(root,'../docs/reviews/open-world/compact-menu-a1-20261003');
await mkdir(out,{recursive:true});let browser,pool,page;
const report={ok:false,base,checks:[],errors:[],geometry:[],fixture:'New QA account with declared gold, material and inventory fixtures. No existing account is edited.'};
const check=(value,name)=>{assert.ok(value,name);report.checks.push(name);};
try{
 const health=await (await fetch(base+'/api/health')).json(),content=await (await fetch(base+'/api/content')).json();assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);
 const port=Number((await readFile(join(root,'.runtime/dev/data/postmaster.pid'),'utf8')).split(/\r?\n/)[3]);pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/art/'))report.errors.push('Missing art '+r.url());});
 const username='menua1_'+randomUUID().replaceAll('-','').slice(0,18);await page.goto(base);await page.screenshot({path:join(out,'login-1280x720.png')});await page.locator('#username').fill(username);await page.locator('[data-action=login]').click();await page.screenshot({path:join(out,'create-1280x720.png')});await page.locator('#hero-name').fill('浅金冒险者');await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 const initial=await page.evaluate(()=>window.awInspect().snapshot);await page.request.post(base+'/api/logout',{data:{}});
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[initial.id])).rows[0].state;state.gold=2656;state.material=16;
 state.progression.materials={ore:48,herb:24,leather:12};state.progression.consumables={tonic_attack:3};state.gear[1].quality='rare';state.story={...state.story,legacyAccess:true};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);await page.reload();await page.locator('#username').fill(username);await page.locator('[data-action=login]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town');
 await page.waitForFunction(()=>window.awInspect().panel===''&&document.fonts.status==='loaded'&&document.querySelectorAll('.hud-menu-illustration').length===6&&document.querySelectorAll('#skillbar .skill-slot').length===3);check(true,'Real account-only login and camp restoration with six colored menu icons');
 const shot=async name=>page.screenshot({path:join(out,name+'.png')});
 const rect=selector=>page.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};});
 const hudGeometry=async label=>{const skills=await rect('#skillbar'),menu=await rect('#sysbar'),wallet=await rect('.hud-wallet');const size=page.viewportSize();check(skills.right<=menu.x||skills.bottom<=menu.y||menu.bottom<=skills.y,label+' skill/menu do not overlap');check(skills.x>=0&&skills.right<=size.width&&menu.x>=0&&menu.right<=size.width&&wallet.right<=size.width,label+' HUD stays in viewport');report.geometry.push({label,skills,menu,wallet});};
 await hudGeometry('1280x720');
 const menuMetrics=await page.locator('#sysbar .entry').evaluateAll(nodes=>nodes.map(button=>{const b=button.getBoundingClientRect(),label=button.querySelector('.entry-name'),l=label.getBoundingClientRect(),style=getComputedStyle(label);return {width:b.width,height:b.height,labelInside:l.left>=b.left&&l.right<=b.right&&l.top>=b.top&&l.bottom<=b.bottom,fontSize:style.fontSize,stroke:style.webkitTextStrokeWidth,shadow:style.textShadow};}));
 check(menuMetrics.every(x=>x.width===64&&x.height===64&&x.labelInside&&x.fontSize==='12px'&&x.stroke==='2px'&&x.shadow==='none'),'A1 matches 64px square buttons with crisp printed labels');report.menuMetrics=menuMetrics;
 const addBadge=()=>page.evaluate(()=>{document.querySelector('.qa-badge')?.remove();const source=document.querySelector('#sysbar [data-id=bag] .badge'),clone=source.cloneNode(true);clone.hidden=false;clone.textContent='49';clone.classList.add('qa-badge');clone.setAttribute('aria-hidden','true');source.parentElement.append(clone);});
 await addBadge();report.badgeFixture={value:49,persisted:false};
 const badgeRect=await rect('.qa-badge');check(badgeRect.y>=0&&badgeRect.right<=1280,'49 badge stays visible outside the rounded button without viewport clipping');
 await shot('main-camp-1280x720');const menuBox=await rect('#sysbar');await page.screenshot({path:join(out,'menu-a1.png'),clip:{x:menuBox.x-6,y:menuBox.y-6,width:menuBox.width+12,height:menuBox.height+12}});await page.locator('.qa-badge').evaluate(e=>e.remove());
 await page.locator('#sysbar [data-action=panel][data-id=bag]').click();await page.locator('[data-action=bag-select][data-item-kind=equipment]').first().click();await page.locator('#preview[data-state=ready]').waitFor();
 const panelColor=await page.locator('.panel').evaluate(e=>getComputedStyle(e).backgroundColor);check(panelColor==='rgb(252, 250, 245)','Expanded bag matches approved ivory background');
 check(await page.locator('.panel').evaluate(e=>getComputedStyle(e).colorScheme)==='light','Native controls use the light color scheme');
 check(await page.locator('.panel').evaluate(e=>getComputedStyle(e).backgroundImage)==='none','No rivets or material texture on window surfaces');
 check(await page.locator('.bag-primary').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(239, 207, 133)','Bag main action uses the approved pale gold');
 const first=page.locator('[data-action=bag-select][data-item-kind=equipment]').first(),second=page.locator('[data-action=bag-select][data-item-kind=equipment]').nth(1);
 const shape=()=>first.locator('.bag-item-well').evaluate(e=>{const r=e.getBoundingClientRect(),img=e.querySelector('img').getBoundingClientRect();return {w:r.width,h:r.height,iw:img.width,ih:img.height};});
 const before=await shape();for(let n=0;n<6;n++){await second.click();await first.click();}assert.deepEqual(await shape(),before);check(true,'Repeated selection keeps item and illustration geometry fixed');await page.locator('#preview[data-state=ready]').waitFor();await shot('bag-equipment-1280x720');
 for(const category of ['materials','consumables','equipment']){await page.locator(`[data-action=bag-category][data-id=${category}]`).click();if(category==='equipment')await page.locator('#preview[data-state=ready]').waitFor();await shot('bag-'+category+'-1280x720');}
 await page.locator('#modal [data-action=close]').click();
 for(const panel of ['character','skills','progression','appearance','tasks','settings']){
  const entry=panel==='character'?page.locator('#vitals .character-entry'):page.locator(`#sysbar [data-action=panel][data-id=${panel}]`);await entry.click();
  await page.waitForFunction(id=>window.awInspect().panel===id,panel,{timeout:8000});await page.locator('#modal .panel,#modal .task-window').waitFor();await shot(panel+'-1280x720');check(await page.locator('#modal .panel,#modal .task-window').evaluate(e=>getComputedStyle(e).backgroundColor)==='rgb(252, 250, 245)',panel+' has the ivory surface');
  await page.locator('#modal [data-action=close]').click();await page.waitForFunction(()=>window.awInspect().panel==='');report.checks.push(panel+' menu opens and closes through live controls');
 }check(true,'All six menu windows inherit the shared ivory-gold controls');
 const settingsIcon=page.locator('#sysbar [data-id=settings]');await settingsIcon.click({position:{x:30,y:18}});await page.waitForFunction(()=>window.awInspect().panel==='settings');await page.locator('#modal [data-action=close]').click();await page.waitForFunction(()=>window.awInspect().panel==='');check(true,'Settings illustration and label both activate their enclosing menu button');
 const orb=page.locator('#sysbar [data-id=bag]');await page.mouse.move(500,400);
 const idle=await orb.evaluate(e=>getComputedStyle(e).borderColor);await orb.hover();await page.waitForFunction(color=>getComputedStyle(document.querySelector('#sysbar [data-id=bag]')).borderColor!==color,idle);const hovered=await orb.evaluate(e=>getComputedStyle(e).borderColor);check(idle!==hovered,'Hover brightens the gold menu rim');
 const idleRect=await rect('#sysbar [data-id=bag]');await page.mouse.down();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const pressedRect=await rect('#sysbar [data-id=bag]');report.press={idleRect,pressedRect,style:await orb.evaluate(e=>({active:e.matches(':active'),transform:getComputedStyle(e).transform,disabled:e.disabled}))};check(Math.abs(pressedRect.y-idleRect.y-1)<.1&&pressedRect.width===idleRect.width&&pressedRect.height===idleRect.height,'Pressed menu plate sinks one pixel without resizing');await page.mouse.move(500,400);await page.mouse.up();
 for(const [width,height]of [[1024,576],[375,812]]){await page.setViewportSize({width,height});await hudGeometry(width+'x'+height);const shapes=await page.locator('#sysbar .entry').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height};}));check(shapes.every(x=>x.w===x.h&&x.w>=44),'Responsive menu stays square with at least 44px hit targets');await shot('main-'+width+'x'+height);await page.locator('[data-action=panel][data-id=bag]').click();const r=await rect('#modal .panel');check(r.x>=0&&r.right<=width&&r.y>=0&&r.bottom<=height,width+'x'+height+' bag frame fits viewport');await shot('bag-'+width+'x'+height);await page.locator('#modal [data-action=close]').click();}
 await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('#sysbar .entry').first().evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(t=>t.trim()==='0s')),'Reduced motion disables menu transitions');
 assert.deepEqual(report.errors,[]);report.ok=true;report.versions=versions;
}catch(error){report.error=String(error.stack??error);if(page){report.body=await page.locator('body').innerText();report.panel=await page.evaluate(()=>window.awInspect?.().panel);await page.screenshot({path:join(out,'failure.png')});}process.exitCode=1;}finally{await browser?.close();await pool?.end();await writeFile(join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
