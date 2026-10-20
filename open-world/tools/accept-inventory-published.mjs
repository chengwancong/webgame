import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {versions} from '../packages/contracts/index.ts';

const checkCharacter=process.argv.includes('--character');
const origin='http://127.0.0.1:8612',out=resolve(checkCharacter?'../docs/reviews/open-world/character-wow-20261001':'../docs/reviews/open-world/inventory-categories-20261001');
await mkdir(out,{recursive:true});
const health=await(await fetch(origin+'/api/health')).json(),content=await(await fetch(origin+'/api/content')).json();
assert.deepEqual(health.versions,versions);assert.deepEqual(content.versions,versions);assert.equal(health.auth_mode,'account-only');
const manifest=JSON.parse(await readFile('packages/asset-manifest/ui.v2.json','utf8'));
const icons=Object.entries(manifest.assets).filter(([id])=>id.startsWith('item-material-')||['item-tonic-attack','item-tonic-hp','item-skill-book'].includes(id)).map(([id,asset])=>({id,...asset}));assert.equal(icons.length,14);
const errors=[],browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(origin);await page.locator('#username').fill('bag_release_'+Date.now().toString(36));assert.equal(await page.locator('#password').count(),0);await page.locator('[data-action=login]').click();await page.locator('#hero-name').waitFor();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');
 const before=await page.evaluate(()=>{const s=window.awInspect();return{id:s.snapshot.id,gear:s.snapshot.gear,region:s.region,safe:s.snapshot.progress.safe};});assert.equal(before.region,before.safe);
 const decoded=await page.evaluate(icons=>Promise.all(icons.map(async icon=>{const img=new Image();img.src=icon.path;await img.decode();return {id:icon.id,width:img.naturalWidth,height:img.naturalHeight};})),icons);assert(decoded.every(icon=>icon.width===256&&icon.height===256));
 await page.locator('[data-action=panel][data-id=bag]').click();for(const id of ['all','equipment','consumables','materials','quest']){await page.locator(`[data-action=bag-category][data-id=${id}]`).click();assert.equal(await page.locator('.panel[data-panel=bag] .cmp-attributes').count(),0);assert.equal(await page.locator('.panel[data-panel=bag] .bag-doll .bag-eq').count(),6);}
 await page.locator('[data-action=bag-category][data-id=equipment]').click();await page.locator('#preview[data-seq]').waitFor();
 const item=page.locator('[data-action=bag-select]').last();await item.hover();await page.locator('#tooltip[aria-hidden=false][aria-busy=false]').waitFor();const tipBox=await page.locator('#tooltip').boundingBox(),detailBox=await page.locator('.bag-detail-region').boundingBox();assert(tipBox.x+tipBox.width<=detailBox.x);
 await item.click();await page.mouse.move(8,8);await page.waitForFunction(()=>document.querySelector('#tooltip')?.getAttribute('aria-hidden')==='true');await item.hover();await page.locator('#tooltip[aria-hidden=false][aria-busy=false]').waitFor();await item.click();await page.mouse.move(8,8);await page.waitForFunction(()=>document.querySelector('#tooltip')?.getAttribute('aria-hidden')==='true');await page.locator('#preview[data-seq]').waitFor();await page.screenshot({path:resolve(out,'published-bag-1280x720.png')});
 for(const viewport of [{width:1024,height:576},{width:375,height:812}]){
  await page.setViewportSize(viewport);await item.hover();await page.locator('#tooltip[aria-hidden=false][aria-busy=false]').waitFor();const bounds=await page.locator('#tooltip').boundingBox(),anchor=await item.boundingBox();assert(bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1);assert(bounds.x>=anchor.x+anchor.width||bounds.x+bounds.width<=anchor.x||bounds.y>=anchor.y+anchor.height||bounds.y+bounds.height<=anchor.y,'Tooltip must not cover its own item');await item.click();await page.waitForFunction(()=>document.querySelector('[data-action=bag-select][aria-pressed=true]')?.dataset.id===document.activeElement?.dataset.id);await page.mouse.move(8,8);
 }
 await page.setViewportSize({width:1280,height:720});await page.locator('.bag-stage [data-action=bag-character]').click();assert.equal(await page.locator('[data-equipment-part]').count(),6);
 if(checkCharacter){
  assert.equal(await page.locator('.character-chooser').count(),0);const serverStats=await page.evaluate(()=>window.awInspect().snapshot.stats);for(const key of ['hp','attack','armor'])assert.equal(Number((await page.locator(`[data-character-stat=${key}]`).textContent()).replaceAll(',','')),serverStats[key]);
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.panel[data-panel=character] img')].map(img=>img.decode())));await page.mouse.move(8,8);await page.screenshot({path:resolve(out,'published-character-1280x720.png')});
  await page.locator('[data-action=filter-slot][data-id=weapon]').click();await page.locator('.character-chooser #preview[data-seq]').waitFor();await page.mouse.move(8,8);await page.screenshot({path:resolve(out,'published-chooser-1280x720.png')});
  for(const viewport of [{width:1280,height:720},{width:1024,height:576},{width:375,height:812}]){await page.setViewportSize(viewport);await page.locator('.character-chooser [data-action=upgrade]').scrollIntoViewIfNeeded();const quoteBox=await page.locator('.character-chooser .bag-detail-actions #preview').boundingBox(),gearBox=await page.locator('.character-chooser .gear-detail').boundingBox();assert(quoteBox.y>=gearBox.y&&quoteBox.y+quoteBox.height<=gearBox.y+gearBox.height);if(viewport.width>760){const primary=await page.locator('.character-chooser #gear-primary-summary').boundingBox(),scroll=await page.locator('.character-chooser .bag-detail-scroll').boundingBox();assert(primary.y+primary.height<=scroll.y+scroll.height+1,'Primary stat must be fully visible on initial selection');}await page.screenshot({path:resolve(out,`published-chooser-${viewport.width}x${viewport.height}.png`)});}
  await page.locator('[data-action=character-chooser-close]').click();assert.equal(await page.locator('.character-chooser').count(),0);await page.setViewportSize({width:1280,height:720});
 }
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');assert.equal(await page.evaluate(()=>window.awInspect().snapshot.id),before.id);assert.deepEqual(await page.evaluate(()=>window.awInspect().snapshot.gear),before.gear);assert.equal(await page.evaluate(()=>window.awInspect().region),before.safe);assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'published.json'),JSON.stringify({ok:true,origin,versions,accountOnly:true,camp:true,sessionRestore:true,gearPreserved:true,inventoryCategories:5,characterSlots:6,characterLayout:checkCharacter?'paperdoll-and-stats':undefined,icons:decoded,errors},null,2)+'\n');console.log(JSON.stringify({ok:true,versions,icons:decoded.length,accountOnly:true,sessionRestore:true,out}));
}finally{await browser.close();}
