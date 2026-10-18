import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {chromium} from 'playwright';
import {startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';

const chibi=process.argv.includes('--chibi');
const out=resolve('../docs/reviews/open-world/'+(chibi?'item-presentation-chibi-20261003':process.argv.includes('--direction-a')?'item-presentation-a-20261003':'item-presentation-20261003'));
await mkdir(out,{recursive:true});
const report={ok:false,versions,checks:[],errors:[]};
let db,api,web,browser,pool,page;
const record=(name,data)=>{report.checks.push({name,data});console.log(name);};
async function login(origin,name){
 await page.goto(origin);await page.locator('#username').fill(name);
 await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();
 await page.locator('[data-action=create]').click();
 await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().metrics.frames>0);
}
async function shot(name){
 await page.mouse.move(8,8);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>Promise.all([...document.querySelectorAll('.panel img')].map(img=>img.decode())));
 await page.screenshot({path:resolve(out,name+'.png')});
}
try{
 db=await startDatabase({temporary:true});
 const apiPort=await freePort(),webPort=await freePort(),origin=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:origin,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});
 await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_API_PORT:String(apiPort),AW_WEB_PORT:String(webPort)},{stdio:['ignore','ignore','inherit']});await waitFor(origin,web);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>report.errors.push(String(error)));
 await login(origin,'item_visual_'+Date.now().toString(36));
 pool=new Pool({connectionString:db.dsn});const id=await page.evaluate(()=>window.awInspect().snapshot.id);
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const {progressionGearTemplates}=chibi?await import('../packages/content/deep-progression.ts'):{progressionGearTemplates:[]};
 const {materialDestinations}=chibi?await import('../apps/web/src/bag-model.ts'):{materialDestinations:{}};
 const source=structuredClone(state.gear);
 for(let i=0;i<18;i++)state.gear.push({...source[i%source.length],id:randomUUID(),name:i===17?'原初守望者的远行长剑':source[i%source.length].name,quality:['common','magic','rare','legendary'][i%4],locked:i%3===0});
 state.progression.consumables={tonic_attack:2,tonic_hp:2};state.progression.materials={ore:84,herb:36,leather:18,omega_fragment:12};state.skillBooks={ember:2};state.revision++;
 if(chibi){const blade=source.find(g=>g.base==='blade');state.gear.splice(-3,3,...progressionGearTemplates.map(t=>({...blade,id:randomUUID(),base:t.base,name:t.name,attack:t.attack,quality:t.base.startsWith('primal')?'legendary':'rare',locked:false})));state.progression.materials=Object.fromEntries(Object.keys(materialDestinations).map((key,i)=>[key,i+1]));}
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel===''&&window.awInspect().metrics.frames>=60);
 await page.locator('[data-action=panel][data-id=bag]').click();await page.locator('.bag-grid').waitFor();
 const category=async key=>{await page.locator(`[data-action=bag-category][data-id=${key}]`).click();await page.waitForFunction(key=>document.querySelector(`[data-action=bag-category][data-id=${key}]`)?.getAttribute('aria-selected')==='true',key);};
 const layouts=[];
 for(const viewport of [{width:1280,height:720},{width:1024,height:576},{width:1600,height:900},{width:1920,height:1080},{width:375,height:812}]){
  await page.setViewportSize(viewport);await category('equipment');
  const first=page.locator('[data-action=bag-select]').first();await first.click();
  const measure=()=>first.evaluate(el=>{const well=el.querySelector('.bag-item-well'),img=el.querySelector('.bag-item-image>img'),name=el.querySelector('b'),s=getComputedStyle(well);return {slot:[well.offsetWidth,well.offsetHeight],icon:[img.getBoundingClientRect().width,img.getBoundingClientRect().height],fill:s.backgroundImage,background:s.backgroundColor,font:getComputedStyle(name).fontFamily,fontSize:getComputedStyle(name).fontSize,weight:getComputedStyle(name).fontWeight};});
  const before=await measure();assert(before.fill!=='none'||before.background!=='rgba(0, 0, 0, 0)');assert(before.font.includes('WorldSans'));assert.equal(before.fontSize,'14px');assert.equal(before.weight,'500');
  await page.locator('[data-action=bag-select]').nth(1).click();const after=await measure();assert.deepEqual(before.slot,after.slot);assert.deepEqual(before.icon,after.icon);
  const last=page.locator('[data-action=bag-select]').last();await page.mouse.move(8,8);await last.scrollIntoViewIfNeeded();const scroll=await page.locator('.bag-grid').evaluate(el=>el.scrollTop);await last.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.bag-grid').evaluate(el=>el.scrollTop),scroll);
  await page.locator('.bag-grid').evaluate(el=>el.scrollTop=0);await first.click();await page.locator('#preview[data-seq]').waitFor();await shot('bag-equipment-'+viewport.width+'x'+viewport.height);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth)<=viewport.width+1);
  layouts.push({viewport,before,scroll});
 }
 record('filled-slots-readable-type-stable-selection-and-scroll',layouts);
 await page.setViewportSize({width:1280,height:720});await category('all');await page.locator('.bag-grid').evaluate(el=>el.scrollTop=0);await shot('bag-all-1280x720');
 await category('consumables');await shot('bag-consumables-1280x720');
 await category('equipment');await page.mouse.move(8,8);
 if(process.argv.includes('--direction-a')){
  const palette=await page.locator('.bag-item[data-item-kind=equipment]').evaluateAll(items=>Object.fromEntries(items.map(item=>{const s=getComputedStyle(item.querySelector('.bag-item-well'));return[item.dataset.quality,{background:s.backgroundColor,image:s.backgroundImage,shadow:s.boxShadow}];})));
  assert.equal(new Set(Object.values(palette).map(p=>p.background)).size,4);for(const p of Object.values(palette)){assert.equal(p.image,'none');assert.equal(p.shadow,'none');}
  record('direction-a-distinct-flat-quality-surfaces',palette);
 }
 const target=page.locator('[data-action=bag-select]').first();await target.hover();await page.locator('#tooltip.equipment-tip[aria-busy=false][aria-hidden=false]').waitFor();
 const tip=await page.locator('#tooltip').boundingBox();assert(tip.width<=344.5);await page.screenshot({path:resolve(out,'equipment-tip-1280x720.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('#tooltip').getAttribute('aria-hidden'),'true');record('vertical-tooltip-and-keyboard-dismiss',tip);
 if(chibi){
  const snapshot=await page.evaluate(()=>window.awInspect().snapshot);
  await page.locator('.panel [data-action=close]').click();
  const fixture={permit_id:randomUUID(),region:'meadow-boss',cycle:1,success:true,first_clear:false,unlocked_regions:[],totals:{gold:120,xp:18,material:7},materials:snapshot.progression.materials,books:{ember:2},gear:Object.values(Object.fromEntries(snapshot.gear.map(g=>[g.base,g]))),pending_gear:0,delivery:'inventory',history_complete:true};
  const draw=async(data,phase)=>page.evaluate(async({data,phase})=>{const {battleResultHtml}=await import('/src/battle-result-panel.ts');const root=document.getElementById('modal');root.classList.add('open');root.innerHTML=battleResultHtml({region:data.region,outcome:data.success?'success':'failure'},data,phase,'归途营地','',false);},{data,phase});
  const resultLayouts=[];
  for(const viewport of [{width:1280,height:720},{width:1024,height:576},{width:1600,height:900},{width:1920,height:1080},{width:375,height:812}]){
   await page.setViewportSize(viewport);await draw(fixture,'ready');await page.mouse.move(1,1);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.loot-tile img')].map(img=>img.decode())));
   const styles=await page.locator('.loot-tile').evaluateAll(tiles=>tiles.map(tile=>{const s=getComputedStyle(tile),b=tile.getBoundingClientRect(),img=tile.querySelector('img');return{quality:tile.dataset.quality??'stack',background:s.backgroundColor,image:s.backgroundImage,shadow:s.boxShadow,size:[b.width,b.height],src:img.getAttribute('src'),natural:[img.naturalWidth,img.naturalHeight]};}));
   assert.equal(new Set(styles.filter(x=>x.quality!=='stack').map(x=>x.background)).size,4);for(const s of styles){assert.equal(s.image,'none');assert.equal(s.shadow,'none');assert.deepEqual(s.size,[64,64]);assert(s.src.includes('/items-chibi/'));assert.deepEqual(s.natural,[256,256]);}
   const button=await page.locator('[data-action=result-return]').boundingBox();await shot('settlement-success-'+viewport.width+'x'+viewport.height);await page.locator('.loot-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);assert.deepEqual(await page.locator('[data-action=result-return]').boundingBox(),button);assert(button.x>=0&&button.y+button.height<=viewport.height);assert(await page.evaluate(()=>document.documentElement.scrollWidth)<=viewport.width+1);
   await shot('settlement-success-scroll-'+viewport.width+'x'+viewport.height);resultLayouts.push({viewport,styles,button});
  }
  await page.setViewportSize({width:1280,height:720});await draw({...fixture,success:false},'ready');await shot('settlement-failure-1280x720');await draw(fixture,'offline');await shot('settlement-offline-1280x720');record('settlement-production-renderer-read-only-fixtures',resultLayouts);
 }
 await page.goto(origin+'/ground-loot-qa.html');await page.waitForFunction(()=>window.awLootInspect?.().items.length===9&&window.awLootInspect().items.every(i=>i.loaded));
 const loot=await page.evaluate(()=>window.awLootInspect());assert.equal(loot.errors.length,0);for(const item of loot.items){assert.equal(item.width,32);assert.equal(item.height,32);assert.equal(item.labelResolution,2);assert(item.thumbnail.includes('/small-icons/'));assert.deepEqual(item.textureSize,[96,96]);}
 await shot('ground-loot-1280x720');record('small-transparent-loot-and-high-resolution-type',loot);
 // Real managed service: verify compatible versions, login, and a session restore.
 const live='http://127.0.0.1:8612';const health=await(await fetch(live+'/api/health')).json(),content=await(await fetch(live+'/api/content')).json();
 for(const key of ['protocol','rules','assets']){assert.equal(health.versions[key],versions[key]);assert.equal(content.versions[key],versions[key]);}
 await login(live,'item_live_'+Date.now().toString(36));await shot('live-camp-1280x720');await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().region==='town'&&window.awInspect().metrics.frames>0);
 record('managed-service-compatible-login-and-session-restore',{health:health.versions,content:content.versions});
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}
finally{await browser?.close();await pool?.end();await stopChild(web);await stopChild(api);if(db)report.cleanup=await db.stop();await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,error:report.error,out}));}
