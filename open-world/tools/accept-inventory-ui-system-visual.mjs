import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {chromium} from 'playwright';
import {root,startDatabase,freePort,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {versions} from '../packages/contracts/index.ts';

const out=resolve('../.design/global-ui-system/screenshots');await mkdir(out,{recursive:true});
const report={ok:false,versions,checks:[],errors:[]};let db,api,web,browser,pool,page;
const record=(name,data={})=>{report.checks.push({name,...data});console.log(name);};
try{
 db=await startDatabase({temporary:true});assert(resolve(db.work).startsWith(resolve(root,'.qa')+sep));
 const apiPort=await freePort(),webPort=await freePort(),origin=`http://127.0.0.1:${webPort}`;
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:db.dsn,AW_API_PORT:String(apiPort),AW_ORIGINS:origin,AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(db,api);await waitFor(`http://127.0.0.1:${apiPort}/api/health`,api);
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts'],{AW_API_PORT:String(apiPort),AW_WEB_PORT:String(webPort)},{stdio:['ignore','ignore','inherit']});await waitFor(origin,web);
 pool=new Pool({connectionString:db.dsn});browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(origin);await page.locator('#username').fill('character_'+Date.now().toString(36));assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const id=await page.evaluate(()=>window.awInspect().snapshot.id),read=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const state=await read(),original=structuredClone(state.gear);state.gold=500;state.material=50;
 state.gear.push(...Array.from({length:18},(_,i)=>({...structuredClone(original.find(g=>g.base==='blade')),id:randomUUID(),name:i===17?'用于检查长名称的古老远行者苍风长剑':'备用苍风之刃 '+(i+1)})));state.revision++;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const character=page.locator('.panel[data-panel=character]');
 const openCharacter=async()=>{await page.locator('.character-entry').click();await character.waitFor();};
 const choose=async part=>{await character.locator(`[data-action=filter-slot][data-id=${part}]`).click();await page.locator('.character-chooser').waitFor();};
 const closeChooser=async()=>{await page.locator('[data-action=character-chooser-close]').click();await page.locator('.character-chooser').waitFor({state:'detached'});await page.mouse.move(8,8);};
 const select=async item=>{await character.locator(`[data-action=select][data-id="${item}"]`).click();await page.waitForFunction(id=>document.querySelector(`[data-action=select][data-id="${id}"]`)?.getAttribute('aria-pressed')==='true',item);await page.locator('#preview[data-seq]').waitFor();};
 const slots=()=>page.evaluate(()=>Array.from(document.querySelectorAll('[data-equipment-part]')).map(el=>{const {x,y,width,height}=el.getBoundingClientRect();return{part:el.dataset.equipmentPart,x,y,width,height};}));
 const stats=async()=>{const actual=await page.evaluate(()=>window.awInspect().snapshot.stats);for(const name of ['hp','attack','armor'])assert.equal(Number((await page.locator(`[data-character-stat=${name}]`).textContent()).replaceAll(',','')),actual[name]);return actual;};
 const shot=async name=>{if(await page.locator('#preview').count())await page.locator('#preview[data-seq]').waitFor();await page.mouse.move(8,8);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.panel[data-panel=character] img')].map(img=>img.decode())));await page.screenshot({path:resolve(out,'inventory-system-visual-'+name+'.png')});};
 await openCharacter();
 const layouts=[];
 for(const viewport of [{width:1280,height:720},{width:1024,height:576},{width:768,height:1024},{width:375,height:812}]){
  await page.setViewportSize(viewport);await shot('character-'+viewport.width+'x'+viewport.height);
  await choose('weapon');await select(state.gear.at(-1).id);await shot('long-name-'+viewport.width+'x'+viewport.height);
  const actionBox=await character.locator('.bag-detail-actions').boundingBox();await select(state.gear.at(-2).id);assert.deepEqual(await character.locator('.bag-detail-actions').boundingBox(),actionBox);
  await character.locator('[data-action=equip]').scrollIntoViewIfNeeded();await character.locator('[data-action=equip]').click();await page.locator('[data-action=gear-compare-confirm]:not([disabled])').waitFor();await page.screenshot({path:resolve(out,'inventory-system-visual-compare-'+viewport.width+'x'+viewport.height+'.png')});await page.locator('.gear-comparison-box [data-action=gear-compare-close]').last().click();await closeChooser();layouts.push(viewport);
 }
 record('final-four-viewports-long-name-and-comparison',{layouts});
 await page.setViewportSize({width:1280,height:720});await character.locator('[data-action=bag-return]').click();await page.locator('#preview[data-seq]').waitFor();
 const target=page.locator('[data-action=bag-select]').last();await target.scrollIntoViewIfNeeded();await page.mouse.move(8,8);await target.hover();await page.locator('#tooltip.equipment-tip[aria-busy=false][aria-hidden=false]').waitFor();
 const styles=await page.locator('#tooltip').evaluate(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return{width:b.width,pointerEvents:s.pointerEvents,fontSize:s.fontSize,padding:s.padding};});assert(styles.width>=343&&styles.width<=345);assert.equal(styles.pointerEvents,'auto');assert.equal(styles.fontSize,'14px');
 await page.screenshot({path:resolve(out,'inventory-system-visual-tooltip-1280x720.png')});
 await page.setViewportSize({width:1024,height:576});await page.mouse.move(8,8);await target.hover();await page.locator('#tooltip.equipment-tip[aria-busy=false][aria-hidden=false]').waitFor();await page.locator('#tooltip').hover();await page.mouse.wheel(0,500);await page.waitForFunction(()=>{const el=document.getElementById('tooltip');return el.scrollHeight<=el.clientHeight||el.scrollTop>0;});await page.screenshot({path:resolve(out,'inventory-system-visual-tooltip-scroll-1024x576.png')});record('equipment-tip-retains-width-type-and-pointer-scrolling',{styles});
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.error=String(error.stack??error);console.error(error);process.exitCode=1;await page?.screenshot({path:resolve(out,'inventory-system-visual-failure.png')}).catch(()=>{});}
finally{await browser?.close();await pool?.end();await stopChild(web);await stopChild(api);if(db){assert(resolve(db.work).startsWith(resolve(root,'.qa')+sep));report.cleanup=await db.stop();}await writeFile(resolve(out,'inventory-system-visual-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,out}));}
